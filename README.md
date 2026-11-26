# 蓝牙音箱 · Steam Deck Decky Loader 插件

> 把 Steam Deck 变成一台**蓝牙音箱**：手机、平板、电脑都能连上来放歌，声音直接从 Deck 那对素质不错的双喇叭出来。

Steam Deck 的喇叭（以及 3.5mm / USB-C 输出）素质在同尺寸设备里属于第一梯队，但 SteamOS 从来没提供「当蓝牙接收端」的开关。本插件把系统里本来就存在、只是被藏起来的 A2DP Sink 能力，做成了一个游戏模式里点两下就能用的面板。

> **先说句实话**：从 SteamOS 3.7 起，Deck 其实**已经能**当蓝牙音箱了（手动配对就行，见 [Xe Iaso 的实测](https://xeiaso.net/notes/2026/steam-deck-bluetooth-speaker/)）。但用起来有四个坑：**180 秒后自动隐身**、**容易掉成通话单声道**、**双角色设备可能连上却没声音**、**没有硬件音量**。本插件的价值就是把这四个坑一键化，外加一个游戏模式里能用的状态面板。

---

## ✨ 功能

- **一键变音箱**：打开开关 → 蓝牙开、可被发现、配对 agent 就位，手机蓝牙列表里立刻出现 `Steam Deck`
- **可发现性保活**：BlueZ 的 `DiscoverableTimeout` 默认 180 秒后自动隐身，插件每分钟复查一次（并顺手把超时设成 0），保持可被搜到
- **一键「音箱优化」**：写入**用户级** WirePlumber 配置（不碰只读根分区、不需要 root、不受 SteamOS 升级保留清单影响），解决三个经典疑难：
  - 收窄 `bluez5.roles` 到只剩 A2DP 两个角色，规避双角色设备被协商成 `audio-gateway` 导致**连上却没声音**的上游回归（[wireplumber#969](https://gitlab.freedesktop.org/pipewire/wireplumber/-/work_items/969) / [bluez#1922](https://github.com/bluez/bluez/issues/1922)）
  - `bluez5.media-source-role = "playback"`：手机推来的流直接播到本机扬声器
  - 关闭 `autoswitch-to-headset-profile`：防止有人开麦时整条流掉成 mSBC 单声道
  - 给 `a2dp_sink` 补上 `bluez5.hw-volume`（**默认值里没有它**，所以接收端默认拿不到蓝牙硬件音量）
- **QAM 快捷面板**：`···` 菜单里直接看状态、开关可发现、拖动音量、一键断开
- **全屏管理页**：已配对设备列表（连接 / 断开 / 移除）、设备改名、行为开关、诊断信息
- **免确认配对**：后端常驻 `NoInputNoOutput` agent，手机侧点一下「配对」即可，Deck 不用弹窗输入 PIN
- **音量直连系统 sink**：走 `wpctl`，和 Steam 音量键、系统音量条是同一个音量
- **无 root 依赖**：只用系统自带的 `bluetoothctl` / `busctl` / `wpctl`，不需要 `_root` flag
- **诊断页**：命令可用性、适配器原始信息、`wpctl status`、插件日志，一键自查看问题出在哪

---

## 🔧 原理

SteamOS 的音频栈是 **PipeWire + WirePlumber**，蓝牙由 **BlueZ** 管理。

关键事实：**WirePlumber 的 `bluez5.roles` 默认就包含 `a2dp_sink`**，且 `bluez5.media-source-role` 默认就是 `playback`——也就是说 Deck 本来就能作为 A2DP 接收端，把手机推来的音频直接播到本机扬声器。系统只是没给入口，而且默认 180 秒后就不再对外可见。

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

> 注意方向：Deck **当音箱**时出现的是 `bluez_input.*` 节点（外部设备推流进来）；Deck **连耳机**时是 `bluez_output.*`。搞反了就会误判「没有蓝牙音频」。

本插件做的事：

| 层 | 用什么 | 作用 |
|---|---|---|
| 蓝牙适配器 | `bluetoothctl` / `busctl set-property` | 上电、可发现、可配对、改设备名、`DiscoverableTimeout=0` |
| 配对 | 常驻 `bluetoothctl` + `agent NoInputNoOutput` | 手机侧免 PIN 配对 |
| 设备 | `bluetoothctl devices/info/connect/disconnect/remove` | 设备列表与连接管理 |
| 音量 | `wpctl get-volume/set-volume @DEFAULT_AUDIO_SINK@` | 与系统音量同步 |
| 音频调优 | `~/.config/wireplumber/wireplumber.conf.d/50-bt-speaker.conf` | 见上文「一键音箱优化」 |
| 前端 | React + `@decky/ui` | QAM 面板 + 全屏页 |

### 为什么不用 `module-loopback`？

那是 PulseAudio 时代的遗留做法。PipeWire + WirePlumber 下 `bluez5.media-source-role = playback` 就已经把外部推流直接接到默认 sink，再加 loopback 只会引入额外延迟和回声风险。参考实现（PipeWire 作者本人的 [pw_wp_bluetooth_rpi_speaker](https://github.com/fdanis-oss/pw_wp_bluetooth_rpi_speaker)）也是「只管 BlueZ Agent，音频交给 PipeWire」。

### 为什么不改 `/etc`？

SteamOS 根分区只读，`/etc` 是可写 overlay 但**受「保留清单」限制**（3.6 起）：只有清单内的文件才跨系统升级保留，其余会被丢弃。所以改 `/etc/bluetooth/main.conf` 或 `/etc/wireplumber/` 既需要 root，又不保证升级后还在。本插件统一走**用户级** `~/.config/wireplumber/`，deck 用户可写、升级不丢。

---

## 📦 安装

### 方式一：Decky 商店 / 手动 ZIP（推荐）

1. Decky 设置 → 开发者 → 打开 **Developer Mode**
2. 出现 **Install Plugin from ZIP** → 选 `decky-bt-speaker.zip`
3. 回到 QAM，插件列表里出现「蓝牙音箱」

### 方式二：SSH 推送

```bash
# 在电脑上
pnpm install && pnpm run build
python pack.py                       # 生成 decky-bt-speaker.zip

scp decky-bt-speaker.zip deck@steamdeck:~/
ssh deck@steamdeck
unzip -o ~/decky-bt-speaker.zip -d ~/homebrew/plugins/
sudo systemctl restart plugin_loader
```

### 方式三：本地开发热更

```bash
pnpm install
pnpm run watch        # 改动即重建 dist/index.js
# 把 dist/index.js 覆盖到 Deck 的 ~/homebrew/plugins/decky-bt-speaker/dist/
# 然后在 Decky 开发者设置里 reload 插件
```

---

## 🎵 使用

1. 打开 QAM（`···`）→ 「蓝牙音箱」→ 打开 **允许设备发现并连接**
2. （推荐）去全屏页 → **设置** → 打开 **「音箱优化」配置**，让它写一次 WirePlumber 配置
3. 手机 / 电脑打开蓝牙，搜索 `Steam Deck`（可在全屏页改成自定义名字）
4. 配对 → 播放音乐，声音从 Deck 出来
5. 音量用 QAM 面板的滑杆，或者直接用 Deck 的音量键（同一个系统音量）

> 💡 首次配对建议在**桌面模式**或游戏模式都试一次。个别手机（尤其是 iOS）在游戏模式全屏时配对弹窗可能被 Steam 界面挡住，先回桌面配好，之后在游戏模式重连就不需要弹窗了。

---

## ⚠️ 已知限制

这些是蓝牙 A2DP 协议与上游实现的限制，不是插件 bug：

- **同一时间基本只有一个音源**。A2DP 是点对点单流；虽然 PipeWire 侧技术上能挂多个 sink，但带宽与手机端行为是硬约束，**不保证多源同时稳定出声**。想多源混音需要额外的 loopback 方案，本插件没做。
- **有延迟**，通常 150–300ms（SBC 编码 + 缓冲）。看视频会有轻微口型不同步，音乐没问题。可调项是 `bluez5.decode-buffer.latency` / `node.latency-offset-msec`。
- **编码以 SBC 为主**。SBC 是强制基线；`sbc_xq` 本插件默认开了。AAC / LDAC / aptX 能否协商成功取决于手机端与 PipeWire 版本，Deck 作为 sink 端不保证。
- **不支持麦克风回传**。本插件只开 A2DP Sink，没开 HFP 的 AG 角色，手机打电话不会走 Deck。
- **手机端音量建议拉满**，由 Deck 侧调音量——很多手机不把 sink 的音量当回事。
- **游戏模式下 Steam 界面可能抢占音频焦点**。某些游戏启动时会把默认 sink 切走，回 QAM 看一眼状态即可。
- **双角色蓝牙设备的上游回归**：某些设备（如 Amazon Echo Dot）会被协商成 `audio-gateway` 而**完全没有 a2dp-sink profile**，表现为「连上了没声音」。这是 [wireplumber#969](https://gitlab.freedesktop.org/pipewire/wireplumber/-/work_items/969) / [bluez#1922](https://github.com/bluez/bluez/issues/1922) 的上游问题，在 BlueZ 5.86/5.87/5.88 上反复回归。本插件的「音箱优化」能缓解，但无法根治。

### 版本参考

不同 SteamOS 版本的音频栈差异较大，排查时先对一下版本（诊断页会直接显示）：

| SteamOS | PipeWire | WirePlumber | BlueZ |
|---|---|---|---|
| 3.7.x | 1.2.7 | 0.5.7 | 5.79 |
| 3.8.10 | 1.6.4 | 0.5.14 | 5.83 |
| 3.9.7 | 1.6.8 | 0.5.18 | 5.87 |

> WirePlumber 0.5.7 与 0.5.18 的蓝牙行为有差异，网上教程若基于旧版本，参数名可能对不上。

---

## 🩺 排查

全屏页 → **诊断** 标签页，能直接看到：

- `bluetoothctl` / `busctl` / `wpctl` 是否存在
- 适配器原始 `bluetoothctl show` 输出（重点看有没有 `UUID: Audio Sink`）
- `wpctl status`（看默认 sink 是不是内置扬声器）
- 插件日志（配对事件、保活动作、错误堆栈）

日志文件路径：`~/homebrew/logs/decky-bt-speaker/bt-speaker.log`

常见问题：

| 现象 | 原因 / 处理 |
|---|---|
| 手机搜不到 Deck | 检查「可被发现」是否开着；BlueZ 默认 180s 超时，插件会自动保活，若关掉保活就会隐身 |
| 配对时要求 PIN | 配对 agent 没起来，去诊断页看 `配对 agent` 是否为 ✅，重开一次开关 |
| 连上了但没声音 | ①打开「音箱优化」再重连；②检查默认输出设备；③用 Deck 音量键调一下；④确认手机端音量不是 0 |
| 声音发闷、像打电话 | 掉到 HFP 单声道了。打开「音箱优化」（会关掉 `autoswitch-to-headset-profile`），并在手机蓝牙设置里关掉「通话音频」 |
| 声音断续 | 2.4GHz 干扰，远离 Wi-Fi 路由器 / USB 3.0 设备；或改用 5GHz Wi-Fi |
| 诊断页显示没有 `bluetoothctl` | SteamOS 缺 bluez-utils；同时检查是不是在容器/非标准环境里跑 |
| 重启 Deck 后配置没了 | 「音箱优化」写的是 `~/.config/`，理论上不会丢；若丢了重开一次开关即可 |

---

## 🛠 开发

```
decky-bt-speaker/
├── plugin.json          # Decky 清单
├── package.json         # 前端依赖与脚本
├── rollup.config.js     # @decky/rollup
├── tsconfig.json
├── main.py              # 后端入口（Plugin 类 / RPC / 生命周期）
├── bt.py                # BlueZ + PipeWire 封装（纯标准库）
├── pack.py              # 打包成可安装 zip
├── tests_offline.py     # 离线解析自检（不需要 Deck）
├── src/
│   ├── index.tsx        # definePlugin 入口
│   ├── route.ts         # 路由常量 + 配色
│   ├── backend.ts       # RPC 封装（错误转可读异常）
│   ├── store.ts         # 状态单例 + 轮询（QAM 与全屏页共用）
│   ├── types.ts         # TS 类型
│   ├── components.tsx   # 通用控件
│   └── views/
│       ├── Speaker.tsx        # QAM 面板
│       └── BtSpeakerPage.tsx  # 全屏管理页
└── dist/index.js        # 构建产物
```

```bash
pnpm run typecheck      # 类型检查
pnpm run build          # 构建 dist/index.js
python tests_offline.py # 后端解析逻辑自检
python pack.py          # 打包 zip
```

后端只用**标准库**（`asyncio` / `subprocess` / `json` / `re`），不引入 `dbus-python` 等第三方包——Decky 后端是 PyInstaller 冻结环境，第三方模块大概率 import 失败。

---

## 📄 License

MIT
