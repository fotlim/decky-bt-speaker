import { call as deckyCall } from "@decky/api";
import type { SpeakerStatus, DiagnoseInfo } from "./types";

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
  setAlias: (alias: string) => call<[string], { ok: boolean; alias: string }>("set_alias", alias),
  deviceAction: (mac: string, action: "connect" | "disconnect" | "trust" | "untrust" | "pair" | "remove") =>
    call<[string, string], { ok: boolean }>("device_action", mac, action),
  setVolume: (v: number) => call<[number], { ok: boolean }>("set_volume", v),
  setMute: (m: boolean) => call<[boolean], { ok: boolean }>("set_mute", m),
  setSourceVolume: (nodeId: number, v: number) =>
    call<[number, number], { ok: boolean; volume: number }>("set_source_volume", nodeId, v),
  setSourceMute: (nodeId: number, m: boolean) =>
    call<[number, boolean], { ok: boolean }>("set_source_mute", nodeId, m),
  setFocusMode: (mode: string) =>
    call<[string], { ok: boolean; mode: string; applied: string[] }>("set_focus_mode", mode),
  getAutoswitch: () => call<[], { enabled: boolean | null }>("get_autoswitch"),
  setAutoswitch: (on: boolean) => call<[boolean], { ok: boolean; enabled: boolean }>("set_autoswitch", on),
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
  listOutputs: () => call<[], { sinks: any[] }>("list_outputs"),
  setSetting: (key: string, value: any) =>
    call<[string, any], { ok: boolean }>("set_setting", key, value),
  applyTuning: () => call<[], { ok: boolean; installed: boolean; path: string }>("apply_tuning"),
  removeTuning: () => call<[], { ok: boolean; installed: boolean }>("remove_tuning"),
  diagnose: () => call<[], DiagnoseInfo>("diagnose"),
  report: () => call<[], { text: string }>("report"),
  getLog: (tail = 200) => call<[number], { path: string; text: string }>("get_log", tail),
};
