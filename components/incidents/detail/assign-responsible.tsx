"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import type { AssignableMember } from "@/lib/talent/queries";
import type { FitSuggestion } from "@/lib/talent/recommender";
import { assignIncidentMember } from "@/lib/talent/actions";
import { Icon } from "@/components/ui/icon";
import { scoreColor } from "@/lib/incidents/labels";

// Asignacion de responsable SIMPLE y directa: selector + Asignar. La sugerencia de IA
// aparece como un chip opcional ("IA sugiere: X — Asignar"), nunca como unica via.
export function AssignResponsible({ incidentId, members, currentName, topSuggestion, canAssign }: {
  incidentId: string;
  members: AssignableMember[];
  currentName: string | null;
  topSuggestion?: FitSuggestion | null;
  canAssign: boolean;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [sel, setSel] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function assign(memberId: string, viaSuggestion = false) {
    if (!memberId) return;
    setBusy(true);
    setErr(null);
    const r = await assignIncidentMember(incidentId, memberId, viaSuggestion);
    setBusy(false);
    if (!r.ok) { setErr(t(("err." + (r.error ?? "ERR_INVALID_FORMAT")) as MessageKey)); return; }
    setSel("");
    router.refresh();
  }

  // No mostrar la sugerencia si ya es el asignado actual.
  const showSuggestion = topSuggestion && topSuggestion.name !== currentName;

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
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <select value={sel} onChange={(e) => setSel(e.target.value)} disabled={busy}
              style={{ flex: 1, minWidth: 160, fontSize: 12.5, padding: "8px 10px", borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: "var(--card)", color: "var(--text)", fontFamily: "var(--font-ui)" }}>
              <option value="">{t("asg.placeholder")}</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.name}{m.discipline ? ` · ${m.discipline}` : ""}{m.is_external ? ` (${t("asg.ext")})` : ""}</option>
              ))}
            </select>
            <button onClick={() => assign(sel)} disabled={busy || !sel}
              style={{ fontSize: 12.5, fontWeight: 700, padding: "8px 16px", borderRadius: "var(--r-md)", border: "none", background: sel ? "var(--cta-bg)" : "var(--paper)", color: sel ? "var(--cta-fg)" : "var(--muted)", cursor: sel && !busy ? "pointer" : "default" }}>
              {currentName ? t("asg.reassign") : t("asg.assign")}
            </button>
          </div>

          {showSuggestion && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--accent-soft)", borderRadius: "var(--r-md)", padding: "8px 12px" }}>
              <Icon name="sparkle" size={13} color="var(--accent-bright)" />
              <span style={{ fontSize: 11.5, color: "var(--muted)" }}>{t("asg.ai")}:</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 600, color: scoreColor(topSuggestion!.fit) }}>{topSuggestion!.fit}</span>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text)", flex: 1 }}>{topSuggestion!.name}</span>
              <button onClick={() => assign(topSuggestion!.id, true)} disabled={busy}
                style={{ fontSize: 11.5, fontWeight: 700, padding: "6px 12px", borderRadius: "var(--r-md)", border: "1px solid var(--accent)", background: "transparent", color: "var(--accent-2)", cursor: "pointer" }}>
                {t("asg.assign")}
              </button>
            </div>
          )}
          {showSuggestion && <div style={{ fontSize: 10.5, color: "var(--muted)" }}>{t("asg.ai.hint")}</div>}
          {err && <div style={{ fontSize: 11.5, color: "var(--st-critical-fg)" }}>{err}</div>}
        </div>
      ) : (
        <div style={{ fontSize: 12, color: "var(--muted)" }}>—</div>
      )}
    </div>
  );
}
