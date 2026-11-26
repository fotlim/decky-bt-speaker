import { Focusable } from "@decky/ui";
import { COLORS } from "./route";

// ---------------------------------------------------------------------------
// 基础控件
// ---------------------------------------------------------------------------
export function IconButton({
  onClick, children, size = 36, active = false, danger = false, disabled = false, label,
}: {
  onClick: () => void; children: any; size?: number; active?: boolean; danger?: boolean;
  disabled?: boolean; label?: string;
}) {
  const bg = disabled
    ? "rgba(255,255,255,0.04)"
    : danger
      ? COLORS.accentWarm
      : active
        ? "rgba(76,154,255,0.9)"
        : "rgba(255,255,255,0.08)";
  return (
    <Focusable
      onActivate={() => { if (!disabled) onClick(); }}
      onClick={() => { if (!disabled) onClick(); }}
      style={{
        width: size, height: size, borderRadius: "50%", display: "flex",
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

export function Pill({ children, tone = "dim" }: { children: any; tone?: "ok" | "warn" | "dim" | "accent" }) {
  const map: Record<string, { bg: string; fg: string }> = {
    ok: { bg: "rgba(76,195,138,0.16)", fg: COLORS.ok },
    warn: { bg: "rgba(236,65,65,0.16)", fg: COLORS.accentWarm },
    accent: { bg: "rgba(76,154,255,0.16)", fg: COLORS.accent },
    dim: { bg: "rgba(255,255,255,0.07)", fg: COLORS.sub },
  };
  const c = map[tone] || map.dim;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 8px", borderRadius: 10, fontSize: 11,
      background: c.bg, color: c.fg, whiteSpace: "nowrap",
    }}>{children}</span>
  );
}

export function SectionTitle({ children, right }: { children: any; right?: any }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "18px 4px 10px" }}>
      <div style={{ fontSize: 18, fontWeight: 600, color: COLORS.text }}>{children}</div>
      {right}
    </div>
  );
}

export function Loading({ text = "加载中…" }: { text?: string }) {
  return <div style={{ padding: 24, color: COLORS.sub, fontSize: 14, textAlign: "center" }}>{text}</div>;
}

export function ErrorText({ text }: { text: string }) {
  return (
    <div style={{
      margin: "8px 4px", padding: "10px 12px", borderRadius: 8, fontSize: 12.5, lineHeight: 1.6,
      color: "#ffb3b3", background: "rgba(236,65,65,0.10)", border: "1px solid rgba(236,65,65,0.25)",
      whiteSpace: "pre-wrap", wordBreak: "break-word",
    }}>{text}</div>
  );
}

export function Hint({ children }: { children: any }) {
  return (
    <div style={{ margin: "6px 4px", fontSize: 12, lineHeight: 1.65, color: COLORS.dim }}>{children}</div>
  );
}

export function Card({ children, onClick, active = false }: { children: any; onClick?: () => void; active?: boolean }) {
  const inner = (
    <div style={{
      display: "flex", alignItems: "center", gap: 12, padding: "10px 12px",
      borderRadius: 10, background: active ? "rgba(76,154,255,0.12)" : "rgba(255,255,255,0.045)",
      border: `1px solid ${active ? "rgba(76,154,255,0.35)" : COLORS.border}`,
    }}>{children}</div>
  );
  if (!onClick) return inner;
  return (
    <Focusable onActivate={onClick} onClick={onClick} style={{ cursor: "pointer", marginBottom: 8 }}>
      {inner}
    </Focusable>
  );
}

export function Avatar({ icon, connected }: { icon?: string; connected?: boolean }) {
  const isPhone = (icon || "").includes("phone");
  const glyph = isPhone ? "📱" : (icon || "").includes("computer") ? "💻" : "🔊";
  return (
    <div style={{
      width: 40, height: 40, borderRadius: 20, flexShrink: 0,
      display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
      background: connected ? "rgba(76,195,138,0.16)" : "rgba(255,255,255,0.06)",
      border: `1px solid ${connected ? "rgba(76,195,138,0.4)" : COLORS.border}`,
    }}>{glyph}</div>
  );
}

export function Row({ children, gap = 8, align = "center" }: { children: any; gap?: number; align?: string }) {
  return (
    <Focusable flow-children="row" style={{ display: "flex", gap, alignItems: align as any }}>
      {children}
    </Focusable>
  );
}
