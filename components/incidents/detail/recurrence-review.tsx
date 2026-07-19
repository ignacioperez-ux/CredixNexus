"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import { Icon } from "@/components/ui/icon";
import { setIncidentRecurrence } from "@/lib/incidents/actions";

type PriorCase = { id: string; incident_number: string; title: string } | null;

/** Reincidencia: banner + gobierno de edicion. Cambiar el flag es potestad del REPORTANTE (en su
 *  portal) o de la GERENCIA de Operaciones (aqui), que DEBE documentar el motivo. La justificacion
 *  queda como evidencia (se muestra la ultima) para discusiones posteriores. */
export function RecurrenceReview({ incidentId, isRecurrence, priorCase, reviewNote, reviewedAt, reviewerName, canManage }: {
  incidentId: string; isRecurrence: boolean; priorCase: PriorCase;
  reviewNote: string | null; reviewedAt: string | null; reviewerName: string | null; canManage: boolean;
}) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);

  if (!isRecurrence && !canManage) return null; // nada que mostrar a quien no gestiona

  function submit(target: boolean) {
    setErr(null);
    start(async () => {
      const r = await setIncidentRecurrence(incidentId, target, note);
      if (!r.ok) { setErr(r.error === "RECURRENCE_REASON_REQUIRED" ? t("inc.recurrence.reason.required") : (r.error ?? "error")); return; }
      setOpen(false); setNote(""); router.refresh();
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, background: isRecurrence ? "var(--st-high-bg)" : "var(--paper)", border: `1px solid ${isRecurrence ? "var(--st-high)" : "var(--line)"}`, borderRadius: "var(--r-md)", padding: "10px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }} title={t("inc.recurrence.note")}>
        <Icon name={isRecurrence ? "alert" : "check"} size={14} color={isRecurrence ? "var(--st-high-fg)" : "var(--muted)"} />
        <span style={{ fontSize: 12.5, fontWeight: 700, color: isRecurrence ? "var(--st-high-fg)" : "var(--muted)" }}>{isRecurrence ? t("inc.recurrence.badge") : t("inc.recurrence.none")}</span>
        {isRecurrence && priorCase && (
          <>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>· {t("inc.recurrence.of")}</span>
            <Link href={`/incidents/${priorCase.id}`} style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--accent-2)", textDecoration: "none", fontWeight: 600 }}>{priorCase.incident_number}</Link>
            <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{priorCase.title}</span>
          </>
        )}
        {canManage && !open && (
          <button onClick={() => { setOpen(true); setErr(null); }} style={{ marginLeft: "auto", fontSize: 11.5, fontWeight: 600, padding: "4px 10px", borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: "var(--card)", color: "var(--text)", cursor: "pointer" }}>{t("inc.recurrence.change")}</button>
        )}
      </div>

      {/* Evidencia de la ultima revision documentada (motivo + quien + cuando). */}
      {reviewNote && (
        <div style={{ fontSize: 11.5, color: "var(--muted)", borderLeft: "2px solid var(--line)", paddingLeft: 8 }}>
          <span style={{ fontWeight: 700, color: "var(--text)" }}>{t("inc.recurrence.review")}:</span> {reviewNote}
          {(reviewerName || reviewedAt) && <span> · {reviewerName ?? ""}{reviewedAt ? ` · ${new Date(reviewedAt).toLocaleString(locale)}` : ""}</span>}
        </div>
      )}

      {/* Control de la Gerencia: cambiar el flag exige documentar el motivo (evidencia). */}
      {canManage && open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 2 }}>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder={t("inc.recurrence.reason.ph")}
            style={{ fontSize: 12.5, padding: "8px 10px", borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: "var(--card)", color: "var(--text)", fontFamily: "var(--font-ui)", resize: "vertical" }} />
          {err && <div style={{ fontSize: 11.5, color: "var(--st-critical-fg)" }}>{err.startsWith("ERR_") ? t(("err." + err) as MessageKey) : err}</div>}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => submit(!isRecurrence)} disabled={pending} style={{ fontSize: 12, fontWeight: 700, padding: "7px 13px", borderRadius: "var(--r-md)", border: "none", background: "var(--cta-bg)", color: "var(--cta-fg)", cursor: "pointer" }}>
              {isRecurrence ? t("inc.recurrence.unmark") : t("inc.recurrence.mark")}
            </button>
            <button onClick={() => { setOpen(false); setNote(""); setErr(null); }} disabled={pending} style={{ fontSize: 12, fontWeight: 600, padding: "7px 13px", borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: "var(--card)", color: "var(--muted)", cursor: "pointer" }}>{t("inc.recurrence.cancel")}</button>
          </div>
        </div>
      )}
    </div>
  );
}
