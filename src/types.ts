export interface BtDevice {
  mac: string;
  name: string;
  /** 给界面用的可读名：没广播名字时按类型 + MAC 后缀拼，例如「手机 · EE:FF」 */
  display?: string;
  /** 设备是否真的广播了名字（false 表示是推断出来的标签） */
  has_real_name?: boolean;
  alias?: string;
  icon?: string;
  class?: string;
  /** 信号强度 dBm（扫描时才有，部分设备不提供） */
  rssi?: number | null;
  /** 设备支持的服务短码，如 ['0000110b']（音频接收能力） */
  uuids?: string[];
  /** 服务是否已解析完成（连接成功后才有意义） */
  services_resolved?: boolean;
  paired?: boolean;
  trusted?: boolean;
  connected?: boolean;
  blocked?: boolean;
}

export interface AdapterInfo {
  address: string;
  alias: string;
  name: string;
  powered: boolean;
  power_state: string;
  discoverable: boolean;
  pairable: boolean;
  discovering: boolean;
  class: string;
  a2dp_sink: boolean;
  a2dp_source: boolean;
  hfp_ag: boolean;
  hfp_hf: boolean;
}

export interface VolumeInfo {
  volume: number;
  muted: boolean;
  /** false 表示读取失败（此时 volume 无意义，不要显示成 0%） */
  ok?: boolean;
  error?: string;
  raw?: string;
}

export interface Settings {
  auto_start: boolean;
  discoverable: boolean;
  keep_alive: boolean;
  alias: string;
  resume_restore: boolean;
  last_device: string;
  focus_mode: "receiver_first" | "coexist" | "manual";
  silence_disconnect: number;
  eq_preset: string;
  latency_profile: string;
  multi_output: boolean;
  auto_gain: boolean;
  /** 音质预设：balanced / quality / stable / ""（未设置） */
  codec_preset: string;
}

export interface CodecInfo {
  profile: string;
  codec: string;
  role: string;
}

export interface FocusInfo {
  mode: string;
  label: string;
}

export interface PowerInfo {
  watching: boolean;
  backend: string;
  events: number;
  last: [string, number] | null;
}

export interface Versions {
  pipewire: string;
  wireplumber: string;
  bluez: string;
}

export interface TuningInfo {
  installed: boolean;
  path: string;
}

export interface LiveSource {
  id: number;
  name: string;
  volume: number;
  muted: boolean;
  norm?: { jumped: boolean; baseline: number | null; delta: number };
}

export interface TrackInfo {
  title: string;
  artist: string;
  album: string;
  genre: string;
  track_number: number;
  total_tracks: number;
  duration_ms: number;
  duration: string;
  status: string;
  status_label: string;
  position_ms: number;
  position: string;
  mac: string;
}

export interface SilenceInfo {
  enabled: boolean;
  timeout: number;
  idle_sec: number;
  was_active: boolean;
  remaining: number | null;
}

export interface EqPreset {
  key: string;
  /** i18n key（后端只返回 key，文案由前端翻译） */
  label_key: string;
  desc_key: string;
  bands: number;
}

export interface EqInfo {
  installed: boolean;
  preset: string;
  presets: EqPreset[];
  path: string;
}

export interface NormalizeInfo {
  baseline: number | null;
  last: number | null;
  jumps: number;
}

export interface LatencyProfile {
  key: string;
  /** i18n key（后端只返回 key，文案由前端翻译） */
  label_key: string;
  desc_key: string;
  latency_ms: number;
}

export interface SinkNode {
  id: number;
  name: string;
  default: boolean;
}

export interface OutputInfo {
  multi: boolean;
  installed: boolean;
  latency: string;
  latency_profiles: LatencyProfile[];
  sinks: SinkNode[];
}

export interface RfkillInfo {
  soft: boolean;
  hard: boolean;
  found: boolean;
}

export interface WifiInterface {
  interface: string;
  ssid: string;
  channel: number | null;
  freq_mhz: number | null;
  width: string;
}

export interface WifiInfo {
  available: boolean;
  risk: "none" | "high" | "unknown";
  advice: string;
  wifi_24g: WifiInterface[];
  wifi_5g: WifiInterface[];
  interfaces: WifiInterface[];
}

export interface CodecPreset {
  key: string;
  /** i18n key（后端只返回 key，文案由前端翻译） */
  label_key: string;
  desc_key: string;
  resample: number;
}

export interface QualityInfo {
  preset: string;
  presets: CodecPreset[];
  installed: boolean;
  active_profile: string;
}

export interface ScreenInfo {
  /** 当前环境能不能息屏（有背光设备 + 有写入途径） */
  available: boolean;
  /** 是否已息屏（背光归 0） */
  dimmed: boolean;
  /** 已息屏秒数 */
  elapsed?: number;
  /** 兜底自动恢复的时限（秒） */
  max_seconds?: number;
  current?: number;
  max?: number;
  /** 是否已拿到休眠抑制锁（拿不到的话息屏后蓝牙仍会断） */
  inhibit_held?: boolean;
  /** 系统里有没有 systemd-inhibit */
  inhibit_available?: boolean;
}

/** 息屏时拿到的休眠抑制锁状态 */
export interface InhibitInfo {
  available: boolean;
  held: boolean;
  what: string;
  seconds: number;
  starts: number;
  failures: number;
  last_error: string;
  /** `systemd-inhibit --list` 原始输出 */
  system?: string;
}

/** A2DP 接收端协商状态。
 *
 * `ready=false` **不是错误** —— 蓝牙连上后还要走 SDP 服务发现、
 * AVDTP 能力协商、WirePlumber 建卡切 profile 三步，常见 1~6 秒。
 * 界面应该显示「正在协商」，而不是「失败」。
 */
export interface A2dpInfo {
  ready: boolean;
  /** 当前生效的 profile，如 a2dp-sink-sbc_xq */
  profile: string;
  /** 这张卡支持的 profile 列表 */
  available?: string[];
  /** 未就绪的原因：negotiating / no-card / error */
  reason: string;
  /**
   * 就绪依据（排查用）：
   * - `node`：PipeWire 里有 bluez_input 节点（**强判据**，流真建起来才有）
   * - `profile`：卡片 profile 是 a2dp-sink（弱判据）
   * - 空串：未就绪
   */
  via?: string;
}

export interface SpeakerStatus {
  ok: boolean;
  error: string | null;
  adapter: AdapterInfo | null;
  rfkill: RfkillInfo;
  agent_registered: boolean;
  volume: VolumeInfo;
  sink: string;
  live: LiveSource | null;
  track: TrackInfo | null;
  codec: CodecInfo;
  /** A2DP 接收端就绪状态 */
  a2dp?: A2dpInfo | null;
  focus: FocusInfo;
  silence: SilenceInfo | null;
  normalize: NormalizeInfo | null;
  wifi: WifiInfo | null;
  screen?: ScreenInfo | null;
  quality: QualityInfo;
  eq: EqInfo;
  output: OutputInfo;
  connected: BtDevice[];
  paired: BtDevice[];
  agent: boolean;
  settings: Settings;
  tuning: TuningInfo;
  power: PowerInfo;
  versions: Versions;
  tools: { bluetoothctl: boolean; busctl: boolean; wpctl: boolean };
}

export interface CheckItem {
  /** i18n key（后端只返回 key，前端按当前语言翻译） */
  key: string;
  ok: boolean;
  detail: string;
}

export interface DiagnoseInfo {
  tools: Record<string, boolean>;
  adapter_raw: string;
  wp_status: string;
  versions: Versions;
  agent: boolean;
  settings: Settings;
  checks: CheckItem[];
  modules: Record<string, boolean>;
}
