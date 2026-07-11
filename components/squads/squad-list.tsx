"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/provider";
import type { SquadRow } from "@/lib/squads/queries";
import { useListFilters, FilterBar, Drill, type FilterDef } from "@/components/common/filters";

export function SquadList({ rows }: { rows: SquadRow[] }) {
  const { t } = useI18n();
  const head: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "#8A948A", padding: "10px 12px", background: "var(--head-bg)" };
  const defs: FilterDef<SquadRow>[] = [
    { key: "bu", label: t("sq.col.bu"), get: (s) => s.business_unit?.name, allLabel: t("inc.filter.allbu") },
    { key: "transversal", label: t("sq.transversal"), get: (s) => (s.is_transversal ? "yes" : "no"), allLabel: t("md.filter.all"), render: (v) => (v === "yes" ? t("common.yes") : t("common.no")) },
  ];
  const f = useListFilters(rows, defs);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("sq.intro")}</div>
      <FilterBar defs={defs} filters={f} />
      <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "150px 1.4fr 1fr 90px 120px 110px", minWidth: 820 }}>
            {[t("sq.col.code"), t("sq.col.name"), t("sq.col.bu"), t("sq.col.members"), t("sq.col.allocation"), t("sq.col.type")].map((h) => <div key={h} style={head}>{h}</div>)}
            {f.filtered.length === 0 && <div style={{ gridColumn: "1 / -1", padding: 36, textAlign: "center", color: "var(--muted)" }}>{t("sq.empty")}</div>}
            {f.filtered.map((s) => (
              <Link key={s.id} href={`/squads/${s.id}`} style={{ display: "contents", textDecoration: "none" }}>
                <Cell mono accent>{s.code}</Cell>
                <Cell>{s.name}</Cell>
                <Cell muted>{s.business_unit?.name ? <Drill onClick={() => f.set("bu", s.business_unit!.name)}>{s.business_unit.name}</Drill> : "—"}</Cell>
                <Cell mono>{s.member_count}</Cell>
                <Cell mono muted>{s.allocated_points}%{s.capacity_points ? ` / ${s.capacity_points}p` : ""}</Cell>
                <Cell muted>{s.is_transversal ? t("sq.transversal") : t("sq.dedicated")}</Cell>
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
