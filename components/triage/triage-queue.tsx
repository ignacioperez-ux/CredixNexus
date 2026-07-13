"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/provider";
import type { PendingCaseRow } from "@/lib/triage/queries";
import { useListFilters, FilterBar, Drill, EmptyState, type FilterDef } from "@/components/common/filters";

export function TriageQueue({ rows }: { rows: PendingCaseRow[] }) {
  const { t, locale } = useI18n();
  const head: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "#8A948A", padding: "10px 12px", background: "var(--head-bg)" };
  const defs: FilterDef<PendingCaseRow>[] = [
    { key: "cat", label: t("inc.col.category"), get: (r) => r.category?.name, allLabel: t("inc.filter.allcat") },
    { key: "app", label: t("inc.col.app"), get: (r) => r.ci?.name, allLabel: t("inc.filter.allapp") },
  ];
  const f = useListFilters(rows, defs);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("tri.queue.intro")}</div>
      <FilterBar defs={defs} filters={f} />
      <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "130px 1.7fr 130px 130px 110px", minWidth: 820 }}>
            {[t("inc.col.number"), t("inc.col.title"), t("inc.col.category"), t("inc.col.app"), t("tri.queue.opened")].map((h) => <div key={h} style={head}>{h}</div>)}
            {f.filtered.length === 0 && <EmptyState text={t("tri.queue.empty")} icon="check" />}
            {f.filtered.map((r) => (
              <Link key={r.id} href={`/incidents/${r.id}`} className="cx-row" style={{ display: "contents", textDecoration: "none" }}>
                <Cell mono accent>{r.incident_number}</Cell>
                <Cell>{r.title}</Cell>
                <Cell muted>{r.category?.name ? <Drill onClick={() => f.set("cat", r.category!.name)}>{r.category.name}</Drill> : "—"}</Cell>
                <Cell muted>{r.ci?.name ? <Drill onClick={() => f.set("app", r.ci!.name)}>{r.ci.name}</Drill> : "—"}</Cell>
                <Cell mono muted>{new Date(r.opened_at).toLocaleDateString(locale)}</Cell>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const cellSt: React.CSSProperties = { fontSize: 12.5, padding: "11px 12px", borderTop: "1px solid var(--line-soft)", display: "flex", alignItems: "center", color: "var(--text)" };
function Cell({ children, mono, accent, muted }: { children: React.ReactNode; mono?: boolean; accent?: boolean; muted?: boolean }) {
  return <div style={{ ...cellSt, fontFamily: mono ? "var(--font-mono)" : "var(--font-ui)", color: accent ? "var(--accent-2)" : muted ? "var(--muted)" : "var(--text)" }}>{children}</div>;
}
