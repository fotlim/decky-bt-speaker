"""息屏会话：把「息屏 + 抑制休眠 + 链路看护 + 兜底恢复」打包成一个对象。

为什么需要这个模块？
------------------
重构前，这套逻辑散在 `main.py` 里，跨了 200 多行、7 个方法：

    dim_screen / undim_screen / _start_dim_guard / _keep_link_alive
    get_screen / get_screen_diag / get_inhibit

它们之间共享 3 个状态（`dimmer` / `inhibitor` / `_dim_task`），
且**有严格的顺序要求**（先拿抑制锁再关屏；恢复时先放锁再开背光）。
散着写时，这些约束只存在于注释里，很容易在后续改动中被破坏。

收进一个类之后：
- 状态集中，不可能出现「忘了释放抑制锁」这类泄漏
- 顺序约束写在方法里，只有一条路径
- `main.py` 里的 RPC 退化成一行委托

⚠️ 关键不变量（任何改动都不能破坏）
--------------------------------
1. `enter()` 先拿抑制锁，**再**关屏
2. `exit()` 先恢复背光，**再**放抑制锁
3. 无论走哪条退出路径（用户唤醒 / 超时 / 插件卸载），两者都必须被清理
4. 拿不到抑制锁**不算失败** —— 只是如实汇报，息屏本身照做
"""

import asyncio
import time

from btutil import normalize_mac


class DimSession:
    """息屏会话：持有背光、抑制锁、兜底定时器与链路看护。"""

    def __init__(self, dimmer, inhibitor, bz, settings, log=None,
                 screen_mod=None, inhibit_mod=None):
        """
        参数
        ----
        dimmer       : screen.Dimmer 实例（背光控制）
        inhibitor    : inhibit.Inhibitor 实例（休眠抑制锁）
        bz           : bt.BlueZ 实例（链路看护要用它查连接状态）
        settings     : 插件的 settings dict（读 last_device、写回来）
        log          : 日志函数
        screen_mod   : screen 模块（取 MAX_DIM_SECONDS）
        inhibit_mod  : inhibit 模块（取 list_inhibitors）
        """
        self._dimmer = dimmer
        self._inhibitor = inhibitor
        self._bz = bz
        self._settings = settings
        self._log = log or (lambda *_: None)
        self._screen = screen_mod
        self._inhibit = inhibit_mod
        self._guard_task = None
        self._save = None  # 由上层注入的持久化回调

    def set_save(self, fn):
        """注入设置持久化回调（避免这个模块直接依赖 Plugin）。"""
        self._save = fn

    # -- 查询 -----------------------------------------------------------
    @property
    def dimmed(self):
        return bool(self._dimmer and self._dimmer.dimmed)

    def status(self):
        """给 `status()` RPC 用的轻量状态。"""
        if self._dimmer is None:
            return None
        return {
            "available": (self._screen.available() if self._screen else False),
            "dimmed": self.dimmed,
            "elapsed": round(self._dimmer.elapsed(), 1),
            "max_seconds": (self._screen.MAX_DIM_SECONDS if self._screen else 0),
            "inhibit_held": bool(self._inhibitor and self._inhibitor.alive()),
            "inhibit_available": bool(self._inhibitor and self._inhibitor.available()),
        }

    def screen_status(self):
        """给 `get_screen` RPC 用的完整状态。"""
        if self._dimmer is None:
            return {"available": False, "dimmed": False, "error": "screen 模块未加载"}
        st = self._dimmer.status()
        st["elapsed"] = round(self._dimmer.elapsed(), 1)
        st["max_seconds"] = (self._screen.MAX_DIM_SECONDS if self._screen else 0)
        return st

    def diagnose(self):
        """给 `get_screen_diag` 用：每个环节的真实结果。"""
        if self._screen is None:
            return None
        d = self._screen.diagnose()
        if self._dimmer is not None:
            d["dimmed"] = self._dimmer.dimmed
            d["saved"] = self._dimmer._saved
        return d

    async def inhibit_status(self):
        """给 `get_inhibit` 用：抑制锁状态 + 系统里所有锁。"""
        if self._inhibit is None:
            return None
        st = self._inhibitor.status() if self._inhibitor is not None else {}
        st["system"] = await self._inhibit.list_inhibitors()
        return st

    # -- 进入息屏 -------------------------------------------------------
    async def enter(self):
        """息屏：先抑制自动休眠，再关屏。

        返回 dimmer 的结果 dict，额外带一个 `inhibit` 字段。
        """
        if self._dimmer is None:
            return {"ok": False, "reason": "screen 模块未加载"}

        # 1. 先抑制自动休眠（失败不阻断息屏，只在结果里如实报告）
        inh = {"ok": False, "what": "", "error": "inhibit 模块未加载"}
        if self._inhibitor is not None:
            try:
                inh = await self._inhibitor.hold()
            except Exception as e:  # noqa: BLE001
                inh = {"ok": False, "what": "", "error": str(e)}
                self._log("获取休眠抑制锁异常：%s" % e)

        # 2. 再关屏
        r = await self._dimmer.dim()
        if r.get("ok"):
            self._start_guard()
        r["inhibit"] = inh
        return r

    # -- 退出息屏 -------------------------------------------------------
    async def exit(self, reason=""):
        """恢复显示并释放抑制锁。

        顺序：先开背光，再放锁 —— 反过来的话，放锁瞬间系统可能立刻睡下去，
        用户看到的就是「刚亮一下又黑了」。
        """
        if self._dimmer is not None and self._dimmer.dimmed:
            try:
                await self._dimmer.restore(reason)
            except Exception as e:  # noqa: BLE001
                self._log("恢复背光失败：%s" % e)
        if self._inhibitor is not None:
            try:
                await self._inhibitor.release(reason)
            except Exception as e:  # noqa: BLE001
                self._log("释放休眠抑制失败：%s" % e)
        self._stop_guard()
        return {"ok": True, "dimmed": False}

    # -- 兜底定时器 -----------------------------------------------------
    def _stop_guard(self):
        if self._guard_task is not None:
            try:
                self._guard_task.cancel()
            except Exception:  # noqa: BLE001
                pass
            self._guard_task = None

    def _start_guard(self):
        """启动兜底定时器：到点自动恢复 + 看护蓝牙链路。

        两件事解决两个不同问题：
        1. **超时恢复背光** —— 万一所有唤醒路径失效，用户不会被永久黑屏
        2. **看护蓝牙链路** —— 抑制锁可能因权限拿不到，那时至少还有自动重连兜着
        """
        self._stop_guard()
        if self._screen is None or self._dimmer is None:
            return

        async def _guard():
            wanted = await self._snapshot_connected()
            tick = 0
            try:
                while self._dimmer is not None and self._dimmer.dimmed:
                    await asyncio.sleep(5)
                    tick += 1
                    # 1. 超时兜底
                    if self._dimmer.timed_out():
                        self._log("息屏超过 %d 秒，自动恢复（兜底保护）"
                                  % self._screen.MAX_DIM_SECONDS)
                        await self.exit("超时兜底")
                        break
                    # 2. 链路看护：每 15 秒（3 个 tick）查一次，
                    #    比每 5 秒都查省得多（每次要 fork bluetoothctl）
                    if wanted and tick % 3 == 0:
                        await self._keep_link_alive(wanted)
            except asyncio.CancelledError:
                pass
            except Exception as e:  # noqa: BLE001
                self._log("息屏兜底定时器异常：%s" % e)

        self._guard_task = asyncio.create_task(_guard())

    async def _snapshot_connected(self):
        """记住息屏时连着的设备，用于断了之后重连。"""
        wanted = []
        if self._bz is None:
            return wanted
        try:
            for d in await self._bz.list_devices("Connected"):
                wanted.append(d["mac"])
        except Exception:  # noqa: BLE001
            pass
        if not wanted:
            last = (self._settings.get("last_device") or "").strip()
            if last:
                wanted.append(last)
        return wanted

    async def _keep_link_alive(self, wanted):
        """息屏期间发现连接掉了就自动重连。

        ⚠️ 只在「确实断了」时才动作，不主动重连正常连接的设备 ——
        对已连接的设备反复发 connect 会让对端闪断，反而更糟。
        """
        if self._bz is None:
            return
        for mac in list(wanted):
            try:
                info = await self._bz.info(normalize_mac(mac) or mac)
            except Exception:  # noqa: BLE001
                continue
            if info.get("connected"):
                continue
            self._log("息屏期间检测到 %s 断开，尝试重连" % (info.get("name") or mac))
            try:
                await self._bz.device_action(mac, "connect")
                self._log("息屏期间重连 %s 成功" % (info.get("name") or mac))
            except Exception as e:  # noqa: BLE001
                self._log("息屏期间重连 %s 失败：%s" % (mac, e))

    # -- 生命周期 -------------------------------------------------------
    async def shutdown(self):
        """插件卸载时调用：恢复背光 + 放锁 + 停定时器。"""
        await self.exit("插件卸载")
