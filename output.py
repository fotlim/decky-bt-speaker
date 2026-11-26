"""
延迟档位与多输出同步。

两个功能：

1. **延迟档位**（抄 SoundWire Pro Mode / AudioRelay 的思路）
   蓝牙 A2DP 的延迟不是固定的，取决于编码器与缓冲。给用户三档预设并
   显示估算值，让「省电 / 低延迟 / 抗卡顿」这个取舍变透明。

2. **多输出同步**（`libpipewire-module-combine-stream`）
   把「Deck 喇叭 + 蓝牙耳机 + 有线耳机」打成一组同时出声。
   聚会时两人听同一局游戏、或一边外放一边戴耳机，都靠这个。

⚠️ 关于「多个蓝牙 A2DP 源同时连 Deck」的硬限制
--------------------------------------------
做不到，别写进路线图。依据：
- AVDTP v1.3 §5.3：同一适配器上一个本地 SEP 只能连一个远端 SEP
- PipeWire 提交原文：「bluez5: endpoint can be used only by one device at a time
  ... Trying to have it connected to multiple remotes either fails or causes
  misbehavior later on」（Wim Taymans, a58d815）

但**反向是可行的**：Deck 同时推流到多个蓝牙耳机，用 combine-stream 的 sink 模式。
"""

import os

from bt import BtError

COMBINE_CONF_NAME = "70-bt-speaker-combine.conf"

# 延迟档位
LATENCY_PROFILES = {
    "low": {
        "label": "低延迟",
        "desc": "缓冲小，看视频口型更同步；Wi-Fi 干扰大时可能卡顿",
        "latency_ms": 60,
        "node_latency": "128/48000",
        "decode_buffer": 0,
    },
    "balanced": {
        "label": "均衡（推荐）",
        "desc": "默认档位，兼顾稳定性与延迟",
        "latency_ms": 120,
        "node_latency": "256/48000",
        "decode_buffer": 0,
    },
    "stable": {
        "label": "抗卡顿",
        "desc": "缓冲大，干扰环境下更稳；延迟会明显增加",
        "latency_ms": 240,
        "node_latency": "512/48000",
        "decode_buffer": 20,
    },
}

DEFAULT_LATENCY = "balanced"


def latency_list():
    return [
        {
            "key": k,
            "label": v["label"],
            "desc": v["desc"],
            "latency_ms": v["latency_ms"],
        }
        for k, v in LATENCY_PROFILES.items()
    ]


def build_latency_conf(profile_key):
    """生成延迟 / 抗卡顿 / 抗爆音的 WirePlumber 配置片段。

    解决三类问题：

    1. **卡顿**（日志出现 `client too slow!`）
       蓝牙链路带宽不够，PipeWire 填不满传输缓冲。加大量化与缓冲。

    2. **爆音**（削波破音）
       软件增益超过 100% 后必然削波。`node.pause-on-idle = false` 避免
       暂停/恢复时的爆点；`node.latency` 给足缓冲减少 xrun。

    3. **开始播放时的爆音**
       节点空闲被挂起，恢复瞬间会有 pop。关掉挂起。
    """
    resolved = profile_key if profile_key in LATENCY_PROFILES else DEFAULT_LATENCY
    p = LATENCY_PROFILES[resolved]
    return """# 由「蓝牙音箱」Decky 插件生成 —— 延迟 / 抗卡顿 / 抗爆音
# 位置：~/.config/wireplumber/wireplumber.conf.d/{name}
# 档位：{resolved}（{label}，约 {ms}ms）
# 删除本文件并重启 WirePlumber 即可恢复默认。

monitor.bluez.rules = [
  {{
    matches = [
      {{ node.name = "~bluez_input.*" }}
      {{ node.name = "~bluez_output.*" }}
    ]
    actions = {{
      update-props = {{
        node.latency = "{latency}"
        bluez5.decode-buffer.latency = {decode}
        # 不因空闲挂起节点：避免恢复播放瞬间的爆音（pop）
        node.pause-on-idle = false
        # 会话挂起超时设为 0 = 不自动挂起，减少卡顿与爆点
        session.suspend-timeout-seconds = 0
        # 给足缓冲，缓解 client too slow
        node.quantum = 1024
      }}
    }}
  }}
]

# 全局：蓝牙相关缓冲与重采样设置
wireplumber.settings = {{
  # 蓝牙链路抖动时用更宽松的时钟同步
  node.features.audio.adapter = true
}}
""".format(
        name=COMBINE_CONF_NAME.replace("combine", "latency"),
        resolved=resolved,
        label=p["label"],
        ms=p["latency_ms"],
        latency=p["node_latency"],
        decode=p["decode_buffer"],
    )


# ---------------------------------------------------------------------------
# 多输出同步
# ---------------------------------------------------------------------------
def build_combine_conf(enabled, sink_names=None):
    """生成 combine-stream 配置。

    enabled=False 时生成一份「空」配置（模块不加载），用于关闭功能。

    sink_names: 要同步输出的 sink 节点名列表。None = 匹配所有 Audio/Sink
    （由 PipeWire 的 match 规则动态处理，新插入的设备也能自动加入）。
    """
    if not enabled:
        return """# 由「蓝牙音箱」Decky 插件生成 —— 多输出同步（已关闭）
# 位置：~/.config/pipewire/pipewire.conf.d/{name}
# 本文件存在但模块未启用，删除即可。

# （功能关闭中，无需加载 combine-stream）
""".format(name=COMBINE_CONF_NAME)

    if sink_names:
        rules = []
        for name in sink_names:
            rules.append(
                '      {{ matches = [ {{ media.class = "Audio/Sink" node.name = "{n}" }} ]'
                " actions = {{ create-stream = {{ }} }} }}".format(n=name)
            )
        rule_block = ",\n".join(rules)
    else:
        # 空 matches 数组 = 匹配所有 Audio/Sink
        rule_block = (
            '      { matches = [ { media.class = "Audio/Sink" } ]'
            " actions = { create-stream = { } } }"
        )

    return """# 由「蓝牙音箱」Decky 插件生成 —— 多输出同步
# 位置：~/.config/pipewire/pipewire.conf.d/{name}
# 作用：创建一个虚拟 sink「Deck 多输出」，声音同时送到所有输出设备
#       （内置喇叭 + 蓝牙耳机 + 有线耳机）。
# 用法：在系统音量里把输出切到「Deck 多输出」。
# 注意：蓝牙 A2DP 有固有延迟，多输出之间可能有轻微不同步；
#       combine.latency-compensate 会尝试对齐，但无法完全消除。
# 删除本文件并重启 PipeWire 即可恢复。

context.modules = [
  {{ name = libpipewire-module-combine-stream
    args = {{
      combine.mode = sink
      node.name = "combine_sink.deck_multi"
      node.description = "Deck 多输出（同步）"
      combine.latency-compensate = true
      combine.props = {{
        audio.position = [ FL FR ]
      }}
      stream.props = {{ }}
      stream.rules = [
{rule_block}
      ]
    }}
  }}
]
""".format(name=COMBINE_CONF_NAME, rule_block=rule_block)


class CombineConfig:
    """管理多输出同步与延迟档位的配置文件。"""

    def __init__(self, log=None):
        self._log = log or (lambda *_: None)

    @staticmethod
    def _cfg_base():
        return os.environ.get("XDG_CONFIG_HOME") or os.path.join(os.path.expanduser("~"), ".config")

    @classmethod
    def conf_path(cls):
        return os.path.join(cls._cfg_base(), "pipewire", "pipewire.conf.d", COMBINE_CONF_NAME)

    @classmethod
    def latency_path(cls):
        return os.path.join(
            cls._cfg_base(), "wireplumber", "wireplumber.conf.d",
            COMBINE_CONF_NAME.replace("combine", "latency"),
        )

    @classmethod
    def installed(cls):
        try:
            return os.path.isfile(cls.conf_path())
        except Exception:
            return False

    def _write(self, path, text):
        try:
            os.makedirs(os.path.dirname(path), exist_ok=True)
            tmp = path + ".tmp"
            with open(tmp, "w", encoding="utf-8") as f:
                f.write(text)
            os.replace(tmp, path)
        except Exception as e:  # noqa: BLE001
            raise BtError("写入配置失败：%s" % e)
        return path

    def apply(self, enabled, sink_names=None):
        path = self._write(self.conf_path(), build_combine_conf(enabled, sink_names))
        self._log("多输出同步：%s -> %s" % ("开启" if enabled else "关闭", path))
        return path

    def remove(self):
        path = self.conf_path()
        try:
            if os.path.exists(path):
                os.remove(path)
                self._log("已删除多输出配置：%s" % path)
        except Exception as e:  # noqa: BLE001
            raise BtError("删除多输出配置失败：%s" % e)
        return True

    def apply_latency(self, profile_key):
        path = self._write(self.latency_path(), build_latency_conf(profile_key))
        self._log("延迟档位：%s -> %s" % (profile_key, path))
        return path

    def remove_latency(self):
        path = self.latency_path()
        try:
            if os.path.exists(path):
                os.remove(path)
                self._log("已删除延迟配置：%s" % path)
        except Exception as e:  # noqa: BLE001
            raise BtError("删除延迟配置失败：%s" % e)
        return True

    def current_latency(self):
        path = self.latency_path()
        if not os.path.exists(path):
            return None
        try:
            with open(path, "r", encoding="utf-8") as f:
                text = f.read()
        except Exception:
            return None
        import re as _re

        m = _re.search(r"档位：(\w+)", text)
        return m.group(1) if m and m.group(1) in LATENCY_PROFILES else None


async def list_sinks(wp):
    """列出当前所有 sink，供多输出配置选择。"""
    try:
        text = await wp.status_text()
    except BtError:
        return []
    import re as _re

    out = []
    in_sinks = False
    for line in (text or "").splitlines():
        if "Sinks:" in line:
            in_sinks = True
            continue
        if in_sinks:
            if any(k in line for k in ("Sources:", "Streams:", "Clients:", "Devices:", "Video")):
                break
            m = _re.search(r"^\s*(\*)?\s*(\d+)\.\s+(.+?)(?:\s{2,}\[vol:\s*([0-9.]+)\])?\s*$", line)
            if m:
                out.append({
                    "id": int(m.group(2)),
                    "name": m.group(3).strip(),
                    "default": bool(m.group(1)),
                })
    return out
