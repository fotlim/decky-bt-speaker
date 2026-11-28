/**
 * 版本号与构建标识 —— 用来一眼确认「当前跑的到底是哪一版」。
 *
 * 为什么需要这个？
 * --------------
 * 排查「装了新版但还是报旧错误」时，最需要的是**确认当前运行的是哪一版**。
 * 之前只能靠猜（看截图时间、看界面有没有新功能），效率极低，
 * 还容易把「CEF 缓存了旧 index.js」误判成「代码没修好」。
 *
 * 现在 QAM 面板底部会显示 `v2.8.2 · 11-27 22:15`，一眼就能对上。
 *
 * 实现方式
 * --------
 * `__BT_META__` 是一个**普通全局对象**，由 `rollup.config.js` 里的自定义
 * 插件在 `intro` 阶段注入（在模块代码之前执行）：
 *
 *     var __BT_META__ = {"version":"2.8.2","build":"11-27 22:15"};
 *
 * 为什么不用标识符替换（`__BT_VERSION__` 这种）？
 * ----------------------------------------------
 * 我第一版就是那么写的，结果替换插件把**字符串字面量**里的
 * `"__BT_VERSION__"` 也替换了，生成出 `name === ""2.8.2""` 这种非法语法，
 * 构建直接失败。字符串替换天然分不清「标识符」和「字符串内容」，
 * 而注入一个对象则完全没有这个问题。
 *
 * ⚠️ v2.8.0 事故的教训同样适用：任何构建期注入都可能缺失，
 * 所以这里所有取值都做了兜底，拿不到就返回空串，绝不让插件加载失败。
 */

declare const __BT_META__: { version?: string; build?: string } | undefined;

/** 安全读取注入的元信息；缺失时返回空对象（不抛错）。 */
function meta(): { version: string; build: string } {
  try {
    const m = typeof __BT_META__ !== "undefined" ? __BT_META__ : undefined;
    if (m && typeof m === "object") {
      return {
        version: typeof m.version === "string" ? m.version : "",
        build: typeof m.build === "string" ? m.build : "",
      };
    }
  } catch {
    /* ReferenceError（未注入）或任何异常，都降级为空 */
  }
  return { version: "", build: "" };
}

/** 形如 `v2.8.2 · 11-27 22:15`；拿不到版本就只显示构建时间。 */
export function versionLabel(): string {
  const { version, build } = meta();
  if (!version && !build) return "";
  if (!version) return build;
  return build ? `v${version} · ${build}` : `v${version}`;
}
