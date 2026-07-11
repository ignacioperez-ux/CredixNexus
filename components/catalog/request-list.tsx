"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import type { RequestRow, RequestStats } from "@/lib/catalog/queries";
import { useListFilters, FilterBar, Drill, type FilterDef } from "@/components/common/filters";

const STATUS_COLOR: Record<string, { fg: string; bg: string }> = {
  open: { fg: "var(--st-high-fg)", bg: "var(--st-high-bg)" },
  fulfilled: { fg: "var(--st-low-fg)", bg: "var(--st-low-bg)" },
  cancelled: { fg: "var(--muted)", bg: "var(--paper)" },
};

export function RequestList({ rows, stats }: { rows: RequestRow[]; stats: RequestStats }) {
  const { t, locale } = useI18n();
  const head: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "#8A948A", padding: "10px 12px", background: "var(--head-bg)" };
  const now = new Date().toISOString();

  const defs: FilterDef<RequestRow>[] = [
    { key: "status", label: t("obs.col.status"), get: (r) => r.status, allLabel: t("inc.filter.allstatus"), render: (v) => t(("cat.st." + v) as MessageKey) },
    { key: "item", label: t("cat.col.item"), get: (r) => r.item_name, allLabel: t("md.filter.all") },
  ];
  const f = useListFilters(rows, defs);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
        <Kpi label={t("cat.kpi.open")} value={String(stats.open)} color={stats.open > 0 ? "var(--st-high-fg)" : undefined} />
        <Kpi label={t("cat.kpi.fulfilled")} value={String(stats.fulfilled)} color="var(--st-low-fg)" />
        <Kpi label={t("cat.kpi.overdue")} value={String(stats.overdue)} color={stats.overdue > 0 ? "var(--st-critical-fg)" : undefined} />
      </div>
      <FilterBar defs={defs} filters={f} />
      <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "120px 1.5fr 130px 150px 110px", minWidth: 820 }}>
            {[t("cat.col.number"), t("cat.col.item"), t("cat.col.case"), t("cat.col.due"), t("obs.col.status")].map((h) => <div key={h} style={head}>{h}</div>)}
            {f.filtered.length === 0 && <div style={{ gridColumn: "1 / -1", padding: 36, textAlign: "center", color: "var(--muted)" }}>{t("cat.req.empty")}</div>}
            {f.filtered.map((r) => {
              const overdue = r.status === "open" && r.sla_due_at && r.sla_due_at < now;
              return (
                <Link key={r.id} href={`/service-catalog/requests/${r.id}`} style={{ display: "contents", textDecoration: "none" }}>
                  <Cell mono accent>{r.request_number}</Cell>
                  <Cell><Drill onClick={() => f.set("item", r.item_name)}>{r.item_name}</Drill></Cell>
                  <Cell mono muted>{r.incident_number}</Cell>
                  <Cell mono muted={!overdue}><span style={{ color: overdue ? "var(--st-critical-fg)" : undefined }}>{r.sla_due_at ? new Date(r.sla_due_at).toLocaleDateString(locale) : "—"}</span></Cell>
                  <Cell><Drill onClick={() => f.set("status", r.status)}><StatusPill status={r.status} /></Drill></Cell>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export function StatusPill({ status }: { status: string }) {
  const { t } = useI18n();
  const c = STATUS_COLOR[status] ?? STATUS_COLOR.open;
  return <span style={{ fontSize: 10.5, fontWeight: 600, color: c.fg, background: c.bg, padding: "3px 10px", borderRadius: "var(--r-pill)" }}>{t(("cat.st." + status) as MessageKey)}</span>;
}

const cellSt: React.CSSProperties = { fontSize: 12.5, padding: "11px 12px", borderTop: "1px solid var(--line-soft)", display: "flex", alignItems: "center", color: "var(--text)" };
function Cell({ children, mono, accent, muted }: { children: React.ReactNode; mono?: boolean; accent?: boolean; muted?: boolean }) {
  return <div style={{ ...cellSt, fontFamily: mono ? "var(--font-mono)" : "var(--font-ui)", color: accent ? "var(--accent-2)" : muted ? "var(--muted)" : "var(--text)" }}>{children}</div>;
}
function Kpi({ label, value, color }: { label: string; value: string; color?: string }) {
  return <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 16 }}>
    <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--muted)", marginBottom: 10 }}>{label}</div>
    <div style={{ fontFamily: "var(--font-mono)", fontWeight: 500, fontSize: 22, letterSpacing: "-1px", color: color ?? "var(--text)" }}>{value}</div></div>;
}
