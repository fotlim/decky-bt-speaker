import { useEffect, useState } from "react";
import { Focusable, SliderField } from "@decky/ui";
import { toaster } from "@decky/api";
import { api } from "../../backend";
import type {
  SpeakerStatus, CodecPreset, WifiInterface, LatencyProfile, SinkNode,
} from "../../types";
import { COLORS, SPACE, FONT, RADIUS } from "../../theme";
import {
  Btn, Pill, Hint, SectionTitle, ToggleRow, errMsg,
} from "../../components";
import { t } from "../../i18n";

export function SettingsTab({ state, refresh }: { state: SpeakerStatus; refresh: () => void }) {
  const [alias, setAlias] = useState(state.adapter?.alias || "");
  const [busy, setBusy] = useState(false);
  const s = state.settings || {};

  useEffect(() => { setAlias(state.adapter?.alias || ""); }, [state.adapter?.alias]);

  const save = async (key: string, value: boolean | number | string, label: string) => {
    try {
      await api.setSetting(key, value);
      toaster.toast({ title: label, body: "" });
    } catch (e) {
      toaster.toast({ title: t("toast.saveFailed"), body: errMsg(e) });
    }
  };

  const changeFocus = async (mode: string) => {
    try {
      const r = await api.setFocusMode(mode);
      toaster.toast({
        title: t("set.focus"),
        body: r.applied && r.applied.length ? r.applied.join("、") : "",
      });
      refresh();
    } catch (e) {
      toaster.toast({ title: t("toast.switchFailed"), body: errMsg(e) });
    }
  };

  const setSilence = async (sec: number) => {
    try {
      await api.setSilenceTimeout(sec);
      refresh();
    } catch (e) {
      toaster.toast({ title: t("toast.saveFailed"), body: errMsg(e) });
    }
  };

  const applyAlias = async () => {
    const v = alias.trim();
    if (!v || busy) return;
    setBusy(true);
    try {
      await api.setAlias(v);
      toaster.toast({ title: t("toast.nameChanged", { name: v }), body: "" });
    } catch (e) {
      toaster.toast({ title: t("toast.renameFailed"), body: errMsg(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ marginTop: SPACE.xl, maxWidth: 720 }}>
      <SectionTitle>{t("set.name")}</SectionTitle>
      <Hint>{t("set.nameHint")}</Hint>
      <div style={{ display: "flex", gap: SPACE.md, marginTop: SPACE.md }}>
        <input
          value={alias}
          onChange={(e) => setAlias(e.target.value)}
          maxLength={40}
          placeholder="Steam Deck"
          style={{
            flex: 1, padding: `${SPACE.md}px ${SPACE.lg}px`, borderRadius: RADIUS.sm,
            fontSize: FONT.bodyLg, boxSizing: "border-box",
            background: COLORS.surfaceHover, border: `1px solid ${COLORS.border}`,
            color: COLORS.text, outline: "none",
          }}
        />
        <Btn variant="primary" onClick={applyAlias} disabled={busy}>
          {busy ? t("common.saving") : t("common.save")}
        </Btn>
      </div>

      <SectionTitle>{t("set.audioTuning")}</SectionTitle>
      <ToggleRow
        label={t("set.audioTuningLabel")}
        desc={t("set.audioTuningDesc")}
        checked={!!state.tuning?.installed}
        onChange={async (v) => {
          try {
            if (v) {
              await api.applyTuning();
              toaster.toast({ title: t("set.tuningOn"), body: "" });
            } else {
              await api.removeTuning();
              toaster.toast({ title: t("set.tuningOff"), body: "" });
            }
            refresh();
          } catch (e) {
            toaster.toast({ title: t("toast.failed"), body: errMsg(e) });
          }
        }}
      />
      <Hint>
        {t("set.tuningHint", { path: state.tuning?.path || "~/.config/wireplumber/wireplumber.conf.d/50-bt-speaker.conf" })}
      </Hint>

      <SectionTitle>{t("set.pairing")}</SectionTitle>
      <Hint>
        {t("set.pairingHint")}
      </Hint>
      <div style={{ display: "flex", alignItems: "center", gap: SPACE.md, marginTop: SPACE.md }}>
        <div style={{
          width: 8, height: 8, borderRadius: 4, flexShrink: 0,
          background: state.agent_registered ? COLORS.ok : state.agent ? "#e0a800" : COLORS.accentWarm,
        }} />
        <div style={{ flex: 1, fontSize: FONT.body, color: COLORS.text }}>
          {state.agent_registered
            ? t("set.agentReady")
            : state.agent
              ? t("set.agentRunning")
              : t("set.agentDown")}
        </div>
        <Focusable
          onClick={async () => {
            try {
              const r = await api.restartAgent();
              toaster.toast({
                title: r.registered ? t("set.agentReady") : t("set.agentRunning"),
                body: "",
              });
              setTimeout(refresh, 800);
            } catch (e) {
              toaster.toast({ title: t("toast.failed"), body: errMsg(e) });
            }
          }}
          onActivate={async () => {
            try { await api.restartAgent(); setTimeout(refresh, 800); } catch { /* ignore */ }
          }}
          style={{
            padding: `${SPACE.xs}px ${SPACE.lg}px`, borderRadius: RADIUS.md,
            fontSize: FONT.small, cursor: "pointer",
            background: COLORS.surfaceHover, color: COLORS.text, flexShrink: 0,
          }}
        >{t("set.restartAgent")}</Focusable>
      </div>

      <SectionTitle>{t("set.codec")}</SectionTitle>
      <Hint>
        {t("set.codecHint")}
      </Hint>
      <Focusable flow-children="column" style={{ marginTop: SPACE.md }}>
        {(state.quality?.presets || []).map((p: CodecPreset) => {
          const active = (s.codec_preset || "balanced") === p.key;
          return (
            <Focusable
              key={p.key}
              onClick={async () => {
                try {
                  const r = await api.setCodecPreset(p.key);
                  toaster.toast({
                    title: `${t("set.codec")}: ${p.label}`,
                    body: r.active_profile ? `${t("set.codecCurrent", { codec: r.active_profile })}` : "",
                  });
                  setTimeout(refresh, 1500);
                } catch (e) {
                  toaster.toast({ title: t("toast.switchFailed"), body: errMsg(e) });
                }
              }}
              onActivate={async () => {
                try { await api.setCodecPreset(p.key); setTimeout(refresh, 1500); } catch { /* ignore */ }
              }}
              style={{
                display: "flex", alignItems: "center", gap: 12, padding: `${SPACE.lg}px ${SPACE.xl}px`, marginBottom: SPACE.md,
                borderRadius: RADIUS.sm, cursor: "pointer",
                background: active ? "rgba(76,154,255,0.13)" : "rgba(255,255,255,0.045)",
                border: `1px solid ${active ? "rgba(76,154,255,0.4)" : COLORS.border}`,
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
                <div style={{ fontSize: FONT.bodyLg, color: COLORS.text }}>{p.label}</div>
                <div style={{ fontSize: FONT.small, color: COLORS.dim, marginTop: 2 }}>{p.desc}</div>
              </div>
              <Pill>resample {p.resample}</Pill>
            </Focusable>
          );
        })}
      </Focusable>
      <Hint>
        {t("set.codecCurrent", { codec: state.quality?.active_profile || t("common.none") })}
        <span style={{ color: COLORS.accent }}>
        </span>
        <br />
        {t("set.codecReconnect")}
      </Hint>

      <SectionTitle>{t("set.stutter")}</SectionTitle>
      {/* 2.4GHz 干扰是蓝牙卡顿的头号原因，直接显示出来 */}
      {state.wifi && state.wifi.risk === "high" && (
        <div style={{
          margin: "6px 0 10px", padding: `${SPACE.md}px ${SPACE.lg}px`, borderRadius: RADIUS.sm, fontSize: FONT.small, lineHeight: 1.7,
          background: "rgba(236,65,65,0.10)", border: "1px solid rgba(236,65,65,0.28)",
          color: "#ffb3b3", whiteSpace: "pre-wrap",
        }}>
          <b>⚠️ {t("set.stutterWifi")}</b>
          {"\n"}
          {state.wifi.wifi_24g.map((w: WifiInterface) =>
            `${w.ssid || w.interface} (ch ${w.channel}, ${w.freq_mhz} MHz)`).join(" / ")}
          {"\n"}
          {t("set.stutterWifiBody")}
        </div>
      )}
      {state.wifi && state.wifi.risk === "none" && (
        <Hint>
          {t("set.stutterOk")}
        </Hint>
      )}

      <Focusable flow-children="row" style={{ display: "flex", gap: SPACE.md, marginTop: SPACE.md }}>
        <Focusable
          onClick={async () => {
            try {
              const r = await api.fixStutter();
              toaster.toast({
                title: t("set.fixStutter"),
                body: (r.applied || []).join("、"),
              });
              setTimeout(refresh, 1500);
            } catch (e) {
              toaster.toast({ title: t("toast.failed"), body: errMsg(e) });
            }
          }}
          onActivate={async () => {
            try { await api.fixStutter(); setTimeout(refresh, 1500); } catch { /* ignore */ }
          }}
          style={{
            padding: `${SPACE.md}px ${SPACE.xl}px`,
            borderRadius: RADIUS.md, cursor: "pointer", fontSize: FONT.body,
            background: COLORS.accent, color: "#fff",
          }}
        >{t("set.fixStutter")}</Focusable>
        <Focusable
          onClick={async () => {
            try {
              const r = await api.diagnoseStutter();
              const lines = [];
              if (r.too_slow?.count > 0) {
                lines.push(`client too slow x${r.too_slow.count}`);
              } else if (r.too_slow?.checked) {
                lines.push("no client too slow in log");
              }
              if (r.codec) lines.push(`${t("set.codecCurrent", { codec: r.codec })}`);
              if (r.wifi?.advice) lines.push(r.wifi.advice);
              toaster.toast({
                title: t("set.diagStutter"),
                body: lines.join("; ").slice(0, 300) || t("common.none"),
              });
            } catch (e) {
              toaster.toast({ title: t("toast.failed"), body: errMsg(e) });
            }
          }}
          onActivate={async () => {
            try { await api.diagnoseStutter(); } catch { /* ignore */ }
          }}
          style={{
            padding: `${SPACE.md}px ${SPACE.xl}px`,
            borderRadius: RADIUS.md, cursor: "pointer", fontSize: FONT.body,
            background: COLORS.surfaceHover, color: COLORS.text,
          }}
        >{t("set.diagStutter")}</Focusable>
      </Focusable>
      <Hint>
        {t("set.stutterHint")}
      </Hint>

      <SectionTitle>{t("set.focus")}</SectionTitle>
      <Hint>{t("set.focusHint")}</Hint>
      <Focusable flow-children="column" style={{ marginTop: SPACE.md }}>
        {([
          ["coexist", t("set.focusCoexist"), t("set.focusCoexistDesc")],
          ["receiver_first", t("set.focusReceiver"), t("set.focusReceiverDesc")],
          ["manual", t("set.focusManual"), t("set.focusManualDesc")],
        ] as [string, string, string][]).map(([mode, label, desc]) => {
          const active = (s.focus_mode || "coexist") === mode;
          return (
            <Focusable
              key={mode}
              onClick={() => changeFocus(mode)}
              onActivate={() => changeFocus(mode)}
              style={{
                display: "flex", alignItems: "center", gap: 12, padding: `${SPACE.lg}px ${SPACE.xl}px`, marginBottom: SPACE.md,
                borderRadius: RADIUS.sm, cursor: "pointer",
                background: active ? "rgba(76,154,255,0.13)" : "rgba(255,255,255,0.045)",
                border: `1px solid ${active ? "rgba(76,154,255,0.4)" : COLORS.border}`,
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
                <div style={{ fontSize: FONT.bodyLg, color: COLORS.text }}>{label}</div>
                <div style={{ fontSize: FONT.small, color: COLORS.dim, marginTop: 2 }}>{desc}</div>
              </div>
            </Focusable>
          );
        })}
      </Focusable>

      <SectionTitle>{t("set.power")}</SectionTitle>
      <Hint>{t("set.powerHint")}</Hint>
      <div style={{ marginTop: SPACE.md }}>
        <div style={{ fontSize: FONT.bodyLg, color: COLORS.text, marginBottom: SPACE.sm }}>
          {t("set.silence")}
          {state.silence?.enabled && state.silence.was_active && state.silence.remaining !== null
            ? t("set.silenceRemain", { n: state.silence.remaining })
            : ""}
        </div>
        <SliderField
          value={s.silence_disconnect ?? 0}
          min={0}
          max={600}
          step={30}
          showValue={false}
          onChange={(v) => { setSilence(v); }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: FONT.small, color: COLORS.dim }}>
          <span>{t("set.silenceOff")}</span><span>5m</span><span>10m</span>
        </div>
      </div>

      <SectionTitle>{t("set.normalize")}</SectionTitle>
      <Hint>
        {t("set.normalizeHint", { base: state.normalize?.baseline != null ? Math.round(state.normalize.baseline * 100) + "%" : t("set.normUnset") })}
        {state.normalize?.jumps ? t("set.normJumps", { n: state.normalize.jumps }) : ""}
      </Hint>
      <Focusable flow-children="row" style={{ display: "flex", gap: SPACE.md, marginTop: SPACE.md }}>
        <Focusable
          onClick={async () => {
            try {
              await api.setVolumeBaseline(state.live?.volume ?? state.volume.volume);
              toaster.toast({ title: t("set.setBaseline"), body: "" });
              refresh();
            } catch (e) {
              toaster.toast({ title: t("toast.saveFailed"), body: errMsg(e) });
            }
          }}
          onActivate={async () => {
            try {
              await api.setVolumeBaseline(state.live?.volume ?? state.volume.volume);
              refresh();
            } catch { /* ignore */ }
          }}
          style={{ padding: `${SPACE.md}px ${SPACE.xl}px`, borderRadius: RADIUS.md, background: "rgba(255,255,255,0.08)", color: COLORS.text, fontSize: FONT.body, cursor: "pointer" }}
        >{t("set.setBaseline")}</Focusable>
        <Focusable
          onClick={async () => {
            try { await api.resetVolumeBaseline(); refresh(); } catch { /* ignore */ }
          }}
          onActivate={async () => {
            try { await api.resetVolumeBaseline(); refresh(); } catch { /* ignore */ }
          }}
          style={{ padding: `${SPACE.md}px ${SPACE.xl}px`, borderRadius: RADIUS.md, background: "rgba(255,255,255,0.08)", color: COLORS.sub, fontSize: FONT.body, cursor: "pointer" }}
        >{t("set.resetBaseline")}</Focusable>
      </Focusable>

      <SectionTitle>{t("set.behavior")}</SectionTitle>
      <Hint>{t("set.latencyHint")}</Hint>
      <Focusable flow-children="row" style={{ display: "flex", gap: SPACE.md, marginTop: 8, flexWrap: "wrap" }}>
        {(state.output?.latency_profiles || []).map((p: LatencyProfile) => {
          const active = (s.latency_profile || "balanced") === p.key;
          return (
            <Focusable
              key={p.key}
              onClick={async () => {
                try {
                  await api.setLatencyProfile(p.key);
                  toaster.toast({ title: p.label, body: "" });
                  setTimeout(refresh, 1200);
                } catch (e) {
                  toaster.toast({ title: t("toast.switchFailed"), body: errMsg(e) });
                }
              }}
              onActivate={async () => {
                try { await api.setLatencyProfile(p.key); setTimeout(refresh, 1200); } catch { /* ignore */ }
              }}
              style={{
                flex: "1 1 180px", padding: `${SPACE.lg}px ${SPACE.xl}px`, borderRadius: RADIUS.sm, cursor: "pointer",
                background: active ? "rgba(76,154,255,0.13)" : "rgba(255,255,255,0.045)",
                border: `1px solid ${active ? "rgba(76,154,255,0.4)" : COLORS.border}`,
              }}
            >
              <div style={{ fontSize: FONT.bodyLg, color: COLORS.text }}>{p.label}</div>
              <div style={{ fontSize: FONT.caption, color: COLORS.accent, marginTop: 2 }}>~{p.latency_ms}ms</div>
              <div style={{ fontSize: FONT.caption, color: COLORS.dim, marginTop: 3, lineHeight: 1.4 }}>{p.desc}</div>
            </Focusable>
          );
        })}
      </Focusable>

      <SectionTitle>{t("set.sysinfo")}</SectionTitle>
      <ToggleRow
        label="Deck multi-output"
        desc="Play to speakers + BT headset + wired headset at once."
        checked={!!s.multi_output}
        onChange={async (v) => {
          try {
            await api.setMultiOutput(v);
            toaster.toast({ title: v ? "multi-output on" : "multi-output off", body: "" });
            setTimeout(refresh, 1500);
          } catch (e) {
            toaster.toast({ title: t("toast.failed"), body: errMsg(e) });
          }
        }}
      />
      <Hint>
        {t("set.outputsNow")} {(state.output?.sinks || []).map((k: SinkNode) => k.name).join(" · ") || t("common.reading")}
        <br />
        {t("set.avdtpLimit")}
      </Hint>

      <SectionTitle>{t("set.codecInfo")}</SectionTitle>
      <div style={{ fontSize: FONT.body, color: COLORS.sub, lineHeight: 1.9 }}>
        <div>{t("set.codecActive")}: {state.codec?.codec || t("common.none")}</div>
        <div>Profile：{state.codec?.profile || "—"}</div>
        <div>{t("set.codecRole")}: {state.codec?.role || "—"}</div>
      </div>

      <SectionTitle>{t("set.behavior")}</SectionTitle>
      <ToggleRow
        label={t("set.autoStart")}
        desc={t("set.autoStartDesc")}
        checked={!!s.auto_start}
        onChange={(v) => save("auto_start", v, t("common.ok"))}
      />
      <ToggleRow
        label={t("set.keepAlive")}
        desc={t("set.keepAliveDesc")}
        checked={!!s.keep_alive}
        onChange={(v) => save("keep_alive", v, t("common.ok"))}
      />
      <ToggleRow
        label={t("set.resume")}
        desc={
          state.power?.watching
            ? t("set.resumeDescOn", { backend: state.power.backend })
            : t("set.resumeDescOff")
        }
        checked={!!s.resume_restore}
        onChange={(v) => save("resume_restore", v, t("common.ok"))}
      />
      {state.power?.watching && (
        <Hint>
          {t("set.resumeEvents", { n: state.power.events, last: state.power.last ? (state.power.last[0] === "sleep" ? "sleep" : "resume") : "-" })}
          {s.last_device ? t("set.lastDevice", { mac: s.last_device }) : ""}
        </Hint>
      )}

      <SectionTitle>{t("set.sysinfo")}</SectionTitle>
      <div style={{ fontSize: FONT.body, color: COLORS.sub, lineHeight: 1.9 }}>
        <div>PipeWire：{state.versions?.pipewire || t("common.unknown")}</div>
        <div>WirePlumber：{state.versions?.wireplumber || t("common.unknown")}</div>
        <div>BlueZ：{state.versions?.bluez || t("common.unknown")}</div>
        <div>{t("set.defaultOutput")}: {state.sink || t("common.unknown")}</div>
      </div>
    </div>
  );
}
