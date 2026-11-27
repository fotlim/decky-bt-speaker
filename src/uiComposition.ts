/**
 * 调用 Steam 内部的 UI 合成层级 hook。
 *
 * 为什么必须用这个？
 * ----------------
 * 息屏遮罩如果只靠 `position: fixed` + 高 z-index，**盖不住 Steam 的
 * 顶栏和 QAM 面板** —— 它们在自己的合成层里，层级比插件的 DOM 更高。
 * 真机反馈「还能看到 Steam 头像和菜单图标」就是这个原因。
 *
 * `createPortal` 到 document.body 也没用，因为问题不在 DOM 层级，
 * 而在 Steam 的 **compositing layer**（合成层）。
 *
 * Steam 内部有一个 composition state 机制：
 *   AddMinimumCompositionStateRequest / ChangeMinimumCompositionStateRequest
 *   / RemoveMinimumCompositionStateRequest
 * 调用它可以把内容提升到指定合成层（Overlay / Opaque 等）。
 *
 * 参考实现：steam3d/MagicBlackDecky 的 uiComposition.tsx
 * 它在 OLED 机型上验证有效。
 *
 * ⚠️ 这是 Steam 的**内部 API**，不是公开接口。Steam 更新后可能失效，
 * 所以这里做了完整的降级：找不到 hook 就只用普通遮罩（至少能变黑），
 * 并且只警告一次，不刷屏。
 */

import { findModuleExport, findVar } from "@decky/ui";

/** Steam 的合成层级。数值越大越靠上。 */
export enum UIComposition {
  Hidden = 0,
  Notification = 1,
  Overlay = 2,
  Opaque = 3,
  OverlayKeyboard = 4,
  OverlayQAM = 5,
  OverlayKeyboard1 = 6,
}

type UICompositionHook = (
  composition: UIComposition,
  requestName?: string,
) => { releaseComposition: () => void };

/**
 * 靠特征识别 composition hook。
 *
 * 不能按名字找 —— 打包后函数名会被压缩。这里按**源码特征**匹配：
 * 函数体里同时出现三个 CompositionStateRequest 调用，且不含
 * `m_mapCompositionStateRequests`（那是另一个相似函数）。
 */
const isUICompositionHook = (candidate: unknown): candidate is UICompositionHook => {
  if (typeof candidate !== "function") return false;
  const source = candidate.toString();
  return (
    source.includes("AddMinimumCompositionStateRequest") &&
    source.includes("ChangeMinimumCompositionStateRequest") &&
    source.includes("RemoveMinimumCompositionStateRequest") &&
    !source.includes("m_mapCompositionStateRequests")
  );
};

const resolvedHook =
  findVar(isUICompositionHook) ?? findModuleExport(isUICompositionHook);

let warned = false;

/** hook 是否可用（Steam 版本兼容性探测）。 */
export function compositionAvailable(): boolean {
  return isUICompositionHook(resolvedHook);
}

/**
 * 把当前组件提升到指定合成层。
 *
 * 注意：这个 hook 在 React 里是按「调用即注册」的方式工作，
 * 组件卸载时需要调用返回的 `releaseComposition()`。
 * 这里用 useEffect 包裹，由调用方保证生命周期正确。
 */
export function useUIComposition(composition: UIComposition): void {
  if (!isUICompositionHook(resolvedHook)) {
    if (!warned) {
      warned = true;
      console.warn("[bt-speaker] Steam UI composition hook 未找到，息屏遮罩可能盖不住顶栏");
    }
    return;
  }
  try {
    resolvedHook(composition, "bt-speaker");
  } catch (e) {
    if (!warned) {
      warned = true;
      console.warn("[bt-speaker] 调用 UI composition 失败", e);
    }
  }
}
