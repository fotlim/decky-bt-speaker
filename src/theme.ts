/**
 * 设计令牌（design tokens）：颜色 + 间距 + 字号 + 圆角。
 *
 * 为什么要有这个文件？
 * ------------------
 * 重构前，同一个「胶囊按钮」在不同地方出现过 3 种写法：
 *
 *     padding: "7px 14px", borderRadius: 18   ← 设备卡片里的信任/修复/移除
 *     padding: "7px 16px", borderRadius: 18   ← 设备卡片里的连接按钮
 *     padding: "8px 16px", borderRadius: 18   ← 诊断页的按钮
 *
 * 同一种卡片也有 `10px 12px` / `11px 14px` / `12px 14px` 三种。
 * 字号更散：11 / 11.5 / 12 / 12.5 / 13 / 13.5 / 14.5 / 15 / 18。
 *
 * 肉眼看得出「不齐」，但改的时候又不敢动 —— 因为不知道哪处是刻意的。
 * 所以先把这些值收敛成 token，之后所有组件都从这里取，不再写字面量。
 *
 * ⚠️ 原则：**token 只描述视觉，不描述语义**。
 * 不要写 `buttonPrimaryPadding` 这种名字 —— 那样加个新按钮就得加个新 token。
 * 用 `space.*` / `font.*` / `radius.*` 这类「量」的名字，组合出各种样式。
 */

// ---------------------------------------------------------------------------
// 颜色
// ---------------------------------------------------------------------------
export const COLORS = {
  /** 页面底色 */
  bg: "#0f1620",
  /** 卡片/面板底色（比 bg 略亮一层） */
  panel: "#16212d",
  panelAlt: "#1c2a38",

  /** 主强调色（可交互元素的默认色） */
  accent: "#4c9aff",
  /** 危险/警告色 */
  accentWarm: "#ec4141",
  /** 成功/已连接 */
  ok: "#4cc38a",
  /** 提示性黄色（无名称设备等） */
  warn: "#e0a800",

  /** 主文字 */
  text: "#e8ebee",
  /** 次要文字 */
  sub: "#9aa6b2",
  /** 最弱的文字（提示、脚注） */
  dim: "#6b7783",

  /** 边框 */
  border: "rgba(255,255,255,0.07)",
  /** 更明显的边框（卡片轮廓） */
  borderStrong: "rgba(255,255,255,0.12)",

  /** 表面层：从最弱到最强 */
  surface: "rgba(255,255,255,0.045)",
  surfaceHover: "rgba(255,255,255,0.08)",
  surfaceActive: "rgba(255,255,255,0.12)",
} as const;

/**
 * 语义色板：给 Pill / 提示框这类需要「同色系背景 + 前景」的地方用。
 *
 * 为什么单独列出来？—— 因为 `rgba(76,195,138,0.16)` 这种值散落在各处，
 * 改一个绿色要搜三个文件。集中到这里，改一处就够。
 */
export const TONES = {
  ok: { bg: "rgba(76,195,138,0.16)", fg: COLORS.ok, border: "rgba(76,195,138,0.28)" },
  warn: { bg: "rgba(236,65,65,0.14)", fg: COLORS.accentWarm, border: "rgba(236,65,65,0.28)" },
  accent: { bg: "rgba(76,154,255,0.16)", fg: COLORS.accent, border: "rgba(76,154,255,0.28)" },
  neutral: { bg: COLORS.surface, fg: COLORS.sub, border: COLORS.border },
} as const;

export type Tone = keyof typeof TONES;

// ---------------------------------------------------------------------------
// 间距（4px 基准栅格）
// ---------------------------------------------------------------------------
export const SPACE = {
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 20,
  /** 分节之间的大间距 */
  section: 18,
} as const;

// ---------------------------------------------------------------------------
// 字号
// ---------------------------------------------------------------------------
/**
 * 收敛后的字号阶梯（原来有 9 种，现在 6 种）。
 *
 * - `caption` 11   —— 脚注、Pill、状态小字
 * - `small`   12   —— 辅助说明
 * - `body`    13   —— 正文（最常用）
 * - `bodyLg`  14   —— 卡片标题、按钮
 * - `title`   18   —— 分节标题
 * - `page`    26   —— 页面主标题
 */
export const FONT = {
  caption: 11,
  small: 12,
  body: 13,
  bodyLg: 14,
  title: 18,
  page: 26,
} as const;

// ---------------------------------------------------------------------------
// 圆角
// ---------------------------------------------------------------------------
export const RADIUS = {
  /** 小元素：Pill、标签 */
  sm: 10,
  /** 中元素：按钮、输入框 */
  md: 18,
  /** 大元素：卡片、面板 */
  lg: 11,
  /** 正圆 */
  full: 999,
} as const;

// ---------------------------------------------------------------------------
// 组合样式：把常用搭配固化成对象，避免每处手写
// ---------------------------------------------------------------------------

/** 卡片容器：设备行、设置分组用 */
export const CARD_STYLE = {
  display: "flex",
  alignItems: "center",
  gap: SPACE.lg,
  padding: `${SPACE.lg}px ${SPACE.xl}px`,
  borderRadius: RADIUS.lg,
  background: COLORS.surface,
  border: `1px solid ${COLORS.border}`,
} as const;

/** 文字截断（设备名等长文本） */
export const ELLIPSIS = {
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
} as const;

/** 单行说明文字 */
export const HINT_STYLE = {
  fontSize: FONT.small,
  lineHeight: 1.65,
  color: COLORS.dim,
} as const;

/** 页面路由路径 */
export const ROUTE = "/decky/bt-speaker";
