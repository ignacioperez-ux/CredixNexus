"use client";

import { useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/provider";
import type { IncidentRow, CaseTypeMeta } from "@/lib/incidents/queries";
import { IncidentTable } from "./incident-table";
import { StatusPill, PriorityTag, ScoreBadge, SlaBadge } from "./badges";
import { Icon } from "@/components/ui/icon";

// Split view (master-detail): la lista a la izquierda; al seleccionar una fila se abre un
// panel de VISTA PREVIA a la derecha alimentado por los datos que la lista ya cargo (cero
// queries nuevas). El detalle/edicion completo sigue en /incidents/[id] via "Abrir".
export function IncidentSplit({ rows, caseTypes = {}, myMemberId = null, defaultView = "all" }: {
  rows: IncidentRow[]; caseTypes?: CaseTypeMeta; myMemberId?: string | null; defaultView?: string;
}) {
  const [sel, setSel] = useState<IncidentRow | null>(null);
  return (
    <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <IncidentTable rows={rows} caseTypes={caseTypes} myMemberId={myMemberId} defaultView={defaultView}
          onSelect={(r) => setSel((cur) => (cur?.id === r.id ? null : r))} selectedId={sel?.id ?? null} />
      </div>
      {sel && <Preview row={sel} caseTypes={caseTypes} onClose={() => setSel(null)} />}
    </div>
  );
}

function Preview({ row, caseTypes, onClose }: { row: IncidentRow; caseTypes: CaseTypeMeta; onClose: () => void }) {
  const { t, locale } = useI18n();
  return (
    <aside style={{ width: 360, flexShrink: 0, position: "sticky", top: 0, maxHeight: "calc(100vh - 120px)", overflowY: "auto",
      background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--accent-2)", flex: 1 }}>{row.incident_number}</span>
        <button onClick={onClose} aria-label={t("common.cancel")}
          style={{ display: "inline-flex", width: 24, height: 24, alignItems: "center", justifyContent: "center", borderRadius: "var(--r-sm)", border: "1px solid var(--line)", background: "var(--card)", color: "var(--muted)", cursor: "pointer" }}>
          <Icon name="x" size={13} />
        </button>
      </div>

      <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 700, color: "var(--text)", lineHeight: 1.25 }}>{row.title}</h2>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <StatusPill status={row.status} />
        <PriorityTag priority={row.priority} />
        <ScoreBadge score={row.transformation_score} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 1, borderTop: "1px solid var(--line-soft)", paddingTop: 12 }}>
        <Field label={t("inc.col.sla")}><SlaBadge dueAt={row.sla_resolution_due_at} resolvedAt={row.resolved_at} status={row.status} /></Field>
        <Field label={t("flt.responsible")} value={row.assignee?.name ?? t("inc.view.unassigned")} />
        <Field label={t("inc.field.bu")} value={row.business_unit?.name ?? "—"} />
        <Field label={t("inc.field.app")} value={row.ci?.name ?? "—"} />
        <Field label={t("inc.col.status")} value={caseTypes[row.case_type]?.name ?? row.case_type} />
        <Field label={t("inc.field.opened")} value={new Date(row.opened_at).toLocaleString(locale)} />
      </div>

      <Link href={`/incidents/${row.id}`}
        style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "10px 14px", borderRadius: "var(--r-md)", background: "var(--cta-bg)", color: "var(--cta-fg)", fontWeight: 700, fontSize: 13, textDecoration: "none", marginTop: 4 }}>
        <Icon name="chevron-right" size={15} color="var(--cta-icon)" /> {t("inc.open")}
      </Link>
    </aside>
  );
}

function Field({ label, value, children }: { label: string; value?: string; children?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: "1px solid var(--line-soft)" }}>
      <span style={{ fontSize: 11.5, color: "var(--muted)", width: 120, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 12.5, color: "var(--text)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{children ?? value}</span>
    </div>
  );
}
