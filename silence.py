"""
静音守卫与音量归一化。

两个功能都来自成熟产品的启发，但针对 Deck 场景做了改造：

1. **静音自动断开**（抄 Airfoil 的 Silence Monitor）
   Deck 是电池设备。手机连上来放完歌后常常忘了断开，A2DP 链路继续占着
   蓝牙射频，既耗电又让手机的通知音被吞掉（手机以为还在放歌）。

2. **音量归一化**（抄 Sonos 的音量体验规范）
   手机切歌时音量忽大忽小是接收端最常见的抱怨。这里做的是「温和归一化」：
   记录外部源的音量基线，当它突然大幅偏离时给一个提示，而不是粗暴地改。

⚠️ 为什么不用 `pw-record` 采电平判静音？
真正判断「有没有声音」需要采集 sink monitor 的采样算 RMS，代价是：
- 持续占用一个 capture 流（额外的 CPU 与延迟）
- 需要解析裸 PCM
- 在 Deck 的省电场景下得不偿失

改用**节点状态**判断：PipeWire 里没有音频流时，节点会进入 idle/suspended
状态（`node.state` 或 `pw-dump` 里的 state 字段）。这比猜电平可靠得多，
且零额外开销。
"""

import re
import time

from bt import BtError, run_cmd, which

# 判定为「静音」的节点状态（PipeWire 的 node.state）
IDLE_STATES = {"idle", "suspended", "error"}

# 音量偏离基线的告警阈值（超过这么多就认为「切歌后音量跳变」）
VOLUME_JUMP_THRESHOLD = 0.25


class SilenceGuard:
    """跟踪外部源的活跃状态，长时间静默就触发回调。"""

    def __init__(self, timeout_sec=0, log=None):
        self.timeout_sec = int(timeout_sec or 0)
        self._log = log or (lambda *_: None)
        self._last_active = time.monotonic()
        self._was_active = False

    def configure(self, timeout_sec):
        self.timeout_sec = int(timeout_sec or 0)
        self._last_active = time.monotonic()

    @property
    def enabled(self):
        return self.timeout_sec > 0

    def observe(self, active):
        """每次轮询调用。active=True 表示外部源正在跑。

        返回 True 表示「刚刚超时，应该断开」。
        """
        now = time.monotonic()
        if active:
            self._last_active = now
            self._was_active = True
            return False
        if not self.enabled or not self._was_active:
            return False
        if (now - self._last_active) >= self.timeout_sec:
            self._was_active = False
            self._log("静音已持续 %d 秒，触发自动断开" % self.timeout_sec)
            return True
        return False

    def reset(self):
        self._last_active = time.monotonic()
        self._was_active = False

    def status(self):
        idle = time.monotonic() - self._last_active
        return {
            "enabled": self.enabled,
            "timeout": self.timeout_sec,
            "idle_sec": int(idle),
            "was_active": self._was_active,
            "remaining": max(0, int(self.timeout_sec - idle)) if self.enabled and self._was_active else None,
        }


def parse_node_states(pw_dump_json):
    """从 `pw-dump` 的 JSON 里找出蓝牙输入节点的运行状态。

    返回 [{'id','name','state','active'}]，只含 bluez_input 节点。
    解析失败返回空列表（不抛异常，静音守卫是可选功能）。
    """
    import json

    if not pw_dump_json:
        return []
    try:
        data = json.loads(pw_dump_json)
    except Exception:
        return []
    if not isinstance(data, list):
        return []
    out = []
    for obj in data:
        try:
            if obj.get("type") != "PipeWire:Interface:Node":
                continue
            props = (obj.get("info") or {}).get("props") or {}
            name = str(props.get("node.name") or "")
            if "bluez_input" not in name.lower():
                continue
            state = str(obj.get("info", {}).get("state") or "").lower()
            out.append({
                "id": obj.get("id"),
                "name": name,
                "state": state,
                "active": state not in IDLE_STATES,
            })
        except Exception:
            continue
    return out


async def read_node_states():
    """跑 `pw-dump` 拿节点状态。没有 pw-dump 就返回 None（调用方降级）。"""
    if not which("pw-dump"):
        return None
    try:
        rc, out = await run_cmd(["pw-dump"], timeout=8.0)
    except BtError:
        return None
    if rc != 0:
        return None
    return parse_node_states(out)


class Normalizer:
    """音量归一化：记录基线，检测跳变。"""

    def __init__(self, log=None):
        self._log = log or (lambda *_: None)
        self._baseline = None
        self._last = None
        self.jump_count = 0

    def observe(self, volume):
        """返回 {'jumped': bool, 'baseline': float|None, 'delta': float}。"""
        if volume is None:
            return {"jumped": False, "baseline": self._baseline, "delta": 0.0}
        vol = float(volume)
        result = {"jumped": False, "baseline": self._baseline, "delta": 0.0}
        if self._baseline is None:
            self._baseline = vol
            self._last = vol
            return result
        delta = vol - self._last
        result["delta"] = round(delta, 3)
        if abs(delta) >= VOLUME_JUMP_THRESHOLD:
            self.jump_count += 1
            result["jumped"] = True
            self._log("外部源音量跳变：%.2f -> %.2f" % (self._last, vol))
        self._last = vol
        return result

    def set_baseline(self, volume):
        if volume is None:
            return
        self._baseline = float(volume)
        self._last = float(volume)

    def reset(self):
        self._baseline = None
        self._last = None
        self.jump_count = 0

    def status(self):
        return {
            "baseline": round(self._baseline, 3) if self._baseline is not None else None,
            "last": round(self._last, 3) if self._last is not None else None,
            "jumps": self.jump_count,
        }
