"""
均衡器：用 PipeWire 的 `libpipewire-module-filter-chain` 给 Deck 喇叭做 EQ。

为什么做这个
-----------
调研确认 **Decky 生态里没有任何 EasyEffects 包装**（GitHub 搜索 0 结果），
而 Deck 自带喇叭与便宜的蓝牙音箱频响都不怎么样 —— EQ 是感知提升最大的一项。

为什么不用 EasyEffects
---------------------
- 它是 flatpak，需要用户手动装 + 手动常驻（flatpak 版没配自动启动的 dbus service）
- 依赖一大堆 LSP / Calf / ZamAudio 插件
- 对「只想调个低音」的用户来说太重

这里用 PipeWire **内置**的 `param_eq`（builtin 类型，不依赖任何外部插件），
纯配置文件，随 PipeWire 启动自动加载。

实现方式
--------
在 `~/.config/pipewire/pipewire.conf.d/` 放一个 conf，创建一个虚拟 sink，
虚拟 sink 内部跑 param_eq，输出接到真实扬声器。

⚠️ 关键约束：`param_eq` 的 `filters` 数组里 `type` 要填 **biquad 标签**
（`bq_peaking` / `bq_lowshelf` / `bq_highshelf`），不是 AutoEQ 的 `PK` / `LSC` / `HSC`。
两者要转换，见 `autoeq_to_filters()`。
"""

import os
import re

from bt import BtError

EQ_CONF_NAME = "60-bt-speaker-eq.conf"

# 预设：每条是 (type, freq, gain, q)
# type 用 PipeWire 的 biquad 标签
PRESETS = {
    "flat": {
        "label": "平直（关闭）",
        "desc": "不改变音色",
        "filters": [],
    },
    "bass": {
        "label": "低音增强",
        "desc": "补 Deck 喇叭偏薄的低频，适合流行 / 电子",
        "filters": [
            ("bq_lowshelf", 105.0, 5.5, 0.70),
            ("bq_peaking", 220.0, -1.5, 1.00),
            ("bq_peaking", 900.0, 0.8, 1.20),
        ],
    },
    "vocal": {
        "label": "人声清晰",
        "desc": "抬中频、削低频浑浊，适合播客 / 有声书 / 会议",
        "filters": [
            ("bq_highpass", 70.0, 0.0, 0.70),
            ("bq_peaking", 260.0, -2.5, 1.00),
            ("bq_peaking", 2400.0, 3.0, 1.00),
            ("bq_peaking", 5200.0, 1.5, 1.20),
        ],
    },
    "bright": {
        "label": "明亮通透",
        "desc": "抬高频细节，适合古典 / 原声乐器",
        "filters": [
            ("bq_peaking", 3200.0, 2.0, 0.90),
            ("bq_highshelf", 8000.0, 3.0, 0.70),
            ("bq_peaking", 400.0, -1.0, 1.10),
        ],
    },
    "loudness": {
        "label": "等响补偿",
        "desc": "小音量下补低频和高频（模拟等响曲线），夜间听歌用",
        "filters": [
            ("bq_lowshelf", 120.0, 7.0, 0.65),
            ("bq_highshelf", 6500.0, 4.0, 0.70),
            ("bq_peaking", 1000.0, -1.5, 1.00),
        ],
    },
}

DEFAULT_PRESET = "flat"


def preset_list():
    """给前端用的预设清单。"""
    return [
        {
            "key": k,
            "label": v["label"],
            "desc": v["desc"],
            "bands": len(v["filters"]),
        }
        for k, v in PRESETS.items()
    ]


def _fmt(v):
    """格式化浮点数，避免 105.0 写成 105.00000000001。"""
    return ("%.3f" % float(v)).rstrip("0").rstrip(".")


def build_filters_block(filters):
    """把 (type, freq, gain, q) 列表转成 filter-chain 的 filters 数组文本。"""
    if not filters:
        return ""
    lines = []
    for typ, freq, gain, q in filters:
        lines.append(
            '            { type = %s freq = %s gain = %s q = %s }'
            % (typ, _fmt(freq), _fmt(gain), _fmt(q))
        )
    return "          filters = [\n" + ",\n".join(lines) + "\n          ]\n"


def build_conf(preset_key, target_sink_name="auto"):
    """生成 PipeWire filter-chain 配置文本。

    结构：虚拟 sink（应用往这里输出） -> param_eq -> clamp -> 真实扬声器。

    ⚠️ 为什么末尾要加 `clamp`？
    软件增益或 EQ 提升都可能让信号超过 0 dBFS，超过就削波，听感是**爆音/破音**。
    `clamp` 是 PipeWire 内置的零延迟硬限幅器，把样本钳在 [-1.0, 1.0]，
    能挡住「增益过头」造成的爆音。它不改变正常电平（不超限就不动作）。
    """
    # 未知预设统一回退到 flat，注释里也要写回退后的真实值
    resolved = preset_key if preset_key in PRESETS else DEFAULT_PRESET
    preset = PRESETS[resolved]
    filters = preset["filters"]
    block = build_filters_block(filters)

    # 平直模式不写 filters，但仍保留节点（这样切预设不用改设备）
    if not block:
        block = "          filters = [ ]\n"

    return """# 由「蓝牙音箱」Decky 插件生成 —— 均衡器
# 位置：~/.config/pipewire/pipewire.conf.d/{name}
# 预设：{preset}（{label}）
# 删除本文件并重启 PipeWire 即可恢复原状。
#
# 信号链：输入 L/R -> param_eq -> clamp L/R -> 输出
# clamp 是零延迟硬限幅（钳在 ±1.0），挡住增益/EQ 过头造成的爆音。

context.modules = [
  {{ name = libpipewire-module-filter-chain
    args = {{
      node.description = "Deck 均衡器（{label}）"
      media.name       = "Deck EQ"
      filter.graph = {{
        nodes = [
          {{
            type  = builtin
            name  = eq
            label = param_eq
            config = {{
{block}            }}
          }}
          {{
            type  = builtin
            name  = clamp_l
            label = clamp
          }}
          {{
            type  = builtin
            name  = clamp_r
            label = clamp
          }}
        ]
        links = [
          {{ output = "eq:Out 1" input = "clamp_l:In" }}
          {{ output = "eq:Out 2" input = "clamp_r:In" }}
        ]
        inputs  = [ "eq:In 1" "eq:In 2" ]
        outputs = [ "clamp_l:Out" "clamp_r:Out" ]
      }}
      capture.props = {{
        node.name      = "effect_input.bt_speaker_eq"
        media.class    = Audio/Sink
        audio.channels = 2
        audio.position = [ FL FR ]
      }}
      playback.props = {{
        node.name      = "effect_output.bt_speaker_eq"
        node.passive   = true
        audio.channels = 2
        audio.position = [ FL FR ]
      }}
    }}
  }}
]
""".format(name=EQ_CONF_NAME, preset=resolved, label=preset["label"], block=block)


# ---------------------------------------------------------------------------
# AutoEQ / Squiglink 导入
# ---------------------------------------------------------------------------
_AUTOEQ_LINE = re.compile(
    r"Filter\s+(\d+):\s+(ON|OFF)\s+(PK|LSC|HSC|LPQ|HPQ|BP)\s+Fc\s+([0-9.]+)\s*Hz"
    r"\s+Gain\s+(-?[0-9.]+)\s*dB\s+Q\s+([0-9.]+)",
    re.I,
)
_PREAMP_LINE = re.compile(r"Preamp:\s*(-?[0-9.]+)\s*dB", re.I)

# AutoEQ 的滤波器类型 -> PipeWire biquad 标签
_TYPE_MAP = {
    "PK": "bq_peaking",
    "LSC": "bq_lowshelf",
    "HSC": "bq_highshelf",
    "LPQ": "bq_lowpass",
    "HPQ": "bq_highpass",
    "BP": "bq_bandpass",
}


def autoeq_to_filters(text):
    """解析 AutoEQ / Squiglink 的 ParametricEQ.txt 文本。

    返回 {'preamp': float, 'filters': [(type, freq, gain, q), ...], 'skipped': int}

    格式样例：
        Preamp: -6.8 dB
        Filter 1: ON PK Fc 21 Hz Gain 6.7 dB Q 1.100
        Filter 2: ON LSC Fc 85 Hz Gain 6.9 dB Q 3.000
    """
    if not text:
        return {"preamp": 0.0, "filters": [], "skipped": 0}

    preamp = 0.0
    m = _PREAMP_LINE.search(text)
    if m:
        try:
            preamp = float(m.group(1))
        except ValueError:
            preamp = 0.0

    filters = []
    skipped = 0
    for line in text.splitlines():
        if "Filter" not in line:
            continue
        fm = _AUTOEQ_LINE.search(line)
        if not fm:
            # 行里提到 Filter 但格式不匹配 —— 计入跳过，便于前端提示
            if line.strip():
                skipped += 1
            continue
        _idx, onoff, typ, freq, gain, q = fm.groups()
        if onoff.upper() != "ON":
            continue
        mapped = _TYPE_MAP.get(typ.upper())
        if not mapped:
            skipped += 1
            continue
        try:
            filters.append((mapped, float(freq), float(gain), float(q)))
        except ValueError:
            skipped += 1

    return {"preamp": preamp, "filters": filters, "skipped": skipped}


# ---------------------------------------------------------------------------
# 配置管理
# ---------------------------------------------------------------------------
class EqConfig:
    """管理 EQ 的 PipeWire 配置文件。"""

    def __init__(self, log=None):
        self._log = log or (lambda *_: None)

    @staticmethod
    def conf_dir():
        base = os.environ.get("XDG_CONFIG_HOME") or os.path.join(os.path.expanduser("~"), ".config")
        return os.path.join(base, "pipewire", "pipewire.conf.d")

    @classmethod
    def conf_path(cls):
        return os.path.join(cls.conf_dir(), EQ_CONF_NAME)

    @classmethod
    def installed(cls):
        try:
            return os.path.isfile(cls.conf_path())
        except Exception:
            return False

    def apply(self, preset_key=DEFAULT_PRESET):
        """应用 EQ 预设。

        ⚠️ 「平直」模式**直接删除配置文件**，不创建虚拟 sink。
        早期版本即使平直也挂一个空的 filter-chain 节点，导致所有音频多绕一级
        虚拟设备，音量和音质都受影响（真机反馈「声音偏小」）。
        """
        path = self.conf_path()

        # 平直 = 不需要 EQ，直接移除节点
        if preset_key == "flat":
            try:
                if os.path.exists(path):
                    os.remove(path)
                    self._log("平直模式：已移除 EQ 节点（不创建虚拟 sink）")
            except Exception as e:  # noqa: BLE001
                raise BtError("移除 EQ 配置失败：%s" % e)
            return path

        try:
            os.makedirs(self.conf_dir(), exist_ok=True)
            tmp = path + ".tmp"
            with open(tmp, "w", encoding="utf-8") as f:
                f.write(build_conf(preset_key))
            os.replace(tmp, path)
        except Exception as e:  # noqa: BLE001
            raise BtError("写入 EQ 配置失败：%s" % e)
        self._log("已写入 EQ 配置（%s）：%s" % (preset_key, path))
        return path

    def apply_custom(self, filters, label="自定义"):
        """用自定义滤波器列表写配置（AutoEQ 导入用）。"""
        path = self.conf_path()
        block = build_filters_block(filters) or "          filters = [ ]\n"
        text = build_conf("flat")  # 拿模板骨架
        # 替换 filters 块
        text = re.sub(
            r"          filters = \[[^\]]*\]\n",
            block,
            text,
            count=1,
        )
        text = text.replace("平直（关闭）", label).replace("预设：flat", "预设：自定义")
        try:
            os.makedirs(self.conf_dir(), exist_ok=True)
            tmp = path + ".tmp"
            with open(tmp, "w", encoding="utf-8") as f:
                f.write(text)
            os.replace(tmp, path)
        except Exception as e:  # noqa: BLE001
            raise BtError("写入自定义 EQ 失败：%s" % e)
        self._log("已写入自定义 EQ（%d 段）：%s" % (len(filters), path))
        return path

    def remove(self):
        path = self.conf_path()
        try:
            if os.path.exists(path):
                os.remove(path)
                self._log("已删除 EQ 配置：%s" % path)
        except Exception as e:  # noqa: BLE001
            raise BtError("删除 EQ 配置失败：%s" % e)
        return True

    def current_preset(self):
        """从现有配置里反推用的是哪个预设（尽力而为）。"""
        path = self.conf_path()
        if not os.path.exists(path):
            return None
        try:
            with open(path, "r", encoding="utf-8") as f:
                text = f.read()
        except Exception:
            return None
        m = re.search(r"预设：(\w+)", text)
        if m and m.group(1) in PRESETS:
            return m.group(1)
        if "预设：自定义" in text:
            return "custom"
        return None
