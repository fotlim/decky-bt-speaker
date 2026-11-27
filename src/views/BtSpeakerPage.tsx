import { useEffect, useState } from "react";
import { Focusable, SliderField } from "@decky/ui";
import { toaster } from "@decky/api";
import { api } from "../backend";
import { useSpeaker } from "../store";
import { COLORS } from "../route";
import { Pill, ErrorText, Hint, Avatar, SectionTitle, Loading, Card } from "../components";
import { t } from "../i18n";

type Tab = "devices" | "settings" | "eq" | "diag";

export function BtSpeakerPage() {
  const { state, error, refresh } = useSpeaker();
  const [tab, setTab] = useState<Tab>("devices");
  const [busyMac, setBusyMac] = useState<string | null>(null);

  const ad = state?.adapter;
  const paired = state?.paired || [];
  const connectedMacs = new Set((state?.connected || []).map((d) => d.mac));

  const act = async (mac: string, action: "connect" | "disconnect" | "remove" | "repair", label: string) => {
    if (busyMac) return;
    setBusyMac(mac);
    try {
      if (action === "repair") {
        await api.repairDevice(mac);
      } else {
        await api.deviceAction(mac, action);
      }
      toaster.toast({ title: label, body: "" });
      setTimeout(refresh, 800);
    } catch (e: any) {
      toaster.toast({ title: t("toast.failed"), body: e?.message || String(e) });
    } finally {
      setBusyMac(null);
    }
  };

  return (
    // 外层：铺满屏幕，负责给 Steam 的顶栏 / 底栏让位。
    // Steam 游戏模式顶部有状态栏（电量/时间），底部有 A/B 按钮提示条，
    // 全屏路由页如果直接用 inset:0 会被两头遮住。
    // 用 padding 而非 margin，保证背景色仍然铺满整屏。
    <div style={{
      position: "absolute", inset: 0, background: COLORS.bg,
      paddingTop: "calc(env(safe-area-inset-top, 0px) + 58px)",
      paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 62px)",
      paddingLeft: "calc(env(safe-area-inset-left, 0px) + 34px)",
      paddingRight: "calc(env(safe-area-inset-right, 0px) + 34px)",
      display: "flex", flexDirection: "column",
      boxSizing: "border-box",
    }}>
      {/* 内层：真正的滚动容器，滚动条只在内层出现 */}
      <div style={{
        flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden",
        display: "flex", flexDirection: "column",
        // 给滚动到底时留一点余量，最后一项不至于贴边
        paddingBottom: 16,
      }}>
      {/* 头部 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <div>
          <div style={{ fontSize: 26, fontWeight: 700, color: COLORS.text }}>{t("page.title")}</div>
          <div style={{ fontSize: 13, color: COLORS.sub, marginTop: 3 }}>
            {ad ? `${ad.alias} · ${ad.address || t("common.unknown")}` : t("page.readingAdapter")}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {ad?.powered ? <Pill tone="ok">{t("qam.btOn")}</Pill> : <Pill tone="warn">{t("qam.btOff")}</Pill>}
          {ad?.discoverable ? <Pill tone="accent">{t("qam.discoverable")}</Pill> : <Pill>{t("qam.notVisible")}</Pill>}
          {ad?.a2dp_sink ? <Pill tone="ok">{t("page.a2dpSink")}</Pill> : <Pill tone="warn">{t("page.noSink")}</Pill>}
        </div>
      </div>

      {error && <ErrorText text={error} />}

      {/* Tab 切换 */}
      <Focusable flow-children="row" style={{ display: "flex", gap: 10, margin: "14px 0 4px" }}>
        {([
          ["devices", t("tab.devices")],
          ["settings", t("tab.settings")],
          ["eq", t("tab.eq")],
          ["diag", t("tab.diag")],
        ] as [Tab, string][]).map(([k, label]) => (
          <Focusable
            key={k}
            onActivate={() => setTab(k)}
            onClick={() => setTab(k)}
            style={{
              padding: "7px 16px", borderRadius: 18, cursor: "pointer", fontSize: 13.5,
              background: tab === k ? COLORS.accent : "rgba(255,255,255,0.06)",
              color: tab === k ? "#fff" : COLORS.sub,
            }}
          >{label}</Focusable>
        ))}
      </Focusable>

      {!state ? <Loading /> : (
        <>
          {tab === "devices" && (
            <DevicesTab
              paired={paired}
              connectedMacs={connectedMacs}
              busyMac={busyMac}
              onAction={act}
              discoverable={!!ad?.discoverable}
              alias={ad?.alias || ""}
            />
          )}
          {tab === "settings" && <SettingsTab state={state} refresh={refresh} />}
          {tab === "eq" && <EqTab state={state} refresh={refresh} />}
          {tab === "diag" && <DiagTab />}
        </>
      )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
function DevicesTab({
  paired, connectedMacs, busyMac, onAction, discoverable, alias,
}: {
  paired: { mac: string; name: string; display?: string; has_real_name?: boolean; icon?: string }[];
  connectedMacs: Set<string>;
  busyMac: string | null;
  onAction: (mac: string, action: "connect" | "disconnect" | "remove" | "repair", label: string) => void;
  discoverable: boolean;
  alias: string;
}) {
  if (!paired.length) {
    return (
      <div style={{ marginTop: 16 }}>
        <ScanPanel alias={alias} discoverable={discoverable} onPaired={() => onAction("", "connect", "")} />
        <Hint>
          {t("dev.noDevices")}
        </Hint>
      </div>
    );
  }
  return (
    <div style={{ marginTop: 16 }}>
      <ScanPanel alias={alias} discoverable={discoverable} onPaired={() => onAction("", "connect", "")} />

      <SectionTitle>{t("dev.pairedCount", { n: paired.length })}</SectionTitle>
      <Focusable flow-children="column">
        {paired.map((d) => {
          const connected = connectedMacs.has(d.mac);
          const busy = busyMac === d.mac;
          return (
            <div key={d.mac} style={{
              display: "flex", alignItems: "center", gap: 14, padding: "12px 14px", marginBottom: 8,
              borderRadius: 11, background: "rgba(255,255,255,0.045)", border: `1px solid ${COLORS.border}`,
            }}>
              <Avatar connected={connected} icon={(d as any).icon} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, color: COLORS.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {(d as any).display || d.name}
                </div>
                <div style={{ fontSize: 12, color: COLORS.dim, marginTop: 2 }}>
                  {d.mac}
                  {d.has_real_name === false && (
                    <span style={{ marginLeft: 6, color: "#e0a800" }}>· {t("dev.noName")}</span>
                  )}
                </div>
              </div>
              {connected ? <Pill tone="ok">{t("dev.connected")}</Pill> : <Pill>{t("dev.notConnected")}</Pill>}
              <Focusable
                onClick={() => onAction(d.mac, connected ? "disconnect" : "connect", connected ? t("dev.disconnected") : t("dev.connecting"))}
                onActivate={() => onAction(d.mac, connected ? "disconnect" : "connect", connected ? t("dev.disconnected") : t("dev.connecting"))}
                style={{
                  padding: "7px 16px", borderRadius: 18, fontSize: 13, cursor: busy ? "default" : "pointer",
                  background: connected ? "rgba(255,255,255,0.08)" : COLORS.accent,
                  color: connected ? COLORS.sub : "#fff", opacity: busy ? 0.5 : 1,
                }}
              >{busy ? "…" : connected ? t("qam.disconnect") : t("dev.connect")}</Focusable>
              <Focusable
                onClick={() => onAction(d.mac, "repair", t("dev.repairing"))}
                onActivate={() => onAction(d.mac, "repair", t("dev.repairing"))}
                style={{
                  padding: "7px 14px", borderRadius: 18, fontSize: 13, cursor: "pointer",
                  background: "rgba(76,154,255,0.16)", color: COLORS.accent,
                }}
              >{t("dev.repair")}</Focusable>
              <Focusable
                onClick={() => onAction(d.mac, "remove", t("dev.removed"))}
                onActivate={() => onAction(d.mac, "remove", t("dev.removed"))}
                style={{
                  padding: "7px 14px", borderRadius: 18, fontSize: 13, cursor: "pointer",
                  background: "rgba(236,65,65,0.14)", color: COLORS.accentWarm,
                }}
              >{t("common.remove")}</Focusable>
            </div>
          );
        })}
      </Focusable>
      <Hint>
        {t("dev.hint")}
        <br />
        <b style={{ color: COLORS.sub }}>{t("dev.hintPair")}</b>
      </Hint>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 扫描面板：在插件内完成「搜索 → 配对」，不用跳系统蓝牙设置
// ---------------------------------------------------------------------------
function ScanPanel({ alias, discoverable, onPaired }: {
  alias: string; discoverable: boolean; onPaired: () => void;
}) {
  const [scanning, setScanning] = useState(false);
  const [devices, setDevices] = useState<any[]>([]);
  const [scanned, setScanned] = useState(false);
  const [busyMac, setBusyMac] = useState<string | null>(null);

  const scan = async () => {
    if (scanning) return;
    setScanning(true);
    setScanned(false);
    try {
      const r = await api.scanDevices(20);
      setDevices(r.devices || []);
      setScanned(true);
      if (!r.devices || !r.devices.length) {
        toaster.toast({
          title: t("dev.noneFound"),
          body: t("dev.noneFound"),
        });
      }
    } catch (e: any) {
      toaster.toast({ title: t("toast.failed"), body: e?.message || String(e) });
    } finally {
      setScanning(false);
    }
  };

  const pair = async (mac: string, name: string) => {
    if (busyMac) return;
    setBusyMac(mac);
    try {
      await api.pairDeviceFull(mac);
      toaster.toast({ title: t("dev.paired", { name }), body: "" });
      setDevices((prev) => prev.filter((d) => d.mac !== mac));
      onPaired();
    } catch (e: any) {
      toaster.toast({ title: t("dev.pairFailed"), body: e?.message || String(e) });
    } finally {
      setBusyMac(null);
    }
  };

  return (
    <div style={{ marginBottom: 8 }}>
      <SectionTitle>{t("dev.search")}</SectionTitle>
      <Hint>
        {discoverable
          ? t("dev.searchHint")
          : t("dev.searchHintWarn")}
      </Hint>
      <Focusable
        onClick={scan}
        onActivate={scan}
        style={{
          display: "inline-flex", alignItems: "center", gap: 8, marginTop: 8,
          padding: "9px 18px", borderRadius: 18, cursor: scanning ? "default" : "pointer",
          background: scanning ? "rgba(255,255,255,0.06)" : COLORS.accent,
          color: scanning ? COLORS.sub : "#fff", fontSize: 13.5,
        }}
      >
        {scanning ? t("dev.searching") : t("dev.search")}
      </Focusable>

      {devices.length > 0 && (
        <Focusable flow-children="column" style={{ marginTop: 12 }}>
          {devices.map((d) => {
            const busy = busyMac === d.mac;
            const isPhone = (d.icon || "").includes("phone");
            const isComputer = (d.icon || "").includes("computer");
            return (
              <div key={d.mac} style={{
                display: "flex", alignItems: "center", gap: 14, padding: "12px 14px", marginBottom: 8,
                borderRadius: 11, background: "rgba(255,255,255,0.045)", border: `1px solid ${COLORS.border}`,
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 20, flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
                  background: "rgba(255,255,255,0.06)", border: `1px solid ${COLORS.border}`,
                }}>{isPhone ? "📱" : isComputer ? "💻" : "🔊"}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, color: COLORS.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {d.display || d.name}
                  </div>
                  <div style={{ fontSize: 12, color: COLORS.dim, marginTop: 2 }}>
                    {d.mac}
                    {d.has_real_name === false && (
                      <span style={{ marginLeft: 6, color: "#e0a800" }}>· {t("dev.noName")}</span>
                    )}
                  </div>
                </div>
                <Focusable
                  onClick={() => pair(d.mac, d.display || d.name)}
                  onActivate={() => pair(d.mac, d.display || d.name)}
                  style={{
                    padding: "7px 18px", borderRadius: 18, fontSize: 13, flexShrink: 0,
                    cursor: busy ? "default" : "pointer",
                    background: busy ? "rgba(255,255,255,0.08)" : COLORS.accent,
                    color: busy ? COLORS.sub : "#fff",
                  }}
                >{busy ? t("dev.pairing") : t("dev.pair")}</Focusable>
              </div>
            );
          })}
        </Focusable>
      )}

      {scanned && devices.length === 0 && (
        <Hint>
          {t("dev.noneFound")}
        </Hint>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
function SettingsTab({ state, refresh }: { state: any; refresh: () => void }) {
  const [alias, setAlias] = useState(state.adapter?.alias || "");
  const [busy, setBusy] = useState(false);
  const s = state.settings || {};

  useEffect(() => { setAlias(state.adapter?.alias || ""); }, [state.adapter?.alias]);

  const save = async (key: string, value: any, label: string) => {
    try {
      await api.setSetting(key, value);
      toaster.toast({ title: label, body: "" });
    } catch (e: any) {
      toaster.toast({ title: t("toast.saveFailed"), body: e?.message || String(e) });
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
    } catch (e: any) {
      toaster.toast({ title: t("toast.switchFailed"), body: e?.message || String(e) });
    }
  };

  const setSilence = async (sec: number) => {
    try {
      await api.setSilenceTimeout(sec);
      refresh();
    } catch (e: any) {
      toaster.toast({ title: t("toast.saveFailed"), body: e?.message || String(e) });
    }
  };

  const applyAlias = async () => {
    const v = alias.trim();
    if (!v || busy) return;
    setBusy(true);
    try {
      await api.setAlias(v);
      toaster.toast({ title: t("toast.nameChanged", { name: v }), body: "" });
    } catch (e: any) {
      toaster.toast({ title: t("toast.renameFailed"), body: e?.message || String(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ marginTop: 16, maxWidth: 720 }}>
      <SectionTitle>{t("set.name")}</SectionTitle>
      <Hint>{t("set.nameHint")}</Hint>
      <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
        <input
          value={alias}
          onChange={(e) => setAlias(e.target.value)}
          maxLength={40}
          placeholder="Steam Deck"
          style={{
            flex: 1, padding: "10px 12px", borderRadius: 9, fontSize: 14,
            background: "rgba(255,255,255,0.06)", border: `1px solid ${COLORS.border}`,
            color: COLORS.text, outline: "none",
          }}
        />
        <Focusable
          onClick={applyAlias}
          onActivate={applyAlias}
          style={{
            padding: "10px 20px", borderRadius: 9, fontSize: 14, cursor: "pointer",
            background: COLORS.accent, color: "#fff", opacity: busy ? 0.6 : 1,
          }}
        >{busy ? t("common.saving") : t("common.save")}</Focusable>
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
          } catch (e: any) {
            toaster.toast({ title: t("toast.failed"), body: e?.message || String(e) });
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
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
        <div style={{
          width: 8, height: 8, borderRadius: 4, flexShrink: 0,
          background: state.agent_registered ? COLORS.ok : state.agent ? "#e0a800" : COLORS.accentWarm,
        }} />
        <div style={{ flex: 1, fontSize: 13, color: COLORS.text }}>
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
            } catch (e: any) {
              toaster.toast({ title: t("toast.failed"), body: e?.message || String(e) });
            }
          }}
          onActivate={async () => {
            try { await api.restartAgent(); setTimeout(refresh, 800); } catch { /* ignore */ }
          }}
          style={{
            padding: "7px 14px", borderRadius: 16, fontSize: 12.5, cursor: "pointer",
            background: "rgba(255,255,255,0.08)", color: COLORS.text, flexShrink: 0,
          }}
        >{t("set.restartAgent")}</Focusable>
      </div>

      <SectionTitle>{t("set.codec")}</SectionTitle>
      <Hint>
        {t("set.codecHint")}
      </Hint>
      <Focusable flow-children="column" style={{ marginTop: 8 }}>
        {(state.quality?.presets || []).map((p: any) => {
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
                } catch (e: any) {
                  toaster.toast({ title: t("toast.switchFailed"), body: e?.message || String(e) });
                }
              }}
              onActivate={async () => {
                try { await api.setCodecPreset(p.key); setTimeout(refresh, 1500); } catch { /* ignore */ }
              }}
              style={{
                display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", marginBottom: 8,
                borderRadius: 10, cursor: "pointer",
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
                <div style={{ fontSize: 14, color: COLORS.text }}>{p.label}</div>
                <div style={{ fontSize: 11.5, color: COLORS.dim, marginTop: 2 }}>{p.desc}</div>
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
          margin: "6px 0 10px", padding: "10px 12px", borderRadius: 9, fontSize: 12, lineHeight: 1.7,
          background: "rgba(236,65,65,0.10)", border: "1px solid rgba(236,65,65,0.28)",
          color: "#ffb3b3", whiteSpace: "pre-wrap",
        }}>
          <b>⚠️ {t("set.stutterWifi")}</b>
          {"\n"}
          {state.wifi.wifi_24g.map((w: any) =>
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

      <Focusable flow-children="row" style={{ display: "flex", gap: 10, marginTop: 8 }}>
        <Focusable
          onClick={async () => {
            try {
              const r = await api.fixStutter();
              toaster.toast({
                title: t("set.fixStutter"),
                body: (r.applied || []).join("、"),
              });
              setTimeout(refresh, 1500);
            } catch (e: any) {
              toaster.toast({ title: t("toast.failed"), body: e?.message || String(e) });
            }
          }}
          onActivate={async () => {
            try { await api.fixStutter(); setTimeout(refresh, 1500); } catch { /* ignore */ }
          }}
          style={{
            padding: "9px 18px", borderRadius: 18, cursor: "pointer", fontSize: 13,
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
            } catch (e: any) {
              toaster.toast({ title: t("toast.failed"), body: e?.message || String(e) });
            }
          }}
          onActivate={async () => {
            try { await api.diagnoseStutter(); } catch { /* ignore */ }
          }}
          style={{
            padding: "9px 18px", borderRadius: 18, cursor: "pointer", fontSize: 13,
            background: "rgba(255,255,255,0.08)", color: COLORS.text,
          }}
        >{t("set.diagStutter")}</Focusable>
      </Focusable>
      <Hint>
        {t("set.stutterHint")}
      </Hint>

      <SectionTitle>{t("set.focus")}</SectionTitle>
      <Hint>{t("set.focusHint")}</Hint>
      <Focusable flow-children="column" style={{ marginTop: 8 }}>
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
                display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", marginBottom: 8,
                borderRadius: 10, cursor: "pointer",
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
                <div style={{ fontSize: 14, color: COLORS.text }}>{label}</div>
                <div style={{ fontSize: 11.5, color: COLORS.dim, marginTop: 2 }}>{desc}</div>
              </div>
            </Focusable>
          );
        })}
      </Focusable>

      <SectionTitle>{t("set.power")}</SectionTitle>
      <Hint>{t("set.powerHint")}</Hint>
      <div style={{ marginTop: 8 }}>
        <div style={{ fontSize: 13.5, color: COLORS.text, marginBottom: 6 }}>
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
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: COLORS.dim }}>
          <span>{t("set.silenceOff")}</span><span>5m</span><span>10m</span>
        </div>
      </div>

      <SectionTitle>{t("set.normalize")}</SectionTitle>
      <Hint>
        {t("set.normalizeHint", { base: state.normalize?.baseline != null ? Math.round(state.normalize.baseline * 100) + "%" : t("set.normUnset") })}
        {state.normalize?.jumps ? t("set.normJumps", { n: state.normalize.jumps }) : ""}
      </Hint>
      <Focusable flow-children="row" style={{ display: "flex", gap: 10, marginTop: 8 }}>
        <Focusable
          onClick={async () => {
            try {
              await api.setVolumeBaseline(state.live?.volume ?? state.volume.volume);
              toaster.toast({ title: t("set.setBaseline"), body: "" });
              refresh();
            } catch (e: any) {
              toaster.toast({ title: t("toast.saveFailed"), body: e?.message || String(e) });
            }
          }}
          onActivate={async () => {
            try {
              await api.setVolumeBaseline(state.live?.volume ?? state.volume.volume);
              refresh();
            } catch { /* ignore */ }
          }}
          style={{ padding: "8px 16px", borderRadius: 18, background: "rgba(255,255,255,0.08)", color: COLORS.text, fontSize: 13, cursor: "pointer" }}
        >{t("set.setBaseline")}</Focusable>
        <Focusable
          onClick={async () => {
            try { await api.resetVolumeBaseline(); refresh(); } catch { /* ignore */ }
          }}
          onActivate={async () => {
            try { await api.resetVolumeBaseline(); refresh(); } catch { /* ignore */ }
          }}
          style={{ padding: "8px 16px", borderRadius: 18, background: "rgba(255,255,255,0.08)", color: COLORS.sub, fontSize: 13, cursor: "pointer" }}
        >{t("set.resetBaseline")}</Focusable>
      </Focusable>

      <SectionTitle>{t("set.behavior")}</SectionTitle>
      <Hint>蓝牙 A2DP 的延迟取决于编码器与缓冲。这里是「省电 / 低延迟 / 抗卡顿」的取舍。</Hint>
      <Focusable flow-children="row" style={{ display: "flex", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
        {(state.output?.latency_profiles || []).map((p: any) => {
          const active = (s.latency_profile || "balanced") === p.key;
          return (
            <Focusable
              key={p.key}
              onClick={async () => {
                try {
                  await api.setLatencyProfile(p.key);
                  toaster.toast({ title: `${p.label}`, body: "WirePlumber 已重启" });
                  setTimeout(refresh, 1200);
                } catch (e: any) {
                  toaster.toast({ title: t("toast.switchFailed"), body: e?.message || String(e) });
                }
              }}
              onActivate={async () => {
                try { await api.setLatencyProfile(p.key); setTimeout(refresh, 1200); } catch { /* ignore */ }
              }}
              style={{
                flex: "1 1 180px", padding: "11px 14px", borderRadius: 10, cursor: "pointer",
                background: active ? "rgba(76,154,255,0.13)" : "rgba(255,255,255,0.045)",
                border: `1px solid ${active ? "rgba(76,154,255,0.4)" : COLORS.border}`,
              }}
            >
              <div style={{ fontSize: 13.5, color: COLORS.text }}>{p.label}</div>
              <div style={{ fontSize: 11, color: COLORS.accent, marginTop: 2 }}>~{p.latency_ms}ms</div>
              <div style={{ fontSize: 11, color: COLORS.dim, marginTop: 3, lineHeight: 1.4 }}>{p.desc}</div>
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
          } catch (e: any) {
            toaster.toast({ title: t("toast.failed"), body: e?.message || String(e) });
          }
        }}
      />
      <Hint>
        当前输出设备：{(state.output?.sinks || []).map((k: any) => k.name).join(" · ") || "读取中…"}
        <br />
        ⚠️ 反方向做不到：受 AVDTP 协议限制（v1.3 §5.3），同一适配器同一时刻只能有一个蓝牙 A2DP 源设备连进来。
      </Hint>

      <SectionTitle>编码器</SectionTitle>
      <div style={{ fontSize: 13, color: COLORS.sub, lineHeight: 1.9 }}>
        <div>当前编码：{state.codec?.codec || "未连接"}</div>
        <div>Profile：{state.codec?.profile || "—"}</div>
        <div>方向：{state.codec?.role || "—"}</div>
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
      <div style={{ fontSize: 13, color: COLORS.sub, lineHeight: 1.9 }}>
        <div>PipeWire：{state.versions?.pipewire || t("common.unknown")}</div>
        <div>WirePlumber：{state.versions?.wireplumber || t("common.unknown")}</div>
        <div>BlueZ：{state.versions?.bluez || t("common.unknown")}</div>
        <div>默认输出：{state.sink || t("common.unknown")}</div>
      </div>
    </div>
  );
}

function ToggleRow({ label, desc, checked, onChange }: { label: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <Focusable
      onClick={() => onChange(!checked)}
      onActivate={() => onChange(!checked)}
      style={{
        display: "flex", alignItems: "center", gap: 14, padding: "12px 14px", marginBottom: 8,
        borderRadius: 11, background: "rgba(255,255,255,0.045)", border: `1px solid ${COLORS.border}`,
        cursor: "pointer",
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14.5, color: COLORS.text }}>{label}</div>
        <div style={{ fontSize: 12, color: COLORS.dim, marginTop: 3, lineHeight: 1.5 }}>{desc}</div>
      </div>
      <div style={{
        width: 42, height: 24, borderRadius: 12, flexShrink: 0, position: "relative",
        background: checked ? COLORS.accent : "rgba(255,255,255,0.14)", transition: "background .15s",
      }}>
        <div style={{
          position: "absolute", top: 3, left: checked ? 21 : 3, width: 18, height: 18, borderRadius: 9,
          background: "#fff", transition: "left .15s",
        }} />
      </div>
    </Focusable>
  );
}

// ---------------------------------------------------------------------------
function EqTab({ state, refresh }: { state: any; refresh: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [importText, setImportText] = useState("");
  const [showImport, setShowImport] = useState(false);
  const presets: any[] = state.eq?.presets || [];
  const current = state.eq?.preset || "flat";

  const apply = async (key: string) => {
    if (busy) return;
    setBusy(key);
    try {
      await api.setEqPreset(key);
      toaster.toast({ title: t("eq.applied"), body: t("eq.appliedBody") });
      setTimeout(refresh, 1500);
    } catch (e: any) {
      toaster.toast({ title: t("toast.switchFailed"), body: e?.message || String(e) });
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
    } catch (e: any) {
      toaster.toast({ title: t("toast.failed"), body: e?.message || String(e) });
    } finally {
      setBusy(null);
    }
  };

  const box: any = {
    marginTop: 8, padding: 10, borderRadius: 9, width: "100%", minHeight: 120,
    fontSize: 12, color: COLORS.text, fontFamily: "monospace",
    background: "rgba(0,0,0,0.35)", border: `1px solid ${COLORS.border}`,
    outline: "none", resize: "vertical" as any,
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
        从 <span style={{ color: COLORS.sub }}>AutoEq</span> 或 <span style={{ color: COLORS.sub }}>squig.link</span> 复制
        ParametricEQ.txt 的内容粘进来。格式形如 `Filter 1: ON PK Fc 21 Hz Gain 6.7 dB Q 1.100`。
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
              } catch (e: any) {
                toaster.toast({ title: t("toast.failed"), body: e?.message || String(e) });
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
        配置文件：<span style={{ color: COLORS.sub }}>{state.eq?.path || "~/.config/pipewire/pipewire.conf.d/60-bt-speaker-eq.conf"}</span>
      </Hint>
    </div>
  );
}

// ---------------------------------------------------------------------------
function DiagTab() {
  const [data, setData] = useState<any>(null);
  const [log, setLog] = useState<{ path: string; text: string } | null>(null);
  const [report, setReport] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setData(await api.diagnose());
    } catch (e: any) {
      toaster.toast({ title: t("toast.failed"), body: e?.message || String(e) });
    } finally {
      setLoading(false);
    }
  };

  const loadLog = async () => {
    try {
      setLog(await api.getLog(200));
    } catch (e: any) {
      toaster.toast({ title: t("toast.failed"), body: e?.message || String(e) });
    }
  };

  useEffect(() => { load(); }, []);

  const box: any = {
    marginTop: 10, padding: 12, borderRadius: 9, background: "rgba(0,0,0,0.35)",
    fontSize: 11.5, color: COLORS.sub, fontFamily: "monospace", whiteSpace: "pre-wrap",
    maxHeight: 340, overflowY: "auto", lineHeight: 1.55, border: `1px solid ${COLORS.border}`,
  };

  return (
    <div style={{ marginTop: 16 }}>
      <Focusable flow-children="row" style={{ display: "flex", gap: 10 }}>
        <Focusable onClick={load} onActivate={load} style={{ padding: "8px 16px", borderRadius: 18, background: "rgba(255,255,255,0.08)", color: COLORS.text, fontSize: 13, cursor: "pointer" }}>
          {loading ? t("common.reading") : t("common.retry")}
        </Focusable>
        <Focusable onClick={loadLog} onActivate={loadLog} style={{ padding: "8px 16px", borderRadius: 18, background: "rgba(255,255,255,0.08)", color: COLORS.text, fontSize: 13, cursor: "pointer" }}>
          {t("diag.viewLog")}
        </Focusable>
        <Focusable
          onClick={async () => {
            try {
              const r = await api.report();
              setReport(r.text);
              try {
                await navigator.clipboard.writeText(r.text);
                toaster.toast({ title: t("diag.copied"), body: t("diag.copiedBody") });
              } catch {
                toaster.toast({ title: t("diag.generated"), body: t("diag.generatedBody") });
              }
            } catch (e: any) {
              toaster.toast({ title: t("toast.failed"), body: e?.message || String(e) });
            }
          }}
          onActivate={async () => {
            try { const r = await api.report(); setReport(r.text); } catch { /* ignore */ }
          }}
          style={{ padding: "8px 16px", borderRadius: 18, background: "rgba(76,154,255,0.18)", color: COLORS.accent, fontSize: 13, cursor: "pointer" }}
        >{t("diag.copy")}</Focusable>
      </Focusable>

      {report && (
        <>
          <SectionTitle>{t("diag.report")}</SectionTitle>
          <div style={box}>{report}</div>
        </>
      )}

      {data && (
        <>
          <SectionTitle>{t("diag.checks")}</SectionTitle>
          <Focusable flow-children="column" style={{ marginTop: 8 }}>
            {(data.checks || []).map((c: any, i: number) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", marginBottom: 6,
                borderRadius: 8, fontSize: 13,
                background: c.ok ? "rgba(76,195,138,0.07)" : "rgba(236,65,65,0.10)",
                border: `1px solid ${c.ok ? "rgba(76,195,138,0.2)" : "rgba(236,65,65,0.3)"}`,
              }}>
                <span style={{ color: c.ok ? COLORS.ok : COLORS.accentWarm, flexShrink: 0 }}>
                  {c.ok ? "✓" : "✕"}
                </span>
                <span style={{ flex: 1, color: COLORS.text }}>{c.name}</span>
                {c.detail && <span style={{ fontSize: 11, color: COLORS.dim }}>{c.detail}</span>}
              </div>
            ))}
          </Focusable>

          <SectionTitle>{t("diag.modules")}</SectionTitle>
          <div style={{ fontSize: 13, color: COLORS.sub, lineHeight: 1.9 }}>
            {Object.entries(data.modules || {}).map(([k, v]: any) => (
              <div key={k}>{v ? "✅" : "❌"} {k}.py</div>
            ))}
          </div>

          <SectionTitle>{t("diag.tools")}</SectionTitle>
          <div style={{ fontSize: 13, color: COLORS.sub, lineHeight: 1.9 }}>
            {Object.entries(data.tools || {}).map(([k, v]: any) => (
              <div key={k}>{v ? "✅" : "❌"} {k}</div>
            ))}
            <div>{data.agent ? "✅" : "❌"} {t("diag.agent")}</div>
          </div>

          <SectionTitle>{t("diag.adapterRaw")}</SectionTitle>
          <div style={box}>{data.adapter_raw || "（空）"}</div>

          <SectionTitle>{t("diag.wpStatus")}</SectionTitle>
          <div style={box}>{data.wp_status || "（空）"}</div>
        </>
      )}

      {log && (
        <>
          <SectionTitle right={<span style={{ fontSize: 11, color: COLORS.dim }}>{log.path}</span>}>{t("diag.pluginLog")}</SectionTitle>
          <div style={box}>{log.text || "（空）"}</div>
        </>
      )}
    </div>
  );
}
