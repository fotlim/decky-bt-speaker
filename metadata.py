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

from bt import BtError, is_mac, run_cmd, strip_ansi, which

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
    return {
        "title": raw.get("Title", ""),
        "artist": raw.get("Artist", ""),
        "album": raw.get("Album", ""),
        "genre": raw.get("Genre", ""),
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

    async def _list_players(self):
        """列出系统里真实存在的 MediaPlayer1 对象路径。

        为什么要动态列而不是拼路径？
        --------------------------
        两个坑（都踩过）：
        1. 适配器名不一定是 hci0（多适配器 / 改名）
        2. player 编号不一定是 player0（取决于注册顺序，可能是 1、2…）

        早期直接拼 `/org/bluez/hci0/dev_XX/player0`，对不上就永远读不到
        元数据，表现为「对端设备未提供曲目信息」—— 而实际上对端提供了。
        """
        if not which("busctl"):
            return []
        try:
            rc, out = await run_cmd(["busctl", "tree", "org.bluez"], timeout=8.0)
        except BtError:
            return []
        if rc != 0:
            return []
        return parse_player_paths(strip_ansi(out))

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

        # 3. 逐个试，第一个能读到 Track 的就算
        for path in paths:
            track_raw = await self._get(path, "Track")
            if track_raw is not None:
                break
        else:
            # 所有路径都读不到 = 该设备不支持 AVRCP 或还没开始播放
            self._log("未找到 %s 的 MediaPlayer 对象（对端可能不支持 AVRCP 元数据）" % mac)
            return None

        track = parse_track(track_raw)
        if track is None:
            return None

        status_raw = await self._get(path, "Status")
        pos_raw = await self._get(path, "Position")

        position_ms = 0
        if pos_raw:
            m = re.search(r"\d+", pos_raw)
            if m:
                position_ms = int(m.group(0))

        status = (status_raw or "").strip().strip('"')
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
