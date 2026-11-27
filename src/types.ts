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
  label: string;
  desc: string;
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
  label: string;
  desc: string;
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
  label: string;
  desc: string;
  resample: number;
}

export interface QualityInfo {
  preset: string;
  presets: CodecPreset[];
  installed: boolean;
  active_profile: string;
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
  focus: FocusInfo;
  silence: SilenceInfo | null;
  normalize: NormalizeInfo | null;
  wifi: WifiInfo | null;
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
