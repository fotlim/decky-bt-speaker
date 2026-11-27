"""屏幕息屏 / 唤醒（当蓝牙音箱时省电、避免烧屏）。

设计要点
--------
**真机上确认的事实（先看这段，避免重复踩坑）**

在这台 Steam Deck OLED 上，**没有任何 sysfs 途径能真正关掉屏幕**：

- `brightness = 0` 会被内核**钳制**到最小值，屏幕仍微微发亮
  （真机反馈「很低亮度，但能看到 Steam 头像和菜单」）
  OLED 的亮度是「硬件背光 + gamma 混合」实现的
  （kernel commit 44b0fed0），所以写 0 并不等于关屏
- `bl_power` 是 `-r--r--r-- root root`（0444），deck 用户写不了
- 但**即使 `sudo chmod a+w bl_power` 之后写进去，驱动也完全不理** ——
  用户实测确认，屏幕照旧亮着

所以本模块只负责「把背光尽力调到最低」，
**真正让屏幕黑掉的是上层 `DimOverlay` 的纯黑遮罩** ——
OLED 上黑像素不发光，等效于关屏。两者叠加使用。

**为什么不用 `xset dpms force off`？**
Deck 跑在 gamescope（Wayland 合成器）上，X11 的 DPMS 命令对它无效
（[ArchWiki](https://wiki.archlinux.org/title/Display_Power_Management_Signaling)：
「Wayland 下由合成器控制屏幕」）。

**安全边界（最关键的部分）**
背光调到最低 + 黑遮罩之后，如果唤醒失败用户只能硬重启。所以做了三重保护：

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


def read_bl_power(dev=None):
    """读背光电源状态。返回 (bl_power, supported)。

    `bl_power` 是**真正切断背光电源**的开关（0=开，1=关，部分驱动 4=FB_BLANK_POWERDOWN）。
    这和 `brightness` 完全不同：
      - `brightness = 0` 只是把调光值调到最低，很多驱动会**钳制到最小值**，
        屏幕仍然微微发亮（真机反馈「很低亮度但还能看到头像」就是这个）
      - `bl_power = 1` 直接关掉背光电源，屏幕彻底黑

    返回 supported=False 表示该设备没有 bl_power 节点。
    """
    dev = dev or find_backlight()
    if not dev:
        return None, False
    p = os.path.join(dev, "bl_power")
    if not os.path.exists(p):
        return None, False
    try:
        with open(p, "r") as f:
            return int((f.read() or "0").strip()), True
    except (OSError, ValueError):
        return None, True


def _safe_sysfs_path(p):
    """只允许操作 /sys/class/backlight 下的路径（防注入）。"""
    if not p:
        return False
    return p.startswith("/sys/class/backlight/") and ".." not in p


async def _sudo_write(path, value):
    """用 `sudo -n`（无密码模式）写 sysfs。失败返回 False。

    为什么还需要这条路径？
    --------------------
    `bl_power` 的权限是 **0444（root 只读）**，deck 用户写不了
    （真机实测：`-r--r--r-- root root bl_power`，写入报「权限不够」）。
    而 SteamOS 的 `steamos-priv-write` 助手只把 `brightness` 加进了
    白名单，**不包括 bl_power**，所以走 polkit 也不行。

    ⚠️ 但请注意：**即使这里成功了，这台 Deck 的驱动也不会真的关屏**。
    用户实测确认 `sudo chmod a+w bl_power` + `echo 1 > bl_power` 之后
    屏幕依然亮着。所以 `write_bl_power` 成功只代表「写进去了」，
    不代表「背光关了」—— 真正的关屏靠上层黑遮罩。这条路径留着是因为
    在别的机型 / 内核版本上它确实有效，且成本极低。
    """
    if not _safe_sysfs_path(path):
        return False
    try:
        rc, out = await run_cmd(
            ["sudo", "-n", "sh", "-c", 'printf "%s" "$1" > "$2"', "_", str(value), path],
            timeout=10.0,
        )
        return rc == 0
    except BtError:
        return False


async def write_bl_power(on, dev=None):
    """开关背光电源，返回 (ok, method)。

    `on=False` 表示切断背光（真正黑屏）。依次尝试：
      1. 直接写（多数机型 bl_power 是 0444，会失败）
      2. `sudo -n` 写入（有免密 sudo 时成功）
      3. 失败则返回 False，由上层降级到 brightness=0
    """
    dev = dev or find_backlight()
    if not dev:
        return False, "no-device"
    p = os.path.join(dev, "bl_power")
    if not os.path.exists(p):
        return False, "no-node"

    want = "0" if on else "1"

    # 1. 直接写
    if _writable(p):
        try:
            with open(p, "w") as f:
                f.write(want)
            return True, "direct"
        except OSError:
            pass

    # 2. sudo -n
    if await _sudo_write(p, want):
        return True, "sudo"

    return False, "read-only"


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
    """写背光值，**写完回读验证**。

    为什么要回读？
    ------------
    内核/驱动可能把过小的值钳制掉。ArchWiki 提到 systemd-backlight 会把
    亮度钳到「至少 1 或最大值的 5%」；部分驱动对直接写 sysfs 也会做类似处理。
    只写不验证的话，用户会看到「点了息屏但屏幕还亮着」—— 正是真机反馈的问题。

    返回实际生效的亮度值（int）。如果和请求值不一致，说明被钳制了。
    """
    dev = dev or find_backlight()
    if not dev:
        raise BtError("找不到背光设备（/sys/class/backlight 下没有可用的）")

    path = os.path.join(dev, "brightness")
    want = int(value)

    # 1. 能直接写就直接写（最快，零进程开销）
    wrote = False
    if _writable(path):
        try:
            with open(path, "w") as f:
                f.write(str(want))
            wrote = True
        except OSError:
            wrote = False

    # 2. 走 SteamOS 的 polkit 助手
    if not wrote:
        if not os.path.exists(PRIV_WRITE):
            raise BtError(
                "没有写背光的权限，也找不到 steamos-priv-write 助手。\n"
                "可以手动执行一次：\n  sudo chmod a+w %s" % path
            )
        rc, out = await run_cmd([PRIV_WRITE, path, str(want)], timeout=12.0)
        if rc != 0:
            raise BtError(
                "写入背光被拒绝（steamos-priv-write 返回 %d）。" % rc
            )

    # 3. 回读验证
    got, mx = read_brightness(dev)
    return got if got is not None else want


def diagnose():
    """息屏能力诊断：把每个环节的真实结果都报出来。

    用户在真机上遇到「点了没反应」时，这个函数能直接定位是哪一环断了：
    没有背光设备 / 没有写权限 / 没有 polkit 助手 / 写了但被钳制。
    """
    dev = find_backlight()
    info = {
        "backlight_dev": dev or "",
        "brightness_path": (os.path.join(dev, "brightness") if dev else ""),
        "writable": False,
        "bl_power_path": (os.path.join(dev, "bl_power") if dev else ""),
        "bl_power_supported": False,
        "bl_power_writable": False,
        "bl_power": None,
        "priv_write_exists": os.path.exists(PRIV_WRITE),
        "priv_write_path": PRIV_WRITE,
        "current": None,
        "max": None,
        "available": False,
        "candidates": [],
    }
    if dev:
        path = os.path.join(dev, "brightness")
        info["writable"] = _writable(path)
        cur, mx = read_brightness(dev)
        info["current"] = cur
        info["max"] = mx
        bp, bp_ok = read_bl_power(dev)
        info["bl_power"] = bp
        info["bl_power_supported"] = bp_ok
        info["bl_power_writable"] = _writable(os.path.join(dev, "bl_power"))
    # 列出所有候选设备（排查「选错设备」的情况）
    try:
        base = "/sys/class/backlight"
        for name in sorted(os.listdir(base)):
            d = os.path.join(base, name)
            p = os.path.join(d, "brightness")
            if os.path.exists(p):
                c, m = read_brightness(d)
                info["candidates"].append({
                    "name": name, "current": c, "max": m,
                    "writable": _writable(p),
                })
    except OSError:
        pass
    info["available"] = bool(dev) and (info["writable"] or info["priv_write_exists"])
    # ⚠️ 不再提供 can_turn_off / manual_command。
    #
    # 早期这里会算「bl_power 可写吗」，不可写就让用户去 sudo chmod a+w。
    # 真机实测证明这条路在这台 Deck 上**完全无效** —— chmod 之后写进去，
    # 驱动也照样不关屏。给用户一条「照着做也没用」的指引比不给更糟，
    # 所以这里只汇报事实，把「关屏靠遮罩」写在上面几个字段里。
    return info


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
        self._bl_power_cut = False   # 是否用了 bl_power 切断背光电源

    def status(self):
        cur, mx = read_brightness()
        bp, bp_ok = read_bl_power()
        return {
            "available": available(),
            "dimmed": self.dimmed,
            "current": cur,
            "max": mx,
            "saved": self._saved,
            "path": find_backlight() or "",
            "bl_power": bp,
            "bl_power_supported": bp_ok,
        }

    async def dim(self):
        """息屏：先尝试关背光，再交由上层叠遮罩。

        返回 dict：
          {"ok": bool, "backlight_off": bool, "actual": int, "reason": str}

        ⚠️ **`backlight_off=False` 不是故障，不要当成需要修复的错误。**

        真机上已经证明：这台 Deck 的 `bl_power` 是 root 只读（0444），
        而**即使 `chmod a+w` 之后写进去，驱动也完全不理**（用户实测确认）。
        `brightness=0` 也会被内核钳制到最小值。也就是说 —— 在 Deck OLED 上
        **没有任何 sysfs 途径能真正关掉背光**，这不是权限问题，是驱动行为。

        所以本插件对「关屏」的实际方案是**两层叠加**：
          1. 背光尽力调到最低（省一点电）
          2. 上层 `DimOverlay` 用 Steam 的 `UIComposition` 铺满纯黑 ——
             OLED 上黑像素不发光，等效于关屏；这是真正起作用的那一层

        `backlight_off` 只作为**事实汇报**（诊断页会显示），
        不再驱动「请去修复权限」这类提示 —— 那条路已经验证走不通。
        """
        if self.dimmed:
            return {"ok": True, "backlight_off": True, "actual": 0, "reason": "already dimmed"}

        dev = find_backlight()
        if not dev:
            return {"ok": False, "backlight_off": False, "actual": -1,
                    "reason": "no backlight device found"}

        cur, mx = read_brightness(dev)
        if cur is None:
            return {"ok": False, "backlight_off": False, "actual": -1,
                    "reason": "cannot read current brightness"}

        # 记住原亮度。如果原亮度就是 0（用户自己调到底了），
        # 恢复时给一个可见的最小值，否则用户会以为坏了。
        self._saved = cur if cur > 0 else max(1, (mx or 100) // 4)
        self._dev = dev

        # 优先尝试 bl_power（在部分机型/内核版本上确实能真正切断背光电源）。
        # 失败很正常 —— 见上面 docstring，Deck OLED 的驱动不理这个节点。
        power_cut, method = await write_bl_power(False, dev)

        if power_cut:
            actual = 0
            off = True
        else:
            # bl_power 不可用（权限不足 / 驱动忽略），降级到 brightness=0。
            # 这里**不再**因为「没关干净」而报错或提示用户去改权限。
            try:
                actual = await write_brightness(0, dev)
            except BtError as e:
                self._saved = None
                return {"ok": False, "backlight_off": False, "actual": cur,
                        "reason": str(e), "method": "failed"}
            off = (actual == 0)

        self.dimmed = True
        self._bl_power_cut = power_cut
        self._since = asyncio.get_event_loop().time()
        self._log("息屏：原亮度 %s/%s，bl_power=%s(%s)，brightness 实测 %s（背光彻底关=%s）"
                  % (self._saved, mx, "已切断" if power_cut else "未切断",
                     method, actual, off))
        return {
            "ok": True,
            "backlight_off": off,
            "actual": actual,
            "saved": self._saved,
            "max": mx,
            "method": method if power_cut else "brightness",
            # 不再返回「请修复权限」类 hint —— 那条路验证无效
            "hint": "",
            "reason": "" if off else (
                "backlight clamped by the driver; the black overlay is what turns "
                "the screen off on OLED"
            ),
        }

    async def restore(self, reason=""):
        """恢复背光到息屏前的值。

        顺序很重要：先开 bl_power 电源，再设亮度。反过来的话
        bl_power 关着时写亮度可能不生效。
        """
        if not self.dimmed:
            return {"ok": True, "actual": -1, "reason": "not dimmed"}
        target = self._saved or 1
        result = {"ok": False, "actual": -1, "reason": ""}
        try:
            # 1. 先恢复背光电源
            if getattr(self, "_bl_power_cut", False):
                await write_bl_power(True, self._dev)
            # 2. 再恢复亮度
            actual = await write_brightness(target, self._dev)
            result = {"ok": actual == target, "actual": actual,
                      "reason": "" if actual == target else "clamped"}
            self._log("恢复显示%s：目标 %s，实测 %s"
                      % (("（" + reason + "）") if reason else "", target, actual))
        except BtError as e:
            result = {"ok": False, "actual": -1, "reason": str(e)}
            self._log("恢复显示失败：%s" % e)
        finally:
            self.dimmed = False
            self._saved = None
            self._bl_power_cut = False
        return result

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
