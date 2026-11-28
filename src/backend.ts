import { call as deckyCall } from "@decky/api";
import type { SpeakerStatus, DiagnoseInfo, InhibitInfo } from "./types";

/** 包一层 call：后端出错时返回 {__bt_error__}，这里转成可读 Error 抛出 */
async function call<Args extends any[] = [], Return = any>(route: string, ...args: Args): Promise<Return> {
  const r: any = await deckyCall<Args, Return>(route, ...args);
  if (r && typeof r === "object" && "__bt_error__" in r) {
    throw new Error(String(r["__bt_error__"]));
  }
  return r as Return;
}

export const api = {
  status: () => call<[], SpeakerStatus>("status"),
  setDiscoverable: (on: boolean) => call<[boolean], { ok: boolean }>("set_discoverable", on),
  setPower: (on: boolean) => call<[boolean], { ok: boolean }>("set_power", on),
  unblockRfkill: () => call<[], { ok: boolean; rfkill: any }>("unblock_rfkill"),
  restartAgent: () => call<[], { ok: boolean; agent: boolean; registered: boolean }>("restart_agent"),
  pairDevice: (mac: string) => call<[string], { ok: boolean }>("pair_device", mac),
  scanStart: (timeout = 20) => call<[number], { ok: boolean; scanning: boolean }>("scan_start", timeout),
  /** 拉取当前扫描结果（边扫边出） */
  scanList: () => call<[], { ok: boolean; devices: any[]; scanning: boolean }>("scan_list"),
  /** 停止扫描 */
  scanStop: () => call<[], { ok: boolean }>("scan_stop"),
  pairDeviceFull: (mac: string) =>
    call<[string], { ok: boolean; agent: boolean }>("pair_device_full", mac),
  repairDevice: (mac: string) => call<[string], { ok: boolean; agent: boolean }>("repair_device", mac),
  setAlias: (alias: string) => call<[string], { ok: boolean; alias: string }>("set_alias", alias),
  deviceAction: (
    mac: string,
    action: "connect" | "disconnect" | "trust" | "untrust" | "pair" | "remove" | "block" | "unblock" | "alias",
    value?: string,
  ) => call<[string, string, string?], {
    ok: boolean;
    /** connect / pair 时会带回 A2DP 协商结果（ready=false 只是「还在协商」） */
    a2dp?: { ready: boolean; seconds: number; profile: string; reason: string; repaired?: boolean };
  }>("device_action", mac, action, value),
  /** 等 A2DP 就绪（界面显示「正在协商」时可反复调用刷新） */
  waitA2dp: (mac?: string, seconds = 12) =>
    call<[string | undefined, number], { ready: boolean; seconds: number; profile: string; reason: string }>(
      "wait_a2dp", mac, seconds),
  /** 强制把蓝牙卡切到 a2dp-sink（协商卡在 off / HFP 时用） */
  fixA2dp: (mac?: string) =>
    call<[string | undefined], { ok: boolean; profile?: string; previous?: string; reason?: string; detail?: string; available?: string[] }>(
      "fix_a2dp", mac),
  /** 断开所有已连接设备 */
  /** 息屏状态 */
  getScreen: () =>
    call<[], { available: boolean; dimmed: boolean; current?: number; max?: number; saved?: number; elapsed?: number; max_seconds?: number; inhibit_held?: boolean }>("get_screen"),
  /** 息屏（背光归 0 + 抑制自动休眠，否则蓝牙会断） */
  dimScreen: () =>
    call<[], {
      ok: boolean; dimmed: boolean; max_seconds: number; backlight_off?: boolean;
      inhibit?: { ok: boolean; what: string; error: string };
    }>("dim_screen"),
  /** 恢复显示 */
  undimScreen: () => call<[], { ok: boolean; dimmed: boolean }>("undim_screen"),
  /** 休眠抑制状态 + 系统里所有 inhibitor 锁 */
  getInhibit: () => call<[], InhibitInfo>("get_inhibit"),
  /** 息屏能力诊断 */
  getScreenDiag: () => call<[], any>("get_screen_diag"),
  setVolume: (v: number) => call<[number], { ok: boolean }>("set_volume", v),
  /** 相对调节：不读当前值，直接增减。避免依赖读取，因此不会出现同步问题。 */
  stepVolume: (delta: number) => call<[number], { ok: boolean }>("step_volume", delta),
  setMute: (m: boolean) => call<[boolean], { ok: boolean }>("set_mute", m),
  boostVolume: (gain = 1.5) =>
    call<[number], { ok: boolean; gain: number; applied: string[] }>("boost_volume", gain),
  diagnoseStutter: () => call<[], any>("diagnose_stutter"),
  fixStutter: () => call<[], { ok: boolean; applied: string[] }>("fix_stutter"),
  setCodecPreset: (preset: string) =>
    call<[string], { ok: boolean; preset: string; label: string; active_profile: string; available: string[] }>("set_codec_preset", preset),
  setFocusMode: (mode: string) =>
    call<[string], { ok: boolean; mode: string; applied: string[] }>("set_focus_mode", mode),
  setSilenceTimeout: (sec: number) =>
    call<[number], { ok: boolean; timeout: number; enabled: boolean }>("set_silence_timeout", sec),
  setVolumeBaseline: (v: number) => call<[number], { ok: boolean }>("set_volume_baseline", v),
  resetVolumeBaseline: () => call<[], { ok: boolean }>("reset_volume_baseline"),
  setEqPreset: (preset: string) =>
    call<[string], { ok: boolean; preset: string; label: string }>("set_eq_preset", preset),
  removeEq: () => call<[], { ok: boolean; installed: boolean }>("remove_eq"),
  importAutoeq: (text: string) =>
    call<[string], { ok: boolean; bands: number; preamp: number; skipped: number }>("import_autoeq", text),
  setLatencyProfile: (profile: string) =>
    call<[string], { ok: boolean; profile: string; label: string; latency_ms: number }>("set_latency_profile", profile),
  setMultiOutput: (on: boolean) =>
    call<[boolean], { ok: boolean; enabled: boolean }>("set_multi_output", on),
  setSetting: (key: string, value: any) =>
    call<[string, any], { ok: boolean }>("set_setting", key, value),
  applyTuning: () => call<[], { ok: boolean; installed: boolean; path: string }>("apply_tuning"),
  removeTuning: () => call<[], { ok: boolean; installed: boolean }>("remove_tuning"),
  diagnose: () => call<[], DiagnoseInfo>("diagnose"),
  report: () => call<[], { text: string }>("report"),
  getLog: (tail = 200) => call<[number], { path: string; text: string }>("get_log", tail),
};
