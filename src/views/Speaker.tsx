import { useEffect, useRef, useState } from "react";
import {
  PanelSection, PanelSectionRow, ButtonItem, ToggleField, Navigation, Focusable,
} from "@decky/ui";
import { toaster } from "@decky/api";
import { FaBluetooth, FaVolumeUp, FaVolumeMute, FaMobileAlt, FaLaptop, FaCog, FaMoon } from "react-icons/fa";
import { api } from "../backend";
import { useSpeaker, setPanelVisible } from "../store";
import { COLORS, ROUTE, RADIUS, SPACE, FONT, TONES } from "../theme";
import { Pill, ErrorText, errMsg } from "../components";
import { t } from "../i18n";
import { setDimmed as setDimState } from "../dimState";
import { versionLabel } from "../version";

/** 音量调节按钮：只发指令不读状态，因此不存在同步问题。 */
function VolBtn({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <Focusable
      onClick={onClick}
      onActivate={onClick}
      style={{
        flex: 1, minWidth: 0, padding: "9px 0", borderRadius: RADIUS.sm, cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(255,255,255,0.07)", border: `1px solid ${COLORS.border}`,
        fontSize: 12, color: COLORS.text, whiteSpace: "nowrap",
      }}
    >
      {label}
    </Focusable>
  );
}

export function Speaker() {
  const { state, error } = useSpeaker();
  const [busy, setBusy] = useState(false);

  // QAM 面板挂载即视为可见；卸载时通知 store 降频
  useEffect(() => {
    setPanelVisible(true);
    return () => setPanelVisible(false);
  }, []);

  // ---- 息屏（当音箱时省电 / 防烧屏）--------------------------------------
  //
  // ⚠️ 遮罩不在这里渲染。它挂成**全局组件**（见 index.tsx），
  //    因为 QAM 面板的 DOM 被 Steam 容器包着、容器带 transform，
  //    会让 position:fixed 的包含块退化，盖不住顶栏。
  //    这里只负责「按按钮 → 调后端 → 更新共享状态」。
  //
  // 注意：QAM 里**不需要**读 `dimmed` 状态 —— 遮罩是全局的，
  // 面板本身不因息屏而改变（息屏时 QAM 已被 CloseSideMenus 收起）。
  // 早期这里留了一个只写不读的 useState，是死代码。
  const dimTimer = useRef<any>(null);

  // 组件卸载时一定恢复背光，避免留下黑屏
  useEffect(() => () => {
    if (dimTimer.current) clearTimeout(dimTimer.current);
  }, []);

  const enterDim = async () => {
    try {
      // ⚠️ 第一步：先关掉 QAM 侧边菜单，再让遮罩接管。
      //
      // 真机反馈「可以息屏，但是会显示一个 QAM 面板」—— 根因是
      // QAM 面板在**更高的合成层**，而遮罩挂在全局组件里，压不住它。
      // 光靠 z-index 或 UIComposition.Overlay 都不够，因为 QAM 是 Steam
      // 自己的 OverlayQAM 层。
      //
      // 正确做法是先把 QAM 收起来（`Navigation.CloseSideMenus()`，
      // MagicBlack 也是这么干的），这样屏幕上只剩游戏画面，
      // 遮罩就能完整盖住。用户想看插件面板时按 QAM 键，
      // 那时会触发输入 → 自动唤醒 → 遮罩消失。
      try {
        Navigation.CloseSideMenus();
      } catch {
        /* 老版本没有这个 API，忽略 */
      }

      const r: any = await api.dimScreen();
      // 通知全局遮罩显示，再更新本地按钮状态
      setDimState(true);
      const secs = (r.max_seconds || 300) * 1000;
      if (dimTimer.current) clearTimeout(dimTimer.current);
      dimTimer.current = setTimeout(() => { exitDim(); }, secs);
      // ⚠️ 休眠抑制没拿到 = 息屏后蓝牙一定会断（系统会自己睡下去）。
      //    必须单独提示，否则用户只会看到「放一会儿歌就断了」的怪现象。
      if (r.inhibit && r.inhibit.ok === false) {
        toaster.toast({
          title: t("qam.inhibitFailed"),
          body: (r.inhibit.error || "") + " " + t("qam.inhibitFailedBody"),
        });
      }
    } catch (e) {
      toaster.toast({ title: t("qam.dimFailed"), body: errMsg(e) });
    }
  };

  const exitDim = async () => {
    if (dimTimer.current) { clearTimeout(dimTimer.current); dimTimer.current = null; }
    setDimState(false);
    try { await api.undimScreen(); } catch { /* ignore */ }
  };

  const ad = state?.adapter;
  const connected = state?.connected || [];

  const act = async (fn: () => Promise<any>, okMsg?: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      if (okMsg) toaster.toast({ title: okMsg, body: "" });
    } catch (e) {
      toaster.toast({ title: t("toast.failed"), body: errMsg(e) });
    } finally {
      setBusy(false);
    }
  };

  const toggleDiscoverable = async (on: boolean) => {
    await act(() => api.setDiscoverable(on), on ? t("qam.discoverable") : t("qam.notVisible"));
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
              margin: "6px 0", padding: "9px 11px", borderRadius: 8, fontSize: 12, lineHeight: 1.6,
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
                style={{ fontSize: 12, color: COLORS.sub, padding: "4px 9px", borderRadius: 7, background: "rgba(255,255,255,0.07)", cursor: "pointer", flexShrink: 0 }}
              >{t("qam.disconnect")}</Focusable>
            </div>
          ))}
        </div>
      )}

      {/* 已连接但 A2DP 还没就绪：显示「正在协商音频…」。
          这不是错误 —— 蓝牙连上后还要走 SDP / AVDTP / 建卡三步，
          常见 1~6 秒。以前界面只显示「已连接」，用户去电脑里找不到音箱
          就以为坏了。 */}
      {connected.length > 0 && state?.a2dp && !state.a2dp.ready && (
        <div style={{
          margin: "6px 0 2px", padding: "9px 11px", borderRadius: 8, fontSize: 12,
          lineHeight: 1.6, background: "rgba(76,154,255,0.10)",
          border: "1px solid rgba(76,154,255,0.28)", color: "#a8c8ff",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{
              width: 6, height: 6, borderRadius: 3, background: COLORS.accent,
              animation: "pulse 1.2s ease-in-out infinite",
            }} />
            {t("qam.negotiating")}
          </div>
          <div style={{ marginTop: 5, color: COLORS.dim, fontSize: 11 }}>
            {t("qam.negotiatingHint")}
          </div>
          <Focusable
            onClick={() => act(async () => {
              const r = await api.fixA2dp(connected[0]?.mac);
              if (r.ok) {
                toaster.toast({ title: t("qam.a2dpFixed"), body: r.profile || "" });
              } else {
                toaster.toast({
                  title: t("qam.a2dpFixFailed"),
                  body: r.detail || r.reason || "",
                });
              }
            })}
            onActivate={() => act(async () => {
              const r = await api.fixA2dp(connected[0]?.mac);
              if (r.ok) {
                toaster.toast({ title: t("qam.a2dpFixed"), body: r.profile || "" });
              } else {
                toaster.toast({
                  title: t("qam.a2dpFixFailed"),
                  body: r.detail || r.reason || "",
                });
              }
            })}
            style={{
              marginTop: 7, padding: "7px 11px", borderRadius: 7, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "rgba(76,154,255,0.18)", fontSize: 12, color: "#fff",
            }}
          >
            {t("qam.a2dpForce")}
          </Focusable>
        </div>
      )}

      {/* 正在播放：纯信息卡片。
          ⚠️ 这里**不再放音量按钮** —— 下面已经有一整排主音量调节，
          同一个面板里两套音量控件既重复又让人分不清哪个管什么。
          （真机反馈：「这个的音量控件和下边音量调节重复了」。）
          外部源的独立音量调节挪到全屏页的「设置」里，需要时再去调。 */}
      {state?.live && (
        <div style={{
          margin: "8px 0 2px", padding: "10px 12px", borderRadius: RADIUS.sm,
          background: TONES.accent.bg, border: `1px solid ${TONES.accent.border}`,
        }}>
          {/* 第一行：状态点 + 曲名 + 来源徽章 */}
          <div style={{ display: "flex", alignItems: "center", gap: SPACE.md, marginBottom: 6 }}>
            <span style={{
              width: 7, height: 7, borderRadius: RADIUS.full, background: COLORS.ok,
              flexShrink: 0,
              // 播放中常亮，暂停时变暗
              opacity: state.track?.status === "playing" ? 1 : 0.4,
            }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: FONT.small, color: COLORS.text, fontWeight: 600,
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}>
                {state.track?.title || t("qam.playing", { name: state.live.name })}
              </div>
              <div style={{
                fontSize: FONT.caption, color: COLORS.sub, marginTop: 1,
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}>
                {state.track?.artist
                  ? (state.track.album
                      ? `${state.track.artist} · ${state.track.album}`
                      : state.track.artist)
                  : state.live.name}
              </div>
            </div>
            <Pill tone="accent">
              {state.track?.status_label || t("qam.externalSource")}
            </Pill>
          </div>

          {/* 第二行：进度条 + 时间（有元数据才显示） */}
          {state.track && state.track.duration_ms > 0 && (
            <div>
              <div style={{
                height: 3, borderRadius: 2, background: "rgba(255,255,255,0.12)",
                overflow: "hidden",
              }}>
                <div style={{
                  height: "100%",
                  width: `${Math.min(100, (state.track.position_ms / state.track.duration_ms) * 100)}%`,
                  background: COLORS.accent,
                  borderRadius: 2,
                  transition: "width 0.9s linear",
                }} />
              </div>
              <div style={{
                display: "flex", justifyContent: "space-between",
                fontSize: FONT.caption, color: COLORS.dim, marginTop: 3,
                fontVariantNumeric: "tabular-nums",
              }}>
                <span>{state.track.position}</span>
                <span>{state.track.duration}</span>
              </div>
            </div>
          )}

          {/* 没有元数据时给一句说明，避免卡片显得空 */}
          {(!state.track || state.track.duration_ms <= 0) && (
            <div style={{ fontSize: FONT.caption, color: COLORS.dim }}>
              {t("qam.noTrackInfo")}
            </div>
          )}
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

      {/* 声音小：直接设绝对音量，不依赖读取当前值 */}
      <div style={{ marginTop: 8 }}>
        <div style={{ fontSize: 12, color: COLORS.dim, marginBottom: 6, padding: "0 2px" }}>
          {t("qam.boostHint")}
        </div>
        <Focusable flow-children="row" style={{ display: "flex", gap: 8 }}>
          <VolBtn onClick={() => act(() => api.boostVolume(1.0), t("qam.boosted100"))} label="100%" />
          <VolBtn onClick={() => act(() => api.boostVolume(1.3), t("qam.boosted130"))} label="130%" />
          <VolBtn onClick={() => act(() => api.boostVolume(1.5), t("qam.boosted150"))} label="150%" />
          <VolBtn onClick={() => act(() => api.boostVolume(2.0), t("qam.boosted200"))} label="200%" />
        </Focusable>
      </div>

      {connected.length === 0 && ad?.discoverable && (
        <div style={{ fontSize: 12, color: COLORS.dim, margin: "4px 4px 0", lineHeight: 1.6 }}>
          {t("qam.hintFind", { alias: ad.alias })}
        </div>
      )}

      {/* 息屏当音箱：背光归 0 省电、防烧屏。任何按键 / 触摸立即恢复。
          同时会拿一个 logind 抑制锁阻止系统自动休眠 —— 否则闲置计时器走完
          Deck 会整机睡下去，蓝牙链路跟着断（真机踩过这个坑）。 */}
      {state?.screen?.available && (
        <>
          <Focusable
            onClick={enterDim}
            onActivate={enterDim}
            style={{
              marginTop: 8, padding: "10px 12px", borderRadius: RADIUS.sm, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              background: "rgba(255,255,255,0.06)", border: `1px solid ${COLORS.border}`,
              fontSize: 12, color: COLORS.text,
            }}
          >
            <FaMoon size={11} /> {t("qam.dimScreen")}
          </Focusable>
          <div style={{ fontSize: 11, color: COLORS.dim, margin: "5px 4px 0", lineHeight: 1.5 }}>
            {state.screen.inhibit_held
              ? t("qam.dimKeepAwake")
              : (state.screen.inhibit_available === false
                ? t("qam.inhibitFailedBody")
                : t("qam.dimScreenHint"))}
          </div>
        </>
      )}

      {/* 背光只变暗（bl_power 是 root 只读）时，给一键修复入口 */}

      <PanelSectionRow>
        <ButtonItem layout="below" onClick={() => Navigation.Navigate(ROUTE)}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <FaCog size={12} /> {t("qam.manage")}
          </div>
        </ButtonItem>
      </PanelSectionRow>

      {/* 版本号 + 构建时间。
          排查「装了新版还报旧错」时，这行是唯一可靠的判断依据 ——
          如果这里显示的不是最新版本，说明装的是旧包或 CEF 缓存了旧 index.js，
          而不是代码没修好。 */}
      {versionLabel() && (
        <div style={{
          fontSize: 11, color: COLORS.dim, textAlign: "center",
          marginTop: 6, letterSpacing: 0.3, userSelect: "text",
        }}>
          {versionLabel()}
        </div>
      )}

      {/* 息屏遮罩**不在这里渲染** —— 它挂在全局组件上（见 index.tsx），
          因为 QAM 面板的 DOM 被 Steam 容器包着且带 transform，
          position:fixed 的包含块会退化，盖不住顶栏和 QAM 自己。 */}
    </PanelSection>
  );
}
