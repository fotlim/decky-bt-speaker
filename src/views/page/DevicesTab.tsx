/**
 * 设备 Tab：已配对设备列表 + 附近设备扫描。
 *
 * 重构要点
 * --------
 * - 设备行原来内联了 5 个按钮，每个都手写 padding/borderRadius（3 种尺寸）。
 *   现在统一走 `Btn`（`small` 控制紧凑度），一行代码一个按钮。
 * - 按钮太多挤在一行（连接/信任/修复/移除 = 4 个），Deck 屏幕上很挤。
 *   现在按重要性分层：**连接**是主操作（大按钮），其余三个收成图标按钮。
 * - 「显示没有名称的设备」开关同时作用于已配对列表和扫描结果（保留原有行为）。
 */

import { useEffect, useRef, useState } from "react";
import { Focusable } from "@decky/ui";
import { toaster } from "@decky/api";
import { api } from "../../backend";
import type { BtDevice } from "../../types";
import { COLORS, SPACE, FONT, RADIUS, TONES } from "../../theme";
import {
  Btn, Pill, Hint, Avatar, SectionTitle, EllipsisText, ToggleRow, errMsg,
} from "../../components";
import { t } from "../../i18n";

type DevAction =
  | "connect" | "disconnect" | "remove" | "repair"
  | "trust" | "untrust" | "block" | "unblock";

export function DevicesTab({
  paired, connectedMacs, discoverable, alias, onRefresh,
}: {
  paired: BtDevice[];
  connectedMacs: Set<string>;
  discoverable: boolean;
  alias: string;
  onRefresh: () => void;
}) {
  const [showUnnamed, setShowUnnamed] = useState(true);
  const [busyMac, setBusyMac] = useState<string | null>(null);

  const shownPaired = showUnnamed ? paired : paired.filter((d) => d.has_real_name !== false);
  const hiddenPaired = paired.length - shownPaired.length;

  /** 统一的设备操作入口（连接/断开/信任/修复/移除都走这里）。 */
  const act = async (mac: string, action: DevAction, okMsg: string) => {
    if (busyMac) return;
    setBusyMac(mac);
    try {
      if (action === "repair") {
        await api.repairDevice(mac);
      } else {
        await api.deviceAction(mac, action);
      }
      toaster.toast({ title: okMsg, body: "" });
      setTimeout(onRefresh, 800);
    } catch (e) {
      toaster.toast({ title: t("toast.failed"), body: errMsg(e) });
    } finally {
      setBusyMac(null);
    }
  };

  return (
    <div style={{ marginTop: SPACE.xl }}>
      <ScanPanel
        alias={alias}
        discoverable={discoverable}
        onPaired={onRefresh}
        showUnnamed={showUnnamed}
        busyMac={busyMac}
        setBusyMac={setBusyMac}
      />

      <div style={{ marginTop: SPACE.lg }}>
        <ToggleRow
          label={t("dev.showUnnamed")}
          desc={t("dev.showUnnamedDesc")}
          checked={showUnnamed}
          onChange={setShowUnnamed}
        />
      </div>

      {!paired.length ? (
        <Hint>{t("dev.noDevices")}</Hint>
      ) : (
        <>
          <SectionTitle>{t("dev.pairedCount", { n: shownPaired.length })}</SectionTitle>
          {!showUnnamed && hiddenPaired > 0 && (
            <Hint>{t("dev.hiddenPaired", { n: hiddenPaired })}</Hint>
          )}
          <Focusable flow-children="column">
            {shownPaired.map((d) => (
              <PairedRow
                key={d.mac}
                device={d}
                connected={connectedMacs.has(d.mac)}
                busy={busyMac === d.mac}
                onAct={act}
              />
            ))}
          </Focusable>
          <Hint>
            {t("dev.hint")}
            <br />
            <b style={{ color: COLORS.sub }}>{t("dev.hintPair")}</b>
          </Hint>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 已配对设备的一行
// ---------------------------------------------------------------------------
function PairedRow({
  device, connected, busy, onAct,
}: {
  device: BtDevice;
  connected: boolean;
  busy: boolean;
  onAct: (mac: string, action: DevAction, okMsg: string) => void;
}) {
  const d = device;
  const label = devLabel(d);

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: SPACE.lg,
      padding: `${SPACE.lg}px ${SPACE.xl}px`, marginBottom: SPACE.md,
      borderRadius: RADIUS.lg, background: COLORS.surface,
      border: `1px solid ${connected ? TONES.ok.border : COLORS.border}`,
    }}>
      <Avatar connected={connected} icon={d.icon} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <EllipsisText size={FONT.bodyLg}>{label}</EllipsisText>
        <div style={{
          display: "flex", alignItems: "center", gap: SPACE.sm,
          fontSize: FONT.small, color: COLORS.dim, marginTop: 2, flexWrap: "wrap",
        }}>
          <span>{d.mac}</span>
          {connected && <Pill tone="ok">{t("dev.connected")}</Pill>}
          {d.trusted === false && <Pill tone="warn">{t("dev.untrusted")}</Pill>}
          {d.blocked && <Pill tone="warn">{t("dev.blocked")}</Pill>}
          {d.has_real_name === false && (
            <span style={{ color: COLORS.warn }}>· {t("dev.noName")}</span>
          )}
        </div>
      </div>

      {/* 主操作：连接 / 断开 */}
      <Btn
        variant={connected ? "ghost" : "primary"}
        disabled={busy}
        onClick={() => onAct(
          d.mac,
          connected ? "disconnect" : "connect",
          connected ? t("dev.disconnected") : t("dev.connectedToast", { name: label }),
        )}
      >
        {busy ? "…" : connected ? t("qam.disconnect") : t("dev.connect")}
      </Btn>

      {/* 次要操作收成小按钮，减少视觉噪音 */}
      <Btn
        small
        variant={d.trusted === false ? "ghost" : "ok"}
        disabled={busy}
        title={t("dev.trust")}
        onClick={() => onAct(
          d.mac,
          d.trusted === false ? "trust" : "untrust",
          d.trusted === false ? t("dev.trustedOn") : t("dev.trustedOff"),
        )}
      >
        {d.trusted === false ? t("dev.trust") : t("dev.untrust")}
      </Btn>
      <Btn small variant="ghost" disabled={busy} onClick={() => onAct(d.mac, "repair", t("dev.repairing"))}>
        {t("dev.repair")}
      </Btn>
      <Btn small variant="danger" disabled={busy} onClick={() => onAct(d.mac, "remove", t("dev.removed"))}>
        {t("common.remove")}
      </Btn>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 扫描面板：流式出结果（边扫边显示）
// ---------------------------------------------------------------------------
function ScanPanel({
  alias, discoverable, onPaired, showUnnamed, busyMac, setBusyMac,
}: {
  alias: string;
  discoverable: boolean;
  onPaired: () => void;
  showUnnamed: boolean;
  busyMac: string | null;
  setBusyMac: (v: string | null) => void;
}) {
  const [scanning, setScanning] = useState(false);
  const [devices, setDevices] = useState<BtDevice[]>([]);
  const [scanned, setScanned] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const pollRef = useRef<any>(null);
  const tickRef = useRef<any>(null);
  const autoRef = useRef<any>(null);

  // 扫描时每 2 秒拉一次结果，边扫边出
  const startScan = async () => {
    if (scanning) return;
    setScanning(true);
    setScanned(false);
    setDevices([]);
    setElapsed(0);
    try {
      await api.scanStart(20);
      const started = Date.now();
      tickRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - started) / 1000));
      }, 500);
      pollRef.current = setInterval(async () => {
        try {
          const r = await api.scanList();
          setDevices(r.devices || []);
        } catch { /* 轮询失败不打断扫描 */ }
      }, 2000);
      const r0 = await api.scanList();
      setDevices(r0.devices || []);
      autoRef.current = setTimeout(() => finishScan(), 20500);
    } catch (e) {
      toaster.toast({ title: t("toast.failed"), body: errMsg(e) });
      finishScan();
    }
  };

  const finishScan = async () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
    if (autoRef.current) { clearTimeout(autoRef.current); autoRef.current = null; }
    try { await api.scanStop(); } catch { /* ignore */ }
    try {
      const r = await api.scanList();
      setDevices(r.devices || []);
    } catch { /* ignore */ }
    setScanning(false);
    setScanned(true);
  };

  // 卸载时清理所有定时器（含之前漏掉的 autoRef）
  useEffect(() => () => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (tickRef.current) clearInterval(tickRef.current);
    if (autoRef.current) clearTimeout(autoRef.current);
  }, []);

  const pair = async (mac: string, name: string, alreadyPaired: boolean) => {
    if (busyMac) return;
    setBusyMac(mac);
    try {
      if (alreadyPaired) {
        await api.deviceAction(mac, "connect");
        toaster.toast({ title: t("dev.connectedToast", { name }), body: "" });
      } else {
        await api.pairDeviceFull(mac);
        toaster.toast({ title: t("dev.paired", { name }), body: "" });
      }
      setDevices((prev) => prev.filter((d) => d.mac !== mac));
      onPaired();
    } catch (e) {
      toaster.toast({
        title: alreadyPaired ? t("dev.connectFailed") : t("dev.pairFailed"),
        body: errMsg(e),
      });
    } finally {
      setBusyMac(null);
    }
  };

  const shown = showUnnamed ? devices : devices.filter((d) => d.has_real_name !== false);
  const hiddenCount = devices.length - shown.length;

  return (
    <div style={{ marginBottom: SPACE.md }}>
      <SectionTitle>{t("dev.search")}</SectionTitle>
      <Hint>{discoverable ? t("dev.searchHint") : t("dev.searchHintWarn")}</Hint>

      <Focusable flow-children="row" style={{
        display: "flex", gap: SPACE.md, marginTop: SPACE.md, alignItems: "center",
      }}>
        <Btn
          variant={scanning ? "danger" : "primary"}
          onClick={scanning ? finishScan : startScan}
        >
          {scanning ? `${t("dev.stopScan")} · ${elapsed}s` : t("dev.search")}
        </Btn>
        {scanning && (
          <span style={{ fontSize: FONT.small, color: COLORS.dim }}>
            {t("dev.foundCount", { n: devices.length })}
          </span>
        )}
      </Focusable>

      {!showUnnamed && hiddenCount > 0 && (
        <Hint>{t("dev.hiddenCount", { n: hiddenCount })}</Hint>
      )}

      {shown.length > 0 && (
        <Focusable flow-children="column" style={{ marginTop: SPACE.lg }}>
          {shown.map((d) => {
            const busy = busyMac === d.mac;
            const already = !!d.paired;
            return (
              <div key={d.mac} style={{
                display: "flex", alignItems: "center", gap: SPACE.lg,
                padding: `${SPACE.lg}px ${SPACE.xl}px`, marginBottom: SPACE.md,
                borderRadius: RADIUS.lg, background: COLORS.surface,
                border: `1px solid ${COLORS.border}`,
              }}>
                <Avatar icon={d.icon} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <EllipsisText size={FONT.bodyLg}>{devLabel(d)}</EllipsisText>
                  <div style={{
                    display: "flex", alignItems: "center", gap: SPACE.sm,
                    fontSize: FONT.small, color: COLORS.dim, marginTop: 2,
                  }}>
                    <span>{d.mac}</span>
                    {typeof d.rssi === "number" && <RssiBars rssi={d.rssi} />}
                  </div>
                </div>
                <Btn
                  variant={already ? "ghost" : "primary"}
                  disabled={busy}
                  onClick={() => pair(d.mac, devLabel(d), already)}
                >
                  {busy ? t("dev.pairing") : already ? t("dev.connect") : t("dev.pair")}
                </Btn>
              </div>
            );
          })}
        </Focusable>
      )}

      {scanned && shown.length === 0 && (
        <Hint>{devices.length > 0 ? t("dev.allHidden", { n: devices.length }) : t("dev.noneFound")}</Hint>
      )}
    </div>
  );
}

/** 信号强度：4 格，越强越亮。 */
function RssiBars({ rssi }: { rssi: number }) {
  // -40 极强，-90 极弱
  const level = rssi >= -55 ? 4 : rssi >= -67 ? 3 : rssi >= -78 ? 2 : 1;
  return (
    <span style={{ display: "inline-flex", alignItems: "flex-end", gap: 1.5 }} title={`${rssi} dBm`}>
      {[1, 2, 3, 4].map((n) => (
        <span key={n} style={{
          width: 2.5, height: 3 + n * 2.5, borderRadius: 1,
          background: n <= level ? COLORS.ok : COLORS.surfaceActive,
        }} />
      ))}
    </span>
  );
}

/** 设备显示名：无名设备用本地化的「未知设备 · XX:XX」而不是后端的裸 MAC 后缀。 */
function devLabel(d: BtDevice): string {
  const disp = d.display || d.name || d.mac;
  if (d.has_real_name === false) {
    const tail = String(d.mac || "").slice(-5);
    return t("dev.unknownLabel", { mac: tail });
  }
  return disp;
}
