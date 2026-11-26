# Changelog

本项目遵循 [语义化版本](https://semver.org/lang/zh-CN/)，格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)。

---

## [1.7.0] - 2026-11-26

AVRCP 元数据 —— Deck 屏幕不再黑着。

手机连上放歌后，QAM 里之前只知道「有个外部音源」。但 AVRCP 协议一直在传曲名 / 歌手 / 专辑 / 时长，BlueZ 已经解析好放在 D-Bus 上，只是没人读。

### Added

- **`metadata.py`**：读取 `org.bluez.MediaPlayer1` 的曲目信息
  - 路径：`/org/bluez/hci0/dev_XX_XX_XX_XX_XX_XX/player0`
  - 属性：`Track`（dict）、`Position`（毫秒）、`Status`
  - `parse_busctl_dict()` 手写 `a{sv}` 解析器（busctl 的输出格式没有现成库可用）
- **QAM 显示**：歌名 / 歌手 / 专辑、播放位置与总时长、播放状态徽章（播放中 / 已暂停 / 已停止）
- 状态指示点按 `playing` / 非 playing 区分明暗

### Design Notes

**读不到时静默降级，不报错。** 不是所有手机都实现 AVRCP 元数据（尤其部分 Android 自带播放器）。这不是错误，只是对方没提供 —— 报错反而会误导用户。

`busctl` 输出 `Track` 的格式形如：
```
a{sv} 3 "Title" s "夜曲" "Artist" s "周杰伦" "Duration" u 210000
```
没有现成的 Python 库能直接解析这个文本（`dbus-python` 在 Decky 冻结环境里 import 不到），所以手写了个正则解析器，覆盖 `s`/`u`/`i`/`x`/`t`/`q`/`o`/`b`/`d` 几种类型。

### Tests

- 新增 27 项元数据自检（路径构造、`a{sv}` 解析、缺失字段容错、状态文案、时长格式化）

---

## [1.6.0] - 2026-11-26

延迟档位 + 多输出同步。

### Added

- **`output.py`**：延迟档位与多输出配置
- **延迟档位**（三选一，显示估算 ms）
  - `low` 低延迟（约 60ms）：缓冲小，看视频口型更同步
  - `balanced` 均衡（约 120ms，默认）
  - `stable` 抗卡顿（约 240ms）：干扰环境下更稳
  - 用 `node.latency` + `bluez5.decode-buffer.latency` 实现
- **多输出同步**（`libpipewire-module-combine-stream`）
  - 创建虚拟 sink「Deck 多输出（同步）」，声音同时送到内置喇叭 + 蓝牙耳机 + 有线耳机
  - `combine.latency-compensate = true` 尝试对齐各流延迟
  - 用 match 规则动态匹配，新插入的设备也能自动加入
- 新增 RPC：`set_latency_profile` / `set_multi_output` / `list_outputs`
- 设置页新增延迟档位卡片与多输出开关

### Design Notes

**方向很重要。** 这是 Deck **同时推流到多个输出设备**（喇叭 + 多副耳机），不是「多个蓝牙源同时连 Deck」。

后者受协议限制做不到：AVDTP v1.3 §5.3 规定同一适配器上一个本地 SEP 只能连一个远端 SEP，PipeWire 作者 Wim Taymans 的提交原文是「bluez5: endpoint can be used only by one device at a time ... Trying to have it connected to multiple remotes either fails or causes misbehavior later on」（a58d815）。

UI 上直接把这句限制写出来了，避免用户误解。

### Tests

- 新增 22 项 output 自检（档位顺序、配置生成、指定/不指定 sink、开关状态、配置文件生命周期）

---

## [1.5.0] - 2026-11-26

均衡器 —— 占住 Decky 生态里 EasyEffects 的空白位。

调研确认：**Decky 生态没有任何 EasyEffects 包装**（GitHub 搜索 0 结果），而 Deck 自带喇叭与便宜蓝牙音箱的频响都不怎么样，EQ 是感知提升最大的一项。

### Added

- **`eq.py`**：基于 PipeWire 内置 `param_eq` 的均衡器
- **5 个预设**
  - `flat` 平直（关闭）
  - `bass` 低音增强（补 Deck 喇叭偏薄的低频）
  - `vocal` 人声清晰（抬中频、削低频浑浊，适合播客）
  - `bright` 明亮通透（抬高频细节，适合古典）
  - `loudness` 等响补偿（小音量下补两端，夜间用）
- **AutoEQ / Squiglink 曲线导入**：粘贴 `ParametricEQ.txt` 内容即可
  - 自动转换 `PK`/`LSC`/`HSC`/`LPQ`/`HPQ`/`BP` → PipeWire 的 `bq_peaking`/`bq_lowshelf`/`bq_highshelf`/...
  - 解析 `Preamp`，跳过 `OFF` 的行，报告无法识别的行数
  - 最多 20 段
- 新增 RPC：`set_eq_preset` / `remove_eq` / `import_autoeq`
- 新增「均衡器」标签页

### Design Notes

**为什么不用 EasyEffects？** 它是 flatpak，需要用户手动装 + 手动常驻（flatpak 版没配自动启动的 dbus service），还依赖一大堆 LSP / Calf / ZamAudio 插件。对「只想调个低音」的用户太重。

**为什么用 `param_eq`？** 它是 PipeWire **内置**的 builtin 滤波器，不依赖任何外部插件，纯配置文件，随 PipeWire 启动自动加载。`filters` 数组可以直接内联曲线，不需要外部文件。

**配置结构**：虚拟 sink（`Audio/Sink`，应用往这里输出）→ `param_eq` → 真实扬声器（`node.passive = true`）。

### Fixed

- `build_conf` 未知预设回退时，注释里写的还是传入的原名而不是 `flat`（测试抓到的）

### Tests

- 新增 30 项 EQ 自检（5 个预设的 type 合法性、配置生成、AutoEQ 三种类型转换、OFF 行跳过、垃圾输入、配置文件生命周期）

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
