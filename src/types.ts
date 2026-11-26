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
}

export interface SpeakerStatus {
  ok: boolean;
  error: string | null;
  adapter: AdapterInfo | null;
  volume: VolumeInfo;
  sink: string;
  live: LiveSource | null;
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
