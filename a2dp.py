"""A2DP 就绪等待：连上 ≠ 能用。

问题现象
--------
真机反馈：「现在是连接了，但是电脑好像没有把它识别为音箱」，
补充说明是「要一段时间才能识别为音箱」。

**这不是 bug，是蓝牙 A2DP 的协议流程本身要时间。**

完整链路有四步，`bluetoothctl connect` 只走完第一步就返回了：

```
1. ACL 链路建立         bluetoothctl connect 返回时完成
2. SDP 服务发现         对端要知道 Deck 提供 A2DP Sink
3. AVDTP 能力协商       两边交换 SEP、编码器能力，选定 codec
4. WirePlumber 建卡     创建 bluez_input.<MAC> 节点、切到 a2dp-sink profile
```

第 2~4 步的耗时取决于对端实现，实测常见 1~6 秒，慢的设备更久。
PipeWire 官方在 [MR !1107](https://gitlab.freedesktop.org/pipewire/pipewire/-/merge_requests/1107)
里把 device profile 超时从 3 秒**加到 6 秒**，理由正是：

> In some cases, BlueZ can take more than the previous 3sec to connect all profiles.

[bluez#205](https://github.com/bluez/bluez/issues/205) 也说明了原因：
两边可能同时抢着连 profile，AVDTP 命令来回要好几秒。

所以本模块做的事是：**把这段等待变得可见、并且尽量缩短**。

- **可见**：连上后立刻告诉用户「正在协商音频」，而不是让人以为失败了
- **缩短**：轮询到 `a2dp-sink` profile 就绪就立刻返回，不必死等固定时长
- **兜底**：如果超过若干秒 profile 还是 `off` / 不存在，主动用 `pactl`
  切一次 profile（这是社区脚本里最有效的补救手段）

⚠️ 设计约束：**不做「等到超时就报错」**。
蓝牙协商慢是常态，报错只会误导用户。超时后返回
`{"ready": False, "reason": "still-negotiating"}`，由上层决定要不要提示。
"""

import asyncio
import re
import time

from btutil import normalize_mac, run_cached, run_cmd, which

# 轮询间隔（秒）。太密会不停 fork `pactl`，太疏则感知不到「刚好就绪」。
POLL_INTERVAL = 0.4

# 总等待上限（秒）。取 12 秒 —— PipeWire 自己的 profile 超时是 6 秒，
# 再留一倍余量给慢设备。超过这个时间就认为「还在协商」，不报错。
MAX_WAIT = 12.0

# 超过这么久还没就绪，就主动尝试修正 profile（秒）。
# 取 4 秒：正常设备一般 1~3 秒内就绪，到这个点还没好说明可能卡住了。
REPAIR_AFTER = 4.0

# 「已就绪」的 profile 名特征
_A2DP_SINK_RE = re.compile(r"a2dp[-_]sink", re.I)


def parse_cards(text, mac=None):
    """从 `pactl list cards` 的输出里解析出蓝牙卡的信息。

    返回列表，每项：
        {"name": 卡片名, "active": 当前 profile, "available": [profile...],
         "is_bluez": bool, "matches_mac": bool}

    `pactl list cards` 的结构大致是：

        Card #52
            Name: bluez_card.CC_42_10_8A_70_42
            ...
            Active Profile: a2dp-sink-sbc_xq
            Profiles:
                a2dp-sink-sbc_xq: High Fidelity Playback (A2DP Sink, codec SBC-XQ)
                off: Off
    """
    if not text:
        return []

    # 把 MAC 归一化成 pactl 卡片名里的写法。
    #
    # `pactl` 的卡片名形如 `bluez_card.CC_42_10_8A_70_42`（冒号换成下划线）。
    # ⚠️ 这里必须复用 `normalize_mac` 而不是自己 `replace(":", "_")` ——
    # 前端/BlueZ 可能给出横线、点分、小写等各种写法（真机配对电脑时就踩过
    # 「设备地址不合法」的坑），自己替换只能处理冒号一种。
    want = ""
    if mac:
        norm = normalize_mac(mac)
        if norm:
            want = norm.replace(":", "_")
    cards = []
    cur = None
    in_profiles = False

    for raw in text.splitlines():
        line = raw.rstrip()
        stripped = line.strip()

        if stripped.startswith("Card #"):
            if cur:
                cards.append(cur)
            cur = {"name": "", "active": "", "available": [],
                   "is_bluez": False, "matches_mac": False}
            in_profiles = False
            continue

        if cur is None:
            continue

        if stripped.startswith("Name:"):
            cur["name"] = stripped.split(":", 1)[1].strip()
            if cur["name"].startswith("bluez_card."):
                cur["is_bluez"] = True
                if want and want in cur["name"].upper():
                    cur["matches_mac"] = True
            in_profiles = False
            continue

        if stripped.startswith("Active Profile:"):
            cur["active"] = stripped.split(":", 1)[1].strip()
            in_profiles = False
            continue

        if stripped == "Profiles:":
            in_profiles = True
            continue

        if in_profiles:
            # profile 行是缩进的 "名字: 描述"
            m = re.match(r"^\s+(\S+):\s", line)
            if m:
                cur["available"].append(m.group(1))
            elif stripped and not line[:1].isspace():
                in_profiles = False

    if cur:
        cards.append(cur)
    return cards


def find_sink_card(cards, mac=None):
    """找出「接收端」那张蓝牙卡。

    优先按 MAC 精确匹配；匹配不到就退回「第一张有 a2dp-sink profile 的蓝牙卡」
    —— 同一时刻只可能有一台设备在当音箱（AVDTP 限制），所以这个回退是安全的。
    """
    bluez = [c for c in cards if c.get("is_bluez")]
    if mac:
        for c in bluez:
            if c.get("matches_mac"):
                return c
    for c in bluez:
        if any(_A2DP_SINK_RE.search(p) for p in c.get("available") or []):
            return c
    return bluez[0] if bluez else None


def sink_ready(card):
    """这张卡是不是已经处在 a2dp-sink（接收）profile 上了。"""
    if not card:
        return False
    active = (card.get("active") or "").strip().lower()
    if not active or active == "off":
        return False
    return bool(_A2DP_SINK_RE.search(active))


def best_sink_profile(card):
    """从可用 profile 里挑一个最好的 a2dp-sink profile。

    优先级：SBC-XQ（高码率 SBC 变体）> AAC > SBC。
    为什么优先 SBC-XQ？见 quality.py 的说明：码率从 328 提到约 452 kbps，
    兼容性几乎无损失，是最划算的提升。
    """
    if not card:
        return ""
    cands = [p for p in card.get("available") or [] if _A2DP_SINK_RE.search(p)]
    if not cands:
        return ""

    def score(p):
        low = p.lower().replace("_", "-")
        if "sbc-xq" in low:
            return 100
        if "aac" in low:
            return 80
        if "ldac" in low:
            return 90
        if "aptx" in low:
            return 70
        if "sbc" in low:
            return 50
        return 10

    return max(cands, key=score)


async def read_cards():
    """跑 `pactl list cards` 并解析。失败返回空列表（不抛异常）。

    ⚠️ 走 `run_cached`：同一次 `status()` 里 `focus.get_active_profile()`
    也会跑一模一样的命令。共享 1.5 秒缓存，把两个进程压成一个。
    """
    if not which("pactl"):
        return []
    try:
        rc, out = await run_cached(["pactl", "list", "cards"], ttl=1.5, timeout=10.0)
    except Exception:  # noqa: BLE001
        return []
    if rc != 0:
        return []
    return parse_cards(out)


async def set_profile(card_name, profile):
    """切换某张卡的 profile。返回 (ok, 输出)。"""
    if not which("pactl") or not card_name or not profile:
        return False, "missing pactl / card / profile"
    try:
        rc, out = await run_cmd(
            ["pactl", "set-card-profile", card_name, profile], timeout=10.0
        )
        return rc == 0, (out or "").strip()
    except Exception as e:  # noqa: BLE001
        return False, str(e)


async def has_input_node(mac=None):
    """PipeWire 里有没有 `bluez_input` 节点 —— 音频链路真的通了的**强判据**。

    ⚠️⚠️ 血泪教训（v2.9.2）
    ----------------------
    v2.9.1 里这个函数是用 `wpctl status` 全文搜 `bluez_input` 实现的，
    **永远返回 False**，因为：

        `wpctl status` 显示的是节点的**友好名**
            Sources:
                51. Ciallo [vol: 0.80]        <- 只有设备名，没有 bluez_input

        而 `node.name`（真正带 `bluez_input.MAC` 的那个属性）
        只能从 `pw-dump` 的 JSON 里拿到

    结果就是「音频在放、界面却一直说正在协商」——判据压根没生效。
    教训：**判断某个数据源里有什么之前，先确认那个字段真的会出现在里面。**

    现在改用 `pw-dump`，和 `silence.py` 里 `parse_node_states` 用的是同一个
    可靠来源（那边早就在用了，本鱼这里重复踩了一遍）。

    为什么这个判据比 profile 名可靠？
    ------------------------------
    有些对端（尤其 Windows）协商完成后，`pactl` 的 `Active Profile`
    仍可能显示成别的名字。而 `bluez_input` 节点是 **A2DP 流真的建起来
    才会出现**的（PipeWire 在 transport 启动时才创建它），几乎不会误判。
    """
    states = await read_node_states()
    if states is None:
        return False
    return _has_bluez_input(states, mac)


def _has_bluez_input(states, mac=None):
    """从 `pw-dump` 解析出的节点列表里判断有没有 bluez_input（纯函数，便于测试）。

    `states` 是 `silence.parse_node_states()` 那种列表：
        [{"id": 51, "name": "bluez_input.CC_42_10_8A_70_42", "state": "running"}]

    也接受原始文本（便于测试和降级），此时直接在文本里搜。
    """
    if not states:
        return False

    want = ""
    if mac:
        norm = normalize_mac(mac)
        if norm:
            # node.name 形如 bluez_input.CC_42_10_8A_70_42（冒号换下划线）
            want = norm.replace(":", "_").lower()

    # 传进来的是列表（正常路径）
    if isinstance(states, (list, tuple)):
        for item in states:
            if not isinstance(item, dict):
                continue
            name = str(item.get("name") or "").lower()
            if "bluez_input" not in name:
                continue
            if not want or want in name:
                return True
        return False

    # 传进来的是文本（降级 / 测试）
    for raw in str(states).splitlines():
        low = raw.lower()
        if "bluez_input" not in low:
            continue
        if not want or want in low:
            return True
    return False


async def read_node_states():
    """用 `pw-dump` 读节点状态。没有 pw-dump / 失败时返回 None。

    ⚠️ 走共享缓存：`silence.read_node_states()` 读的是**同一个** `pw-dump`，
    静音守卫和 A2DP 就绪判断在同一次轮询里会各读一遍。
    `pw-dump` 输出很大（几十 KB JSON），fork 一次比普通命令贵得多，
    这里缓存 1.5 秒能把重复调用合并掉。
    """
    if not which("pw-dump"):
        return None
    try:
        rc, out = await run_cached(["pw-dump"], ttl=1.5, timeout=10.0)
    except Exception:  # noqa: BLE001
        return None
    if rc != 0 or not out:
        return None
    try:
        import json as _json
        data = _json.loads(out)
    except Exception:  # noqa: BLE001
        return None
    if not isinstance(data, list):
        return None
    result = []
    for obj in data:
        try:
            if not isinstance(obj, dict):
                continue
            if obj.get("type") != "PipeWire:Interface:Node":
                continue
            info = obj.get("info") or {}
            props = info.get("props") or {}
            result.append({
                "id": obj.get("id"),
                "name": str(props.get("node.name") or ""),
                "state": str(info.get("state") or "").lower(),
            })
        except Exception:  # noqa: BLE001
            continue
    return result


async def wait_for_sink(mac=None, log=None, max_wait=MAX_WAIT,
                        repair_after=REPAIR_AFTER):
    """等 A2DP Sink 就绪。

    返回 dict：
        {
          "ready": bool,
          "seconds": float,          # 实际等了多久
          "profile": str,            # 就绪时的 profile 名
          "repaired": bool,          # 是否主动修正过 profile
          "card": str,               # 卡片名
          "reason": str,             # 未就绪的原因
          "via": str,                # 就绪依据：node / profile
        }

    ⚠️ 未就绪**不是错误**。蓝牙协商慢是常态（见模块开头的说明），
    所以这里只如实汇报，由上层决定要不要提示用户继续等。

    ⚠️ 判据有两个，任一成立即算就绪：
      1. `bluez_input` 节点存在（**强判据**，流真建起来才会有）
      2. 卡片 profile 是 a2dp-sink（弱判据，有些对端会显示成别的名字）
    """
    _log = log or (lambda *_: None)
    started = time.monotonic()
    repaired = False
    last_card = None
    tried_profile = ""

    while True:
        elapsed = time.monotonic() - started
        cards = await read_cards()
        card = find_sink_card(cards, mac)
        if card:
            last_card = card

        by_profile = sink_ready(card)
        by_node = await has_input_node(mac)

        if by_profile or by_node:
            prof = (card or {}).get("active", "")
            via = "node" if by_node else "profile"
            _log("A2DP 就绪：%.1fs，profile=%s，依据=%s" % (elapsed, prof, via))
            return {
                "ready": True,
                "seconds": round(elapsed, 1),
                "profile": prof,
                "repaired": repaired,
                "card": (card or {}).get("name", ""),
                "reason": "",
                "via": via,
            }

        # 还没就绪：如果卡已经出现、但 profile 是 off / 不对，主动修一次。
        #
        # 为什么需要这一步？—— 社区脚本里最有效的补救手段就是这个。
        # 有时 WirePlumber 建好了卡却把 profile 留在 off（或停在 HFP），
        # 单纯等是等不好的，必须显式 set-card-profile。
        if (not repaired) and elapsed >= repair_after and card is not None:
            target = best_sink_profile(card)
            if target and target != card.get("active"):
                ok, out = await set_profile(card.get("name", ""), target)
                repaired = True
                tried_profile = target
                _log("A2DP 未就绪（%.1fs，当前 %s），主动切到 %s -> %s"
                     % (elapsed, card.get("active") or "无", target,
                        "成功" if ok else "失败：" + out))

        if elapsed >= max_wait:
            reason = "no-card" if last_card is None else (
                "profile-off" if (last_card.get("active") or "off").lower() == "off"
                else "wrong-profile"
            )
            _log("A2DP 等待超时（%.1fs）：%s，当前 profile=%s"
                 % (elapsed, reason, (last_card or {}).get("active") or "无"))
            return {
                "ready": False,
                "seconds": round(elapsed, 1),
                "profile": (last_card or {}).get("active", ""),
                "repaired": repaired,
                "card": (last_card or {}).get("name", ""),
                "tried_profile": tried_profile,
                "reason": reason,
            }

        await asyncio.sleep(POLL_INTERVAL)
