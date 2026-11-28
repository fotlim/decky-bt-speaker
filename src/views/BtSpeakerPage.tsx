/**
 * 全屏管理页 —— 只负责「外壳」：布局、Tab 切换、头部状态。
 *
 * 重构说明
 * --------
 * 这个文件原来有 1255 行，把 4 个 Tab 的内容全塞在一起：
 * 设备列表 + 扫描面板 + 设置 + 均衡器 + 诊断。
 *
 * 现在拆成：
 *   - `page/DevicesTab.tsx`  设备与扫描
 *   - `page/SettingsTab.tsx` 设置（最大的一块）
 *   - `page/EqTab.tsx`       均衡器
 *   - `page/DiagTab.tsx`     诊断
 *   - 本文件                 布局 + 头部 + Tab 切换（约 150 行）
 *
 * 好处：改设置不用在 1200 行里滚，改设备列表也不怕碰到设置。
 */

import { useState } from "react";
import { Focusable } from "@decky/ui";
import { useSpeaker } from "../store";
import { COLORS, SPACE, FONT, RADIUS } from "../theme";
import { Pill, ErrorText, Loading } from "../components";
import { t } from "../i18n";
import { DevicesTab } from "./page/DevicesTab";
import { SettingsTab } from "./page/SettingsTab";
import { EqTab } from "./page/EqTab";
import { DiagTab } from "./page/DiagTab";

type Tab = "devices" | "settings" | "eq" | "diag";

const TABS: [Tab, string][] = [
  ["devices", "tab.devices"],
  ["settings", "tab.settings"],
  ["eq", "tab.eq"],
  ["diag", "tab.diag"],
];

export function BtSpeakerPage() {
  const { state, error, refresh } = useSpeaker();
  const [tab, setTab] = useState<Tab>("devices");

  const ad = state?.adapter;

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
      <div
        className="bt-scroll"
        style={{
          flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden",
          display: "flex", flexDirection: "column",
          paddingBottom: SPACE.xl,
        }}
      >
        <Header
          alias={ad?.alias}
          address={ad?.address}
          powered={!!ad?.powered}
          discoverable={!!ad?.discoverable}
          a2dpSink={!!ad?.a2dp_sink}
        />

        {error && <ErrorText text={error} />}

        <TabBar tab={tab} onChange={setTab} />

        {!state ? <Loading text={t("page.readingAdapter")} /> : (
          <>
            {tab === "devices" && (
              <DevicesTab
                paired={state.paired || []}
                connectedMacs={new Set((state.connected || []).map((d) => d.mac))}
                discoverable={!!ad?.discoverable}
                alias={ad?.alias || ""}
                onRefresh={refresh}
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
// 头部：标题 + 副标题 + 状态徽章
// ---------------------------------------------------------------------------
function Header({
  alias, address, powered, discoverable, a2dpSink,
}: {
  alias?: string; address?: string;
  powered: boolean; discoverable: boolean; a2dpSink: boolean;
}) {
  return (
    <div style={{
      display: "flex", alignItems: "flex-start", justifyContent: "space-between",
      gap: SPACE.xl, marginBottom: SPACE.md,
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: FONT.page, fontWeight: 700, color: COLORS.text }}>
          {t("page.title")}
        </div>
        <div style={{
          fontSize: FONT.body, color: COLORS.sub, marginTop: 3,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>
          {alias ? `${alias} · ${address || t("common.unknown")}` : t("page.readingAdapter")}
        </div>
      </div>
      <Focusable flow-children="row" style={{
        display: "flex", gap: SPACE.sm, flexWrap: "wrap",
        justifyContent: "flex-end", flexShrink: 0, maxWidth: "45%",
      }}>
        <Pill tone={powered ? "ok" : "warn"}>
          {powered ? t("qam.btOn") : t("qam.btOff")}
        </Pill>
        <Pill tone={discoverable ? "accent" : "neutral"}>
          {discoverable ? t("qam.discoverable") : t("qam.notVisible")}
        </Pill>
        <Pill tone={a2dpSink ? "ok" : "warn"}>
          {a2dpSink ? t("page.a2dpSink") : t("page.noSink")}
        </Pill>
      </Focusable>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 切换
// ---------------------------------------------------------------------------
function TabBar({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <Focusable flow-children="row" style={{
      display: "flex", gap: SPACE.sm, margin: `${SPACE.lg}px 0 ${SPACE.xs}px`,
      borderBottom: `1px solid ${COLORS.border}`, paddingBottom: SPACE.xs,
    }}>
      {TABS.map(([k, key]) => {
        const active = tab === k;
        return (
          <Focusable
            key={k}
            onActivate={() => onChange(k)}
            onClick={() => onChange(k)}
            style={{
              padding: `${SPACE.md}px ${SPACE.xl}px`,
              borderRadius: RADIUS.sm,
              cursor: "pointer",
              fontSize: FONT.bodyLg,
              fontWeight: active ? 600 : 400,
              background: active ? COLORS.accent : "transparent",
              color: active ? "#fff" : COLORS.sub,
              transition: "background 0.12s, color 0.12s",
            }}
          >{t(key)}</Focusable>
        );
      })}
    </Focusable>
  );
}
