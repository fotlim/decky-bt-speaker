"""
AVRCP 元数据：读取手机正在播放的曲目信息。

为什么有用
----------
手机连上 Deck 放歌后，Deck 屏幕是黑的，QAM 里只知道「有个外部音源」。
但 AVRCP 协议其实一直在传曲名 / 歌手 / 专辑 / 时长 —— 这些信息 BlueZ
已经解析好放在 D-Bus 上了，只是没人读出来。

读完就能：QAM 显示「正在播放：歌名 - 歌手」，Deck 屏幕不再黑着。

接口（BlueZ 官方 media-api）
--------------------------
Service:   org.bluez
Interface: org.bluez.MediaPlayer1
Object:    /org/bluez/hci0/dev_XX_XX_XX_XX_XX_XX/player#

属性：
- `Track`    dict  曲目元数据（Title / Artist / Album / Genre / Duration / TrackNumber...）
- `Position` uint32 播放位置（毫秒）
- `Status`   string playing / paused / stopped / forward-seek / reverse-seek / error
- `Device`   object 所属设备路径

读取方式：`busctl get-property org.bluez <path> org.bluez.MediaPlayer1 Track`

⚠️ 注意
-------
- 不是所有手机都实现 AVRCP 元数据（尤其部分 Android 的自带播放器）。
  读不到时静默降级，不要报错 —— 这不是错误，只是对方没提供。
- `Track` 是 `a{sv}` 类型，busctl 输出形如：
      a{sv} 3 "Title" s "Song Name" "Artist" s "Someone" "Duration" u 210000
  要写个小解析器。
"""

import re
import time

from bt import BtError, is_mac, run_cmd, strip_ansi, which

# `busctl tree org.bluez` 的结果缓存。
#
# 为什么要缓存：`status()` 播歌时每 4 秒跑一次，每次都列一遍整棵对象树。
# 但 player 路径只会在「设备连接/断开」时变化，播放过程中是稳定的。
# 缓存 8 秒足以覆盖一次轮询周期，又能在设备变化后及时跟上。
#
# 用模块级变量而不是实例属性：`Metadata` 在 Plugin 里是单例，
# 但模块级更简单，且测试里可以直接 reset。
_TREE_TTL = 8.0
_tree_cache = (0.0, [])   # (时间戳, 路径列表)


def reset_cache():
    """清空模块级缓存（测试用）。"""
    global _tree_cache
    _tree_cache = (0.0, [])

# 播放状态的友好文案
STATUS_LABELS = {
    "playing": "播放中",
    "paused": "已暂停",
    "stopped": "已停止",
    "forward-seek": "快进中",
    "reverse-seek": "快退中",
    "error": "错误",
}


def player_path(mac, adapter="hci0", index=0):
    """构造 MediaPlayer1 的对象路径。

    ⚠️ `index` 默认 0 只是「常见情况」。BlueZ 的 player 编号取决于注册顺序，
    可能是 player1 / player2。实际使用时应该用 `discover_players()` 列出
    真实存在的路径，而不是靠猜。
    """
    if not is_mac(mac):
        return ""
    return "/org/bluez/%s/dev_%s/player%d" % (
        adapter, mac.upper().replace(":", "_"), index)


def parse_player_paths(tree_text):
    """从 `busctl tree org.bluez` 的输出里提取所有 MediaPlayer 相关路径。

    busctl tree 输出形如：
        └─/org/bluez/hci0/dev_CC_42_10_8A_70_42
          └─/org/bluez/hci0/dev_CC_42_10_8A_70_42/player0

    返回 [路径字符串...]（只保留以 /player 结尾的）。
    """
    if not tree_text:
        return []
    out = []
    for line in tree_text.splitlines():
        # 去掉树形前缀
        s = re.sub(r"^[\s\u2502\u251c\u2514\u2500]*", "", line).strip()
        if not s.startswith("/org/bluez/"):
            continue
        if re.search(r"/player\d+$", s) and s not in out:
            out.append(s)
    return out


def mac_from_path(path):
    """从 `/org/bluez/hci0/dev_CC_42_10_8A_70_42/player0` 里取出 MAC。"""
    m = re.search(r"dev_([0-9A-Fa-f]{2}(?:_[0-9A-Fa-f]{2}){5})", path or "")
    if not m:
        return ""
    return m.group(1).replace("_", ":").upper()


def decode_octal_escapes(text):
    """把 busctl 输出里的八进制转义还原成 UTF-8 文本。

    busctl 在非 UTF-8 locale 下会把非 ASCII 字节输出成 `\\NNN` 八进制，
    例如「纯音」的 UTF-8 是 E7 BA AF E9 9F B3，busctl 给成：
        \\347\\272\\257\\351\\237\\263

    直接显示就是这串反斜杠数字（真机截图里就是这个）。

    实现：先把所有 \\NNN 收集成字节，再整体按 UTF-8 解码。
    注意不能逐个字节转 chr() —— 那会把多字节序列拆坏。
    """
    if not text or "\\" not in text:
        return text

    out = []
    i = 0
    n = len(text)
    while i < n:
        ch = text[i]
        if ch == "\\" and i + 3 < n and text[i + 1:i + 4].isdigit():
            # 收集连续的八进制转义
            raw = bytearray()
            while (i + 3 < n and text[i] == "\\"
                   and text[i + 1:i + 4].isdigit()):
                try:
                    raw.append(int(text[i + 1:i + 4], 8) & 0xFF)
                except ValueError:
                    break
                i += 4
            try:
                out.append(raw.decode("utf-8", "replace"))
            except Exception:  # noqa: BLE001
                out.append(raw.decode("latin-1"))
            continue
        out.append(ch)
        i += 1
    return "".join(out)


def parse_busctl_string(text):
    """解析 `busctl get-property` 返回的**单个字符串**属性。

    busctl 输出形如：
        s "playing"
        s "纯音"

    早期代码只做 `strip('"')`，结果得到 `s "playing` ——
    类型前缀 `s ` 和开头引号都留着（真机截图里状态徽章显示的就是这个）。

    这里统一：去掉开头的类型签名（s/o 等）+ 外层引号，并解码八进制转义。
    """
    if not text:
        return ""
    t = strip_ansi(text).strip()
    # 去掉开头的类型签名，如 `s "..."` / `o "/path"` / `u 123`
    t = re.sub(r'^[a-z]\s+', '', t, count=1)
    # 去掉外层引号
    if len(t) >= 2 and t[0] == '"' and t[-1] == '"':
        t = t[1:-1]
    elif t.startswith('"'):
        t = t[1:]
    return decode_octal_escapes(t)


def parse_busctl_uint(text):
    """解析 `busctl get-property` 返回的无符号整数（如 Position / Duration）。"""
    if not text:
        return 0
    m = re.search(r"\d+", strip_ansi(text))
    return int(m.group(0)) if m else 0


def parse_busctl_dict(text):
    """解析 busctl 输出的 `a{sv}` 字典。

    输入形如：
        a{sv} 3 "Title" s "Song" "Artist" s "Someone" "Duration" u 210000
    返回：
        {'Title': 'Song', 'Artist': 'Someone', 'Duration': '210000'}
    """
    if not text:
        return {}
    # 去掉开头的 "a{sv} N "
    body = re.sub(r"^\s*a\{sv\}\s+\d+\s*", "", text.strip())
    # 用正则抓 "key" type value 三元组
    # 支持 s(字符串带引号) / u,i,x,t,q(数字) / b(布尔) / o(对象路径)
    pattern = re.compile(
        r'"([^"]+)"\s+([subxxtqod])\s+'
        r'(?:"([^"]*)"|(\S+))'
    )
    out = {}
    for m in pattern.finditer(body):
        key = m.group(1)
        val = m.group(3) if m.group(3) is not None else m.group(4)
        if key and val is not None:
            out[key] = val
    return out


def parse_track(text):
    """把 busctl 的 Track 属性解析成前端友好的结构。"""
    raw = parse_busctl_dict(text)
    if not raw:
        return None

    def _int(key, default=0):
        try:
            return int(str(raw.get(key, default)).strip())
        except (ValueError, TypeError):
            return default

    duration_ms = _int("Duration", 0)

    # ⚠️ 字符串值必须解码八进制转义 —— busctl 会把中文输出成 \347\272\257 这种。
    # 不解码的话，前端显示的是一串反斜杠数字（真机截图里就是这样）。
    def _str(key):
        return decode_octal_escapes(str(raw.get(key, "") or ""))

    return {
        "title": _str("Title"),
        "artist": _str("Artist"),
        "album": _str("Album"),
        "genre": _str("Genre"),
        "track_number": _int("TrackNumber", 0),
        "total_tracks": _int("NumberOfTracks", 0),
        "duration_ms": duration_ms,
        "duration": _fmt_ms(duration_ms),
    }


def _fmt_ms(ms):
    total = max(0, int(ms or 0)) // 1000
    return "%d:%02d" % (total // 60, total % 60)


def status_label(status):
    return STATUS_LABELS.get((status or "").strip().lower(), status or "")


class Metadata:
    """读取蓝牙设备的 AVRCP 元数据。"""

    def __init__(self, log=None, adapter="hci0"):
        self._log = log or (lambda *_: None)
        self.adapter = adapter

    @staticmethod
    def available():
        return which("busctl") is not None

    async def _get(self, path, prop):
        rc, out = await run_cmd(
            ["busctl", "get-property", "org.bluez", path, "org.bluez.MediaPlayer1", prop],
            timeout=6.0,
        )
        if rc != 0:
            return None
        return strip_ansi(out).strip()

    async def _get_many(self, path, props):
        """一次 `busctl get-property` 读多个属性，返回 {属性名: 原始输出}。

        为什么要合并？
        ------------
        `Track` / `Status` / `Position` 原本是**三条**独立的 busctl 调用
        （fork 三个进程）。而 `busctl get-property` 原生支持一次读多个属性，
        输出按顺序**每行一个**（见 man busctl：Multiple properties may be
        specified at once, in which case their values will be shown one
        after the other, separated by newlines）。

        播歌时 `status()` 每 4 秒跑一次，合并后这里从 3 个进程降到 1 个。

        ⚠️ 解析必须**按行**对应，不能按「连续几行」猜 —— `Track` 是 `a{sv}`，
        普通 terse 模式下也是单行，所以每个属性正好一行。
        万一某个属性值本身含换行（理论上 terse 模式不会），行数就对不上，
        此时按「行数不匹配」整体放弃，退回逐个读，保证不会解析错位。
        """
        if not props:
            return {}
        argv = ["busctl", "get-property", "org.bluez", path,
                "org.bluez.MediaPlayer1"] + list(props)
        rc, out = await run_cmd(argv, timeout=8.0)
        if rc != 0:
            return {}
        lines = [ln for ln in strip_ansi(out).splitlines() if ln.strip()]
        if len(lines) != len(props):
            # 行数对不上：宁可多 fork 几次，也不能把 Status 当成 Position
            self._log("busctl 多属性输出行数不匹配（%d 行 / %d 属性），退回逐个读取"
                      % (len(lines), len(props)))
            return {}
        return dict(zip(props, [ln.strip() for ln in lines]))

    async def _list_players(self):
        """列出系统里真实存在的 MediaPlayer1 对象路径。

        为什么要动态列而不是拼路径？
        --------------------------
        两个坑（都踩过）：
        1. 适配器名不一定是 hci0（多适配器 / 改名）
        2. player 编号不一定是 player0（取决于注册顺序，可能是 1、2…）

        早期直接拼 `/org/bluez/hci0/dev_XX/player0`，对不上就永远读不到
        元数据，表现为「对端设备未提供曲目信息」—— 而实际上对端提供了。

        性能：结果缓存 `_TREE_TTL` 秒。player 路径只在设备连/断时变，
        播放过程中稳定；而 `status()` 播歌时每 4 秒调一次这里，
        不缓存就是每 4 秒白 fork 一个 `busctl tree`。
        """
        global _tree_cache
        now = time.monotonic()
        ts, cached = _tree_cache
        if cached and (now - ts) < _TREE_TTL:
            return cached
        if not which("busctl"):
            return []
        try:
            rc, out = await run_cmd(["busctl", "tree", "org.bluez"], timeout=8.0)
        except BtError:
            return []
        if rc != 0:
            return []
        paths = parse_player_paths(strip_ansi(out))
        _tree_cache = (now, paths)
        return paths

    async def read(self, mac):
        """读取某设备的曲目信息。

        返回 dict 或 None（对方没提供 AVRCP 元数据时返回 None，不是错误）。
        """
        if not is_mac(mac):
            return None

        # 1. 先动态列出所有 player 路径，按 MAC 匹配
        want = mac.upper()
        paths = [p for p in await self._list_players()
                 if mac_from_path(p) == want]

        # 2. 列不到就退回「拼路径」的老办法（兼容 busctl tree 不可用的环境），
        #    但把 player 0~3 都试一遍，而不是只试 0
        if not paths:
            paths = [player_path(mac, self.adapter, i) for i in range(4)]

        # 3. 逐个试，第一个能读到 Track 的就算。
        #    找到后顺手把 Status / Position 一起读掉（一次 busctl 读三个属性），
        #    避免「找到路径」和「读其余属性」之间再多两次 fork。
        props = None
        path = ""
        for cand in paths:
            got = await self._get_many(cand, ("Track", "Status", "Position"))
            if got.get("Track"):
                props, path = got, cand
                break

        if props is None:
            # 多属性合并失败（行数不匹配 / 老版本 busctl），退回逐个读
            for cand in paths:
                track_raw = await self._get(cand, "Track")
                if track_raw is not None:
                    props = {"Track": track_raw}
                    path = cand
                    break

        if props is None:
            # 所有路径都读不到 = 该设备不支持 AVRCP 或还没开始播放
            self._log("未找到 %s 的 MediaPlayer 对象（对端可能不支持 AVRCP 元数据）" % mac)
            return None

        track_raw = props.get("Track")
        track = parse_track(track_raw)
        if track is None:
            return None

        # Status / Position 若在合并读取里没拿到，再单独补读
        status_raw = props.get("Status")
        pos_raw = props.get("Position")
        if status_raw is None:
            status_raw = await self._get(path, "Status")
        if pos_raw is None:
            pos_raw = await self._get(path, "Position")

        # ⚠️ 必须用 parse_busctl_string 而不是 strip('"') ——
        # busctl 返回的是 `s "playing"`，只 strip 引号会留下类型前缀 `s `，
        # 前端徽章就会显示成 `s "playing`（真机截图里就是这个）。
        position_ms = parse_busctl_uint(pos_raw)
        status = parse_busctl_string(status_raw)
        track.update({
            "status": status,
            "status_label": status_label(status),
            "position_ms": position_ms,
            "position": _fmt_ms(position_ms),
            "mac": mac.upper(),
        })
        return track

    async def read_first(self, macs):
        """按顺序尝试多个设备，返回第一个有元数据的。"""
        for mac in macs or []:
            try:
                info = await self.read(mac)
                if info and (info.get("title") or info.get("artist")):
                    return info
            except BtError:
                continue
        return None
