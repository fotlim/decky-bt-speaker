/**
 * 全局样式注入：keyframes 动画 + 滚动条美化。
 *
 * 为什么要注入 `<style>`？
 * ----------------------
 * React 内联 style 不支持 `@keyframes` 和 `::-webkit-scrollbar`。
 * 而这两样都是「全屏页看起来精致」的必要条件：
 *
 * - `btPulse`：状态点的呼吸动画（「正在协商」那个小圆点）
 * - 滚动条：默认的浅色滚动条在深色界面上非常刺眼
 *
 * 只注入一次（用 data 属性标记），重复挂载不会堆积。
 *
 * ⚠️ 为什么不用 CSS 文件？
 * Decky 的 rollup 配置对 .css 的处理取决于 loader 版本，
 * 而 `<style>` 注入在所有版本上都可靠。全屏页的样式量很小，值得这个取舍。
 */

const STYLE_ID = "bt-speaker-global-style";

const CSS = `
@keyframes btPulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%      { opacity: 0.35; transform: scale(0.82); }
}
@keyframes btSpin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}

/* 深色滚动条：默认的浅色条在深色界面上太刺眼 */
.bt-scroll::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
.bt-scroll::-webkit-scrollbar-track {
  background: transparent;
}
.bt-scroll::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.12);
  border-radius: 4px;
}
.bt-scroll::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}

/* 尊重系统的「减少动画」偏好 */
@media (prefers-reduced-motion: reduce) {
  .bt-no-motion, .bt-no-motion * {
    animation: none !important;
    transition: none !important;
  }
}
`;

/** 注入全局样式（幂等）。应在插件加载时调用一次。 */
export function injectGlobalStyle(): void {
  try {
    if (typeof document === "undefined") return;
    if (document.getElementById(STYLE_ID)) return;
    const el = document.createElement("style");
    el.id = STYLE_ID;
    el.textContent = CSS;
    document.head.appendChild(el);
  } catch {
    /* 拿不到 document（非浏览器环境）就静默跳过 */
  }
}

/** 移除全局样式（插件卸载时调用，避免残留）。 */
export function removeGlobalStyle(): void {
  try {
    if (typeof document === "undefined") return;
    const el = document.getElementById(STYLE_ID);
    if (el) el.remove();
  } catch {
    /* ignore */
  }
}
