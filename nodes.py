"""
PipeWire 节点图解析：找出「谁在往 Deck 里放歌」并单独控制它的音量。

为什么需要这个模块
------------------
v1.0.0 只能调 `@DEFAULT_AUDIO_SINK@`（总音量）。但手机通过 A2DP 推流进来时，
PipeWire 里会出现一个独立的 `bluez_input.<MAC>` 节点 —— 它是一个 **source**
（外部设备作为捕获源），WirePlumber 再把它接到本机 sink 播放。

问题在于：手机推流常常偏响或偏轻，而总音量一调就影响游戏声音。
所以要能**单独**给这个外部源调音量，就需要：
1. 从 `wpctl status` 里认出哪个节点是蓝牙输入
2. 拿到它的数字 id
3. 用 `wpctl set-volume <id>` 单独调

wpctl status 的结构（节选）
--------------------------
    PipeWire 'pipewire-0' [1.6.8, deck@steamdeck, cookie:123]
     ├─ Clients:
     │      31. WirePlumber
     │
     ├─ Devices:
     │      44. Built-in Audio
     │
     ├─ Sinks:
     │  *   48. Built-in Audio Speaker [vol: 0.65]
     │
     ├─ Sources:
     │  *   49. Built-in Audio Microphone [vol: 1.00]
     │      51. Pixel 8 [vol: 0.80]        <- 蓝牙输入（手机推流）
     │
     └─ Streams:
            60. Spotify
                 61. output_FL  >  ...
"""

import re

# 节点 id + 名字，例如 "    51. Pixel 8 [vol: 0.80]"
# 允许行首有 box-drawing 前缀（│ ├ └ ─ 等）与焦点标记 *
_NODE_RE = re.compile(r"^\s*[\u2502\u251c\u2514\u2500\u250c\u2510\u252c\u2534\u253c*\s]*(\d+)\.\s+(.+?)\s*(?:\[vol:\s*([0-9.]+)\])?\s*$")
# 分节标题，例如 " ├─ Sinks:"
_SECTION_RE = re.compile(r"[\u2502\u251c\u2514\u2500\u250c\u2510\u252c\u2534\u253c\s]*([A-Za-z][A-Za-z ]*):\s*$")

SECTION_KEYS = {
    "Sinks": "sinks",
    "Sources": "sources",
    "Streams": "streams",
    "Devices": "devices",
    "Clients": "clients",
}


def parse_status(text):
    """把 `wpctl status` 输出解析成 {sinks: [...], sources: [...], ...}。

    每个节点是 dict：{id, name, volume, default}
    """
    out = {"sinks": [], "sources": [], "streams": [], "devices": [], "clients": []}
    current = None
    for raw in (text or "").splitlines():
        line = raw.rstrip()
        if not line.strip():
            continue
        m = _SECTION_RE.match(line)
        if m:
            key = SECTION_KEYS.get(m.group(1).strip())
            if key:
                current = key
                continue
        if current is None:
            continue
        n = _NODE_RE.match(line)
        if not n:
            continue
        # 默认节点在 wpctl status 里用行首的 "*" 标记（星号出现在数字 id 之前）
        prefix = line[:line.rfind(n.group(1) + ".")] if (n.group(1) + ".") in line else ""
        node = {
            "default": "*" in prefix,
            "id": int(n.group(1)),
            "name": n.group(2).strip(),
            "volume": float(n.group(3)) if n.group(3) else None,
        }
        # Streams 里的子行（"61. output_FL > ..."）也符合节点正则，
        # 但它们没有 [vol:]，用 name 里是否含 ">" 排除掉
        if current == "streams" and ">" in node["name"]:
            continue
        out[current].append(node)
    return out


def find_bt_input(status_text):
    """找出蓝牙 A2DP 输入节点（外部设备推流进 Deck）。

    ⚠️⚠️ 重要：`wpctl status` 里**看不到 `bluez_input` 字样**
    ----------------------------------------------------
    Sources 分节显示的是节点的**友好名**（设备名），例如：

        Sources:
            49. Built-in Audio Microphone [vol: 1.00]
            51. Ciallo [vol: 0.80]        <- 这是蓝牙输入，但名字是设备名

    所以「在 wpctl status 里搜 `bluez_input`」**永远搜不到** ——
    这个函数以前就是这么写的，导致 `live` 一直是 None，
    界面上的「谁在放歌」和「外部音源音量」整块功能都没生效。

    真正带 `bluez_input.<MAC>` 的是 `node.name` 属性，只能从 `pw-dump` 拿。
    调用方请优先用 `a2dp.read_node_states()` / `a2dp.has_input_node()`。

    这个函数保留作**降级路径**：如果节点名碰巧就是 `bluez_input...`
    （某些 PipeWire 版本会直接显示 node.name），仍然能认出来。
    另外它现在也会**按「是不是内置声卡」来兜底**：Sources 里只要不是
    内置麦克风、且不是内置声卡，就认为是外部蓝牙输入。
    """
    parsed = parse_status(status_text)

    # 1. 优先：名字里直接带 bluez_input（某些版本 wpctl 会显示 node.name）
    for node in parsed["sources"]:
        if re.search(r"bluez_input", node["name"], re.I):
            node["kind"] = "bluez"
            return node

    # 2. 兜底：Sources 里不是内置设备的，就是外部推流
    #
    #    内置设备的典型名字：Built-in Audio Microphone / alsa_input.*
    #    蓝牙输入在 wpctl 里显示为对端设备名（如 "Ciallo"、"Pixel 8"）
    for node in parsed["sources"]:
        name = node["name"] or ""
        low = name.lower()
        if any(k in low for k in ("built-in", "builtin", "alsa_input", "internal")):
            continue
        node["kind"] = "external"
        return node

    return None


def find_default_sink(status_text):
    parsed = parse_status(status_text)
    for node in parsed["sinks"]:
        if node["default"]:
            return node
    return parsed["sinks"][0] if parsed["sinks"] else None


def has_external_source(status_text):
    """有没有外部设备正在往 Deck 推流。"""
    return find_bt_input(status_text) is not None
