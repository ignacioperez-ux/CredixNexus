"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import type { RiskData, RiskEventRow } from "@/lib/risk/queries";
import { updateRiskStatus } from "@/lib/risk/actions";
import { useListFilters, FilterBar, Drill, type FilterDef } from "@/components/common/filters";

const STATUSES = ["open", "assessing", "mitigating", "closed", "accepted"];
const statusColor: Record<string, { fg: string; bg: string }> = {
  open: { fg: "var(--st-info)", bg: "var(--st-info-bg)" },
  assessing: { fg: "var(--st-eval)", bg: "var(--st-eval-bg)" },
  mitigating: { fg: "var(--st-high-fg)", bg: "var(--st-high-bg)" },
  closed: { fg: "var(--st-low-fg)", bg: "var(--st-low-bg)" },
  accepted: { fg: "var(--muted)", bg: "var(--paper)" },
};

export function RiskList({ data, canManage }: { data: RiskData; canManage: boolean }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const fmt = (n: number, c: string) => new Intl.NumberFormat(locale === "es" ? "es-CR" : "en-US", { style: "currency", currency: c || "CRC", maximumFractionDigits: 0 }).format(n);
  const head: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "#8A948A", padding: "10px 12px", background: "var(--head-bg)" };
  const cur = data.events[0]?.currency ?? "CRC";

  async function cycle(e: RiskEventRow) {
    const next = STATUSES[(STATUSES.indexOf(e.status) + 1) % STATUSES.length];
    await updateRiskStatus(e.id, next);
    router.refresh();
  }

  const defs: FilterDef<RiskEventRow>[] = [
    { key: "cat", label: t("risk.col.category"), get: (e) => e.risk_category, allLabel: t("inc.filter.allcat") },
    { key: "status", label: t("risk.col.status"), get: (e) => e.status, allLabel: t("inc.filter.allstatus"), render: (v) => t(("risk.rst." + v) as MessageKey) },
  ];
  const f = useListFilters(data.events, defs);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        <Kpi label={t("risk.kpi.open")} value={String(data.stats.open)} />
        <Kpi label={t("risk.kpi.estimated")} value={fmt(data.stats.estimatedTotal, cur)} />
        <Kpi label={t("risk.kpi.actual")} value={fmt(data.stats.actualTotal, cur)} />
        <Kpi label={t("risk.kpi.overdue")} value={String(data.stats.overdue)} danger={data.stats.overdue > 0} />
      </div>

      <FilterBar defs={defs} filters={f} />

      <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "120px 110px 1.6fr 110px 110px 100px 130px", minWidth: 900 }}>
            {[t("risk.col.number"), t("risk.col.category"), t("risk.col.desc"), t("risk.col.estimated"), t("risk.col.actual"), t("risk.col.due"), t("risk.col.status")].map((h, i) => (
              <div key={h} style={{ ...head, textAlign: i >= 3 && i <= 4 ? "right" : "left" }}>{h}</div>
            ))}
            {f.filtered.length === 0 && <div style={{ gridColumn: "1 / -1", padding: 36, textAlign: "center", color: "var(--muted)" }}>{t("risk.empty")}</div>}
            {f.filtered.map((e) => {
              const sc = statusColor[e.status] ?? statusColor.open;
              const overdue = e.status !== "closed" && e.due_date && e.due_date < new Date().toISOString().slice(0, 10);
              return (
                <div key={e.id} style={{ display: "contents" }}>
                  <Cell mono accent>{e.event_number}</Cell>
                  <Cell muted>{e.risk_category}</Cell>
                  <Cell>
                    <div>{e.description}</div>
                    {e.incident && <Link href={`/incidents/${e.incident.id}`} style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--accent-2)", textDecoration: "none" }}>◂ {e.incident.incident_number}</Link>}
                  </Cell>
                  <Cell mono right>{fmt(Number(e.estimated_loss), e.currency)}</Cell>
                  <Cell mono right>{fmt(Number(e.actual_loss), e.currency)}</Cell>
                  <Cell mono muted style={overdue ? { color: "var(--st-critical)" } : undefined}>{e.due_date ?? "—"}</Cell>
                  <div style={{ ...cellSt }}>
                    <button onClick={() => canManage && cycle(e)} disabled={!canManage}
                      style={{ fontSize: 10.5, padding: "3px 10px", borderRadius: "var(--r-pill)", border: "none", cursor: canManage ? "pointer" : "default", color: sc.fg, background: sc.bg, fontWeight: 600 }}>
                      {t(("risk.rst." + e.status) as MessageKey)}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

const cellSt: React.CSSProperties = { fontSize: 12, padding: "11px 12px", borderTop: "1px solid var(--line-soft)", color: "var(--text)", display: "flex", alignItems: "center" };
function Cell({ children, mono, accent, muted, right, style }: { children: React.ReactNode; mono?: boolean; accent?: boolean; muted?: boolean; right?: boolean; style?: React.CSSProperties }) {
  return <div style={{ ...cellSt, justifyContent: right ? "flex-end" : "flex-start", fontFamily: mono ? "var(--font-mono)" : "var(--font-ui)", color: accent ? "var(--accent-2)" : muted ? "var(--muted)" : "var(--text)", flexDirection: "column", alignItems: right ? "flex-end" : "flex-start", gap: 2, ...style }}>{children}</div>;
}
function Kpi({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 16 }}>
    <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--muted)", marginBottom: 10 }}>{label}</div>
    <div style={{ fontFamily: "var(--font-mono)", fontWeight: 500, fontSize: 22, letterSpacing: "-1px", color: danger ? "var(--st-critical)" : "var(--text)" }}>{value}</div></div>;
}
