# Changelog

本项目遵循 [语义化版本](https://semver.org/lang/zh-CN/)，格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)。

---

## [3.3.0] - 2026-11-28

**减轻系统压力：一次轮询从 17 个进程降到 8 个，顺便修掉一批手柄和稳定性问题**

这一版没有新功能，全部是「让它更省、更稳、更好按」。

### 1. 轮询开销减半（真机最直接的感受）

`status()` 是轮询主力，播歌时每 2 秒跑一次。原来一次要 fork
**约 17 个外部进程**，其中一大半是白烧的：

| 问题 | 原来 | 现在 |
|---|---|---|
| `pactl list cards` 在同一次调用里被读两遍 | 2 个进程 | 1 个 |
| `wpctl status` 被读两遍（音量 + sinks） | 2 个进程 | 1 个 |
| `pw-dump` 被读两遍（静音守卫 + A2DP 就绪） | 2 个进程 | 1 个 |
| 版本号每次轮询重查（一辈子不变） | 3 个进程 | 0（只查一次） |
| `busctl tree` 每次轮询重列（播放期间不变） | 1 个进程 | 0（缓存 8 秒） |
| 读曲目要发 3 条 `busctl get-property` | 3 个进程 | 1 条（多属性合并） |

**实现**：新增 `btutil.run_cached()` —— 一个只给**只读**命令用的
共享短缓存（TTL 1.5 秒）。它只覆盖「同一次 RPC 内的重复调用」，
不会让用户看到过期数据。写操作一律不走缓存。

> ⚠️ 顺手加了回归测试 `tests_perf.py`：把 `run_cmd` 换成记账版，
> 直接断言「同一条命令在一次轮询里只该跑 1 次」。这类问题改回去
> 不会报错，只会悄悄变慢，必须用测试锁住。

### 2. 能并行的都并行了

`status()` 原来是一串 `await`，总耗时 = 各命令之和。现在按依赖关系
拆成 4 个任务并发（适配器 / 音量 / 设备列表 / 编码器），总耗时
≈ 最慢的那一个。加上第 1 条的进程数下降，单次轮询的墙钟时间
明显缩短，于是播放档位从 4 秒提到 **2 秒**。

### 3. 进度条不再「一跳一跳」

真机反馈「歌词有点跟不上的感觉」。根因是位置每 4 秒才更新一次，
而播放位置本身是**匀速推进**的。

**修法**：新增 `src/progress.ts` —— 把后端给的位置当锚点，用本地
时钟往前插值，每 500ms 推进一次（只重渲染这一个组件，不碰后端）。
边界都处理了：暂停不推进、换歌/seek 以后端为准、不超过总时长。

### 4. 手柄用户终于能看到操作反馈了

这是本次最严重的问题。历史上 `Focusable` 同时挂了 `onClick` 和
`onActivate`，而两者**内容不一样**：

- `onClick` 是完整版（有 toast、有错误处理）
- `onActivate` 是简版（`catch { /* ignore */ }`，静默吞错）

Deck 上主要输入方式是手柄（走 `onActivate`），于是**手柄用户永远
看不到任何提示**，失败时界面毫无变化。更糟的是两个都挂会导致
双触发 —— 开关按一下等于按两下，看起来完全没反应。

**修法**：统一只留 `onActivate`，且用完整版（10 处）。

### 5. 改名和 EQ 导入在手柄下不可用

裸 `<input>` / `<textarea>` 不在 `Focusable` 树里，Steam 的手柄焦点
系统选不中，也唤不起软键盘。两个核心功能等于对柄用户不存在。

**修法**：都包进 `Focusable`，A 键聚焦输入框。

### 6. 息屏后可能永久黑屏（隐患）

`enterDim()` 第一步是 `Navigation.CloseSideMenus()`，它会让 QAM
面板立刻卸载；而卸载清理只做了 `clearTimeout`，**从不调
`undimScreen()`** —— 唯一的兜底（`max_seconds` 定时器）也跟着
组件一起被清掉。一旦遮罩唤醒链路失效，屏幕就永久黑着。

**修法**：用 `dimmedRef` 记住「背光是不是我们关的」，卸载时
一定还回去。

### 7. 其他修复

- **全屏页被误降频**：QAM 和全屏页共用一个可见性标志，QAM 卸载时
  会把仍在前台的全屏页降频到 30 秒（表现为播放进度半天不动）。
  改成**引用计数**。
- **合成层请求泄漏**：`useUIComposition` 在渲染期间做副作用且丢弃
  返回的 `releaseComposition`，每次渲染都多注册一条请求。改名为
  `acquireComposition`，在 effect 里调用并正确释放。
- **拖动滑杆打爆后端**：`SliderField` 只有 `onChange`（拖动中每格都
  触发），原来直接调后端 + `refresh()`，滑一下就是二十来次 RPC。
  改成停手 400ms 后才提交。
- **`refresh(force)` 绕过去重**：轮询进行中任何一次显式刷新都会再起
  一个 `status()`。改成「记下意愿，等当前请求结束再补一次」。
- **切走 tab 不停扫描**：后端会继续扫描到 20 秒超时，白占射频。
  卸载时主动 `scanStop()`。
- **「显示无名设备」偏好丢失**：存在组件内，切 tab 就重置。提到模块级。
- **呼吸点不动**：`animation: "pulse"` 引用了不存在的关键帧，改成
  `btPulse`。
- **诊断页加「合成层」一节**：旧版 loader 上遮罩压不住 Steam 顶栏，
  现在用户能自己看出来是环境限制而不是插件 bug。
- **补全 i18n**：硬编码英文（multi-output、resample、client too slow、
  `Profile：` 等）全部走 `t()`，新增 13 个 key（EN/ZH 各 239 个）。
- **清理死代码**：删掉 `route.ts` 整个文件、`IconButton`、`Dot`、
  三个按钮样式常量、7 个无人调用的导出。

### 升级提示

无配置变更，直接覆盖安装即可。

---

## [3.2.2] - 2026-11-28

**修曲名显示成反斜杠数字、状态徽章带 `s "` 前缀**

真机截图里两个明显的问题：

```
曲名：\347\272\257\351\237\263\347\272\257\351\237\263...
状态：s "playing
```

### 1. 曲名是一串八进制数字

**根因**：`busctl` 在非 UTF-8 locale 下会把非 ASCII 字节输出成
`\\NNN` 八进制转义。「纯音」的 UTF-8 是 `E7 BA AF E9 9F B3`，
busctl 给成 `\347\272\257\351\237\263`。插件直接把这串东西塞进界面。

**修法**：新增 `decode_octal_escapes()` —— 把连续的 `\\NNN` 收集成字节，
再**整体按 UTF-8 解码**。

> ⚠️ 关键：不能逐个字节 `chr()` —— 那会把多字节序列拆坏，
> 变成 `çº¯é³` 这种乱码。必须收集完再整体 decode。

### 2. 状态徽章显示 `s "playing`

**根因**：`busctl get-property ... Status` 返回的是 **`s "playing"`** ——
带 D-Bus 类型签名。早期代码只做了 `strip('"')`：

```python
status = (status_raw or "").strip().strip('"')   # -> s "playing   ❌
```

引号去掉了，但类型前缀 `s ` 和开头的引号还在。

**修法**：新增 `parse_busctl_string()` —— 先剥类型签名，再去外层引号，
最后解码八进制。`Position` 也用 `parse_busctl_uint()` 统一处理。

### 新增工具函数

| 函数 | 作用 |
|---|---|
| `decode_octal_escapes(text)` | `\\NNN` 八进制 → UTF-8 文本 |
| `parse_busctl_string(text)` | 解析单个字符串属性（剥签名 + 引号 + 解码） |
| `parse_busctl_uint(text)` | 解析无符号整数属性 |

### 测试

新增 25 项：

```
PASS  解码中文「纯音」
PASS  解码中英混合
PASS  解码单字符（é）
PASS  Status 去类型前缀
PASS  Status 无前缀也接受
PASS  Status 里带中文
PASS  Position 带前缀 / 无前缀 / 零 / 空 / None
PASS  parse_track 解出曲名（纯音）
PASS  parse_track 格式化时长（3:27）
...
```

其中一项是**回归锁**：用 `ast` 检查源码里**没有** `strip('"')` 这类
手工剥引号的调用。之所以用 AST 而不是字符串匹配 —— 第一版用字符串匹配时，
被 docstring 里引用的旧写法误报了。

### 验证

```
tests_offline / i18n(226) / api / rpc(48) / bundle / tsc / pack   全过
```

---

## [3.2.1] - 2026-11-28

**修「对端设备未提供曲目信息」—— 其实是我们自己没找到 player 路径**

### 现象

QAM 的「正在播放」卡片显示「对端设备未提供曲目信息」，但手机明明在放歌。

### 根因（两个都是我们自己的问题）

`metadata.py` 读 AVRCP 元数据时，**靠拼字符串猜 D-Bus 对象路径**：

```python
# 错误写法
return "/org/bluez/%s/dev_%s/player0" % (adapter, mac)   # adapter 硬编码 "hci0"
```

两个坑：

| 坑 | 说明 |
|---|---|
| **适配器名硬编码 `hci0`** | 多适配器 / 改名时路径就错了 |
| **player 编号猜 `player0`** | BlueZ 的 MediaPlayer 对象编号取决于注册顺序，可能是 `player1` / `player2` |

猜不中 → `busctl get-property` 返回非 0 → 代码认为「对端没提供元数据」→
界面显示「未提供曲目信息」。**而对端其实提供了。**

### 修复

1. **动态发现**：用 `busctl tree org.bluez` 列出系统里**真实存在**的
   MediaPlayer 路径，再按 MAC 匹配。

```python
paths = [p for p in await self._list_players() if mac_from_path(p) == want]
```

2. **兜底**：`busctl tree` 不可用时，退回拼路径，但把 `player0`~`player3`
   **都试一遍**，而不是只试 0。

3. 新增纯函数（可单独测试）：
   - `parse_player_paths(tree_text)` —— 从 busctl tree 输出提取 player 路径
   - `mac_from_path(path)` —— 从路径反推 MAC
   - `player_path(mac, adapter, index)` —— 支持任意编号

4. 找不到时**记日志**（写清楚是「对端可能不支持 AVRCP」还是「路径没匹配上」），
   下次排查不用再猜。

### 测试

新增 13 项：

```
PASS  player_path 默认 player0
PASS  player_path 支持 player2
PASS  非法 MAC 返回空
PASS  解析出 2 个 player 路径
PASS  认出 player0
PASS  认出 player1（编号非 0）
PASS  从路径取 MAC
PASS  从 hci1 路径也能取
PASS  非 player 路径返回空
PASS  源码里有动态发现（_list_players）
PASS  源码里会尝试多个 player 编号
...
```

后两项是**回归锁**：防止有人把逻辑改回「只拼 player0」。

### 验证

```
tests_offline / i18n(226) / api / rpc(48) / bundle / tsc / pack   全过
```

---

## [3.2.0] - 2026-11-28

**QAM 的「正在播放」改成纯信息卡片；删掉不起作用的外部源音量**

### 1. 同一个面板里有两套音量控件

**现象**：QAM 上半是「正在播放」卡片，里面带 `−10% / 静音 / +10%`；
下面又是整排主音量 `−10% / −5% / 静音 / +5% / +10%`。

**真机反馈**：「这个的音量控件和下边音量调节重复了」。

**修法**：把「正在播放」改成**纯信息卡片** —— 去掉全部按钮，换成：

- 曲名（加粗）+ 歌手 · 专辑
- 播放状态点（播放中常亮、暂停变暗）
- 来源徽章（外部音源 / 播放中）
- **进度条 + 左右时间**（原来是干巴巴一行 `01:23 / 04:56`）
- 对端不提供元数据时给一句说明，卡片不至于空着

### 2. 删掉「外部源独立音量」—— 它根本不起作用

**真机反馈**：「它并不能控制我手机音量大小」。

**根因**：这个功能调的是 **Deck 端 PipeWire 里 `bluez_input` 节点的增益**，
而手机音量是**手机自己通过 AVRCP 控制的** —— 两者根本不是同一个东西。
所以这个 UI 不但多余，还会误导用户以为能遥控手机音量。

**删除范围**（只删对外暴露的入口）：

| 位置 | 删除内容 |
|---|---|
| `main.py` | `set_source_volume` / `step_source_volume` / `set_source_mute` 三个 RPC |
| `backend.ts` | `stepSourceVolume` / `setSourceMute` 两个方法 |
| `Speaker.tsx` | 卡片里的三个按钮（已改成纯信息卡片） |

**⚠️ 刻意保留** `bt.py` 的 `Wp.get_volume_of / set_volume_of / step_volume_of / set_mute_of`：

它们还被 `boost_volume`（一键增益）和 `_apply_auto_gain`（自动增益）用着。
那是「把偏轻的音源在 Deck 端整体拉响」，**效果真实存在**，
和「遥控手机音量」是两回事，不能一起删。

### 3. 顺带清理

- 删掉 9 个确认无引用的 i18n key（`qam.boost` / `qam.boosted` /
  `qam.clipping` / `qam.dimHint` / `common.cancel` / `dev.connecting` /
  `dev.notConnected` / `dev.pairedTag` / `dev.searching`）
- 清掉因此变成死代码的 `act2` 辅助函数
- i18n key 总数 235 → 226
- **修复 CHANGELOG 本身**：开头有两条编码损坏的重复条目（2.0.3 / 2.0.1
  @ 2026-11-26），已删除；缺失的 3.1.1 已补上

> 注意：`codec.*` / `eq.*` / `lat.*` / `tab.*` 在静态扫描里「看不到引用」，
> 但它们是**动态翻译**（后端返回 key，前端 `t(p.label_key)`），属正常用法，没有删。

### 验证

```
tests_offline / i18n(226) / api / rpc(48) / bundle / tsc / pack   全过
```

RPC 数量从 51 降到 48，与删除的 3 个一致。

---

## [3.1.1] - 2026-11-28

**补上真机截图（已打码）+ 填好商店封面图**

### Added

- **9 张真机截图**（1280x800，英文界面），按功能归类到 `docs/screenshots/`：
  均衡器预设 / QAM 上下半 / 设备与配对 / 设置 / 编码器 /
  音频焦点 / 音量归一化与延迟 / 行为与系统信息

  每张都配了说明，完整清单见 `docs/screenshots/README.md`。

- README 新增「Screenshots / 截图」区（中英各一份），嵌入 6 张关键图。

### 隐私处理

截图里包含真实设备信息，全部做了处理：

| 项目 | 出现在 | 方式 |
|---|---|---|
| Steam 头像（右上角） | 全部 9 张 | 像素化 |
| 蓝牙适配器 MAC 地址 | 04、05 | 像素化 |
| 已配对设备名 | 04 | 像素化 |
| 家目录路径 `/home/deck/` | 05 | 像素化 |
| 游戏库背景封面 | 02、03 | 高斯模糊 |
| 第三方截图工具浮层 | 06 | 改用同页无浮层版本 |

> **一次自查失误记录**：第一版想用「饱和度」判断是否像素化 —— 错的。
> 像素化只是把颜色**平均成块**，色块仍有颜色，饱和度照样高。
> 改用「原图 vs 成品逐像素比对 + 颜色数下降」才靠得住。

### Fixed

- **`plugin.json` 的 `publish.image` 指向不存在的文件**

  原本是 `docs/screenshot.png` —— 该文件根本不存在，商店提交会被直接拒。
  现在指向 `docs/screenshots/02-qam-panel-top.jpg`（真实截图）。

---

## [3.1.0] - 2026-11-28

**修「切英文界面后预设列表还是中文」+ 配置文件注释改中英双语**

### 1. 预设列表没英文化

**现象**：真机截图——界面切成英文后，三个预设列表仍然整块中文：

- 音质预设：`均衡（推荐）` / `音质优先` / `稳定优先`
- 延迟档位：`低延迟` / `均衡（推荐）` / `抗卡顿`
- EQ 预设：`平直（关闭）` / `低音增强` / `人声清晰` / `明亮通透` / `等响补偿`

**根因**：后端直接返回了中文字符串，前端只是原样显示。

```python
# quality.py —— 错误写法
CODEC_PRESETS = {
    "balanced": {
        "label": "均衡（推荐）",              # ← 后端返回中文
        "desc": "SBC-XQ + AAC，音质与兼容性兼顾",
        ...
```

**这和 v2.5.0 修过的「自检项返回中文」是同一类问题** —— 当时只修了自检项，
漏了这三个预设列表。

**修法**：后端只返回 i18n key，文案由前端按当前语言翻译。

```python
CODEC_PRESETS = {
    "balanced": {
        "label_key": "codec.balanced",
        "desc_key": "codec.balancedDesc",
        ...
```

前端：

```tsx
<div>{t(p.label_key)}</div>
<div>{t(p.desc_key)}</div>
```

新增 36 条 i18n 文案（中英各 18 条）：`eq.*` / `codec.*` / `lat.*`。

### 2. 配置文件注释改中英双语

这些 `.conf` 文件会留在用户的 `~/.config` 里（`50-bt-speaker.conf` 等）。
英文用户打开看到一屏中文注释会一头雾水。

改成每条注释 `# English / 中文` 双语形式，涉及 5 个模板：

| 文件 | 模板 |
|---|---|
| `bt.py` | `WP_CONF_TEMPLATE`（音箱优化） |
| `quality.py` | 音质配置 |
| `output.py` | 延迟配置 / 多输出（启用）/ 多输出（关闭） |
| `eq.py` | 均衡器配置 |

> Python 源码里的注释**没有动** —— 那是给开发者看的，双语反而增加噪音。
> 只有**写进用户目录**的内容才需要双语。

### 3. 顺带修掉一个真 bug

`current_preset()` / `current_latency()` / `current()` 三个方法用正则从
配置文件的注释里**反推当前预设**：

```python
m = re.search(r"预设：(\w+)", text)      # ← 匹配全角冒号
```

注释改成 `Preset / 预设: bass`（半角冒号 + 中英双语）后，这个正则匹配不到，
表现为**「切完预设再打开页面，选中状态丢了」**。

修法：新正则同时兼容两种格式：

```python
m = re.search(r"(?:Preset / 预设|预设)[:：]\s*(\w+)", text)
```

> 这个 bug 是跑测试时发现的（3 个 `current_*` 反推测试失败）。
> 如果只改注释不改正则，它会静默失效 —— 用户不会看到报错，只会觉得「设置没保存」。

### 4. 新增回归测试

`tests_i18n.py` 新增 7 项检查，专门锁住这类问题：

```
PASS  quality.py 无中文 label/desc 字面量
PASS  quality.py 使用 *_key 字段
PASS  output.py 无中文 label/desc 字面量
PASS  output.py 使用 *_key 字段
PASS  eq.py 无中文 label/desc 字面量
PASS  eq.py 使用 *_key 字段
PASS  预设 key 全部有翻译
```

原理：正则扫描后端源码，找形如 `"label": "含中文"` 的字面量。
已验证它能抓到旧写法、放行新写法。

### 验证

```
tests_offline.py   全部通过（10 项断言已同步更新到新结构）
tests_i18n.py      234 key 一致（原 212 + 新增 22）
tests_api.py       接口自检通过
tests_rpc.py       51 个 RPC 无代码级错误
tests_bundle.py    8 项全过
tsc --noEmit       exit 0
pack.py            22 文件
```

---

## [3.0.1] - 2026-11-28

**修 v3.0.0 的崩溃：`AttributeError: 'DimSession' object has no attribute 'session'`**

### 问题

真机一打开插件就报错，QAM 面板完全不可用。

### 原因

v3.0.0 把 `DimSession` 实例存进 `self.dim`，但调用处写成了：

```python
self.dim.session.screen_status()   # ❌ self.dim 本身就是 DimSession
```

把 `self.dim` 当成「容器」了，而它实际就是会话对象本身。
5 处调用全错，任何一条都会炸。

**为什么测试没抓到？** —— 这是这一版真正的教训：

| 检查 | 结果 | 为什么没抓到 |
|---|---|---|
| `tests_offline.py` | 全绿 | 它测的是**纯函数**（解析、状态机），从不访问 `self.dim` |
| `tests_i18n.py` | 全绿 | 只管文案 |
| `tests_bundle.py` | 全绿 | 只加载前端产物，不碰 Python |
| `tsc` / `rollup` | 全绿 | TypeScript 看不到 Python |
| `pack.py` | 全绿 | 只检查文件结构 |

**没有任何一处真正去访问那个属性。** 静态检查（`py_compile`）也查不出——
`self.dim.session` 是合法的 Python 语法，只是运行时才发现属性不存在。

### Fixed

- 5 处 `self.dim.session.xxx()` 改为 `self.dim.xxx()`
- `DimSession` 新增 `inhibit_dict()`：`diagnose()` 需要同步取抑制锁状态，
  原来直接在 `main.py` 里穿透访问 `self.dim.session._inhibitor.status()`，
  既用错了层级、又暴露了私有属性

### Added

- **`tests_api.py`：接口自检**

  用 `ast` 解析 `main.py`，收集所有 `self.X` 的**读取**与**赋值**，
  然后检查每个读取是否都能在「类属性 ∪ `_main()` 里赋值的实例属性」里找到。
  这样 `self.dim.session` 这种「访问了不存在的属性」能被静态抓出来。

  另附：`DimSession` 的公开方法清单校验、`self.dim.session` 写法的回归锁。

- **`tests_rpc.py`：RPC 冒烟测试**

  真正实例化 `Plugin`，把外部依赖（`bluetoothctl` / `wpctl` / `pactl`）
  全部 mock 掉，然后**挨个 `await` 全部 51 个 RPC**。

  判定标准很重要：返回 `__bt_error__` **不算失败**（环境里没蓝牙，报错正常）。
  真正的失败是出现 `AttributeError` / `NameError` / `TypeError` 这类**代码错误**。

  第一次跑就抓出 5 个问题（其中 4 个是我假对象写错、1 个是参数签名不符），
  说明这个测试确实在起作用。

- **`_decky_stub.py`**：`decky` 模块的最小桩，让上面两个测试能在开发机上
  导入 `main.py`（真机上 Decky 会注入，开发机没有）

- `tsconfig.json` 开启 `noUnusedLocals`：重构中漏掉的未使用 import
  现在会直接编译报错

### 顺带修的（都是 v3.0.0 重构的疏漏）

- **`SettingsTab` / `EqTab` 根本没迁移到 token** —— 它们只是被搬了个位置，
  里面还有 27 + 8 处硬编码样式（`padding: "12px 14px"`、`borderRadius: 11`、
  `fontSize: 14.5`）。v3.0.0 的 CHANGELOG 说「样式全部收敛」是不准确的，
  实际只改了 `DevicesTab` 和 `DiagTab`。现在补齐：27 → 0、8 → 0。
- **大量未使用 import** —— 拆文件时给每个文件套了同一份 import 模板，
  `SettingsTab` 里有 5 个、`DiagTab` 里有 3 个从未使用。已全部清除。
- **`Speaker.tsx` 里 `dimmed` 状态只写不读** —— 遮罩移到全局组件后，
  QAM 面板不需要知道息屏状态。删掉这个死状态。

### 验证

```
python tests_api.py       接口自检全部通过
python tests_rpc.py       51 个 RPC，无代码级错误
python tests_offline.py   全部通过
python tests_i18n.py      212 key 一致
python tests_bundle.py    8 项全过
tsc --noEmit              exit 0（已开 noUnusedLocals）
pack.py                   自检 1~9 全过，22 文件
```

另做了**产物验证**：解包 zip，确认 `main.py` 里 8 处 `self.dim.*` 调用
全部对应 `dimsession.py` 的真实方法，且无 `self.dim.session` 残留。

---

## [3.0.0] - 2026-11-28

**结构与视觉重构：不改功能，只让代码和界面变得可维护**

这一版**没有新增任何功能，也没有修 bug**。改的全是「内在质量」——
拆文件、收敛样式、删死代码。之所以跳大版本号，是因为文件结构变了
（后端多了一个模块、前端 views 下多了一层目录），对后续维护有实质影响。

### 重构前的问题

| 文件 | 行数 | 问题 |
|---|---|---|
| `main.py` | 1608 | 8 类职责混在一起：息屏 / 睡眠恢复 / A2DP / 音量 / EQ / 诊断… |
| `bt.py` | 962 | （本次未动，见下方「为什么没拆」） |
| `BtSpeakerPage.tsx` | 1255 | 4 个 Tab 的内容全塞在一个文件里 |

样式更乱。同一个「胶囊按钮」在不同地方有 **3 种 padding**：

```
padding: "7px 14px", borderRadius: 18   ← 信任 / 修复 / 移除
padding: "7px 16px", borderRadius: 18   ← 连接按钮
padding: "8px 16px", borderRadius: 18   ← 诊断页按钮
```

同一种卡片有 `10px 12px` / `11px 14px` / `12px 14px` 三种；
字号有 11 / 11.5 / 12 / 12.5 / 13 / 13.5 / 14.5 / 15 / 18 九种。
肉眼看得出「不齐」，但改的时候又不敢动 —— 因为不知道哪处是刻意的。

### Added

- **`src/theme.ts`：设计令牌层**

  颜色 / 间距（4px 栅格）/ 字号（9 种收敛到 6 种）/ 圆角，
  外加组合样式（`CARD_STYLE` / `PRIMARY_BTN_STYLE` / `ELLIPSIS` 等）。

  ⚠️ 设计原则：**token 只描述视觉，不描述语义**。
  不写 `buttonPrimaryPadding` 这种名字 —— 那样加个新按钮就得加个新 token。
  用 `SPACE.md` / `FONT.body` / `RADIUS.md` 这类「量」的名字组合出样式。

- **`src/styles.ts`：全局样式注入**

  React 内联 style 不支持 `@keyframes` 和 `::-webkit-scrollbar`，
  而这两样是「界面看起来精致」的必要条件：状态点的呼吸动画、
  深色滚动条（默认浅色条在深色界面上非常刺眼）。

  用 `<style>` 注入而不是 CSS 文件，因为 Decky 的 rollup 对 .css 的处理
  取决于 loader 版本，`<style>` 在所有版本上都可靠。注入幂等，卸载时移除。

- **`dimsession.py`：息屏会话**

  把散在 `main.py` 里跨 200 多行、7 个方法的息屏逻辑收进一个类：
  `dim_screen` / `undim_screen` / `_start_dim_guard` / `_keep_link_alive` /
  `get_screen` / `get_screen_diag` / `get_inhibit`。

  为什么值得单独成类？因为它们共享 3 个状态（`dimmer` / `inhibitor` /
  定时器）且**有严格顺序要求**：先拿抑制锁再关屏、先开背光再放锁。
  散着写时这些约束只存在于注释里，后续改动很容易破坏。
  收进一个类后只有一条路径，漏掉清理变得不可能。

  新增测试**专门锁住顺序**：
  ```
  PASS  enter 先 hold 再 dim
  PASS  exit 先 restore 再 release
  PASS  拿锁失败仍息屏（但如实汇报）
  ```

- **`src/views/page/`：按 Tab 拆分全屏页**

  `DevicesTab` / `SettingsTab` / `EqTab` / `DiagTab` 各自一个文件，
  主页面退化成 154 行的壳层（布局 + 头部 + Tab 切换）。

### Changed

- **`components.tsx` 重写为统一的控件库**

  一种控件只有一种尺寸：`Btn` 组件接管所有按钮，需要不同视觉重量就换
  `variant`（primary / ghost / danger / ok）+ `small`，不再自己写 style。
  新增 `Toggle` / `ToggleRow` / `GroupTitle` / `Dot` / `Stack` / `Row`。

- **设备行的按钮分层**：原来「连接 / 信任 / 修复 / 移除」4 个同样大小的
  按钮挤在一行，Deck 屏幕上很挤。现在「连接」是主操作（大按钮），
  其余三个收成 `small` 尺寸。

- **QAM 面板（`Speaker.tsx`）也迁到新 token**：字号从 6 种收敛到 3 种，
  圆角统一。

- `route.ts` 退化成 re-export（颜色移入 `theme.ts`），保留兼容。

### Removed

- **`Speaker.tsx` 里的音量同步死代码**

  `vol` / `srcVol` / `dragging` / `dragTimer` / `settleTimer` / `srcTimer`
  这套状态是「滑杆时代」留下的。v2.4.3 改用相对调节按钮后，
  它已经完全不参与逻辑了 —— `changeVolume` / `showVol` / `volFailed`
  三个标识符在整个文件里只出现 1 次（就是定义处）。
  删掉约 60 行死代码。

- `main.py` 里的 `dimmer` / `inhibitor` / `_dim_task` 三个属性，
  以及 `_start_dim_guard` / `_keep_link_alive` 两个方法（已移入 `dimsession.py`）。

### 测试

- 新增 `test_dimsession`（14 项）：用假对象验证顺序约束、幂等性、
  「拿锁失败不算息屏失败」、无 dimmer 时不崩
- `tests_i18n.py` 改为**递归扫描** `src/` 下所有 `.tsx`/`.ts`。
  原来写死了 3 个文件路径，拆目录后漏掉了 `views/page/*`，
  表现为「源码有引用」从 184 掉到 39
- `tests_i18n.py` 增强行内注释识别：原来只判断「整行是否以 `//` 或 `/*`
  开头」，所以 `} catch { /* 中文 */ }` 和 `const X = 1;  // 中文`
  会被误报成硬编码中文

### 为什么没拆 bt.py

`bt.py`（962 行）里是 `BlueZ` 和 `Wp` 两个类，各约 500 行。
它们虽然大，但**内聚度很高**（一个是蓝牙封装，一个是 PipeWire 封装），
再拆会变成「为拆而拆」——比如把 `device_action` 的十几个 action
拆到不同文件，读代码时要来回跳。

本次优先拆的是「职责混杂」的地方（`main.py` 的 8 类职责、
`BtSpeakerPage.tsx` 的 4 个 Tab），那些是真正的痛点。

### 验证

```
python tests_offline.py   全部通过（含新增 14 项 DimSession 测试）
python tests_i18n.py      212 key 一致，178 处引用全部有定义
python tests_bundle.py    8 项全过
tsc --noEmit              exit 0
pack.py                   自检 1~9 全过，22 文件
```

---

## [2.9.3] - 2026-11-27

**修「息屏后还显示 QAM 面板」+ 「音频在放却一直说协商中」**

两个真机反馈的 bug，根因都是**本鱼用错了数据源/层级**。

### 1. 息屏了，但 QAM 面板还亮着

真机截图：屏幕暗下来了，但右侧 QAM 面板整块可见，还显示着插件内容。

**根因**：QAM 面板在 Steam 的 `OverlayQAM` 合成层（枚举值 5），
而遮罩只提到了 `Overlay`（值 2）—— 层级比 QAM 低，自然被压住。

**修法（两层）**：

1. **进息屏时先收起 QAM**：调 `Navigation.CloseSideMenus()`
   （MagicBlack 也是这么干的）。这样屏幕上只剩游戏画面，遮罩能完整盖住。
2. **遮罩提到 `OverlayQAM` 层**：和 QAM 同层，即使 QAM 又弹出来也压不住它。

为什么两层都要？因为第 1 步是「尽量」—— 用户可能在遮罩显示后又按 QAM 键。
第 2 步保证那种情况下屏幕仍是黑的（而按 QAM 本身会触发输入监听 → 自动唤醒）。

### 2. 音频还在放，界面却一直显示「正在协商」

v2.9.1 加的「强判据」是：在 `wpctl status` 输出里搜 `bluez_input`。

**这个判据永远返回 False** —— 因为：

```
wpctl status 显示的是节点的**友好名**：
    Sources:
        49. Built-in Audio Microphone [vol: 1.00]
        51. Ciallo [vol: 0.80]        <- 蓝牙输入，但名字是设备名

真正带 bluez_input.MAC 的是 node.name 属性，只能从 pw-dump 拿
```

所以判据压根没生效，界面永远说「正在协商」。

**修法**：改用 `pw-dump` 读 `node.name` ——
和 `silence.py` 里 `parse_node_states` 用的是同一个可靠来源
（那边早就在用了，本鱼这里重复踩了一遍）。

### 顺带修掉一个更隐蔽的老 bug

**`nodes.find_bt_input()` 一直是坏的**，同样的原因：它在 `wpctl status`
的 Sources 分节里搜 `bluez_input`，而那里只有友好名。

后果：「谁在放歌」「外部音源独立音量」这两块功能**从来没有真正生效过** ——
`live` 一直是 `None`。这个 bug 从 v1.2.0 就存在，一直没被发现，因为
界面上「外部音源」那块只是不显示，不报错。

修法：保留 `bluez_input` 匹配（某些 PipeWire 版本会显示 node.name），
再加**兜底**：Sources 里凡不是内置设备的（名字不含 `built-in` /
`alsa_input` / `internal`），就认为是外部蓝牙输入。

### 测试

新增 12 项，其中两项是**回归锁**：

- `wpctl 友好名里确实没有 bluez_input` —— 如果有人把判据改回
  「在 wpctl status 里搜」，这条会立刻失败并提醒他行不通
- `只有内置设备时不误判` —— 确保兜底逻辑不会把内置麦克风当成蓝牙输入

其余覆盖：`pw-dump` 节点列表解析、按 MAC 过滤、横线 MAC 匹配、
文本降级路径、`_has_bluez_input` 对空列表 / None 的安全性。

---

## [2.9.2] - 2026-11-27

（此版本未单独发布，修复已并入 v2.9.3）

---

## [2.9.1] - 2026-11-27

**修「音频已经能放了，界面还一直显示正在协商」**

### 现象

真机反馈：接上音频之后，QAM 面板仍然显示「正在协商音频（A2DP）…」，
而且一直不消失。

### 原因

v2.9.0 判断「就绪」**只看一个判据**：`pactl list cards` 里
`Active Profile` 是不是 `a2dp-sink-*`。

这个判据不可靠 —— 有些对端（尤其 Windows）协商完成后，`Active Profile`
仍可能显示成别的名字，或者 `pactl` 输出格式和正则对不上，
于是插件认为「还没就绪」，而实际音频早就通了。

### 修复

**加了第二个、更强的判据**：PipeWire 里有没有 `bluez_input.<MAC>` 节点。

为什么这个更可靠？—— 那个节点是 **A2DP 流真的建起来才会出现的**
（PipeWire 在 transport 启动时才创建它），拿它当判据几乎不会误判。
`pactl` 的 profile 名只是一个「配置意图」，节点存在才是「流真的通了」。

现在两个判据**任一成立**就算就绪：

| 判据 | 可靠性 | 说明 |
|---|---|---|
| `bluez_input` 节点存在 | **强** | 流真建起来才有，几乎不会误判 |
| 卡片 profile 是 `a2dp-sink` | 弱 | 有些对端会显示成别的名字 |

### Added

- `a2dp.has_input_node(mac)` / `a2dp._has_bluez_input(text, mac)`：
  用 `wpctl status` 判断有没有 `bluez_input` 节点（纯函数可单独测试）
- `status()` 的 `a2dp` 字段新增 `via`：`node` / `profile` / 空串，
  说明「凭什么认为就绪」—— 下次再遇到「显示不对」可以直接看这个值定位
- `wait_for_sink()` 的返回值同样带上 `via`

### 测试

新增 9 项节点判据测试：

- 识别 `bluez_input` 节点 / 没有时返回 False / 空输入与 None 不崩
- 按 MAC 过滤：匹配的算、不匹配的不算
- 不传 MAC 时任何 `bluez_input` 都算（AVDTP 只允许一台设备当接收端）
- **横线写法 MAC 也能匹配**（复用 `normalize_mac`，和 v2.9.0 那个 bug 同一类）

---

## [2.9.0] - 2026-11-27

**A2DP 协商过程变得可见，并在卡住时能一键补救**

### 现象

真机反馈：「连接了，但是电脑好像没有把它识别为音箱」，
补充说明是「要一段时间才能识别为音箱」。

### 这不是 bug，是协议流程本身要时间

`bluetoothctl connect` 返回时只完成了第一步：

```
1. ACL 链路建立          bluetoothctl connect 返回时完成   ← 以前插件到这里就说「已连接」
2. SDP 服务发现          对端要知道 Deck 提供 A2DP Sink
3. AVDTP 能力协商        交换 SEP / 编码器能力，选定 codec
4. WirePlumber 建卡      创建 bluez_input.<MAC>、切到 a2dp-sink profile  ← 到这里才算「能放歌」
```

第 2~4 步的耗时取决于对端实现，实测常见 1~6 秒。PipeWire 官方在
[MR !1107](https://gitlab.freedesktop.org/pipewire/pipewire/-/merge_requests/1107)
里把 device profile 超时从 3 秒**加到 6 秒**，理由正是：

> In some cases, BlueZ can take more than the previous 3sec to connect all profiles.

[bluez#205](https://github.com/bluez/bluez/issues/205) 也说明了原因：
两端可能同时抢着连 profile，AVDTP 命令来回要好几秒。

**所以以前的体验问题是**：插件发完 `connect` 立刻返回「已连接」，
用户去电脑里找音箱找不到，就以为坏了 —— 而它其实正在协商。

### Added

- **`a2dp.py`：等待 A2DP Sink 就绪**

  - 连接后轮询 `pactl list cards`，一旦 `a2dp-sink` profile 生效就**立刻返回**
    （不必死等固定时长），并汇报实际耗时
  - 超过 4 秒还没就绪就**主动切一次 profile** —— 有时 WirePlumber 建好了卡
    却把 profile 留在 `off` 或停在 HFP，单纯等是等不好的，必须显式
    `pactl set-card-profile`。这是社区脚本里最有效的补救手段
  - 12 秒仍不就绪也**不报错**，返回 `ready=False` + 原因
    （`negotiating` / `no-card` / `wrong-profile`）

  ⚠️ 设计约束：**未就绪不等于失败**。蓝牙协商慢是常态，报错只会误导用户。

- **界面显示「正在协商音频（A2DP）…」**

  QAM 面板在「已连接但 profile 还没就绪」时显示这个状态 + 说明文字，
  而不是干巴巴一个「已连接」。同时提供一个「强制切到 A2DP 接收模式」按钮，
  协商卡住时手动补救。

- **`status()` 新增 `a2dp` 字段**

  轮询里顺带读一次卡片状态。为什么需要？因为用户可能在**电脑那边**发起连接
  （不是从插件里点连接），那时 `device_action` 根本没被调用，
  插件不知道协商进行到哪一步。开销：一次 `pactl list cards`，
  且只在「有设备已连接」时才跑。

- 新增 RPC：`wait_a2dp`（可反复调用来刷新）、`fix_a2dp`（强制切 profile）

### Fixed

- **`a2dp.parse_cards` 的 MAC 匹配只认冒号写法**

  写测试时发现的：原来用 `mac.replace(":", "_")`，遇到横线 / 点分 / 小写
  的 MAC 就匹配不上。改成复用 `btutil.normalize_mac()` ——
  和 v2.5.3 修「设备地址不合法」是同一个坑，那次只修了 `bt.py`，漏了这里。

### 测试

新增 30 项 A2DP 测试，重点是**边界语义**：

- `a2dp-sink` / `a2dp_sink`（下划线写法）都算就绪
- `off` / `headset-head-unit` / 空 / `a2dp-source` **都不算就绪**
  —— 尤其是 `a2dp-source`（Deck 推给耳机，方向相反），不能误判成接收端就绪
- 挑 profile 时优先 SBC-XQ > LDAC > AAC > aptS > SBC；
  **没有 sink profile 时返回空串，绝不瞎选 `a2dp-source`**
- 等待上限 ≥ 6 秒（PipeWire 自己的超时）且 ≤ 30 秒
- 修复时机必须早于超时

---

## [2.8.3] - 2026-11-27

**界面显示版本号；新增「产物冒烟测试」**

### 背景：为什么还要一版

v2.8.2 已经修好了 `DFL.findVar` 崩溃，但真机装上去**报的还是同一个错**。
排查时最难受的一点：**没法确认用户机器上跑的到底是哪一版** ——
界面里没有任何版本信息，只能靠截图时间、界面有没有新功能去猜，
而「CEF 缓存了旧 `dist/index.js`」和「代码没修好」在现象上完全一样。

所以这一版不猜了，直接把「能证明版本的东西」和「能证明产物不会崩的测试」都做出来。

### Added

- **QAM 面板底部显示版本号 + 构建时间**

  形如 `v2.8.3 · 11-27 22:04`。如果这里显示的不是最新版本，
  就说明装的是旧包、或前端缓存了旧脚本 —— 不用再猜。

  实现：`rollup.config.js` 里一个极小的插件，在 `intro` 阶段注入
  `var __BT_META__ = {"version":"...","build":"..."};`。

  ⚠️ 踩了一个坑记录在此：第一版是用正则替换标识符 `__BT_VERSION__`，
  结果把**字符串字面量**里的同名内容也替换了
  （`name === "__BT_VERSION__"` → `name === ""2.8.3""`），
  生成非法语法、构建直接失败。字符串替换天然分不清标识符和字符串内容，
  改成注入一个普通对象就完全没这个问题。

- **`tests_bundle.py`：产物冒烟测试**

  静态检查（4 项）+ **真·加载测试**（4 项）：

  1. 造一个只有基础 UI 组件、**没有 `findVar` / `findModuleExport`** 的假 `DFL`
     —— 正是 v2.8.0 崩掉的那台机器的环境
  2. 真的 `import()` 打包产物，看它能不能加载完成
  3. 断言错误信息里**不出现** `findVar is not a function`
  4. 检查版本号注入是否生效、是否与 `package.json` 一致

  这是 `tsc` 和 `rollup` 都查不出来的那一类问题
  （`@decky/ui` 的类型声明里有 `findVar`，编译期一切正常）。

- `pack.py` 新增自检 9：产物里必须有 `__BT_META__`，
  且 `version` 与 `package.json` 一致 —— 防止「忘了重新构建就打包」，
  那种情况下界面显示旧版本号，会把人带进沟里。

### 验证

```
产物静态检查
  PASS  顶层无危险 DFL 调用
  PASS  有 typeof 函数判断
  PASS  有 __BT_META__ 注入
  PASS  注入的 version 非空
  PASS  注入的 build 非空
  PASS  version 与 package.json 一致

在「旧版 loader」假环境中加载产物
  PASS  产物能在无 findVar 环境加载
  PASS  没有 'findVar is not a function'
```

---

## [2.8.2] - 2026-11-27

**修复 v2.8.0 / v2.8.1 导致插件完全无法加载的事故**

### 现象

真机截图：打开 QAM 面板直接报错，连插件界面都出不来。

```
错误
TypeError: DFL.findVar is not a function
    at http://127.0.0.1:1337/plugins/Bluetooth Speaker/dist/index.js

加载 Bluetooth Speaker 时引起了上述异常。这通常意味着插件需要更新
以适应 SteamUI 的新版本。
```

### 原因

v2.8.0 为了做息屏遮罩，引入了 `src/uiComposition.ts`，里面有这么一行：

```ts
const resolvedHook = findVar(isUICompositionHook) ?? findModuleExport(isUICompositionHook);
```

它在**模块顶层**执行。rollup 用 `external-globals` 把 `@decky/ui`
映射成全局对象 `DFL`，所以产物变成：

```js
const resolvedHook = DFL.findVar(isUICompositionHook) ?? DFL.findModuleExport(isUICompositionHook);
```

而 `findVar` 是 `@decky/ui` **5.x** 才有的 API。用户机器上那版 Decky loader
提供的 `DFL` 对象里**没有这个函数**（但 `PanelSection` 等组件都在，所以
`DFL` 本身是存在的）。于是模块一加载就抛 `TypeError`，
**整个插件包挂掉** —— 不只是遮罩不工作，是插件完全打不开。

`@decky/ui` 的类型声明里确实写了 `findVar`（我们的 `node_modules` 是 5.0.2），
所以 `tsc` 检查通过、构建也没报错。**类型检查查不出「运行时没有」这件事。**

### 修复

1. **`uiComposition.ts` 全部重写**：所有对宿主 API 的访问都改成
   - 惰性（第一次真正用到时才解析，不在模块顶层）
   - 带 `typeof === "function"` 判断
   - 包在 try/catch 里
   - 逐级降级：`findVar` → `findModuleExport` → `findModuleChild` → 放弃

2. **遮罩改挂全局组件**（`routerHook.addGlobalComponent`）

   顺便解决了 v2.8.0 遗留的「遮罩盖不住顶栏」问题。原因不是 z-index 不够，
   而是 QAM 面板的 DOM 被 Steam 容器包着、容器带 `transform`，
   会让 `position: fixed` 的包含块退化成那个容器。
   挂到 Steam UI 顶层的 React 树里才不受祖先布局影响
   （参考 [steam3d/MagicBlackDecky](https://github.com/steam3d/MagicBlackDecky) 的 `BlackOverlay`）。

   新增 `src/dimState.ts` 作为 QAM 按钮与全局遮罩之间的共享状态。

3. **`pack.py` 新增自检 8：禁止在模块顶层裸调宿主 API**

   静态扫描产物里「缩进为 0 的行」，只要出现 `DFL.<不在白名单里的名字>`
   就拒绝打包，并打印修法。已验证：**旧的错误写法会被拦住，
   新写法能通过**。

   白名单只放所有 loader 版本都保证存在的 UI 组件
   （`PanelSection` / `Focusable` / `Navigation` 等）。

### 教训

- **类型检查通过 ≠ 运行时存在**。宿主（loader / Steam）注入的全局对象
  必须按「可能缺字段」对待，永远先 `typeof` 判断
- **不要在模块顶层调用任何可选 API**。顶层抛错 = 整个插件加载失败，
  而且用户看到的是「插件坏了」，不是「某个功能不可用」
- 可选功能必须能**静默降级**：拿不到合成层 hook 就只用普通遮罩，
  息屏功能照样能用

### 测试

- 用模拟的旧版 loader 对象（`DFL` 上无 `findVar`）验证：
  旧写法 → 崩溃；新写法 → 降级为 `null` 并继续工作
- `pack.py` 自检 8 验证：旧写法被拦截，新写法通过

---

## [2.8.1] - 2026-11-27

**删掉一个「照着做也没用」的误导入口**

### 问题

v2.7.1 在 QAM 里加了一个「修复权限」按钮，让用户执行
`sudo chmod a+w /sys/class/backlight/amdgpu_bl0/bl_power`，
并配了红框警告「屏幕只是变暗，因为 bl_power 是 root 只读」。

但真机实测早就证明：**chmod 之后写进去，这台 Deck 的驱动也完全不理**，
屏幕照旧亮着。所以这个按钮让用户照着做一件注定没用的事 ——
比不给指引更糟，因为它会让人以为「再折腾一下就能关屏」。

### Removed

- `fix_screen_permission` RPC
- `screen.ensure_permission()` / `screen._sudo_chmod()`
- `screen.diagnose()` 的 `can_turn_off` / `manual_command` 两个字段
- QAM 的「背光没能完全关闭」红框警告与「修复权限」按钮
- 6 条对应 i18n 文案（`qam.dimPartial` / `dimPartialBody` / `dimNeedFix` /
  `fixPermission` / `fixOk` / `fixOkBody` / `fixManual`）

### Changed

- **「背光没能完全关掉」从故障降级为正常现象**

  不再弹红框、不再提示修复。`screen.Dimmer.dim()` 的返回值里
  `backlight_off` 保留，但只作为**事实汇报**（诊断页会显示），
  不再驱动任何「请修复」的交互。

  关屏的实际手段是上层 `DimOverlay` 的纯黑遮罩 —— OLED 上黑像素不发光，
  等效于关屏。背光归 0 只是顺手省一点电，能关就关，关不掉不报错。

- `screen.py` 顶部文档重写：把「这台机器上没有任何 sysfs 途径能真正关屏」
  这个结论写在最前面，并说明 `bl_power` 即使可写也被驱动忽略。

### 测试

新增 4 项**回归测试**，锁住这条死路不要被加回来：
`ensure_permission` / `_sudo_chmod` 不存在、`diagnose()` 不再返回
`can_turn_off` / `manual_command`。

---

## [2.8.0] - 2026-11-27

**修复真机反馈：息屏后蓝牙自动断连（疑似进入休眠）**

### 结论先说

不是「疑似」——**就是整机休眠**。而且这跟息屏本身没有因果关系，
真正的链条是：

```
点「息屏当音箱」 → 用户不再碰 Deck → SteamOS 空闲计时器走完
→ Steam 调用 logind 的 Suspend() → 整机进 S3
→ 蓝牙适配器随总线一起挂起 → 手机/电脑看到「放着放着就断了」
```

之前几个版本只处理了「屏幕亮着」这一层（背光归 0 + 黑遮罩），
**完全没有碰休眠**。所以「屏幕确实黑了，但蓝牙照样断」——
这两个现象本来就互不相干。

### 为什么光靠背光/遮罩拦不住

Steam 客户端有**自己的**电源计时器（设置 > 电源 > 闲置后休眠），
到点后它请求的是**系统级 suspend**，跟显示子系统无关。实测确认：
即使背光真的关掉了，蓝牙也照样掉。

### Added

- **`inhibit.py`：logind 休眠抑制锁**

  息屏时同时持有一个 `systemd-inhibit --what=idle:sleep --mode=block` 的锁，
  期间 Steam 发来的睡眠请求会被 logind 直接拒绝
  （`org.freedesktop.login1.BlockedByInhibitorLock`），Deck 保持醒着，
  蓝牙链路不断。释放锁后一切恢复原状。

  **为什么用 `systemd-inhibit` 子进程而不是直接调 D-Bus `Inhibit()`？**
  logind 的 `Inhibit()` 返回的是**文件描述符**，锁的生命周期等于 fd
  保持打开的时间。用 `busctl` 拿 fd 要维持交互式会话并解析 SCM_RIGHTS，
  实现脆弱且容易泄漏；`systemd-inhibit` 就是官方为此提供的封装
  （持 fd、跑子进程、进程退出自动释放锁）。用它最稳。

  **为什么只抑制 `idle:sleep`？**
  **绝不能**抑制 `handle-power-key` / `handle-lid-switch`：
  抑制电源键会让用户按电源键也睡不了（只能长按强制断电），
  抑制合盖会让 Deck 塞进包里还发烫。只挡「自动休眠」这一种，
  手动操作一律照旧。

- **息屏期间蓝牙链路看护**

  休眠抑制是主防线，但它有可能因为权限 / 系统版本拿不到。
  所以加了第二道防线：息屏期间每 15 秒检查一次息屏时连着的设备，
  **发现断了就自动重连**。只在确实断开时才动作 ——
  对已连接的设备反复发 `connect` 会让对端闪断，反而更糟。

- **如实报告抑制失败**

  拿不到锁时 QAM 会明确提示「息屏期间蓝牙可能会断」，
  并说明原因和手动解法（关掉 Steam 的闲置休眠），
  而不是让用户自己去猜「为什么放着放着就断了」。

- 新增 RPC：`get_inhibit`（抑制状态 + `systemd-inhibit --list` 原始输出）
- `status()` 的 `screen` 字段新增 `inhibit_held` / `inhibit_available`
- 诊断页新增 `chk.inhibit` 自检项；诊断报告新增「休眠抑制」段落
  （含 logind 的 `IdleAction` / `IdleHint` / `PreparingForSleep` 原始值）

### Fixed

- **`report()` 会抛 `KeyError: 'name'`**

  自检项的字段名是 `key`（后端只返回 i18n key，文案由前端翻译），
  但 `report()` 里写的是 `c["name"]`。点「复制诊断报告」必定崩溃。
  这是 v2.5.0 做英文化时引入的，一直没被发现。

- **`chk.modules` 的详情硬编码成 `"8/8"`**

  新增模块后这个数字就永远是错的。改成按实际数量计算。

- **删掉「修复 bl_power 权限」这个误导入口**

  v2.7.1 加了一个「修复权限」按钮，让用户执行 `sudo chmod a+w bl_power`。
  但真机实测已经证明：**chmod 之后写进去，这台 Deck 的驱动也完全不理**，
  屏幕照旧亮着。让用户照着做一件注定没用的事，比不给指引更糟。

  删掉的东西：`fix_screen_permission` RPC、`screen.ensure_permission`、
  `screen._sudo_chmod`、`diagnose()` 的 `can_turn_off` / `manual_command`、
  QAM 的红框警告和按钮、对应的 6 条 i18n 文案。

  「背光没能完全关掉」也从**故障**降级为**正常现象**：不再弹红框、
  不再提示修复。关屏的实际手段是上层黑遮罩（OLED 上黑像素不发光）。

  同时在 `screen.py` 顶部把这个结论写成文档，并加了 4 项回归测试锁住，
  防止以后又把这条死路加回来。

### Changed

- **息屏遮罩改用 Steam 内部的 `UIComposition` 合成层**

  真机反馈「屏幕只是变暗，还能看到 Steam 头像和菜单图标」——
  单纯 `position: fixed` + 高 `z-index` **盖不住 Steam 的顶栏和 QAM**，
  因为它们在自己的合成层里，层级比插件的 DOM 更高。
  `createPortal` 到 `document.body` 也没用，问题不在 DOM 层级。

  改用 Steam 内部的 composition state 机制
  （`AddMinimumCompositionStateRequest` / `ChangeMinimumCompositionStateRequest`
  / `RemoveMinimumCompositionStateRequest`）把内容提升到 `Overlay` 合成层。
  参考实现：[steam3d/MagicBlackDecky](https://github.com/steam3d/MagicBlackDecky)。

  新增 `src/uiComposition.ts`（按源码特征匹配 hook，不靠函数名 ——
  打包后名字会被压缩）和 `src/views/DimOverlay.tsx`。
  ⚠️ 这是 Steam 的**内部 API**，不是公开接口，Steam 更新后可能失效，
  所以做了完整降级：找不到 hook 就只用普通遮罩（至少能变黑），且只警告一次。

- **息屏遮罩补上手柄输入捕获**

  Steam 的手柄输入由 `SteamUIStore.NavigationManager` 统一分发，
  **不产生 DOM keydown**。原来只监听 window 键盘事件，
  息屏后按 A 键屏幕不亮 —— 而手柄恰好是 Deck 上最常用的唤醒方式。
  现在额外用 `SetCatchAllGamepadInput` 捕获全部手柄输入。

### 测试

新增 22 项休眠抑制测试，重点是**安全边界**：
只抑制 `idle:sleep`、绝不抑制电源键 / 合盖 / 关机、
`hold()` / `release()` 的幂等性、没有 `systemd-inhibit` 时如实失败而不崩。

---

## [2.7.2] - 2026-11-27

### Fixed

- **「显示没有名称的设备」开关仍会漏出无名称设备**

  BlueZ 对没有广播名称的设备会生成 `Alias`，格式是 `AA-BB-CC-DD-EE-FF`
  （**横线**），而 `Name` / `Address` 用冒号。原来的 `is_mac()` 只认冒号写法，
  于是横线 Alias 被当成「真实名字」，`has_real_name` 错判为 `True`，
  过滤开关自然失效。改用 `is_mac_like()`（内部复用 `normalize_mac`）。

- **以前连过的设备扫不出来**

  `bluetoothctl devices` 只列已配对设备，未配对的历史设备不会出现。
  改为默认 `include_paired=True`，并对 BlueZ < 5.66 用 `paired-devices`
  子命令兜底（`devices Paired` 是 5.66+ 才有的）。

- **英文界面仍有中文残留**

  后端自检项直接返回了中文文案，前端切英文后照旧显示中文。
  改为只返回 `chk.*` i18n key，文案由前端按当前语言翻译。

### Changed

- 搜索改为**流式扫描**：边扫边出结果（2 秒轮询 + 已用时间 + 停止按钮 +
  信号强度条），不再是「等 20 秒一次性出列表」
- 设备列表与扫描结果共享同一个「显示没有名称的设备」状态

---

## [2.7.1] - 2026-11-27

### Fixed

- **息屏只变暗，屏幕仍然发亮**

  `brightness = 0` 在 Deck OLED 上会被内核**钳制**到最小值，屏幕仍微微发亮
  （真机反馈「很低亮度，但能看到 Steam 头像和菜单」）。
  OLED 的亮度是「硬件背光 + gamma 混合」实现的
  （kernel commit [44b0fed0](https://github.com/torvalds/linux/commit/44b0fed0a5947f54fd14255cd0766df952267bc5)），
  所以写 0 并不等于关屏。

  改为优先写 `bl_power`（真正切断背光电源），失败才降级到 `brightness=0`，
  并且**回读验证**实际生效值 —— 不假装成功。

- **遮罩没盖住顶栏**

  见 v2.8.0 的 `UIComposition` 改动（此版本先做了 `position: fixed` 全屏，
  仍在真机上确认盖不住，问题在 v2.8.0 才真正解决）。

### Notes

真机上确认的边界条件（记录下来避免以后重复踩）：

- `bl_power` 是 `-r--r--r-- root root`（0444），deck 用户写不了
- `steamos-priv-write` 这个 polkit 助手**只白名单了 `brightness`，不含 `bl_power`**
- 实测 `sudo chmod a+w bl_power` + `echo 1 > bl_power` **依然不能关屏** ——
  该驱动根本不理 `bl_power`。所以「修复权限」这条路在这台机器上无效，
  真正管用的是 v2.8.0 的 `UIComposition` 遮罩

> 这条结论后来变成了 v2.8.0 的一个修复项：既然路走不通，就把那个
> 「修复权限」入口整个删掉（见 v2.8.0 的对应条目）。

---

## [2.7.0] - 2026-11-27

### Added

- **息屏当音箱**

  QAM 面板新增「息屏当音箱（继续播放）」。当蓝牙音箱时屏幕常亮既费电
  又容易烧屏，现在可以真正关掉屏幕，音频不受影响。

  **为什么不用现有插件的做法？**

  MagicBlack 这类插件是往界面上盖一层纯黑。OLED 机型上黑像素不发光，
  等于关了；但 **LCD 机型（初代 Deck）背光仍然全亮**，一点电都省不了。

  **为什么不用 `xset dpms force off`？**

  Deck 跑在 gamescope（Wayland 合成器）上，X11 的 DPMS 命令对它无效
  （[ArchWiki](https://wiki.archlinux.org/title/Display_Power_Management_Signaling)
  明确说明「Wayland 下由合成器控制屏幕」）。

  **本插件的做法**：直接写背光 sysfs，把亮度置 0 —— 真正的硬件级关屏，
  LCD / OLED 都有效。SteamOS 提供
  `/usr/bin/steamos-polkit-helpers/steamos-priv-write` 这个 polkit 助手，
  **无需 root 密码**就能写 `/sys/class/backlight/*/brightness`
  （Steam 自己的亮度滑块走的就是这条路径），写完还会 `chmod a+w`，
  之后普通用户可以直接写。

  ### 安全边界（三重保护）

  背光归 0 后屏幕全黑，如果唤醒失败用户只能硬重启。所以：

  1. **超时兜底**：息屏后最多 5 分钟自动恢复，即使所有输入监听都失效
     也不会永久黑屏（前端和后端各有一个定时器）
  2. **任何输入立即恢复**：遮罩层接住 pointerdown / keydown / click
  3. **卸载自愈**：插件卸载或重载时，`_do_unload` 第一件事就是恢复背光

  恢复值是**息屏前实测的亮度**，不是硬编码，不会改变用户原有设置。

- 新增 `screen.py`（`find_backlight` / `read_brightness` / `write_brightness`
  / `Dimmer` / `parse_input_events`）
- 新增 RPC：`get_screen` / `dim_screen` / `undim_screen`
- `status()` 新增 `screen` 字段

### 测试

新增 16 项息屏测试：输入事件识别（键盘/触摸/指针/手势）、
兜底时限合理性、`Dimmer` 状态机（未息屏时 restore 是安全空操作）。

---

## [2.6.0] - 2026-11-27

代码质量重构，不改变用户可见行为。

### 类型安全（收益最大）

视图里 45 处 `any`，其中 `state: any` 等于关掉了整个状态树的类型检查 ——
这也是反复踩 bug 的根源（字段拼错、类型不匹配都不会报错）。

- `SettingsTab` / `EqTab` 的 `state: any` → `SpeakerStatus`
- `devLabel(d: any)` → `devLabel(d: BtDevice)`
- 预设列表、WiFi 列表、延迟档位、sink 列表全部用真实类型
- `catch (e: any)` → `catch (e)` + 新增 `errMsg(e: unknown)` 辅助函数

**立刻抓出 4 个真实缺陷**（补上后编译才通过）：
- `BtDevice` 缺 `rssi` / `uuids` / `services_resolved` 字段
- `Settings` 缺 `codec_preset` 字段
- `CheckItem` 的字段名是 `name`，但后端和代码都用 `key`
- 视图里 `c.name` 兜底分支引用了不存在的字段

### 死代码清理

- `backend.ts` 删除 11 个从未被视图调用的 api 方法（48 → 25 个）
- `main.py` 删除 4 个被新接口取代的旧 RPC：
  `scan_devices` / `stop_scan`（→ `scan_start`/`scan_list`/`scan_stop`）、
  `get_autoswitch` / `set_autoswitch`（无对应 UI）

### 重复逻辑合并

`Wp` 类的 6 个音量方法各自拼一遍 `wpctl` 命令，共 10 处重复。

抽出统一内核：
- `_vol_cmd(verb, node_id, arg, limit)` — 唯一入口，负责拼 target、
  加 `-l` 限幅、失败回退
- `_target(node_id)` — None 表示默认 sink，否则节点 id
- `_parse_vol(text)` — 统一解析音量与静音状态
- `_step(node_id, delta)` — 相对加减共用实现

**`wpctl` 调用点从 10 处降到 2 处。**

### 轮询开销

`status()` 每次要 fork 6~7 个外部进程。按变化频率分层缓存：
- Wi-Fi 频段：60 秒（原本每次轮询都跑一次 `iw dev`）
- 编码器预设列表：600 秒（静态数据）
- 设备 info：30 秒（图标/类别几乎不变）

**适配器、音量、设备列表、元数据全部保持实时查询**，不受缓存影响。

### 文件拆分

`bt.py` 1513 行混了三类职责，拆出 `btutil.py`：
- `btutil.py`（320 行）— 通用工具：MAC 归一化、命令执行、设备名推断、对端类型识别
- `bt.py`（1068 行）— BlueZ 封装

`bt.py` 保留 re-export，`bt.normalize_mac(...)` 等老写法仍然可用。

### 验证

- 后端离线测试：全部通过
- i18n 测试：EN/ZH 各 199 个 key，无硬编码中文残留
- 前端类型检查：通过
- 打包自检：7 项全过

---

## [2.5.5] - 2026-11-27

### Fixed

- **电脑推流声音小、手机没问题**（AVRCP 绝对音量把控制权交给了对端）

  根因是 `bluez5.hw-volume = [ a2dp_sink a2dp_source ]` 里的 `a2dp_sink`。
  启用后音量控制权通过 AVRCP 绝对音量交给对端，而不同对端实现差异极大：
  - 手机：多数不实现或实现不完整 → Deck 自己控制，正常
  - Windows：完整实现 → 电脑的音量滑块直接决定 Deck 音量

  修法一（根本）：`hw-volume` 只保留 `a2dp_source`，
  接收方向完全由 PipeWire 软件音量控制。

  修法二（补偿）：新增 `classify_peer()` 识别对端类型
  （Icon → Class of Device → 名字关键词三层兜底），
  识别到电脑推流时额外再给 1.2 倍增益。

---

## [2.5.4] - 2026-11-27

### Fixed

- **一键增益完全失效**

  它先调 `wpctl get-volume` 读当前值再算目标值：

  ```python
  cur = await self.wp.get_volume()      # 真机上读不到，抛异常
  target = max(cur["volume"], g)
  await self.wp.set_volume(target)      # 整段被 except 吞掉
  ```

  而 `get_volume` 在真机上一直不可靠，一旦抛异常整段就被跳过 ——
  用户点了按钮，音量毫无变化。

  改成直接设绝对值，完全不读。前端从单个按钮改成
  100% / 130% / 150% / 200% 四档，`MAX_GAIN` 提到 2.5。

---

## [2.5.3] - 2026-11-27

### Fixed

- **配对电脑时报「设备地址不合法」**

  `is_mac()` 的正则只接受「大写冒号」格式，但 BlueZ 在不同场合给的
  格式不一致（横线 Alias、小写输出），前端传进来校验就失败。

  新增 `normalize_mac()`：去分隔符 → 校验 12 位十六进制 → 重新按冒号
  分组大写。`is_mac` / `is_mac_like` 都改为复用它，5 处校验点全部
  改成「先归一化再用」。

---

## [2.5.2] - 2026-11-27

### Fixed

- **「显示没有名称的设备」开关对已配对列表无效**

  开关只作用于扫描结果，用户看到的「未知设备」其实来自已配对列表。

  - `showUnnamed` 状态提到 `DevicesTab` 层，两个列表共用
  - 后端 `friendly_device_name` 的中文兜底改为中性的 `? · XX:XX`
  - 前端新增 `devLabel()`，无名设备按当前语言显示

---

## [2.5.1] - 2026-11-27

### Fixed

- **无名称设备过滤失效**

  BlueZ 对没广播名字的设备会自动生成 `Alias`，格式是
  `AA-BB-CC-DD-EE-FF`（**横线**），而 `is_mac()` 只认冒号，
  于是横线 MAC 被当成「真实名字」，`has_real_name` 错判为 True。

  新增 `is_mac_like()` 统一处理各种写法。

- **以前连接过的设备扫不出来**

  `list_discovered` 里 `if not include_paired: continue` 把所有已配对
  设备过滤掉了。默认改为 True，扫描列表里已配对设备显示「已配对」
  标签、按钮变成「连接」。

- **连接管理不完整**

  参考 [DeckyLoader-Bluetooth](https://github.com/introkun/DeckyLoader-Bluetooth) 补齐：
  - `device_action` 新增 `block` / `unblock` / `alias`
  - 新增 `disconnect_all`
  - `info()` 新增 `services_resolved` 和 `uuids`
  - **`bluetoothctl` 版本兼容**：`devices Paired` 是 5.66 才有的子命令，
    旧版本退回 `paired-devices`
  - 已配对设备支持一键切换信任/取消信任

---

## [2.5.0] - 2026-11-27

### Added

- **流式扫描**（非阻塞，边扫边出）

  之前是阻塞扫描：点一下要干等 20 秒，界面上只有静止的「正在搜索…」，
  无法中途停止，也没有信号强度。

  - 拆成 `scan_start` / `scan_list` / `scan_stop` 三个 RPC
  - `start_discovery` 改为后台任务（非阻塞）
  - 前端每 2 秒轮询，显示已用秒数和已找到数量
  - 新增 RSSI 解析和 4 格信号强度条
  - 排序：已连接 > 已配对 > 有名字 > 信号强

- **「显示没有名称的设备」开关**

- **i18n 补全**

  诊断页自检项原来是后端返回硬编码中文，切英文后仍是中文。
  改为后端只返回 i18n key（`chk.*`），前端按语言翻译。
  另修掉 13 处残留硬编码中文。

  新增 `tests_i18n.py` 长期校验：词典一致性、源码引用完整性、
  后端 key 有翻译、无硬编码中文残留。

---

## [2.4.5] - 2026-11-27

真机反馈：音量调节正常了、卸载安装正常了。

### Fixed

- **卸载慢**

  `_unload()` 里有两处阻塞等待，Decky 要等它返回才算卸载完：
  - `bt.stop_agent()` → `await wait_for(proc.wait(), 3.0)` 最坏 3 秒
  - `power.stop()` → `await wait_for(proc.wait(), 2.0)` 最坏 2 秒

  合计最坏 **5 秒**。

  修法：
  - `stop_agent(quick=True)` / `SleepWatcher.stop(quick=True)`：
    kill 后**不等子进程退出**（由系统回收）
  - `_unload` 拆成 `_do_unload` + `asyncio.wait_for(..., timeout=2.0)` 整体兜底
  - 正常路径等待也从 3.0s/2.0s 缩短到 1.5s/1.0s

  这个 bug 从 v1.0.0 就存在（`stop_agent` 的 3 秒等待），一直没被发现，
  因为之前没人真正卸载过。

### Notes

**一次误判的教训**

真机曾出现 `TypeError: Failed to fetch dynamically imported module`，
当时判断为「`plugin.json` 的 `name` 含空格导致 URL 404」，并把
`Bluetooth Speaker` 改成了 `BluetoothSpeaker`。

**这个判断是错的。** 实测证明 `name` 含空格完全正常（前端会做 URL 编码），
那次加载失败是替换文件过程中的暂时状态。`name` 已改回 `Bluetooth Speaker`。

`pack.py` 的自检也相应放宽：只拦截真正会破坏 URL 的字符
（`/ \ ? # % & +`），空格与中文都放行。

教训：**看到报错先要证据，不要凭症状联想就改配置。**

---

## [2.4.4] - 2026-11-27

### Fixed

- **外部音源滑条没删干净**

  v2.4.3 只删了 QAM 的主音量滑条，「正在播放」卡片里还留了一个外部音源
  `SliderField` —— 用户看到的就是这个。

  外部源也改成 `-10% / 静音 / +10%` 三个按钮，新增
  `bt.step_volume_of()` 与 `step_source_volume` RPC。
  现在 QAM 面板里没有任何音量滑条。

---

## [2.4.3] - 2026-11-27

### Changed

- **删掉音量滑条，改为相对调节按钮**

  真机上 `wpctl get-volume` 读取一直不可靠（滑杆在最右却显示 0%）。
  与其显示错误数据，不如不显示。

  - 移除主音量 `SliderField`（不再依赖读取当前值）
  - 改为 5 个相对调节按钮：`-10% / -5% / 静音 / +5% / +10%`
  - 新增 `bt.step_volume()`：用 wpctl 的相对语法（`10%+` / `5%-`），
    加减由 wpctl 内部完成，**不需要先读到当前值**，因此永远有效
  - 提示用户用 Steam 音量键查看精确数值

---

## [2.4.2] - 2026-11-27

### Fixed

- **`run_cmd()` 没传会话环境变量**（音量读取失败的真正根因）

  真机现象：滑杆在最右边但显示 0%，Steam 自己的音量条是满的。
  这说明 `wpctl` 读取失败被当成 0。

  根因：所有 `wpctl` / `pactl` / `pw-dump` 调用都缺 `XDG_RUNTIME_DIR`。
  PipeWire 客户端靠它定位 socket，缺失时报：

  ```
  pipewire-0 is not an absolute path and no runtime dir found.
  Set one of PIPEWIRE_RUNTIME_DIR, XDG_RUNTIME_DIR
  ```

  之前只在 `systemctl --user` 那条路径补了环境变量，漏掉了 `wpctl`。

  - `run_cmd()` 默认注入 `_user_session_env()`
    （`XDG_RUNTIME_DIR` + `DBUS_SESSION_BUS_ADDRESS` + `PIPEWIRE_RUNTIME_DIR`）
  - 配对 agent 的两处 `create_subprocess_exec` 同样补上
  - `get_volume()` 读失败返回 `ok=False` + error，不再静默返回 0
  - 前端读取失败显示「读取失败」而非误导性的 0%

---

## [2.4.1] - 2026-11-27

### Fixed

- **`auto_gain` 在 90 秒保护期后仍会覆盖用户设置**

  用户把音量调到 50%，90 秒后自动增益发现 50% < 75% 阈值，又拉回 100%。
  感受就是「调了没用、自己会跳」。

  - `auto_gain` 默认改为 `False`
  - 即使开启也只在「每个音源会话补一次」（`_auto_gain_done` 标记）
  - 用户手动调过后，本次会话内永久不再干预
  - 不再动总音量，只处理外部源偏轻

- **前端 3 秒交还控制权，但空闲轮询间隔是 10 秒**

  3 秒时后端读到的还是旧值，滑杆立刻跳回去。

  - 改为「确认式交还」：后端值与我们设的值相差 ≤2% 才交还
  - 15 秒上限兜底，防止写入失败时永远卡在本地值

---

## [2.4.0] - 2026-11-27

按一份外部代码评审意见逐条自查，修复 3 项同类问题。

### Changed

- **依赖升级**
  - `@decky/ui` 4.16.5 → **5.0.2**
  - `@types/react` 18.3.31 → **19.1.1**
  - `@types/react-dom` 18.3.7 → **19.1.1**
  - `typescript` 5.6 → 5.9.3

  验证：`@decky/ui` 5.x + React 19 类型对本插件无破坏性变更。

- **轮询节流**（评审意见「2 秒轮询太频繁」）

  后端每次 `status` 要 fork+exec 4~6 个外部命令，比网络请求更重。

  - **可见性感知**：不可见时降频到 30s（不停掉，避免过期数据）
  - **自适应**：有音源播放 4s / 空闲 10s
  - `setTimeout` 链替代 `setInterval`，间隔可动态变化
  - 请求去重：`_inflight` 保证同一时刻只有一个 `status`

- **设置项类型校验**（评审意见「后端不该假设读到的是自己的数据」）

  - 新增 `_setting_ok()`：逐项校验类型/范围/枚举白名单
  - bool/int/str 严格区分（含 `bool` 是 `int` 子类这个 Python 坑）
  - `last_device` 必须是空或合法 MAC
  - 字符串长度上限 200
  - 类型不对就丢弃该项回退默认值，并记日志

### 未采纳的评审意见

- **`ssl=False` 不安全** —— 本插件后端零网络请求，不适用
- **列表要虚拟化** —— 设备列表通常 <10 条，EQ 预设固定 5 条
- **`dist` 不该进仓库** —— Decky 商店要求装即可用，参考项目也提交产物

---

## [2.3.0] - 2026-11-27

### Added

- **无名称设备的可读标签**

  `bluetoothctl devices` 对没广播名称的设备只输出 MAC，之前界面直接显示
  一串地址，用户不知道是什么设备。

  新增 `friendly_device_name()` 推断链：
  1. `Name`（设备广播名）
  2. `Alias`（BlueZ 侧别名）
  3. **按 Icon / Class 推断类型 + MAC 后四位**，如「手机 · EE:FF」
  4. 纯 MAC 兜底

  无真实名称的设备标注「设备未广播名称」，排序时排在有名字的后面
  （没名字的通常是不该连的杂项设备）。

- **i18n：默认英文，跟随 Steam 界面语言**

  新增 `src/i18n.ts`，**153 个 key** 的中英双语词典。

  语言探测顺序：
  1. `SteamClient.Settings.GetLanguage()`（最准）
  2. `navigator.language`
  3. 兜底 `en`

  `schinese` / `tchinese` / `zh-*` 归一化为 `zh`。插件显示名也跟随语言。

---

## [2.2.1] - 2026-11-27

### Fixed

- **音量条与实际音量不同步**（第一次尝试，未彻底解决）

  自动增益每轮轮询强行拉回 100%，用户刚拖动就被拽回去。
  加了 90 秒保护期 + 前端拖动状态 —— 但没抓到真正根因，
  最终在 v2.4.1 / v2.4.2 / v2.4.3 才彻底解决。

- **滑杆下方横线遮挡音量数字**

  去掉 `marginTop: -2` 负边距，音量数字移到滑杆上方，
  避开 `SliderField` 自带底边框。

### Added

- **音质优化**（`quality.py`）
  - 三档编码器预设：均衡（SBC-XQ + AAC）/ 音质优先（LDAC）/ 稳定（SBC）
  - `bluez5.enable-sbc-xq = true`，码率 328 → 452 kbps
  - `resample.quality` 提到 10，改善 44.1→48 重采样劣化

- **Wi-Fi 干扰检测**（`wifi.py`）

  蓝牙与 2.4GHz Wi-Fi 共用射频，是音频卡顿的头号原因。
  插件检测 Wi-Fi 频段并提示切 5GHz。

---

## [2.1.1] - 2026-11-27

### Fixed

- **爆音**（部分是本鱼造成的）

  v2.0.4 把 `MAX_GAIN` 提到 3.0，软件增益超 100% 必然削波。

  - `SAFE_GAIN=1.5` / `MAX_GAIN=2.0`，一键增益默认 1.3
  - EQ filter-chain 末尾串 `clamp`（内置零延迟硬限幅，钳 ±1.0）
  - 左右声道各一个 clamp，正确连线
  - 滑杆上限 300% → 150%，超 100% 明确标注「可能破音」

- **卡顿**（`client too slow`）

  - `node.pause-on-idle = false`（避免恢复播放爆点）
  - `session.suspend-timeout-seconds = 0`（不自动挂起）
  - `node.quantum = 1024`（给足缓冲）

---

## [2.1.0] - 2026-11-27

### Added

- **插件内搜索配对**

  真机反馈：配对只能自己去系统蓝牙设置里手动做，体验很差。
  根因是插件只有「被搜索」能力，没有「主动搜索对端」的能力。

  - `bt.py` 新增 `start_discovery` / `stop_discovery` /
    `list_discovered` / `pair_and_trust`
  - 前端新增 `ScanPanel`：搜索 20 秒 → 列出未配对设备 →
    一键配对 + 信任 + 连接
  - 设备按类型显示图标（手机/电脑/音箱），已连接的排前面

---

## [2.0.5] - 2026-11-27

### Fixed

- **平直模式仍挂着空 EQ 虚拟 sink，导致声音偏小**

  真机 `wpctl status` 显示即使选了「平直（关闭）」，
  `filter-chain` 虚拟 sink 依然存在：

  ```
  effect_input.bt_speaker_eq   [Audio/Sink]
  effect_output.bt_speaker_eq  [Stream/Output/Audio]
  ```

  这导致所有音频多绕一级虚拟设备，叠加总音量 0.75 后明显偏轻。

  `eq.apply("flat")` 改为直接删除配置文件，不创建节点。

---

## [2.0.4] - 2026-11-27

### Added

- **音量增益**（解决蓝牙接收声音小）

  - `MAX_GAIN` 提到 3.0（wpctl 软件音量可超 100%）
  - QAM 滑杆上限 150% → 300%，显示当前百分比与增益标记
  - 一键增益按钮（`boost_volume`，总音量 + 外部源同时拉高）
  - 自动增益（`auto_gain`，外部源 <75% 时自动拉满）

  > ⚠️ 这个版本的 3.0 上限后来在 v2.1.1 被降回 2.0 —— 它直接导致了爆音。

---

## [2.0.3] - 2026-11-27

真机验证反馈的三个问题。

### Fixed

- **切换均衡器报「重启 PipeWire 失败」**

  Decky 后端进程没继承 `XDG_RUNTIME_DIR`，`systemctl --user` 连不上
  会话总线（`Failed to connect to bus: No medium found`）。

  新增 `bt._user_session_env()`，`systemctl --user` 调用显式带环境变量，
  并加 `sudo -n` 兜底。

- **配对码 / 通行密钥不正确，无法配对**

  BlueZ 的 Just-Works 重配对问题（[bluez#428](https://github.com/bluez/bluez/issues/428)、
  [bluez#798](https://github.com/bluez/bluez/issues/798)）：两端密钥不一致时
  `JustWorksRepairing = never` 拒绝替换。

  新增「修复配对」（`repair_device`）：删记录（含密钥）→ 重启 agent →
  重新配对 + 信任。

- **全屏页标题被 Steam 状态栏遮挡**

  外层容器用 padding 让位（顶 58px / 底 62px，叠加 `env(safe-area-inset-*)`），
  内层单独做滚动容器。

### Added

- rfkill 阻挡识别（`PowerState: off-blocked` 时给出准确提示）
- 配对 agent 改用 `bluetoothctl --agent=NoInputNoOutput` 启动参数
- 配对状态显示，可一键重启 agent

---

## [2.0.1] - 2026-11-27

**修复真机上「插件加载失败：SyntaxError: Unexpected token 'export'」**

### Fixed

- **`pack.py` 漏打 `package.json`**

  Decky Loader 靠 `package.json` 的 `type` 字段决定前端加载方式：

  | 条件 | 加载方式 | 结果 |
  |---|---|---|
  | 有 `package.json` 且 `type == "module"` | ESM：`import(url)` | ✅ |
  | 没有 `package.json` | 旧版 IIFE：`eval(源码)` | ❌ ESM 产物抛语法错 |

  rollup 产物是 ESM，但 zip 里没 `package.json`，于是走了 `eval()` 路径。

  **对比验证**：`decky-netease-music.zip` 有 `package.json` + `type: module`
  所以能加载；两个包的 `dist/index.js` 结尾格式完全一致，差异只在 `package.json`。

  - `pack.py` 加入 `package.json`，新增 3 项自检
    （存在性 / `type` 必须是 module / dist 必须是 ESM）
  - `install.sh` 同步校验

---

## [2.0.0] - 2026-11-26

综合打磨：诊断完善、报告导出、文档重写。

### Added

- **12 项自检**（`_run_checks`）：把「能不能用」从让用户猜变成明确的 ✅/❌
  - bluetoothctl / busctl / wpctl 可用性
  - 检测到适配器、支持 A2DP Sink、已上电、agent 在跑、可被发现
  - PipeWire 有音频输出、版本可读
  - 8 个后端模块是否全部加载
- **一键复制诊断报告**（`report` RPC）：生成纯文本报告，含版本、自检、工具、模块、设置、原始输出
- **前端诊断页重做**：自检结果用颜色区分、模块加载状态、报告预览

### Changed

- **README 完全重写**：定位、功能矩阵、原理图、硬性约束、版本历史、致谢
- 诊断页的「命令可用性」从 5 个扩到 9 个（新增 `pactl` / `pw-dump` / `pw-link` / `gdbus`）

### Docs

- 明确写出 5 条硬性约束，供后续开发者参考：
  1. 后端只用标准库（PyInstaller 冻结环境）
  2. 命令探测走绝对路径（Decky v3.2.6 前不继承 PATH）
  3. 不用 `wpctl set-default` 做自动切换（会永久记住并压过优先级）
  4. `flags` 写 `"root"` 不是 `"_root"`（loader 源码实证）
  5. 常驻用 `systemctl --user`

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
