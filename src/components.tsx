/**
 * 通用控件库。
 *
 * 重构原则
 * --------
 * 1. **所有视觉值都从 `theme.ts` 取**，不在组件里写字面量
 * 2. **一种控件只有一种尺寸**。重构前「胶囊按钮」有 3 种 padding，
 *    现在统一走 `Btn` 组件，需要强调就换 `variant`，不要自己写 style
 * 3. **组件保持无状态**，只负责渲染；状态由调用方管
 *
 * 为什么不直接用 `@decky/ui` 的 ButtonItem / ToggleField？
 * ------------------------------------------------------
 * 那些是给 QAM 面板设计的（整行、带 Steam 原生样式），在全屏页里
 * 尺寸和间距都不对。全屏页需要更紧凑、更可控的控件，所以自己实现。
 * QAM 面板（Speaker.tsx）仍然用原生控件，那是对的。
 */

import { Focusable } from "@decky/ui";
import {
  COLORS, TONES, SPACE, FONT, RADIUS,
  CARD_STYLE, ELLIPSIS, HINT_STYLE,
  type Tone,
} from "./theme";

// ---------------------------------------------------------------------------
// 工具函数
// ---------------------------------------------------------------------------

/**
 * 从 catch 到的任意值里取出可读的错误文本。
 *
 * 为什么需要它？
 * ------------
 * TS 4.4+ 的 `useUnknownInCatchVariables` 下，`catch (e)` 里的 e 是 `unknown`，
 * 直接读 `e.message` 会编译报错。早期代码为了省事全写成 `catch (e: any)`，
 * 但那等于关掉了类型检查 —— 后端返回什么形状都不会被发现。
 *
 * 统一走这个函数，既能拿到消息，又保持 unknown 的类型安全。
 */
export function errMsg(e: unknown): string {
  if (e == null) return "unknown error";
  if (typeof e === "string") return e;
  if (e instanceof Error) return e.message;
  if (typeof e === "object") {
    const m = (e as { message?: unknown }).message;
    if (typeof m === "string") return m;
    try {
      return JSON.stringify(e);
    } catch {
      return String(e);
    }
  }
  return String(e);
}

// ---------------------------------------------------------------------------
// 按钮
// ---------------------------------------------------------------------------

type BtnVariant = "primary" | "ghost" | "danger" | "ok";

const BTN_VARIANTS: Record<BtnVariant, { bg: string; fg: string }> = {
  primary: { bg: COLORS.accent, fg: "#fff" },
  ghost: { bg: COLORS.surfaceHover, fg: COLORS.text },
  danger: { bg: TONES.warn.bg, fg: TONES.warn.fg },
  ok: { bg: TONES.ok.bg, fg: TONES.ok.fg },
};

/**
 * 胶囊按钮 —— 全屏页里**唯一**的按钮形态。
 *
 * 重构前这个按钮在 3 个地方有 3 种 padding（7/14、7/16、8/16），
 * 现在统一到一处。需要不同视觉重量就用 `variant`。
 */
export function Btn({
  onClick, children, variant = "ghost", disabled = false, small = false, title,
}: {
  onClick: () => void;
  children: any;
  variant?: BtnVariant;
  disabled?: boolean;
  /** 紧凑尺寸：用于卡片内的次要操作 */
  small?: boolean;
  title?: string;
}) {
  const v = BTN_VARIANTS[variant];
  const fire = () => {
    if (!disabled) onClick();
  };
  return (
    <Focusable
      onActivate={fire}
      onClick={fire}
      title={title}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        gap: SPACE.xs,
        padding: small ? `${SPACE.xs}px ${SPACE.lg}px` : `${SPACE.md}px ${SPACE.xl}px`,
        borderRadius: RADIUS.md,
        fontSize: small ? FONT.small : FONT.body,
        cursor: disabled ? "default" : "pointer",
        whiteSpace: "nowrap",
        flexShrink: 0,
        background: disabled ? COLORS.surface : v.bg,
        color: disabled ? COLORS.dim : v.fg,
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {children}
    </Focusable>
  );
}

/** 圆形图标按钮（QAM 里用不到，全屏页的工具栏用） */
export function IconButton({
  onClick, children, size = 36, active = false, danger = false, disabled = false, label,
}: {
  onClick: () => void; children: any; size?: number; active?: boolean; danger?: boolean;
  disabled?: boolean; label?: string;
}) {
  const bg = disabled
    ? COLORS.surface
    : danger
      ? COLORS.accentWarm
      : active
        ? "rgba(76,154,255,0.9)"
        : COLORS.surfaceHover;
  return (
    <Focusable
      onActivate={() => { if (!disabled) onClick(); }}
      onClick={() => { if (!disabled) onClick(); }}
      style={{
        width: size, height: size, borderRadius: RADIUS.full, display: "flex",
        alignItems: "center", justifyContent: "center",
        cursor: disabled ? "default" : "pointer",
        background: bg, color: disabled ? COLORS.dim : "#fff", flexShrink: 0,
      }}
      aria-label={label}
    >
      {children}
    </Focusable>
  );
}

// ---------------------------------------------------------------------------
// 标签 / 徽章
// ---------------------------------------------------------------------------

/** 小徽章。`tone` 决定配色，全部来自 TONES。 */
export function Pill({ children, tone = "neutral" }: { children: any; tone?: Tone }) {
  const c = TONES[tone] || TONES.neutral;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: SPACE.xs,
      padding: `2px ${SPACE.md}px`, borderRadius: RADIUS.sm, fontSize: FONT.caption,
      background: c.bg, color: c.fg, whiteSpace: "nowrap",
    }}>{children}</span>
  );
}

/** 状态圆点（配合 Pill 或独立使用） */
export function Dot({ tone = "ok", size = 8, pulse = false }: {
  tone?: Tone; size?: number; pulse?: boolean;
}) {
  const c = TONES[tone] || TONES.neutral;
  return (
    <span style={{
      width: size, height: size, borderRadius: RADIUS.full,
      background: c.fg, flexShrink: 0, display: "inline-block",
      animation: pulse ? "btPulse 1.4s ease-in-out infinite" : undefined,
    }} />
  );
}

// ---------------------------------------------------------------------------
// 布局
// ---------------------------------------------------------------------------

/** 分节标题 */
export function SectionTitle({ children, right }: { children: any; right?: any }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      margin: `${SPACE.section}px ${SPACE.xs}px ${SPACE.md}px`,
    }}>
      <div style={{ fontSize: FONT.title, fontWeight: 600, color: COLORS.text }}>{children}</div>
      {right}
    </div>
  );
}

/** 分组小标题（比分节标题低一级） */
export function GroupTitle({ children }: { children: any }) {
  return (
    <div style={{
      fontSize: FONT.small, fontWeight: 600, color: COLORS.sub,
      letterSpacing: 0.4, textTransform: "uppercase",
      margin: `${SPACE.lg}px ${SPACE.xs}px ${SPACE.sm}px`,
    }}>{children}</div>
  );
}

/** 卡片容器（纯容器，不带交互） */
export function Card({ children, onClick, active = false }: {
  children: any; onClick?: () => void; active?: boolean;
}) {
  const inner = (
    <div style={{
      ...CARD_STYLE,
      background: active ? TONES.accent.bg : COLORS.surface,
      border: `1px solid ${active ? TONES.accent.border : COLORS.border}`,
    }}>{children}</div>
  );
  if (!onClick) return inner;
  return (
    <Focusable onActivate={onClick} onClick={onClick} style={{ cursor: "pointer", marginBottom: SPACE.md }}>
      {inner}
    </Focusable>
  );
}

/** 横向排列的 Focusable 容器（手柄导航需要 flow-children） */
export function Row({ children, gap = SPACE.md, align = "center", wrap = false }: {
  children: any; gap?: number; align?: string; wrap?: boolean;
}) {
  return (
    <Focusable
      flow-children={wrap ? "row" : "row"}
      style={{ display: "flex", gap, alignItems: align as any, flexWrap: wrap ? "wrap" : "nowrap" }}
    >
      {children}
    </Focusable>
  );
}

/** 纵向排列的 Focusable 容器 */
export function Stack({ children, gap = SPACE.md }: { children: any; gap?: number }) {
  return (
    <Focusable flow-children="column" style={{ display: "flex", flexDirection: "column", gap }}>
      {children}
    </Focusable>
  );
}

// ---------------------------------------------------------------------------
// 文字
// ---------------------------------------------------------------------------

/**
 * 加载占位。
 *
 * ⚠️ 默认文案故意留空 —— 组件本身不该写死任何语言。
 * 调用方传 `text={t("common.reading")}` 这样才是对的。
 * 早期这里默认 `"加载中…"`，英文界面下就会漏出中文。
 */
export function Loading({ text = "" }: { text?: string }) {
  return (
    <div style={{ padding: 24, color: COLORS.sub, fontSize: FONT.bodyLg, textAlign: "center" }}>
      {text || "…"}
    </div>
  );
}

export function ErrorText({ text }: { text: string }) {
  return (
    <div style={{
      margin: `${SPACE.md}px ${SPACE.xs}px`, padding: `${SPACE.lg}px ${SPACE.xl}px`,
      borderRadius: RADIUS.sm, fontSize: FONT.small, lineHeight: 1.6,
      color: "#ffb3b3", background: TONES.warn.bg, border: `1px solid ${TONES.warn.border}`,
      whiteSpace: "pre-wrap", wordBreak: "break-word",
    }}>{text}</div>
  );
}

/** 说明文字 */
export function Hint({ children }: { children: any }) {
  return <div style={{ margin: `${SPACE.sm}px ${SPACE.xs}px`, ...HINT_STYLE }}>{children}</div>;
}

/** 单行截断的文字 */
export function EllipsisText({ children, size = FONT.body, color = COLORS.text, bold = false }: {
  children: any; size?: number; color?: string; bold?: boolean;
}) {
  return (
    <div style={{
      fontSize: size, color, fontWeight: bold ? 600 : 400, ...ELLIPSIS,
    }}>{children}</div>
  );
}

// ---------------------------------------------------------------------------
// 开关
// ---------------------------------------------------------------------------

/**
 * 开关（Toggle）。手写而不是用 `ToggleField`，因为全屏页需要
 * 「一行内放标签 + 开关」的紧凑布局，原生控件会撑满整行。
 */
export function Toggle({ checked, onChange, disabled = false }: {
  checked: boolean; onChange: (v: boolean) => void; disabled?: boolean;
}) {
  return (
    <Focusable
      onActivate={() => { if (!disabled) onChange(!checked); }}
      onClick={() => { if (!disabled) onChange(!checked); }}
      style={{
        width: 42, height: 24, borderRadius: RADIUS.full, flexShrink: 0,
        position: "relative", cursor: disabled ? "default" : "pointer",
        background: checked ? COLORS.accent : COLORS.surfaceActive,
        opacity: disabled ? 0.5 : 1,
        transition: "background 0.15s",
      }}
    >
      <div style={{
        position: "absolute", top: 3, left: checked ? 21 : 3,
        width: 18, height: 18, borderRadius: RADIUS.full,
        background: "#fff", transition: "left 0.15s",
      }} />
    </Focusable>
  );
}

/** 带标签和说明的一整行开关 */
export function ToggleRow({ label, desc, checked, onChange, disabled = false }: {
  label: string; desc?: string; checked: boolean;
  onChange: (v: boolean) => void; disabled?: boolean;
}) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: SPACE.lg,
      padding: `${SPACE.lg}px ${SPACE.xl}px`, marginBottom: SPACE.md,
      borderRadius: RADIUS.lg, background: COLORS.surface,
      border: `1px solid ${COLORS.border}`,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: FONT.bodyLg, color: COLORS.text }}>{label}</div>
        {desc && (
          <div style={{ fontSize: FONT.small, color: COLORS.dim, marginTop: 3, lineHeight: 1.5 }}>
            {desc}
          </div>
        )}
      </div>
      <Toggle checked={checked} onChange={onChange} disabled={disabled} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// 设备头像
// ---------------------------------------------------------------------------

export function Avatar({ icon, connected }: { icon?: string; connected?: boolean }) {
  const isPhone = (icon || "").includes("phone");
  const glyph = isPhone ? "📱" : (icon || "").includes("computer") ? "💻" : "🔊";
  return (
    <div style={{
      width: 40, height: 40, borderRadius: RADIUS.full, flexShrink: 0,
      display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
      background: connected ? TONES.ok.bg : COLORS.surface,
      border: `1px solid ${connected ? TONES.ok.border : COLORS.border}`,
    }}>{glyph}</div>
  );
}
