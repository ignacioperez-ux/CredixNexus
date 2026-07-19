"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import type { AlertData, AlertRow } from "@/lib/observability/queries";
import { acknowledgeAlert, resolveAlert, createCaseFromAlert } from "@/lib/observability/actions";
import { SeverityBadge, AlertStatusBadge } from "./badges";
import { useListFilters, FilterBar, Drill, type FilterDef } from "@/components/common/filters";

export function AlertsTab({ data, canManage }: { data: AlertData; canManage: boolean }) {
  const { t, locale } = useI18n();
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const head: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "#8A948A", padding: "10px 12px", background: "var(--head-bg)" };

  const defs: FilterDef<AlertRow>[] = [
    { key: "sev", label: t("obs.col.severity"), get: (a) => a.severity, allLabel: t("obs.filter.allsev"), render: (v) => t(("obs.sev." + v) as MessageKey) },
    { key: "status", label: t("obs.col.status"), get: (a) => a.status, allLabel: t("obs.filter.allstatus"), render: (v) => t(("obs.st." + v) as MessageKey) },
    { key: "source", label: t("obs.col.source"), get: (a) => a.source, allLabel: t("obs.filter.allsource") },
  ];
  const f = useListFilters(data.alerts, defs);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("obs.alerts.intro")}</div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        <Kpi label={t("obs.kpi.open")} value={String(data.stats.open)} color={data.stats.open > 0 ? "var(--st-high-fg)" : undefined} />
        <Kpi label={t("obs.kpi.critical")} value={String(data.stats.critical)} color={data.stats.critical > 0 ? "var(--st-critical-fg)" : undefined} />
        <Kpi label={t("obs.kpi.ack")} value={String(data.stats.acknowledged)} />
        <Kpi label={t("obs.kpi.correlated")} value={String(data.stats.correlated)} color="var(--accent-2)" />
      </div>

      {msg && (
        <div style={{ fontSize: 12.5, fontWeight: 600, padding: "9px 14px", borderRadius: "var(--r-md)", background: msg.kind === "ok" ? "var(--st-low-bg)" : "var(--st-critical-bg)", color: msg.kind === "ok" ? "var(--st-low-fg)" : "var(--st-critical-fg)" }}>{msg.text}</div>
      )}

      <FilterBar defs={defs} filters={f} />

      <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "90px 1.7fr 110px 130px 70px 120px 150px 210px", minWidth: 900 }}>
            {[t("obs.col.severity"), t("obs.col.title"), t("obs.col.source"), t("obs.col.system"), t("obs.col.occ"), t("obs.col.status"), t("obs.col.seen"), ""].map((h, i) => <div key={i} style={head}>{h}</div>)}
            {f.filtered.length === 0 && <div style={{ gridColumn: "1 / -1", padding: 36, textAlign: "center", color: "var(--muted)" }}>{t("obs.alerts.empty")}</div>}
            {f.filtered.map((a) => (
              <div key={a.id} style={{ display: "contents" }}>
                <Cell><Drill onClick={() => f.set("sev", a.severity)}><SeverityBadge severity={a.severity} /></Drill></Cell>
                <Cell>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={{ color: "var(--text)" }}>{a.title}</span>
                    {a.correlated_number && <span style={{ fontSize: 10.5, color: "var(--accent-2)", fontFamily: "var(--font-mono)" }}>{t("obs.col.case")}: {a.correlated_number}</span>}
                    {a.vendor_name && <span style={{ fontSize: 10.5, color: "var(--muted)" }}>{a.vendor_name}</span>}
                  </div>
                </Cell>
                <Cell muted><Drill onClick={() => f.set("source", a.source)}>{a.source}</Drill></Cell>
                <Cell muted>{a.affected_system ?? a.service_name ?? "—"}</Cell>
                <Cell mono muted>{a.occurrence_count}</Cell>
                <Cell><Drill onClick={() => f.set("status", a.status)}><AlertStatusBadge status={a.status} /></Drill></Cell>
                <Cell mono muted>{new Date(a.last_seen_at).toLocaleString(locale, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</Cell>
                <Cell><RowActions alert={a} canManage={canManage} onMsg={setMsg} /></Cell>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function RowActions({ alert, canManage, onMsg }: { alert: AlertRow; canManage: boolean; onMsg: (m: { kind: "ok" | "err"; text: string }) => void }) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();

  function run(fn: () => Promise<{ ok: boolean; error?: string; incidentId?: string }>, okKey: MessageKey) {
    start(async () => {
      const r = await fn();
      if (!r.ok) onMsg({ kind: "err", text: t(("err." + (r.error ?? "ERR_INVALID_STATE")) as MessageKey) });
      else { onMsg({ kind: "ok", text: t(okKey) }); router.refresh(); }
    });
  }

  const canAck = alert.status === "open";
  const canCase = alert.status === "open" || alert.status === "acknowledged";
  const canResolve = alert.status !== "resolved";

  if (!canManage) {
    return alert.correlated_case_id
      ? <Link href={`/incidents/${alert.correlated_case_id}`} style={btnLink}>{t("obs.act.viewcase")}</Link>
      : <span style={{ fontSize: 11, color: "var(--muted)" }}>—</span>;
  }

  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {alert.correlated_case_id && <Link href={`/incidents/${alert.correlated_case_id}`} style={btnLink}>{t("obs.act.viewcase")}</Link>}
      {canAck && <button disabled={pending} onClick={() => run(() => acknowledgeAlert(alert.id), "obs.msg.ack")} style={btn()}>{pending ? t("obs.act.working") : t("obs.act.ack")}</button>}
      {canCase && <button disabled={pending} onClick={() => run(() => createCaseFromAlert(alert.id), "obs.msg.created")} style={btn(true)}>{t("obs.act.createcase")}</button>}
      {canResolve && <button disabled={pending} onClick={() => run(() => resolveAlert(alert.id), "obs.msg.resolved")} style={btn()}>{t("obs.act.resolve")}</button>}
    </div>
  );
}

const btnLink: React.CSSProperties = { fontSize: 11, fontWeight: 600, padding: "5px 10px", borderRadius: "var(--r-md)", background: "var(--accent-soft)", color: "var(--accent-2)", textDecoration: "none" };
function btn(cta?: boolean): React.CSSProperties {
  return { fontSize: 11, fontWeight: 600, padding: "5px 10px", borderRadius: "var(--r-md)", border: cta ? "none" : "1px solid var(--line)", background: cta ? "var(--cta-bg)" : "transparent", color: cta ? "var(--cta-fg)" : "var(--text)", cursor: "pointer" };
}

const cellSt: React.CSSProperties = { fontSize: 12.5, padding: "11px 12px", borderTop: "1px solid var(--line-soft)", display: "flex", alignItems: "center", color: "var(--text)" };
function Cell({ children, mono, muted }: { children: React.ReactNode; mono?: boolean; muted?: boolean }) {
  return <div style={{ ...cellSt, fontFamily: mono ? "var(--font-mono)" : "var(--font-ui)", color: muted ? "var(--muted)" : "var(--text)" }}>{children}</div>;
}
function Kpi({ label, value, color }: { label: string; value: string; color?: string }) {
  return <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 16 }}>
    <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--muted)", marginBottom: 10 }}>{label}</div>
    <div style={{ fontFamily: "var(--font-mono)", fontWeight: 500, fontSize: 22, letterSpacing: "-1px", color: color ?? "var(--text)" }}>{value}</div></div>;
}
