"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/provider";
import type { IncidentRow, CaseTypeMeta } from "@/lib/incidents/queries";
import type { AssignableMember } from "@/lib/talent/queries";
import { changeStatus, sendToEvolution, setPriority } from "@/lib/incidents/actions";
import { assignIncidentMember } from "@/lib/talent/actions";
import { priorityKey } from "@/lib/incidents/labels";
import { IncidentTable } from "./incident-table";
import { StatusPill, PriorityTag, ScoreBadge, SlaBadge } from "./badges";
import { Icon } from "@/components/ui/icon";
import type { MessageKey } from "@/lib/i18n/dictionaries";

const SETTLED = ["resolved", "closed", "cancelled"];
const PRIORITIES = ["p1_critical", "p2_high", "p3_medium", "p4_low"];

// Split view (master-detail): la lista a la izquierda; al seleccionar una fila se abre un
// panel de VISTA PREVIA a la derecha alimentado por los datos que la lista ya cargo (cero
// queries nuevas). FASE 3.1: acciones contextuales (prioridad, asignar, resolver, evolucion) por permiso.
export function IncidentSplit({ rows, caseTypes = {}, myMemberId = null, defaultView = "all", initialStatus = "", initialResp = "", canResolve = false, canEvolve = false, canPriority = false, canAssign = false, members = [] }: {
  rows: IncidentRow[]; caseTypes?: CaseTypeMeta; myMemberId?: string | null; defaultView?: string; initialStatus?: string; initialResp?: string;
  canResolve?: boolean; canEvolve?: boolean; canPriority?: boolean; canAssign?: boolean; members?: AssignableMember[];
}) {
  const [sel, setSel] = useState<IncidentRow | null>(null);
  return (
    <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <IncidentTable rows={rows} caseTypes={caseTypes} myMemberId={myMemberId} defaultView={defaultView} initialStatus={initialStatus} initialResp={initialResp}
          canResolve={canResolve} canAssign={canAssign} members={members}
          onSelect={(r) => setSel((cur) => (cur?.id === r.id ? null : r))} selectedId={sel?.id ?? null} />
      </div>
      {sel && <Preview row={sel} caseTypes={caseTypes} canResolve={canResolve} canEvolve={canEvolve}
        canPriority={canPriority} canAssign={canAssign} members={members} onClose={() => setSel(null)} />}
    </div>
  );
}

function Preview({ row, caseTypes, canResolve, canEvolve, canPriority, canAssign, members, onClose }: {
  row: IncidentRow; caseTypes: CaseTypeMeta; canResolve: boolean; canEvolve: boolean; canPriority: boolean; canAssign: boolean; members: AssignableMember[]; onClose: () => void;
}) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const open = !SETTLED.includes(row.status) && row.status !== "in_evolution";

  // En exito refrescamos la lista y cerramos la previa (refleja el nuevo estado sin dato stale).
  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setMsg(null);
    start(async () => {
      const r = await fn();
      if (!r.ok) { setMsg(r.error ?? t("common.error")); return; }
      router.refresh();
      onClose();
    });
  }

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

      {/* Quick-edit contextual (FASE 3.1): prioridad y asignacion por permiso */}
      {open && (canPriority || canAssign) && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, borderTop: "1px solid var(--line-soft)", paddingTop: 12 }}>
          {canPriority && (
            <QuickSelect label={t("inc.col.priority")} value={row.priority} disabled={pending}
              onChange={(v) => run(() => setPriority(row.id, v))}
              options={PRIORITIES.map((p) => ({ value: p, label: t(priorityKey(p) as MessageKey) }))} />
          )}
          {canAssign && (
            <QuickSelect label={t("flt.responsible")} value={row.assigned_member_id ?? ""} disabled={pending}
              onChange={(v) => v && run(() => assignIncidentMember(row.id, v))}
              options={[{ value: "", label: t("inc.view.unassigned") }, ...members.map((m) => ({ value: m.id, label: m.name }))]} />
          )}
        </div>
      )}

      {/* Acciones contextuales (FASE 3.1) — por permiso y estado */}
      {open && (canResolve || canEvolve) && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", borderTop: "1px solid var(--line-soft)", paddingTop: 12 }}>
          {canResolve && (
            <button onClick={() => { if (confirm(t("inc.action.resolve.confirm"))) run(() => changeStatus(row.id, "resolved")); }} disabled={pending}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 13px", borderRadius: "var(--r-md)", border: "none", background: "var(--cta-bg)", color: "var(--cta-fg)", fontWeight: 700, fontSize: 12.5, cursor: pending ? "default" : "pointer", opacity: pending ? 0.7 : 1 }}>
              <Icon name="check" size={14} color="var(--cta-icon)" /> {t("inc.action.resolve")}
            </button>
          )}
          {canEvolve && (
            <button onClick={() => { if (confirm(t("inc.action.evolve.confirm"))) run(() => sendToEvolution(row.id)); }} disabled={pending}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 13px", borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: "var(--card)", color: "var(--accent-2)", fontWeight: 600, fontSize: 12.5, cursor: pending ? "default" : "pointer", opacity: pending ? 0.7 : 1 }}>
              <Icon name="zap" size={14} /> {t("inc.action.evolve")}
            </button>
          )}
        </div>
      )}
      {msg && <div style={{ fontSize: 12, color: "var(--st-critical-fg)" }}>{msg}</div>}

      <Link href={`/incidents/${row.id}`}
        style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "10px 14px", borderRadius: "var(--r-md)", background: "var(--paper)", border: "1px solid var(--line)", color: "var(--text)", fontWeight: 600, fontSize: 13, textDecoration: "none", marginTop: 2 }}>
        <Icon name="chevron-right" size={15} color="var(--muted)" /> {t("inc.open")}
      </Link>
    </aside>
  );
}

function QuickSelect({ label, value, options, onChange, disabled }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ fontSize: 11.5, color: "var(--muted)", width: 120, flexShrink: 0 }}>{label}</span>
      <select value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}
        style={{ flex: 1, minWidth: 0, fontSize: 12.5, padding: "7px 9px", borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: "var(--card)", color: "var(--text)", fontFamily: "var(--font-ui)" }}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
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
