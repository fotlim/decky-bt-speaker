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
# 100% unless limited」）。但**超过 100% 必然削波**，表现为爆音/破音。
#
# 实测结论：1.0 是安全上限，1.3 以内轻微削波可以接受，再高就明显破音。
# 所以默认把安全上限设在 1.5，并把「超过 100%」明确标注为「增益（可能破音）」。
SAFE_GAIN = 1.5
# 上限提到 2.5：蓝牙接收场景确实常常偏轻，200% 是实际会用到的档位。
# 之所以敢放开，是因为 EQ 的 filter-chain 末尾串了 `clamp`（PipeWire 内置
# 零延迟硬限幅，钳 ±1.0），超出的部分会被削平而不是产生刺耳的爆音。
# 代价是动态范围压缩，听起来会「闷」一些 —— 这是音量与音质的取舍。
MAX_GAIN = 2.5

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


def normalize_mac(s):
    """把各种写法的 MAC 归一化成 `AA:BB:CC:DD:EE:FF`（大写冒号）。

    为什么要这个？
    ------------
    BlueZ 在不同场合给出的 MAC 格式不一致：
      - `bluetoothctl devices` 输出：`CC:42:10:8A:70:42`（大写冒号）
      - 自动生成的 Alias：`CC-42-10-8A-70-42`（**横线**）
      - 部分工具输出小写

    早期 `is_mac()` 只接受「大写冒号」，前端传小写或横线就会报
    「设备地址不合法」（真机配对电脑时踩到过）。

    这里统一：去掉所有分隔符 -> 校验 12 位十六进制 -> 重新按冒号分组大写。
    无法识别时返回空字符串。
    """
    if not s:
        return ""
    t = str(s).strip().upper()
    for ch in (":", "-", ".", " ", "\t", "\n", "\r"):
        t = t.replace(ch, "")
    if len(t) != 12:
        return ""
    if not all(c in "0123456789ABCDEF" for c in t):
        return ""
    return ":".join(t[i:i + 2] for i in range(0, 12, 2))


def is_mac(s):
    """是否是合法 MAC（接受冒号/横线/点分/纯 12 位等各种写法）。"""
    return bool(normalize_mac(s))


def is_mac_like(s):
    """判断一个字符串是不是「MAC 地址的各种写法」。

    为什么要单独一个函数？
    --------------------
    BlueZ 对**没有广播名称**的设备会自动生成 `Alias`，格式是
    `AA-BB-CC-DD-EE-FF`（**横线**分隔），而 `Name`/`Address` 用冒号。

    早期只用 `is_mac()`（只认冒号）判断，导致 `AA-BB-CC-DD-EE-FF`
    被当成「真实名字」，`has_real_name` 错判为 True ——
    「显示没有名称的设备」开关就失效了（真机反馈过这个问题）。

    这里把所有分隔符（冒号 / 横线 / 点 / 空格）统一去掉再判断。
    实现直接复用 normalize_mac()，保证两处逻辑一致。
    """
    return bool(normalize_mac(s))


def yes(s):
    return str(s).strip().lower() in ("yes", "true", "1", "on")


def _user_session_env():
    """构造用户会话的环境变量。

    为什么需要这个？
    ----------------
    Decky 后端进程虽然以 deck 用户运行，但**没有继承 `XDG_RUNTIME_DIR`**。
    而 PipeWire 客户端（`wpctl` / `pactl` / `pw-dump`）靠它定位 socket，
    缺失时的典型报错：

        pipewire-0 is not an absolute path and no runtime dir found.
        Set one of PIPEWIRE_RUNTIME_DIR, XDG_RUNTIME_DIR

    后果是 `wpctl get-volume` 读不到值（返回 0 或失败），
    表现为插件音量条显示 0%，但 Steam 自己的音量条是满的。

    同时设置 `PIPEWIRE_RUNTIME_DIR` 作为双保险 —— PipeWire 会先看它，
    再看 `XDG_RUNTIME_DIR`。两个都设，任何版本都能连上。
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
    runtime = "/run/user/%d" % uid
    env["XDG_RUNTIME_DIR"] = runtime
    env["DBUS_SESSION_BUS_ADDRESS"] = "unix:path=%s/bus" % runtime
    # PipeWire 优先读这个；与 XDG_RUNTIME_DIR 一起设，兼容所有版本
    env["PIPEWIRE_RUNTIME_DIR"] = runtime
    return env


async def run_cmd(argv, timeout=8.0, env_extra=None):
    """执行外部命令，返回 (returncode, 合并后的输出)。找不到命令直接抛 BtError。

    ⚠️ 关键：**默认注入用户会话环境变量**。

    为什么必须这么做？
    ----------------
    Decky 的后端进程以 deck 用户运行，但**不继承 `XDG_RUNTIME_DIR`**。
    而所有 PipeWire 工具（`wpctl` / `pactl` / `pw-dump`）都靠这个变量
    找到会话总线与 PipeWire socket。

    没有它，`wpctl get-volume` 会失败或返回 0，表现为：
    - 插件音量条显示 0%，但 Steam 自己的音量条是满的
    - 拖动滑杆「没反应」（其实是读写都失败了）

    这就是真机反馈「音量调节还是不同步」的真正根因 —— 之前只在
    `systemctl --user` 那条路径上补了环境变量，漏掉了 wpctl。
    """
    exe = which(argv[0])
    if not exe:
        raise BtError("系统里找不到命令：%s" % argv[0])

    env = dict(os.environ)
    env.update(_user_session_env())
    if env_extra:
        env.update(env_extra)

    try:
        proc = await asyncio.create_subprocess_exec(
            exe,
            *argv[1:],
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
            env=env,
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


# 按蓝牙 Class 推断设备类型，用于给没有名称的设备一个可读标签
def _class_label(klass):
    """从 Class of Device 推断友好类型名。"""
    try:
        # Class 形如 "0x005a020c" 或 "0x240404"
        v = int(str(klass).strip(), 16)
    except (ValueError, TypeError):
        return ""
    major = (v >> 8) & 0x1F          # Major Device Class
    minor = (v >> 2) & 0x3F          # Minor Device Class

    if major == 0x01:
        return "电脑"
    if major == 0x02:
        if minor & 0x04:
            return "手机"
        if minor & 0x08:
            return "平板"
        return "手机"
    if major == 0x04:
        # 音频/视频
        if minor & 0x01:
            return "耳机"
        if minor & 0x02:
            return "音箱"
        if minor & 0x04:
            return "麦克风"
        return "音频设备"
    if major == 0x05:
        return "外设"
    if major == 0x06:
        return "键盘鼠标"
    if major == 0x07:
        return "穿戴设备"
    if major == 0x08:
        return "玩具"
    return ""


def _parse_rssi(text):
    """解析 `bluetoothctl info` 里的 RSSI 字段，返回 int 或 None。

    形如 `RSSI: -58`。部分设备（尤其 BLE）不提供该字段。
    """
    if not text:
        return None
    m = re.search(r"(-?\d+)", str(text))
    if not m:
        return None
    try:
        v = int(m.group(1))
    except ValueError:
        return None
    # 合理范围检查，避免解析到垃圾值
    if -120 <= v <= 20:
        return v
    return None


def classify_peer(icon, klass, name=""):
    """判断推流的对端是什么类型的设备。

    为什么需要区分？
    --------------
    不同对端的 A2DP 推流电平差别很大，且 AVRCP 绝对音量实现程度不同：
      - **Windows / macOS 电脑**：完整实现 AVRCP 绝对音量，
        会把 Deck 的音量绑定到电脑的音量滑块上；
        而且推流电平通常比手机低（尤其系统音量不满时）
      - **手机**：多数不实现或实现不完整，Deck 自己控制音量

    真机反馈「电脑声音小、手机没问题」就是这个差异造成的。

    返回 'computer' | 'phone' | 'other'
    """
    ic = (icon or "").lower()
    nm = (name or "").lower()
    if "computer" in ic or "laptop" in ic:
        return "computer"
    if "phone" in ic:
        return "phone"
    # 按 Class of Device 兜底
    try:
        v = int(str(klass or "").strip(), 16)
        major = (v >> 8) & 0x1F
        if major == 0x01:
            return "computer"
        if major == 0x02:
            return "phone"
    except (ValueError, TypeError):
        pass
    # 按名字关键词兜底
    for kw in ("windows", "pc", "laptop", "desktop", "macbook", "thinkpad"):
        if kw in nm:
            return "computer"
    for kw in ("iphone", "android", "phone", "pixel", "galaxy", "redmi", "xiaomi"):
        if kw in nm:
            return "phone"
    return "other"


def _parse_uuids(info_text):
    """从 `bluetoothctl info` 输出里提取设备支持的 UUID 短码列表。

    形如 `UUID: Audio Sink                (0000110b-0000-1000-8000-00805f9b34fb)`
    返回 ['0000110b', '0000110a', ...]
    """
    if not info_text:
        return []
    out = []
    for m in re.finditer(r"\(([0-9a-fA-F]{8})-0000-1000-8000-00805f9b34fb\)", info_text):
        short = m.group(1).lower()
        if short not in out:
            out.append(short)
    return out


def _icon_label(icon):
    """从 BlueZ 的 Icon 属性推断友好类型名。"""
    table = {
        "phone": "手机",
        "computer": "电脑",
        "audio-card": "音频设备",
        "audio-headphones": "耳机",
        "audio-headset": "耳麦",
        "input-keyboard": "键盘",
        "input-mouse": "鼠标",
        "input-gaming": "手柄",
        "multimedia-player": "播放器",
        "video-display": "显示器",
        "printer": "打印机",
        "camera-photo": "相机",
        "scanner": "扫描仪",
        "modem": "调制解调器",
        "network-wireless": "网络设备",
    }
    return table.get((icon or "").strip().lower(), "")


def friendly_device_name(name, alias, icon, klass, mac):
    """给设备拼一个可读名称。

    优先级：
      1. Name（设备自己广播的名字）
      2. Alias（BlueZ 侧别名，用户可能改过）
      3. 按 Icon / Class 推断的类型 + MAC 后四位，例如「手机 · EE:FF」
      4. 纯 MAC 兜底

    为什么要这个？
    ------------
    `bluetoothctl devices` 对**没有广播名称**的设备只输出 MAC，界面就会显示
    一串 `AA:BB:CC:DD:EE:FF`，用户反馈「显示没有名称的蓝牙设备」。
    这类设备通常是：刚进入配对模式还没广播名字、BLE 设备、或某些手机的隐私模式。

    给一个「手机 · EE:FF」这样的标签，至少能让人判断该不该连。
    """
    name = (name or "").strip()
    alias = (alias or "").strip()
    mac = (mac or "").strip().upper()

    # 1/2：真实名字优先。注意排除「名字就是 MAC」的情况（含横线写法）
    for cand in (name, alias):
        if cand and not is_mac_like(cand):
            return cand

    # 3：按类型推断
    label = _icon_label(icon) or _class_label(klass)
    tail = mac[-5:] if len(mac) >= 5 else mac
    if label:
        return "%s · %s" % (label, tail)
    if tail:
        # 注意：这里用中性写法，不带语言。前端会按 has_real_name 决定
        # 是否显示成「未知设备」（i18n），避免英文界面出现中文。
        return "? · %s" % tail
    return "?"


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
        # 扫描：后台任务 + 运行标记（非阻塞，可中途停止）
        self._scan_task = None
        self._scan_running = False
        # bluetoothctl 版本缓存（旧版本不支持 `devices Paired`）
        self._bctl_ver = None

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
    async def _bctl_version(self):
        """读取 bluetoothctl 版本，返回 (major, minor)，失败返回 (0, 0)。

        为什么要这个？
        ------------
        `bluetoothctl devices Paired` 是 **5.66** 才加的子命令。
        更早的版本只有 `paired-devices`，直接调 `devices Paired` 会返回空，
        表现就是「以前连接过的设备扫不出来」。

        参考实现：introkun/DeckyLoader-Bluetooth 也做了同样的版本判断。
        """
        if self._bctl_ver is not None:
            return self._bctl_ver
        ver = (0, 0)
        try:
            rc, out = await self._ctl("version", timeout=8.0)
            nums = re.findall(r"\d+", out or "")
            if len(nums) >= 2:
                ver = (int(nums[0]), int(nums[1]))
        except Exception:
            pass
        self._bctl_ver = ver
        return ver

    async def list_devices(self, kind=""):
        """kind: '' | 'Paired' | 'Connected'。返回 [{'mac','name','display'}]。

        `name` 是原始名（可能为空或等于 MAC），`display` 是给界面用的可读名。
        """
        args = ["devices"] + ([kind] if kind else [])
        rc, out = await self._ctl(*args)
        # 旧版 bluetoothctl 不支持 `devices Paired`，退回 `paired-devices`
        if kind == "Paired" and (rc != 0 or not (out or "").strip()):
            major, minor = await self._bctl_version()
            if major < 5 or (major == 5 and minor < 66):
                rc, out = await self._ctl("paired-devices")
        if rc != 0:
            return []
        devs = []
        for line in out.splitlines():
            m = re.match(r"^\s*Device\s+([0-9A-Fa-f:]{17})\s*(.*)$", line)
            if m:
                mac = m.group(1).upper()
                raw = (m.group(2) or "").strip()
                devs.append({
                    "mac": mac,
                    "name": raw,
                    "display": friendly_device_name(raw, "", "", "", mac),
                })
        return devs

    async def info(self, mac):
        mac = normalize_mac(mac)
        if not mac:
            raise BtError("设备地址不合法")

        rc, out = await self._ctl("info", mac)
        if rc != 0:
            raise BtError("读取设备 %s 信息失败" % mac)
        kv = parse_kv(out)
        name = kv.get("Name", "")
        alias = kv.get("Alias", "")
        icon = kv.get("Icon", "")
        klass = kv.get("Class", "")

        # 关键：BlueZ 对没广播名字的设备会自动生成 `AA-BB-CC-DD-EE-FF` 形式的
        # Alias（横线分隔）。必须用 is_mac_like() 识别出来，否则会被当成真实名字，
        # 「显示没有名称的设备」开关就失效了。
        real_name = ""
        for cand in (name, alias):
            c = (cand or "").strip()
            if c and not is_mac_like(c):
                real_name = c
                break

        return {
            "mac": mac.upper(),
            "name": name,
            "alias": alias,
            # display 永远非空：没名字就按类型+MAC 后缀拼一个
            "display": friendly_device_name(name, alias, icon, klass, mac),
            "has_real_name": bool(real_name),
            "icon": icon,
            "class": klass,
            "rssi": _parse_rssi(kv.get("RSSI", "")),
            "paired": yes(kv.get("Paired", "no")),
            "trusted": yes(kv.get("Trusted", "no")),
            "connected": yes(kv.get("Connected", "no")),
            "blocked": yes(kv.get("Blocked", "no")),
            "services_resolved": yes(kv.get("ServicesResolved", "no")),
            # 设备支持的服务（能看出它是不是真能当音频设备）
            "uuids": _parse_uuids(out),
        }

    async def device_action(self, mac, action, value=None):
        """对单个设备执行操作。

        支持的操作：
          connect / disconnect   连接、断开
          pair / remove          配对、删除（含绑定密钥）
          trust / untrust        信任（允许自动重连）/ 取消信任
          block / unblock        拉黑（拒绝连接）/ 解除拉黑
          alias                  设置设备别名（需要 value）
        """
        mac = normalize_mac(mac)
        if not mac:
            raise BtError("设备地址不合法")

        action = (action or "").strip().lower()

        # alias 需要额外参数，单独处理
        if action == "alias":
            new_name = (value or "").strip()
            if not new_name:
                raise BtError("别名不能为空")
            if len(new_name) > 64:
                raise BtError("别名太长（最多 64 个字符）")
            rc, out = await self._ctl("set-alias", mac, new_name, timeout=15.0)
            if rc != 0 or "Failed" in (out or ""):
                tail = (out or "").strip().splitlines()
                raise BtError("设置别名失败：%s" % (tail[-1] if tail else "未知错误"))
            self._show_cache = (0.0, None)
            return True

        mapping = {
            "connect": ["connect", mac],
            "disconnect": ["disconnect", mac],
            "trust": ["trust", mac],
            "untrust": ["untrust", mac],
            "pair": ["pair", mac],
            "remove": ["remove", mac],
            "block": ["block", mac],
            "unblock": ["unblock", mac],
        }
        if action not in mapping:
            raise BtError("不支持的操作：%s" % action)

        rc, out = await self._ctl(*mapping[action], timeout=25.0)
        low = (out or "").lower()
        # 「AlreadyExists」这类算成功；真正的失败才抛
        benign = ("alreadyexists", "already exists", "already paired",
                  "not available" if action in ("disconnect", "untrust", "unblock") else "")
        failed = ("failed" in low) or (rc != 0 and not any(b and b in low for b in benign))
        if failed and not any(b and b in low for b in benign):
            tail = (out or "").strip().splitlines()
            raise BtError("%s 失败：%s" % (action, tail[-1] if tail else "未知错误"))
        self._show_cache = (0.0, None)
        return True

    async def disconnect_all(self):
        """断开所有已连接的设备。"""
        try:
            connected = await self.list_devices("Connected")
        except BtError:
            connected = []
        done, failed = [], []
        for d in connected:
            try:
                await self.device_action(d["mac"], "disconnect")
                done.append(d["mac"])
            except BtError:
                failed.append(d["mac"])
        self._show_cache = (0.0, None)
        return {"disconnected": done, "failed": failed}

    # -- 扫描 -------------------------------------------------------------
    async def start_discovery(self, timeout=30):
        """开始扫描附近设备（**非阻塞**）。

        早期实现用 `bluetoothctl --timeout N scan on`，它会把调用方卡住 N 秒，
        界面上只能干等、看不到任何中间结果。

        现在改为后台任务：
        - 立刻返回，调用方可以立刻去轮询 `list_discovered()`
        - 扫描在后台持续，直到超时或被 `stop_discovery()` 打断
        """
        if self._scan_task is not None and not self._scan_task.done():
            return True

        async def _run():
            try:
                await self._ctl("--timeout", str(int(timeout)), "scan", "on",
                                timeout=float(timeout) + 5.0)
            except BtError:
                pass
            finally:
                self._scan_running = False
                self._log("扫描结束（%d 秒）" % timeout)

        self._scan_running = True
        self._scan_task = asyncio.create_task(_run())
        self._log("开始扫描（%d 秒）" % timeout)
        return True

    async def stop_discovery(self):
        """停止扫描（可中途打断）。"""
        self._scan_running = False
        task = self._scan_task
        self._scan_task = None
        if task is not None and not task.done():
            try:
                task.cancel()
            except Exception:
                pass
        try:
            await self._ctl("scan", "off", timeout=8.0)
        except BtError:
            pass
        self._show_cache = (0.0, None)
        return True

    def scanning(self):
        return bool(self._scan_running)

    async def list_discovered(self, include_paired=True, include_unreachable=True):
        """列出扫描到的设备。

        返回 [{'mac','name','display','paired','connected','icon','rssi','type'}]。

        ⚠️ `include_paired` 默认 **True** —— 之前默认 False 把所有已配对设备
        都过滤掉了，用户反馈「以前连接过的设备扫不出来」。
        已配对设备也会显示，前端用 `paired` 标记区分（可以点「连接」而非「配对」）。
        """
        rc, out = await self._ctl("devices", timeout=10.0)
        if rc != 0:
            return []
        devs = []
        for line in out.splitlines():
            m = re.match(r"^\s*Device\s+([0-9A-Fa-f:]{17})\s*(.*)$", line)
            if not m:
                continue
            mac = m.group(1).upper()
            raw = (m.group(2) or "").strip()
            item = {
                "mac": mac,
                "name": raw,
                "display": friendly_device_name(raw, "", "", "", mac),
                "has_real_name": bool(raw and not is_mac_like(raw)),
                "paired": False, "connected": False,
                "icon": "", "class": "", "rssi": None,
            }
            # 逐个补详情（数量一般不多，可以接受）
            try:
                info = await self.info(mac)
                item.update({
                    "name": info.get("name") or raw,
                    "display": info.get("display") or item["display"],
                    "has_real_name": info.get("has_real_name", item["has_real_name"]),
                    "paired": info.get("paired", False),
                    "connected": info.get("connected", False),
                    "icon": info.get("icon", ""),
                    "class": info.get("class", ""),
                    "rssi": info.get("rssi"),
                })
            except BtError:
                pass
            if not include_paired and item["paired"]:
                continue
            # 完全没信号又没名字的，多半是扫描残留的幽灵条目，默认过滤
            if not include_unreachable and item["rssi"] is None and not item["has_real_name"]:
                continue
            devs.append(item)
        # 排序：已连接 > 已配对 > 有名字 > 信号强
        devs.sort(key=lambda d: (
            not d["connected"],
            not d["paired"],
            not d["has_real_name"],
            -(d["rssi"] if isinstance(d["rssi"], int) else -999),
            d["display"].lower(),
        ))
        return devs

    async def pair_and_trust(self, mac):
        """配对 + 信任（信任后设备可以自动重连）。"""
        mac = normalize_mac(mac)
        if not mac:
            raise BtError("设备地址不合法")

        # 确保 agent 就绪，否则配对请求无人应答
        if not self.agent_registered():
            try:
                await self.start_agent()
            except BtError as e:
                self._log("配对前启动 agent 失败：%s" % e)

        try:
            await self.device_action(mac, "pair")
        except BtError as e:
            msg = str(e).lower()
            # 「AlreadyExists」说明本来就配过，不算失败
            if "alreadyexists" in msg or "already exists" in msg:
                self._log("设备已配对：%s" % mac)
            else:
                raise BtError(
                    "配对失败：%s\n"
                    "如果提示配对码/通行密钥不正确，请点「修复配对」，"
                    "或在手机端先「忘记」这个设备再重试。" % e
                )

        try:
            await self.device_action(mac, "trust")
        except BtError:
            pass

        # 配对后尝试连接
        try:
            await self.device_action(mac, "connect")
        except BtError as e:
            self._log("配对成功但连接失败（可稍后手动连）：%s" % e)

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
        mac = normalize_mac(mac)
        if not mac:
            raise BtError("设备地址不合法")

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
        mac = normalize_mac(mac)
        if not mac:
            raise BtError("设备地址不合法")

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
            _env = dict(os.environ)
            _env.update(_user_session_env())
            proc = await asyncio.create_subprocess_exec(
                exe, "--agent=NoInputNoOutput",
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.STDOUT,
                env=_env,
            )
            # 给进程一点时间，如果立刻退出说明参数不被支持
            await asyncio.sleep(0.35)
            if proc.returncode is None:
                return proc
            self._log("--agent 参数不被支持（进程立即退出），退回 stdin 方式")
        except Exception as e:  # noqa: BLE001
            self._log("--agent 启动失败：%s，退回 stdin 方式" % e)

        # 方式 2：stdin 发命令
        _env = dict(os.environ)
        _env.update(_user_session_env())
        proc = await asyncio.create_subprocess_exec(
            exe,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
            env=_env,
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

    async def stop_agent(self, quick=False):
        """停止配对 agent。

        `quick=True` 用于插件卸载场景：**不做任何等待**，直接 kill。
        为什么？卸载时 Decky 会等 `_unload` 返回，而这里原本有
        `await asyncio.wait_for(proc.wait(), 3.0)` —— 最坏等 3 秒，
        用户感受就是「卸载好慢」。
        子进程被 kill 后由系统回收，不需要我们等它退出。
        """
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

        if quick:
            # 快速路径：直接 kill，不等
            try:
                proc.kill()
            except Exception:
                pass
            self._log("配对 agent 已强制结束（快速卸载）")
            return

        # 正常路径：礼貌地请它退出，最多等 1.5 秒
        try:
            if proc.stdin and not proc.stdin.is_closing():
                proc.stdin.write(b"quit\n")
                await proc.stdin.drain()
                proc.stdin.close()
        except Exception:
            pass
        try:
            await asyncio.wait_for(proc.wait(), 1.5)
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
        """返回 {'volume': 0..MAX_GAIN, 'muted': bool, 'ok': bool, 'raw': str}。

        ⚠️ 读不到时**不能静默返回 0** —— 那会让界面显示 0%，
        用户以为音量真是 0，实际是命令失败了（真机反馈过这个问题）。
        所以这里带 `ok` 标记，让调用方能区分「音量真的是 0」和「读失败」。
        """
        rc, out = await run_cmd(["wpctl", "get-volume", "@DEFAULT_AUDIO_SINK@"], timeout=5.0)
        text = (out or "").strip()
        if rc != 0 or not text:
            return {
                "volume": 0.0,
                "muted": False,
                "ok": False,
                "raw": text or "（无输出）",
                "error": "读取音量失败：%s" % (text.splitlines()[0] if text else "wpctl 无输出"),
            }
        m = re.search(r"Volume:\s*([0-9.]+)", text)
        if not m:
            return {
                "volume": 0.0,
                "muted": False,
                "ok": False,
                "raw": text,
                "error": "无法解析 wpctl 输出：%s" % text[:120],
            }
        vol = float(m.group(1))
        return {
            "volume": max(0.0, min(MAX_GAIN, vol)),
            "muted": "MUTED" in text.upper(),
            "ok": True,
            "raw": text,
        }

    async def set_volume(self, value):
        value = max(0.0, min(MAX_GAIN, float(value)))
        rc, out = await run_cmd(["wpctl", "set-volume", "@DEFAULT_AUDIO_SINK@", "%.2f" % value], timeout=5.0)
        if rc != 0:
            raise BtError("设置音量失败：%s" % (out or "").strip())
        return True

    async def step_volume(self, delta):
        """相对调节音量（+/-），不需要先读取当前值。

        为什么用这个而不是 set_volume？
        ------------------------------
        真机上 `wpctl get-volume` 读取一直不可靠（显示 0%），
        但 `wpctl set-volume N%+` 这种**相对语法由 wpctl 内部完成加减**，
        完全不需要我们先读到当前值。所以它永远有效，不会有同步问题。

        wpctl 的相对语法：
          wpctl set-volume @DEFAULT_AUDIO_SINK@ 10%+   # 加 10%
          wpctl set-volume @DEFAULT_AUDIO_SINK@ 5%-    # 减 5%
        """
        try:
            d = int(delta)
        except (TypeError, ValueError):
            raise BtError("音量增量不合法：%s" % delta)
        if d == 0:
            return True
        sign = "+" if d > 0 else "-"
        arg = "%d%%%s" % (abs(d), sign)
        # 用 -l 限制上限，避免一路加爆导致削波
        rc, out = await run_cmd(
            ["wpctl", "set-volume", "-l", "%.2f" % MAX_GAIN, "@DEFAULT_AUDIO_SINK@", arg],
            timeout=5.0,
        )
        if rc != 0:
            # 某些版本不支持 -l，退回不带限制
            rc2, out2 = await run_cmd(
                ["wpctl", "set-volume", "@DEFAULT_AUDIO_SINK@", arg], timeout=5.0
            )
            if rc2 != 0:
                raise BtError("调节音量失败：%s" % ((out2 or out or "").strip().splitlines() or ["未知错误"])[-1])
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

    async def step_volume_of(self, node_id, delta):
        """给指定节点相对调节音量（不读取当前值）。

        用 wpctl 的相对语法，加减由 wpctl 内部完成，
        因此不受「读不到当前值」影响。
        """
        try:
            d = int(delta)
        except (TypeError, ValueError):
            raise BtError("音量增量不合法：%s" % delta)
        if d == 0:
            return True
        sign = "+" if d > 0 else "-"
        arg = "%d%%%s" % (abs(d), sign)
        rc, out = await run_cmd(
            ["wpctl", "set-volume", "-l", "%.2f" % MAX_GAIN, str(int(node_id)), arg],
            timeout=5.0,
        )
        if rc != 0:
            rc2, out2 = await run_cmd(
                ["wpctl", "set-volume", str(int(node_id)), arg], timeout=5.0
            )
            if rc2 != 0:
                raise BtError(
                    "调节节点 %s 音量失败：%s"
                    % (node_id, ((out2 or out or "").strip().splitlines() or ["未知错误"])[-1])
                )
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
  # ⚠️ hw-volume 只保留 a2dp_source（Deck 连耳机时用蓝牙硬件音量）。
  #
  # 为什么把 a2dp_sink 从 hw-volume 里去掉？
  # ------------------------------------
  # 启用 a2dp_sink 的 hw-volume 后，音量控制权会通过 AVRCP 绝对音量
  # 交给**对端设备**。不同对端实现差异极大：
  #   - 手机：多数不实现或实现不完整 -> Deck 自己控制音量，正常
  #   - Windows：完整实现 -> 电脑的音量滑块直接决定 Deck 的音量，
  #     Deck 上怎么调都没用（真机反馈「电脑声音小、手机没问题」）
  #
  # 去掉之后，接收方向的音量完全由 PipeWire 软件音量控制，
  # 不再受对端音量滑块牵制。
  bluez5.hw-volume = [ a2dp_source ]
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
