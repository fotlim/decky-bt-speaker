export interface BtDevice {
  mac: string;
  name: string;
  alias?: string;
  icon?: string;
  class?: string;
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

export interface NormalizeInfo {
  baseline: number | null;
  last: number | null;
  jumps: number;
}

export interface EqInfo {
  installed: boolean;
  preset: string;
  presets: EqPreset[];
  path: string;
}

export interface SpeakerStatus {
  ok: boolean;
  error: string | null;
  adapter: AdapterInfo | null;
  volume: VolumeInfo;
  sink: string;
  live: LiveSource | null;
  codec: CodecInfo;
  focus: FocusInfo;
  silence: SilenceInfo | null;
  normalize: NormalizeInfo | null;
  eq: EqInfo;
  connected: BtDevice[];
  paired: BtDevice[];
  agent: boolean;
  settings: Settings;
  tuning: TuningInfo;
  power: PowerInfo;
  versions: Versions;
  tools: { bluetoothctl: boolean; busctl: boolean; wpctl: boolean };
}

export interface DiagnoseInfo {
  tools: Record<string, boolean>;
  adapter_raw: string;
  wp_status: string;
  versions: Versions;
  agent: boolean;
  settings: Settings;
}
