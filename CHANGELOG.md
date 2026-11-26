# Changelog

本项目遵循 [语义化版本](https://semver.org/lang/zh-CN/)，格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)。

---

## [1.4.0] - 2026-11-26

静音自动断开 + 音量归一化。两个来自成熟产品的启发，针对掌机场景改造。

### Added

- **`silence.py`**：静音守卫与音量归一化
- **静音自动断开**（抄 Airfoil 的 Silence Monitor）
  - 手机放完歌常忘了断开，A2DP 链路继续占着蓝牙射频，既耗电又让手机通知音被吞掉
  - 可设 0–600 秒（0 = 关闭），超时自动断开所有已连接设备
  - QAM 显示倒计时
- **音量归一化**（抄 Sonos 音量体验规范）
  - 记录外部源音量基线，跳变超过 25% 时提示并计数
  - **温和方案**：只提示不粗暴改写，避免「一插上就炸音」
- 新增 RPC：`set_silence_timeout` / `set_volume_baseline` / `reset_volume_baseline`

### Design Notes

**为什么不用 `pw-record` 采电平判静音？**

真正判断「有没有声音」需要采集 sink monitor 的采样算 RMS，代价是：持续占用一个 capture 流（额外 CPU 与延迟）、需要解析裸 PCM、在省电场景下得不偿失。

改用 **`pw-dump` 的 `node.state`** 判断：没有音频流时节点会进入 idle/suspended。零额外开销，且比猜电平可靠得多。拿不到 `pw-dump` 时退回「有没有 `bluez_input` 节点」这个弱信号。

### Tests

- 新增 17 项静音/归一化自检（超时触发、从未活跃不触发、坏 JSON、跳变检测）

---

## [1.3.0] - 2026-11-26

音频焦点策略 + 编码器可见性。

### Added

- **`focus.py`**：音频焦点策略执行器
  - `coexist`（默认）：手机推流与游戏声音共存
  - `receiver_first`：优先保证推流音质，自动关闭「切通话模式」
  - `manual`：插件完全不插手
- **编码器显示**：读 `pactl list cards` 的 `Active Profile`，翻译成「SBC / SBC-XQ / AAC / LDAC / aptX」，并标明方向（接收 / 发送 / 通话）
- **`set_autoswitch` / `get_autoswitch`**：直接控制 `bluetooth.autoswitch-to-headset-profile`
- **前端设置页**：三选一焦点模式（单选卡片）、编码器信息面板

### Design Notes

**刻意不使用 `wpctl set-default` 做自动切换。** 两个真实原因：

1. `wpctl set-default` 的选择会被**永久记住**在 default-streams 状态文件里，并且在 `find-selected-default-node.lua` 里获得 `priority = 30000 + priority` 的加成，压过所有 `priority.session`。一旦设过，用户之后在系统里怎么切都会被抢回去，只有 `wpctl clear-default` 能忘掉。
2. [GNOME #3800](https://gitlab.gnome.org/GNOME/gnome-control-center/-/work_items/3800) 就是这个机制导致的：设备移除时被改写成 fallback，之后内置扬声器永远抢不走默认。

所以插件只在「外部源出现/消失」时做一次性路由修正，**不写入持久状态**，用户自己选的默认设备永远优先。

### Fixed

- `summarize_profile` 的两个漏判：
  - `sbc_xq`（下划线）之前只匹配 `sbc-xq`（连字符），不同 PipeWire 版本两种写法都出现过
  - `headset-head-unit`（PulseAudio 传统通话 profile 名）里没有 `hfp` 字样，之前翻译不出来

### Tests

- 新增 12 项焦点/编码器自检（含 6 种 profile 名变体）

---

## [1.2.0] - 2026-11-26

「谁在放歌」实时显示 + 外部音源独立音量控制。

之前连上手机后 QAM 里一片空白——不知道谁在放、音量多大、能不能单独调。
这个版本把这条链路补完了。

### Added

- **`nodes.py`**：PipeWire 节点图解析
  - 从 `wpctl status` 解析出 Sinks / Sources / Streams / Devices / Clients 五节
  - `find_bt_input()` 认出 `bluez_input.<MAC>` 节点（外部设备推流进 Deck）
  - 正确跳过 Streams 里的端口子行（`61. output_FL > ...`）
  - 正确处理 `wpctl status` 的 box-drawing 前缀（`│ ├ └ ─`）与默认节点 `*` 标记
- **QAM「正在播放」卡片**：显示外部音源设备名 + 绿点脉冲 + 「外部音源」徽章
- **外部音源独立音量**：`wpctl set-volume <节点id>` 单独调节，**不影响游戏声音**
- **外部音源独立静音**：`set_source_mute`
- 新增 RPC：`set_source_volume` / `set_source_mute`
- `bt.py` 新增 `get_volume_of` / `set_volume_of` / `set_mute_of`（按节点 id 操作）

### Fixed

- **`pack.py` 漏包自检**：v1.1.0 漏打了 `power.py`，这次加的自检立刻抓到了 `nodes.py` 漏打
- **`package.json` BOM**：PowerShell `Set-Content -Encoding UTF8` 会写入 BOM，导致 rollup 报 `Unexpected token '\ufeff'`

### Tests

- 新增 13 项节点解析自检（真实 `wpctl status` 格式，含 box-drawing 与端口子行）

---

## [1.1.0] - 2026-11-26

跨睡眠保活与自动重连 —— 掌机独有的场景，桌面软件不需要处理，因此没有现成方案可抄。

### Added

- **睡眠/唤醒监听**（`power.py`）：订阅 logind 的 `PrepareForSleep` 信号
  - 优先用 `busctl monitor --match`，退回 `gdbus monitor`
  - **不用 `dbus-monitor --system`**：它首步请求 `org.freedesktop.DBus.Monitoring.BecomeMonitor`，系统总线上该权限只给 root，普通用户会被 AccessDenied 并退回已弃用的 eavesdropping 模式
- **睡前快照**：记录 `powered` / `discoverable` / 已连接设备列表 / 上次设备 MAC
- **唤醒恢复**：按固定顺序执行，顺序有讲究
  1. 上电（睡眠时可能被 rfkill 关掉）
  2. 重启配对 agent（子进程被内核冻结过，很可能已失联）
  3. 恢复可发现（`DiscoverableTimeout` 在睡眠期间照常计时）
  4. 重连睡前连着的设备（优先 `last_device`）
- **唤醒延迟**：等待 4 秒让 BlueZ / WirePlumber 重新枚举设备后再恢复
- **设置项** `resume_restore`（默认开）、`last_device`（自动记录）
- **前端**：设置页新增「睡眠唤醒后自动恢复」开关，显示已捕获事件数与最近一次事件

### Technical

- `SleepWatcher.parse_sleep_state()` 同时兼容 `busctl` 的多行输出与 `gdbus` 的单行 `(true,)` 格式
- 监听进程退出不抛异常，仅记录日志 —— 睡眠监听失败不影响主功能
- 新增 8 项离线自检覆盖两种信号格式

---

## [1.0.0] - 2026-11-26

首个可用版本。把 Steam Deck 变成一台可被手机 / 电脑连接的蓝牙音箱（A2DP Sink）。

### Added

- **QAM 快捷面板**：状态徽章（蓝牙开关 / 可被发现 / 已连接数）、可发现开关、已连接设备一键断开、音量滑杆
- **全屏管理页**：三个标签页
  - 已配对设备：连接 / 断开 / 移除
  - 设置：设备改名、自动启动、可发现保活开关、系统信息
  - 诊断：命令可用性、`bluetoothctl show` 原始输出、`wpctl status`、插件日志
- **免 PIN 配对**：后端常驻 `bluetoothctl` + `agent NoInputNoOutput`，手机侧点一下即配对
- **可发现性保活**：把 `DiscoverableTimeout` 设为 0，并每 60 秒复查一次（BlueZ 默认 180 秒隐身）
- **「音箱优化」一键配置**：写入用户级 `~/.config/wireplumber/wireplumber.conf.d/50-bt-speaker.conf`
  - 收窄 `bluez5.roles` 到 A2DP 两个角色，规避双角色设备协商成 `audio-gateway` 导致没声音
  - `bluez5.media-source-role = "playback"`：外部推流直出到本机扬声器
  - 关闭 `autoswitch-to-headset-profile`：防止掉成 mSBC 单声道
  - 给 `a2dp_sink` 补上 `bluez5.hw-volume`（默认值里没有）
- **音量控制**：走 `wpctl`，与 Steam 音量键、系统音量条同一个音量
- **零 root 依赖**：只用系统自带的 `bluetoothctl` / `busctl` / `wpctl`，`flags: []`
- **离线自检**：`tests_offline.py` 覆盖解析逻辑（真实 `bluetoothctl show` / `wpctl status` 样例、MAC 注入防护、配置生成与清理）

### Technical

- 后端纯标准库（`asyncio` / `subprocess` / `json` / `re`），不依赖 `dbus-python` 等第三方包
- 命令探测走绝对路径（`/usr/bin` 等），规避 Decky v3.2.6 之前子进程不继承 PATH 的问题
- 前端状态单例 + 4 秒轮询，QAM 与全屏页共用一份
- 所有 RPC 包 `_safe` 装饰器，错误以 `{"__bt_error__": "..."}` 回传前端

### Docs

- `docs/功能拓展与竞品调研.md`：118 个 Decky 插件全量扫描、硬约束（AVDTP SEP 限制）、三层路线图、参考来源

### Known Limitations

- 同一适配器同一时刻只能有一个 A2DP 源设备（AVDTP v1.3 §5.3 协议限制）
- 有 150–300ms 延迟（蓝牙 A2DP 固有）
- 编码以 SBC 为主
- 不支持麦克风回传
- **未在真机上验证**（polkit 是否放行 `deck` 用户调 `org.bluez` 待实测）

---

## [Unreleased]

见 [功能拓展与竞品调研](docs/功能拓展与竞品调研.md) 的路线图章节。
