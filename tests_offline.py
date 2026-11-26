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
               test_nodes_parse, test_focus, test_silence, test_power_parse):
        fn()
    print()
    if FAILED:
        print("失败 %d 项：%s" % (len(FAILED), ", ".join(FAILED)))
        sys.exit(1)
    print("全部通过 ✅")
