/**
 * 轻量 i18n：跟随 Steam 客户端语言，默认英文。
 *
 * 为什么不直接用 i18next？
 * ----------------------
 * Decky Loader 内部用 i18next，但那是给 loader 自己用的，
 * 插件无法直接复用它的实例和语言包。自己做一个极小的查表方案更可靠，
 * 也避免引入额外依赖（Decky 插件体积越小越好）。
 *
 * 语言从哪来？
 * -----------
 * 按可靠性排序依次尝试：
 *   1. `SteamClient.Settings.GetLanguage()`（最准，跟随 Steam 界面语言）
 *   2. `navigator.language`
 *   3. 兜底 `en`
 *
 * 中文用户会拿到 `schinese` / `zh-CN` 等，统一归一化成 `zh`。
 */

export type Lang = "en" | "zh";

type Dict = Record<string, string>;

const EN: Dict = {
  // 通用
  "common.ok": "OK",

  "common.save": "Save",
  "common.saving": "Saving…",
  "common.remove": "Remove",
  "common.retry": "Retry",
  "common.reading": "Reading…",
  "common.none": "None",
  "common.unknown": "Unknown",
  "common.empty": "(empty)",

  // 插件名
  "plugin.name": "Bluetooth Speaker",

  // QAM 面板
  "qam.btOn": "Bluetooth on",
  "qam.btOff": "Bluetooth off",
  "qam.discoverable": "Discoverable",
  "qam.notVisible": "Hidden",
  "qam.connectedCount": "{n} connected",
  "qam.allowDiscover": "Allow devices to find and connect",
  "qam.allowDiscoverDescOn": "This Deck appears in phone / PC Bluetooth lists",
  "qam.allowDiscoverDescOff": "Turn on so other devices can find it",
  "qam.turnOnBt": "Turn on Bluetooth",
  "qam.unblockRfkill": "Unblock radio (needs sudo)",
  "qam.rfkillHard": "Bluetooth is hardware-blocked. Software can't fix it — restart the Deck.",
  "qam.rfkillSoft": "Bluetooth is blocked by the radio switch. This is the most common reason it won't turn on.",
  "qam.playing": "Now playing: {name}",
  "qam.externalSource": "External source",
  "qam.noTrackInfo": "No track info from the source device",
  "qam.disconnect": "Disconnect",
  "qam.volume": "Volume",
  "qam.volumeHint": "use Steam volume keys for exact value",
  "qam.mute": "Mute",
  "qam.unmute": "Unmute",

  "qam.boostHint": "Set absolute volume (no read-back needed):",

  "qam.boosted100": "Volume set to 100%",
  "qam.boosted130": "Volume set to 130%",
  "qam.boosted150": "Volume set to 150%",
  "qam.boosted200": "Volume set to 200% (may clip)",
  "qam.hintFind": "Look for {alias} in your phone's Bluetooth settings, then just play.",
  "qam.manage": "Devices / Settings",
  "qam.dimScreen": "Turn off screen (keep playing)",

  "qam.dimFailed": "Cannot turn off screen",
  "qam.inhibitFailed": "Bluetooth may drop while screen is off",
  "qam.inhibitFailedBody": "The plugin could not stop the system from auto-suspending. Your Deck will sleep on the idle timer and the audio link drops. Turn off \"sleep after idle\" in Steam > Settings > Power, or check systemd-inhibit permissions.",
  "qam.dimKeepAwake": "Auto-suspend is blocked while the screen is off",
  "qam.dimScreenHint": "The screen turns off and the Deck stays awake, so the audio link survives.",
  "qam.playingLabel": "Playing",
  "qam.connectedLabel": "Connected",
  "qam.negotiating": "Negotiating audio (A2DP)…",
  "qam.negotiatingHint": "The Bluetooth link is up, but the audio profile is still being negotiated. It usually takes 1-6 seconds before the Deck shows up as a speaker on your device. Just wait a moment.",
  "qam.a2dpForce": "Force A2DP sink profile",
  "qam.a2dpFixed": "Switched to A2DP sink",
  "qam.a2dpFixFailed": "Could not switch profile",

  // 全屏页
  "page.title": "Bluetooth Speaker",
  "page.readingAdapter": "Reading Bluetooth adapter…",
  "page.a2dpSink": "A2DP Sink",
  "page.noSink": "No Sink role",
  "tab.devices": "Paired",
  "tab.settings": "Settings",
  "tab.eq": "Equalizer",
  "tab.diag": "Diagnostics",

  // 设备
  "dev.search": "Search nearby devices",
  "dev.searchHint": "Streaming scan: results appear as they're found. Tap again to stop early.",
  "dev.searchHintWarn": "Tip: turn on \"Allow devices to find and connect\" in QAM first.",

  "dev.stopScan": "Stop",
  "dev.foundCount": "{n} found",
  "dev.showUnnamed": "Show unnamed devices",
  "dev.showUnnamedDesc": "Devices that don't broadcast a name are shown with a type + MAC tail label. Turn off to hide clutter.",
  "dev.hiddenCount": "{n} unnamed devices hidden",
  "dev.hiddenPaired": "{n} unnamed paired devices hidden",
  "dev.allHidden": "All {n} devices found are unnamed. Turn on \"Show unnamed devices\" to see them.",
  "dev.pair": "Pair",
  "dev.pairing": "Pairing…",
  "dev.paired": "Paired {name}",
  "dev.pairFailed": "Pair failed",
  "dev.noneFound": "No unpaired devices found. The phone may already be paired, or its Bluetooth is off.",
  "dev.noDevices": "No devices paired yet. Use \"Search nearby devices\" above to find your phone.",
  "dev.pairedCount": "Paired ({n})",
  "dev.connected": "Connected",

  "dev.connect": "Connect",

  "dev.disconnected": "Disconnected",
  "dev.repair": "Repair",
  "dev.repairing": "Repairing…",
  "dev.removed": "Pairing removed",
  "dev.noName": "device did not broadcast a name",
  "dev.unknownLabel": "Unknown device · {mac}",

  "dev.untrusted": "Untrusted",
  "dev.blocked": "Blocked",
  "dev.trust": "Trust",
  "dev.untrust": "Untrust",
  "dev.trustedOn": "Trusted — auto-reconnect allowed",
  "dev.trustedOff": "Untrusted — auto-reconnect disabled",
  "dev.connectedToast": "Connected {name}",
  "dev.connectFailed": "Connect failed",
  "dev.hint": "Once connected, play music on your phone and it comes out of the Deck. Only one A2DP source at a time.",
  "dev.hintPair": "Pairing code / passkey incorrect? Tap \"Repair\" — it clears the old bond key on the Deck side. If it still fails, \"Forget\" the device on your phone too.",

  // 设置
  "set.name": "Device name",
  "set.nameHint": "The name others see in their Bluetooth list.",
  "set.audioTuning": "Speaker tuning",
  "set.audioTuningLabel": "Enable \"speaker optimization\"",
  "set.audioTuningDesc": "Writes a user-level WirePlumber config: A2DP-only roles, external stream goes straight to speakers, no fallback to call mono. Restarts WirePlumber.",
  "set.tuningOn": "Speaker optimization enabled",
  "set.tuningOff": "Restored system defaults",
  "set.tuningHint": "Config: {path}. If you get no sound after connecting, or it sounds muffled, turn this on and reconnect.",
  "set.pairing": "Pairing",
  "set.pairingHint": "The pairing agent answers requests from your phone. If the phone shows a code but the Deck does nothing, restart it here.",
  "set.agentReady": "Pairing agent ready",
  "set.agentRunning": "Agent running, registration unconfirmed",
  "set.agentDown": "Pairing agent not running",
  "set.restartAgent": "Restart agent",
  "set.focus": "Audio focus",
  "set.focusHint": "How phone audio and game audio share the speakers. Your system default output is never rewritten.",
  "set.focusCoexist": "Coexist with game",
  "set.focusCoexistDesc": "Both play, neither takes over (recommended)",
  "set.focusReceiver": "Receiver first",
  "set.focusReceiverDesc": "Prioritize phone audio quality, disable auto call-mode switch",
  "set.focusManual": "Manual",
  "set.focusManualDesc": "Plugin stays out of it, use the system volume panel",
  "set.codec": "Audio quality (codec)",
  "set.codecHint": "Bluetooth quality is mostly decided by the codec. SBC-XQ is a high-quality SBC variant: ~452 kbps vs 328, with almost no compatibility loss.",
  "set.codecCurrent": "Active codec: {codec}",
  "set.codecReconnect": "After changing the codec, disconnect and reconnect on your phone so it renegotiates.",
  "set.stutter": "Stutter / quality",
  "set.stutterWifi": "2.4 GHz Wi-Fi interference detected",
  "set.stutterWifiBody": "Bluetooth shares the 2.4 GHz radio with Wi-Fi — the top cause of audio stutter. Switching Wi-Fi to 5 GHz usually fixes it immediately.",
  "set.stutterOk": "Wi-Fi is on 5 GHz or not connected — no conflict with Bluetooth.",
  "set.fixStutter": "Fix stuttering",
  "set.diagStutter": "Diagnose",
  "set.stutterHint": "\"Fix stuttering\" switches to the anti-stutter latency profile (bigger buffer) and sets volume to 100%.",
  "set.latencyHint": "A2DP latency depends on codec and buffering. This trades battery / low latency / anti-stutter.",
  "set.outputsNow": "Current outputs:",
  "set.avdtpLimit": "The reverse is impossible: AVDTP (v1.3 §5.3) allows only one A2DP source device per adapter at a time.",
  "set.codecInfo": "Codec",
  "set.codecActive": "Active codec",
  "set.codecRole": "Direction",
  "set.defaultOutput": "Default output",
  "set.power": "Power saving",
  "set.powerHint": "Phones often stay connected after the music stops. Auto-disconnect keeps the radio free.",
  "set.silence": "Auto-disconnect after silence",
  "set.silenceOff": "Off",
  "set.silenceRemain": "({n}s left)",
  "set.normalize": "Volume normalization",
  "set.normalizeHint": "Track-to-track volume jumps are common. A baseline is recorded and jumps over 25% are flagged. Baseline: {base}",
  "set.normJumps": "{n} jumps detected",
  "set.normUnset": "not set",
  "set.setBaseline": "Use current volume",
  "set.resetBaseline": "Reset",
  "set.behavior": "Behavior",
  "set.autoStart": "Enter discoverable mode on load",
  "set.autoStartDesc": "Turn Bluetooth on automatically when Decky loads",
  "set.keepAlive": "Stay discoverable",
  "set.keepAliveDesc": "BlueZ hides the adapter after 180s by default; re-checked every minute",
  "set.resume": "Restore after sleep",
  "set.resumeDescOn": "Watching ({backend}): restores discoverable and reconnects the last device",
  "set.resumeDescOff": "Listen for suspend/resume and restore Bluetooth state (closing the lid won't drop the link)",
  "set.resumeEvents": "{n} suspend/resume events captured, last: {last}",
  "set.lastDevice": "last device {mac}",
  "set.sysinfo": "System info",
  "set.multiOutput": "Deck multi-output",
  "set.multiOutputDesc": "Play to speakers + BT headset + wired headset at once.",
  "set.multiOn": "multi-output on",
  "set.multiOff": "multi-output off",
  "set.resample": "resample {hz} Hz",
  "set.tooSlow": "client too slow x{n}",
  "set.noTooSlow": "no client too slow in log",
  "set.profileLabel": "Profile: {name}",
  "set.versionsLabel": "PipeWire {pw} / WirePlumber {wp} / BlueZ {bz}",

  // EQ
  "eq.presets": "Presets",
  "eq.hint": "Uses PipeWire's built-in param_eq (no external plugins). Switching restarts PipeWire — expect a second of silence.",
  "eq.bands": "{n} bands",

  // EQ 预设（后端只返回 key，这里翻译）
  "eq.flat": "Flat (off)",
  "eq.flatDesc": "No change to the sound",
  "eq.bass": "Bass boost",
  "eq.bassDesc": "Fills in the thin low end of the Deck speakers — good for pop / electronic",
  "eq.vocal": "Vocal clarity",
  "eq.vocalDesc": "Lifts the midrange and cuts muddy lows — good for podcasts / audiobooks / meetings",
  "eq.bright": "Bright & open",
  "eq.brightDesc": "Adds high-frequency detail — good for classical / acoustic",
  "eq.loudness": "Loudness compensation",
  "eq.loudnessDesc": "Boosts lows and highs at low volume (equal-loudness curve) — for late-night listening",

  // 音质预设（codec）
  "codec.balanced": "Balanced (recommended)",
  "codec.balancedDesc": "SBC-XQ + AAC, a good trade-off between quality and compatibility",
  "codec.quality": "Quality first",
  "codec.qualityDesc": "Prefers high-bitrate codecs (LDAC / aptX HD / AAC); may stutter on a weak link",
  "codec.stable": "Stability first",
  "codec.stableDesc": "SBC only — lower bitrate, strong interference resistance, average quality",

  // 延迟档位
  "lat.low": "Low latency",
  "lat.lowDesc": "Small buffer, better lip-sync for video; may stutter under heavy Wi-Fi interference",
  "lat.balanced": "Balanced (recommended)",
  "lat.balancedDesc": "Default — balances stability and latency",
  "lat.stable": "Anti-stutter",
  "lat.stableDesc": "Large buffer, steadier under interference; noticeably higher latency",
  "eq.custom": "Custom (AutoEQ import)",
  "eq.customActive": "Using imported curve",
  "eq.active": "Active",
  "eq.import": "Import AutoEQ / Squiglink curve",
  "eq.importHint": "Copy the contents of ParametricEQ.txt from AutoEq or squig.link and paste it here. Format: `Filter 1: ON PK Fc 21 Hz Gain 6.7 dB Q 1.100`.",
  "eq.configPath": "Config file:",
  "eq.paste": "Paste curve…",
  "eq.collapse": "Collapse",
  "eq.removeEq": "Remove EQ entirely",
  "eq.applyImport": "Import and apply",
  "eq.importing": "Importing…",
  "eq.applied": "EQ switched",
  "eq.appliedBody": "PipeWire restarted, there may be a second of silence",
  "eq.imported": "Imported {n} EQ bands",
  "eq.skipped": "skipped {n} unrecognized lines",

  // 诊断
  "diag.checks": "Self-check",
  "diag.modules": "Backend modules",
  "diag.tools": "Command availability",
  "diag.adapterRaw": "Raw adapter info",
  "diag.wpStatus": "Audio status",
  "diag.report": "Full report",
  "diag.copy": "Copy diagnostic report",
  "diag.copied": "Report copied",
  "diag.copiedBody": "Paste it to the author",
  "diag.generated": "Report generated",
  "diag.generatedBody": "Select and copy below",
  "diag.viewLog": "View log",
  "diag.pluginLog": "Plugin log",
  "diag.agent": "Pairing agent",
  "diag.composition": "Steam UI composition layer",
  "diag.compOk": "Overlay can cover the top bar",
  "diag.compMissing": "Unavailable (older loader) - the top bar may stay visible while dimmed",

  // 自检项（后端只返回 key，这里翻译）
  "chk.bluetoothctl": "bluetoothctl available",
  "chk.busctl": "busctl available",
  "chk.wpctl": "wpctl available",
  "chk.adapter": "Bluetooth adapter detected",
  "chk.a2dpSink": "Adapter supports A2DP Sink",
  "chk.powered": "Bluetooth is powered on",
  "chk.agent": "Pairing agent running",
  "chk.discoverable": "Discoverable",
  "chk.pipewireSink": "PipeWire has an audio output",
  "chk.pwVersion": "PipeWire version readable",
  "chk.wpVersion": "WirePlumber version readable",
  "chk.modules": "All backend modules loaded",
  "chk.inhibit": "systemd-inhibit available (keeps Bluetooth alive while screen is off)",

  // Toast
  "toast.failed": "Operation failed",
  "toast.saveFailed": "Save failed",
  "toast.switchFailed": "Switch failed",
  "toast.nameChanged": "Device name set to {name}",
  "toast.renameFailed": "Rename failed",
};

const ZH: Dict = {
  "common.ok": "确定",

  "common.save": "保存",
  "common.saving": "保存中…",
  "common.remove": "移除",
  "common.retry": "重试",
  "common.reading": "读取中…",
  "common.none": "无",
  "common.unknown": "未知",
  "common.empty": "（空）",

  "plugin.name": "蓝牙音箱",

  "qam.btOn": "蓝牙已开",
  "qam.btOff": "蓝牙已关",
  "qam.discoverable": "可被发现",
  "qam.notVisible": "不可见",
  "qam.connectedCount": "{n} 台已连接",
  "qam.allowDiscover": "允许设备发现并连接",
  "qam.allowDiscoverDescOn": "手机 / 电脑的蓝牙列表里能看到这台 Deck",
  "qam.allowDiscoverDescOff": "打开后其它设备才能搜到",
  "qam.turnOnBt": "打开蓝牙",
  "qam.unblockRfkill": "解除射频阻挡（需要 sudo）",
  "qam.rfkillHard": "蓝牙被硬件开关阻挡（Hard blocked），软件解不了，请重启 Deck。",
  "qam.rfkillSoft": "蓝牙被射频开关阻挡了（Soft blocked），这是打不开蓝牙最常见的原因。",
  "qam.playing": "正在播放：{name}",
  "qam.externalSource": "外部音源",
  "qam.noTrackInfo": "对端设备未提供曲目信息",
  "qam.disconnect": "断开",
  "qam.volume": "音量",
  "qam.volumeHint": "精确数值请用 Steam 音量键",
  "qam.mute": "静音",
  "qam.unmute": "取消静音",

  "qam.boostHint": "直接设置绝对音量（不需要读取当前值）：",

  "qam.boosted100": "音量已设为 100%",
  "qam.boosted130": "音量已设为 130%",
  "qam.boosted150": "音量已设为 150%",
  "qam.boosted200": "音量已设为 200%（可能破音）",
  "qam.hintFind": "在手机的「蓝牙」里找 {alias}，配对后直接放歌即可～",
  "qam.manage": "设备管理 / 设置",
  "qam.dimScreen": "息屏当音箱（继续播放）",

  "qam.dimFailed": "无法关闭屏幕",
  "qam.inhibitFailed": "息屏期间蓝牙可能会断",
  "qam.inhibitFailedBody": "插件没能阻止系统自动休眠。闲置计时器走完 Deck 会睡下去，音频链路随之断开。请在 Steam > 设置 > 电源 里关掉「闲置后休眠」，或检查 systemd-inhibit 权限。",
  "qam.dimKeepAwake": "息屏期间已阻止系统自动休眠",
  "qam.dimScreenHint": "息屏后会保持唤醒，音频链路不会断。",
  "qam.playingLabel": "正在播放",
  "qam.connectedLabel": "已连接",
  "qam.negotiating": "正在协商音频（A2DP）…",
  "qam.negotiatingHint": "蓝牙链路已连上，但音频 profile 还在协商。通常 1~6 秒后你的设备上才会出现这台 Deck 作为音箱。稍等一下就好。",
  "qam.a2dpForce": "强制切到 A2DP 接收模式",
  "qam.a2dpFixed": "已切到 A2DP 接收模式",
  "qam.a2dpFixFailed": "切换 profile 失败",

  "page.title": "蓝牙音箱",
  "page.readingAdapter": "正在读取蓝牙适配器…",
  "page.a2dpSink": "A2DP Sink",
  "page.noSink": "无 Sink 角色",
  "tab.devices": "已配对设备",
  "tab.settings": "设置",
  "tab.eq": "均衡器",
  "tab.diag": "诊断",

  "dev.search": "搜索附近设备",
  "dev.searchHint": "流式扫描：搜到一个显示一个。再点一次可提前停止。",
  "dev.searchHintWarn": "建议先在 QAM 里打开「允许设备发现并连接」，否则对方可能搜不到这台 Deck。",

  "dev.stopScan": "停止",
  "dev.foundCount": "已找到 {n} 个",
  "dev.showUnnamed": "显示没有名称的设备",
  "dev.showUnnamedDesc": "不广播名称的设备会用「类型 + MAC 后缀」标注。关掉可以过滤杂项。",
  "dev.hiddenCount": "已隐藏 {n} 个无名称设备",
  "dev.hiddenPaired": "已隐藏 {n} 个无名称的已配对设备",
  "dev.allHidden": "找到的 {n} 个设备都没有名称。打开「显示没有名称的设备」即可看到。",
  "dev.pair": "配对",
  "dev.pairing": "配对中…",
  "dev.paired": "已配对 {name}",
  "dev.pairFailed": "配对失败",
  "dev.noneFound": "没搜到未配对的设备。可能是：手机已经配过这台 Deck、或手机蓝牙没打开、或对方不可被发现。",
  "dev.noDevices": "还没有配对过任何设备。用上面的「搜索附近设备」找到手机后点「配对」即可，不用退出插件去系统蓝牙设置。",
  "dev.pairedCount": "已配对（{n}）",
  "dev.connected": "已连接",

  "dev.connect": "连接",

  "dev.disconnected": "已断开",
  "dev.repair": "修复配对",
  "dev.repairing": "正在修复配对…",
  "dev.removed": "已移除配对",
  "dev.noName": "设备未广播名称",
  "dev.unknownLabel": "未知设备 · {mac}",

  "dev.untrusted": "未信任",
  "dev.blocked": "已拉黑",
  "dev.trust": "信任",
  "dev.untrust": "取消信任",
  "dev.trustedOn": "已信任 —— 允许自动重连",
  "dev.trustedOff": "已取消信任 —— 禁止自动重连",
  "dev.connectedToast": "已连接 {name}",
  "dev.connectFailed": "连接失败",
  "dev.hint": "连接成功后在手机上播放音乐，声音就会从 Deck 的喇叭出来。同一时间只能有一个源在放（蓝牙 A2DP 的限制）。",
  "dev.hintPair": "配对码 / 通行密钥不正确？点「修复配对」——它会清除 Deck 端保存的旧绑定密钥再重新配对。如果仍失败，请在手机端也「忘记」这个设备后重新搜索。",

  "set.name": "设备名",
  "set.nameHint": "别人蓝牙列表里看到的名字。建议改成一个好认的名字。",
  "set.audioTuning": "音箱优化",
  "set.audioTuningLabel": "启用「音箱优化」配置",
  "set.audioTuningDesc": "写入用户级 WirePlumber 配置：只保留 A2DP 角色、外部推流直出、避免掉成通话单声道。改完会自动重启 WirePlumber。",
  "set.tuningOn": "已启用音箱优化",
  "set.tuningOff": "已恢复系统默认",
  "set.tuningHint": "配置文件：{path}。连上了却没声音、或者声音变成单声道发闷时，打开它再重连一次通常就好了。",
  "set.pairing": "配对",
  "set.pairingHint": "配对 agent 负责应答手机的配对请求。如果手机弹了配对码但 Deck 没反应，说明 agent 没工作，点下面的按钮重启它再试。",
  "set.agentReady": "配对 agent 已就绪",
  "set.agentRunning": "配对 agent 运行中，但未确认注册",
  "set.agentDown": "配对 agent 未运行",
  "set.restartAgent": "重启 agent",
  "set.focus": "音频焦点",
  "set.focusHint": "决定「手机推流」和「Deck 游戏声音」怎么共存。不会改写你的系统默认输出。",
  "set.focusCoexist": "与游戏共存",
  "set.focusCoexistDesc": "两者都出声，互不抢占（推荐）",
  "set.focusReceiver": "接收端优先",
  "set.focusReceiverDesc": "优先保证手机推流音质，关闭自动切通话模式",
  "set.focusManual": "手动",
  "set.focusManualDesc": "插件不插手，完全自己用系统音量面板调",
  "set.codec": "音质（编码器）",
  "set.codecHint": "蓝牙音质主要由编码器决定。SBC-XQ 是普通 SBC 的高质量变体，码率从 328 提到约 452 kbps，兼容性几乎无损失，是最划算的提升。",
  "set.codecCurrent": "当前实际编码器：{codec}",
  "set.codecReconnect": "改完编码器后，需要在手机上断开重连一次才会重新协商。",
  "set.stutter": "卡顿 / 音质",
  "set.stutterWifi": "检测到 2.4GHz Wi-Fi 干扰",
  "set.stutterWifiBody": "蓝牙与 2.4GHz Wi-Fi 共用同一个射频，这是音频卡顿的头号原因。把 Wi-Fi 切到 5GHz 通常能立刻解决。",
  "set.stutterOk": "Wi-Fi 在 5GHz 或未连接，与蓝牙不冲突。",
  "set.fixStutter": "一键抗卡顿",
  "set.diagStutter": "诊断卡顿",
  "set.stutterHint": "「一键抗卡顿」会把延迟档位切到抗卡顿（加大缓冲）并把音量拉到 100%。",
  "set.latencyHint": "蓝牙 A2DP 的延迟取决于编码器与缓冲。这里是「省电 / 低延迟 / 抗卡顿」的取舍。",
  "set.outputsNow": "当前输出设备：",
  "set.avdtpLimit": "⚠️ 反方向做不到：受 AVDTP 协议限制（v1.3 §5.3），同一适配器同一时刻只能有一个蓝牙 A2DP 源设备连进来。",
  "set.codecInfo": "编码器",
  "set.codecActive": "当前编码",
  "set.codecRole": "方向",
  "set.defaultOutput": "默认输出",
  "set.power": "省电",
  "set.powerHint": "手机放完歌常忘了断开，A2DP 链路会一直占着蓝牙射频。这里可以自动收尾。",
  "set.silence": "静音多久后自动断开",
  "set.silenceOff": "关闭",
  "set.silenceRemain": "（还有 {n} 秒）",
  "set.normalize": "音量归一化",
  "set.normalizeHint": "手机切歌时音量忽大忽小很常见。这里记录一个基线，跳变超过 25% 会提示。当前基线：{base}",
  "set.normJumps": "已检测到 {n} 次跳变",
  "set.normUnset": "未设置",
  "set.setBaseline": "以当前音量为准",
  "set.resetBaseline": "重置",
  "set.behavior": "行为",
  "set.autoStart": "插件加载时自动进入可被发现",
  "set.autoStartDesc": "打开 Decky 后自动开好蓝牙，省得每次手动点",
  "set.keepAlive": "保持可被发现",
  "set.keepAliveDesc": "BlueZ 默认 180 秒后自动隐藏，这里每分钟复查一次",
  "set.resume": "睡眠唤醒后自动恢复",
  "set.resumeDescOn": "已监听（{backend}）：唤醒后自动恢复可发现并重连上次的设备",
  "set.resumeDescOff": "监听 logind 的睡眠信号，唤醒后自动恢复蓝牙状态（合盖再开盖不会失联）",
  "set.resumeEvents": "已捕获 {n} 次睡眠/唤醒事件，最近一次：{last}",
  "set.lastDevice": "上次设备 {mac}",
  "set.sysinfo": "系统信息",
  "set.multiOutput": "Deck 多路输出",
  "set.multiOutputDesc": "同时输出到扬声器 + 蓝牙耳机 + 有线耳机。",
  "set.multiOn": "多路输出已开启",
  "set.multiOff": "多路输出已关闭",
  "set.resample": "重采样 {hz} Hz",
  "set.tooSlow": "客户端过慢 x{n}",
  "set.noTooSlow": "日志里没有客户端过慢记录",
  "set.profileLabel": "当前档位：{name}",
  "set.versionsLabel": "PipeWire {pw} / WirePlumber {wp} / BlueZ {bz}",

  "eq.presets": "预设",
  "eq.hint": "用 PipeWire 内置的 param_eq（不依赖任何外部插件）。切换会重启 PipeWire，可能有一两秒静音。",
  "eq.bands": "{n} 段",

  // EQ 预设
  "eq.flat": "平直（关闭）",
  "eq.flatDesc": "不改变音色",
  "eq.bass": "低音增强",
  "eq.bassDesc": "补 Deck 喇叭偏薄的低频，适合流行 / 电子",
  "eq.vocal": "人声清晰",
  "eq.vocalDesc": "抬中频、削低频浑浊，适合播客 / 有声书 / 会议",
  "eq.bright": "明亮通透",
  "eq.brightDesc": "抬高频细节，适合古典 / 原声乐器",
  "eq.loudness": "等响补偿",
  "eq.loudnessDesc": "小音量下补低频和高频（模拟等响曲线），夜间听歌用",

  // 音质预设
  "codec.balanced": "均衡（推荐）",
  "codec.balancedDesc": "SBC-XQ + AAC，音质与兼容性兼顾",
  "codec.quality": "音质优先",
  "codec.qualityDesc": "优先高码率编码器（LDAC / aptX HD / AAC），链路差时可能卡顿",
  "codec.stable": "稳定优先",
  "codec.stableDesc": "只用 SBC，码率低抗干扰强，音质一般",

  // 延迟档位
  "lat.low": "低延迟",
  "lat.lowDesc": "缓冲小，看视频口型更同步；Wi-Fi 干扰大时可能卡顿",
  "lat.balanced": "均衡（推荐）",
  "lat.balancedDesc": "默认档位，兼顾稳定性与延迟",
  "lat.stable": "抗卡顿",
  "lat.stableDesc": "缓冲大，干扰环境下更稳；延迟会明显增加",
  "eq.custom": "自定义（AutoEQ 导入）",
  "eq.customActive": "当前正在使用导入的曲线",
  "eq.active": "生效中",
  "eq.import": "导入 AutoEQ / Squiglink 曲线",
  "eq.importHint": "从 AutoEq 或 squig.link 复制 ParametricEQ.txt 的内容粘进来。格式形如 `Filter 1: ON PK Fc 21 Hz Gain 6.7 dB Q 1.100`。",
  "eq.configPath": "配置文件：",
  "eq.paste": "粘贴曲线…",
  "eq.collapse": "收起",
  "eq.removeEq": "完全移除 EQ",
  "eq.applyImport": "导入并应用",
  "eq.importing": "导入中…",
  "eq.applied": "均衡器已切换",
  "eq.appliedBody": "PipeWire 已重启，可能有一两秒静音",
  "eq.imported": "已导入 {n} 段 EQ",
  "eq.skipped": "跳过 {n} 行无法识别",

  "diag.checks": "自检",
  "diag.modules": "后端模块",
  "diag.tools": "命令可用性",
  "diag.adapterRaw": "适配器原始信息",
  "diag.wpStatus": "音频状态",
  "diag.report": "完整报告",
  "diag.copy": "复制诊断报告",
  "diag.copied": "诊断报告已复制",
  "diag.copiedBody": "直接粘贴给作者即可",
  "diag.generated": "报告已生成",
  "diag.generatedBody": "下面可手动选中复制",
  "diag.viewLog": "查看日志",
  "diag.pluginLog": "插件日志",
  "diag.agent": "配对 agent",
  "diag.composition": "Steam UI 合成层",
  "diag.compOk": "遮罩可以盖住顶栏",
  "diag.compMissing": "不可用（loader 版本较旧）—— 息屏时顶栏可能还露着",

  // 自检项
  "chk.bluetoothctl": "bluetoothctl 可用",
  "chk.busctl": "busctl 可用",
  "chk.wpctl": "wpctl 可用",
  "chk.adapter": "检测到蓝牙适配器",
  "chk.a2dpSink": "适配器支持 A2DP Sink",
  "chk.powered": "蓝牙已上电",
  "chk.agent": "配对 agent 在运行",
  "chk.discoverable": "可被发现",
  "chk.pipewireSink": "PipeWire 有音频输出",
  "chk.pwVersion": "PipeWire 版本可读",
  "chk.wpVersion": "WirePlumber 版本可读",
  "chk.modules": "后端模块全部加载",
  "chk.inhibit": "systemd-inhibit 可用（息屏时保持蓝牙不断）",

  "toast.failed": "操作失败",
  "toast.saveFailed": "保存失败",
  "toast.switchFailed": "切换失败",
  "toast.nameChanged": "设备名已改为 {name}",
  "toast.renameFailed": "改名失败",
};

const DICTS: Record<Lang, Dict> = { en: EN, zh: ZH };

/** 把各种语言标识归一化成我们支持的两种。 */
export function normalizeLang(raw: string | undefined | null): Lang {
  const s = (raw || "").toLowerCase().trim();
  if (!s) return "en";
  // Steam 用的是 schinese / tchinese，浏览器是 zh-CN / zh-TW
  if (s.includes("schinese") || s.includes("tchinese") || s.startsWith("zh")) return "zh";
  return "en";
}

/** 探测当前语言。 */
export function detectLang(): Lang {
  // 1. Steam 客户端语言（最准）
  try {
    const sc: any = (globalThis as any).SteamClient;
    const v = sc?.Settings?.GetLanguage?.();
    if (typeof v === "string" && v) return normalizeLang(v);
  } catch {
    /* ignore */
  }
  // 2. 浏览器 / CEF 语言
  try {
    const nav = (globalThis as any).navigator;
    const v = nav?.language || nav?.languages?.[0];
    if (typeof v === "string" && v) return normalizeLang(v);
  } catch {
    /* ignore */
  }
  // 3. 兜底
  return "en";
}

let _lang: Lang | null = null;

export function getLang(): Lang {
  if (_lang === null) _lang = detectLang();
  return _lang;
}

/**
 * 取翻译。支持 `{name}` 占位符。
 *
 * 用法：t("qam.connectedCount", { n: 2 })
 */
export function t(key: string, vars?: Record<string, string | number>): string {
  const lang = getLang();
  const dict = DICTS[lang] || EN;
  let s = dict[key];
  // 缺翻译时回退英文，再回退 key 本身（方便发现漏翻）
  if (s === undefined) s = EN[key];
  if (s === undefined) return key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      s = s.split("{" + k + "}").join(String(v));
    }
  }
  return s;
}

/** 当前语言是否中文（少数需要条件分支的地方用）。 */
export function isZh(): boolean {
  return getLang() === "zh";
}

/** 供调试：列出所有 key。 */
export function allKeys(): string[] {
  return Object.keys(EN);
}
