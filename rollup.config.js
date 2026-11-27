import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import deckyPlugin from "@decky/rollup";

const ROOT = dirname(fileURLToPath(import.meta.url));

// 版本号来自 package.json（Decky 的 plugin.json 里没有 version 字段）
let version = "";
try {
  version = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf-8")).version || "";
} catch {
  version = "";
}

// 构建时间：本地时间 MM-DD HH:mm。
//
// 为什么要把构建时间打进包里？
// --------------------------
// 排查「装了新版还是报旧错」时，最需要的是**确认当前跑的到底是哪一版**。
// 之前只能靠猜（截图时间、界面有没有新功能），还容易把「CEF 缓存了旧
// index.js」误判成「代码没修好」。现在 QAM 底部直接显示 `v2.8.2 · 11-27 22:15`。
const now = new Date();
const pad = (n) => String(n).padStart(2, "0");
const buildTime =
  `${pad(now.getMonth() + 1)}-${pad(now.getDate())} ` +
  `${pad(now.getHours())}:${pad(now.getMinutes())}`;

/**
 * 把版本信息注入成一个**普通全局变量**。
 *
 * 为什么不用 `@rollup/plugin-replace`？
 * -----------------------------------
 * 那只是 `@decky/rollup` 的**间接依赖**，pnpm 严格布局下不会提升到顶层，
 * 直接 import 会 MODULE_NOT_FOUND。为一个字符串替换去加显式依赖不值当。
 *
 * 为什么不用「标识符替换」？
 * ------------------------
 * 我第一版就是自己写正则替换 `__BT_VERSION__`，结果把**字符串字面量**里的
 * 同名内容也替换了（`name === "__BT_VERSION__"` → `name === ""2.8.2""`），
 * 生成非法语法，构建直接失败。字符串替换天然分不清标识符和字符串内容。
 *
 * 现在改成在 `intro` 阶段注入一行 `var __BT_META__ = {...}`：
 * 它在模块代码之前执行，是合法 JS，完全不需要替换任何源码。
 */
function injectMeta(meta) {
  const json = JSON.stringify(meta);
  return {
    name: "bt-inject-meta",
    intro() {
      return `var __BT_META__ = ${json};`;
    },
  };
}

const base = deckyPlugin();
const configs = Array.isArray(base) ? base : [base];

export default configs.map((cfg) => ({
  ...cfg,
  plugins: [...(cfg.plugins || []), injectMeta({ version, build: buildTime })],
}));
