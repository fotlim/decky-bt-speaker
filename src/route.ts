/**
 * 路由与主题的兼容入口。
 *
 * 历史：颜色原本定义在这个文件里（叫 `COLORS`），后来重构成 `theme.ts`
 * 并扩展成完整的 token（间距/字号/圆角/组合样式）。
 *
 * 这里保留 re-export，是为了让已有的 `import { COLORS } from "../route"`
 * 继续可用 —— 不为了「文件好看」而做无谓的批量改动。新代码请直接从
 * `theme.ts` 取，那里还有 SPACE / FONT / RADIUS 等。
 */

export { COLORS, ROUTE } from "./theme";
