"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import type { AssignableMember } from "@/lib/talent/queries";
import type { FitSuggestion } from "@/lib/talent/recommender";
import { assignIncidentMember, suggestAssignees } from "@/lib/talent/actions";
import { Icon } from "@/components/ui/icon";
import { scoreColor } from "@/lib/incidents/labels";

// Asignacion MANUAL desde una tabla filtrable (buscar, disciplina, interno/externo).
// La sugerencia de IA es opt-in: solo al presionar "Sugerencia" se calcula la afinidad y
// se reordena la tabla; nunca corre en la carga de la pagina.
export function AssignResponsible({ incidentId, members, currentName, canAssign }: {
  incidentId: string;
  members: AssignableMember[];
  currentName: string | null;
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

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = members.filter((m) =>
      (!term || m.name.toLowerCase().includes(term)) &&
      (kind === "all" || (kind === "external" ? m.is_external : !m.is_external)));
    if (fit) return [...list].sort((a, b) => (fit.get(b.id) ?? -1) - (fit.get(a.id) ?? -1));
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [members, q, kind, fit]);

  async function assign(memberId: string, viaSuggestion = false) {
    setBusy(true);
    setErr(null);
    const r = await assignIncidentMember(incidentId, memberId, viaSuggestion);
    setBusy(false);
    if (!r.ok) { setErr(t(("err." + (r.error ?? "ERR_INVALID_FORMAT")) as MessageKey)); return; }
    router.refresh();
  }

  async function loadSuggestions() {
    setLoadingSug(true);
    setErr(null);
    const r = await suggestAssignees(incidentId);
    setLoadingSug(false);
    if (!r.ok) { setErr(t(("err." + (r.error ?? "ERR_INVALID_FORMAT")) as MessageKey)); return; }
    setFit(new Map((r.suggestions ?? []).map((s: FitSuggestion) => [s.id, s.fit])));
  }

  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 12 }}>
        <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, color: "var(--text)" }}>{t("asg.title")}</span>
        <span style={{ fontSize: 12, color: currentName ? "var(--text)" : "var(--muted)", fontWeight: 600 }}>
          {currentName ? `${t("asg.current")}: ${currentName}` : t("asg.none")}
        </span>
      </div>

      {canAssign ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {/* Filtros de la tabla */}
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

          {/* Tabla de candidatos (scroll) */}
          <div style={{ border: "1px solid var(--line-soft)", borderRadius: "var(--r-md)", maxHeight: 264, overflowY: "auto" }}>
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
                  <button onClick={() => assign(m.id, !!fit)} disabled={busy}
                    style={{ fontSize: 11.5, fontWeight: 700, padding: "5px 12px", borderRadius: "var(--r-md)", border: "1px solid var(--accent)", background: "transparent", color: "var(--accent-2)", cursor: busy ? "default" : "pointer" }}>
                    {t("asg.assign")}
                  </button>
                </div>
              );
            })}
          </div>
          {err && <div style={{ fontSize: 11.5, color: "var(--st-critical-fg)" }}>{err}</div>}
        </div>
      ) : (
        <div style={{ fontSize: 12, color: "var(--muted)" }}>—</div>
      )}
    </div>
  );
}
