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

# 音量增益上限。
# PipeWire 的软件音量可以超过 100%（wpctl 手册：「Volume percentages can exceed
# 100% unless limited」）。蓝牙接收场景下手机推流常常偏轻，需要额外增益。
# 300% 是实测比较安全的上限：再高容易削波失真。
MAX_GAIN = 3.0

# 「自动增益」触发阈值：外部源音量低于这个值就认为偏小
LOW_VOLUME_THRESHOLD = 0.75

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


def _user_session_env():
    """构造用户会话的环境变量。

    为什么需要这个？
    ----------------
    Decky 后端进程虽然以 deck 用户运行，但**没有继承 `XDG_RUNTIME_DIR`**。
    没有它，`systemctl --user` 会报 "Failed to connect to bus: No medium found"，
    因为 systemctl 找不到会话总线的 socket。

    所有 `systemctl --user` 调用都必须带上这两个变量。
    """
    env = {}
    uid = None
    try:
        uid = os.getuid()
    except Exception:
        pass
    if uid is None:
        try:
            import pwd
            uid = pwd.getpwnam(os.environ.get("USER", "deck")).pw_uid
        except Exception:
            uid = 1000
    env["XDG_RUNTIME_DIR"] = "/run/user/%d" % uid
    env["DBUS_SESSION_BUS_ADDRESS"] = "unix:path=/run/user/%d/bus" % uid
    return env


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
        self._agent_ready = False
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
            "power_state": kv.get("PowerState", ""),
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
        """打开蓝牙。

        失败时区分两种原因，给出可操作的提示：
        1. **rfkill 阻挡**（`PowerState: off-blocked`）—— 射频被禁用，
           报错是 `org.bluez.Error.Failed`。需要 `rfkill unblock` 或用
           Steam 自己的蓝牙开关解除。
        2. **权限不足** —— 报错是 `org.bluez.Error.NotAuthorized`。
           游戏模式下没有 polkit agent，需要去桌面模式授权。
        """
        rc, out = await self._ctl("power", "on")
        if rc != 0 and "Failed" in out:
            raise BtError(await self._explain_power_failure(out))
        self._show_cache = (0.0, None)
        return True

    async def _explain_power_failure(self, raw_output):
        """把 bluetoothctl 的含糊报错翻译成能照着做的提示。"""
        tail = (raw_output or "").strip().splitlines()
        last = tail[-1] if tail else "未知错误"

        # 先看适配器状态，判断是 rfkill 还是权限
        state = ""
        try:
            info = await self.show(force=True)
            state = (info.get("power_state") or "").lower()
        except Exception:
            pass

        if "off-blocked" in state or "blocked" in state:
            rf = await self.rfkill_status()
            detail = ""
            if rf.get("soft"):
                detail = "软阻挡（Soft blocked）"
            elif rf.get("hard"):
                detail = "硬阻挡（Hard blocked）"
            return (
                "蓝牙被射频开关阻挡了（%s）。\n"
                "解决办法（任选其一）：\n"
                "  1. 游戏模式里用 Steam 自己的开关：Steam 按钮 → 设置 → 蓝牙 → 打开\n"
                "  2. 终端执行：sudo rfkill unblock bluetooth\n"
                "原始错误：%s" % (detail or "rfkill", last)
            )

        if "NotAuthorized" in (raw_output or "") or "not authorized" in (raw_output or "").lower():
            return (
                "没有权限打开蓝牙（org.bluez.Error.NotAuthorized）。\n"
                "游戏模式下没有 polkit 授权弹窗，所以需要：\n"
                "  1. 切到桌面模式，用 KDE 的蓝牙开关打开一次（会弹授权窗口）\n"
                "  2. 或者终端执行：sudo bluetoothctl power on\n"
                "原始错误：%s" % last
            )

        return "打开蓝牙失败：%s" % last

    async def rfkill_status(self):
        """读取 rfkill 的蓝牙阻挡状态。返回 {'soft': bool, 'hard': bool, 'found': bool}。"""
        out = {"soft": False, "hard": False, "found": False}
        try:
            rc, text = await run_cmd(["rfkill", "list", "bluetooth"], timeout=5.0)
        except BtError:
            return out
        if rc != 0:
            return out
        low = (text or "").lower()
        if "bluetooth" not in low:
            return out
        out["found"] = True
        out["soft"] = "soft blocked: yes" in low
        out["hard"] = "hard blocked: yes" in low
        return out

    async def unblock_rfkill(self):
        """解除 rfkill 软阻挡。硬阻挡需要物理开关，软件解不了。"""
        try:
            rc, out = await run_cmd(["rfkill", "unblock", "bluetooth"], timeout=8.0)
        except BtError as e:
            raise BtError("rfkill 不可用：%s" % e)
        if rc != 0:
            raise BtError(
                "解除 rfkill 阻挡失败：%s\n"
                "这需要 root 权限，请手动执行：sudo rfkill unblock bluetooth"
                % (out or "").strip()
            )
        self._log("已执行 rfkill unblock bluetooth")
        self._show_cache = (0.0, None)
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

    # -- 修复配对 ---------------------------------------------------------
    async def forget_device(self, mac):
        """彻底删除本机的该设备记录（含绑定密钥）。

        为什么需要这个？
        ----------------
        BlueZ 有个已知的 Just-Works 重配对问题：
        手机「忘记」Deck 后重新配对，Deck 端仍持有旧绑定密钥，
        而 BlueZ 默认 `JustWorksRepairing = never` 会拒绝替换，
        于是报 `incorrect PIN or passkey` / `PIN or Key Missing (0x06)`。

        参考：bluez#428、bluez#798。

        解法就是**先在本机删掉这个设备**（`bluetoothctl remove`），
        让两端密钥状态一致，再重新配对。
        """
        if not is_mac(mac):
            raise BtError("设备地址不合法：%s" % mac)
        try:
            await self._ctl("disconnect", mac, timeout=10.0)
        except BtError:
            pass
        rc, out = await self._ctl("remove", mac, timeout=15.0)
        self._show_cache = (0.0, None)
        if rc != 0:
            tail = (out or "").strip().splitlines()
            msg = tail[-1] if tail else "未知错误"
            if "does not exist" in msg.lower() or "not available" in msg.lower():
                return True
            raise BtError("删除设备记录失败：%s" % msg)
        self._log("已删除设备记录（含绑定密钥）：%s" % mac)
        return True

    async def repair(self, mac):
        """修复配对：删记录 → 重启 agent → 重新配对。

        适用于「配对码/通行密钥不正确」这类两端密钥不一致的情况。
        """
        if not is_mac(mac):
            raise BtError("设备地址不合法：%s" % mac)
        self._log("开始修复配对：%s" % mac)
        await self.forget_device(mac)
        await self.stop_agent()
        await asyncio.sleep(0.4)
        await self.start_agent()
        try:
            await self.device_action(mac, "pair")
        except BtError as e:
            raise BtError(
                "已清除旧记录，但重新配对失败：%s\n"
                "请在手机端也「忘记」这个设备，然后重新搜索配对。" % e
            )
        try:
            await self.device_action(mac, "trust")
        except BtError:
            pass
        self._log("修复配对完成：%s" % mac)
        return True
    async def start_agent(self):
        """常驻 bluetoothctl 注册 NoInputNoOutput agent。

        为什么用命令行参数而不是 stdin 发命令？
        ----------------------------------------
        `bluetoothctl` 是交互式程序，用管道 stdin 写入命令时存在时序问题：
        进程可能还没准备好接收命令，或者命令被吞掉。之前用 stdin 方式时，
        agent 经常**根本没注册成功**，表现就是「手机弹配对码，Deck 端毫无反应」。

        改用 `bluetoothctl --agent=NoInputNoOutput` 启动参数，注册在进程
        初始化阶段完成，不依赖交互时序，可靠得多。

        三级兜底：
        1. `--agent=NoInputNoOutput`（最可靠）
        2. 若该参数不被支持，退回 stdin 发送 `agent NoInputNoOutput`
        3. 无论哪种，都持续读取输出，检测 "Agent registered" 确认注册成功
        """
        if self._agent_proc is not None and self._agent_proc.returncode is None:
            return True

        exe = which("bluetoothctl")
        if not exe:
            raise BtError("系统里找不到 bluetoothctl")

        proc = await self._spawn_agent(exe)
        self._agent_proc = proc
        self._agent_ready = False
        self._agent_task = asyncio.create_task(self._pump_agent(proc))

        # 等 agent 注册完成（最多 3 秒），拿到明确结果再返回
        for _ in range(30):
            await asyncio.sleep(0.1)
            if self._agent_ready:
                break
            if proc.returncode is not None:
                break

        if self._agent_ready:
            self._log("配对 agent 已就绪（NoInputNoOutput，已注册）")
        else:
            self._log("警告：配对 agent 未能确认注册，配对可能需要手动确认")

        # 额外保险：把本适配器的可配对打开
        try:
            await self._ctl("pairable", "on")
        except BtError:
            pass

        return True

    async def _spawn_agent(self, exe):
        """尝试用 --agent 参数启动，不支持则退回 stdin 方式。"""
        # 方式 1：命令行参数
        try:
            proc = await asyncio.create_subprocess_exec(
                exe, "--agent=NoInputNoOutput",
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.STDOUT,
            )
            # 给进程一点时间，如果立刻退出说明参数不被支持
            await asyncio.sleep(0.35)
            if proc.returncode is None:
                return proc
            self._log("--agent 参数不被支持（进程立即退出），退回 stdin 方式")
        except Exception as e:  # noqa: BLE001
            self._log("--agent 启动失败：%s，退回 stdin 方式" % e)

        # 方式 2：stdin 发命令
        proc = await asyncio.create_subprocess_exec(
            exe,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
        )
        try:
            proc.stdin.write(b"agent NoInputNoOutput\n")
            proc.stdin.write(b"default-agent\n")
            await proc.stdin.drain()
        except Exception as e:  # noqa: BLE001
            self._log("agent 命令写入失败：%s" % e)
        return proc

    async def _reply(self, text):
        """向 agent 进程写一行回复（用于兜底确认配对）。"""
        proc = self._agent_proc
        if proc is None or proc.stdin is None or proc.stdin.is_closing():
            return False
        try:
            proc.stdin.write((text + "\n").encode())
            await proc.stdin.drain()
            return True
        except Exception as e:  # noqa: BLE001
            self._log("agent 回复失败：%s" % e)
            return False

    async def _pump_agent(self, proc):
        """持续读 agent 输出：确认注册状态、记录配对事件、兜底自动确认。"""
        try:
            while True:
                line = await proc.stdout.readline()
                if not line:
                    break
                text = strip_ansi(line.decode("utf-8", "replace")).strip()
                if not text:
                    continue
                low = text.lower()

                # --- 注册状态 ---
                if "agent registered" in low:
                    self._agent_ready = True
                    self._log("[agent] 已注册")
                    continue

                # --- 兜底：自动确认配对请求 ---
                # NoInputNoOutput 理论上不需要确认，但某些手机/BlueZ 组合
                # 仍会发出 Confirmation 请求，此时必须回复 yes，否则配对卡住。
                if any(k in low for k in ("request confirmation", "confirm passkey",
                                          "authorize service", "authorize")):
                    self._log("[agent] 收到配对确认请求，自动同意：%s" % text)
                    await self._reply("yes")
                    continue
                if "enter pin code" in low or "request pin" in low:
                    self._log("[agent] 收到 PIN 请求，回复 0000：%s" % text)
                    await self._reply("0000")
                    continue
                if "request passkey" in low:
                    self._log("[agent] 收到 Passkey 请求，回复 000000：%s" % text)
                    await self._reply("000000")
                    continue

                # --- 事件记录 ---
                if any(k in low for k in ("pairing successful", "pairing failed",
                                          "connected", "disconnected", "failed")):
                    self._log("[agent] %s" % text)
        except asyncio.CancelledError:
            raise
        except Exception as e:  # noqa: BLE001
            self._log("agent 读取异常：%s" % e)
        finally:
            self._agent_ready = False
            self._log("配对 agent 已退出")

    def agent_alive(self):
        return self._agent_proc is not None and self._agent_proc.returncode is None

    def agent_registered(self):
        """agent 是否确认注册成功（比 agent_alive 更严格）。"""
        return self.agent_alive() and self._agent_ready

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
        # 允许超过 1.0（增益增强），但读回时不裁剪，交给前端决定显示
        return {"volume": max(0.0, min(MAX_GAIN, vol)), "muted": "MUTED" in out.upper()}

    async def set_volume(self, value):
        value = max(0.0, min(MAX_GAIN, float(value)))
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

    async def get_volume_of(self, node_id):
        """读取指定节点（数字 id）的音量。"""
        rc, out = await run_cmd(["wpctl", "get-volume", str(int(node_id))], timeout=5.0)
        if rc != 0:
            raise BtError("读取节点 %s 音量失败：%s" % (node_id, (out or "").strip()))
        m = re.search(r"Volume:\s*([0-9.]+)", out)
        return {
            "volume": float(m.group(1)) if m else 0.0,
            "muted": "MUTED" in out.upper(),
        }

    async def set_volume_of(self, node_id, value):
        """给指定节点单独设音量（不影响其他节点）。"""
        value = max(0.0, min(MAX_GAIN, float(value)))
        rc, out = await run_cmd(
            ["wpctl", "set-volume", str(int(node_id)), "%.2f" % value], timeout=5.0
        )
        if rc != 0:
            raise BtError("设置节点 %s 音量失败：%s" % (node_id, (out or "").strip()))
        return True

    async def set_mute_of(self, node_id, muted):
        rc, out = await run_cmd(
            ["wpctl", "set-mute", str(int(node_id)), "1" if muted else "0"], timeout=5.0
        )
        if rc != 0:
            raise BtError("设置节点 %s 静音失败：%s" % (node_id, (out or "").strip()))
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
        """重启用户级 WirePlumber 让配置生效（不需要 root）。

        ⚠️ 必须显式传 `XDG_RUNTIME_DIR`：Decky 后端进程没继承这个变量，
        `systemctl --user` 会连不上会话总线（"Failed to connect to bus"）。
        """
        env = _user_session_env()
        argv = ["env"] + ["%s=%s" % (k, v) for k, v in env.items()] \
            + ["systemctl", "--user", "restart", "wireplumber"]
        rc, out = await run_cmd(argv, timeout=20.0)
        if rc != 0:
            # 有些环境里服务名带 .service
            argv2 = ["env"] + ["%s=%s" % (k, v) for k, v in env.items()] \
                + ["systemctl", "--user", "restart", "wireplumber.service"]
            rc2, out2 = await run_cmd(argv2, timeout=20.0)
            if rc2 != 0:
                tail = (out2 or out or "").strip().splitlines()
                uid = env.get("XDG_RUNTIME_DIR", "/run/user/1000").split("/")[-1]
                raise BtError(
                    "重启 WirePlumber 失败：%s\n"
                    "请手动执行：XDG_RUNTIME_DIR=/run/user/%s systemctl --user restart wireplumber"
                    % (tail[-1] if tail else "未知错误", uid)
                )
        self._log("WirePlumber 已重启")
        return True
