"""
蓝牙音箱 · Decky Loader 插件后端

把 Steam Deck 变成一台可被手机 / 电脑连接的蓝牙音箱（A2DP Sink）。

原理：
- SteamOS 用 PipeWire + WirePlumber，BlueZ 的 A2DP Sink 角色默认启用，
  所以「当音箱」这件事系统层面本来就支持，缺的是好用的开关与状态面板。
- 本插件负责：电源/可发现/配对名、常驻 NoInputNoOutput 配对 agent、
  设备列表与连接管理、默认 sink 音量、以及发现性保活（BlueZ 默认 180s 超时）。
"""

import os
import sys
import json
import time
import asyncio
import functools
import traceback
import re

_PLUGIN_DIR = os.path.dirname(os.path.abspath(__file__))
if _PLUGIN_DIR not in sys.path:
    sys.path.insert(0, _PLUGIN_DIR)

import decky  # type: ignore

try:
    import bt  # type: ignore
    _BT_IMPORT_ERR = None
except Exception:
    bt = None
    _BT_IMPORT_ERR = traceback.format_exc()

try:
    import power  # type: ignore
    _POWER_IMPORT_ERR = None
except Exception:
    power = None
    _POWER_IMPORT_ERR = traceback.format_exc()

try:
    import nodes  # type: ignore
    _NODES_IMPORT_ERR = None
except Exception:
    nodes = None
    _NODES_IMPORT_ERR = traceback.format_exc()

try:
    import focus  # type: ignore
    _FOCUS_IMPORT_ERR = None
except Exception:
    focus = None
    _FOCUS_IMPORT_ERR = traceback.format_exc()

try:
    import silence  # type: ignore
    _SILENCE_IMPORT_ERR = None
except Exception:
    silence = None
    _SILENCE_IMPORT_ERR = traceback.format_exc()

try:
    import eq  # type: ignore
    _EQ_IMPORT_ERR = None
except Exception:
    eq = None
    _EQ_IMPORT_ERR = traceback.format_exc()

try:
    import output  # type: ignore
    _OUTPUT_IMPORT_ERR = None
except Exception:
    output = None
    _OUTPUT_IMPORT_ERR = traceback.format_exc()

try:
    import metadata  # type: ignore
    _META_IMPORT_ERR = None
except Exception:
    metadata = None
    _META_IMPORT_ERR = traceback.format_exc()

try:
    import wifi  # type: ignore
    _WIFI_IMPORT_ERR = None
except Exception:
    wifi = None
    _WIFI_IMPORT_ERR = traceback.format_exc()

try:
    import quality  # type: ignore
    _QUALITY_IMPORT_ERR = None
except Exception:
    quality = None
    _QUALITY_IMPORT_ERR = traceback.format_exc()

DEFAULT_SETTINGS = {
    "auto_start": True,        # 插件加载时自动进入「可被发现」
    "discoverable": True,      # 期望的可被发现状态（用于保活）
    "keep_alive": True,        # 每 60s 复查一次可发现性（BlueZ 默认 180s 超时）
    "alias": "Steam Deck",
    "resume_restore": True,    # 唤醒后自动恢复可发现 / 重连上次的设备
    "last_device": "",         # 上次连接过的设备 MAC（唤醒后优先重连它）
    "focus_mode": "coexist",   # 音频焦点：receiver_first / coexist / manual
    "silence_disconnect": 0,   # 静音 N 秒后自动断开（0 = 关闭）
    "eq_preset": "flat",       # 均衡器预设
    "latency_profile": "balanced",  # 延迟档位：low / balanced / stable
    "multi_output": False,     # 多输出同步（combine-stream）
    "auto_gain": False,        # 自动增益（默认关闭：避免和用户手动调节抢控制权）
    "codec_preset": "balanced",  # 音质预设：balanced / quality / stable
}

_ERR = "__bt_error__"

# 用户手动调音量后的「保护期」（秒）。
# 这段时间内自动增益不干预，避免滑杆刚拖动就被拽回去。
MANUAL_GRACE = 90


def _setting_ok(key, value, default):
    """校验单个设置项的类型与取值。

    返回 True 表示可以接受。原则：
    - 类型必须和默认值一致（bool / int / str）
    - 字符串有长度上限，避免被写入超长内容
    - 枚举型字段必须在白名单里
    """
    # bool 必须单独判断（Python 里 bool 是 int 的子类）
    if isinstance(default, bool):
        return isinstance(value, bool)

    if isinstance(default, int):
        if isinstance(value, bool) or not isinstance(value, int):
            return False
        # 数值范围保护
        if key == "silence_disconnect":
            return 0 <= value <= 3600
        return 0 <= value <= 1_000_000

    if isinstance(default, str):
        if not isinstance(value, str):
            return False
        if len(value) > 200:
            return False
        # 枚举白名单
        if key == "focus_mode":
            return value in ("receiver_first", "coexist", "manual")
        if key == "latency_profile":
            return value in ("low", "balanced", "stable")
        if key == "codec_preset":
            return value in ("", "balanced", "quality", "stable")
        if key == "eq_preset":
            return value in ("flat", "bass", "vocal", "bright", "loudness", "custom")
        if key == "last_device":
            # 空字符串或合法 MAC
            return value == "" or bool(re.match(r"^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$", value))
        return True

    return False


def _safe(fn):
    """RPC 兜底：把真实错误文本回传给前端（否则只有笼统的 Python Exception）。"""

    @functools.wraps(fn)
    async def wrapper(self, *args, **kwargs):
        if bt is None:
            return {_ERR: "后端初始化失败：\n%s" % (_BT_IMPORT_ERR or "bt 模块未加载")}
        try:
            return await fn(self, *args, **kwargs)
        except bt.BtError as e:
            self._log("RPC %s 失败：%s" % (getattr(fn, "__name__", "?"), e))
            return {_ERR: str(e)}
        except Exception as e:  # noqa: BLE001
            tb = traceback.format_exc()
            self._log("RPC %s 异常：\n%s" % (getattr(fn, "__name__", "?"), tb))
            return {_ERR: "%s: %s" % (type(e).__name__, e)}

    return wrapper


class Plugin:
    settings = {}
    settings_path = ""
    log_file = ""
    bz = None
    wp = None
    wpcfg = None
    sleeper = None
    foc = None
    guard = None
    norm = None
    eqcfg = None
    outcfg = None
    meta = None
    qcfg = None
    _keep_task = None
    _last_manual_volume = 0.0   # 用户最后一次手动调音量的时间戳（0 = 从未调过）
    _auto_gain_done = False     # 本次音源会话是否已自动增益过
    _pre_sleep = None          # 睡前快照：{"powered","discoverable","connected":[mac]} 

    # ------------------------------------------------------------------
    # 日志
    # ------------------------------------------------------------------
    def _log(self, msg):
        line = time.strftime("%Y-%m-%d %H:%M:%S ") + str(msg)
        try:
            if self.log_file:
                try:
                    if os.path.exists(self.log_file) and os.path.getsize(self.log_file) > 1_000_000:
                        os.remove(self.log_file)
                except Exception:
                    pass
                with open(self.log_file, "a", encoding="utf-8") as f:
                    f.write(line + "\n")
        except Exception:
            pass
        try:
            decky.logger.info("[bt] " + str(msg))
        except Exception:
            pass

    # ------------------------------------------------------------------
    # 设置持久化
    # ------------------------------------------------------------------
    def _load_settings(self):
        """读取设置。

        ⚠️ 不信任磁盘上的内容。评审意见指出「后端假设读到的东西都是自己写的」
        是不安全的 —— 这个文件用户可能手改过、可能被别的程序覆盖、可能损坏。
        所以这里做**逐项类型校验**：类型不对就丢弃该项、回退默认值，
        而不是把任意 JSON 值塞进运行时。
        """
        s = dict(DEFAULT_SETTINGS)
        try:
            if self.settings_path and os.path.exists(self.settings_path):
                with open(self.settings_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                if isinstance(data, dict):
                    dropped = []
                    for k, default in DEFAULT_SETTINGS.items():
                        if k not in data:
                            continue
                        v = data[k]
                        if _setting_ok(k, v, default):
                            s[k] = v
                        else:
                            dropped.append(k)
                    if dropped:
                        self._log("设置项类型不合法，已回退默认值：%s" % ", ".join(dropped))
                else:
                    self._log("设置文件不是 JSON 对象，已忽略并回退默认值")
        except Exception as e:  # noqa: BLE001
            self._log("读取设置失败（将使用默认值）：%s" % e)
        self.settings = s
        return s

    def _save_settings(self):
        try:
            os.makedirs(os.path.dirname(self.settings_path), exist_ok=True)
            tmp = self.settings_path + ".tmp"
            with open(tmp, "w", encoding="utf-8") as f:
                json.dump(self.settings, f, ensure_ascii=False, indent=2)
            os.replace(tmp, self.settings_path)
        except Exception as e:  # noqa: BLE001
            self._log("保存设置失败：%s" % e)

    # ------------------------------------------------------------------
    # 生命周期
    # ------------------------------------------------------------------
    async def _main(self):
        runtime = getattr(decky, "DECKY_PLUGIN_RUNTIME_DIR", _PLUGIN_DIR)
        logdir = getattr(decky, "DECKY_PLUGIN_LOG_DIR", runtime)
        try:
            os.makedirs(runtime, exist_ok=True)
            os.makedirs(logdir, exist_ok=True)
        except Exception:
            pass
        self.settings_path = os.path.join(runtime, "settings.json")
        self.log_file = os.path.join(logdir, "bt-speaker.log")
        self._log("插件启动")

        self._load_settings()

        if bt is None:
            self._log("bt 模块导入失败：\n%s" % (_BT_IMPORT_ERR or ""))
            return
        self.bz = bt.BlueZ(self._log)
        self.wp = bt.Wp()
        self.wpcfg = bt.WpConfig(self._log)
        self.foc = focus.Focus(self.wp, self._log) if focus is not None else None
        if silence is not None:
            self.guard = silence.SilenceGuard(self.settings.get("silence_disconnect", 0), self._log)
            self.norm = silence.Normalizer(self._log)
        self.eqcfg = eq.EqConfig(self._log) if eq is not None else None
        self.outcfg = output.CombineConfig(self._log) if output is not None else None
        self.meta = metadata.Metadata(self._log) if metadata is not None else None
        self.qcfg = quality.QualityConfig(self._log) if quality is not None else None

        if not bt.BlueZ.available():
            self._log("警告：系统里没有 bluetoothctl，蓝牙功能不可用")
            return

        # 恢复上次的设备名
        alias = (self.settings.get("alias") or "").strip()
        if alias:
            try:
                info = await self.bz.show(force=True)
                if info.get("alias") != alias:
                    await self.bz.set_alias(alias)
            except Exception as e:  # noqa: BLE001
                self._log("恢复设备名失败：%s" % e)

        if self.settings.get("auto_start", True):
            try:
                await self.bz.start_agent()
                await self.bz.power_on()
                if self.settings.get("discoverable", True):
                    await self.bz.set_discoverable(True)
                self._log("已自动进入可被发现状态")
            except Exception as e:  # noqa: BLE001
                self._log("自动启动失败：%s" % e)

        if self.settings.get("keep_alive", True):
            self._keep_task = asyncio.create_task(self._keep_alive_loop())

        # 睡眠 / 唤醒监听（掌机核心场景：合盖再开盖，蓝牙状态不能丢）
        if self.settings.get("resume_restore", True) and power is not None:
            try:
                self.sleeper = power.SleepWatcher(self._on_power_event, self._log)
                await self.sleeper.start()
            except Exception as e:  # noqa: BLE001
                self._log("睡眠监听启动失败（不影响主功能）：%s" % e)
                self.sleeper = None

    async def _unload(self):
        self._log("插件卸载")
        if self._keep_task is not None:
            try:
                self._keep_task.cancel()
            except Exception:
                pass
            self._keep_task = None
        if self.sleeper is not None:
            try:
                await self.sleeper.stop()
            except Exception:
                pass
            self.sleeper = None
        if self.bz is not None:
            try:
                await self.bz.stop_agent()
            except Exception:
                pass

    # ------------------------------------------------------------------
    # 睡眠 / 唤醒处理
    # ------------------------------------------------------------------
    async def _on_power_event(self, sleeping):
        """睡前一秒做快照，唤醒后按快照恢复。"""
        if sleeping:
            await self._snapshot_before_sleep()
        else:
            await power.wait_resume_settle()
            await self._restore_after_resume()

    async def _snapshot_before_sleep(self):
        snap = {"powered": False, "discoverable": False, "connected": []}
        try:
            info = await self.bz.show(force=True)
            snap["powered"] = bool(info.get("powered"))
            snap["discoverable"] = bool(info.get("discoverable"))
        except Exception as e:  # noqa: BLE001
            self._log("睡前快照：读取适配器失败 %s" % e)
        try:
            for d in await self.bz.list_devices("Connected"):
                snap["connected"].append(d["mac"])
                self.settings["last_device"] = d["mac"]
        except Exception as e:  # noqa: BLE001
            self._log("睡前快照：读取已连接设备失败 %s" % e)
        if snap["connected"]:
            self._save_settings()
        self._pre_sleep = snap
        self._log(
            "睡前快照：powered=%s discoverable=%s 已连接=%d"
            % (snap["powered"], snap["discoverable"], len(snap["connected"]))
        )

    async def _restore_after_resume(self):
        """唤醒后恢复蓝牙状态。

        顺序有讲究：
        1. 先确保适配器上电（睡眠时可能被 rfkill 关掉）
        2. 再重启配对 agent（子进程被冻结过，很可能已失联）
        3. 然后恢复可发现（DiscoverableTimeout 在睡眠期间照常计时）
        4. 最后尝试重连睡前连着的设备
        """
        snap = self._pre_sleep or {}
        actions = []
        try:
            info = await self.bz.show(force=True)
        except Exception as e:  # noqa: BLE001
            self._log("唤醒恢复：读取适配器失败 %s" % e)
            return

        # 1. 上电
        if snap.get("powered", True) and not info.get("powered"):
            try:
                await self.bz.power_on()
                actions.append("上电")
            except Exception as e:  # noqa: BLE001
                self._log("唤醒恢复：上电失败 %s" % e)

        # 2. agent
        if not self.bz.agent_alive():
            try:
                await self.bz.start_agent()
                actions.append("重启配对 agent")
            except Exception as e:  # noqa: BLE001
                self._log("唤醒恢复：agent 重启失败 %s" % e)

        # 3. 可发现
        if snap.get("discoverable", self.settings.get("discoverable", True)):
            try:
                info2 = await self.bz.show(force=True)
                if info2.get("powered") and not info2.get("discoverable"):
                    await self.bz.set_discoverable(True)
                    actions.append("恢复可发现")
            except Exception as e:  # noqa: BLE001
                self._log("唤醒恢复：可发现失败 %s" % e)

        # 4. 重连
        candidates = list(snap.get("connected") or [])
        last = (self.settings.get("last_device") or "").strip()
        if last and last not in candidates:
            candidates.append(last)
        for mac in candidates:
            try:
                d = await self.bz.info(mac)
                if d.get("connected"):
                    continue
                await self.bz.device_action(mac, "connect")
                actions.append("重连 %s" % (d.get("name") or mac))
            except Exception as e:  # noqa: BLE001
                self._log("唤醒恢复：重连 %s 失败 %s" % (mac, e))

        self._log("唤醒恢复完成：%s" % ("、".join(actions) if actions else "无需操作"))
        self._pre_sleep = None

    async def _keep_alive_loop(self):
        """BlueZ 的 DiscoverableTimeout 默认 180s，这里定期复查，保证一直能被搜到。"""
        while True:
            try:
                await asyncio.sleep(60)
                if not self.settings.get("discoverable", True):
                    continue
                if self.bz is None or not self.bz.agent_alive():
                    try:
                        await self.bz.start_agent()
                    except Exception as e:  # noqa: BLE001
                        self._log("保活：agent 重启失败 %s" % e)
                info = await self.bz.show(force=True)
                if info.get("powered") and not info.get("discoverable"):
                    await self.bz.set_discoverable(True)
                    self._log("保活：重新打开可被发现")
                # 静音守卫：外部源长时间不活跃就断开（省电、避免吞通知）
                if self.guard is not None and self.guard.enabled:
                    await self._check_silence()
            except asyncio.CancelledError:
                raise
            except Exception as e:  # noqa: BLE001
                self._log("保活循环异常：%s" % e)

    # ------------------------------------------------------------------
    # 静音守卫
    # ------------------------------------------------------------------
    async def _check_silence(self):
        """检查外部源是否还在活跃；超时就断开。

        活跃判定优先用 `pw-dump` 的 node.state（零额外开销），
        拿不到就退回「有没有 bluez_input 节点」这个弱信号。
        """
        active = False
        try:
            states = await silence.read_node_states()
            if states is not None:
                active = any(s["active"] for s in states)
            else:
                text = await self.wp.status_text()
                active = nodes is not None and nodes.has_external_source(text)
        except Exception as e:  # noqa: BLE001
            self._log("静音检查失败：%s" % e)
            return

        if not self.guard.observe(active):
            return

        # 超时了：断开所有已连接的设备
        try:
            connected = await self.bz.list_devices("Connected")
        except Exception:
            connected = []
        for d in connected:
            try:
                await self.bz.device_action(d["mac"], "disconnect")
                self._log("静音自动断开：%s" % d["name"])
            except Exception as e:  # noqa: BLE001
                self._log("静音自动断开 %s 失败：%s" % (d["mac"], e))
        self.guard.reset()

    # ------------------------------------------------------------------
    # RPC：状态
    # ------------------------------------------------------------------
    @_safe
    async def status(self):
        """面板主状态：适配器 + 音量 + 已配对/已连接设备 + 版本。"""
        adapter = None
        err = None
        try:
            adapter = await self.bz.show()
        except Exception as e:  # noqa: BLE001
            err = str(e)

        # rfkill 状态：蓝牙打不开时最可能的原因
        rf = {"soft": False, "hard": False, "found": False}
        if adapter is not None and not adapter.get("powered"):
            try:
                rf = await self.bz.rfkill_status()
            except Exception:
                pass

        vol = {"volume": 0.0, "muted": False}
        sink = ""
        live = None
        try:
            vol = await self.wp.get_volume()
            status_text = await self.wp.status_text()
            sink = bt.Wp.parse_default_sink(status_text)
            # 「谁在放歌」：找出蓝牙输入节点并单独读它的音量
            if nodes is not None:
                src = nodes.find_bt_input(status_text)
                if src is not None:
                    detail = {"volume": src.get("volume"), "muted": False}
                    try:
                        detail = await self.wp.get_volume_of(src["id"])
                    except Exception:
                        pass
                    live = {
                        "id": src["id"],
                        "name": src["name"],
                        "volume": detail["volume"],
                        "muted": detail["muted"],
                    }
                    # 自动增益：外部源偏轻就拉满
                    await self._apply_auto_gain(src["id"], detail["volume"])
                    # 音量归一化：观察是否发生大幅跳变
                    if self.norm is not None:
                        live["norm"] = self.norm.observe(detail["volume"])
        except Exception as e:  # noqa: BLE001
            self._log("读取音量失败：%s" % e)

        connected, paired = [], []
        try:
            connected = await self.bz.list_devices("Connected")
            paired = await self.bz.list_devices("Paired")
        except Exception as e:  # noqa: BLE001
            self._log("读取设备列表失败：%s" % e)

        # 编码器与 profile（用来判断「现在是 SBC 还是 AAC」）
        codec = {"profile": "", "codec": "", "role": ""}
        if self.foc is not None:
            try:
                prof = await self.foc.get_active_profile()
                if prof:
                    codec = dict(focus.summarize_profile(prof), profile=prof)
            except Exception as e:  # noqa: BLE001
                self._log("读取编码器失败：%s" % e)

        # 已连接设备的详情（图标/类别用来在 UI 上区分手机和电脑）
        details = []
        for d in connected:
            try:
                details.append(await self.bz.info(d["mac"]))
            except Exception:
                details.append({"mac": d["mac"], "name": d["name"], "connected": True, "paired": True, "icon": ""})

        # AVRCP 元数据：手机正在放什么歌
        track = None
        if self.meta is not None and connected:
            try:
                track = await self.meta.read_first([d["mac"] for d in connected])
            except Exception as e:  # noqa: BLE001
                self._log("读取元数据失败：%s" % e)

        return {
            "ok": err is None,
            "error": err,
            "adapter": adapter,
            "rfkill": rf,
            "volume": vol,
            "sink": sink,
            "live": live,
            "track": track,
            "codec": codec,
            "focus": {
                "mode": self.settings.get("focus_mode", "coexist"),
                "label": (focus.Focus.mode_label(self.settings.get("focus_mode", "coexist"))
                          if focus is not None else ""),
            },
            "silence": (self.guard.status() if self.guard is not None else None),
            "normalize": (self.norm.status() if self.norm is not None else None),
            "wifi": (await wifi.detect() if wifi is not None else None),
            "quality": {
                "preset": self.settings.get("codec_preset", "balanced"),
                "presets": (quality.codec_list() if quality is not None else []),
                "installed": (quality.QualityConfig.installed() if quality is not None else False),
                "active_profile": codec.get("profile", "") if codec else "",
            },
            "eq": {
                "installed": (eq.EqConfig.installed() if eq is not None else False),
                "preset": self.settings.get("eq_preset", "flat"),
                "presets": (eq.preset_list() if eq is not None else []),
                "path": (eq.EqConfig.conf_path() if eq is not None else ""),
            },
            "output": {
                "multi": self.settings.get("multi_output", False),
                "installed": (output.CombineConfig.installed() if output is not None else False),
                "latency": self.settings.get("latency_profile", "balanced"),
                "latency_profiles": (output.latency_list() if output is not None else []),
                "sinks": (await output.list_sinks(self.wp) if output is not None else []),
            },
            "connected": details,
            "paired": paired,
            "agent": self.bz.agent_alive(),
            "agent_registered": self.bz.agent_registered(),
            "settings": self.settings,
            "tuning": {"installed": bt.WpConfig.installed(), "path": bt.WpConfig.conf_path()},
            "power": {
                "watching": bool(self.sleeper and self.sleeper.alive()),
                "backend": (self.sleeper.backend if self.sleeper else ""),
                "events": (self.sleeper.event_count if self.sleeper else 0),
                "last": (self.sleeper.last_event if self.sleeper else None),
            },
            "versions": await bt.versions(),
            "tools": {
                "bluetoothctl": bt.which("bluetoothctl") is not None,
                "busctl": bt.which("busctl") is not None,
                "wpctl": bt.which("wpctl") is not None,
            },
        }

    @_safe
    async def set_discoverable(self, on):
        on = bool(on)
        self.settings["discoverable"] = on
        self._save_settings()
        if on:
            await self.bz.start_agent()
            await self.bz.power_on()
        await self.bz.set_discoverable(on)
        return {"ok": True, "discoverable": on}

    @_safe
    async def set_power(self, on):
        on = bool(on)
        if on:
            await self.bz.power_on()
            if self.settings.get("discoverable", True):
                await self.bz.set_discoverable(True)
        else:
            rc, out = await bt.run_cmd(["bluetoothctl", "power", "off"], 10.0)
            if rc != 0:
                raise bt.BtError("关闭蓝牙失败：%s" % (out or "").strip())
        return {"ok": True, "powered": on}

    @_safe
    async def unblock_rfkill(self):
        """尝试解除 rfkill 软阻挡（硬阻挡需要物理开关，软件解不了）。

        注意：`rfkill unblock` 通常需要 root。这里先尝试直接执行，
        失败就把可操作的命令回传给前端，让用户手动跑。
        """
        rf = await self.bz.rfkill_status()
        if rf.get("hard"):
            raise bt.BtError(
                "蓝牙被硬阻挡（Hard blocked），软件无法解除。\n"
                "请检查是否有物理开关，或重启一次 Deck。"
            )
        await self.bz.unblock_rfkill()
        # 解完立刻尝试上电
        await self.bz.power_on()
        if self.settings.get("discoverable", True):
            await self.bz.set_discoverable(True)
        return {"ok": True, "rfkill": await self.bz.rfkill_status()}

    @_safe
    async def restart_agent(self):
        """重启配对 agent（配对卡住时的救命按钮）。"""
        await self.bz.stop_agent()
        await asyncio.sleep(0.3)
        await self.bz.start_agent()
        return {
            "ok": True,
            "agent": self.bz.agent_alive(),
            "registered": self.bz.agent_registered(),
        }

    @_safe
    async def pair_device(self, mac):
        """主动向指定设备发起配对（用于手机侧发起失败时的反向配对）。"""
        if not bt.is_mac(mac):
            raise bt.BtError("设备地址不合法：%s" % mac)
        if not self.bz.agent_registered():
            try:
                await self.bz.start_agent()
            except Exception as e:  # noqa: BLE001
                self._log("配对前启动 agent 失败：%s" % e)
        await self.bz.device_action(mac, "pair")
        try:
            await self.bz.device_action(mac, "trust")
        except Exception:
            pass
        return {"ok": True}

    # ------------------------------------------------------------------
    # RPC：扫描与配对（插件内完成，不用跳系统设置）
    # ------------------------------------------------------------------
    @_safe
    async def scan_devices(self, timeout=20):
        """扫描附近设备并返回未配对的列表。

        这是「配对体验」的核心：不用退出插件去系统蓝牙设置里找，
        直接在插件里看到设备并一键配对。
        """
        sec = max(5, min(60, int(timeout or 20)))
        # 扫描前确保 agent 就绪，否则扫到了也配不上
        if not self.bz.agent_registered():
            try:
                await self.bz.start_agent()
            except Exception as e:  # noqa: BLE001
                self._log("扫描前启动 agent 失败：%s" % e)
        await self.bz.start_discovery(sec)
        devs = await self.bz.list_discovered(include_paired=False)
        self._log("扫描到 %d 个未配对设备" % len(devs))
        return {"ok": True, "devices": devs, "seconds": sec}

    @_safe
    async def stop_scan(self):
        await self.bz.stop_discovery()
        return {"ok": True}

    @_safe
    async def pair_device_full(self, mac):
        """一键配对：配对 + 信任 + 连接。"""
        if not bt.is_mac(mac):
            raise bt.BtError("设备地址不合法：%s" % mac)
        await self.bz.pair_and_trust(mac)
        return {"ok": True, "agent": self.bz.agent_registered()}

    @_safe
    async def forget_device(self, mac):
        """彻底删除设备记录（含绑定密钥），用于解决配对码不正确。"""
        await self.bz.forget_device(mac)
        return {"ok": True}

    @_safe
    async def repair_device(self, mac):
        """一键修复配对：清除旧密钥 → 重启 agent → 重新配对。

        用于「配对码 / 通行密钥不正确，无法配对」这种情况。
        根因是 BlueZ 的 JustWorksRepairing 默认 never，两端密钥不一致时
        会拒绝替换旧绑定（bluez#428 / bluez#798）。
        """
        await self.bz.repair(mac)
        return {"ok": True, "agent": self.bz.agent_registered()}

    @_safe
    async def set_alias(self, alias):
        alias = (alias or "").strip()
        await self.bz.set_alias(alias)
        self.settings["alias"] = alias
        self._save_settings()
        return {"ok": True, "alias": alias}

    @_safe
    async def device_action(self, mac, action):
        ok = await self.bz.device_action(mac, action)
        return {"ok": ok}

    @_safe
    async def set_volume(self, value):
        # 记录手动调节时间，自动增益在保护期内不再覆盖
        self._last_manual_volume = time.time()
        await self.wp.set_volume(value)
        return {"ok": True, "volume": max(0.0, min(bt.MAX_GAIN, float(value)))}

    @_safe
    async def set_mute(self, muted):
        await self.wp.set_mute(bool(muted))
        return {"ok": True, "muted": bool(muted)}

    @_safe
    async def set_source_volume(self, node_id, value):
        """给外部蓝牙源节点单独调音量（不影响游戏声音）。"""
        self._last_manual_volume = time.time()
        await self.wp.set_volume_of(node_id, value)
        return {"ok": True, "volume": max(0.0, min(bt.MAX_GAIN, float(value)))}

    @_safe
    async def set_source_mute(self, node_id, muted):
        await self.wp.set_mute_of(node_id, bool(muted))
        return {"ok": True, "muted": bool(muted)}

    # ------------------------------------------------------------------
    # RPC：音量增益
    # ------------------------------------------------------------------
    @_safe
    async def boost_volume(self, gain=1.3):
        """一键增益：把总音量和外部源音量同时拉高。

        蓝牙接收场景声音偏小的两个原因：
        1. 手机推流进来的 `bluez_input` 节点音量默认只有 70~80%
        2. Deck 自己的 sink 音量可能也不是满的

        ⚠️ 超过 100% 会削波（爆音），所以：
        - 默认只增益到 130%（SAFE_GAIN 内）
        - 上限硬限制在 MAX_GAIN（200%）
        - 返回值里带上 `clipping_warning`，让前端提示用户
        """
        try:
            g = max(1.0, min(bt.MAX_GAIN, float(gain)))
        except (TypeError, ValueError):
            g = 1.3

        applied = []

        # 1. 总音量（默认 sink）
        try:
            cur = await self.wp.get_volume()
            target = max(cur["volume"], g)
            await self.wp.set_volume(target)
            applied.append("总音量 -> %d%%" % round(target * 100))
        except Exception as e:  # noqa: BLE001
            self._log("增益：设置总音量失败 %s" % e)

        # 2. 外部源节点（手机推流）
        src_id = None
        try:
            text = await self.wp.status_text()
            if nodes is not None:
                src = nodes.find_bt_input(text)
                if src:
                    src_id = src["id"]
        except Exception:
            pass

        if src_id is not None:
            try:
                cur2 = await self.wp.get_volume_of(src_id)
                target2 = max(cur2["volume"], g)
                await self.wp.set_volume_of(src_id, target2)
                applied.append("外部音源 -> %d%%" % round(target2 * 100))
            except Exception as e:  # noqa: BLE001
                self._log("增益：设置外部源音量失败 %s" % e)

        warn = g > 1.0
        self._log("一键增益 %s：%s" % (g, "、".join(applied) or "无操作"))
        return {
            "ok": True,
            "gain": g,
            "applied": applied,
            "clipping_warning": warn,
            "hint": ("超过 100% 会削波，可能出现爆音。"
                     "如果听到破音请调回 100% 以内。") if warn else "",
        }

    @_safe
    async def set_auto_gain(self, enabled):
        """自动增益：音量低于阈值时自动拉高（每次 status 轮询时检查）。"""
        self.settings["auto_gain"] = bool(enabled)
        self._save_settings()
        return {"ok": True, "enabled": bool(enabled)}

    # ------------------------------------------------------------------
    # RPC：卡顿诊断与一键抗卡顿
    # ------------------------------------------------------------------
    @_safe
    async def diagnose_stutter(self):
        """诊断卡顿：查 Wi-Fi 频段 + PipeWire 的 client too slow。"""
        result = {
            "wifi": (await wifi.detect() if wifi is not None else None),
            "too_slow": (await wifi.check_too_slow() if wifi is not None else None),
            "latency_profile": self.settings.get("latency_profile", "balanced"),
            "codec": "",
        }
        if self.foc is not None:
            try:
                result["codec"] = await self.foc.get_active_profile()
            except Exception:
                pass
        return result

    @_safe
    async def fix_stutter(self):
        """一键抗卡顿：切到「抗卡顿」档位 + 拉满音量。

        针对 2.4GHz 干扰导致的 client too slow：
        - 加大 PipeWire 缓冲（抗卡顿档位）
        - 音量拉到 100%（避免用户以为「卡顿=没声音」）
        """
        if output is None:
            raise bt.BtError("output 模块未加载")
        applied = []

        # 1. 抗卡顿延迟档位
        self.outcfg.apply_latency("stable")
        self.settings["latency_profile"] = "stable"
        self._save_settings()
        applied.append("延迟档位 -> 抗卡顿（缓冲加大）")

        # 2. 音量拉满
        try:
            await self.wp.set_volume(1.0)
            applied.append("总音量 -> 100%")
        except Exception as e:  # noqa: BLE001
            self._log("抗卡顿：设置音量失败 %s" % e)

        # 3. 生效
        await self.wpcfg.restart()
        applied.append("WirePlumber 已重启")

        self._log("一键抗卡顿：%s" % "、".join(applied))
        return {"ok": True, "applied": applied}

    # ------------------------------------------------------------------
    # RPC：音质优化
    # ------------------------------------------------------------------
    @_safe
    async def set_codec_preset(self, preset):
        """切换编码器 / 重采样质量预设。

        这是音质提升最直接的手段：
        - SBC-XQ 相比普通 SBC 码率从 328 提到 452 kbps，听感明显更好
        - resample.quality 提到 10 能改善 44.1→48 的重采样劣化
        """
        if quality is None:
            raise bt.BtError("quality 模块未加载")
        if preset not in quality.CODEC_PRESETS:
            raise bt.BtError("未知音质预设：%s" % preset)

        self.qcfg.apply(preset)
        self.settings["codec_preset"] = preset
        self._save_settings()
        await self.wpcfg.restart()

        info = await quality.read_card_info()
        return {
            "ok": True,
            "preset": preset,
            "label": quality.CODEC_PRESETS[preset]["label"],
            "active_profile": info.get("active"),
            "available": info.get("available", []),
        }

    @_safe
    async def remove_quality(self):
        """移除音质优化配置，恢复系统默认。"""
        if quality is None:
            raise bt.BtError("quality 模块未加载")
        self.qcfg.remove()
        self.settings["codec_preset"] = ""
        self._save_settings()
        await self.wpcfg.restart()
        return {"ok": True, "installed": False}

    @_safe
    async def get_codec_info(self):
        """读取当前实际生效的编码器与可用列表。"""
        if quality is None:
            raise bt.BtError("quality 模块未加载")
        info = await quality.read_card_info()
        summary = quality.parse_active_profile(info.get("raw", ""))
        return {
            "active_profile": info.get("active", ""),
            "available": info.get("available", []),
            "summary": quality.codec_list(),
        }

    async def _apply_auto_gain(self, source_id, current_volume):
        """自动增益：仅在「刚发现外部音源」时补一次，之后完全交给用户。

        ⚠️ 为什么改成这样（真机反馈「音量调节没同步」的根因）
        --------------------------------------------------
        早期版本每轮轮询都检查，只要音量 < 75% 就拉到 100%。后果：
        用户把音量调到 50%，**90 秒保护期一过就被自动增益改回 100%**。
        用户感受就是「调了没用、自己会跳」。

        现在的策略：
        1. **默认关闭**（`auto_gain` 默认 False）
        2. 即使开启，也**每个音源会话只补一次**（`_auto_gain_done` 标记），
           之后绝不重复干预
        3. 用户手动调过音量后，本次会话内永久不再自动干预
        """
        if not self.settings.get("auto_gain", False):
            return

        # 用户手动调过 -> 本次会话内永不再干预
        if self._last_manual_volume > 0:
            return

        # 本次会话已经补过一次 -> 不再重复
        if self._auto_gain_done:
            return

        # 只处理「外部源偏轻」这一种情况，不动总音量
        if source_id is None or current_volume is None:
            return
        if current_volume >= bt.LOW_VOLUME_THRESHOLD:
            self._auto_gain_done = True
            return

        try:
            await self.wp.set_volume_of(source_id, 1.0)
            self._auto_gain_done = True
            self._log("自动增益（一次性）：外部源 %.0f%% -> 100%%" % (current_volume * 100))
        except Exception as e:  # noqa: BLE001
            self._log("自动增益失败：%s" % e)

    # ------------------------------------------------------------------
    # RPC：音频焦点
    # ------------------------------------------------------------------
    @_safe
    async def set_focus_mode(self, mode):
        """切换音频焦点策略。

        - receiver_first：蓝牙连上时，把外部源音量提到较高水平（不改默认设备）
        - coexist：两者都出声（默认）
        - manual：插件完全不插手

        刻意**不调用** `wpctl set-default`：那个选择会被永久记住且压过所有
        priority.session，用户之后在系统里怎么切都会被它抢回去。
        """
        if focus is None:
            raise bt.BtError("focus 模块未加载")
        if mode not in focus.MODES:
            raise bt.BtError("未知焦点模式：%s" % mode)
        self.settings["focus_mode"] = mode
        self._save_settings()
        applied = []
        if mode == "receiver_first":
            # 关掉自动切通话模式，避免一开麦就变单声道
            try:
                await self.foc.set_autoswitch(False)
                applied.append("关闭自动切通话模式")
            except Exception as e:  # noqa: BLE001
                self._log("设置 autoswitch 失败：%s" % e)
        elif mode == "coexist":
            try:
                await self.foc.set_autoswitch(False)
                applied.append("关闭自动切通话模式")
            except Exception:
                pass
        self._log("焦点模式切换为 %s（%s）" % (mode, "、".join(applied) or "无附加操作"))
        return {"ok": True, "mode": mode, "applied": applied}

    @_safe
    async def get_autoswitch(self):
        if focus is None:
            raise bt.BtError("focus 模块未加载")
        return {"enabled": await self.foc.get_autoswitch()}

    @_safe
    async def set_autoswitch(self, enabled):
        if focus is None:
            raise bt.BtError("focus 模块未加载")
        await self.foc.set_autoswitch(bool(enabled))
        return {"ok": True, "enabled": bool(enabled)}

    # ------------------------------------------------------------------
    # RPC：静音守卫 / 音量归一化
    # ------------------------------------------------------------------
    @_safe
    async def set_silence_timeout(self, seconds):
        """设置静音多少秒后自动断开（0 = 关闭）。"""
        if silence is None:
            raise bt.BtError("silence 模块未加载")
        sec = max(0, min(3600, int(seconds or 0)))
        self.settings["silence_disconnect"] = sec
        self._save_settings()
        if self.guard is None:
            self.guard = silence.SilenceGuard(sec, self._log)
        else:
            self.guard.configure(sec)
        self._log("静音自动断开设为 %d 秒" % sec)
        return {"ok": True, "timeout": sec, "enabled": sec > 0}

    @_safe
    async def set_volume_baseline(self, value):
        """把当前外部源音量设为归一化基线（用于检测后续跳变）。"""
        if self.norm is None:
            raise bt.BtError("silence 模块未加载")
        self.norm.set_baseline(value)
        return {"ok": True, "baseline": value}

    @_safe
    async def reset_volume_baseline(self):
        if self.norm is None:
            raise bt.BtError("silence 模块未加载")
        self.norm.reset()
        return {"ok": True}

    # ------------------------------------------------------------------
    # RPC：均衡器
    # ------------------------------------------------------------------
    @_safe
    async def set_eq_preset(self, preset):
        """切换 EQ 预设。会写配置并重启 PipeWire 让它生效。

        注意：「平直」模式会直接删除配置文件、卸载虚拟 sink，
        避免所有音频多绕一级虚拟设备（真机反馈声音偏小的问题）。
        """
        if eq is None:
            raise bt.BtError("eq 模块未加载")
        if preset not in eq.PRESETS:
            raise bt.BtError("未知 EQ 预设：%s" % preset)
        self.eqcfg.apply(preset)
        self.settings["eq_preset"] = preset
        self._save_settings()
        await self._restart_pipewire()
        return {
            "ok": True,
            "preset": preset,
            "label": eq.PRESETS[preset]["label"],
            "installed": eq.EqConfig.installed(),
        }

    @_safe
    async def remove_eq(self):
        if eq is None:
            raise bt.BtError("eq 模块未加载")
        self.eqcfg.remove()
        self.settings["eq_preset"] = "flat"
        self._save_settings()
        await self._restart_pipewire()
        return {"ok": True, "installed": False}

    @_safe
    async def import_autoeq(self, text):
        """导入 AutoEQ / Squiglink 的 ParametricEQ 文本。"""
        if eq is None:
            raise bt.BtError("eq 模块未加载")
        parsed = eq.autoeq_to_filters(text)
        if not parsed["filters"]:
            raise bt.BtError(
                "没有解析到任何滤波器。请确认是 AutoEQ 的 ParametricEQ.txt 格式"
                "（形如 `Filter 1: ON PK Fc 21 Hz Gain 6.7 dB Q 1.100`）"
            )
        if len(parsed["filters"]) > 20:
            raise bt.BtError("滤波器太多（%d 段），最多支持 20 段" % len(parsed["filters"]))
        self.eqcfg.apply_custom(parsed["filters"], label="AutoEQ 自定义")
        self.settings["eq_preset"] = "custom"
        self._save_settings()
        await self._restart_pipewire()
        return {
            "ok": True,
            "bands": len(parsed["filters"]),
            "preamp": parsed["preamp"],
            "skipped": parsed["skipped"],
        }

    async def _restart_pipewire(self):
        """重启用户级 PipeWire 让配置生效。

        为什么不能直接 `systemctl --user restart pipewire`？
        --------------------------------------------------
        Decky 的后端进程虽然以 deck 用户运行，但**没有继承 `XDG_RUNTIME_DIR`**，
        所以 `systemctl --user` 连不上会话总线，报
        "Failed to connect to bus: No medium found"。

        正确做法是把 `XDG_RUNTIME_DIR` / `DBUS_SESSION_BUS_ADDRESS` 显式传给子进程。
        """
        env = bt._user_session_env()
        env_args = ["%s=%s" % (k, v) for k, v in env.items()]

        # 方案 1：带环境变量重启（最可靠）
        for unit in ("pipewire", "pipewire.service"):
            rc, out = await bt.run_cmd(
                ["env"] + env_args + ["systemctl", "--user", "restart", unit], timeout=20.0
            )
            if rc == 0:
                self._log("PipeWire 已重启（%s，带 XDG_RUNTIME_DIR）" % unit)
                return True
            tail = (out or "").strip().splitlines()
            self._log("重启 %s 失败：%s" % (unit, tail[-1] if tail else "?"))

        # 方案 2：sudo -n 兜底（配了免密 sudo 才行，失败就跳过）
        for unit in ("pipewire", "pipewire.service"):
            try:
                rc, out = await bt.run_cmd(
                    ["sudo", "-n", "systemctl", "restart", unit], timeout=20.0
                )
                if rc == 0:
                    self._log("PipeWire 已通过 sudo 重启（%s）" % unit)
                    return True
            except bt.BtError:
                break

        uid = env.get("XDG_RUNTIME_DIR", "/run/user/1000").split("/")[-1]
        raise bt.BtError(
            "重启 PipeWire 失败（通常是 Decky 后端缺少会话环境变量）。\n"
            "请手动执行一次：\n"
            "  XDG_RUNTIME_DIR=/run/user/%s systemctl --user restart pipewire\n"
            "或者直接重启 Deck。" % uid
        )

    # ------------------------------------------------------------------
    # RPC：延迟档位 / 多输出同步
    # ------------------------------------------------------------------
    @_safe
    async def set_latency_profile(self, profile):
        """切换延迟档位（写 WirePlumber 配置并重启它）。"""
        if output is None:
            raise bt.BtError("output 模块未加载")
        if profile not in output.LATENCY_PROFILES:
            raise bt.BtError("未知延迟档位：%s" % profile)
        self.outcfg.apply_latency(profile)
        self.settings["latency_profile"] = profile
        self._save_settings()
        await self.wpcfg.restart()
        return {
            "ok": True,
            "profile": profile,
            "label": output.LATENCY_PROFILES[profile]["label"],
            "latency_ms": output.LATENCY_PROFILES[profile]["latency_ms"],
        }

    @_safe
    async def set_multi_output(self, enabled):
        """开关多输出同步（combine-stream）。

        注意：这是 Deck **同时推流到多个输出设备**（喇叭 + 多副耳机）。
        反方向（多个蓝牙源同时连 Deck 当音箱）受 AVDTP 协议限制，做不到。
        """
        if output is None:
            raise bt.BtError("output 模块未加载")
        enabled = bool(enabled)
        self.outcfg.apply(enabled)
        self.settings["multi_output"] = enabled
        self._save_settings()
        await self._restart_pipewire()
        return {"ok": True, "enabled": enabled}

    @_safe
    async def list_outputs(self):
        if output is None:
            raise bt.BtError("output 模块未加载")
        return {"sinks": await output.list_sinks(self.wp)}

    @_safe
    async def set_setting(self, key, value):
        if key not in DEFAULT_SETTINGS:
            raise bt.BtError("未知设置项：%s" % key)
        self.settings[key] = value
        self._save_settings()
        if key == "keep_alive":
            if value and self._keep_task is None:
                self._keep_task = asyncio.create_task(self._keep_alive_loop())
            elif not value and self._keep_task is not None:
                self._keep_task.cancel()
                self._keep_task = None
        return {"ok": True, "settings": self.settings}

    # ------------------------------------------------------------------
    # RPC：音频调优（用户级 WirePlumber 配置，不需要 root）
    # ------------------------------------------------------------------
    @_safe
    async def apply_tuning(self):
        """写入用户级 WirePlumber 配置并重启 WirePlumber，解决常见的「连上没声音 / 变单声道」。"""
        self.wpcfg.apply()
        await self.wpcfg.restart()
        return {"ok": True, "installed": True, "path": bt.WpConfig.conf_path()}

    @_safe
    async def remove_tuning(self):
        """删掉本插件写入的配置，恢复系统默认行为。"""
        self.wpcfg.remove()
        await self.wpcfg.restart()
        return {"ok": True, "installed": False}

    # ------------------------------------------------------------------
    # RPC：诊断
    # ------------------------------------------------------------------
    @_safe
    async def diagnose(self):
        """把排查用的原始信息一次性打包，方便贴给作者。"""
        out = {
            "tools": {}, "adapter_raw": "", "wp_status": "", "versions": {},
            "agent": False, "settings": {}, "tuning": {}, "power": {},
            "checks": [], "modules": {},
        }
        for name in ("bluetoothctl", "busctl", "wpctl", "pipewire", "wireplumber",
                     "pactl", "pw-dump", "pw-link", "gdbus"):
            out["tools"][name] = bt.which(name)

        # 各功能模块是否加载成功（排查「某个功能整块不工作」时最有用）
        out["modules"] = {
            "bt": bt is not None,
            "power": power is not None,
            "nodes": nodes is not None,
            "focus": focus is not None,
            "silence": silence is not None,
            "eq": eq is not None,
            "output": output is not None,
            "metadata": metadata is not None,
        }

        try:
            info = await self.bz.show(force=True)
            out["adapter_raw"] = info.get("raw", "")
        except Exception as e:  # noqa: BLE001
            out["adapter_raw"] = "读取失败：%s" % e

        try:
            out["wp_status"] = await self.wp.status_text()
        except Exception as e:  # noqa: BLE001
            out["wp_status"] = "读取失败：%s" % e

        out["versions"] = await bt.versions()
        out["agent"] = self.bz.agent_alive()
        out["settings"] = self.settings
        out["tuning"] = {"installed": bt.WpConfig.installed(), "path": bt.WpConfig.conf_path()}
        out["power"] = {
            "watching": bool(self.sleeper and self.sleeper.alive()),
            "backend": (self.sleeper.backend if self.sleeper else ""),
            "events": (self.sleeper.event_count if self.sleeper else 0),
            "last": (self.sleeper.last_event if self.sleeper else None),
            "module": power is not None,
        }

        # 逐项自检：把「能不能用」变成明确的 ✅/❌ 而不是让用户猜
        out["checks"] = self._run_checks(out)
        return out

    def _run_checks(self, d):
        """生成一组可读的自检项。"""
        checks = []

        def add(name, ok, detail=""):
            checks.append({"name": name, "ok": bool(ok), "detail": detail})

        tools = d.get("tools") or {}
        add("bluetoothctl 可用", tools.get("bluetoothctl"), "bluez-utils")
        add("busctl 可用", tools.get("busctl"), "systemd")
        add("wpctl 可用", tools.get("wpctl"), "wireplumber")

        raw = d.get("adapter_raw") or ""
        add("检测到蓝牙适配器", "Controller" in raw, "bluetoothctl show")
        add("适配器支持 A2DP Sink", bt.A2DP_SINK_UUID in raw.lower(),
            "UUID 0000110b（当音箱的必要条件）")
        add("蓝牙已上电", "Powered: yes" in raw)
        add("配对 agent 在运行", d.get("agent"), "NoInputNoOutput")
        add("可被发现", "Discoverable: yes" in raw, "BlueZ 默认 180 秒超时")

        wp = d.get("wp_status") or ""
        add("PipeWire 有音频输出", "Sinks:" in wp, "wpctl status")

        vers = d.get("versions") or {}
        add("PipeWire 版本可读", bool(vers.get("pipewire")), vers.get("pipewire", ""))
        add("WirePlumber 版本可读", bool(vers.get("wireplumber")), vers.get("wireplumber", ""))

        mods = d.get("modules") or {}
        bad = [k for k, v in mods.items() if not v]
        add("后端模块全部加载", not bad, ("缺失：" + ", ".join(bad)) if bad else "8/8")

        return checks

    @_safe
    async def report(self):
        """生成一份可直接粘贴的纯文本诊断报告。"""
        d = await self.diagnose()
        if isinstance(d, dict) and _ERR in d:
            return d
        lines = []
        lines.append("=== 蓝牙音箱插件诊断报告 ===")
        lines.append("时间：%s" % time.strftime("%Y-%m-%d %H:%M:%S"))
        v = d.get("versions") or {}
        lines.append("PipeWire %s / WirePlumber %s / BlueZ %s"
                     % (v.get("pipewire", "?"), v.get("wireplumber", "?"), v.get("bluez", "?")))
        lines.append("")
        lines.append("--- 自检 ---")
        for c in d.get("checks") or []:
            lines.append("%s %s%s" % (
                "✅" if c["ok"] else "❌", c["name"],
                ("（%s）" % c["detail"]) if c.get("detail") else "",
            ))
        lines.append("")
        lines.append("--- 工具 ---")
        for k, val in (d.get("tools") or {}).items():
            lines.append("%s %s" % ("✅" if val else "❌", k))
        lines.append("")
        lines.append("--- 模块 ---")
        for k, val in (d.get("modules") or {}).items():
            lines.append("%s %s" % ("✅" if val else "❌", k))
        lines.append("")
        lines.append("--- 设置 ---")
        for k, val in (d.get("settings") or {}).items():
            lines.append("%s = %s" % (k, val))
        lines.append("")
        lines.append("--- bluetoothctl show ---")
        lines.append(d.get("adapter_raw") or "（空）")
        lines.append("")
        lines.append("--- wpctl status ---")
        lines.append(d.get("wp_status") or "（空）")
        return {"text": "\n".join(lines)}

    @_safe
    async def get_log(self, tail=200):
        text = ""
        try:
            if self.log_file and os.path.exists(self.log_file):
                with open(self.log_file, "r", encoding="utf-8", errors="replace") as f:
                    lines = f.readlines()
                text = "".join(lines[-max(1, int(tail)):])
        except Exception as e:  # noqa: BLE001
            text = "读取日志失败：%s" % e
        return {"path": self.log_file, "text": text}
