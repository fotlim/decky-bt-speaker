"""
射频干扰检测：诊断蓝牙音频卡顿的根因。

为什么需要这个
--------------
蓝牙 A2DP 与 2.4GHz Wi-Fi **共用同一个 2.4GHz 射频**。当 Wi-Fi 跑在
2.4GHz（信道 1–13）且流量较大时，蓝牙链路带宽被挤压，表现为：

- 声音卡顿 / 断续 / 变成机器人音
- PipeWire 日志出现 `client too slow! rate:512/48000 pos:... status:triggered`
- 距离稍远就断流

这是**环境问题**，不是插件或系统 bug。插件能做的是**检测出来并告诉用户**，
而不是让用户在「音质差」和「插件有问题」之间瞎猜。

解法（按有效性排序）
------------------
1. **把 Wi-Fi 切到 5GHz** —— 最彻底，5GHz 与蓝牙完全不冲突
2. 换蓝牙编码器到 SBC（码率低，抗干扰更强）
3. 用「抗卡顿」延迟档位（加大缓冲）
4. 关掉不用的 2.4GHz 设备（无线鼠标、2.4G 接收器）
"""

import re

from bt import BtError, run_cmd, which

# 2.4GHz 频段的频率范围（MHz）。低于 3000 基本可判定为 2.4GHz。
WIFI_24G_MAX_MHZ = 3000

# 常见 2.4GHz 信道中心频率（MHz）
CHANNEL_CENTERS = {
    1: 2412, 2: 2417, 3: 2422, 4: 2427, 5: 2432, 6: 2437, 7: 2442,
    8: 2447, 9: 2452, 10: 2457, 11: 2462, 12: 2467, 13: 2472, 14: 2484,
}


def parse_iw_dev(text):
    """解析 `iw dev` 输出，提取每个接口的 SSID / 信道 / 频率。

    输出样例：
        phy#0
                Interface wlan0
                        ifindex 3
                        ssid MyWiFi
                        channel 11 (2462 MHz), width: 20 MHz, center1: 2462 MHz
    """
    if not text:
        return []
    out = []
    cur = None
    for line in text.splitlines():
        s = line.strip()

        m = re.match(r"Interface\s+(\S+)", s)
        if m:
            if cur:
                out.append(cur)
            cur = {"interface": m.group(1), "ssid": "", "channel": None,
                   "freq_mhz": None, "width": ""}
            continue
        if cur is None:
            continue

        m = re.match(r"ssid\s+(.+)$", s)
        if m:
            cur["ssid"] = m.group(1).strip()
            continue

        # channel 11 (2462 MHz), width: 20 MHz, center1: 2462 MHz
        m = re.match(r"channel\s+(\d+)\s*\((\d+)\s*MHz\)(?:,\s*width:\s*([^,]+))?", s)
        if m:
            cur["channel"] = int(m.group(1))
            cur["freq_mhz"] = int(m.group(2))
            if m.group(3):
                cur["width"] = m.group(3).strip()

    if cur:
        out.append(cur)
    return out


def analyze(interfaces):
    """分析干扰情况，返回结构化结论。"""
    wifi_24g = []
    wifi_5g = []
    for it in interfaces:
        f = it.get("freq_mhz")
        if not f:
            continue
        if f < WIFI_24G_MAX_MHZ:
            wifi_24g.append(it)
        else:
            wifi_5g.append(it)

    risk = "none"
    if wifi_24g:
        risk = "high"

    return {
        "wifi_24g": wifi_24g,
        "wifi_5g": wifi_5g,
        "risk": risk,
        "interfaces": interfaces,
        "advice": _advice(wifi_24g, wifi_5g),
    }


def _advice(wifi_24g, wifi_5g):
    if not wifi_24g:
        if wifi_5g:
            return "Wi-Fi 在 5GHz，与蓝牙不冲突，很好。"
        return "没有检测到 Wi-Fi 连接（或没有 iw 命令）。"
    names = "、".join(
        "%s（信道 %s，%s MHz）" % (i.get("ssid") or i.get("interface"),
                                  i.get("channel") or "?",
                                  i.get("freq_mhz") or "?")
        for i in wifi_24g
    )
    return (
        "检测到 2.4GHz Wi-Fi：%s。\n"
        "蓝牙与 2.4GHz Wi-Fi 共用同一个射频，这是音频卡顿的头号原因。\n"
        "建议把 Wi-Fi 切到 5GHz（路由器 5G 频段），卡顿通常立刻消失。\n"
        "如果只能用 2.4GHz：在「设置 → 延迟档位」选「抗卡顿」，或改用 SBC 编码器。"
        % names
    )


async def detect():
    """读取当前 Wi-Fi 状态并分析干扰风险。"""
    if not which("iw"):
        return {
            "available": False,
            "risk": "unknown",
            "advice": "系统里没有 iw 命令，无法检测 Wi-Fi 频段。",
            "wifi_24g": [],
            "wifi_5g": [],
            "interfaces": [],
        }
    try:
        rc, out = await run_cmd(["iw", "dev"], timeout=6.0)
    except BtError:
        rc, out = 1, ""
    if rc != 0:
        return {
            "available": False,
            "risk": "unknown",
            "advice": "读取 Wi-Fi 信息失败（可能没联网或权限不足）。",
            "wifi_24g": [],
            "wifi_5g": [],
            "interfaces": [],
        }
    result = analyze(parse_iw_dev(out))
    result["available"] = True
    return result


async def check_too_slow(tail=300):
    """从 PipeWire 日志里找 `client too slow`，这是卡顿的直接证据。"""
    if not which("journalctl"):
        return {"checked": False, "count": 0, "samples": []}
    env = {"XDG_RUNTIME_DIR": "/run/user/%d" % _uid()}
    argv = ["env"] + ["%s=%s" % (k, v) for k, v in env.items()] + [
        "journalctl", "--user", "-u", "pipewire", "--no-pager",
        "-n", str(int(tail)), "--output=cat",
    ]
    try:
        rc, out = await run_cmd(argv, timeout=10.0)
    except BtError:
        return {"checked": False, "count": 0, "samples": []}
    if rc != 0:
        return {"checked": False, "count": 0, "samples": []}
    hits = [ln.strip() for ln in (out or "").splitlines() if "too slow" in ln.lower()]
    return {"checked": True, "count": len(hits), "samples": hits[-5:]}


def _uid():
    import os
    try:
        return os.getuid()
    except Exception:
        return 1000
