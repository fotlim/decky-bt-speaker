/**
 * 息屏遮罩：盖满整个 Steam UI，并接住任何输入来唤醒。
 *
 * 为什么做成**全局组件**（`routerHook.addGlobalComponent`）？
 * ------------------------------------------------------
 * v2.8.0 把遮罩塞在 QAM 面板里，结果盖不住 Steam 顶栏和 QAM 自己 ——
 * 因为面板 DOM 被 Steam 的容器包着，容器还带 `transform`，
 * 会让 `position: fixed` 的包含块退化成那个容器。
 *
 * 挂成全局组件后，遮罩渲染在 Steam UI 的顶层 React 树里，
 * 不依赖任何祖先容器的布局，这才是「真·全屏」。
 * 参考实现：steam3d/MagicBlackDecky 的 `BlackOverlay`。
 *
 * 三层保障：
 *   1. `UIComposition.Overlay` 提升合成层（拿不到就降级，见 uiComposition.ts）
 *   2. 全屏纯黑 DOM + 全局组件挂载点 —— 即使 hook 失效也至少是黑的
 *   3. 多路输入监听（指针 / 键盘 / 触摸 / **手柄**）—— 任何操作都唤醒
 *
 * ⚠️ 手柄为什么不走 DOM 事件？
 * ---------------------------
 * Steam 的手柄输入由 `SteamUIStore.NavigationManager` 统一分发，
 * **不产生 DOM keydown**。只监听 window 键盘事件时，息屏后按 A 键
 * 屏幕不会亮 —— 而手柄恰好是 Deck 上最常用的唤醒方式。
 *
 * ⚠️ 所有对宿主 API 的访问都必须先判断存在性。
 * v2.8.0 就是因为直接调用 `DFL.findVar` 导致整个插件加载失败。
 */

import { useEffect, useRef, useState } from "react";
import { useUIComposition, UIComposition } from "../uiComposition";
import { subscribeDim, setDimmed as setDimState } from "../dimState";

type ReleaseHandle = (() => void) | null;

/** SetCatchAllGamepadInput 的返回值形态不固定，统一成「释放函数」。 */
function buildReleaseHandle(handle: unknown): ReleaseHandle {
  if (typeof handle === "function") return handle as () => void;
  const h = handle as any;
  if (h && typeof h.Unregister === "function") return () => h.Unregister();
  if (h && typeof h.unregister === "function") return () => h.unregister();
  return null;
}

/** 唤醒时的回调（由 index.tsx 注入，用于调后端恢复背光）。 */
let _onWake: (() => void) | null = null;

export function setWakeHandler(fn: (() => void) | null) {
  _onWake = fn;
}

function wake() {
  try {
    _onWake?.();
  } catch {
    /* ignore */
  }
}

export function DimOverlay() {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const releaseRef = useRef<ReleaseHandle>(null);
  const visibleRef = useRef(false);
  visibleRef.current = visible;

  // 订阅共享状态
  useEffect(() => {
    return subscribeDim((v) => setVisible(v));
  }, []);

  // 提升到 Steam 的 Overlay 合成层（拿不到就静默降级）
  useUIComposition(UIComposition.Overlay);

  // 聚焦遮罩，让键盘事件能落到这里
  useEffect(() => {
    if (!visible) return;
    try {
      ref.current?.focus();
    } catch {
      /* ignore */
    }
  }, [visible]);

  // DOM 事件（键盘 / 鼠标 / 触摸）
  useEffect(() => {
    if (!visible) return;
    const onAny = () => wake();
    window.addEventListener("keydown", onAny, true);
    window.addEventListener("pointerdown", onAny, true);
    window.addEventListener("touchstart", onAny, true);
    window.addEventListener("wheel", onAny, true);
    return () => {
      window.removeEventListener("keydown", onAny, true);
      window.removeEventListener("pointerdown", onAny, true);
      window.removeEventListener("touchstart", onAny, true);
      window.removeEventListener("wheel", onAny, true);
    };
  }, [visible]);

  // 手柄事件（Steam 不走 DOM，必须走 NavigationManager）
  useEffect(() => {
    if (!visible) return;
    let release: ReleaseHandle = null;
    try {
      const navManager = (window as any)?.SteamUIStore?.NavigationManager;
      if (navManager && typeof navManager.SetCatchAllGamepadInput === "function") {
        release = buildReleaseHandle(navManager.SetCatchAllGamepadInput(() => wake()));
      }
    } catch {
      /* 拿不到就只靠 DOM 事件兜着 */
    }
    releaseRef.current = release;
    return () => {
      releaseRef.current = null;
      try {
        release?.();
      } catch {
        /* ignore */
      }
    };
  }, [visible]);

  if (!visible) return null;

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
        // z-index 是第二道保险；真正起作用的是 UIComposition + 全局组件挂载点
        zIndex: 2147483647,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "rgba(255,255,255,0.18)",
        fontSize: 13,
        cursor: "pointer",
        outline: "none",
        transform: "none",
        willChange: "auto",
        // 防止被祖先的 pointer-events / transform 影响
        pointerEvents: "auto",
        isolation: "isolate",
      }}
    >
      {/* 提示文案由 index.tsx 通过 i18n 提供；这里留一个极淡的占位，
          避免遮罩完全没有任何内容导致某些渲染器优化掉它 */}
      <span style={{ opacity: 0.001, userSelect: "none" }}>·</span>
    </div>
  );
}

/** 供外部（QAM 按钮）触发唤醒。 */
export function forceWake() {
  setDimState(false);
  wake();
}
