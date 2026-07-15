"use client";

import { BackButton } from "@/components/common/back-button";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import { Icon } from "@/components/ui/icon";
import { statusColors, statusKey } from "@/lib/incidents/labels";
import { SlaRing } from "@/components/portal/hub-viz";
import { addMyCaseComment } from "@/lib/portal/case-actions";
import type { MyCaseDetail, CaseThreadItem, MyCaseSurvey } from "@/lib/portal/case-queries";
import { CaseCsat } from "./case-csat";

// Detalle de caso PROPIO del usuario (P2): centro de tracking client-centric. No reutiliza la
// vista de agente; muestra estado, SLA, hilo (solo mensajes no internos) y CSAT al resolverse.

function stepIndex(status: string): number {
  if (status === "closed") return 3;
  if (status === "resolved") return 2;
  if (["in_progress", "waiting", "reopened"].includes(status)) return 1;
  return 0; // new / triaged / assigned
}

export function UserCaseDetail({ detail, thread, survey }: { detail: MyCaseDetail; thread: CaseThreadItem[]; survey: MyCaseSurvey | null }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [reply, setReply] = useState("");
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const sc = statusColors(detail.status);
  const inEvolution = detail.status === "in_evolution";
  // Se puede evaluar en resuelto y tambien en cerrado sin evaluar (p.ej. cerrado por el agente);
  // si ya se envio, se muestra en solo-lectura. El estado pasa a "evaluado" al enviar.
  const showCsat = detail.status === "resolved" || detail.status === "closed" || survey?.status === "submitted";
  const canReply = detail.status !== "closed" && detail.status !== "cancelled";

  function send() {
    setErr(null);
    if (reply.trim().length === 0) return;
    start(async () => {
      const r = await addMyCaseComment(detail.id, reply);
      if (!r.ok) { setErr(r.error?.startsWith("ERR_") ? t(("err." + r.error) as MessageKey) : (r.error ?? "")); return; }
      setReply(""); router.refresh();
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-5)", maxWidth: "var(--w-prose)" }}>
      <BackButton fallback="/portal" label="case.back" />

      {/* Cabecera: anillo SLA + numero + estado + titulo */}
      <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", boxShadow: "var(--sh-e1, none)", padding: 20, display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
        <SlaRing openedAt={detail.opened_at} dueAt={detail.sla_resolution_due_at} resolvedAt={detail.resolved_at} status={detail.status} size={54} />
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--accent-2)" }}>{detail.incident_number}</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10.5, fontWeight: 600, color: sc.fg, background: sc.bg, padding: "2px 9px", borderRadius: "var(--r-pill)" }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: sc.fg }} />{t(statusKey(detail.status))}
            </span>
          </div>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "var(--fs-5)", color: "var(--text)", marginTop: 4 }}>{detail.title}</div>
        </div>
      </div>

      {/* Progreso del caso (o banner de evolucion: el hilo sobrevive, §0) */}
      {inEvolution ? (
        <div style={{ background: "var(--accent-soft)", border: "1px solid var(--accent)", borderRadius: "var(--r-md)", padding: "12px 14px", display: "flex", gap: 10, alignItems: "center" }}>
          <Icon name="zap" size={16} color="var(--accent-2)" />
          <span style={{ fontSize: 12.5, color: "var(--text)" }}>{t("case.evolution.note")}</span>
        </div>
      ) : (
        <CaseStepper idx={stepIndex(detail.status)} />
      )}

      {/* Lo que reportaste */}
      {detail.description && (
        <div style={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: "var(--r-md)", padding: "12px 14px", fontSize: 13, color: "var(--text)" }}>{detail.description}</div>
      )}

      {/* CSAT al resolverse (o evaluacion ya enviada) */}
      {showCsat && <CaseCsat incidentId={detail.id} existing={survey} />}

      {/* Hilo de comunicacion con la mesa */}
      <div>
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "var(--fs-4)", color: "var(--text)", marginBottom: 10 }}>{t("case.thread.title")}</div>
        {thread.length === 0 ? (
          <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("case.thread.empty")}</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {thread.map((m) => (
              <div key={m.id} style={{ display: "flex", flexDirection: "column", gap: 3, alignItems: m.is_mine ? "flex-end" : "flex-start" }}>
                <div style={{ maxWidth: "82%", background: m.is_mine ? "var(--accent-soft)" : "var(--card)", border: `1px solid ${m.is_mine ? "var(--accent)" : "var(--line)"}`, borderRadius: "var(--r-lg)", padding: "10px 13px", fontSize: 13, color: "var(--text)" }}>{m.body}</div>
                <span style={{ fontSize: 10, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>
                  {m.is_mine ? t("case.you") : m.is_system_generated ? t("case.system") : t("case.team")} · {new Date(m.created_at).toLocaleString(locale)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Responder */}
      {canReply && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={2} placeholder={t("case.reply.placeholder")}
            style={{ fontSize: 13, padding: "9px 11px", borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: "var(--card)", color: "var(--text)", fontFamily: "var(--font-ui)", width: "100%", resize: "vertical" }} />
          {err && <div style={{ fontSize: 12, color: "var(--st-critical-fg)" }}>{err}</div>}
          <button onClick={send} disabled={pending || reply.trim().length === 0} className="cx-btn-primary" style={{ alignSelf: "flex-start" }}>
            {pending ? t("case.reply.sending") : t("case.reply.send")}
          </button>
        </div>
      )}
    </div>
  );
}

function CaseStepper({ idx }: { idx: number }) {
  const { t } = useI18n();
  const steps: MessageKey[] = ["case.step.received", "case.step.inprogress", "case.step.resolved", "case.step.closed"];
  return (
    <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap" }}>
      {steps.map((key, i) => {
        const done = i <= idx;
        const color = done ? "var(--accent)" : "var(--muted)";
        return (
          <div key={key} style={{ display: "flex", alignItems: "center" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
              <span style={{ width: 16, height: 16, borderRadius: "50%", background: done ? color : "transparent", border: `2px solid ${color}`, flexShrink: 0 }} />
              <span style={{ fontSize: 11.5, fontWeight: 600, color: done ? "var(--text)" : "var(--muted)" }}>{t(key)}</span>
            </span>
            {i < steps.length - 1 && <span style={{ width: 22, height: 2, background: "var(--line)", margin: "0 8px" }} />}
          </div>
        );
      })}
    </div>
  );
}
