"""
电源事件监听：捕获系统睡眠 / 唤醒，用于 A2DP 接收端的状态恢复。

背景
----
Deck 的核心使用姿势是「随手合盖、随时唤醒」。系统睡眠时蓝牙适配器会被
BlueZ 一起挂起，唤醒后常见三种残留状态：

1. `Discoverable` 被清掉（BlueZ 的 DiscoverableTimeout 在休眠期间照常计时）
2. 配对 agent（bluetoothctl 子进程）被内核冻结后失联
3. 对端设备仍以为连着，但 PipeWire 的 bluez_input 节点已经没了

桌面 Linux 不需要处理这些，所以没有现成方案可抄 —— 这是掌机独有的坑。

实现要点
--------
用户会话**不能**用 `dbus-monitor --system`：它第一步会请求
`org.freedesktop.DBus.Monitoring.BecomeMonitor`，该权限在系统总线上只给 root，
普通用户会收到 AccessDenied 并退回已弃用的 eavesdropping 模式。
（参考 omarchy#10317 / #10394 的真实踩坑记录）

正确做法是用 `busctl monitor --match` 或 `gdbus monitor`，它们走 AddMatch 订阅；
`PrepareForSleep` 是广播信号，普通用户也能收到。
"""

import asyncio
import re
import time

from bt import BtError, run_cmd, strip_ansi, which

# logind 的睡眠信号
SLEEP_SIGNAL_MATCH = (
    "type='signal',"
    "interface='org.freedesktop.login1.Manager',"
    "member='PrepareForSleep',"
    "path='/org/freedesktop/login1'"
)

# 唤醒后等这么久再检查，给 BlueZ / WirePlumber 一点重新枚举设备的时间
RESUME_SETTLE_SEC = 4.0


class SleepWatcher:
    """监听 PrepareForSleep，在睡眠前与唤醒后回调。

    回调签名：async def on_event(sleeping: bool) -> None
    """

    def __init__(self, on_event, log=None):
        self._on_event = on_event
        self._log = log or (lambda *_: None)
        self._proc = None
        self._task = None
        self._stop = False
        self.backend = ""          # 实际用的工具名，诊断页会显示
        self.last_event = None     # ('sleep'|'resume', timestamp)
        self.event_count = 0

    # -- 可用性 ---------------------------------------------------------
    @staticmethod
    def available():
        return which("busctl") is not None or which("gdbus") is not None

    def _pick_backend(self):
        if which("busctl"):
            return "busctl"
        if which("gdbus"):
            return "gdbus"
        return ""

    def _argv(self, backend):
        if backend == "busctl":
            # --match 只显示匹配的消息；--json=off 保持纯文本便于解析
            return ["busctl", "monitor", "--system", "--match=" + SLEEP_SIGNAL_MATCH, "--json=off"]
        # gdbus monitor --system --dest <name> 只接受 dest，不接受完整 match 规则；
        # 用 --dest 订阅 logind 后自行按 member 过滤即可
        return ["gdbus", "monitor", "--system", "--dest", "org.freedesktop.login1"]

    # -- 生命周期 -------------------------------------------------------
    async def start(self):
        backend = self._pick_backend()
        if not backend:
            raise BtError("系统里没有 busctl 或 gdbus，无法监听睡眠事件")
        self.backend = backend
        argv = self._argv(backend)
        exe = which(argv[0])
        try:
            self._proc = await asyncio.create_subprocess_exec(
                exe,
                *argv[1:],
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.STDOUT,
            )
        except Exception as e:  # noqa: BLE001
            raise BtError("启动睡眠监听失败（%s）：%s" % (backend, e))
        self._stop = False
        self._task = asyncio.create_task(self._pump())
        self._log("睡眠监听已启动（%s）" % backend)
        return True

    async def stop(self, quick=False):
        """停止睡眠监听。

        `quick=True` 用于插件卸载：kill 后**不等子进程退出**。
        原本这里 `await asyncio.wait_for(proc.wait(), 2.0)` 最坏等 2 秒，
        加上配对 agent 的等待，卸载会卡好几秒。
        子进程被 kill 后由系统回收，不需要我们等。
        """
        self._stop = True
        if self._task is not None:
            try:
                self._task.cancel()
            except Exception:
                pass
            self._task = None
        proc = self._proc
        self._proc = None
        if proc is not None:
            try:
                proc.kill()
            except Exception:
                pass
            if not quick:
                try:
                    await asyncio.wait_for(proc.wait(), 1.0)
                except Exception:
                    pass
        self._log("睡眠监听已停止")

    def alive(self):
        return self._proc is not None and self._proc.returncode is None

    # -- 解析 -----------------------------------------------------------
    @staticmethod
    def parse_sleep_state(text):
        """从一行 monitor 输出里判断是不是 PrepareForSleep，返回 True/False/None。

        busctl 输出形如：
            ‣ Type=signal  Interface=org.freedesktop.login1.Manager
              Member=PrepareForSleep  Path=/org/freedesktop/login1
              ...  BOOLEAN true;
        gdbus 输出形如：
            /org/freedesktop/login1: org.freedesktop.login1.Manager.PrepareForSleep (true,)
        """
        if not text or "PrepareForSleep" not in text:
            return None
        low = text.lower()
        # 先看显式布尔字面量
        m = re.search(r"\b(true|false)\b", low)
        if m:
            return m.group(1) == "true"
        # busctl 有时把布尔值放在下一行（BOOLEAN true;），由 pump 拼行处理
        return None

    async def _pump(self):
        proc = self._proc
        if proc is None or proc.stdout is None:
            return
        pending = ""
        try:
            while not self._stop:
                line = await proc.stdout.readline()
                if not line:
                    break
                text = strip_ansi(line.decode("utf-8", "replace")).rstrip()
                if not text:
                    continue
                # busctl 的输出是跨行的，把最近几行拼起来判断
                pending = (pending + " " + text).strip()[-600:]
                if "PrepareForSleep" not in pending:
                    continue
                state = self.parse_sleep_state(pending)
                if state is None:
                    continue
                pending = ""
                await self._dispatch(state)
        except asyncio.CancelledError:
            raise
        except Exception as e:  # noqa: BLE001
            self._log("睡眠监听读取异常：%s" % e)
        finally:
            if not self._stop:
                self._log("睡眠监听进程已退出")

    async def _dispatch(self, sleeping):
        self.event_count += 1
        self.last_event = ("sleep" if sleeping else "resume", time.time())
        self._log("捕获到 %s 事件" % ("睡眠" if sleeping else "唤醒"))
        try:
            await self._on_event(sleeping)
        except Exception as e:  # noqa: BLE001
            self._log("睡眠/唤醒回调异常：%s" % e)


async def wait_resume_settle():
    """唤醒后等一小会儿，让 BlueZ / WirePlumber 把设备重新枚举出来。"""
    await asyncio.sleep(RESUME_SETTLE_SEC)
