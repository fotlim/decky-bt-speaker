/**
 * 息屏遮罩：盖满整个 Steam UI，并接住任何输入来唤醒。
 *
 * 为什么单独成文件？
 * ----------------
 * 遮罩需要调用 `useUIComposition` 提升合成层级，还要管理手柄捕获、
 * 超时兜底、卸载清理。塞在 Speaker.tsx 里会让那个文件更难读。
 *
 * 三层保障（背光在 Deck OLED 上关不掉，所以遮罩是主要的「视觉关屏」手段）：
 *   1. `UIComposition.Overlay` 提升合成层 —— 盖住 Steam 顶栏和 QAM
 *   2. 全屏纯黑 DOM —— 即使 hook 失效也至少是黑的
 *   3. 多路输入监听（指针 / 键盘 / 触摸 / **手柄**）—— 任何操作都唤醒
 *
 * ⚠️ 手柄为什么不走 DOM 事件？
 * ---------------------------
 * Steam 的手柄输入由 `SteamUIStore.NavigationManager` 统一分发，
 * **不产生 DOM keydown**。只监听 window 的键盘事件时，息屏后按 A 键
 * 屏幕不会亮 —— 而手柄恰好是 Deck 上最常用的唤醒方式。
 * 所以这里额外用 `SetCatchAllGamepadInput` 捕获全部手柄输入。
 * 做法参考 MagicBlackDecky 的 useCatchAllGamepad。
 */

import { useCallback, useEffect, useRef } from "react";
import { useUIComposition, UIComposition } from "../uiComposition";

type ReleaseHandle = (() => void) | null;

/** SetCatchAllGamepadInput 的返回值形态不固定，这里统一成「释放函数」。 */
function buildReleaseHandle(handle: unknown): ReleaseHandle {
  if (typeof handle === "function") return handle as () => void;
  const h = handle as any;
  if (h && typeof h.Unregister === "function") return () => h.Unregister();
  if (h && typeof h.unregister === "function") return () => h.unregister();
  return null;
}

export function DimOverlay({ onWake, hint }: { onWake: () => void; hint: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const releaseRef = useRef<ReleaseHandle>(null);
  // 用 ref 存回调，避免 onWake 每次重建导致重复订阅
  const wakeRef = useRef(onWake);
  wakeRef.current = onWake;

  // 提升到 Steam 的 Overlay 合成层，这样能盖住顶栏和 QAM 面板。
  // 单纯的高 z-index 做不到 —— Steam 的 UI 在更高的合成层里。
  useUIComposition(UIComposition.Overlay);

  // 聚焦遮罩，让键盘事件能落到这里
  useEffect(() => {
    try { ref.current?.focus(); } catch { /* ignore */ }
  }, []);

  // DOM 事件（键盘 / 鼠标 / 触摸）
  useEffect(() => {
    const wake = () => wakeRef.current();
    window.addEventListener("keydown", wake, true);
    window.addEventListener("pointerdown", wake, true);
    window.addEventListener("touchstart", wake, true);
    window.addEventListener("wheel", wake, true);
    return () => {
      window.removeEventListener("keydown", wake, true);
      window.removeEventListener("pointerdown", wake, true);
      window.removeEventListener("touchstart", wake, true);
      window.removeEventListener("wheel", wake, true);
    };
  }, []);

  // 手柄事件（Steam 不走 DOM，必须走 NavigationManager）
  useEffect(() => {
    const navManager = (window as any)?.SteamUIStore?.NavigationManager;
    if (!navManager?.SetCatchAllGamepadInput) return;
    try {
      releaseRef.current = buildReleaseHandle(
        navManager.SetCatchAllGamepadInput(() => wakeRef.current()),
      );
    } catch {
      /* 拿不到就只靠 DOM 事件兜着 */
    }
    return () => {
      const rel = releaseRef.current;
      releaseRef.current = null;
      try { rel?.(); } catch { /* ignore */ }
    };
  }, []);

  const wake = useCallback(() => wakeRef.current(), []);

  return (
    <div
      ref={ref}
      tabIndex={0}
      onPointerDown={wake}
      onKeyDown={wake}
      onClick={wake}
      onTouchStart={wake}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        background: "#000",
        // z-index 只是第二道保险；真正起作用的是上面的 UIComposition
        zIndex: 2147483647,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "rgba(255,255,255,0.18)",
        fontSize: 13,
        cursor: "pointer",
        outline: "none",
        // 避免被父容器的 transform 影响
        transform: "none",
        willChange: "auto",
      }}
    >
      {hint}
    </div>
  );
}
