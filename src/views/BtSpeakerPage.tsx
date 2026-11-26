import { useEffect, useState } from "react";
import { Focusable } from "@decky/ui";
import { toaster } from "@decky/api";
import { api } from "../backend";
import { useSpeaker } from "../store";
import { COLORS } from "../route";
import { Pill, ErrorText, Hint, Avatar, SectionTitle, Loading } from "../components";

type Tab = "devices" | "settings" | "diag";

export function BtSpeakerPage() {
  const { state, error, refresh } = useSpeaker();
  const [tab, setTab] = useState<Tab>("devices");
  const [busyMac, setBusyMac] = useState<string | null>(null);

  const ad = state?.adapter;
  const paired = state?.paired || [];
  const connectedMacs = new Set((state?.connected || []).map((d) => d.mac));

  const act = async (mac: string, action: "connect" | "disconnect" | "remove", label: string) => {
    if (busyMac) return;
    setBusyMac(mac);
    try {
      await api.deviceAction(mac, action);
      toaster.toast({ title: label, body: "" });
      setTimeout(refresh, 600);
    } catch (e: any) {
      toaster.toast({ title: "操作失败", body: e?.message || String(e) });
    } finally {
      setBusyMac(null);
    }
  };

  return (
    <div style={{
      position: "absolute", inset: 0, overflowY: "auto", background: COLORS.bg,
      padding: "18px 34px 40px", display: "flex", flexDirection: "column",
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
          {tab === "diag" && <DiagTab />}
        </>
      )}
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
  onAction: (mac: string, action: "connect" | "disconnect" | "remove", label: string) => void;
  discoverable: boolean;
  alias: string;
}) {
  if (!paired.length) {
    return (
      <div style={{ marginTop: 22 }}>
        <Hint>
          还没有配对过任何设备。{discoverable ? <>现在用手机或电脑的蓝牙列表搜索 <b style={{ color: COLORS.sub }}>{alias}</b>，配对一次之后就会出现在这里。</> : "先回设置里打开「可被发现」。"}
        </Hint>
      </div>
    );
  }
  return (
    <div style={{ marginTop: 16 }}>
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
      <Hint>连接成功后在手机上播放音乐，声音就会从 Deck 的喇叭出来。同一时间只能有一个源在放（蓝牙 A2DP 的限制）。</Hint>
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
function DiagTab() {
  const [data, setData] = useState<any>(null);
  const [log, setLog] = useState<{ path: string; text: string } | null>(null);
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
      </Focusable>

      {data && (
        <>
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
