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

DEFAULT_SETTINGS = {
    "auto_start": True,        # 插件加载时自动进入「可被发现」
    "discoverable": True,      # 期望的可被发现状态（用于保活）
    "keep_alive": True,        # 每 60s 复查一次可发现性（BlueZ 默认 180s 超时）
    "alias": "Steam Deck",
    "resume_restore": True,    # 唤醒后自动恢复可发现 / 重连上次的设备
    "last_device": "",         # 上次连接过的设备 MAC（唤醒后优先重连它）
}

_ERR = "__bt_error__"


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
    _keep_task = None
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
        s = dict(DEFAULT_SETTINGS)
        try:
            if self.settings_path and os.path.exists(self.settings_path):
                with open(self.settings_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                if isinstance(data, dict):
                    for k in DEFAULT_SETTINGS:
                        if k in data:
                            s[k] = data[k]
        except Exception as e:  # noqa: BLE001
            self._log("读取设置失败：%s" % e)
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
            except asyncio.CancelledError:
                raise
            except Exception as e:  # noqa: BLE001
                self._log("保活循环异常：%s" % e)

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

        vol = {"volume": 0.0, "muted": False}
        sink = ""
        try:
            vol = await self.wp.get_volume()
            sink = bt.Wp.parse_default_sink(await self.wp.status_text())
        except Exception as e:  # noqa: BLE001
            self._log("读取音量失败：%s" % e)

        connected, paired = [], []
        try:
            connected = await self.bz.list_devices("Connected")
            paired = await self.bz.list_devices("Paired")
        except Exception as e:  # noqa: BLE001
            self._log("读取设备列表失败：%s" % e)

        # 已连接设备的详情（图标/类别用来在 UI 上区分手机和电脑）
        details = []
        for d in connected:
            try:
                details.append(await self.bz.info(d["mac"]))
            except Exception:
                details.append({"mac": d["mac"], "name": d["name"], "connected": True, "paired": True, "icon": ""})

        return {
            "ok": err is None,
            "error": err,
            "adapter": adapter,
            "volume": vol,
            "sink": sink,
            "connected": details,
            "paired": paired,
            "agent": self.bz.agent_alive(),
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
        await self.wp.set_volume(value)
        return {"ok": True, "volume": max(0.0, min(1.5, float(value)))}

    @_safe
    async def set_mute(self, muted):
        await self.wp.set_mute(bool(muted))
        return {"ok": True, "muted": bool(muted)}

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
        out = {"tools": {}, "adapter_raw": "", "wp_status": "", "versions": {}, "agent": False}
        for name in ("bluetoothctl", "busctl", "wpctl", "pipewire", "wireplumber"):
            out["tools"][name] = bt.which(name)
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
        return out

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
