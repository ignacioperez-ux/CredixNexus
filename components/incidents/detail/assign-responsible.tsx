"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import type { AssignableMember } from "@/lib/talent/queries";
import type { IncidentAssignee } from "@/lib/incidents/assignees";
import type { FitSuggestion } from "@/lib/talent/recommender";
import { addCaseAssignee, removeCaseAssignee, setPrimaryAssignee, suggestAssignees } from "@/lib/talent/actions";
import { Icon } from "@/components/ui/icon";
import { scoreColor } from "@/lib/incidents/labels";

// Responsables del caso (A3): principal + colaboradores. Agregar / quitar / cambiar principal.
// En Resuelto/Cerrado/Cancelado/En Evolucion la asignacion es de SOLO LECTURA (editable=false).
// La sugerencia de IA es opt-in. Los recursos son Gestion de TI (sin filtro por disciplina, A4).
export function AssignResponsible({ incidentId, members, assignees, editable, canAssign }: {
  incidentId: string;
  members: AssignableMember[];
  assignees: IncidentAssignee[];
  editable: boolean;
  canAssign: boolean;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<"all" | "internal" | "external">("all");
  const [fit, setFit] = useState<Map<string, number> | null>(null);
  const [loadingSug, setLoadingSug] = useState(false);

  const assignedIds = useMemo(() => new Set(assignees.map((a) => a.member_id)), [assignees]);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = members.filter((m) =>
      !assignedIds.has(m.id) &&
      (!term || m.name.toLowerCase().includes(term)) &&
      (kind === "all" || (kind === "external" ? m.is_external : !m.is_external)));
    if (fit) return [...list].sort((a, b) => (fit.get(b.id) ?? -1) - (fit.get(a.id) ?? -1));
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [members, assignedIds, q, kind, fit]);

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(true); setErr(null);
    const r = await fn();
    setBusy(false);
    if (!r.ok) { setErr(t(("err." + (r.error ?? "ERR_INVALID_FORMAT")) as MessageKey)); return; }
    router.refresh();
  }
  async function loadSuggestions() {
    setLoadingSug(true); setErr(null);
    const r = await suggestAssignees(incidentId);
    setLoadingSug(false);
    if (!r.ok) { setErr(t(("err." + (r.error ?? "ERR_INVALID_FORMAT")) as MessageKey)); return; }
    setFit(new Map((r.suggestions ?? []).map((s: FitSuggestion) => [s.id, s.fit])));
  }

  const canEdit = canAssign && editable;

  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 12 }}>
        <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, color: "var(--text)" }}>{t("asg.title")}</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)" }}>{assignees.length}</span>
      </div>

      {/* Responsables actuales */}
      {assignees.length === 0 ? (
        <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: canEdit ? 12 : 0 }}>{t("asg.none")}</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: canEdit ? 14 : 0 }}>
          {assignees.map((a) => (
            <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: "var(--r-md)", background: "var(--paper)" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}</div>
                <div style={{ fontSize: 10, color: "var(--muted)" }}>{a.is_external ? t("asg.ext") : t("asg.int")}</div>
              </div>
              {a.is_primary ? (
                <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.4px", color: "var(--accent-2)", background: "var(--accent-soft)", padding: "2px 8px", borderRadius: "var(--r-pill)" }}>{t("asg.primary")}</span>
              ) : canEdit ? (
                <button onClick={() => run(() => setPrimaryAssignee(incidentId, a.member_id))} disabled={busy}
                  style={{ fontSize: 10.5, fontWeight: 600, padding: "3px 9px", borderRadius: "var(--r-pill)", border: "1px solid var(--line)", background: "var(--card)", color: "var(--muted)", cursor: "pointer", whiteSpace: "nowrap" }}>{t("asg.makePrimary")}</button>
              ) : null}
              {canEdit && (
                <button onClick={() => run(() => removeCaseAssignee(incidentId, a.member_id))} disabled={busy} aria-label={t("asg.removeTitle")} title={t("asg.removeTitle")}
                  style={{ display: "inline-flex", width: 22, height: 22, alignItems: "center", justifyContent: "center", borderRadius: "50%", border: "none", background: "transparent", color: "var(--muted)", cursor: "pointer" }}><Icon name="x" size={13} /></button>
              )}
            </div>
          ))}
        </div>
      )}

      {!editable && <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 8 }}>{t("asg.readonly")}</div>}

      {canEdit && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--muted)" }}>{t("asg.addTitle")}</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("asg.search")}
              style={{ flex: 1, minWidth: 120, fontSize: 12, padding: "7px 9px", borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: "var(--card)", color: "var(--text)", fontFamily: "var(--font-ui)" }} />
            <select value={kind} onChange={(e) => setKind(e.target.value as "all" | "internal" | "external")}
              style={{ fontSize: 12, padding: "7px 9px", borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: "var(--card)", color: "var(--text)" }}>
              <option value="all">{t("asg.f.alltype")}</option>
              <option value="internal">{t("asg.f.internal")}</option>
              <option value="external">{t("asg.f.external")}</option>
            </select>
            <button onClick={loadSuggestions} disabled={loadingSug} title={t("asg.ai.hint")}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, padding: "7px 10px", borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: fit ? "var(--accent-soft)" : "var(--card)", color: "var(--accent-2)", cursor: loadingSug ? "default" : "pointer", whiteSpace: "nowrap" }}>
              <Icon name="sparkle" size={13} color="var(--accent-bright)" /> {loadingSug ? t("asg.suggesting") : t("asg.suggest")}
            </button>
          </div>

          <div style={{ border: "1px solid var(--line-soft)", borderRadius: "var(--r-md)", maxHeight: 240, overflowY: "auto" }}>
            {rows.length === 0 ? (
              <div style={{ padding: 20, textAlign: "center", fontSize: 12, color: "var(--muted)" }}>{t("asg.empty")}</div>
            ) : rows.map((m) => {
              const f = fit?.get(m.id);
              return (
                <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderBottom: "1px solid var(--line-soft)" }}>
                  {fit && <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600, width: 24, textAlign: "right", color: f != null ? scoreColor(f) : "var(--muted)" }}>{f ?? "—"}</span>}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name}</div>
                    <div style={{ fontSize: 10.5, color: "var(--muted)" }}>{m.is_external ? t("asg.ext") : t("asg.int")}</div>
                  </div>
                  <button onClick={() => run(() => addCaseAssignee(incidentId, m.id))} disabled={busy}
                    style={{ fontSize: 11.5, fontWeight: 700, padding: "5px 12px", borderRadius: "var(--r-md)", border: "1px solid var(--accent)", background: "transparent", color: "var(--accent-2)", cursor: busy ? "default" : "pointer" }}>
                    {t("asg.add")}
                  </button>
                </div>
              );
            })}
          </div>
          {err && <div style={{ fontSize: 11.5, color: "var(--st-critical-fg)" }}>{err}</div>}
        </div>
      )}
    </div>
  );
}
