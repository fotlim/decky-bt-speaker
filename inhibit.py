"""息屏期间阻止系统自动休眠（否则蓝牙会断）。

为什么必须要有这个模块？
-----------------------
真机反馈：「息屏后蓝牙就会自动断连，疑似进入休眠状态」—— 不是疑似，就是。

SteamOS 的 Steam 客户端有**自己的**空闲计时器（设置 > 电源 > 闲置后休眠），
到点后它会调用 logind 的 `Suspend()`。而「息屏当音箱」的使用姿势恰好是
「用户不再碰 Deck」—— 计时器照常走完，整机进入 S3，蓝牙适配器随 PCI/USB
一起挂起，对端（手机 / 电脑）看到的就是「放着放着就断了」。

只改背光、只叠黑遮罩都拦不住：那是**系统级休眠**，跟显示子系统无关。
这一点在实测中被确认过 —— 即使背光真的关掉了，蓝牙照样掉。

正确做法是拿一个 logind 的 inhibitor 锁：

    systemd-inhibit --what=idle:sleep --mode=block sleep infinity

持有锁期间，Steam 发来的睡眠请求会被 logind 直接拒绝
（`org.freedesktop.login1.BlockedByInhibitorLock`），Deck 保持醒着，
蓝牙链路不断。释放锁后一切恢复正常。

为什么用 `sleep infinity` 子进程，而不是直接调 D-Bus 的 `Inhibit()`？
------------------------------------------------------------------
logind 的 `Inhibit()` 返回的是一个**文件描述符**，锁的生命周期等于这个 fd
保持打开的时间。用 `busctl` 拿 fd 需要维持一个交互式会话并解析 SCM_RIGHTS，
实现脆弱且容易泄漏；而 `systemd-inhibit` 就是官方为此提供的命令行封装：
它持有 fd、跑指定子进程、进程退出时自动释放锁。用它最稳。

为什么只抑制 `idle:sleep`？
--------------------------
**绝不能**抑制 `handle-power-key` / `handle-lid-switch`：
- 抑制电源键 —— 用户按电源键也睡不了，只能长按强制断电
- 抑制合盖 —— 合盖不睡，塞进包里会烫

只挡「自动休眠」这一种，手动操作一律照旧。
"""

import asyncio
import os
import time

from btutil import _user_session_env, run_cmd, which

# 要抑制的动作。见上文：只挡自动休眠，不挡电源键 / 合盖。
DEFAULT_WHAT = "idle:sleep"

# 锁的说明文字（会出现在 `systemd-inhibit --list` 里，方便用户自查）
WHO = "Bluetooth Speaker (Decky Loader)"
WHY = "Deck is acting as a Bluetooth speaker; suspending would drop the audio link"

# 拉起后等这么久看它有没有立刻失败（没权限 / 参数不支持）
START_PROBE_SEC = 0.6


class Inhibitor:
    """持有 / 释放一个 logind 休眠抑制锁。

    关键不变量：
      - `hold()` 幂等：已经持有时直接返回成功，不会拉第二个进程
      - `release()` 幂等：没持有时返回 `was_held=False`，不报错
      - 子进程被 kill 时内核会关闭 fd，锁随之释放，不需要额外清理
    """

    def __init__(self, log=None):
        self._log = log or (lambda *_: None)
        self._proc = None
        self._what = ""
        self._since = 0.0
        self.starts = 0        # 成功持有的次数（诊断用）
        self.failures = 0      # 失败的次数
        self.last_error = ""

    # -- 可用性 ---------------------------------------------------------
    @staticmethod
    def available():
        return which("systemd-inhibit") is not None

    def alive(self):
        return self._proc is not None and self._proc.returncode is None

    def status(self):
        return {
            "available": self.available(),
            "held": self.alive(),
            "what": self._what,
            "seconds": round(time.time() - self._since, 1) if self.alive() else 0.0,
            "starts": self.starts,
            "failures": self.failures,
            "last_error": self.last_error,
        }

    # -- 生命周期 -------------------------------------------------------
    async def hold(self, what=DEFAULT_WHAT):
        """获取抑制锁。返回 {"ok": bool, "what": str, "error": str}。"""
        if self.alive():
            return {"ok": True, "what": self._what, "already": True, "error": ""}

        exe = which("systemd-inhibit")
        if not exe:
            self.failures += 1
            self.last_error = "systemd-inhibit not found"
            self._log("阻止休眠失败：系统里没有 systemd-inhibit")
            return {"ok": False, "what": "", "error": self.last_error}

        # 用绝对路径，避免 systemd-inhibit 内部 execvp 找不到 sleep
        sleeper = which("sleep") or "sleep"
        argv = [
            exe,
            "--what=" + what,
            "--who=" + WHO,
            "--why=" + WHY,
            "--mode=block",
            sleeper, "infinity",
        ]

        env = dict(os.environ)
        env.update(_user_session_env())

        try:
            proc = await asyncio.create_subprocess_exec(
                *argv,
                stdout=asyncio.subprocess.DEVNULL,
                stderr=asyncio.subprocess.DEVNULL,
                env=env,
            )
        except Exception as e:  # noqa: BLE001
            self.failures += 1
            self.last_error = "failed to start systemd-inhibit: %s" % e
            self._log("阻止休眠失败：%s" % self.last_error)
            return {"ok": False, "what": "", "error": self.last_error}

        # 没权限 / 参数不支持时 systemd-inhibit 会立刻退出。
        # 这里等一小会儿确认它「站住了」，站住了才说明锁拿到了。
        exited = False
        try:
            await asyncio.wait_for(proc.wait(), START_PROBE_SEC)
            exited = True
        except asyncio.TimeoutError:
            exited = False

        if exited:
            # 再跑一次（sleep 0，立刻结束）把 stderr 抓下来，告诉用户真正的原因
            detail = ""
            try:
                rc2, out = await run_cmd(argv[:-1] + ["0"], timeout=6.0)
                detail = (out or "").strip()
            except Exception:  # noqa: BLE001
                pass
            self.failures += 1
            self.last_error = detail or ("systemd-inhibit exited with %s" % proc.returncode)
            self._log("阻止休眠失败（--what=%s）：%s" % (what, self.last_error))
            return {"ok": False, "what": "", "error": self.last_error}

        self._proc = proc
        self._what = what
        self._since = time.time()
        self.starts += 1
        self.last_error = ""
        self._log("已获取休眠抑制锁（--what=%s）" % what)
        return {"ok": True, "what": what, "already": False, "error": ""}

    async def release(self, reason=""):
        """释放抑制锁。kill 子进程即可（fd 关闭 → 锁自动释放）。"""
        proc = self._proc
        self._proc = None
        self._what = ""
        if proc is None:
            return {"ok": True, "was_held": False}
        try:
            proc.kill()
        except Exception:  # noqa: BLE001
            pass
        self._log("已释放休眠抑制锁%s" % (("（" + reason + "）") if reason else ""))
        return {"ok": True, "was_held": True}


# ---------------------------------------------------------------------------
# 诊断：把「到底是谁在阻止休眠 / 谁请求了休眠」摆出来
# ---------------------------------------------------------------------------

async def list_inhibitors():
    """`systemd-inhibit --list` 的原始输出（用户在诊断页能看到自己的锁在不在）。"""
    if not which("systemd-inhibit"):
        return ""
    try:
        rc, out = await run_cmd(["systemd-inhibit", "--list", "--no-pager"], timeout=8.0)
    except Exception:  # noqa: BLE001
        return ""
    return out if rc == 0 else out


async def logind_info():
    """读 logind 的空闲 / 休眠相关属性。

    这几个字段能直接回答「为什么会自己睡」：
      - `IdleAction` / `IdleActionUSec`：logind 自己的空闲动作（默认 ignore）
      - `IdleHint`：当前是否被认为空闲
      - `PreparingForSleep`：是否正在准备睡眠
    """
    out = {}
    if not which("busctl"):
        return out
    for prop in ("IdleAction", "IdleActionUSec", "IdleHint", "PreparingForSleep"):
        try:
            rc, txt = await run_cmd(
                ["busctl", "get-property",
                 "org.freedesktop.login1", "/org/freedesktop/login1",
                 "org.freedesktop.login1.Manager", prop],
                timeout=6.0,
            )
            if rc == 0:
                out[prop] = (txt or "").strip()
        except Exception:  # noqa: BLE001
            continue
    return out


async def diagnose():
    """一次性收集休眠相关的全部证据。"""
    return {
        "available": Inhibitor.available(),
        "inhibitors": await list_inhibitors(),
        "logind": await logind_info(),
    }
