"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import type { InstanceRow } from "@/lib/workflows/queries";
import { InstanceStatusBadge } from "./badges";
import { useListFilters, FilterBar, Drill, type FilterDef } from "@/components/common/filters";

export function InstancesTab({ instances }: { instances: InstanceRow[] }) {
  const { t } = useI18n();
  const head: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "#8A948A", padding: "10px 12px", background: "var(--head-bg)" };
  const defs: FilterDef<InstanceRow>[] = [
    { key: "status", label: t("wf.col.status"), get: (i) => i.status, allLabel: t("inc.filter.allstatus"), render: (v) => t(("wf.ist." + v) as MessageKey) },
    { key: "entity", label: t("wf.def.entity"), get: (i) => i.entity_type, allLabel: t("inc.filter.alltype"), render: (v) => t(("wf.entity." + v) as MessageKey) },
    { key: "def", label: t("wf.col.definition"), get: (i) => i.definition?.name, allLabel: t("md.filter.all") },
  ];
  const f = useListFilters(instances, defs);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <FilterBar defs={defs} filters={f} />
      <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", overflow: "hidden" }}>
      <div style={{ overflowX: "auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "130px 1.6fr 1fr 120px 110px", minWidth: 820 }}>
          {[t("wf.col.number"), t("wf.col.title"), t("wf.col.definition"), t("wf.col.progress"), t("wf.col.status")].map((h) => <div key={h} style={head}>{h}</div>)}
          {f.filtered.length === 0 && <div style={{ gridColumn: "1 / -1", padding: 36, textAlign: "center", color: "var(--muted)" }}>{t("wf.inst.empty")}</div>}
          {f.filtered.map((i) => (
            <Link key={i.id} href={`/workflows/${i.id}`} style={{ display: "contents", textDecoration: "none" }}>
              <Cell mono accent>{i.instance_number}</Cell>
              <Cell>{i.title}</Cell>
              <Cell muted>{i.definition?.name ? <Drill onClick={() => f.set("def", i.definition!.name)}>{i.definition.name}</Drill> : "—"}</Cell>
              <Cell mono muted>{i.total_count - i.active_count}/{i.total_count} {i.active_count > 0 ? `· ${i.active_count} ${t("wf.active")}` : ""}</Cell>
              <Cell><Drill onClick={() => f.set("status", i.status)}><InstanceStatusBadge status={i.status} /></Drill></Cell>
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
