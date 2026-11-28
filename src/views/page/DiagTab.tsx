/**
 * 诊断 Tab：自检项 / 模块状态 / 工具可用性 / 原始输出 / 日志。
 *
 * 用途：用户报问题时，这里能一键生成可直接粘贴的报告。
 * 所有文案都走 i18n（后端只返回 `chk.*` key，不返回中文）。
 */

import { useEffect, useState } from "react";
import { Focusable } from "@decky/ui";
import { toaster } from "@decky/api";
import { api } from "../../backend";
import type { CheckItem } from "../../types";
import { COLORS, SPACE, FONT, RADIUS, TONES } from "../../theme";
import {
  Btn, Pill, Hint, SectionTitle, GroupTitle, Stack, errMsg,
} from "../../components";
import { t } from "../../i18n";

export function DiagTab() {
  const [data, setData] = useState<any>(null);
  const [log, setLog] = useState<{ path: string; text: string } | null>(null);
  const [report, setReport] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setData(await api.diagnose());
    } catch (e) {
      toaster.toast({ title: t("toast.failed"), body: errMsg(e) });
    } finally {
      setLoading(false);
    }
  };

  const loadLog = async () => {
    try {
      setLog(await api.getLog(200));
    } catch (e) {
      toaster.toast({ title: t("toast.failed"), body: errMsg(e) });
    }
  };

  const genReport = async () => {
    try {
      const r = await api.report();
      setReport(r.text);
      toaster.toast({ title: t("diag.generated"), body: t("diag.generatedBody") });
    } catch (e) {
      toaster.toast({ title: t("toast.failed"), body: errMsg(e) });
    }
  };

  const copyReport = async () => {
    try {
      const text = report || (await api.report()).text;
      await navigator.clipboard.writeText(text);
      toaster.toast({ title: t("diag.copied"), body: t("diag.copiedBody") });
    } catch (e) {
      toaster.toast({ title: t("toast.failed"), body: errMsg(e) });
    }
  };

  useEffect(() => { load(); }, []);

  const box: React.CSSProperties = {
    marginTop: SPACE.md, padding: SPACE.lg, borderRadius: RADIUS.sm,
    background: "rgba(0,0,0,0.35)",
    fontSize: FONT.caption, color: COLORS.sub, fontFamily: "monospace",
    whiteSpace: "pre-wrap", maxHeight: 340, overflowY: "auto",
    lineHeight: 1.55, border: `1px solid ${COLORS.border}`,
  };

  return (
    <div style={{ marginTop: SPACE.xl }}>
      <Focusable flow-children="row" style={{ display: "flex", gap: SPACE.md, flexWrap: "wrap" }}>
        <Btn variant="ghost" onClick={load} disabled={loading}>
          {loading ? t("common.reading") : t("common.retry")}
        </Btn>
        <Btn variant="primary" onClick={genReport}>{t("diag.report")}</Btn>
        <Btn variant="ghost" onClick={copyReport}>{t("diag.copy")}</Btn>
        <Btn variant="ghost" onClick={loadLog}>{t("diag.viewLog")}</Btn>
      </Focusable>

      {data?.checks?.length > 0 && (
        <>
          <SectionTitle>{t("diag.checks")}</SectionTitle>
          <Stack gap={SPACE.sm}>
            {(data.checks as CheckItem[]).map((c, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: SPACE.md,
                padding: `${SPACE.md}px ${SPACE.lg}px`, borderRadius: RADIUS.sm,
                background: COLORS.surface, border: `1px solid ${COLORS.border}`,
              }}>
                <Pill tone={c.ok ? "ok" : "warn"}>{c.ok ? "✓" : "✗"}</Pill>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: FONT.body, color: COLORS.text }}>{t(c.key)}</div>
                  {c.detail && (
                    <div style={{ fontSize: FONT.caption, color: COLORS.dim, marginTop: 1 }}>
                      {c.detail}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </Stack>
        </>
      )}

      {data?.modules && (
        <>
          <GroupTitle>{t("diag.modules")}</GroupTitle>
          <Focusable flow-children="row" style={{ display: "flex", gap: SPACE.sm, flexWrap: "wrap" }}>
            {Object.entries(data.modules as Record<string, boolean>).map(([k, v]) => (
              <Pill key={k} tone={v ? "ok" : "warn"}>{k}</Pill>
            ))}
          </Focusable>
        </>
      )}

      {data?.tools && (
        <>
          <GroupTitle>{t("diag.tools")}</GroupTitle>
          <Focusable flow-children="row" style={{ display: "flex", gap: SPACE.sm, flexWrap: "wrap" }}>
            {Object.entries(data.tools as Record<string, boolean>).map(([k, v]) => (
              <Pill key={k} tone={v ? "ok" : "warn"}>{k}</Pill>
            ))}
          </Focusable>
        </>
      )}

      {data?.agent !== undefined && (
        <>
          <GroupTitle>{t("diag.agent")}</GroupTitle>
          <Pill tone={data.agent ? "ok" : "warn"}>
            {data.agent ? t("set.agentReady") : t("set.agentDown")}
          </Pill>
        </>
      )}

      {data?.adapter_raw && (
        <>
          <GroupTitle>{t("diag.adapterRaw")}</GroupTitle>
          <div style={box}>{data.adapter_raw}</div>
        </>
      )}

      {data?.wp_status && (
        <>
          <GroupTitle>{t("diag.wpStatus")}</GroupTitle>
          <div style={box}>{data.wp_status}</div>
        </>
      )}

      {report && (
        <>
          <GroupTitle>{t("diag.report")}</GroupTitle>
          <div style={box}>{report}</div>
        </>
      )}

      {log && (
        <>
          <GroupTitle>{t("diag.pluginLog")}</GroupTitle>
          <Hint>{log.path}</Hint>
          <div style={box}>{log.text || t("common.empty")}</div>
        </>
      )}
    </div>
  );
}
