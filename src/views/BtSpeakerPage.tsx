import { useEffect, useState } from "react";
import { Focusable, SliderField } from "@decky/ui";
import { toaster } from "@decky/api";
import { api } from "../backend";
import { useSpeaker } from "../store";
import { COLORS } from "../route";
import { Pill, ErrorText, Hint, Avatar, SectionTitle, Loading, Card } from "../components";

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
      toaster.toast({ title: "操作失败", body: e?.message || String(e) });
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
          <div style={{ fontSize: 26, fontWeight: 700, color: COLORS.text }}>蓝牙音箱</div>
          <div style={{ fontSize: 13, color: COLORS.sub, marginTop: 3 }}>
            {ad ? `${ad.alias} · ${ad.address || "未知地址"}` : "正在读取蓝牙适配器…"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {ad?.powered ? <Pill tone="ok">蓝牙已开</Pill> : <Pill tone="warn">蓝牙已关</Pill>}
          {ad?.discoverable ? <Pill tone="accent">可被发现</Pill> : <Pill>不可见</Pill>}
          {ad?.a2dp_sink ? <Pill tone="ok">A2DP Sink</Pill> : <Pill tone="warn">无 Sink 角色</Pill>}
        </div>
      </div>

      {error && <ErrorText text={error} />}

      {/* Tab 切换 */}
      <Focusable flow-children="row" style={{ display: "flex", gap: 10, margin: "14px 0 4px" }}>
        {([
          ["devices", "已配对设备"],
          ["settings", "设置"],
          ["eq", "均衡器"],
          ["diag", "诊断"],
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
  paired: { mac: string; name: string }[];
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
          还没有配对过任何设备。用上面的「搜索附近设备」找到手机后点「配对」即可，
          不用退出插件去系统蓝牙设置。
        </Hint>
      </div>
    );
  }
  return (
    <div style={{ marginTop: 16 }}>
      <ScanPanel alias={alias} discoverable={discoverable} onPaired={() => onAction("", "connect", "")} />

      <SectionTitle>已配对（{paired.length}）</SectionTitle>
      <Focusable flow-children="column">
        {paired.map((d) => {
          const connected = connectedMacs.has(d.mac);
          const busy = busyMac === d.mac;
          return (
            <div key={d.mac} style={{
              display: "flex", alignItems: "center", gap: 14, padding: "12px 14px", marginBottom: 8,
              borderRadius: 11, background: "rgba(255,255,255,0.045)", border: `1px solid ${COLORS.border}`,
            }}>
              <Avatar connected={connected} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, color: COLORS.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {d.name}
                </div>
                <div style={{ fontSize: 12, color: COLORS.dim, marginTop: 2 }}>{d.mac}</div>
              </div>
              {connected ? <Pill tone="ok">已连接</Pill> : <Pill>未连接</Pill>}
              <Focusable
                onClick={() => onAction(d.mac, connected ? "disconnect" : "connect", connected ? "已断开" : "正在连接…")}
                onActivate={() => onAction(d.mac, connected ? "disconnect" : "connect", connected ? "已断开" : "正在连接…")}
                style={{
                  padding: "7px 16px", borderRadius: 18, fontSize: 13, cursor: busy ? "default" : "pointer",
                  background: connected ? "rgba(255,255,255,0.08)" : COLORS.accent,
                  color: connected ? COLORS.sub : "#fff", opacity: busy ? 0.5 : 1,
                }}
              >{busy ? "…" : connected ? "断开" : "连接"}</Focusable>
              <Focusable
                onClick={() => onAction(d.mac, "repair", "正在修复配对…")}
                onActivate={() => onAction(d.mac, "repair", "正在修复配对…")}
                style={{
                  padding: "7px 14px", borderRadius: 18, fontSize: 13, cursor: "pointer",
                  background: "rgba(76,154,255,0.16)", color: COLORS.accent,
                }}
              >修复配对</Focusable>
              <Focusable
                onClick={() => onAction(d.mac, "remove", "已移除配对")}
                onActivate={() => onAction(d.mac, "remove", "已移除配对")}
                style={{
                  padding: "7px 14px", borderRadius: 18, fontSize: 13, cursor: "pointer",
                  background: "rgba(236,65,65,0.14)", color: COLORS.accentWarm,
                }}
              >移除</Focusable>
            </div>
          );
        })}
      </Focusable>
      <Hint>
        连接成功后在手机上播放音乐，声音就会从 Deck 的喇叭出来。同一时间只能有一个源在放（蓝牙 A2DP 的限制）。
        <br />
        <b style={{ color: COLORS.sub }}>配对码 / 通行密钥不正确？</b>点「修复配对」——
        它会清除 Deck 端保存的旧绑定密钥再重新配对。如果仍失败，请在手机端也「忘记」这个设备后重新搜索。
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
          title: "没搜到设备",
          body: "确认手机蓝牙已打开、并且在可被发现状态",
        });
      }
    } catch (e: any) {
      toaster.toast({ title: "搜索失败", body: e?.message || String(e) });
    } finally {
      setScanning(false);
    }
  };

  const pair = async (mac: string, name: string) => {
    if (busyMac) return;
    setBusyMac(mac);
    try {
      await api.pairDeviceFull(mac);
      toaster.toast({ title: `已配对 ${name}`, body: "" });
      setDevices((prev) => prev.filter((d) => d.mac !== mac));
      onPaired();
    } catch (e: any) {
      toaster.toast({ title: "配对失败", body: e?.message || String(e) });
    } finally {
      setBusyMac(null);
    }
  };

  return (
    <div style={{ marginBottom: 8 }}>
      <SectionTitle>搜索附近设备</SectionTitle>
      <Hint>
        {discoverable
          ? "扫描 20 秒，找到设备后点「配对」即可，不用去系统蓝牙设置。"
          : "建议先在 QAM 里打开「允许设备发现并连接」，否则对方可能搜不到这台 Deck。"}
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
        {scanning ? "正在搜索…（约 20 秒）" : "搜索附近设备"}
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
                    {d.name}
                  </div>
                  <div style={{ fontSize: 12, color: COLORS.dim, marginTop: 2 }}>{d.mac}</div>
                </div>
                <Focusable
                  onClick={() => pair(d.mac, d.name)}
                  onActivate={() => pair(d.mac, d.name)}
                  style={{
                    padding: "7px 18px", borderRadius: 18, fontSize: 13, flexShrink: 0,
                    cursor: busy ? "default" : "pointer",
                    background: busy ? "rgba(255,255,255,0.08)" : COLORS.accent,
                    color: busy ? COLORS.sub : "#fff",
                  }}
                >{busy ? "配对中…" : "配对"}</Focusable>
              </div>
            );
          })}
        </Focusable>
      )}

      {scanned && devices.length === 0 && (
        <Hint>
          没搜到未配对的设备。可能是：手机已经配过这台 Deck（去下面「已配对」里看）、
          或手机蓝牙没打开、或对方不可被发现。
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
      toaster.toast({ title: "保存失败", body: e?.message || String(e) });
    }
  };

  const changeFocus = async (mode: string) => {
    try {
      const r = await api.setFocusMode(mode);
      toaster.toast({
        title: "焦点模式已切换",
        body: r.applied && r.applied.length ? r.applied.join("、") : "",
      });
      refresh();
    } catch (e: any) {
      toaster.toast({ title: "切换失败", body: e?.message || String(e) });
    }
  };

  const setSilence = async (sec: number) => {
    try {
      await api.setSilenceTimeout(sec);
      refresh();
    } catch (e: any) {
      toaster.toast({ title: "设置失败", body: e?.message || String(e) });
    }
  };

  const applyAlias = async () => {
    const v = alias.trim();
    if (!v || busy) return;
    setBusy(true);
    try {
      await api.setAlias(v);
      toaster.toast({ title: "设备名已改为 " + v, body: "" });
    } catch (e: any) {
      toaster.toast({ title: "改名失败", body: e?.message || String(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ marginTop: 16, maxWidth: 720 }}>
      <SectionTitle>设备名</SectionTitle>
      <Hint>别人蓝牙列表里看到的名字。建议改成一个好认的名字。</Hint>
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
        >{busy ? "保存中…" : "保存"}</Focusable>
      </div>

      <SectionTitle>音频调优</SectionTitle>
      <ToggleRow
        label="启用「音箱优化」配置"
        desc="写入用户级 WirePlumber 配置：只保留 A2DP 角色、手机推流直出、避免掉成通话单声道。改完会自动重启 WirePlumber。"
        checked={!!state.tuning?.installed}
        onChange={async (v) => {
          try {
            if (v) {
              await api.applyTuning();
              toaster.toast({ title: "已启用音箱优化", body: "WirePlumber 已重启" });
            } else {
              await api.removeTuning();
              toaster.toast({ title: "已恢复系统默认", body: "WirePlumber 已重启" });
            }
            refresh();
          } catch (e: any) {
            toaster.toast({ title: "操作失败", body: e?.message || String(e) });
          }
        }}
      />
      <Hint>
        配置文件：<span style={{ color: COLORS.sub }}>{state.tuning?.path || "~/.config/wireplumber/wireplumber.conf.d/50-bt-speaker.conf"}</span>
        <br />连上了却没声音、或者声音变成单声道发闷时，打开它再重连一次通常就好了。
      </Hint>

      <SectionTitle>配对</SectionTitle>
      <Hint>
        配对 agent 负责应答手机的配对请求。如果手机弹了配对码但 Deck 没反应，
        说明 agent 没工作，点下面的按钮重启它再试。
      </Hint>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
        <div style={{
          width: 8, height: 8, borderRadius: 4, flexShrink: 0,
          background: state.agent_registered ? COLORS.ok : state.agent ? "#e0a800" : COLORS.accentWarm,
        }} />
        <div style={{ flex: 1, fontSize: 13, color: COLORS.text }}>
          {state.agent_registered
            ? "配对 agent 已就绪"
            : state.agent
              ? "配对 agent 运行中，但未确认注册"
              : "配对 agent 未运行"}
        </div>
        <Focusable
          onClick={async () => {
            try {
              const r = await api.restartAgent();
              toaster.toast({
                title: r.registered ? "配对 agent 已重启并就绪" : "已重启，但未确认注册",
                body: r.registered ? "" : "配对时可能需要手动确认",
              });
              setTimeout(refresh, 800);
            } catch (e: any) {
              toaster.toast({ title: "重启失败", body: e?.message || String(e) });
            }
          }}
          onActivate={async () => {
            try { await api.restartAgent(); setTimeout(refresh, 800); } catch { /* ignore */ }
          }}
          style={{
            padding: "7px 14px", borderRadius: 16, fontSize: 12.5, cursor: "pointer",
            background: "rgba(255,255,255,0.08)", color: COLORS.text, flexShrink: 0,
          }}
        >重启 agent</Focusable>
      </div>

      <SectionTitle>音频焦点</SectionTitle>
      <Hint>决定「手机推流」和「Deck 游戏声音」怎么共存。不会改写你的系统默认输出。</Hint>
      <Focusable flow-children="column" style={{ marginTop: 8 }}>
        {([
          ["coexist", "与游戏共存", "两者都出声，互不抢占（推荐）"],
          ["receiver_first", "接收端优先", "优先保证手机推流音质，关闭自动切通话模式"],
          ["manual", "手动", "插件不插手，完全自己用系统音量面板调"],
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

      <SectionTitle>省电</SectionTitle>
      <Hint>手机放完歌常忘了断开，A2DP 链路会一直占着蓝牙射频。这里可以自动收尾。</Hint>
      <div style={{ marginTop: 8 }}>
        <div style={{ fontSize: 13.5, color: COLORS.text, marginBottom: 6 }}>
          静音多久后自动断开
          {state.silence?.enabled && state.silence.was_active && state.silence.remaining !== null
            ? `（还有 ${state.silence.remaining} 秒）`
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
          <span>关闭</span><span>5 分钟</span><span>10 分钟</span>
        </div>
      </div>

      <SectionTitle>音量归一化</SectionTitle>
      <Hint>
        手机切歌时音量忽大忽小很常见。这里记录一个基线，跳变超过 25% 会提示。
        当前基线：{state.normalize?.baseline != null ? Math.round(state.normalize.baseline * 100) + "%" : "未设置"}
        {state.normalize?.jumps ? ` · 已检测到 ${state.normalize.jumps} 次跳变` : ""}
      </Hint>
      <Focusable flow-children="row" style={{ display: "flex", gap: 10, marginTop: 8 }}>
        <Focusable
          onClick={async () => {
            try {
              await api.setVolumeBaseline(state.live?.volume ?? state.volume.volume);
              toaster.toast({ title: "已把当前音量设为基线", body: "" });
              refresh();
            } catch (e: any) {
              toaster.toast({ title: "设置失败", body: e?.message || String(e) });
            }
          }}
          onActivate={async () => {
            try {
              await api.setVolumeBaseline(state.live?.volume ?? state.volume.volume);
              refresh();
            } catch { /* ignore */ }
          }}
          style={{ padding: "8px 16px", borderRadius: 18, background: "rgba(255,255,255,0.08)", color: COLORS.text, fontSize: 13, cursor: "pointer" }}
        >以当前音量为准</Focusable>
        <Focusable
          onClick={async () => {
            try { await api.resetVolumeBaseline(); refresh(); } catch { /* ignore */ }
          }}
          onActivate={async () => {
            try { await api.resetVolumeBaseline(); refresh(); } catch { /* ignore */ }
          }}
          style={{ padding: "8px 16px", borderRadius: 18, background: "rgba(255,255,255,0.08)", color: COLORS.sub, fontSize: 13, cursor: "pointer" }}
        >重置</Focusable>
      </Focusable>

      <SectionTitle>延迟档位</SectionTitle>
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
                  toaster.toast({ title: `延迟档位：${p.label}`, body: "WirePlumber 已重启" });
                  setTimeout(refresh, 1200);
                } catch (e: any) {
                  toaster.toast({ title: "切换失败", body: e?.message || String(e) });
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
              <div style={{ fontSize: 11, color: COLORS.accent, marginTop: 2 }}>约 {p.latency_ms}ms</div>
              <div style={{ fontSize: 11, color: COLORS.dim, marginTop: 3, lineHeight: 1.4 }}>{p.desc}</div>
            </Focusable>
          );
        })}
      </Focusable>

      <SectionTitle>多输出同步</SectionTitle>
      <ToggleRow
        label="创建一个「Deck 多输出」设备"
        desc="声音同时送到内置喇叭 + 蓝牙耳机 + 有线耳机。开启后在系统音量里把输出切到「Deck 多输出（同步）」。"
        checked={!!s.multi_output}
        onChange={async (v) => {
          try {
            await api.setMultiOutput(v);
            toaster.toast({ title: v ? "已开启多输出同步" : "已关闭多输出同步", body: "PipeWire 已重启" });
            setTimeout(refresh, 1500);
          } catch (e: any) {
            toaster.toast({ title: "操作失败", body: e?.message || String(e) });
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

      <SectionTitle>行为</SectionTitle>
      <ToggleRow
        label="插件加载时自动进入可被发现"
        desc="打开 Decky 后自动开好蓝牙，省得每次手动点"
        checked={!!s.auto_start}
        onChange={(v) => save("auto_start", v, v ? "已开启自动启动" : "已关闭自动启动")}
      />
      <ToggleRow
        label="保持可被发现"
        desc="BlueZ 默认 180 秒后自动隐藏，这里每分钟复查一次"
        checked={!!s.keep_alive}
        onChange={(v) => save("keep_alive", v, v ? "已开启保活" : "已关闭保活")}
      />
      <ToggleRow
        label="睡眠唤醒后自动恢复"
        desc={
          state.power?.watching
            ? `已监听（${state.power.backend}）：唤醒后自动恢复可发现并重连上次的设备`
            : "监听 logind 的睡眠信号，唤醒后自动恢复蓝牙状态（合盖再开盖不会失联）"
        }
        checked={!!s.resume_restore}
        onChange={(v) => save("resume_restore", v, v ? "已开启唤醒恢复" : "已关闭唤醒恢复")}
      />
      {state.power?.watching && (
        <Hint>
          已捕获 {state.power.events} 次睡眠/唤醒事件
          {state.power.last ? `，最近一次：${state.power.last[0] === "sleep" ? "睡眠" : "唤醒"}` : ""}
          {s.last_device ? ` · 上次设备 ${s.last_device}` : ""}
        </Hint>
      )}

      <SectionTitle>系统信息</SectionTitle>
      <div style={{ fontSize: 13, color: COLORS.sub, lineHeight: 1.9 }}>
        <div>PipeWire：{state.versions?.pipewire || "未知"}</div>
        <div>WirePlumber：{state.versions?.wireplumber || "未知"}</div>
        <div>BlueZ：{state.versions?.bluez || "未知"}</div>
        <div>默认输出：{state.sink || "未知"}</div>
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
      toaster.toast({ title: "均衡器已切换", body: "PipeWire 已重启，可能有一两秒静音" });
      setTimeout(refresh, 1500);
    } catch (e: any) {
      toaster.toast({ title: "切换失败", body: e?.message || String(e) });
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
        title: `已导入 ${r.bands} 段 EQ`,
        body: r.skipped ? `跳过 ${r.skipped} 行无法识别` : "PipeWire 已重启",
      });
      setShowImport(false);
      setImportText("");
      setTimeout(refresh, 1500);
    } catch (e: any) {
      toaster.toast({ title: "导入失败", body: e?.message || String(e) });
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
      <SectionTitle>预设</SectionTitle>
      <Hint>
        用 PipeWire 内置的 param_eq（不依赖任何外部插件）。切换会重启 PipeWire，可能有一两秒静音。
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
                  {p.label}{isBusy ? "（应用中…）" : ""}
                </div>
                <div style={{ fontSize: 11.5, color: COLORS.dim, marginTop: 3 }}>{p.desc}</div>
              </div>
              {p.bands > 0 && <Pill>{p.bands} 段</Pill>}
            </Focusable>
          );
        })}
        {current === "custom" && (
          <Card active>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, color: COLORS.text }}>自定义（AutoEQ 导入）</div>
              <div style={{ fontSize: 11.5, color: COLORS.dim, marginTop: 3 }}>当前正在使用导入的曲线</div>
            </div>
            <Pill tone="accent">生效中</Pill>
          </Card>
        )}
      </Focusable>

      <SectionTitle>导入 AutoEQ / Squiglink 曲线</SectionTitle>
      <Hint>
        从 <span style={{ color: COLORS.sub }}>AutoEq</span> 或 <span style={{ color: COLORS.sub }}>squig.link</span> 复制
        ParametricEQ.txt 的内容粘进来。格式形如 `Filter 1: ON PK Fc 21 Hz Gain 6.7 dB Q 1.100`。
      </Hint>
      <Focusable flow-children="row" style={{ display: "flex", gap: 10, marginTop: 8 }}>
        <Focusable
          onClick={() => setShowImport(!showImport)}
          onActivate={() => setShowImport(!showImport)}
          style={{ padding: "8px 16px", borderRadius: 18, background: "rgba(255,255,255,0.08)", color: COLORS.text, fontSize: 13, cursor: "pointer" }}
        >{showImport ? "收起" : "粘贴曲线…"}</Focusable>
        {state.eq?.installed && (
          <Focusable
            onClick={async () => {
              try {
                await api.removeEq();
                toaster.toast({ title: "已移除均衡器", body: "PipeWire 已重启" });
                setTimeout(refresh, 1500);
              } catch (e: any) {
                toaster.toast({ title: "移除失败", body: e?.message || String(e) });
              }
            }}
            onActivate={async () => {
              try { await api.removeEq(); setTimeout(refresh, 1500); } catch { /* ignore */ }
            }}
            style={{ padding: "8px 16px", borderRadius: 18, background: "rgba(236,65,65,0.14)", color: COLORS.accentWarm, fontSize: 13, cursor: "pointer" }}
          >完全移除 EQ</Focusable>
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
          >{busy === "import" ? "导入中…" : "导入并应用"}</Focusable>
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
      toaster.toast({ title: "诊断失败", body: e?.message || String(e) });
    } finally {
      setLoading(false);
    }
  };

  const loadLog = async () => {
    try {
      setLog(await api.getLog(200));
    } catch (e: any) {
      toaster.toast({ title: "读取日志失败", body: e?.message || String(e) });
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
          {loading ? "读取中…" : "重新读取"}
        </Focusable>
        <Focusable onClick={loadLog} onActivate={loadLog} style={{ padding: "8px 16px", borderRadius: 18, background: "rgba(255,255,255,0.08)", color: COLORS.text, fontSize: 13, cursor: "pointer" }}>
          查看日志
        </Focusable>
        <Focusable
          onClick={async () => {
            try {
              const r = await api.report();
              setReport(r.text);
              try {
                await navigator.clipboard.writeText(r.text);
                toaster.toast({ title: "诊断报告已复制", body: "直接粘贴给作者即可" });
              } catch {
                toaster.toast({ title: "报告已生成", body: "下面可手动选中复制" });
              }
            } catch (e: any) {
              toaster.toast({ title: "生成失败", body: e?.message || String(e) });
            }
          }}
          onActivate={async () => {
            try { const r = await api.report(); setReport(r.text); } catch { /* ignore */ }
          }}
          style={{ padding: "8px 16px", borderRadius: 18, background: "rgba(76,154,255,0.18)", color: COLORS.accent, fontSize: 13, cursor: "pointer" }}
        >复制诊断报告</Focusable>
      </Focusable>

      {report && (
        <>
          <SectionTitle>完整报告</SectionTitle>
          <div style={box}>{report}</div>
        </>
      )}

      {data && (
        <>
          <SectionTitle>自检</SectionTitle>
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

          <SectionTitle>后端模块</SectionTitle>
          <div style={{ fontSize: 13, color: COLORS.sub, lineHeight: 1.9 }}>
            {Object.entries(data.modules || {}).map(([k, v]: any) => (
              <div key={k}>{v ? "✅" : "❌"} {k}.py</div>
            ))}
          </div>

          <SectionTitle>命令可用性</SectionTitle>
          <div style={{ fontSize: 13, color: COLORS.sub, lineHeight: 1.9 }}>
            {Object.entries(data.tools || {}).map(([k, v]: any) => (
              <div key={k}>{v ? "✅" : "❌"} {k}</div>
            ))}
            <div>{data.agent ? "✅" : "❌"} 配对 agent</div>
          </div>

          <SectionTitle>适配器原始信息</SectionTitle>
          <div style={box}>{data.adapter_raw || "（空）"}</div>

          <SectionTitle>音频状态</SectionTitle>
          <div style={box}>{data.wp_status || "（空）"}</div>
        </>
      )}

      {log && (
        <>
          <SectionTitle right={<span style={{ fontSize: 11, color: COLORS.dim }}>{log.path}</span>}>插件日志</SectionTitle>
          <div style={box}>{log.text || "（空）"}</div>
        </>
      )}
    </div>
  );
}
