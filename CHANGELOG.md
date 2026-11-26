# Changelog

本项目遵循 [语义化版本](https://semver.org/lang/zh-CN/)，格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)。

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
