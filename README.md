# 蓝牙音箱 · Steam Deck Decky Loader 插件

> **把 Steam Deck 变成一台「好用的」蓝牙音箱与音频中枢。**
> 手机、平板、电脑连上来就能放歌，声音从 Deck 那对素质不错的双喇叭出来。

[![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)](#changelog)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![SteamOS](https://img.shields.io/badge/SteamOS-3.7%2B-1a9fff.svg)](https://store.steampowered.com/steamos)

---

## 为什么做这个

从 SteamOS 3.7 起，Deck 其实**已经能**当蓝牙音箱了 —— 手动配对就行（[Xe Iaso 的实测](https://xeiaso.net/notes/2026/steam-deck-bluetooth-speaker/)）。WirePlumber 的 `bluez5.roles` 默认就包含 `a2dp_sink`。

但用起来有四个坑：

| 坑 | 后果 | 本插件的做法 |
|---|---|---|
| `DiscoverableTimeout` 默认 180 秒 | 3 分钟后手机就搜不到了 | 设为 0 + 每分钟保活 |
| HFP/HSP 会抢 A2DP | 一开麦整条流掉成单声道，声音发闷像打电话 | 关闭 `autoswitch-to-headset-profile` |
| 双角色设备被协商成 `audio-gateway` | **连上了但没声音**（[wireplumber#969](https://gitlab.freedesktop.org/pipewire/wireplumber/-/work_items/969)） | 收窄 `bluez5.roles` 只留 A2DP |
| `bluez5.hw-volume` 默认不含 `a2dp_sink` | 接收端拿不到蓝牙硬件音量 | 显式补上 |

**Decky 商店 118 个插件里，做「Deck 接收音频」的一个都没有**（GitHub 搜 `decky a2dp` / `decky bluetooth sink` 均为 0 结果）。现有插件全在做「Deck 往外送音频」和「调 Deck 自己的音频」。

本插件填的是这个空位。

---

## 功能

### 核心

- **一键变音箱**：打开开关 → 蓝牙开、可被发现、配对 agent 就位
- **免 PIN 配对**：常驻 `NoInputNoOutput` agent，手机侧点一下即配对
- **可发现性保活**：`DiscoverableTimeout = 0` + 每分钟复查
- **设备管理**：已配对列表、连接 / 断开 / 移除、设备改名
- **音量控制**：走 `wpctl`，与 Steam 音量键、系统音量条同一个音量
- **零 root 依赖**：只用系统自带 `bluetoothctl` / `busctl` / `wpctl`，`flags: []`

### 掌机专属

- **跨睡眠保活与自动重连**：合盖再开盖，蓝牙状态不会丢
  - 睡前快照 `powered` / `discoverable` / 已连接设备
  - 唤醒后按序恢复：上电 → 重启 agent → 恢复可发现 → 重连设备
  - 监听 logind 的 `PrepareForSleep`（用 `busctl` / `gdbus`，**不用** `dbus-monitor --system` —— 它需要 root 权限才能 BecomeMonitor）

### 音频体验

- **「谁在放歌」实时显示**：认出 `bluez_input` 节点，显示设备名
- **外部音源独立音量**：单独调手机推流的音量，**不影响游戏声音**
- **AVRCP 元数据**：显示歌名 / 歌手 / 专辑 / 进度 / 播放状态（Deck 屏幕不再黑着）
- **音频焦点策略**：与游戏共存 / 接收端优先 / 手动
- **编码器可见性**：显示当前是 SBC / SBC-XQ / AAC / LDAC / aptX
- **延迟档位**：低延迟 60ms / 均衡 120ms / 抗卡顿 240ms
- **静音自动断开**：手机放完歌忘断开时自动收尾（省电、避免吞通知）
- **音量归一化**：记录基线，跳变超 25% 时提示

### 均衡器

- **5 个预设**：平直 / 低音增强 / 人声清晰 / 明亮通透 / 等响补偿
- **AutoEQ / Squiglink 导入**：粘贴 `ParametricEQ.txt` 即可
- 用 PipeWire **内置** `param_eq`，零外部插件依赖

### 多输出

- **多输出同步**：内置喇叭 + 蓝牙耳机 + 有线耳机同时出声（`combine-stream`）

### 诊断

- **12 项自检**：从「检测到适配器」到「后端模块全部加载」，明确的 ✅/❌
- **一键复制诊断报告**：纯文本，直接贴给作者
- 适配器原始信息、`wpctl status`、插件日志

---

## 安装

### Decky 商店 / ZIP（推荐）

1. Decky 设置 → 开发者 → 打开 **Developer Mode**
2. 出现 **Install Plugin from ZIP** → 选 `decky-bt-speaker.zip`
3. 回到 QAM，插件列表里出现「蓝牙音箱」

### SSH 推送

```bash
pnpm install && pnpm run build
python pack.py

scp ../decky-bt-speaker.zip deck@steamdeck:~/
ssh deck@steamdeck
unzip -o ~/decky-bt-speaker.zip -d ~/homebrew/plugins/
sudo systemctl restart plugin_loader
```

### 本地开发

```bash
pnpm install
pnpm run watch          # 改动即重建
python tests_offline.py # 后端逻辑自检（不需要 Deck）
python pack.py          # 打包
```

---

## 使用

1. QAM（`···`）→「蓝牙音箱」→ 打开 **允许设备发现并连接**
2. 全屏页 → **设置** → 打开 **「音箱优化」**（写一次 WirePlumber 配置）
3. 手机蓝牙里搜 `Steam Deck`，配对
4. 放歌，声音从 Deck 出来
5. 想调音色？全屏页 → **均衡器** → 选个预设

> 💡 首次配对建议在桌面模式试一次。个别手机（尤其 iOS）在游戏模式全屏时配对弹窗可能被 Steam 界面挡住。

---

## 原理

```
手机 / 电脑                         Steam Deck (SteamOS)
┌──────────┐   A2DP (SBC/AAC)   ┌──────────────────────────────┐
│ 音乐 App │ ─────────────────▶ │ BlueZ ──▶ PipeWire           │
└──────────┘   蓝牙 2.4GHz       │   bluez_input.<MAC> 节点      │
                                 │        │                     │
                                 │        ▼                     │
                                 │  默认 sink（内置扬声器）       │
                                 └──────────────────────────────┘
```

> **方向很重要**：Deck **当音箱**时出现的是 `bluez_input.*`（外部推流进来）；Deck **连耳机**时是 `bluez_output.*`。

| 层 | 用什么 | 作用 |
|---|---|---|
| 蓝牙适配器 | `bluetoothctl` / `busctl set-property` | 上电、可发现、改名、`DiscoverableTimeout=0` |
| 配对 | 常驻 `bluetoothctl` + `agent NoInputNoOutput` | 免 PIN |
| 设备 | `bluetoothctl devices/info/connect/disconnect/remove` | 列表与连接管理 |
| 音量 | `wpctl get-volume/set-volume` | 与系统音量同步 |
| 元数据 | `busctl get-property org.bluez ... MediaPlayer1` | 曲目信息 |
| 睡眠 | `busctl monitor` / `gdbus monitor` | 唤醒恢复 |
| 均衡 | `libpipewire-module-filter-chain` + `param_eq` | EQ |
| 多输出 | `libpipewire-module-combine-stream` | 同步出声 |

### 配置写在哪

| 文件 | 内容 |
|---|---|
| `~/.config/wireplumber/wireplumber.conf.d/50-bt-speaker.conf` | 音箱优化（roles / hw-volume / autoswitch） |
| `~/.config/wireplumber/wireplumber.conf.d/70-bt-speaker-latency.conf` | 延迟档位 |
| `~/.config/pipewire/pipewire.conf.d/60-bt-speaker-eq.conf` | 均衡器 |
| `~/.config/pipewire/pipewire.conf.d/70-bt-speaker-combine.conf` | 多输出 |

**全部在用户目录**，不需要 root，不受 SteamOS 升级的 `/etc` 保留清单影响。

---

## 已知限制

### 协议级（无解，只能告知）

- **同一适配器同一时刻只能有一个 A2DP 源设备**。AVDTP v1.3 §5.3 规定一个本地 SEP 只能连一个远端 SEP；PipeWire 作者 Wim Taymans 的提交原文：「bluez5: endpoint can be used only by one device at a time ... Trying to have it connected to multiple remotes either fails or causes misbehavior later on」（[a58d815](https://gitlab.freedesktop.org/pipewire/pipewire/-/commits/a58d8150249c31d3bb37844ec98563eddd5cf143/spa/plugins)）。
  > 网上「no real limit to the number of inputs」的说法，指的是多台设备可以同时保持 ACL 连接，但**同一时刻只有一条 A2DP 流能真正出声**。
- **有 150–300ms 延迟**。看视频会轻微口型不同步，音乐没问题。
- **编码以 SBC 为主**。AAC / LDAC / aptX 能否协商取决于手机端。
- **不支持麦克风回传**。只开 A2DP Sink，没开 HFP AG。
- **建议手机端音量拉满**，由 Deck 侧调 —— 很多手机不把 sink 的音量当回事。

### 上游 bug（只能缓解）

- 双角色蓝牙设备可能被协商成 `audio-gateway`，表现为「连上了没声音」。这是 [wireplumber#969](https://gitlab.freedesktop.org/pipewire/wireplumber/-/work_items/969) / [bluez#1922](https://github.com/bluez/bluez/issues/1922) 的上游回归，在 BlueZ 5.86/5.87/5.88 上反复出现。「音箱优化」能缓解，无法根治。

### 版本参考

| SteamOS | PipeWire | WirePlumber | BlueZ |
|---|---|---|---|
| 3.7.x | 1.2.7 | 0.5.7 | 5.79 |
| 3.8.10 | 1.6.4 | 0.5.14 | 5.83 |
| 3.9.7 | 1.6.8 | 0.5.18 | 5.87 |

> WirePlumber 0.5.7 与 0.5.18 的蓝牙行为有差异，网上旧教程的参数名可能对不上。

---

## 排查

全屏页 → **诊断**：

- **12 项自检**，每项明确的 ✅/❌
- **复制诊断报告**：纯文本，直接贴给作者
- 后端模块加载状态（8 个模块逐个显示）
- `bluetoothctl show` 原始输出
- `wpctl status`
- 插件日志

日志路径：`~/homebrew/logs/decky-bt-speaker/bt-speaker.log`

| 现象 | 处理 |
|---|---|
| 手机搜不到 | 检查「可被发现」；确认保活开着 |
| 配对要 PIN | 诊断页看「配对 agent」是否 ✅，重开开关 |
| 连上没声音 | ①开「音箱优化」再重连 ②检查默认输出 ③手机音量不是 0 |
| 声音发闷像打电话 | 掉到 HFP 单声道了。开「音箱优化」，并在手机蓝牙设置里关掉「通话音频」 |
| 声音断续 | 2.4GHz 干扰，远离路由器 / USB 3.0；或用 5GHz Wi-Fi |
| 切 EQ 后没声音 | PipeWire 重启需要一两秒，等一下；还不行就重启 Deck |
| 合盖再开盖失联 | 确认「睡眠唤醒后自动恢复」开着，诊断页看已捕获事件数 |

---

## 开发

```
decky-bt-speaker/
├── main.py              # 后端入口（Plugin 类 / RPC / 生命周期）
├── bt.py                # BlueZ + PipeWire 封装
├── power.py             # 睡眠/唤醒监听
├── nodes.py             # PipeWire 节点图解析
├── focus.py             # 音频焦点 / 编码器
├── silence.py           # 静音守卫 / 音量归一化
├── eq.py                # 均衡器（filter-chain + param_eq）
├── output.py            # 延迟档位 / 多输出同步
├── metadata.py          # AVRCP 元数据
├── pack.py              # 打包（含漏包自检）
├── tests_offline.py     # 离线自检（197 项，不需要 Deck）
├── src/
│   ├── index.tsx        # definePlugin
│   ├── backend.ts       # RPC 封装
│   ├── store.ts         # 状态单例 + 轮询
│   ├── types.ts         # TS 类型
│   ├── components.tsx   # 通用控件
│   └── views/
│       ├── Speaker.tsx        # QAM 面板
│       └── BtSpeakerPage.tsx  # 全屏页（设备/设置/均衡器/诊断）
└── docs/
    ├── 功能拓展与竞品调研.md
    └── 商店提交指南.md
```

```bash
pnpm run typecheck      # 类型检查
pnpm run build          # 构建 dist/index.js
python tests_offline.py # 后端自检
python pack.py          # 打包 zip
```

### 几条硬性约束

1. **后端只用标准库**。Decky 后端是 PyInstaller 冻结环境，`dbus-python` 等第三方包 import 不到。
2. **命令探测走绝对路径**。Decky v3.2.6 之前子进程不继承 PATH。
3. **不用 `wpctl set-default` 做自动切换**。那个选择会被永久记住且获得 +30000 优先级加成，压过所有 `priority.session`，用户之后怎么切都会被抢回去（见 [GNOME #3800](https://gitlab.gnome.org/GNOME/gnome-control-center/-/work_items/3800)）。
4. **`flags` 写 `"root"` 不是 `"_root"`**。官方模板写的是 `_root`，但 loader 源码实际判断的是 `"root"`。本插件不需要 root，`flags: []`。
5. **常驻用 `systemctl --user`**，不要为常驻加 root flag。

---

## 版本历史

见 [CHANGELOG.md](CHANGELOG.md)。当前 **v2.0.0**，7 个功能版本：

| 版本 | 内容 |
|---|---|
| 1.0.0 | 基础：QAM / 设备管理 / 免 PIN 配对 / 保活 / 音箱优化 |
| 1.1.0 | 跨睡眠保活与自动重连 |
| 1.2.0 | 谁在放歌 + 外部音源独立音量 |
| 1.3.0 | 音频焦点策略 + 编码器可见性 |
| 1.4.0 | 静音自动断开 + 音量归一化 |
| 1.5.0 | 均衡器 + AutoEQ 导入 |
| 1.6.0 | 延迟档位 + 多输出同步 |
| 1.7.0 | AVRCP 元数据 |
| 2.0.0 | 诊断完善 + 报告导出 + 文档重写 |

---

## 致谢

- [WirePlumber 蓝牙配置文档](https://pipewire.pages.freedesktop.org/wireplumber/daemon/configuration/bluetooth.html)
- [pipewire-props(7)](https://man.archlinux.org/man/pipewire-props.7)
- [PipeWire filter-chain / combine-stream / loopback](https://docs.pipewire.org/)
- [Xe Iaso：A Steam Deck can be a Bluetooth speaker](https://xeiaso.net/notes/2026/steam-deck-bluetooth-speaker/)
- [pw_wp_bluetooth_rpi_speaker](https://github.com/fdanis-oss/pw_wp_bluetooth_rpi_speaker) —— PipeWire 作者本人的 A2DP sink 参考实现
- [Decky Loader](https://github.com/SteamDeckHomebrew/decky-loader)

---

## License

MIT © 大肥鱼
