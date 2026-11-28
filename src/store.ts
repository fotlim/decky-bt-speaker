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

// 间隔的取舍
// ----------
// 每次 `status()` 要 fork 十几个外部进程（bluetoothctl / wpctl / pactl /
// pw-dump / busctl…），在 Deck 上不便宜。但「有外部音源在播」时，
// 状态确实在变（曲目、位置、协商进度），间隔太大会显得卡。
//
// v3.3.0 把后端重复命令合并、给静态数据加缓存之后，单次开销明显下降，
// 于是播放档位可以从 4 秒提到 2 秒 —— 进度条另有前端插值兜底
// （见 progress.ts），所以即使这里保守一点也不会「一跳一跳」。
const FAST_MS = 2000;      // 有外部音源在播：要跟播放状态
const IDLE_MS = 8000;      // 已连接但没有音源
const HIDDEN_MS = 30000;   // 界面不可见

let _state: SpeakerStatus | null = null;
let _error: string | null = null;
let _loading = true;
let _subs = new Set<() => void>();
let _timer: any = null;
let _inflight: Promise<void> | null = null;
let _visible = false;
/** 请求「尽快再刷一次」时置位：等当前 in-flight 结束立刻补跑，而不是并行再起一个。 */
let _wantRefresh = false;

function emit() { _subs.forEach((f) => f()); }

/** 按当前状态算出下次该等多久。 */
function nextInterval(): number {
  if (!_visible) return HIDDEN_MS;
  if (_state?.live) return FAST_MS;      // 有人在放歌，需要跟进度
  return IDLE_MS;                        // 空闲 / 已连接未播放
}

async function refresh(force = false): Promise<void> {
  // 已经有请求在跑：
  //   - 普通调用直接复用它（去重）
  //   - force 调用**不再并行起第二个**，而是记下「跑完再补一次」
  //     —— 并行起多个 status() 只会让后端多 fork 几倍的命令，
  //        而且先完成的那个会提前把 _inflight 置空，第三个调用又能再起一个。
  if (_inflight) {
    if (force) _wantRefresh = true;
    return _inflight;
  }
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
      // 期间有人要求强制刷新 -> 立刻补一次（下一轮仍走同一去重逻辑）
      if (_wantRefresh) {
        _wantRefresh = false;
        refresh(true);
      } else {
        reschedule();
      }
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

/**
 * 可见性用**引用计数**而不是单个布尔。
 *
 * ⚠️ 真机 bug：QAM 面板（`Speaker`）和全屏页（`BtSpeakerPage`）共用这个单例。
 * 早期用单一 `_visible` 标志，QAM 卸载时无条件 `setPanelVisible(false)`，
 * 会把**仍在前台**的全屏页一起降频到 30 秒 —— 表现为全屏页里播放进度
 * 半天不动、A2DP 状态看着卡死。
 *
 * 现在改成计数：谁挂载谁 +1、卸载 -1，只有计数归零才算「不可见」。
 */
let _visibleCount = 0;

function acquireVisible() {
  _visibleCount += 1;
  if (_visibleCount === 1) {
    _visible = true;
    refresh(true);          // 刚变可见立刻刷新，避免看到过期数据
  }
}

function releaseVisible() {
  _visibleCount = Math.max(0, _visibleCount - 1);
  if (_visibleCount === 0) {
    _visible = false;
    reschedule();
  }
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
    acquireVisible();          // 挂载即算可见（计数 +1）
    startPolling();

    // 浏览器层面的页面可见性：整个窗口切走时降频。
    // 注意这只影响「窗口」维度，与面板自身的挂载/卸载是两回事，
    // 所以这里不能直接改 _visible，只在窗口隐藏时额外降频。
    const onVis = () => {
      if (document.hidden) reschedule();
      else refresh(true);
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      _subs.delete(f);
      document.removeEventListener("visibilitychange", onVis);
      releaseVisible();        // 计数 -1，归零才真正降频
      // 最后一个订阅者离开时停掉定时器（下次挂载会重新起）
      if (_subs.size === 0) {
        _visible = false;
        if (_timer) { clearTimeout(_timer); _timer = null; }
      }
    };
  }, []);
  return { state: _state, error: _error, loading: _loading, refresh: () => { refresh(true); } };
}

/** 供 QAM 面板显式标记可见性（QAM 收起时 document.hidden 不一定变）。 */
export function setPanelVisible(v: boolean) {
  if (v) acquireVisible();
  else releaseVisible();
}
