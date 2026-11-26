"""
蓝牙音箱后端：封装 BlueZ / PipeWire 的系统调用。

设计要点：
- 只依赖标准库 + 系统自带的 bluetoothctl / busctl / wpctl（不引入 dbus-python，
  因为 Decky 的后端是 PyInstaller 冻结环境，第三方模块大概率 import 失败）。
- 所有外部命令都走 asyncio 子进程，带超时，失败抛 BtError（由 main.py 转成可读错误）。
- 配对采用「常驻 bluetoothctl + NoInputNoOutput agent」方案：
  手机侧只要点确认即可，Deck 这边不需要弹窗输入 PIN（音箱该有的行为）。
"""

import os
import asyncio
import re
import shutil

# A2DP Sink / Source 的蓝牙服务 UUID（用来判断适配器有没有对外宣告「我是音箱」）
A2DP_SINK_UUID = "0000110b"
A2DP_SOURCE_UUID = "0000110a"
HFP_AG_UUID = "0000111f"
HFP_HF_UUID = "0000111e"

_ANSI_RE = re.compile(r"\x1b\[[0-9;?]*[A-Za-z]")
_MAC_RE = re.compile(r"^([0-9A-F]{2}:){5}[0-9A-F]{2}$", re.I)


class BtError(Exception):
    """可读的蓝牙/音频错误。"""


def strip_ansi(s):
    return _ANSI_RE.sub("", s or "")


# Decky 后端起子进程时不一定继承完整的 PATH（loader v3.2.6 才修），
# 所以优先用绝对路径探测，避免「命令明明装着却报找不到」。
_BIN_DIRS = ("/usr/bin", "/usr/local/bin", "/bin", "/usr/sbin", "/run/current-system/sw/bin")


def which(name):
    if os.path.isabs(name):
        return name if os.path.exists(name) else None
    for d in _BIN_DIRS:
        p = os.path.join(d, name)
        if os.path.exists(p) and os.access(p, os.X_OK):
            return p
    return shutil.which(name)


def is_mac(s):
    return bool(s and _MAC_RE.match(s.strip()))


def yes(s):
    return str(s).strip().lower() in ("yes", "true", "1", "on")


async def run_cmd(argv, timeout=8.0):
    """执行外部命令，返回 (returncode, 合并后的输出)。找不到命令直接抛 BtError。"""
    exe = which(argv[0])
    if not exe:
        raise BtError("系统里找不到命令：%s" % argv[0])
    try:
        proc = await asyncio.create_subprocess_exec(
            exe,
            *argv[1:],
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
        )
    except Exception as e:  # noqa: BLE001 - 兜底成可读错误
        raise BtError("启动 %s 失败：%s" % (argv[0], e))
    try:
        out, _ = await asyncio.wait_for(proc.communicate(), timeout)
    except asyncio.TimeoutError:
        try:
            proc.kill()
        except Exception:
            pass
        raise BtError("%s 执行超时（%.0fs）" % (argv[0], timeout))
    return proc.returncode, strip_ansi(out.decode("utf-8", "replace"))


def parse_kv(text):
    """把 bluetoothctl 的 `Key: value` 输出解析成 dict（同名 key 只取第一个）。"""
    out = {}
    for line in (text or "").splitlines():
        m = re.match(r"^\s*([A-Za-z][A-Za-z0-9 _]*?):\s?(.*)$", line)
        if not m:
            continue
        k = m.group(1).strip()
        v = m.group(2).strip()
        if k and k not in out:
            out[k] = v
    return out


# ---------------------------------------------------------------------------
# BlueZ
# ---------------------------------------------------------------------------
class BlueZ:
    """BlueZ 控制层。"""

    def __init__(self, log=None):
        self._log = log or (lambda *_: None)
        self.adapter_path = "/org/bluez/hci0"
        self._agent_proc = None
        self._agent_task = None
        self._show_cache = (0.0, None)

    # -- 基础 -------------------------------------------------------------
    @staticmethod
    def available():
        return which("bluetoothctl") is not None

    async def _ctl(self, *args, timeout=10.0):
        return await run_cmd(["bluetoothctl", *args], timeout)

    async def _busctl_set(self, path, iface, prop, sig, value):
        rc, out = await run_cmd(
            ["busctl", "set-property", "org.bluez", path, iface, prop, sig, value]
        )
        if rc != 0:
            raise BtError("设置 %s 失败：%s" % (prop, (out or "").strip() or "未知错误"))
        return True

    # -- 适配器 -----------------------------------------------------------
    async def resolve_adapter(self):
        """找出 hciN 的 D-Bus 路径（bluetoothctl show 不打印路径，用 busctl tree 找）。"""
        try:
            rc, out = await run_cmd(["busctl", "tree", "org.bluez"], timeout=6.0)
            if rc == 0:
                for line in out.splitlines():
                    m = re.search(r"(/org/bluez/hci\d+)", line)
                    if m:
                        self.adapter_path = m.group(1)
                        break
        except BtError:
            pass
        return self.adapter_path

    async def show(self, force=False):
        """读取适配器状态（带 2 秒缓存，避免轮询时疯狂起子进程）。"""
        import time

        now = time.monotonic()
        ts, cached = self._show_cache
        if not force and cached and (now - ts) < 2.0:
            return cached
        rc, out = await self._ctl("show")
        if rc != 0 and "No default controller" in out:
            raise BtError("没有找到蓝牙适配器（No default controller）")
        kv = parse_kv(out)
        m = re.search(r"Controller\s+([0-9A-Fa-f:]{17})", out)
        data = {
            "address": m.group(1).upper() if m else kv.get("Controller", ""),
            "alias": kv.get("Alias") or kv.get("Name") or "Steam Deck",
            "name": kv.get("Name", ""),
            "powered": yes(kv.get("Powered", "no")),
            "discoverable": yes(kv.get("Discoverable", "no")),
            "pairable": yes(kv.get("Pairable", "no")),
            "discovering": yes(kv.get("Discovering", "no")),
            "class": kv.get("Class", ""),
            "uuids": kv.get("UUIDs", ""),
            "raw": out,
        }
        # UUIDs 在 bluetoothctl show 里是跨多行罗列的，直接对全文做包含判断更可靠
        low = out.lower()
        data["a2dp_sink"] = A2DP_SINK_UUID in low
        data["a2dp_source"] = A2DP_SOURCE_UUID in low
        data["hfp_ag"] = HFP_AG_UUID in low
        data["hfp_hf"] = HFP_HF_UUID in low
        self._show_cache = (now, data)
        return data

    async def power_on(self):
        rc, out = await self._ctl("power", "on")
        if rc != 0 and "Failed" in out:
            raise BtError("打开蓝牙失败：%s" % out.strip().splitlines()[-1])
        return True

    async def set_discoverable(self, on):
        """可被发现。先把 DiscoverableTimeout 设成 0（永久），再置 Discoverable。"""
        try:
            await self.resolve_adapter()
            await self._busctl_set(self.adapter_path, "org.bluez.Adapter1", "DiscoverableTimeout", "u", "0")
        except BtError:
            # busctl 不可用时退回 bluetoothctl（会有 180s 超时，由 keepalive 兜住）
            pass
        await self._ctl("discoverable", "on" if on else "off")
        if on:
            await self._ctl("pairable", "on")
        self._show_cache = (0.0, None)
        return True

    async def set_pairable(self, on):
        await self._ctl("pairable", "on" if on else "off")
        self._show_cache = (0.0, None)
        return True

    async def set_alias(self, alias):
        alias = (alias or "").strip()
        if not alias:
            raise BtError("设备名不能为空")
        if len(alias) > 40:
            raise BtError("设备名太长（最多 40 个字符）")
        await self.resolve_adapter()
        try:
            await self._busctl_set(self.adapter_path, "org.bluez.Adapter1", "Alias", "s", alias)
        except BtError:
            await self._ctl("system-alias", alias)
        self._show_cache = (0.0, None)
        return True

    # -- 设备 -------------------------------------------------------------
    async def list_devices(self, kind=""):
        """kind: '' | 'Paired' | 'Connected'。返回 [{'mac','name'}]。"""
        args = ["devices"] + ([kind] if kind else [])
        rc, out = await self._ctl(*args)
        if rc != 0:
            return []
        devs = []
        for line in out.splitlines():
            m = re.match(r"^\s*Device\s+([0-9A-Fa-f:]{17})\s*(.*)$", line)
            if m:
                devs.append({"mac": m.group(1).upper(), "name": (m.group(2) or "").strip() or m.group(1).upper()})
        return devs

    async def info(self, mac):
        if not is_mac(mac):
            raise BtError("设备地址不合法：%s" % mac)
        rc, out = await self._ctl("info", mac)
        if rc != 0:
            raise BtError("读取设备 %s 信息失败" % mac)
        kv = parse_kv(out)
        return {
            "mac": mac.upper(),
            "name": kv.get("Name") or kv.get("Alias") or mac.upper(),
            "alias": kv.get("Alias", ""),
            "icon": kv.get("Icon", ""),
            "class": kv.get("Class", ""),
            "paired": yes(kv.get("Paired", "no")),
            "trusted": yes(kv.get("Trusted", "no")),
            "connected": yes(kv.get("Connected", "no")),
            "blocked": yes(kv.get("Blocked", "no")),
        }

    async def device_action(self, mac, action):
        if not is_mac(mac):
            raise BtError("设备地址不合法：%s" % mac)
        action = (action or "").strip().lower()
        mapping = {
            "connect": ["connect", mac],
            "disconnect": ["disconnect", mac],
            "trust": ["trust", mac],
            "untrust": ["untrust", mac],
            "pair": ["pair", mac],
            "remove": ["remove", mac],
        }
        if action not in mapping:
            raise BtError("不支持的操作：%s" % action)
        rc, out = await self._ctl(*mapping[action], timeout=25.0)
        ok = rc == 0 and ("Failed" not in out) and ("not available" not in out)
        if not ok:
            tail = (out or "").strip().splitlines()
            raise BtError("%s 失败：%s" % (action, tail[-1] if tail else "未知错误"))
        self._show_cache = (0.0, None)
        return True

    # -- 配对 agent -------------------------------------------------------
    async def start_agent(self):
        """常驻一个 bluetoothctl，注册 NoInputNoOutput agent（手机连上来只需点确认）。"""
        if self._agent_proc is not None and self._agent_proc.returncode is None:
            return True
        exe = which("bluetoothctl")
        if not exe:
            raise BtError("系统里找不到 bluetoothctl")
        try:
            proc = await asyncio.create_subprocess_exec(
                exe,
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.STDOUT,
            )
        except Exception as e:  # noqa: BLE001
            raise BtError("启动配对 agent 失败：%s" % e)
        self._agent_proc = proc
        try:
            proc.stdin.write(b"agent NoInputNoOutput\n")
            proc.stdin.write(b"default-agent\n")
            await proc.stdin.drain()
        except Exception as e:  # noqa: BLE001
            self._log("agent 写入失败：%s" % e)
        self._agent_task = asyncio.create_task(self._pump_agent(proc))
        self._log("配对 agent 已启动（NoInputNoOutput）")
        return True

    async def _pump_agent(self, proc):
        """持续读 agent 的输出（顺便把配对事件写进日志），进程退出就标记失效。"""
        try:
            while True:
                line = await proc.stdout.readline()
                if not line:
                    break
                text = strip_ansi(line.decode("utf-8", "replace")).strip()
                if not text:
                    continue
                low = text.lower()
                if any(k in low for k in ("pairing successful", "pairing failed", "confirm", "authorize", "connected", "disconnected", "agent registered", "failed")):
                    self._log("[agent] %s" % text)
        except asyncio.CancelledError:
            raise
        except Exception as e:  # noqa: BLE001
            self._log("agent 读取异常：%s" % e)
        finally:
            self._log("配对 agent 已退出")

    def agent_alive(self):
        return self._agent_proc is not None and self._agent_proc.returncode is None

    async def stop_agent(self):
        proc = self._agent_proc
        self._agent_proc = None
        if self._agent_task is not None:
            try:
                self._agent_task.cancel()
            except Exception:
                pass
            self._agent_task = None
        if proc is None:
            return
        try:
            if proc.stdin and not proc.stdin.is_closing():
                proc.stdin.write(b"quit\n")
                await proc.stdin.drain()
                proc.stdin.close()
        except Exception:
            pass
        try:
            await asyncio.wait_for(proc.wait(), 3.0)
        except Exception:
            try:
                proc.kill()
            except Exception:
                pass
        self._log("配对 agent 已停止")


# ---------------------------------------------------------------------------
# PipeWire / WirePlumber（音量与音频流）
# ---------------------------------------------------------------------------
class Wp:
    """PipeWire 音量与状态。"""

    @staticmethod
    def available():
        return which("wpctl") is not None

    async def get_volume(self):
        """返回 {'volume': 0..1, 'muted': bool}。"""
        rc, out = await run_cmd(["wpctl", "get-volume", "@DEFAULT_AUDIO_SINK@"], timeout=5.0)
        if rc != 0:
            raise BtError("读取音量失败：%s" % (out or "").strip())
        m = re.search(r"Volume:\s*([0-9.]+)", out)
        vol = float(m.group(1)) if m else 0.0
        return {"volume": max(0.0, min(1.5, vol)), "muted": "MUTED" in out.upper()}

    async def set_volume(self, value):
        value = max(0.0, min(1.5, float(value)))
        rc, out = await run_cmd(["wpctl", "set-volume", "@DEFAULT_AUDIO_SINK@", "%.2f" % value], timeout=5.0)
        if rc != 0:
            raise BtError("设置音量失败：%s" % (out or "").strip())
        return True

    async def set_mute(self, muted):
        rc, out = await run_cmd(
            ["wpctl", "set-mute", "@DEFAULT_AUDIO_SINK@", "1" if muted else "0"], timeout=5.0
        )
        if rc != 0:
            raise BtError("设置静音失败：%s" % (out or "").strip())
        return True

    async def status_text(self):
        rc, out = await run_cmd(["wpctl", "status"], timeout=6.0)
        return out if rc == 0 else ""

    @staticmethod
    def parse_default_sink(text):
        in_sinks = False
        for line in (text or "").splitlines():
            if "Sinks:" in line:
                in_sinks = True
                continue
            if in_sinks:
                if any(k in line for k in ("Sources:", "Streams:", "Clients:", "Devices:", "Video")):
                    break
                if "*" in line:
                    m = re.search(r"\*\s+\d+\.\s+(.+?)(?:\s{2,}\[|$)", line)
                    if m:
                        return m.group(1).strip()
        return ""

    @staticmethod
    def has_bt_stream(text):
        """有没有蓝牙音频节点在跑。

        注意方向：Deck 当音箱（A2DP Sink）时，手机推来的流会变成本机的
        `bluez_input.<MAC>` 节点；Deck 往耳机推流时才是 `bluez_output.<MAC>`。
        """
        return bool(re.search(r"bluez_(?:input|output)\.", text or "", re.I))


async def versions():
    """收集 PipeWire / WirePlumber / BlueZ 版本，供诊断页显示。"""
    out = {"pipewire": "", "wireplumber": "", "bluez": ""}

    async def _grab(key, argv, pattern):
        try:
            rc, text = await run_cmd(argv, timeout=4.0)
            if rc == 0:
                m = re.search(pattern, text)
                if m:
                    out[key] = m.group(1)
        except BtError:
            pass

    await _grab("pipewire", ["pipewire", "--version"], r"libpipewire\s+([0-9]+\.[0-9]+\.[0-9]+)")
    await _grab("wireplumber", ["wireplumber", "--version"], r"([0-9]+\.[0-9]+\.[0-9]+)")
    await _grab("bluez", ["bluetoothctl", "--version"], r"([0-9]+\.[0-9]+)")
    return out


# ---------------------------------------------------------------------------
# 用户级 WirePlumber 配置（不需要 root，也不受 SteamOS /etc 只读与保留清单影响）
# ---------------------------------------------------------------------------
WP_CONF_NAME = "50-bt-speaker.conf"

# 这份配置解决四个「连上了但不好用」的坑：
# 1. bluez5.roles 收窄到只剩 A2DP 两个角色 —— 规避双角色设备被协商成 audio-gateway
#    导致根本没有 a2dp-sink profile 的上游回归（wireplumber#969 / bluez#1922）
# 2. bluez5.media-source-role = playback —— 手机推来的流直接播到本机 sink
# 3. bluez5.hw-volume 加上 a2dp_sink —— 让接收端能用蓝牙硬件音量
# 4. bluetooth.autoswitch-to-headset-profile = false —— 防止有人开麦时掉成 mSBC 单声道
WP_CONF_TEMPLATE = """# 由「蓝牙音箱」Decky 插件生成
# 位置：~/.config/wireplumber/wireplumber.conf.d/{name}
# 作用：把 Steam Deck 调成一台好用的 A2DP 接收端（蓝牙音箱）
# 删除本文件并重启 WirePlumber 即可恢复默认行为。

monitor.bluez.properties = {{
  # 只保留 A2DP 的收发两个角色，避免手机把 Deck 当成通话网关
  bluez5.roles = [ a2dp_sink a2dp_source ]
  # 接收端也启用蓝牙硬件音量
  bluez5.hw-volume = [ a2dp_sink a2dp_source ]
  bluez5.enable-sbc-xq = true
}}

monitor.bluez.rules = [
  {{
    matches = [
      {{ node.name = "~bluez_input.*" }}
      {{ node.name = "~bluez_output.*" }}
    ]
    actions = {{
      update-props = {{
        # 手机推流直接播到本机扬声器
        bluez5.media-source-role = "playback"
        # 别因为有人开麦就切到通话单声道
        bluetooth.disable-autoswitch = true
        node.pause-on-idle = false
      }}
    }}
  }}
]

wireplumber.settings = {{
  bluetooth.autoswitch-to-headset-profile = false
}}
"""


class WpConfig:
    """管理用户级 WirePlumber 配置片段。"""

    def __init__(self, log=None):
        self._log = log or (lambda *_: None)

    @staticmethod
    def conf_dir():
        base = os.environ.get("XDG_CONFIG_HOME") or os.path.join(os.path.expanduser("~"), ".config")
        return os.path.join(base, "wireplumber", "wireplumber.conf.d")

    @classmethod
    def conf_path(cls):
        return os.path.join(cls.conf_dir(), WP_CONF_NAME)

    @classmethod
    def installed(cls):
        try:
            return os.path.isfile(cls.conf_path())
        except Exception:
            return False

    def apply(self):
        path = self.conf_path()
        try:
            os.makedirs(self.conf_dir(), exist_ok=True)
            tmp = path + ".tmp"
            with open(tmp, "w", encoding="utf-8") as f:
                f.write(WP_CONF_TEMPLATE.format(name=WP_CONF_NAME))
            os.replace(tmp, path)
        except Exception as e:  # noqa: BLE001
            raise BtError("写入 WirePlumber 配置失败：%s" % e)
        self._log("已写入 %s" % path)
        return path

    def remove(self):
        path = self.conf_path()
        try:
            if os.path.exists(path):
                os.remove(path)
                self._log("已删除 %s" % path)
        except Exception as e:  # noqa: BLE001
            raise BtError("删除 WirePlumber 配置失败：%s" % e)
        return True

    async def restart(self):
        """重启用户级 WirePlumber 让配置生效（不需要 root）。"""
        rc, out = await run_cmd(
            ["systemctl", "--user", "restart", "wireplumber"], timeout=20.0
        )
        if rc != 0:
            # 有些环境里服务名带 .service
            rc2, out2 = await run_cmd(
                ["systemctl", "--user", "restart", "wireplumber.service"], timeout=20.0
            )
            if rc2 != 0:
                raise BtError(
                    "重启 WirePlumber 失败：%s"
                    % ((out2 or out or "").strip().splitlines() or ["未知错误"])[-1]
                )
        self._log("WirePlumber 已重启")
        return True
