/**
 * 调用 Steam 内部的 UI 合成层级 hook —— 但**必须能在旧版 loader 上安全降级**。
 *
 * 为什么必须用这个？
 * ----------------
 * 息屏遮罩如果只靠 `position: fixed` + 高 z-index，**盖不住 Steam 的
 * 顶栏和 QAM 面板** —— 它们在自己的合成层里，层级比插件的 DOM 更高。
 * `createPortal` 到 document.body 也没用，因为问题不在 DOM 层级，
 * 而在 Steam 的 **compositing layer**（合成层）。
 *
 * Steam 内部有一个 composition state 机制：
 *   AddMinimumCompositionStateRequest / ChangeMinimumCompositionStateRequest
 *   / RemoveMinimumCompositionStateRequest
 * 调用它可以把内容提升到指定合成层（Overlay / Opaque 等）。
 *
 * ⚠️⚠️ 血泪教训（v2.8.2）
 * ----------------------
 * v2.8.0 里本文件是这样写的：
 *
 *     const resolvedHook = findVar(isUICompositionHook) ?? findModuleExport(...);
 *
 * 这行在**模块顶层**执行。而 `findVar` 是 `@decky/ui` **5.x** 才有的 API，
 * 旧版 loader 提供的 `DFL` 全局对象里根本没有这个函数 —— 于是插件一加载就：
 *
 *     TypeError: DFL.findVar is not a function
 *
 * 整个插件包直接挂掉，连 QAM 面板都打不开。
 *
 * 教训：
 *   1. **不要**在模块顶层调用任何来自宿主（loader / Steam）的可选 API
 *   2. 每次访问可选 API 都必须先 `typeof === "function"` 判断
 *   3. 找不到就必须**静默降级**，绝不能让插件加载失败
 *
 * 所以现在所有解析都是**惰性**的、包在 try/catch 里的、逐级降级的。
 * 找不到 hook 时遮罩依然工作（只是盖不住顶栏），功能不受影响。
 */

import * as DeckyUI from "@decky/ui";

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
) => { releaseComposition: () => void } | void;

/**
 * 靠特征识别 composition hook。
 *
 * 不能按名字找 —— 打包后函数名会被压缩。这里按**源码特征**匹配：
 * 函数体里同时出现三个 CompositionStateRequest 调用，且不含
 * `m_mapCompositionStateRequests`（那是另一个相似函数）。
 */
const isUICompositionHook = (candidate: unknown): candidate is UICompositionHook => {
  if (typeof candidate !== "function") return false;
  try {
    const source = (candidate as Function).toString();
    return (
      source.includes("AddMinimumCompositionStateRequest") &&
      source.includes("ChangeMinimumCompositionStateRequest") &&
      source.includes("RemoveMinimumCompositionStateRequest") &&
      !source.includes("m_mapCompositionStateRequests")
    );
  } catch {
    return false;
  }
};

/**
 * 安全地取 `@decky/ui` 上的一个可选函数。
 *
 * `DeckyUI` 是 rollup 用 external-globals 映射到全局 `DFL` 的对象。
 * 旧版 loader 里这个对象存在（面板组件都在用），但**可能缺少新 API**，
 * 所以这里逐个 `typeof` 判断，绝不直接调用。
 */
function optionalFn(name: string): ((...args: any[]) => any) | null {
  try {
    const mod: any = DeckyUI as any;
    if (!mod) return null;
    const fn = mod[name];
    return typeof fn === "function" ? fn : null;
  } catch {
    return null;
  }
}

/** 已解析结果缓存：`undefined` = 还没找过，`null` = 找过但没有。 */
let _resolved: UICompositionHook | null | undefined = undefined;

/**
 * 惰性解析 composition hook。
 *
 * 降级链（每一步都可能不存在，全部安全）：
 *   1. `findVar`          —— @decky/ui 5.x，最准
 *   2. `findModuleExport` —— 老版本 loader 也有
 *   3. `findModuleChild`  —— 更老（已废弃但仍可用）
 *   4. 都没有 → null，调用方静默降级
 */
function resolveHook(): UICompositionHook | null {
  if (_resolved !== undefined) return _resolved;

  const probes: Array<() => any> = [
    () => {
      const fn = optionalFn("findVar");
      return fn ? fn(isUICompositionHook) : undefined;
    },
    () => {
      const fn = optionalFn("findModuleExport");
      return fn ? fn(isUICompositionHook) : undefined;
    },
    () => {
      const fn = optionalFn("findModuleChild");
      return fn ? fn(isUICompositionHook) : undefined;
    },
  ];

  for (const probe of probes) {
    try {
      const found = probe();
      if (isUICompositionHook(found)) {
        _resolved = found;
        return found;
      }
    } catch {
      // 这个探测途径不可用（函数不存在 / 内部报错），继续下一个
      continue;
    }
  }

  _resolved = null;
  return null;
}

let warned = false;

/** hook 是否可用（Steam / loader 版本兼容性探测）。 */
export function compositionAvailable(): boolean {
  return isUICompositionHook(resolveHook());
}

/**
 * 把当前组件提升到指定合成层。
 *
 * ⚠️ 内部已做完整保护：hook 不存在、调用抛错，都只会**静默降级**，
 * 绝不会让插件加载失败。这是 v2.8.0 崩溃事故的修复点。
 *
 * ⚠️⚠️ 这个函数**不是 React hook**（尽管名字以 use 开头，是历史遗留）：
 * 它没有内部 state，也不依赖渲染顺序，可以在 effect 里安全调用。
 *
 * 早期实现直接**在渲染期间**调用 `hook(...)` —— 这是错的：
 *   1. 渲染函数必须是纯的，不能有副作用（React 严格模式会渲染两次，
 *      于是每次渲染都多注册一条合成层请求）
 *   2. 返回的 `releaseComposition` 被丢弃，请求只增不减，
 *      长时间使用后合成层请求会累积
 *
 * 调用方必须在 `useEffect` 里调它，并把返回的释放函数放进 cleanup。
 * 返回 `null` 表示「当前环境不支持」（旧版 loader），调用方无需处理。
 */
export function acquireComposition(composition: UIComposition): (() => void) | null {
  const hook = resolveHook();
  if (!isUICompositionHook(hook)) {
    if (!warned) {
      warned = true;
      // 只警告一次，不刷屏。用 console.warn 而不是 error ——
      // 这是「旧版 loader 的正常降级」，不是错误。
      //
      // ⚠️ 日志用英文：它是给开发者看的，不是 UI 文案。
      // 中文写在这里会同时污染「硬编码中文」检查。
      console.warn(
        "[bt-speaker] Steam UI composition hook unavailable (older loader?). " +
        "The dim overlay cannot cover the top bar, but screen-off still works.",
      );
    }
    return null;
  }
  try {
    const res = hook(composition, "bt-speaker");
    // hook 可能返回 { releaseComposition } 也可能返回 void（旧版）
    if (res && typeof (res as any).releaseComposition === "function") {
      return () => {
        try { (res as any).releaseComposition(); } catch { /* 忽略 */ }
      };
    }
  } catch (e) {
    if (!warned) {
      warned = true;
      console.warn("[bt-speaker] UI composition call failed, degraded gracefully", e);
    }
  }
  return null;
}

/** 供诊断页显示：当前环境到底能不能用合成层提升。 */
export function compositionDiagnostics(): {
  available: boolean;
  findVar: boolean;
  findModuleExport: boolean;
  findModuleChild: boolean;
} {
  return {
    available: compositionAvailable(),
    findVar: optionalFn("findVar") !== null,
    findModuleExport: optionalFn("findModuleExport") !== null,
    findModuleChild: optionalFn("findModuleChild") !== null,
  };
}
