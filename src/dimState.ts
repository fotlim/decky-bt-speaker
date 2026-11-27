/**
 * 息屏状态的共享单例。
 *
 * 为什么要单独抽出来？
 * ------------------
 * 息屏遮罩现在挂在**全局组件**上（`routerHook.addGlobalComponent`），
 * 而不是 QAM 面板内部 —— 因为 QAM 面板的 DOM 被 Steam 的容器包着，
 * 还可能带 `transform`，会让 `position: fixed` 失效、也盖不住顶栏。
 *
 * 于是「QAM 里的按钮」和「全局遮罩」成了两个互不相邻的组件，
 * 需要一个共享状态来通信。用极小的观察者模式即可，不引入任何依赖。
 */

type Listener = (dimmed: boolean) => void;

let _dimmed = false;
const _listeners = new Set<Listener>();

export function isDimmed(): boolean {
  return _dimmed;
}

export function setDimmed(v: boolean) {
  if (_dimmed === v) return;
  _dimmed = v;
  _listeners.forEach((f) => {
    try {
      f(v);
    } catch {
      /* 单个订阅者出错不影响其他人 */
    }
  });
}

export function subscribeDim(f: Listener): () => void {
  _listeners.add(f);
  // 立即同步一次当前值，避免挂载时机差异导致状态不一致
  try {
    f(_dimmed);
  } catch {
    /* ignore */
  }
  return () => {
    _listeners.delete(f);
  };
}
