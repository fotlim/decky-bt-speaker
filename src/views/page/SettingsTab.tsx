import { useEffect, useRef, useState } from "react";
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
  const aliasRef = useRef<HTMLInputElement | null>(null);
  /** 滑杆拖动中的临时值；null = 用后端真实值。避免拖动时每格都打后端。 */
  const [silenceDraft, setSilenceDraft] = useState<number | null>(null);
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
  /**
   * 滑杆防抖：拖动过程中连续触发，只在停手 400ms 后提交一次。
   * 定时器存在 ref 里，卸载时清掉（避免切 tab 后还打后端）。
   */
  const silenceTimer = useRef<any>(null);
  const scheduleSilence = (sec: number) => {
    if (silenceTimer.current) clearTimeout(silenceTimer.current);
    silenceTimer.current = setTimeout(() => {
      silenceTimer.current = null;
      setSilenceDraft(null);      // 提交后交还给后端真实值
      setSilence(sec);
    }, 400);
  };
  useEffect(() => () => {
    if (silenceTimer.current) clearTimeout(silenceTimer.current);
  }, []);
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
        {/* ⚠️ 必须包 Focusable：Steam 的手柄焦点系统只走 Focusable 树，
            裸 `<input>` 在游戏模式下**根本选不中**，也就唤不起软键盘 ——
            表现就是「改名」这个功能手柄完全用不了（真机反馈过）。 */}
        <Focusable
          onActivate={() => {
            // 手柄 A 键：聚焦输入框并唤起 Steam 软键盘
            try {
              const el = aliasRef.current;
              if (el) { el.focus(); }
            } catch { /* 老版本忽略 */ }
          }}
          style={{ flex: 1, display: "flex" }}
        >
          <input
            ref={aliasRef}
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
        </Focusable>
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
onActivate={async () => {
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
onActivate={async () => {
                try {
                  const r = await api.setCodecPreset(p.key);
                  toaster.toast({
                    title: `${t("set.codec")}: ${t(p.label_key)}`,
                    body: r.active_profile ? `${t("set.codecCurrent", { codec: r.active_profile })}` : "",
                  });
                  setTimeout(refresh, 1500);
                } catch (e) {
                  toaster.toast({ title: t("toast.switchFailed"), body: errMsg(e) });
                }
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
                <div style={{ fontSize: FONT.bodyLg, color: COLORS.text }}>{t(p.label_key)}</div>
                <div style={{ fontSize: FONT.small, color: COLORS.dim, marginTop: 2 }}>{t(p.desc_key)}</div>
              </div>
              <Pill>{t("set.resample", { hz: p.resample })}</Pill>
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
onActivate={async () => {
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
          style={{
            padding: `${SPACE.md}px ${SPACE.xl}px`,
            borderRadius: RADIUS.md, cursor: "pointer", fontSize: FONT.body,
            background: COLORS.accent, color: "#fff",
          }}
        >{t("set.fixStutter")}</Focusable>
        <Focusable
onActivate={async () => {
            try {
              const r = await api.diagnoseStutter();
              const lines = [];
              if (r.too_slow?.count > 0) {
                lines.push(t("set.tooSlow", { n: r.too_slow.count }));
              } else if (r.too_slow?.checked) {
                lines.push(t("set.noTooSlow"));
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
          value={silenceDraft ?? (s.silence_disconnect ?? 0)}
          min={0}
          max={600}
          step={30}
          showValue={false}
          // ⚠️ SliderField 只有 onChange，没有「松手」回调，而它在拖动过程中
          //    会**每一格**触发一次（0~600 / 30 = 21 档）。早期直接在这里
          //    调后端 + refresh()，滑一下就是二十来次 RPC，每次 refresh
          //    又要 fork 一堆命令 —— Deck 上直接卡顿。
          //    现在拖动只更新本地草稿，停手 400ms 后才真正提交一次。
          onChange={(v) => { setSilenceDraft(v); scheduleSilence(v); }}
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
onActivate={async () => {
            try {
              await api.setVolumeBaseline(state.live?.volume ?? state.volume.volume);
              toaster.toast({ title: t("set.setBaseline"), body: "" });
              refresh();
            } catch (e) {
              toaster.toast({ title: t("toast.saveFailed"), body: errMsg(e) });
            }
          }}
          style={{ padding: `${SPACE.md}px ${SPACE.xl}px`, borderRadius: RADIUS.md, background: "rgba(255,255,255,0.08)", color: COLORS.text, fontSize: FONT.body, cursor: "pointer" }}
        >{t("set.setBaseline")}</Focusable>
        <Focusable
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
onActivate={async () => {
                try {
                  await api.setLatencyProfile(p.key);
                  toaster.toast({ title: t(p.label_key), body: "" });
                  setTimeout(refresh, 1200);
                } catch (e) {
                  toaster.toast({ title: t("toast.switchFailed"), body: errMsg(e) });
                }
              }}
              style={{
                flex: "1 1 180px", padding: `${SPACE.lg}px ${SPACE.xl}px`, borderRadius: RADIUS.sm, cursor: "pointer",
                background: active ? "rgba(76,154,255,0.13)" : "rgba(255,255,255,0.045)",
                border: `1px solid ${active ? "rgba(76,154,255,0.4)" : COLORS.border}`,
              }}
            >
              <div style={{ fontSize: FONT.bodyLg, color: COLORS.text }}>{t(p.label_key)}</div>
              <div style={{ fontSize: FONT.caption, color: COLORS.accent, marginTop: 2 }}>~{p.latency_ms}ms</div>
              <div style={{ fontSize: FONT.caption, color: COLORS.dim, marginTop: 3, lineHeight: 1.4 }}>{t(p.desc_key)}</div>
            </Focusable>
          );
        })}
      </Focusable>

      <SectionTitle>{t("set.sysinfo")}</SectionTitle>
      <ToggleRow
        label={t("set.multiOutput")}
        desc={t("set.multiOutputDesc")}
        checked={!!s.multi_output}
        onChange={async (v) => {
          try {
            await api.setMultiOutput(v);
            toaster.toast({ title: v ? t("set.multiOn") : t("set.multiOff"), body: "" });
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
        <div>{t("set.profileLabel", { name: state.codec?.profile || "—" })}</div>
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
        <div>PipeWire: {state.versions?.pipewire || t("common.unknown")}</div>
        <div>WirePlumber: {state.versions?.wireplumber || t("common.unknown")}</div>
        <div>BlueZ: {state.versions?.bluez || t("common.unknown")}</div>
        <div>{t("set.defaultOutput")}: {state.sink || t("common.unknown")}</div>
      </div>
    </div>
  );
}
