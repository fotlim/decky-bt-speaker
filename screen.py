"""屏幕息屏 / 唤醒（当蓝牙音箱时省电、避免烧屏）。

设计要点
--------
**为什么不能只叠一层黑？**
MagicBlack 这类插件是往界面上盖一层纯黑。OLED 机型上黑像素不发光，等于关了；
但 **LCD 机型（初代 Deck）背光仍然全亮**，该费的电一点没省，还照样发热。

**为什么不用 `xset dpms force off`？**
Deck 跑在 gamescope（Wayland 合成器）上，X11 的 DPMS 命令对它无效
（[ArchWiki](https://wiki.archlinux.org/title/Display_Power_Management_Signaling)：
「Wayland 下由合成器控制屏幕」）。

**本插件的做法**：直接写背光 sysfs，把亮度置 0。
- 这是**真正的硬件级关屏**，LCD / OLED 都有效，能省电、能防烧屏
- SteamOS 提供 `/usr/bin/steamos-polkit-helpers/steamos-priv-write`
  这个 polkit 助手，**无需 root 密码**就能写 `/sys/class/backlight/*/brightness`
  （Steam 自己的亮度滑块走的就是这条路径）
- 该助手写完还会 `chmod a+w`，之后普通用户可以直接写，不必每次走 pkexec

**安全边界（最关键的部分）**
背光归 0 后屏幕全黑，如果唤醒失败用户只能硬重启。所以做了三重保护：

1. **超时兜底**：息屏后最多 `MAX_DIM_SECONDS`（默认 5 分钟）自动恢复，
   即使所有输入监听都失效也不会永久黑屏
2. **任何输入立即恢复**：监听输入设备事件 + 前台轮询（双保险）
3. **异常自愈**：插件卸载 / 进程退出时一定会把背光恢复原值

恢复值是**息屏前实测的亮度**，不是硬编码，所以不会改变用户原有亮度设置。
"""

import asyncio
import os
import re

from btutil import BtError, run_cmd, which

# 息屏最长时间（秒）。超过一定自动恢复，防止用户被困在黑屏。
MAX_DIM_SECONDS = 300

# SteamOS 的 polkit 写入助手（无需 root 密码）
PRIV_WRITE = "/usr/bin/steamos-polkit-helpers/steamos-priv-write"

# 背光设备候选路径（不同机型/内核版本名字不同）
_BACKLIGHT_GLOBS = (
    "/sys/class/backlight/amdgpu_bl0",   # Deck LCD / OLED 常见
    "/sys/class/backlight/amdgpu_bl1",   # 外接屏时可能变号
    "/sys/class/backlight/acpi_video0",  # 兜底
    "/sys/class/backlight/intel_backlight",
)


def find_backlight():
    """找可用的背光设备目录，返回路径或 None。"""
    for p in _BACKLIGHT_GLOBS:
        if os.path.isdir(p) and os.path.exists(os.path.join(p, "brightness")):
            return p
    # 兜底：扫一遍
    try:
        base = "/sys/class/backlight"
        for name in sorted(os.listdir(base)):
            d = os.path.join(base, name)
            if os.path.exists(os.path.join(d, "brightness")):
                return d
    except OSError:
        pass
    return None


def read_brightness(dev=None):
    """读当前亮度与最大亮度，返回 (cur, max) 或 (None, None)。"""
    dev = dev or find_backlight()
    if not dev:
        return None, None
    try:
        with open(os.path.join(dev, "brightness"), "r") as f:
            cur = int((f.read() or "0").strip())
        with open(os.path.join(dev, "max_brightness"), "r") as f:
            mx = int((f.read() or "0").strip())
        return cur, mx
    except (OSError, ValueError):
        return None, None


def _writable(path):
    """当前用户能否直接写这个文件。"""
    try:
        return os.access(path, os.W_OK)
    except OSError:
        return False


async def write_brightness(value, dev=None):
    """写背光值。

    三条路径，按可靠性排序：
      1. 直接写（steamos-priv-write 之前已经 chmod a+w 过）
      2. `steamos-priv-write`（polkit 助手，无需密码）
      3. 直接抛错（让上层提示用户）

    返回 True 表示成功。
    """
    dev = dev or find_backlight()
    if not dev:
        raise BtError("找不到背光设备（/sys/class/backlight 下没有可用的）")

    path = os.path.join(dev, "brightness")
    val = str(int(value))

    # 1. 能直接写就直接写（最快，零进程开销）
    if _writable(path):
        try:
            with open(path, "w") as f:
                f.write(val)
            return True
        except OSError:
            pass  # 落到 polkit

    # 2. 走 SteamOS 的 polkit 助手
    if os.path.exists(PRIV_WRITE):
        try:
            rc, out = await run_cmd([PRIV_WRITE, path, val], timeout=12.0)
            if rc == 0:
                return True
            # 助手的输出在 journal 里，这里只能给个通用错误
            raise BtError(
                "写入背光被拒绝。可能需要在桌面模式下首次授权，"
                "或 SteamOS 版本较旧没有该助手。"
            )
        except BtError:
            raise
        except Exception as e:  # noqa: BLE001
            raise BtError("写入背光失败：%s" % e)

    raise BtError(
        "没有写背光的权限，也找不到 steamos-priv-write 助手。\n"
        "可以手动执行一次：\n"
        "  sudo chmod a+w %s" % path
    )


def available():
    """当前环境能不能息屏（有背光设备 + 有写入途径）。"""
    dev = find_backlight()
    if not dev:
        return False
    path = os.path.join(dev, "brightness")
    return _writable(path) or os.path.exists(PRIV_WRITE)


class Dimmer:
    """息屏 / 恢复的状态机。

    关键不变量：
      - `dim()` 之前一定先记住原亮度，`restore()` 一定恢复到那个值
      - 无论走哪条退出路径（用户唤醒 / 超时 / 插件卸载），都会恢复
      - 重复调用 `dim()` 不会把「0」当成原亮度记下来
    """

    def __init__(self, log=None):
        self._log = log or (lambda *_: None)
        self.dimmed = False
        self._saved = None      # 息屏前的亮度
        self._dev = None
        self._since = 0.0
        self._task = None

    def status(self):
        cur, mx = read_brightness()
        return {
            "available": available(),
            "dimmed": self.dimmed,
            "current": cur,
            "max": mx,
            "saved": self._saved,
            "path": find_backlight() or "",
        }

    async def dim(self):
        """息屏（背光归 0）。"""
        if self.dimmed:
            return True

        dev = find_backlight()
        if not dev:
            raise BtError("找不到背光设备")

        cur, mx = read_brightness(dev)
        if cur is None:
            raise BtError("读不到当前亮度")

        # 记住原亮度。注意：如果原亮度就是 0（用户自己调到底了），
        # 恢复时给一个可见的最小值，否则用户会以为坏了。
        self._saved = cur if cur > 0 else max(1, (mx or 100) // 4)
        self._dev = dev

        await write_brightness(0, dev)
        self.dimmed = True
        self._since = asyncio.get_event_loop().time()
        self._log("已息屏（原亮度 %s / %s）" % (self._saved, mx))
        return True

    async def restore(self, reason=""):
        """恢复背光到息屏前的值。"""
        if not self.dimmed:
            return True
        target = self._saved or 1
        try:
            await write_brightness(target, self._dev)
            self._log("已恢复显示%s（亮度 %s）" % (("：" + reason) if reason else "", target))
        except BtError as e:
            self._log("恢复显示失败：%s" % e)
            raise
        finally:
            self.dimmed = False
            self._saved = None
        return True

    def elapsed(self):
        """已息屏多少秒。"""
        if not self.dimmed:
            return 0.0
        try:
            return asyncio.get_event_loop().time() - self._since
        except RuntimeError:
            return 0.0

    def timed_out(self):
        """是否超过兜底时限（该强制恢复了）。"""
        return self.dimmed and self.elapsed() > MAX_DIM_SECONDS


def parse_input_events(text):
    """从 `libinput debug-events` 或 `/dev/input` 输出里判断有没有用户输入。

    这里只做保守判断：只要出现任何按键 / 触摸 / 摇杆事件就算有输入。
    返回 True 表示「有输入」。
    """
    if not text:
        return False
    # libinput debug-events 的事件行形如：
    #   event4   KEYBOARD_KEY  +0.123s  KEY_VOLUMEUP (114) pressed
    #   event5   POINTER_MOTION +0.456s  1.23/0.00
    for ln in str(text).splitlines():
        low = ln.lower()
        for kw in ("keyboard_key", "pointer_button", "pointer_motion",
                   "touch_down", "touch_up", "touch_motion",
                   "gesture_", "switch_toggle", "tablet_tool"):
            if kw in low:
                return True
    return False
