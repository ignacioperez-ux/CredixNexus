"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import type { ProjectRow } from "@/lib/projects/queries";
import { computeRoi } from "@/lib/projects/queries";
import { convertRecommendation } from "@/lib/projects/actions";
import { scoreColor } from "@/lib/incidents/labels";
import { useListFilters, FilterBar, Drill, type FilterDef } from "@/components/common/filters";

type Convertible = { id: string; recommended_name: string; transformation_score: number; business_priority: number | null; incident: { incident_number: string } | null };
type Squad = { id: string; name: string };

const COLUMNS: { key: string; label: MessageKey; dot: string; statuses: string[] }[] = [
  { key: "proposed", label: "proj.col.proposed", dot: "var(--st-eval)", statuses: ["proposed", "approved", "on_hold"] },
  { key: "active", label: "proj.col.active", dot: "var(--st-medium)", statuses: ["active"] },
  { key: "closed", label: "proj.col.closed", dot: "var(--st-low)", statuses: ["completed", "cancelled"] },
];

export function ProjectsKanban({ projects, convertibles, squads }: { projects: ProjectRow[]; convertibles: Convertible[]; squads: Squad[] }) {
  const { t } = useI18n();
  const [sortBy, setSortBy] = useState<"wsjf" | "roi">("wsjf");

  const defs: FilterDef<ProjectRow>[] = [
    { key: "squad", label: t("proj.field.squad"), get: (p) => p.squad?.name, allLabel: t("md.filter.all") },
    { key: "bu", label: t("proj.field.bu"), get: (p) => p.business_unit?.name, allLabel: t("md.filter.all") },
  ];
  const f = useListFilters(projects, defs);

  const sorted = [...f.filtered].sort((a, b) => {
    if (sortBy === "roi") {
      const ra = computeRoi(a.estimated_benefit_amount, a.estimated_cost_amount) ?? -1;
      const rb = computeRoi(b.estimated_benefit_amount, b.estimated_cost_amount) ?? -1;
      return rb - ra;
    }
    return Number(b.wsjf) - Number(a.wsjf);
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {convertibles.length > 0 && <ConvertStrip convertibles={convertibles} squads={squads} />}
      <FilterBar defs={defs} filters={f} />
      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 12, color: "var(--muted)" }}>{t("proj.sortby")}:</span>
        {(["wsjf", "roi"] as const).map((k) => (
          <button key={k} onClick={() => setSortBy(k)}
            style={{ padding: "5px 12px", borderRadius: "var(--r-pill)", border: sortBy === k ? "none" : "1px solid var(--line)", background: sortBy === k ? "var(--cta-bg)" : "var(--card)", color: sortBy === k ? "var(--cta-fg)" : "var(--muted)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            {k === "wsjf" ? "WSJF" : t("proj.roi")}
          </button>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, alignItems: "start" }}>
        {COLUMNS.map((col) => {
          const items = sorted.filter((p) => col.statuses.includes(p.status));
          return (
            <div key={col.key} style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: col.dot }} />
                <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13, color: "var(--text)" }}>{t(col.label)}</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)" }}>{items.length}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {items.length === 0 && <div style={{ fontSize: 12, color: "var(--muted)" }}>—</div>}
                {items.map((p) => <ProjectCard key={p.id} p={p} onSquad={p.squad?.name ? () => f.set("squad", p.squad!.name) : undefined} />)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ProjectCard({ p, onSquad }: { p: ProjectRow; onSquad?: () => void }) {
  const roi = computeRoi(p.estimated_benefit_amount, p.estimated_cost_amount);
  return (
    <Link href={`/projects/${p.id}`} className="cx-lift" style={{ display: "block", textDecoration: "none", border: "1px solid var(--line)", borderRadius: "var(--r-lg)", padding: 12, background: "var(--card)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", lineHeight: 1.3 }}>{p.name}</span>
        <span title="WSJF" style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 500, color: "var(--accent-2)", flexShrink: 0 }}>{Number(p.wsjf).toFixed(1)}</span>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
        <span title="ROI" style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, padding: "1px 7px", borderRadius: "var(--r-pill)", background: roi != null && roi >= 0 ? "var(--st-low-bg)" : "var(--paper)", color: roi != null && roi >= 0 ? "var(--st-low-fg)" : "var(--muted)" }}>
          ROI {roi != null ? `${roi}%` : "—"}
        </span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--muted)" }}>
        <span style={{ fontFamily: "var(--font-mono)", color: "var(--accent-2)" }}>{p.project_code}</span>
        <span>{p.squad?.name && onSquad ? <Drill onClick={onSquad}>{p.squad.name}</Drill> : (p.squad?.name ?? "—")}</span>
      </div>
      {p.incident && <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--muted)", marginTop: 4 }}>◂ {p.incident.incident_number}</div>}
    </Link>
  );
}

function ConvertStrip({ convertibles, squads }: { convertibles: Convertible[]; squads: Squad[] }) {
  const { t } = useI18n();
  const router = useRouter();
  const [squadByReco, setSquadByReco] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  async function convert(id: string) {
    setBusy(id);
    const res = await convertRecommendation(id, squadByReco[id] ?? "");
    setBusy(null);
    if (res.ok) router.refresh();
  }

  return (
    <div style={{ background: "var(--dark-surface)", border: "1px solid var(--dark-surface-border)", borderRadius: "var(--r-xl)", padding: 16, color: "var(--dark-surface-fg)" }}>
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, marginBottom: 12 }}>{t("proj.col.proposed")}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {convertibles.map((c) => (
          <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", background: "var(--dark-chip)", borderRadius: "var(--r-md)", padding: "10px 12px" }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 16, fontWeight: 500, color: scoreColor(c.transformation_score) }}>{Math.round(c.transformation_score)}</span>
            <div style={{ flex: 1, minWidth: 160 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{c.recommended_name}</div>
              {c.incident && <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, opacity: 0.7 }}>◂ {c.incident.incident_number}</span>}
            </div>
            <select value={squadByReco[c.id] ?? ""} onChange={(e) => setSquadByReco((s) => ({ ...s, [c.id]: e.target.value }))}
              style={{ padding: "7px 10px", borderRadius: "var(--r-sm)", border: "1px solid var(--dark-surface-border)", background: "transparent", color: "var(--dark-surface-fg)", fontSize: 12 }}>
              <option value="" style={{ color: "#000" }}>{t("proj.field.squad")}</option>
              {squads.map((s) => <option key={s.id} value={s.id} style={{ color: "#000" }}>{s.name}</option>)}
            </select>
            <button onClick={() => convert(c.id)} disabled={busy === c.id}
              style={{ padding: "8px 14px", borderRadius: "var(--r-md)", background: "var(--accent)", color: "var(--on-accent)", border: "none", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
              {t("proj.convert")}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
