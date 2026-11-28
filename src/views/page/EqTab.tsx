/**
 * 均衡器 Tab：预设选择 + AutoEQ / Squiglink 曲线导入。
 *
 * 样式全部走 `theme.ts` 的 token，不再写字面量。
 */
import { useRef, useState } from "react";
import { Focusable } from "@decky/ui";
import { toaster } from "@decky/api";
import { api } from "../../backend";
import type { SpeakerStatus, EqPreset } from "../../types";
import { COLORS, SPACE, FONT, RADIUS, TONES } from "../../theme";
import {
  Btn, Pill, Hint, SectionTitle, Card, Stack, errMsg,
} from "../../components";
import { t } from "../../i18n";
export function EqTab({ state, refresh }: { state: SpeakerStatus; refresh: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [importText, setImportText] = useState("");
  const [showImport, setShowImport] = useState(false);
  const importRef = useRef<HTMLTextAreaElement | null>(null);
  const presets: EqPreset[] = state.eq?.presets || [];
  const current = state.eq?.preset || "flat";
  const apply = async (key: string) => {
    if (busy) return;
    setBusy(key);
    try {
      await api.setEqPreset(key);
      toaster.toast({ title: t("eq.applied"), body: t("eq.appliedBody") });
      setTimeout(refresh, 1500);
    } catch (e) {
      toaster.toast({ title: t("toast.switchFailed"), body: errMsg(e) });
    } finally {
      setBusy(null);
    }
  };
  const doImport = async () => {
    if (!importText.trim()) return;
    setBusy("import");
    try {
      const r = await api.importAutoeq(importText);
      toaster.toast({
        title: t("eq.imported", { n: r.bands }),
        body: r.skipped ? t("eq.skipped", { n: r.skipped }) : "",
      });
      setShowImport(false);
      setImportText("");
      setTimeout(refresh, 1500);
    } catch (e) {
      toaster.toast({ title: t("toast.failed"), body: errMsg(e) });
    } finally {
      setBusy(null);
    }
  };
  const removeEq = async () => {
    try {
      await api.removeEq();
      toaster.toast({ title: t("eq.removeEq"), body: "" });
      setTimeout(refresh, 1500);
    } catch (e) {
      toaster.toast({ title: t("toast.failed"), body: errMsg(e) });
    }
  };
  return (
    <div style={{ marginTop: SPACE.xl, maxWidth: 760 }}>
      <SectionTitle>{t("eq.presets")}</SectionTitle>
      <Hint>{t("eq.hint")}</Hint>

      <Stack gap={SPACE.md}>
        {presets.map((p) => (
          <PresetRow
            key={p.key}
            preset={p}
            active={current === p.key}
            busy={busy === p.key}
            onPick={() => apply(p.key)}
          />
        ))}
        {current === "custom" && (
          <Card active>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: FONT.bodyLg, color: COLORS.text }}>{t("eq.custom")}</div>
              <div style={{ fontSize: FONT.small, color: COLORS.dim, marginTop: 3 }}>
                {t("eq.customActive")}
              </div>
            </div>
            <Pill tone="accent">{t("eq.active")}</Pill>
          </Card>
        )}
      </Stack>

      <SectionTitle>{t("eq.import")}</SectionTitle>
      <Hint>{t("eq.importHint")}</Hint>

      <Focusable flow-children="row" style={{ display: "flex", gap: SPACE.md, marginTop: SPACE.md }}>
        <Btn variant="ghost" onClick={() => setShowImport(!showImport)}>
          {showImport ? t("eq.collapse") : t("eq.paste")}
        </Btn>
        {state.eq?.installed && (
          <Btn variant="danger" onClick={removeEq}>{t("eq.removeEq")}</Btn>
        )}
      </Focusable>

      {showImport && (
        <div style={{ marginTop: SPACE.lg }}>
          {/* ⚠️ 必须包 Focusable：裸 `<textarea>` 在手柄焦点树里选不中，
              AutoEQ 粘贴导入这个功能在游戏模式下等于不存在。 */}
          <Focusable
            onActivate={() => {
              try { importRef.current?.focus(); } catch { /* 忽略 */ }
            }}
          >
            <textarea
              ref={importRef}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder={"Preamp: -6.8 dB\nFilter 1: ON PK Fc 21 Hz Gain 6.7 dB Q 1.100\nFilter 2: ON LSC Fc 85 Hz Gain 6.9 dB Q 3.000"}
              style={{
                marginTop: SPACE.md, padding: SPACE.lg, borderRadius: RADIUS.sm,
                width: "100%", minHeight: 120, boxSizing: "border-box",
                fontSize: FONT.small, color: COLORS.text, fontFamily: "monospace",
                background: "rgba(0,0,0,0.35)", border: `1px solid ${COLORS.border}`,
                outline: "none", resize: "vertical",
              }}
            />
          </Focusable>
          <div style={{ marginTop: SPACE.md }}>
            <Btn variant="primary" onClick={doImport} disabled={busy === "import"}>
              {busy === "import" ? t("eq.importing") : t("eq.applyImport")}
            </Btn>
          </div>
        </div>
      )}

      <Hint>
        {t("eq.configPath")}{" "}
        <span style={{ color: COLORS.sub }}>
          {state.eq?.path || "~/.config/pipewire/pipewire.conf.d/60-bt-speaker-eq.conf"}
        </span>
      </Hint>
    </div>
  );
}
// ---------------------------------------------------------------------------
// 单个预设行（单选风格）
// ---------------------------------------------------------------------------
function PresetRow({ preset, active, busy, onPick }: {
  preset: EqPreset; active: boolean; busy: boolean; onPick: () => void;
}) {
  return (
    <Focusable
      onActivate={onPick}
      style={{
        display: "flex", alignItems: "center", gap: SPACE.lg,
        padding: `${SPACE.lg}px ${SPACE.xl}px`,
        borderRadius: RADIUS.lg, cursor: "pointer",
        background: active ? TONES.accent.bg : COLORS.surface,
        border: `1px solid ${active ? TONES.accent.border : COLORS.border}`,
        opacity: busy ? 0.5 : 1,
      }}
    >
      {/* 单选圆点 */}
      <div style={{
        width: 16, height: 16, borderRadius: RADIUS.full, flexShrink: 0,
        border: `2px solid ${active ? COLORS.accent : COLORS.surfaceActive}`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {active && (
          <div style={{
            width: 8, height: 8, borderRadius: RADIUS.full, background: COLORS.accent,
          }} />
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: FONT.bodyLg, color: COLORS.text }}>
          {t(preset.label_key)}{busy ? " …" : ""}
        </div>
        <div style={{ fontSize: FONT.small, color: COLORS.dim, marginTop: 3 }}>
          {t(preset.desc_key)}
        </div>
      </div>
      {preset.bands > 0 && <Pill>{t("eq.bands", { n: preset.bands })}</Pill>}
    </Focusable>
  );
}
