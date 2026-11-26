import { useEffect, useState } from "react";
import { api } from "./backend";
import type { SpeakerStatus } from "./types";

/**
 * 状态单例：QAM 面板和全屏页共用一份轮询，
 * 避免两个界面同时开着时反复起子进程（后端每次 status 要跑几条系统命令）。
 */
let _state: SpeakerStatus | null = null;
let _error: string | null = null;
let _loading = true;
let _subs = new Set<() => void>();
let _timer: any = null;
let _inflight: Promise<void> | null = null;

function emit() { _subs.forEach((f) => f()); }

async function refresh(force = false): Promise<void> {
  if (_inflight && !force) return _inflight;
  _inflight = (async () => {
    try {
      const r = await api.status();
      _state = r;
      _error = r.ok ? null : (r.error || "未知错误");
    } catch (e: any) {
      _error = e?.message || String(e);
    } finally {
      _loading = false;
      _inflight = null;
      emit();
    }
  })();
  return _inflight;
}

export function startPolling(intervalMs = 4000) {
  if (_timer) return;
  refresh(true);
  _timer = setInterval(() => { refresh(); }, intervalMs);
}

export function stopPolling() {
  if (_timer) { clearInterval(_timer); _timer = null; }
}

export function useSpeaker(): { state: SpeakerStatus | null; error: string | null; loading: boolean; refresh: () => void } {
  const [, force] = useState(0);
  useEffect(() => {
    const f = () => force((n) => n + 1);
    _subs.add(f);
    startPolling();
    return () => {
      _subs.delete(f);
      // 注意：不在这里停轮询——QAM 收起时轮询继续，状态才不会「过期」
    };
  }, []);
  return { state: _state, error: _error, loading: _loading, refresh: () => { refresh(true); } };
}

export function notifyStateChanged() { emit(); }
