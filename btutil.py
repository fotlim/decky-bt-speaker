"""蓝牙/音频模块的通用工具：MAC 归一化、命令执行、设备名推断。

为什么单独拆出来？
----------------
`bt.py` 原本 1500 行，里面混了三类东西：
  1. 通用工具（MAC 校验、命令执行、设备名推断、对端类型识别）
  2. BlueZ 封装（适配器 / 设备 / 配对 / 扫描）
  3. PipeWire 封装（音量 / 配置写入）

拆成 btutil.py / bt.py / wp.py 之后：
  - 工具函数可以单独测试，不需要 mock 蓝牙环境
  - BlueZ 和 PipeWire 互不依赖，改一个不会碰另一个
  - 每个文件 400~600 行，读起来有边界

兼容性：`bt.py` 会 re-export 这里的公开名字，所以
`bt.normalize_mac(...)` / `bt.friendly_device_name(...)` 这些老写法仍然可用。
"""

import os
import re
import shutil
import asyncio

# ---------------------------------------------------------------------------
# 常量
# ---------------------------------------------------------------------------

# A2DP Sink 的 UUID 短码（判断适配器能不能当音箱）
A2DP_SINK_UUID = "0000110b"
# A2DP Source 的 UUID 短码（Deck 往外推流）
A2DP_SOURCE_UUID = "0000110a"
# HFP AG / HF —— 用来判断设备是否支持通话（会抢 A2DP）
HFP_AG_UUID = "0000111f"
HFP_HF_UUID = "0000111e"

# 音量增益上限。超过 1.0 是软件放大，会有削波风险，
# 但 EQ 链末尾的 clamp 限幅器会挡住刺耳爆音（代价是动态压缩）。
SAFE_GAIN = 1.5
MAX_GAIN = 2.5
# 低于这个值认为「声音偏轻」
LOW_VOLUME_THRESHOLD = 0.75

_ANSI_RE = re.compile(r"\x1b\[[0-9;?]*[A-Za-z]")
_MAC_RE = re.compile(r"^([0-9A-F]{2}:){5}[0-9A-F]{2}$", re.I)

# Decky 后端起子进程时不一定继承完整的 PATH（loader v3.2.6 才修），
# 所以优先用绝对路径探测，避免「命令明明装着却报找不到」。
_BIN_DIRS = ("/usr/bin", "/usr/local/bin", "/bin", "/usr/sbin", "/run/current-system/sw/bin")


class BtError(Exception):
    """可读的蓝牙/音频错误。"""


def strip_ansi(s):
    return _ANSI_RE.sub("", s or "")


def which(name):
    if os.path.isabs(name):
        return name if os.path.exists(name) else None
    for d in _BIN_DIRS:
        p = os.path.join(d, name)
        if os.path.exists(p) and os.access(p, os.X_OK):
            return p
    return shutil.which(name)


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

    ⚠️ 默认注入用户会话环境变量（见 _user_session_env 的说明）。
    """
    exe = which(argv[0])
    if not exe:
        raise BtError("command not found: %s" % argv[0])

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
    except Exception as e:  # noqa: BLE001
        raise BtError("failed to start %s: %s" % (argv[0], e))
    try:
        out, _ = await asyncio.wait_for(proc.communicate(), timeout)
    except asyncio.TimeoutError:
        try:
            proc.kill()
        except Exception:
            pass
        raise BtError("%s timed out (%.0fs)" % (argv[0], timeout))
    return proc.returncode, strip_ansi(out.decode("utf-8", "replace"))


# ---------------------------------------------------------------------------
# MAC 地址
# ---------------------------------------------------------------------------

def normalize_mac(s):
    """把各种写法的 MAC 归一化成 `AA:BB:CC:DD:EE:FF`（大写冒号）。

    BlueZ 在不同场合给出的格式并不统一：
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
    """判断字符串是不是「MAC 地址的各种写法」（用于识别无名设备的 Alias）。

    BlueZ 对**没有广播名称**的设备会自动生成 `Alias`，格式是
    `AA-BB-CC-DD-EE-FF`（横线分隔），而 `Name`/`Address` 用冒号。
    早期只用 `is_mac()`（只认冒号）判断，导致横线写法被当成真实名字，
    `has_real_name` 错判为 True —— 「显示没有名称的设备」开关就失效了。

    实现直接复用 normalize_mac()，保证两处逻辑一致。
    """
    return bool(normalize_mac(s))


def yes(s):
    """BlueZ 的 yes/no 字符串转 bool。"""
    return str(s or "").strip().lower() in ("yes", "true", "1", "on")


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
# 设备名与类型推断
# ---------------------------------------------------------------------------

def _class_label(klass):
    """从 Class of Device 推断友好类型名。"""
    try:
        v = int(str(klass).strip(), 16)
    except (ValueError, TypeError):
        return ""
    major = (v >> 8) & 0x1F
    minor = (v >> 2) & 0x3F

    if major == 0x01:
        return "电脑"
    if major == 0x02:
        if minor & 0x08:
            return "平板"
        return "手机"
    if major == 0x04:
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
    if -120 <= v <= 20:
        return v
    return None


def _parse_uuids(info_text):
    """从 `bluetoothctl info` 输出里提取设备支持的 UUID 短码列表。

    形如 `UUID: Audio Sink                (0000110b-0000-1000-8000-00805f9b34fb)`
    返回 ['0000110b', ...]
    """
    if not info_text:
        return []
    out = []
    for m in re.finditer(r"\(([0-9a-fA-F]{8})-0000-1000-8000-00805f9b34fb\)", info_text):
        short = m.group(1).lower()
        if short not in out:
            out.append(short)
    return out


# ---------------------------------------------------------------------------
# 共享命令输出缓存
# ---------------------------------------------------------------------------
#
# 为什么要做这个？
# --------------
# `pactl list cards` 的输出在**同一次** `status()` 里被两个模块各读了一遍：
#   - `focus.get_active_profile()`  —— 为了知道当前是 SBC 还是 AAC
#   - `a2dp.read_cards()`           —— 为了判断 A2DP Sink 就绪没
# 两条命令一模一样，纯属白烧一个进程。播歌时每 4 秒一次轮询，
# 就是每 4 秒多 fork 一次。
#
# 这里给「只读、幂等、结果几乎不变」的命令加一个极短 TTL 的共享缓存。
# TTL 故意设得很小（默认 1.5 秒）：只够覆盖同一次 RPC 内的重复调用，
# 不会让用户看到明显过期的数据。
#
# ⚠️ 只缓存**读**命令。任何写操作（set-card-profile 等）都不能走这里。

_CMD_CACHE = {}
# 缓存条目上限，防止 key 无限增长（key 里可能含 MAC，设备多了会涨）
_CMD_CACHE_MAX = 32


def cache_get(key, ttl):
    """取命令输出缓存；未命中或过期返回 None。"""
    hit = _CMD_CACHE.get(key)
    if hit is None:
        return None
    ts, val = hit
    import time as _t
    if (_t.monotonic() - ts) >= ttl:
        return None
    return val


def cache_put(key, val):
    """写命令输出缓存。超过上限时丢掉最早的一半（简单 LRU 近似）。"""
    import time as _t
    if len(_CMD_CACHE) >= _CMD_CACHE_MAX:
        for k in list(_CMD_CACHE.keys())[: _CMD_CACHE_MAX // 2]:
            _CMD_CACHE.pop(k, None)
    _CMD_CACHE[key] = (_t.monotonic(), val)


def cache_clear():
    """清空命令缓存（测试 / 写操作后主动失效用）。"""
    _CMD_CACHE.clear()


async def run_cached(argv, ttl=1.5, timeout=8.0):
    """执行只读命令，`ttl` 秒内重复调用直接返回上次结果。

    返回 (returncode, 输出)。命令找不到时抛 BtError（与 run_cmd 一致）。
    """
    key = "\x00".join(argv)
    hit = cache_get(key, ttl)
    if hit is not None:
        return hit
    rc, out = await run_cmd(argv, timeout=timeout)
    if rc == 0:
        cache_put(key, (rc, out))
    return rc, out


def friendly_device_name(name, alias, icon, klass, mac):
    """给设备拼一个可读名称。

    优先级：
      1. Name（设备自己广播的名字）
      2. Alias（BlueZ 侧别名，用户可能改过）
      3. 按 Icon / Class 推断的类型 + MAC 后四位，例如「手机 · EE:FF」
      4. 中性的 `? · EE:FF` 兜底（不含语言，前端会本地化成「未知设备」）

    为什么兜底不用中文？
    ------------------
    早期直接返回「未知设备 · XX:XX」，导致英文界面下也显示中文。
    现在返回中性写法，由前端 `devLabel()` 按当前语言翻译。
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
        return "? · %s" % tail
    return "?"


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
