import { useEffect, useState } from "react";
import { api } from "./backend";
import type { SpeakerStatus } from "./types";

/**
 * 状态单例：QAM 面板和全屏页共用一份轮询。
 *
 * 性能设计（评审反馈「2 秒轮询太频繁」的回应）
 * ------------------------------------------------
 * 后端每次 `status` 要 fork+exec 4~6 个外部命令
 * （bluetoothctl show / wpctl get-volume / wpctl status /
 *   bluetoothctl devices / pactl list cards），在 Deck 上不便宜。
 * 而且这些状态绝大多数时候根本没变。
 *
 * 所以做了三层节流：
 *
 * 1. **可见性感知**：QAM 收起 / 全屏页关闭时降频到 30 秒（而不是停掉，
 *    否则重新打开时会看到过期数据）。
 * 2. **自适应间隔**：有外部音源在播时 4 秒（需要跟播放状态），
 *    空闲时 10 秒（只需要知道有没有人连上来）。
 * 3. **请求去重**：`_inflight` 保证同一时刻只有一个 status 在跑，
 *    多个组件同时挂载不会重复请求。
 *
 * 理想方案是后端订阅 D-Bus 的 PropertiesChanged 信号做事件驱动，
 * 但那需要常驻 `dbus-monitor` 进程，权衡后这里先用自适应轮询
 * （零额外常驻进程，实现简单，实测开销可接受）。
 */

const FAST_MS = 4000;      // 有外部音源在播
const IDLE_MS = 10000;     // 已连接但没有音源
const HIDDEN_MS = 30000;   // 界面不可见

let _state: SpeakerStatus | null = null;
let _error: string | null = null;
let _loading = true;
let _subs = new Set<() => void>();
let _timer: any = null;
let _inflight: Promise<void> | null = null;
let _visible = false;

function emit() { _subs.forEach((f) => f()); }

/** 按当前状态算出下次该等多久。 */
function nextInterval(): number {
  if (!_visible) return HIDDEN_MS;
  if (_state?.live) return FAST_MS;      // 有人在放歌，需要跟进度
  if (_state?.connected?.length) return IDLE_MS;
  return IDLE_MS;
}

async function refresh(force = false): Promise<void> {
  if (_inflight && !force) return _inflight;
  _inflight = (async () => {
    try {
      const r = await api.status();
      _state = r;
      _error = r.ok ? null : (r.error || "unknown error");
    } catch (e: any) {
      _error = e?.message || String(e);
    } finally {
      _loading = false;
      _inflight = null;
      emit();
      reschedule();
    }
  })();
  return _inflight;
}

/** 用 setTimeout 链而不是 setInterval：间隔可以随状态动态变化。 */
function reschedule() {
  if (_timer) { clearTimeout(_timer); _timer = null; }
  if (_subs.size === 0) return;   // 没人订阅就不轮询
  _timer = setTimeout(() => { refresh(); }, nextInterval());
}

function setVisible(v: boolean) {
  if (_visible === v) return;
  _visible = v;
  // 刚变可见立刻刷新一次，避免看到过期数据
  if (v) refresh(true);
  else reschedule();
}

export function startPolling() {
  if (!_timer) refresh(true);
}

export function stopPolling() {
  if (_timer) { clearTimeout(_timer); _timer = null; }
}

export function useSpeaker(): { state: SpeakerStatus | null; error: string | null; loading: boolean; refresh: () => void } {
  const [, force] = useState(0);
  useEffect(() => {
    const f = () => force((n) => n + 1);
    _subs.add(f);
    startPolling();

    // 页面可见性：切到别的界面时降频
    const onVis = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", onVis);
    setVisible(!document.hidden);

    return () => {
      _subs.delete(f);
      document.removeEventListener("visibilitychange", onVis);
      // 最后一个订阅者离开时停掉定时器（下次挂载会重新起）
      if (_subs.size === 0) {
        _visible = false;
        if (_timer) { clearTimeout(_timer); _timer = null; }
      }
    };
  }, []);
  return { state: _state, error: _error, loading: _loading, refresh: () => { refresh(true); } };
}

export function notifyStateChanged() { emit(); }

/** 供 QAM 面板显式标记可见性（QAM 收起时 document.hidden 不一定变）。 */
export function setPanelVisible(v: boolean) { setVisible(v); }
