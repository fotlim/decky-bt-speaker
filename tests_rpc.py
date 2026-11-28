"""
RPC 冒烟测试：真正实例化 Plugin，逐个调用每个 RPC，确认不会崩。

为什么需要这个？
--------------
`tests_api.py` 只做静态检查（`self.X` 是否存在）。但 v3.0.0 那个 bug
（`self.dim.session`）虽然能被静态检查抓到，还有另一类问题抓不到：

- 调用了存在的方法，但**参数个数/类型不对**
- 方法内部引用了不存在的**局部**变量
- 方法返回值的结构变了，但调用方（前端）还在用旧结构

所以这里真的跑一遍：把外部依赖（bluetoothctl / wpctl / pactl）全部
mock 掉，然后挨个 `await` 每个 `@_safe` 包裹的 RPC，看是否返回
`{"__bt_error__": ...}`。

⚠️ 判定标准：RPC 返回 `__bt_error__` **不算失败**（环境里没有蓝牙，
报错是正常的）。真正的失败是：
  - 抛未捕获异常
  - 报 `AttributeError` / `NameError` / `TypeError` 这类**代码错误**
  （环境缺失导致的 `BtError` / 命令找不到 是允许的）

用法：python tests_rpc.py
"""

import asyncio
import importlib.util
import inspect
import io
import os
import re
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
STUB = os.path.join(ROOT, "_decky_stub.py")

FAILED = []

# 允许出现在错误信息里的「环境问题」关键词 —— 这些不算代码 bug
ENV_ERRORS = (
    "command not found", "not found", "No such file", "timed out",
    "找不到", "未加载", "不可用", "没有", "失败",
    "bluetoothctl", "wpctl", "pactl", "pw-dump", "busctl",
    "BtError", "permission", "Permission", "denied",
)

# 这些错误一定是**代码 bug**，必须零容忍
CODE_ERRORS = (
    "AttributeError", "NameError", "TypeError", "KeyError",
    "IndexError", "UnboundLocalError", "ImportError",
    "has no attribute", "is not defined", "unexpected keyword",
    "missing 1 required", "takes 0 positional", "not callable",
)


def check(name, cond, detail=""):
    if cond:
        print("  PASS  %s" % name)
    else:
        print("  FAIL  %s %s" % (name, detail))
        FAILED.append(name)


def install_decky_stub():
    if "decky" in sys.modules:
        return True
    if not os.path.exists(STUB):
        return False
    spec = importlib.util.spec_from_file_location("decky", STUB)
    if spec is None or spec.loader is None:
        return False
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    sys.modules["decky"] = mod
    return True


def find_rpcs(cls):
    """找出所有 RPC：`@_safe` 装饰过的 async 方法。

    `_safe` 用 functools.wraps，所以能通过 `__wrapped__` 认出来。
    """
    out = []
    for name, fn in inspect.getmembers(cls, predicate=inspect.isfunction):
        if name.startswith("_"):
            continue
        if hasattr(fn, "__wrapped__"):
            out.append((name, fn))
    return out


async def main():
    if not install_decky_stub():
        print("缺少 _decky_stub.py，无法导入 main")
        return 1
    sys.path.insert(0, ROOT)

    try:
        import main as m  # noqa: E402
    except Exception as e:  # noqa: BLE001
        print("导入 main.py 失败：%s" % e)
        return 1

    Plugin = m.Plugin
    inst = Plugin()

    # 手工初始化最小状态（不跑 _main，避免真的去连蓝牙）
    inst._cache = {}
    inst.settings = dict(m.DEFAULT_SETTINGS)
    inst.settings_path = os.path.join(ROOT, "_test_settings.json")
    inst.log_file = ""
    inst._last_manual_volume = 0.0
    inst._auto_gain_done = False
    inst._keep_task = None
    inst._pre_sleep = None

    # 外部依赖全部 mock 成「空但合法」
    inst.bz = _FakeBz()
    inst.wp = _FakeWp()
    inst.wpcfg = _FakeCfg()
    inst.foc = _FakeFocus()
    inst.guard = _FakeGuard()
    inst.norm = _FakeNorm()
    inst.eqcfg = _FakeCfg()
    inst.outcfg = _FakeCfg()
    inst.meta = _FakeMeta()
    inst.qcfg = _FakeCfg()
    inst.dim = _FakeDim()
    inst.sleeper = None

    rpcs = find_rpcs(Plugin)
    print("发现 %d 个 RPC" % len(rpcs))
    check("RPC 数量合理（>= 20）", len(rpcs) >= 20, str(len(rpcs)))

    print()
    print("逐个调用 RPC（环境错误允许，代码错误零容忍）")
    code_bugs = []
    env_errors = 0
    ok_count = 0

    for name, fn in rpcs:
        # 按签名补默认参数
        sig = inspect.signature(fn)
        args = []
        skip = False
        for pname, p in list(sig.parameters.items())[1:]:  # 跳过 self
            if p.default is not inspect.Parameter.empty:
                args.append(p.default)
            elif pname in ("mac",):
                args.append("AA:BB:CC:DD:EE:FF")
            elif pname in ("value", "delta", "gain", "seconds", "timeout",
                           "node_id", "tail", "on", "muted", "enabled"):
                args.append(1)
            elif pname in ("action",):
                args.append("connect")
            elif pname in ("preset", "profile", "mode", "key", "alias", "text"):
                args.append("x")
            else:
                # 必需参数但不知道怎么造 —— 跳过（记一笔）
                skip = True
                break
        if skip:
            print("  SKIP  %-24s （必需参数无法自动构造）" % name)
            continue

        try:
            r = await fn(inst, *args)
        except Exception as e:  # noqa: BLE001
            msg = "%s: %s" % (type(e).__name__, e)
            print("  RAISE %-24s %s" % (name, msg[:110]))
            code_bugs.append((name, msg))
            continue

        if isinstance(r, dict) and "__bt_error__" in r:
            err = str(r["__bt_error__"])
            if any(k in err for k in CODE_ERRORS):
                print("  BUG   %-24s %s" % (name, err[:110]))
                code_bugs.append((name, err))
            else:
                env_errors += 1
        else:
            ok_count += 1

    print()
    check("没有代码级错误（AttributeError / NameError / TypeError ...）",
          not code_bugs,
          "共 %d 个: %s" % (len(code_bugs), code_bugs[:5]))
    print("  （环境错误 %d 个、正常返回 %d 个，均属预期）" % (env_errors, ok_count))

    print()
    if FAILED:
        print("失败 %d 项：%s" % (len(FAILED), ", ".join(FAILED)))
        return 1
    print("RPC 冒烟测试全部通过 ✅")
    return 0


# ---------------------------------------------------------------------------
# 假对象：只提供 main.py 用到的接口，行为尽量「空但合法」
# ---------------------------------------------------------------------------
class _FakeBz:
    def __init__(self):
        self.adapter_path = "/org/bluez/hci0"

    async def show(self, force=False):
        return {"powered": True, "discoverable": True, "alias": "Steam Deck",
                "address": "14:D4:24:B8:23:0C", "raw": "", "a2dp_sink": True}

    async def list_devices(self, which=""):
        return []

    async def info(self, mac):
        return {"mac": mac, "name": "test", "connected": False}

    async def device_action(self, mac, action, value=None):
        return True

    async def disconnect_all(self):
        return {"count": 0}

    def agent_alive(self):
        return True

    def agent_registered(self):
        return True

    async def start_agent(self):
        return True

    async def stop_agent(self, quick=False):
        return True

    async def power_on(self):
        return True

    async def set_discoverable(self, on):
        return True

    async def set_alias(self, alias):
        return True

    async def rfkill_status(self):
        return {"found": True, "soft": False, "hard": False}

    async def unblock_rfkill(self):
        return True

    async def pair_and_trust(self, mac):
        return True

    async def forget_device(self, mac):
        return True

    async def repair(self, mac):
        return True

    async def start_discovery(self, timeout=20):
        return True

    async def stop_discovery(self):
        return True

    def scanning(self):
        return False

    async def list_discovered(self, include_paired=True):
        return []


class _FakeWp:
    async def get_volume(self):
        return {"volume": 0.5, "muted": False, "ok": True}

    async def set_volume(self, v):
        return True

    async def step_volume(self, d):
        return True

    async def set_mute(self, m):
        return True

    async def get_volume_of(self, nid):
        return {"volume": 0.5, "muted": False}

    async def set_volume_of(self, nid, v):
        return True

    async def step_volume_of(self, nid, d):
        return True

    async def set_mute_of(self, nid, m):
        return True

    async def status_text(self):
        return ""

    @staticmethod
    def parse_default_sink(text):
        return ""


class _FakeCfg:
    def apply(self, *a, **k):
        return True

    async def restart(self):
        return True

    def remove(self):
        return True

    def apply_latency(self, *a, **k):
        return True

    @staticmethod
    def installed():
        return False

    @staticmethod
    def conf_path():
        return "/tmp/x"

    @staticmethod
    def current():
        return None


class _FakeFocus:
    async def get_active_profile(self):
        return ""

    async def set_autoswitch(self, on):
        return True

    async def get_autoswitch(self):
        return False

    async def list_codecs(self):
        return []

    @staticmethod
    def mode_label(mode):
        return mode


class _FakeGuard:
    def __init__(self):
        self.timeout_sec = 0

    def observe(self, active):
        return False

    def reset(self):
        pass

    def status(self):
        return {"enabled": False, "timeout": 0, "idle_sec": 0,
                "was_active": False, "remaining": None}

    def configure(self, t):
        pass

    @property
    def enabled(self):
        return False


class _FakeNorm:
    def observe(self, v):
        return {"jumped": False, "baseline": None, "delta": 0.0}

    def status(self):
        return {"baseline": None, "last": None, "jumps": 0}

    def set_baseline(self, v):
        pass

    def reset(self):
        pass


class _FakeMeta:
    async def read_first(self, macs):
        return None


class _FakeDim:
    """DimSession 的假替身 —— 接口必须与真实的一致。"""

    def __init__(self):
        self._inhibitor = None

    async def enter(self):
        return {"ok": True, "dimmed": True, "backlight_off": True,
                "max_seconds": 300, "inhibit": {"ok": True}}

    async def exit(self, reason=""):
        return {"ok": True, "dimmed": False}

    async def shutdown(self):
        return None

    def status(self):
        return {"available": True, "dimmed": False, "elapsed": 0,
                "max_seconds": 300, "inhibit_held": False,
                "inhibit_available": True}

    def screen_status(self):
        return {"available": True, "dimmed": False, "elapsed": 0,
                "max_seconds": 300}

    def diagnose(self):
        return {"backlight_dev": "/sys/class/backlight/amdgpu_bl0"}

    async def inhibit_status(self):
        return {"available": True, "held": False, "system": ""}

    def inhibit_dict(self):
        return {"held": False}


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
