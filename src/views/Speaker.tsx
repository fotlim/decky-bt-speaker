import { useEffect, useRef, useState } from "react";
import {
  PanelSection, PanelSectionRow, ButtonItem, ToggleField, SliderField, Navigation, Focusable,
} from "@decky/ui";
import { toaster } from "@decky/api";
import { FaBluetooth, FaVolumeUp, FaVolumeMute, FaMobileAlt, FaLaptop, FaCog } from "react-icons/fa";
import { api } from "../backend";
import { useSpeaker } from "../store";
import { COLORS, ROUTE } from "../route";
import { Pill, ErrorText } from "../components";
import { t } from "../i18n";

export function Speaker() {
  const { state, error } = useSpeaker();
  const [busy, setBusy] = useState(false);
  const [vol, setVol] = useState<number | null>(null);
  // 拖动中标记：拖动期间完全用本地值，防止轮询把滑块拽回去
  const [dragging, setDragging] = useState(false);
  const dragTimer = useRef<any>(null);

  const backendVol = state ? Math.round(state.volume.volume * 100) : 0;

  // 松手后 3 秒内仍用本地值，给后端足够时间回传真实值
  // （后端写 wpctl 是异步的，轮询可能早一步读到旧值）
  useEffect(() => {
    if (vol === null || dragging) return;
    const timer = setTimeout(() => setVol(null), 3000);
    return () => clearTimeout(timer);
  }, [vol, dragging]);

  const ad = state?.adapter;
  const connected = state?.connected || [];
  const showVol = (dragging || vol !== null) ? (vol ?? backendVol) : backendVol;

  const act = async (fn: () => Promise<any>, okMsg?: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      if (okMsg) toaster.toast({ title: okMsg, body: "" });
    } catch (e: any) {
      toaster.toast({ title: t("toast.failed"), body: e?.message || String(e) });
    } finally {
      setBusy(false);
    }
  };

  const toggleDiscoverable = async (on: boolean) => {
    await act(() => api.setDiscoverable(on), on ? t("qam.discoverable") : t("qam.notVisible"));
  };

  const changeVolume = (v: number) => {
    setVol(v);
    setDragging(true);
    // 每次拖动都重置松手定时器
    if (dragTimer.current) clearTimeout(dragTimer.current);
    dragTimer.current = setTimeout(() => {
      setDragging(false);
    }, 600);
    api.setVolume(v / 100).catch(() => {});
  };

  const toggleMute = () => {
    if (!state) return;
    act(() => api.setMute(!state.volume.muted), state.volume.muted ? t("common.ok") : t("common.ok"));
  };

  return (
    <PanelSection>
      {/* 状态摘要 */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "2px 2px 8px" }}>
        <div style={{
          width: 38, height: 38, borderRadius: 19, display: "flex", alignItems: "center", justifyContent: "center",
          background: ad?.discoverable ? "rgba(76,154,255,0.18)" : "rgba(255,255,255,0.06)",
          color: ad?.discoverable ? COLORS.accent : COLORS.dim, flexShrink: 0,
        }}>
          <FaBluetooth size={17} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {ad ? ad.alias : t("plugin.name")}
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
            {ad?.powered ? <Pill tone="ok">{t("qam.btOn")}</Pill> : <Pill tone="warn">{t("qam.btOff")}</Pill>}
            {ad?.discoverable ? <Pill tone="accent">{t("qam.discoverable")}</Pill> : <Pill>{t("qam.notVisible")}</Pill>}
            {connected.length > 0 && <Pill tone="ok">{t("qam.connectedCount", { n: connected.length })}</Pill>}
          </div>
        </div>
      </div>

      {error && <ErrorText text={error} />}

      {/* 主开关 */}
      <PanelSectionRow>
        <ToggleField
          label={t("qam.allowDiscover")}
          description={ad?.discoverable ? t("qam.allowDiscoverDescOn") : t("qam.allowDiscoverDescOff")}
          checked={!!ad?.discoverable}
          disabled={busy || !ad?.powered}
          onChange={toggleDiscoverable}
        />
      </PanelSectionRow>

      {/* 蓝牙本身关着时，给一个直接打开的入口 */}
      {ad && !ad.powered && (
        <>
          {/* rfkill 阻挡是最常见的原因，单独提示 */}
          {state?.rfkill?.found && (state.rfkill.soft || state.rfkill.hard) && (
            <div style={{
              margin: "6px 0", padding: "9px 11px", borderRadius: 8, fontSize: 11.5, lineHeight: 1.6,
              background: "rgba(236,65,65,0.10)", border: "1px solid rgba(236,65,65,0.28)",
              color: "#ffb3b3",
            }}>
              {state.rfkill.hard
                ? t("qam.rfkillHard")
                : t("qam.rfkillSoft")}
            </div>
          )}
          <PanelSectionRow>
            <ButtonItem
              layout="below"
              onClick={() => act(() => api.setPower(true), t("qam.btOn"))}
            >
              {t("qam.turnOnBt")}
            </ButtonItem>
          </PanelSectionRow>
          {state?.rfkill?.soft && !state.rfkill.hard && (
            <PanelSectionRow>
              <ButtonItem
                layout="below"
                onClick={() => act(() => api.unblockRfkill(), t("qam.unblockRfkill"))}
              >
                {t("qam.unblockRfkill")}
              </ButtonItem>
            </PanelSectionRow>
          )}
        </>
      )}

      {/* 已连接设备 */}
      {connected.length > 0 && (
        <div style={{ margin: "6px 0 2px" }}>
          {connected.map((d) => (
            <div key={d.mac} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", marginBottom: 6,
              borderRadius: 9, background: "rgba(76,195,138,0.10)", border: "1px solid rgba(76,195,138,0.25)",
            }}>
              <div style={{ color: COLORS.ok, flexShrink: 0 }}>
                {(d.icon || "").includes("phone") ? <FaMobileAlt size={15} /> : <FaLaptop size={15} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: COLORS.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {d.display || d.name}
                </div>
                <div style={{ fontSize: 11, color: COLORS.dim, marginTop: 1 }}>{t("qam.playingLabel")}</div>
              </div>
              <Focusable
                onClick={() => act(() => api.deviceAction(d.mac, "disconnect"), t("dev.disconnected") + " " + (d.display || d.name))}
                onActivate={() => act(() => api.deviceAction(d.mac, "disconnect"), t("dev.disconnected") + " " + (d.display || d.name))}
                style={{ fontSize: 11.5, color: COLORS.sub, padding: "4px 9px", borderRadius: 7, background: "rgba(255,255,255,0.07)", cursor: "pointer", flexShrink: 0 }}
              >{t("qam.disconnect")}</Focusable>
            </div>
          ))}
        </div>
      )}

      {/* 谁在放歌：外部蓝牙源 */}
      {state?.live && (
        <div style={{
          margin: "8px 0 2px", padding: "10px 12px", borderRadius: 10,
          background: "rgba(76,154,255,0.10)", border: "1px solid rgba(76,154,255,0.28)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{
              width: 7, height: 7, borderRadius: 4, background: COLORS.ok, flexShrink: 0,
              opacity: state.track?.status === "playing" ? 1 : 0.4,
            }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, color: COLORS.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {state.track?.title || t("qam.playing", { name: state.live.name })}
              </div>
              {state.track?.artist && (
                <div style={{ fontSize: 11, color: COLORS.sub, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {state.track.artist}{state.track.album ? ` · ${state.track.album}` : ""}
                </div>
              )}
            </div>
            <Pill tone="accent">{state.track?.status_label || t("qam.externalSource")}</Pill>
          </div>
          {state.track && state.track.duration_ms > 0 && (
            <div style={{ fontSize: 10.5, color: COLORS.dim, marginBottom: 4 }}>
              {state.track.position} / {state.track.duration}
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Focusable
              onClick={() => act(() => api.setSourceMute(state.live!.id, !state.live!.muted), t("common.ok"))}
              onActivate={() => act(() => api.setSourceMute(state.live!.id, !state.live!.muted))}
              style={{ cursor: "pointer", color: COLORS.sub, flexShrink: 0 }}
            >
              {state.live.muted ? <FaVolumeMute size={12} /> : <FaVolumeUp size={12} />}
            </Focusable>
            <div style={{ flex: 1, minWidth: 0 }}>
              <SliderField
                value={Math.round((state.live.volume || 0) * 100)}
                min={0}
                max={150}
                step={1}
                showValue={false}
                onChange={(v) => { api.setSourceVolume(state.live!.id, v / 100).catch(() => {}); }}
              />
            </div>
          </div>
        </div>
      )}

      {/* 音量：数值放滑杆上方，避开 SliderField 自带的底边框 */}
      <div style={{ width: "100%", marginTop: 6 }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 2, padding: "0 2px",
        }}>
          <Focusable
            onClick={toggleMute}
            onActivate={toggleMute}
            style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", color: COLORS.sub }}
          >
            {state?.volume.muted ? <FaVolumeMute size={12} /> : <FaVolumeUp size={12} />}
            <span style={{ fontSize: 12 }}>{t("qam.volume")}</span>
          </Focusable>
          <span style={{
            fontSize: 11.5,
            color: showVol > 100 ? COLORS.accentWarm : COLORS.sub,
            fontVariantNumeric: "tabular-nums",
          }}>
            {showVol}%{showVol > 100 ? " · " + t("qam.clipping") : ""}
          </span>
        </div>
        <SliderField
          value={showVol}
          min={0}
          max={150}
          step={5}
          showValue={false}
          onChange={changeVolume}
        />
      </div>

      {/* 声音太小？一键增益到 130%（安全范围内） */}
      {showVol < 120 && (
        <Focusable
          onClick={() => act(() => api.boostVolume(1.3), t("qam.boosted"))}
          onActivate={() => act(() => api.boostVolume(1.3), t("qam.boosted"))}
          style={{
            marginTop: 8, padding: "9px 12px", borderRadius: 9, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            background: "rgba(76,154,255,0.12)", border: "1px solid rgba(76,154,255,0.28)",
            fontSize: 12.5, color: COLORS.accent,
          }}
        >
          <FaVolumeUp size={11} /> {t("qam.boost")}
        </Focusable>
      )}

      {connected.length === 0 && ad?.discoverable && (
        <div style={{ fontSize: 11.5, color: COLORS.dim, margin: "4px 4px 0", lineHeight: 1.6 }}>
          {t("qam.hintFind", { alias: ad.alias })}
        </div>
      )}

      <PanelSectionRow>
        <ButtonItem layout="below" onClick={() => Navigation.Navigate(ROUTE)}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <FaCog size={12} /> {t("qam.manage")}
          </div>
        </ButtonItem>
      </PanelSectionRow>
    </PanelSection>
  );
}
