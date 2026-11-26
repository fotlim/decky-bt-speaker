import { useEffect, useState } from "react";
import {
  PanelSection, PanelSectionRow, ButtonItem, ToggleField, SliderField, Navigation, Focusable,
} from "@decky/ui";
import { toaster } from "@decky/api";
import { FaBluetooth, FaVolumeUp, FaVolumeMute, FaMobileAlt, FaLaptop, FaCog } from "react-icons/fa";
import { api } from "../backend";
import { useSpeaker } from "../store";
import { COLORS, ROUTE } from "../route";
import { Pill, ErrorText } from "../components";

export function Speaker() {
  const { state, error } = useSpeaker();
  const [busy, setBusy] = useState(false);
  const [vol, setVol] = useState<number | null>(null);

  // 拖动后 1.2s 内用自己的值，之后交还给后端轮询（避免轮询把滑块拽回去）
  const backendVol = state ? Math.round(state.volume.volume * 100) : 0;
  useEffect(() => {
    if (vol === null) return;
    const t = setTimeout(() => setVol(null), 1200);
    return () => clearTimeout(t);
  }, [vol]);

  const ad = state?.adapter;
  const connected = state?.connected || [];
  const showVol = vol === null ? backendVol : vol;

  const act = async (fn: () => Promise<any>, okMsg?: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      if (okMsg) toaster.toast({ title: okMsg, body: "" });
    } catch (e: any) {
      toaster.toast({ title: "操作失败", body: e?.message || String(e) });
    } finally {
      setBusy(false);
    }
  };

  const toggleDiscoverable = async (on: boolean) => {
    await act(() => api.setDiscoverable(on), on ? "已开启可被发现" : "已关闭可被发现");
  };

  const changeVolume = (v: number) => {
    setVol(v);
    api.setVolume(v / 100).catch(() => {});
  };

  const toggleMute = () => {
    if (!state) return;
    act(() => api.setMute(!state.volume.muted), state.volume.muted ? "已取消静音" : "已静音");
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
            {ad ? ad.alias : "蓝牙音箱"}
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
            {ad?.powered ? <Pill tone="ok">蓝牙已开</Pill> : <Pill tone="warn">蓝牙已关</Pill>}
            {ad?.discoverable ? <Pill tone="accent">可被发现</Pill> : <Pill>不可见</Pill>}
            {connected.length > 0 && <Pill tone="ok">{connected.length} 台已连接</Pill>}
          </div>
        </div>
      </div>

      {error && <ErrorText text={error} />}

      {/* 主开关 */}
      <PanelSectionRow>
        <ToggleField
          label="允许设备发现并连接"
          description={ad?.discoverable ? "手机 / 电脑的蓝牙列表里能看到这台 Deck" : "打开后其它设备才能搜到"}
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
                ? "蓝牙被硬件开关阻挡（Hard blocked），软件解不了，请重启 Deck。"
                : "蓝牙被射频开关阻挡了（Soft blocked），这是打不开蓝牙最常见的原因。"}
            </div>
          )}
          <PanelSectionRow>
            <ButtonItem
              layout="below"
              onClick={() => act(() => api.setPower(true), "蓝牙已打开")}
            >
              打开蓝牙
            </ButtonItem>
          </PanelSectionRow>
          {state?.rfkill?.soft && !state.rfkill.hard && (
            <PanelSectionRow>
              <ButtonItem
                layout="below"
                onClick={() => act(() => api.unblockRfkill(), "已尝试解除阻挡")}
              >
                解除射频阻挡（需要 sudo）
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
                  {d.name}
                </div>
                <div style={{ fontSize: 11, color: COLORS.dim, marginTop: 1 }}>正在播放</div>
              </div>
              <Focusable
                onClick={() => act(() => api.deviceAction(d.mac, "disconnect"), "已断开 " + d.name)}
                onActivate={() => act(() => api.deviceAction(d.mac, "disconnect"), "已断开 " + d.name)}
                style={{ fontSize: 11.5, color: COLORS.sub, padding: "4px 9px", borderRadius: 7, background: "rgba(255,255,255,0.07)", cursor: "pointer", flexShrink: 0 }}
              >断开</Focusable>
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
                {state.track?.title || `正在播放：${state.live.name}`}
              </div>
              {state.track?.artist && (
                <div style={{ fontSize: 11, color: COLORS.sub, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {state.track.artist}{state.track.album ? ` · ${state.track.album}` : ""}
                </div>
              )}
            </div>
            <Pill tone="accent">{state.track?.status_label || "外部音源"}</Pill>
          </div>
          {state.track && state.track.duration_ms > 0 && (
            <div style={{ fontSize: 10.5, color: COLORS.dim, marginBottom: 4 }}>
              {state.track.position} / {state.track.duration}
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Focusable
              onClick={() => act(() => api.setSourceMute(state.live!.id, !state.live!.muted), state.live!.muted ? "已取消静音" : "已静音外部音源")}
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

      {/* 音量 */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4, width: "100%" }}>
        <Focusable onClick={toggleMute} onActivate={toggleMute} style={{ cursor: "pointer", color: COLORS.sub, flexShrink: 0 }}>
          {state?.volume.muted ? <FaVolumeMute size={13} /> : <FaVolumeUp size={13} />}
        </Focusable>
        <div style={{ flex: 1, minWidth: 0 }}>
          <SliderField
            value={showVol}
            min={0}
            max={150}
            step={5}
            showValue={false}
            onChange={changeVolume}
          />
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: COLORS.dim, marginTop: -2 }}>
        <span>0%</span>
        <span style={{ color: showVol > 100 ? COLORS.accentWarm : COLORS.dim }}>
          {showVol}%{showVol > 100 ? "（增益·可能破音）" : ""}
        </span>
        <span>150%</span>
      </div>

      {/* 声音太小？一键增益到 130%（安全范围内） */}
      {showVol < 120 && (
        <Focusable
          onClick={() => act(() => api.boostVolume(1.3), "已增益到 130%")}
          onActivate={() => act(() => api.boostVolume(1.3), "已增益到 130%")}
          style={{
            marginTop: 8, padding: "9px 12px", borderRadius: 9, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            background: "rgba(76,154,255,0.12)", border: "1px solid rgba(76,154,255,0.28)",
            fontSize: 12.5, color: COLORS.accent,
          }}
        >
          <FaVolumeUp size={11} /> 声音太小？增强到 130%
        </Focusable>
      )}

      {connected.length === 0 && ad?.discoverable && (
        <div style={{ fontSize: 11.5, color: COLORS.dim, margin: "4px 4px 0", lineHeight: 1.6 }}>
          在手机的「蓝牙」里找 <b style={{ color: COLORS.sub }}>{ad.alias}</b>，配对后直接放歌即可～
        </div>
      )}

      <PanelSectionRow>
        <ButtonItem layout="below" onClick={() => Navigation.Navigate(ROUTE)}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <FaCog size={12} /> 设备管理 / 设置
          </div>
        </ButtonItem>
      </PanelSectionRow>
    </PanelSection>
  );
}
