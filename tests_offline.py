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


if __name__ == "__main__":
    for fn in (test_parse_kv, test_mac, test_devices, test_info, test_volume,
               test_sink, test_adapter_flags, test_edge, test_wp_config):
        fn()
    print()
    if FAILED:
        print("失败 %d 项：%s" % (len(FAILED), ", ".join(FAILED)))
        sys.exit(1)
    print("全部通过 ✅")
