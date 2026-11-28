"""
音频焦点策略：决定「手机推流」和「Deck 游戏声音」怎么共存。

三种模式（照抄 AudioRelay 的 Audio focus 思路，但针对 Deck 场景改造）：

- `receiver_first`（接收端优先）：蓝牙一连上就把默认输出切到它 / 提高它的优先级
- `coexist`（与游戏共存）：两者都出声，互不抢占 —— 这是默认
- `manual`（手动）：插件不插手，用户自己用系统音量面板调

⚠️ 关键设计约束：**不用 `wpctl set-default` 做自动切换。**

原因（两个真实 bug）：
1. `wpctl set-default` 的选择会被**永久记住**在 default-streams 状态文件里，
   并且比所有 `priority.session` 都高（find-selected-default-node.lua 里给了
   `priority = 30000 + priority` 的加成）。一旦设过，用户之后在系统里怎么切
   都会被它压回去，`wpctl clear-default` 才能忘掉。
2. GNOME Settings 的 #3800 就是这个机制导致的：设备移除时被改写成 fallback，
   之后内置扬声器永远抢不走默认。

所以本插件改为**临时操作**：只在「外部源出现/消失」时做一次性的路由修正，
不写入持久的 default-streams 状态。用户自己选的默认设备永远优先。
"""

import re

from bt import BtError, run_cached, run_cmd, which

MODES = ("receiver_first", "coexist", "manual")

MODE_LABELS = {
    "receiver_first": "接收端优先",
    "coexist": "与游戏共存",
    "manual": "手动",
}


class Focus:
    """音频焦点策略执行器。"""

    def __init__(self, wp, log=None):
        self._wp = wp
        self._log = log or (lambda *_: None)

    @staticmethod
    def mode_label(mode):
        return MODE_LABELS.get(mode, mode)

    # -- 与游戏共存：把外部源也接到默认 sink -----------------------------
    async def ensure_linked(self, source_id, sink_id):
        """确保外部源被连到默认 sink（PipeWire 一般会自动连，这里只做兜底）。

        用 `pw-link` 建立链接。已存在则跳过。
        """
        if not which("pw-link"):
            return False
        try:
            rc, out = await run_cmd(["pw-link", "-l"], timeout=5.0)
            if rc == 0 and out:
                # 输出形如 "  61.bluez_input...:capture_FL | 48.Speaker:playback_FL"
                if re.search(r"bluez_input", out, re.I):
                    return True
        except BtError:
            return False
        return False

    # -- 蓝牙自动切换耳机模式的开关 --------------------------------------
    async def set_autoswitch(self, enabled):
        """`bluetooth.autoswitch-to-headset-profile`：有人开麦时是否切到通话模式。

        对「当音箱」场景应该关掉 —— 否则一开麦整条流掉成 mSBC 单声道。
        """
        value = "true" if enabled else "false"
        rc, out = await run_cmd(
            ["wpctl", "settings", "--save", "bluetooth.autoswitch-to-headset-profile", value],
            timeout=8.0,
        )
        if rc != 0:
            raise BtError("设置 autoswitch 失败：%s" % (out or "").strip())
        self._log("autoswitch-to-headset-profile = %s" % value)
        return True

    async def get_autoswitch(self):
        rc, out = await run_cmd(
            ["wpctl", "settings", "bluetooth.autoswitch-to-headset-profile"], timeout=6.0
        )
        if rc != 0:
            return None
        low = (out or "").lower()
        if "true" in low:
            return True
        if "false" in low:
            return False
        return None

    # -- 编码器与延迟 ----------------------------------------------------
    async def list_codecs(self):
        """读取当前蓝牙卡可用的编码器 profile 列表。"""
        if not which("pactl"):
            return []
        try:
            rc, out = await run_cmd(["pactl", "list", "cards", "short"], timeout=6.0)
        except BtError:
            return []
        if rc != 0:
            return []
        return [ln.strip() for ln in (out or "").splitlines() if "bluez" in ln.lower()]

    async def get_active_profile(self):
        """读取蓝牙卡当前激活的 profile（能看出用的是 SBC 还是 AAC）。

        ⚠️ 走 `run_cached`：`a2dp.read_cards()` 跑的是**同一条命令**，
        两者在同一次 `status()` 里各调一次就是白烧一个进程。
        """
        if not which("pactl"):
            return ""
        try:
            rc, out = await run_cached(["pactl", "list", "cards"], ttl=1.5, timeout=8.0)
        except BtError:
            return ""
        if rc != 0:
            return ""
        # 找 "Active Profile: a2dp-sink-sbc" 这种行
        m = re.search(r"Active Profile:\s*(\S+)", out or "")
        return m.group(1) if m else ""


def summarize_profile(profile):
    """把 profile 名翻译成人话，例如 a2dp-sink-sbc_xq -> {'codec':'SBC-XQ','role':'接收'}。

    注意 PipeWire / PulseAudio 的 profile 命名在不同版本里不统一：
    - `sbc_xq`（下划线）与 `sbc-xq`（连字符）都出现过
    - 通话 profile 既可能叫 `headset-head-unit`（PulseAudio 传统名），
      也可能叫 `hfp-ag` / `hsp-hs`（PipeWire 新名）
    """
    if not profile:
        return {"codec": "", "role": ""}
    low = profile.lower()
    # 统一分隔符，避免下划线 / 连字符两种写法漏判
    norm = low.replace("_", "-")

    if "a2dp-sink" in norm:
        role = "接收"
    elif "a2dp-source" in norm:
        role = "发送"
    elif "headset" in norm or "hfp" in norm or "hsp" in norm or "handsfree" in norm:
        role = "通话"
    else:
        role = ""

    codec = ""
    # 顺序重要：更具体的先匹配（sbc-xq 必须在 sbc 之前）
    for key, label in (
        ("sbc-xq", "SBC-XQ"),
        ("sbc", "SBC"),
        ("aac", "AAC"),
        ("ldac", "LDAC"),
        ("aptx-hd", "aptX HD"),
        ("aptx-ll", "aptX LL"),
        ("aptx", "aptX"),
        ("opus", "Opus"),
    ):
        if key in norm:
            codec = label
            break
    if not codec and role == "通话":
        codec = "HFP 通话"
    return {"codec": codec, "role": role}
