import { useEffect, useRef, useState } from "react";
import {
  PanelSection, PanelSectionRow, ButtonItem, ToggleField, SliderField, Navigation, Focusable,
} from "@decky/ui";
import { toaster } from "@decky/api";
import { FaBluetooth, FaVolumeUp, FaVolumeMute, FaMobileAlt, FaLaptop, FaCog } from "react-icons/fa";
import { api } from "../backend";
import { useSpeaker, setPanelVisible } from "../store";
import { COLORS, ROUTE } from "../route";
import { Pill, ErrorText } from "../components";
import { t } from "../i18n";

/** 音量调节按钮：只发指令不读状态，因此不存在同步问题。 */
function VolBtn({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <Focusable
      onClick={onClick}
      onActivate={onClick}
      style={{
        flex: 1, minWidth: 0, padding: "9px 0", borderRadius: 9, cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(255,255,255,0.07)", border: `1px solid ${COLORS.border}`,
        fontSize: 12.5, color: COLORS.text, whiteSpace: "nowrap",
      }}
    >
      {label}
    </Focusable>
  );
}

export function Speaker() {
  const { state, error } = useSpeaker();
  const [busy, setBusy] = useState(false);
  // 本地音量值：用户拖动后一直保留，直到「后端确认读到我们设的值」才交还
  const [vol, setVol] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const dragTimer = useRef<any>(null);
  const settleTimer = useRef<any>(null);
  // 外部音源音量：同样的确认式交还
  const [srcVol, setSrcVol] = useState<number | null>(null);
  const srcTimer = useRef<any>(null);

  // QAM 面板挂载即视为可见；卸载时通知 store 降频
  useEffect(() => {
    setPanelVisible(true);
    return () => setPanelVisible(false);
  }, []);

  const backendVol = state ? Math.round(state.volume.volume * 100) : 0;

  // ⚠️ 同步策略（真机反馈「音量调节没同步」的修复核心）
  // 之前是「松手后固定 3 秒交还」，但空闲时轮询间隔是 10 秒，
  // 3 秒时后端读到的还是旧值 -> 滑杆立刻跳回去。
  //
  // 现在改为「**确认式交还**」：只有当后端读到的值和我们设的值足够接近
  // （±2% 容差）时才交还控制权；否则继续用本地值，并给一个 15 秒上限兜底
  // （防止后端写入失败时滑杆永远卡在本地值）。
  useEffect(() => {
    if (vol === null || dragging) return;
    const diff = Math.abs(backendVol - vol);
    if (diff <= 2) {
      // 后端已确认 -> 交还控制权
      setVol(null);
      if (settleTimer.current) { clearTimeout(settleTimer.current); settleTimer.current = null; }
    }
  }, [backendVol, vol, dragging]);

  // 兜底：15 秒还没确认就强制交还，避免永远卡住
  useEffect(() => {
    if (vol === null || dragging) return;
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      setVol(null);
      settleTimer.current = null;
    }, 15000);
    return () => {
      if (settleTimer.current) { clearTimeout(settleTimer.current); settleTimer.current = null; }
    };
  }, [vol, dragging]);

  // 外部源音量：后端读到的值和我们设的接近时才交还
  useEffect(() => {
    if (srcVol === null) return;
    const backendSrc = Math.round((state?.live?.volume || 0) * 100);
    if (Math.abs(backendSrc - srcVol) <= 2) {
      setSrcVol(null);
      if (srcTimer.current) { clearTimeout(srcTimer.current); srcTimer.current = null; }
    }
  }, [state?.live?.volume, srcVol]);

  const ad = state?.adapter;
  const connected = state?.connected || [];
  const showVol = (dragging || vol !== null) ? (vol ?? backendVol) : backendVol;
  // 后端读取失败时不能显示成 0%（会误导），单独标记
  const volFailed = !!state && state.volume.ok === false;

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
                value={srcVol !== null ? srcVol : Math.round((state.live.volume || 0) * 100)}
                min={0}
                max={150}
                step={1}
                showValue={false}
                onChange={(v) => {
                  // 外部源同样用「确认式交还」，避免被轮询拽回去
                  setSrcVol(v);
                  if (srcTimer.current) clearTimeout(srcTimer.current);
                  srcTimer.current = setTimeout(() => setSrcVol(null), 15000);
                  api.setSourceVolume(state.live!.id, v / 100).catch(() => {});
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* 音量：不再显示滑杆。
          真机上 wpctl 读取一直失败，显示出来的数字是错的（滑杆在最右却显示 0%），
          与其显示错误数据，不如只保留「相对调节」按钮 —— 它们只发指令、不读状态，
          因此不存在同步问题。想看具体数值请用 Steam 自己的音量键或系统音量面板。 */}
      <div style={{ width: "100%", marginTop: 8 }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 6, padding: "0 2px", marginBottom: 6,
          color: COLORS.sub, fontSize: 12,
        }}>
          {state?.volume.muted ? <FaVolumeMute size={12} /> : <FaVolumeUp size={12} />}
          <span>{t("qam.volume")}</span>
          <span style={{ fontSize: 11, color: COLORS.dim, marginLeft: "auto" }}>
            {t("qam.volumeHint")}
          </span>
        </div>
        <Focusable flow-children="row" style={{ display: "flex", gap: 8 }}>
          <VolBtn onClick={() => act(() => api.stepVolume(-10))} label="−10%" />
          <VolBtn onClick={() => act(() => api.stepVolume(-5))} label="−5%" />
          <VolBtn onClick={toggleMute} label={state?.volume.muted ? t("qam.unmute") : t("qam.mute")} />
          <VolBtn onClick={() => act(() => api.stepVolume(5))} label="+5%" />
          <VolBtn onClick={() => act(() => api.stepVolume(10))} label="+10%" />
        </Focusable>
      </div>

      {/* 声音太小？一键增益到 130%（安全范围内） */}
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
