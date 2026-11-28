import { useState } from "react";
import { Focusable } from "@decky/ui";
import { toaster } from "@decky/api";
import { api } from "../../backend";
import type { SpeakerStatus, EqPreset } from "../../types";
import { COLORS, SPACE, FONT, RADIUS, TONES } from "../../theme";
import {
  Btn, Pill, Dot, Hint, SectionTitle, GroupTitle, Card, Stack, errMsg,
} from "../../components";
import { t } from "../../i18n";

export function EqTab({ state, refresh }: { state: SpeakerStatus; refresh: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [importText, setImportText] = useState("");
  const [showImport, setShowImport] = useState(false);
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

  const box: React.CSSProperties = {
    marginTop: 8, padding: 10, borderRadius: 9, width: "100%", minHeight: 120,
    fontSize: 12, color: COLORS.text, fontFamily: "monospace",
    background: "rgba(0,0,0,0.35)", border: `1px solid ${COLORS.border}`,
    outline: "none", resize: "vertical",
  };

  return (
    <div style={{ marginTop: 16, maxWidth: 760 }}>
      <SectionTitle>{t("eq.presets")}</SectionTitle>
      <Hint>
        {t("eq.hint")}
      </Hint>
      <Focusable flow-children="column" style={{ marginTop: 10 }}>
        {presets.map((p) => {
          const active = current === p.key;
          const isBusy = busy === p.key;
          return (
            <Focusable
              key={p.key}
              onClick={() => apply(p.key)}
              onActivate={() => apply(p.key)}
              style={{
                display: "flex", alignItems: "center", gap: 14, padding: "12px 14px", marginBottom: 8,
                borderRadius: 11, cursor: "pointer",
                background: active ? "rgba(76,154,255,0.13)" : "rgba(255,255,255,0.045)",
                border: `1px solid ${active ? "rgba(76,154,255,0.4)" : COLORS.border}`,
                opacity: isBusy ? 0.5 : 1,
              }}
            >
              <div style={{
                width: 16, height: 16, borderRadius: 8, flexShrink: 0,
                border: `2px solid ${active ? COLORS.accent : "rgba(255,255,255,0.25)"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {active && <div style={{ width: 8, height: 8, borderRadius: 4, background: COLORS.accent }} />}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14.5, color: COLORS.text }}>
                  {p.label}{isBusy ? " …" : ""}
                </div>
                <div style={{ fontSize: 11.5, color: COLORS.dim, marginTop: 3 }}>{p.desc}</div>
              </div>
              {p.bands > 0 && <Pill>{t("eq.bands", { n: p.bands })}</Pill>}
            </Focusable>
          );
        })}
        {current === "custom" && (
          <Card active>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, color: COLORS.text }}>{t("eq.custom")}</div>
              <div style={{ fontSize: 11.5, color: COLORS.dim, marginTop: 3 }}>{t("eq.customActive")}</div>
            </div>
            <Pill tone="accent">{t("eq.active")}</Pill>
          </Card>
        )}
      </Focusable>

      <SectionTitle>{t("eq.import")}</SectionTitle>
      <Hint>
        {t("eq.importHint")}
      </Hint>
      <Focusable flow-children="row" style={{ display: "flex", gap: 10, marginTop: 8 }}>
        <Focusable
          onClick={() => setShowImport(!showImport)}
          onActivate={() => setShowImport(!showImport)}
          style={{ padding: "8px 16px", borderRadius: 18, background: "rgba(255,255,255,0.08)", color: COLORS.text, fontSize: 13, cursor: "pointer" }}
        >{showImport ? t("eq.collapse") : t("eq.paste")}</Focusable>
        {state.eq?.installed && (
          <Focusable
            onClick={async () => {
              try {
                await api.removeEq();
                toaster.toast({ title: t("eq.removeEq"), body: "" });
                setTimeout(refresh, 1500);
              } catch (e) {
                toaster.toast({ title: t("toast.failed"), body: errMsg(e) });
              }
            }}
            onActivate={async () => {
              try { await api.removeEq(); setTimeout(refresh, 1500); } catch { /* ignore */ }
            }}
            style={{ padding: "8px 16px", borderRadius: 18, background: "rgba(236,65,65,0.14)", color: COLORS.accentWarm, fontSize: 13, cursor: "pointer" }}
          >{t("eq.removeEq")}</Focusable>
        )}
      </Focusable>

      {showImport && (
        <div style={{ marginTop: 10 }}>
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder={"Preamp: -6.8 dB\nFilter 1: ON PK Fc 21 Hz Gain 6.7 dB Q 1.100\nFilter 2: ON LSC Fc 85 Hz Gain 6.9 dB Q 3.000"}
            style={box}
          />
          <Focusable
            onClick={doImport}
            onActivate={doImport}
            style={{
              display: "inline-block", marginTop: 8, padding: "9px 20px", borderRadius: 9,
              background: COLORS.accent, color: "#fff", fontSize: 13.5, cursor: "pointer",
              opacity: busy === "import" ? 0.5 : 1,
            }}
          >{busy === "import" ? t("eq.importing") : t("eq.applyImport")}</Focusable>
        </div>
      )}

      <Hint>
        {t("eq.configPath")} <span style={{ color: COLORS.sub }}>{state.eq?.path || "~/.config/pipewire/pipewire.conf.d/60-bt-speaker-eq.conf"}</span>
      </Hint>
    </div>
  );
}

// ---------------------------------------------------------------------------
