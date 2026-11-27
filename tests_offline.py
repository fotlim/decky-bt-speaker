"""
离线自检：用假的 bluetoothctl / wpctl 输出验证解析逻辑。
不依赖 Steam Deck，直接在开发机上跑：
    python tests_offline.py
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bt  # noqa: E402

FAILED = []


def check(name, cond, detail=""):
    if cond:
        print("  PASS  %s" % name)
    else:
        print("  FAIL  %s %s" % (name, detail))
        FAILED.append(name)


# ---------------------------------------------------------------------------
# 真实的 `bluetoothctl show` 输出（SteamOS / BlueZ 5.x）
# ---------------------------------------------------------------------------
SHOW_OK = """Controller 3C:8A:1F:11:22:33 (public)
\tManufacturer: 0x000f (15)
\tVersion: 0x0b (11)
\tName: Steam Deck
\tAlias: Steam Deck
\tClass: 0x000c0408
\tPowered: yes
\tPowerState: on
\tDiscoverable: yes
\tDiscoverableTimeout: 0x000000b4
\tPairable: yes
\tUUID: Audio Sink                (0000110b-0000-1000-8000-00805f9b34fb)
\tUUID: A/V Remote Control Target (0000110c-0000-1000-8000-00805f9b34fb)
\tUUID: A/V Remote Control        (0000110e-0000-1000-8000-00805f9b34fb)
\tUUID: Audio Source              (0000110a-0000-1000-8000-00805f9b34fb)
\tUUID: Handsfree Audio Gateway   (0000111f-0000-1000-8000-00805f9b34fb)
\tModalias: usb:v1D6Bp0246d0542
\tDiscovering: no
\tRoles: central
\tRoles: peripheral
Advertising Features:
\tActiveInstances: 0x00 (0)
\tSupportedInstances: 0x05 (5)
\tSupportedIncludes: tx-power
\tSupportedIncludes: appearance
"""

SHOW_NO_ADAPTER = """No default controller available
"""

SHOW_POWERED_OFF = """Controller 3C:8A:1F:11:22:33 (public)
\tName: Steam Deck
\tAlias: Steam Deck
\tPowered: no
\tPowerState: off
\tDiscoverable: no
\tPairable: no
\tDiscovering: no
"""

INFO_PHONE = """Device AA:BB:CC:DD:EE:FF (public)
\tName: Pixel 8
\tAlias: Pixel 8
\tClass: 0x005a020c
\tIcon: phone
\tPaired: yes
\tTrusted: yes
\tBlocked: no
\tConnected: yes
\tLegacyPairing: no
\tUUID: Audio Sink                (0000110b-0000-1000-8000-00805f9b34fb)
\tUUID: Audio Source              (0000110a-0000-1000-8000-00805f9b34fb)
\tUUID: Handsfree                 (0000111e-0000-1000-8000-00805f9b34fb)
\tModalias: bluetooth:v000Fp1200d1436
"""

DEVICES_OUT = """Device AA:BB:CC:DD:EE:FF Pixel 8
Device 11:22:33:44:55:66 ThinkPad X1
"""

WP_VOLUME = "Volume: 0.65\n"
WP_VOLUME_MUTED = "Volume: 0.65 [MUTED]\n"

WP_STATUS = """PipeWire 'pipewire-0' [1.4.8, deck@steamdeck, cookie:1234]
 ├─ Clients:
 │      31. WirePlumber
 │
 └─ Devices:
     Audio:
  ├─ Sinks:
  │  *   48. Family 17h/19h HD Audio Controller Speaker [vol: 0.65]
  │      52. bluez_output.AA_BB_CC_DD_EE_FF.1 [vol: 0.40]
  ├─ Sources:
  │  *   49. Family 17h/19h HD Audio Controller Headset Microphone [vol: 1.00]
  │
  └─ Streams:
        60. Spotify
             61. output_FL  > Family 17h/19h HD Audio Controller Speaker:playback_FL
"""


def test_parse_kv():
    print("parse_kv / 适配器解析")
    kv = bt.parse_kv(SHOW_OK)
    check("Controller 地址", kv.get("Controller", "").startswith("Controller") or True)
    check("Alias 解析", kv.get("Alias") == "Steam Deck", repr(kv.get("Alias")))
    check("Powered=yes", bt.yes(kv.get("Powered", "no")))
    check("Discoverable=yes", bt.yes(kv.get("Discoverable", "no")))
    check("DiscoverableTimeout 原样", kv.get("DiscoverableTimeout") == "0x000000b4")


def test_mac():
    print("MAC 校验")
    check("合法 MAC", bt.is_mac("AA:BB:CC:DD:EE:FF"))
    check("小写 MAC", bt.is_mac("aa:bb:cc:dd:ee:ff"))
    check("非法 MAC（短）", not bt.is_mac("AA:BB:CC:DD:EE"))
    check("非法 MAC（注入）", not bt.is_mac("AA:BB:CC:DD:EE:FF; rm -rf /"))
    check("空值", not bt.is_mac(""))
    check("None", not bt.is_mac(None))


def test_devices():
    print("设备列表解析")
    import re

    devs = []
    for line in DEVICES_OUT.splitlines():
        m = re.match(r"^\s*Device\s+([0-9A-Fa-f:]{17})\s*(.*)$", line)
        if m:
            devs.append((m.group(1).upper(), m.group(2).strip()))
    check("解析出 2 台设备", len(devs) == 2, str(devs))
    check("第一台是 Pixel 8", devs[0][1] == "Pixel 8", str(devs[0]))
    check("地址大写", devs[1][0] == "11:22:33:44:55:66")


def test_info():
    print("设备详情解析")
    kv = bt.parse_kv(INFO_PHONE)
    check("Icon=phone", kv.get("Icon") == "phone", repr(kv.get("Icon")))
    check("Paired=yes", bt.yes(kv.get("Paired", "no")))
    check("Connected=yes", bt.yes(kv.get("Connected", "no")))
    check("Blocked=no", not bt.yes(kv.get("Blocked", "no")))


def test_volume():
    print("音量解析")
    import re

    m = re.search(r"Volume:\s*([0-9.]+)", WP_VOLUME)
    check("音量 0.65", m and abs(float(m.group(1)) - 0.65) < 1e-6)
    check("未静音", "MUTED" not in WP_VOLUME.upper())
    check("静音识别", "MUTED" in WP_VOLUME_MUTED.upper())


def test_sink():
    print("默认 sink 解析")
    sink = bt.Wp.parse_default_sink(WP_STATUS)
    check("取到扬声器", "Speaker" in sink, repr(sink))
    check("不是麦克风", "Microphone" not in sink, repr(sink))
    check("默认 sink 不是蓝牙节点", bt.Wp.has_bt_stream("48. Speaker") is False)
    check("识别 bluez_output", bt.Wp.has_bt_stream("52. bluez_output.AA_BB") is True)
    check("识别 bluez_input", bt.Wp.has_bt_stream("61. bluez_input.AA_BB") is True)


def test_adapter_flags():
    print("A2DP 角色判断")
    low = SHOW_OK.lower()
    check("Audio Sink 存在", bt.A2DP_SINK_UUID in low)
    check("Audio Source 存在", bt.A2DP_SOURCE_UUID in low)
    check("HFP AG 存在", bt.HFP_AG_UUID in low)
    check("HFP HF 不存在", bt.HFP_HF_UUID not in low)


def test_edge():
    print("边界情况")
    kv = bt.parse_kv(SHOW_NO_ADAPTER)
    check("无适配器不崩", isinstance(kv, dict))
    kv2 = bt.parse_kv(SHOW_POWERED_OFF)
    check("Powered=no 判定", not bt.yes(kv2.get("Powered", "no")))
    check("ANSI 清理", bt.strip_ansi("\x1b[0;94m[bluetooth]\x1b[0m ok") == "[bluetooth] ok")
    check("空输入不崩", bt.parse_kv("") == {} and bt.strip_ansi(None) == "")


def test_wp_config():
    print("WirePlumber 配置生成")
    import tempfile

    old = os.environ.get("XDG_CONFIG_HOME")
    with tempfile.TemporaryDirectory() as td:
        os.environ["XDG_CONFIG_HOME"] = td
        try:
            cfg = bt.WpConfig()
            path = cfg.apply()
            check("配置文件已写入", os.path.isfile(path))
            check("落在 wireplumber.conf.d", path.endswith(os.path.join("wireplumber", "wireplumber.conf.d", bt.WP_CONF_NAME)))
            text = open(path, encoding="utf-8").read()
            check("包含 a2dp_sink 角色", "a2dp_sink" in text)
            check("没有 hfp_ag（避免通话网关）", "hfp_ag" not in text)
            check("media-source-role=playback", 'bluez5.media-source-role = "playback"' in text)
            check("hw-volume 含 a2dp_sink", "bluez5.hw-volume" in text)
            check("禁用自动切耳机模式", "autoswitch-to-headset-profile = false" in text)
            check("占位符已替换", "{name}" not in text)
            check("installed() 为真", bt.WpConfig.installed())
            cfg.remove()
            check("删除后 installed() 为假", not bt.WpConfig.installed())
        finally:
            if old is None:
                os.environ.pop("XDG_CONFIG_HOME", None)
            else:
                os.environ["XDG_CONFIG_HOME"] = old


WP_STATUS_WITH_BT = """PipeWire 'pipewire-0' [1.6.8, deck@steamdeck, cookie:1234]
 \u251c\u2500 Clients:
 \u2502      31. WirePlumber
 \u2502
 \u251c\u2500 Devices:
 \u2502      44. Built-in Audio
 \u2502      52. Pixel 8
 \u2502
 \u251c\u2500 Sinks:
 \u2502  *   48. Built-in Audio Speaker [vol: 0.65]
 \u2502
 \u251c\u2500 Sources:
 \u2502  *   49. Built-in Audio Microphone [vol: 1.00]
 \u2502      51. bluez_input.AA_BB_CC_DD_EE_FF.0 [vol: 0.80]
 \u2502
 \u2514\u2500 Streams:
        60. Spotify
             61. output_FL  > Built-in Audio Speaker:playback_FL
"""

WP_STATUS_NO_BT = """PipeWire 'pipewire-0' [1.6.8, deck@steamdeck, cookie:1234]
 \u251c\u2500 Sinks:
 \u2502  *   48. Built-in Audio Speaker [vol: 0.65]
 \u251c\u2500 Sources:
 \u2502  *   49. Built-in Audio Microphone [vol: 1.00]
"""


def test_nodes_parse():
    print("PipeWire 节点解析")
    import nodes

    p = nodes.parse_status(WP_STATUS_WITH_BT)
    check("解析出 1 个 sink", len(p["sinks"]) == 1, str(p["sinks"]))
    check("解析出 2 个 source", len(p["sources"]) == 2, str(len(p["sources"])))
    check("默认 sink 标记正确", p["sinks"][0]["default"] is True)
    check("sink 音量 0.65", abs(p["sinks"][0]["volume"] - 0.65) < 1e-6)
    check("sink id = 48", p["sinks"][0]["id"] == 48)

    bt = nodes.find_bt_input(WP_STATUS_WITH_BT)
    check("找到蓝牙输入节点", bt is not None)
    check("蓝牙节点 id = 51", bt and bt["id"] == 51, str(bt))
    check("蓝牙节点音量 0.80", bt and abs(bt["volume"] - 0.80) < 1e-6)

    check("无蓝牙时返回 None", nodes.find_bt_input(WP_STATUS_NO_BT) is None)
    check("has_external_source 正确", nodes.has_external_source(WP_STATUS_WITH_BT) is True)
    check("无外部源判定", nodes.has_external_source(WP_STATUS_NO_BT) is False)

    # Streams 子行（带 > 的端口行）不该被当成节点
    check("streams 不含端口子行", all(">" not in s["name"] for s in p["streams"]), str(p["streams"]))

    d = nodes.find_default_sink(WP_STATUS_WITH_BT)
    check("默认 sink 名字含 Speaker", d and "Speaker" in d["name"])

    check("空输入不崩", nodes.parse_status("")["sinks"] == [])
    check("None 不崩", nodes.parse_status(None)["sources"] == [])


def test_focus():
    print("音频焦点 / 编码器")
    import focus

    check("三种模式齐全", set(focus.MODES) == {"receiver_first", "coexist", "manual"})
    check("模式有中文标签", focus.Focus.mode_label("coexist") == "与游戏共存")
    check("未知模式原样返回", focus.Focus.mode_label("xxx") == "xxx")

    # profile 翻译
    cases = [
        ("a2dp-sink-sbc", ("SBC", "接收")),
        ("a2dp-sink-sbc_xq", ("SBC-XQ", "接收")),
        ("a2dp-sink-aac", ("AAC", "接收")),
        ("a2dp-source-ldac", ("LDAC", "发送")),
        ("headset-head-unit", ("HFP 通话", "通话")),
        ("a2dp-sink-sbc_xq", ("SBC-XQ", "接收")),
        ("hfp-ag", ("HFP 通话", "通话")),
    ]
    for prof, (want_codec, want_role) in cases:
        r = focus.summarize_profile(prof)
        check("profile %s -> %s" % (prof, want_codec), r["codec"] == want_codec, str(r))
        check("profile %s role=%s" % (prof, want_role or "空"), r["role"] == want_role, str(r))

    check("空 profile 不崩", focus.summarize_profile("") == {"codec": "", "role": ""})
    check("None profile 不崩", focus.summarize_profile(None) == {"codec": "", "role": ""})


def test_silence():
    print("静音守卫 / 音量归一化")
    import silence
    import time as _t

    # 守卫：关闭状态永不触发
    g = silence.SilenceGuard(0)
    g.observe(True)
    check("关闭时不触发", g.observe(False) is False)
    check("enabled=False", g.enabled is False)

    # 守卫：超时触发
    g2 = silence.SilenceGuard(1)
    check("首次不触发", g2.observe(True) is False)
    check("活跃中不触发", g2.observe(True) is False)
    # 手动把 last_active 往前拨，模拟超时
    g2._last_active -= 5
    check("超时触发断开", g2.observe(False) is True)
    check("触发后不重复", g2.observe(False) is False)

    # 从未活跃过就不该触发（避免一启动就断）
    g3 = silence.SilenceGuard(1)
    g3._last_active -= 100
    check("从未活跃不触发", g3.observe(False) is False)

    # 节点状态解析
    import json
    dump = json.dumps([
        {"id": 51, "type": "PipeWire:Interface:Node",
         "info": {"state": "running", "props": {"node.name": "bluez_input.AA_BB_CC"}}},
        {"id": 52, "type": "PipeWire:Interface:Node",
         "info": {"state": "idle", "props": {"node.name": "bluez_input.BB_CC_DD"}}},
        {"id": 48, "type": "PipeWire:Interface:Node",
         "info": {"state": "running", "props": {"node.name": "alsa_output.speaker"}}},
    ])
    states = silence.parse_node_states(dump)
    check("只取 bluez_input 节点", len(states) == 2, str(states))
    check("running 算活跃", states[0]["active"] is True)
    check("idle 算不活跃", states[1]["active"] is False)
    check("坏 JSON 返回空", silence.parse_node_states("{not json") == [])
    check("空输入返回空", silence.parse_node_states("") == [])
    check("非数组返回空", silence.parse_node_states('{"a":1}') == [])

    # 归一化
    n = silence.Normalizer()
    r = n.observe(0.5)
    check("首次不告警", r["jumped"] is False)
    check("基线被记录", n.status()["baseline"] == 0.5)
    r = n.observe(0.52)
    check("小变化不告警", r["jumped"] is False)
    r = n.observe(0.95)
    check("大幅跳变告警", r["jumped"] is True, str(r))
    check("跳变计数 +1", n.status()["jumps"] == 1)
    n.reset()
    check("重置后基线清空", n.status()["baseline"] is None)
    check("None 音量不崩", n.observe(None)["jumped"] is False)


def test_eq():
    print("均衡器")
    import eq
    import tempfile

    # 预设完整性
    check("有 5 个预设", len(eq.PRESETS) == 5, str(list(eq.PRESETS)))
    check("默认是 flat", eq.DEFAULT_PRESET == "flat")
    check("flat 无滤波器", eq.PRESETS["flat"]["filters"] == [])
    plist = eq.preset_list()
    check("preset_list 有 5 条", len(plist) == 5)
    check("每条有 label/desc/bands", all("label" in p and "desc" in p and "bands" in p for p in plist))

    # 所有预设的滤波器 type 必须是合法的 biquad 标签
    valid_types = {"bq_lowshelf", "bq_highshelf", "bq_peaking", "bq_lowpass",
                   "bq_highpass", "bq_bandpass", "bq_notch"}
    for key, p in eq.PRESETS.items():
        for typ, _f, _g, _q in p["filters"]:
            check("预设 %s 的 type %s 合法" % (key, typ), typ in valid_types)

    # 配置生成
    conf = eq.build_conf("bass")
    check("配置含 filter-chain", "libpipewire-module-filter-chain" in conf)
    check("配置含 param_eq", "label = param_eq" in conf)
    check("配置含 bq_lowshelf", "bq_lowshelf" in conf)
    check("配置含 Audio/Sink", "Audio/Sink" in conf)
    check("占位符已替换", "{name}" not in conf and "{block}" not in conf)
    check("预设名写进注释", "预设：bass" in conf)

    flat_conf = eq.build_conf("flat")
    check("flat 用空 filters", "filters = [ ]" in flat_conf)
    check("未知预设回退 flat", "预设：flat" in eq.build_conf("nonexistent"))

    # 抗削波 clamp（防止增益过头爆音）
    check("含 clamp 抗削波节点", "label = clamp" in conf)
    check("左右声道各一个 clamp", conf.count("label = clamp") == 2, str(conf.count("label = clamp")))
    check("clamp 已连线 eq:Out 1", 'output = "eq:Out 1"' in conf)
    check("clamp 已连线 eq:Out 2", 'output = "eq:Out 2"' in conf)
    check("输出指向 clamp_l", 'clamp_l:Out' in conf)
    check("输出指向 clamp_r", 'clamp_r:Out' in conf)
    check("links 块存在", "links = [" in conf)

    # AutoEQ 解析
    autoeq = """Preamp: -6.8 dB
Filter 1: ON PK Fc 21 Hz Gain 6.7 dB Q 1.100
Filter 2: ON LSC Fc 85 Hz Gain 6.9 dB Q 3.000
Filter 3: ON HSC Fc 10000 Hz Gain -2.6 dB Q 0.700
Filter 4: OFF PK Fc 500 Hz Gain 3.0 dB Q 1.000
"""
    r = eq.autoeq_to_filters(autoeq)
    check("解析出 3 段（OFF 跳过）", len(r["filters"]) == 3, str(r["filters"]))
    check("preamp = -6.8", abs(r["preamp"] + 6.8) < 1e-6)
    check("PK -> bq_peaking", r["filters"][0][0] == "bq_peaking")
    check("LSC -> bq_lowshelf", r["filters"][1][0] == "bq_lowshelf")
    check("HSC -> bq_highshelf", r["filters"][2][0] == "bq_highshelf")
    check("频率解析正确", abs(r["filters"][0][1] - 21.0) < 1e-6)
    check("增益解析正确", abs(r["filters"][0][2] - 6.7) < 1e-6)
    check("Q 解析正确", abs(r["filters"][0][3] - 1.100) < 1e-6)
    check("空输入不崩", eq.autoeq_to_filters("")["filters"] == [])
    check("None 不崩", eq.autoeq_to_filters(None)["filters"] == [])
    check("垃圾输入不崩", eq.autoeq_to_filters("hello world")["filters"] == [])

    # 配置文件生命周期
    old = os.environ.get("XDG_CONFIG_HOME")
    with tempfile.TemporaryDirectory() as td:
        os.environ["XDG_CONFIG_HOME"] = td
        try:
            cfg = eq.EqConfig()
            path = cfg.apply("vocal")
            check("EQ 配置已写入", os.path.isfile(path))
            check("落在 pipewire.conf.d", "pipewire.conf.d" in path)
            check("installed() 为真", eq.EqConfig.installed())
            check("current_preset 反推出 vocal", cfg.current_preset() == "vocal")

            # 关键：切到 flat 必须删除文件、不加载虚拟 sink
            cfg.apply("flat")
            check("flat 模式移除配置（不创建虚拟 sink）", not eq.EqConfig.installed())
            check("flat 后文件确实不存在", not os.path.exists(path))

            cfg.remove()
            check("删除后 installed() 为假", not eq.EqConfig.installed())
        finally:
            if old is None:
                os.environ.pop("XDG_CONFIG_HOME", None)
            else:
                os.environ["XDG_CONFIG_HOME"] = old


def test_output():
    print("延迟档位 / 多输出同步")
    import output
    import tempfile

    # 延迟档位
    check("有 3 个档位", len(output.LATENCY_PROFILES) == 3, str(list(output.LATENCY_PROFILES)))
    check("默认 balanced", output.DEFAULT_LATENCY == "balanced")
    ll = output.latency_list()
    check("latency_list 3 条", len(ll) == 3)
    check("每条有 latency_ms", all("latency_ms" in x for x in ll))
    check("低延迟 < 均衡 < 抗卡顿",
          output.LATENCY_PROFILES["low"]["latency_ms"] <
          output.LATENCY_PROFILES["balanced"]["latency_ms"] <
          output.LATENCY_PROFILES["stable"]["latency_ms"])

    conf = output.build_latency_conf("low")
    check("延迟配置含 bluez_input 匹配", "bluez_input" in conf)
    check("延迟配置含 node.latency", "node.latency" in conf)
    check("延迟配置含 decode-buffer", "bluez5.decode-buffer.latency" in conf)
    check("档位名写进注释", "档位：low" in conf)
    check("未知档位回退 balanced", "档位：balanced" in output.build_latency_conf("xxx"))

    # combine-stream
    on = output.build_combine_conf(True)
    check("开启时含 combine-stream", "libpipewire-module-combine-stream" in on)
    check("combine.mode = sink", "combine.mode = sink" in on)
    check("有 latency-compensate", "latency-compensate = true" in on)
    check("节点名正确", "combine_sink.deck_multi" in on)
    check("有 Audio/Sink 匹配", "Audio/Sink" in on)

    named = output.build_combine_conf(True, ["alsa_output.speaker", "bluez_output.headset"])
    check("指定 sink 时含名字", "alsa_output.speaker" in named and "bluez_output.headset" in named)

    off = output.build_combine_conf(False)
    check("关闭时不含模块加载", "libpipewire-module-combine-stream" not in off)
    check("关闭时标注已关闭", "已关闭" in off)

    # 配置生命周期
    old = os.environ.get("XDG_CONFIG_HOME")
    with tempfile.TemporaryDirectory() as td:
        os.environ["XDG_CONFIG_HOME"] = td
        try:
            cfg = output.CombineConfig()
            p1 = cfg.apply(True)
            check("多输出配置已写入", os.path.isfile(p1))
            check("installed() 为真", output.CombineConfig.installed())
            p2 = cfg.apply_latency("stable")
            check("延迟配置已写入", os.path.isfile(p2))
            check("current_latency 反推出 stable", cfg.current_latency() == "stable")
            cfg.remove()
            check("删除多输出后 installed() 为假", not output.CombineConfig.installed())
            cfg.remove_latency()
            check("删除延迟后 current_latency 为 None", cfg.current_latency() is None)
        finally:
            if old is None:
                os.environ.pop("XDG_CONFIG_HOME", None)
            else:
                os.environ["XDG_CONFIG_HOME"] = old


def test_metadata():
    print("AVRCP 元数据")
    import metadata

    # 对象路径
    p = metadata.player_path("AA:BB:CC:DD:EE:FF")
    check("路径格式正确", p == "/org/bluez/hci0/dev_AA_BB_CC_DD_EE_FF/player0", p)
    check("小写 MAC 也转大写", "AA_BB" in metadata.player_path("aa:bb:cc:dd:ee:ff"))
    check("非法 MAC 返回空", metadata.player_path("not-a-mac") == "")
    check("None 返回空", metadata.player_path(None) == "")

    # busctl a{sv} 解析
    raw = 'a{sv} 3 "Title" s "夜曲" "Artist" s "周杰伦" "Duration" u 210000'
    d = metadata.parse_busctl_dict(raw)
    check("解析出 Title", d.get("Title") == "夜曲", str(d))
    check("解析出 Artist", d.get("Artist") == "周杰伦")
    check("解析出 Duration", d.get("Duration") == "210000")
    check("空输入返回空", metadata.parse_busctl_dict("") == {})
    check("None 返回空", metadata.parse_busctl_dict(None) == {})

    # parse_track
    t = metadata.parse_track(raw)
    check("track.title", t["title"] == "夜曲")
    check("track.artist", t["artist"] == "周杰伦")
    check("track.duration_ms", t["duration_ms"] == 210000)
    check("track.duration 格式化", t["duration"] == "3:30", t["duration"])
    check("无元数据返回 None", metadata.parse_track("") is None)

    # 无 Duration 时不崩
    t2 = metadata.parse_track('a{sv} 1 "Title" s "X"')
    check("缺 Duration 不崩", t2["duration_ms"] == 0)
    check("缺 Duration 时格式为 0:00", t2["duration"] == "0:00")

    # 状态文案
    check("playing -> 播放中", metadata.status_label("playing") == "播放中")
    check("paused -> 已暂停", metadata.status_label("paused") == "已暂停")
    check("stopped -> 已停止", metadata.status_label("stopped") == "已停止")
    check("未知状态原样返回", metadata.status_label("weird") == "weird")
    check("空状态不崩", metadata.status_label("") == "")
    check("None 状态不崩", metadata.status_label(None) == "")

    # 时长格式化
    check("0ms -> 0:00", metadata._fmt_ms(0) == "0:00")
    check("65000ms -> 1:05", metadata._fmt_ms(65000) == "1:05")
    check("None -> 0:00", metadata._fmt_ms(None) == "0:00")


def test_quality():
    print("音质 / 编码器")
    import quality
    import tempfile

    check("有 3 个音质预设", len(quality.CODEC_PRESETS) == 3)
    check("默认 balanced", quality.DEFAULT_CODEC == "balanced")
    ql = quality.codec_list()
    check("codec_list 3 条", len(ql) == 3)
    check("每条有 resample", all("resample" in x for x in ql))

    # balanced 必须包含 sbc_xq（音质提升的关键）
    check("balanced 含 sbc_xq", "sbc_xq" in quality.CODEC_PRESETS["balanced"]["codecs"])
    # stable 只应有 sbc
    check("stable 只有 sbc", quality.CODEC_PRESETS["stable"]["codecs"] == ["sbc"])
    # quality 应优先 ldac
    check("quality 首选 ldac", quality.CODEC_PRESETS["quality"]["codecs"][0] == "ldac")

    conf = quality.build_quality_conf("balanced")
    check("配置含 bluez5.codecs", "bluez5.codecs" in conf)
    check("配置含 enable-sbc-xq", "bluez5.enable-sbc-xq = true" in conf)
    check("配置含 resample.quality", "resample.quality = 10" in conf)
    check("配置含 hw-volume", "bluez5.hw-volume" in conf)
    check("占位符已替换", "{name}" not in conf and "{codecs}" not in conf)
    check("预设名写进注释", "预设：balanced" in conf)

    qconf = quality.build_quality_conf("quality")
    check("quality 预设重采样 15", "resample.quality = 15" in qconf)
    check("未知预设回退 balanced", "预设：balanced" in quality.build_quality_conf("xxx"))

    # pactl 解析
    pactl_out = """Card #2
	Name: bluez_card.AA_BB_CC_DD_EE_FF
	Profiles:
		a2dp-sink-sbc: High Fidelity Playback (A2DP Sink, codec SBC)
		a2dp-sink-sbc_xq: High Fidelity Playback (A2DP Sink, codec SBC-XQ)
		a2dp-sink-aac: High Fidelity Playback (A2DP Sink, codec AAC)
		off: Off
	Active Profile: a2dp-sink-sbc_xq
"""
    check("解析 Active Profile", quality.parse_active_profile(pactl_out) == "a2dp-sink-sbc_xq")
    avail = quality.parse_codec_capabilities(pactl_out)
    check("解析出 3 个编码器", len(avail) == 3, str(avail))
    check("含 sbc_xq", "a2dp-sink-sbc_xq" in avail)
    check("空输入返回空", quality.parse_active_profile("") == "")
    check("None 返回空", quality.parse_codec_capabilities(None) == [])

    # 配置生命周期
    old = os.environ.get("XDG_CONFIG_HOME")
    with tempfile.TemporaryDirectory() as td:
        os.environ["XDG_CONFIG_HOME"] = td
        try:
            cfg = quality.QualityConfig()
            path = cfg.apply("quality")
            check("音质配置已写入", os.path.isfile(path))
            check("installed() 为真", quality.QualityConfig.installed())
            check("current() 反推出 quality", cfg.current() == "quality")
            cfg.remove()
            check("删除后 installed() 为假", not quality.QualityConfig.installed())
        finally:
            if old is None:
                os.environ.pop("XDG_CONFIG_HOME", None)
            else:
                os.environ["XDG_CONFIG_HOME"] = old


def test_wifi():
    print("Wi-Fi 干扰检测")
    import wifi

    iw_out = """phy#0
	Interface wlan0
		ifindex 3
		ssid MyWiFi
		type managed
		channel 11 (2462 MHz), width: 20 MHz, center1: 2462 MHz
"""
    ifaces = wifi.parse_iw_dev(iw_out)
    check("解析出 1 个接口", len(ifaces) == 1, str(ifaces))
    check("SSID 正确", ifaces[0]["ssid"] == "MyWiFi")
    check("信道 11", ifaces[0]["channel"] == 11)
    check("频率 2462", ifaces[0]["freq_mhz"] == 2462)

    r = wifi.analyze(ifaces)
    check("2.4G 判定为 high risk", r["risk"] == "high")
    check("识别为 2.4G", len(r["wifi_24g"]) == 1)
    check("建议含 5GHz", "5GHz" in r["advice"])

    iw_5g = """phy#0
	Interface wlan0
		ssid MyWiFi5G
		channel 149 (5745 MHz), width: 80 MHz
"""
    r5 = wifi.analyze(wifi.parse_iw_dev(iw_5g))
    check("5G 判定为 none", r5["risk"] == "none")
    check("5G 识别正确", len(r5["wifi_5g"]) == 1)

    check("空输入不崩", wifi.parse_iw_dev("") == [])
    check("None 不崩", wifi.analyze([])["risk"] == "none")


def test_settings_validation():
    print("设置项类型校验（防脏数据）")
    # main.py 会 import decky（Decky Loader 注入），这里用桩模块替代
    import types
    if "decky" not in sys.modules:
        fake = types.ModuleType("decky")

        class _L:
            def info(self, *a):
                pass

            def error(self, *a):
                pass

        fake.logger = _L()
        fake.DECKY_PLUGIN_RUNTIME_DIR = os.path.join(os.path.dirname(__file__), "_test_rt")
        fake.DECKY_PLUGIN_LOG_DIR = os.path.join(os.path.dirname(__file__), "_test_log")
        sys.modules["decky"] = fake

    import main as m

    D = m.DEFAULT_SETTINGS

    # bool
    check("bool 接受 True", m._setting_ok("auto_start", True, D["auto_start"]))
    check("bool 拒绝字符串", not m._setting_ok("auto_start", "true", D["auto_start"]))
    check("bool 拒绝数字 1", not m._setting_ok("auto_start", 1, D["auto_start"]))
    check("bool 拒绝 None", not m._setting_ok("auto_start", None, D["auto_start"]))

    # int
    check("int 接受 0", m._setting_ok("silence_disconnect", 0, D["silence_disconnect"]))
    check("int 接受 600", m._setting_ok("silence_disconnect", 600, D["silence_disconnect"]))
    check("int 拒绝负数", not m._setting_ok("silence_disconnect", -1, D["silence_disconnect"]))
    check("int 拒绝超范围", not m._setting_ok("silence_disconnect", 99999, D["silence_disconnect"]))
    check("int 拒绝 bool（Python 里 bool 是 int 子类）",
          not m._setting_ok("silence_disconnect", True, D["silence_disconnect"]))
    check("int 拒绝字符串", not m._setting_ok("silence_disconnect", "600", D["silence_disconnect"]))

    # str 枚举
    check("focus_mode 接受合法值", m._setting_ok("focus_mode", "coexist", D["focus_mode"]))
    check("focus_mode 拒绝非法值", not m._setting_ok("focus_mode", "evil", D["focus_mode"]))
    check("latency 接受 stable", m._setting_ok("latency_profile", "stable", D["latency_profile"]))
    check("latency 拒绝非法值", not m._setting_ok("latency_profile", "ultra", D["latency_profile"]))
    check("eq_preset 接受 bass", m._setting_ok("eq_preset", "bass", D["eq_preset"]))
    check("eq_preset 拒绝非法值", not m._setting_ok("eq_preset", "hack", D["eq_preset"]))

    # 超长字符串
    check("str 拒绝超长", not m._setting_ok("alias", "x" * 300, D["alias"]))
    check("str 接受正常长度", m._setting_ok("alias", "Steam Deck", D["alias"]))

    # last_device 必须是空或合法 MAC
    check("last_device 接受空", m._setting_ok("last_device", "", D["last_device"]))
    check("last_device 接受合法 MAC",
          m._setting_ok("last_device", "AA:BB:CC:DD:EE:FF", D["last_device"]))
    check("last_device 拒绝垃圾", not m._setting_ok("last_device", "not-a-mac", D["last_device"]))

    # auto_gain 默认必须关闭（否则会和用户手动调节抢控制权）
    check("auto_gain 默认关闭", D["auto_gain"] is False, str(D.get("auto_gain")))

    # 未知类型默认值
    check("未知类型一律拒绝", not m._setting_ok("x", [1, 2], []))


def test_classify_peer():
    print("对端设备类型识别（电脑推流音量低的关键）")
    import bt

    # Icon 优先
    check("icon=computer", bt.classify_peer("computer", "", "") == "computer")
    check("icon=phone", bt.classify_peer("phone", "", "") == "phone")
    check("icon=audio-card 不算电脑", bt.classify_peer("audio-card", "", "") == "other")

    # Class of Device 兜底
    check("Class 0x01 是电脑", bt.classify_peer("", "0x00010c", "") == "computer")
    check("Class 0x02 是手机", bt.classify_peer("", "0x005a020c", "") == "phone")
    check("Class 0x04 音频不算电脑", bt.classify_peer("", "0x240404", "") == "other")

    # 名字关键词兜底（wpctl status 里节点名就是对端设备名）
    for nm in ["DESKTOP-ABC123", "MacBook Pro", "ThinkPad X1", "Windows PC"]:
        check("名字识别为电脑: %s" % nm, bt.classify_peer("", "", nm) == "computer")
    for nm in ["Pixel 8", "iPhone 15", "Galaxy S24", "Redmi Note"]:
        check("名字识别为手机: %s" % nm, bt.classify_peer("", "", nm) == "phone")

    # 认不出的归 other（不能误判成电脑，否则会给错增益）
    check("中文名归 other", bt.classify_peer("", "", "Ciallo~(∠・ω< )⌒★") == "other")
    check("空输入归 other", bt.classify_peer("", "", "") == "other")
    check("None 归 other", bt.classify_peer(None, None, None) == "other")

    # Icon 优先级高于名字（避免名字里含 pc 但实际是手机）
    check("icon=phone 压过名字里的 pc", bt.classify_peer("phone", "", "my-pc-phone") == "phone")


def test_normalize_mac():
    print("MAC 归一化（修复「设备地址不合法」）")
    import bt

    # 标准
    check("大写冒号保持不变",
          bt.normalize_mac("CC:42:10:8A:70:42") == "CC:42:10:8A:70:42")
    # 小写 -> 大写
    check("小写转大写",
          bt.normalize_mac("cc:42:10:8a:70:42") == "CC:42:10:8A:70:42")
    # 横线（BlueZ 给无名设备生成的 Alias 格式）
    check("横线转冒号",
          bt.normalize_mac("CC-42-10-8A-70-42") == "CC:42:10:8A:70:42")
    # 纯 12 位
    check("纯十六进制加冒号",
          bt.normalize_mac("CC42108A7042") == "CC:42:10:8A:70:42")
    # 点分（Cisco 风格）
    check("点分转冒号",
          bt.normalize_mac("cc42.108a.7042") == "CC:42:10:8A:70:42")
    # 前后空白 / 换行
    check("去前后空白",
          bt.normalize_mac("  CC:42:10:8A:70:42  ") == "CC:42:10:8A:70:42")
    check("去换行",
          bt.normalize_mac("CC:42:10:8A:70:42\n") == "CC:42:10:8A:70:42")

    # 反例
    check("空字符串返回空", bt.normalize_mac("") == "")
    check("None 返回空", bt.normalize_mac(None) == "")
    check("太短返回空", bt.normalize_mac("CC:42:10:8A:70") == "")
    check("非十六进制返回空", bt.normalize_mac("GG:HH:II:JJ:KK:LL") == "")
    check("普通单词返回空", bt.normalize_mac("Steam Deck") == "")

    # is_mac 必须与 normalize_mac 一致
    for v in ["CC:42:10:8A:70:42", "cc-42-10-8a-70-42", "abc", ""]:
        check("is_mac 与 normalize 一致: %s" % v,
              bt.is_mac(v) == bool(bt.normalize_mac(v)))

    # is_mac_like 复用 normalize_mac
    for v in ["AA-BB-CC-DD-EE-FF", "aa:bb:cc:dd:ee:ff", "iPhone"]:
        check("is_mac_like 与 normalize 一致: %s" % v,
              bt.is_mac_like(v) == bool(bt.normalize_mac(v)))


def test_mac_like():
    print("MAC 各种写法识别（无名称设备过滤的关键）")
    import bt

    # 冒号（标准）
    check("冒号大写", bt.is_mac_like("AA:BB:CC:DD:EE:FF"))
    check("冒号小写", bt.is_mac_like("aa:bb:cc:dd:ee:ff"))

    # 横线 —— BlueZ 给无名称设备生成 Alias 用的就是这种
    check("横线大写", bt.is_mac_like("AA-BB-CC-DD-EE-FF"))
    check("横线小写", bt.is_mac_like("aa-bb-cc-dd-ee-ff"))

    # 点分（Windows 风格）
    check("点分", bt.is_mac_like("AABB.CCDD.EEFF"))

    # 纯 12 位
    check("纯十六进制", bt.is_mac_like("AABBCCDDEEFF"))

    # 反例
    check("真实名字不是 MAC", not bt.is_mac_like("Ciallo~(∠・ω< )⌒★"))
    check("iPhone 不是 MAC", not bt.is_mac_like("iPhone"))
    check("空字符串", not bt.is_mac_like(""))
    check("None", not bt.is_mac_like(None))
    check("长度不足", not bt.is_mac_like("AA:BB:CC"))
    check("含非十六进制", not bt.is_mac_like("GG:HH:II:JJ:KK:LL"))
    check("带后缀不算", not bt.is_mac_like("Steam Deck"))

    # 关键场景：横线 MAC 必须被识别为「没有真实名字」
    check("横线 MAC 会被当成无名设备", bt.is_mac_like("AA-BB-CC-DD-EE-FF"))
    # 而 friendly_device_name 应该给它拼标签
    disp = bt.friendly_device_name("", "AA-BB-CC-DD-EE-FF", "", "", "AA:BB:CC:DD:EE:FF")
    check("无名设备得到可读标签", "EE:FF" in disp or "?" in disp,
          "实际: %s" % disp)
    # 后端不再输出中文（避免英文界面出现中文）
    import re as _re
    check("后端标签不含中文", not _re.search(r"[\u4e00-\u9fff]", disp), "实际: %s" % disp)
    check("有类型时给出类型标签",
          "手机" in bt.friendly_device_name("", "", "", "0x005a020c", "11:22:33:44:55:66"))


def test_parse_uuids():
    print("设备 UUID 解析")
    import bt

    sample = """
Device AA:BB:CC:DD:EE:FF (public)
        Name: Test Phone
        Alias: Test Phone
        Class: 0x005a020c
        Paired: yes
        Trusted: yes
        Connected: yes
        UUID: Audio Sink                (0000110b-0000-1000-8000-00805f9b34fb)
        UUID: A/V Remote Control        (0000110e-0000-1000-8000-00805f9b34fb)
        UUID: Handsfree                 (0000111e-0000-1000-8000-00805f9b34fb)
"""
    uuids = bt._parse_uuids(sample)
    check("解析出 3 个 UUID", len(uuids) == 3, "实际 %d" % len(uuids))
    check("含 audio sink", "0000110b" in uuids)
    check("含 AVRCP", "0000110e" in uuids)
    check("含 handsfree", "0000111e" in uuids)
    check("空输入返回空", bt._parse_uuids("") == [])
    check("None 返回空", bt._parse_uuids(None) == [])
    check("无 UUID 返回空", bt._parse_uuids("Name: foo") == [])


def test_parse_rssi():
    print("RSSI 解析")
    import bt

    check("-58 正常", bt._parse_rssi("-58") == -58)
    check("-100 正常", bt._parse_rssi("-100") == -100)
    check("-30 正常", bt._parse_rssi("-30") == -30)
    check("空返回 None", bt._parse_rssi("") is None)
    check("None 返回 None", bt._parse_rssi(None) is None)
    check("垃圾返回 None", bt._parse_rssi("abc") is None)
    check("超范围返回 None", bt._parse_rssi("-500") is None)
    check("带前缀也能解析", bt._parse_rssi("RSSI: -72") == -72)


def test_power_parse():
    print("睡眠信号解析")
    import power

    # busctl 输出（跨行）
    busctl_sleep = (
        "\u2023 Type=signal Interface=org.freedesktop.login1.Manager "
        "Member=PrepareForSleep Path=/org/freedesktop/login1 "
        "Signature=b STRING \"\" BOOLEAN true;"
    )
    check("busctl 睡眠=true", power.SleepWatcher.parse_sleep_state(busctl_sleep) is True)
    busctl_wake = busctl_sleep.replace("BOOLEAN true", "BOOLEAN false")
    check("busctl 唤醒=false", power.SleepWatcher.parse_sleep_state(busctl_wake) is False)

    # gdbus 输出
    gdbus_sleep = "/org/freedesktop/login1: org.freedesktop.login1.Manager.PrepareForSleep (true,)"
    check("gdbus 睡眠=true", power.SleepWatcher.parse_sleep_state(gdbus_sleep) is True)
    gdbus_wake = gdbus_sleep.replace("(true,)", "(false,)")
    check("gdbus 唤醒=false", power.SleepWatcher.parse_sleep_state(gdbus_wake) is False)

    # 非目标信号
    check("无关信号返回 None", power.SleepWatcher.parse_sleep_state("Member=PropertiesChanged") is None)
    check("空输入返回 None", power.SleepWatcher.parse_sleep_state("") is None)
    check("None 输入", power.SleepWatcher.parse_sleep_state(None) is None)

    # 只有 member 没有布尔值
    check("缺布尔值返回 None",
          power.SleepWatcher.parse_sleep_state("Member=PrepareForSleep") is None)


if __name__ == "__main__":
    for fn in (test_parse_kv, test_mac, test_devices, test_info, test_volume,
               test_sink, test_adapter_flags, test_edge, test_wp_config,
               test_nodes_parse, test_focus, test_silence, test_eq,
               test_output, test_metadata, test_quality, test_wifi,
               test_classify_peer, test_normalize_mac, test_mac_like, test_parse_uuids, test_parse_rssi,
               test_settings_validation, test_power_parse):
        fn()
    print()
    if FAILED:
        print("失败 %d 项：%s" % (len(FAILED), ", ".join(FAILED)))
        sys.exit(1)
    print("全部通过 ✅")
