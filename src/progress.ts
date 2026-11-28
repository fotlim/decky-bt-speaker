/**
 * 播放进度插值。
 *
 * 为什么需要？
 * ----------
 * 后端轮询最快也是 4 秒一次（`store.ts` 的 `FAST_MS`）—— 因为每次
 * `status()` 要 fork 十几个外部进程，不能为了进度条把它提到 1 秒。
 *
 * 但 4 秒一跳的进度条看起来就是「卡顿、跟不上」，用户的原话是
 * 「歌词有点跟不上的感觉」。而播放位置本身是**匀速推进**的：
 * 只要知道「上次读到的位置」和「读到它的时刻」，中间的值可以自己算。
 *
 * 做法：把后端给的 `position_ms` 当成锚点，用本地时间往前推。
 * 每 500ms 重算一次（只触发这一个组件的重渲染，不碰后端）。
 *
 * ⚠️ 边界：
 *  - 暂停 / 停止时不插值（位置不该动）
 *  - 后端值往回跳（换歌、seek）时以**后端为准**，立刻重置锚点
 *  - 插值结果不超过 `duration_ms`（避免进度条冲过 100%）
 *  - 暂停后恢复播放，锚点时间要重算，否则会把暂停时长也算进去
 */

import { useEffect, useRef, useState } from "react";

/** 插值刷新间隔（毫秒）。500ms 对手柄 UI 足够，也不会太耗。 */
const TICK_MS = 500;

export interface ProgressInput {
  /** 后端读到的播放位置（毫秒） */
  positionMs: number;
  /** 曲目总时长（毫秒），0 表示未知 */
  durationMs: number;
  /** AVRCP 状态：playing / paused / stopped / ... */
  status: string;
}

/**
 * 返回「此刻」的播放位置（毫秒），比后端值平滑。
 *
 * 输入不变时也会随时间推进 —— 这正是需要的效果。
 */
export function useSmoothPosition(input: ProgressInput | null): number {
  const [pos, setPos] = useState(input?.positionMs ?? 0);

  // 锚点：后端值 + 读到它的本地时刻
  const anchorPos = useRef(0);
  const anchorAt = useRef(0);

  const playing = (input?.status || "").toLowerCase() === "playing";
  const backendPos = input?.positionMs ?? 0;
  const duration = input?.durationMs ?? 0;

  // 后端值变化时重置锚点。
  //
  // 只在「后端值明显不同于我们插值出来的值」时重置，否则每 4 秒一次
  // 的轮询会把锚点不断拉回，插值就白做了。
  // 判定阈值 1.5 秒：小于它就认为只是读取抖动，不值得重置。
  useEffect(() => {
    if (!input) {
      anchorPos.current = 0;
      anchorAt.current = 0;
      setPos(0);
      return;
    }
    const now = Date.now();
    const projected = playing && anchorAt.current
      ? anchorPos.current + (now - anchorAt.current)
      : anchorPos.current;

    const drift = Math.abs(backendPos - projected);
    if (drift > 1500 || !anchorAt.current) {
      anchorPos.current = backendPos;
      anchorAt.current = now;
      setPos(backendPos);
    }
  }, [backendPos, playing, !!input]);

  // 播放中才推进
  useEffect(() => {
    if (!playing || !anchorAt.current) return;
    const id = setInterval(() => {
      const raw = anchorPos.current + (Date.now() - anchorAt.current);
      const capped = duration > 0 ? Math.min(raw, duration) : raw;
      setPos(Math.max(0, capped));
    }, TICK_MS);
    return () => clearInterval(id);
  }, [playing, duration]);

  return Math.max(0, Math.round(pos));
}

/** 把毫秒格式化成 `m:ss`（与后端 `_fmt_ms` 保持一致）。 */
export function fmtMs(ms: number): string {
  const total = Math.max(0, Math.floor((ms || 0) / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}
