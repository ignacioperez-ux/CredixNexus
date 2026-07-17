"use client";

import { BackButton } from "@/components/common/back-button";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import { Icon } from "@/components/ui/icon";
import { statusColors, statusKey } from "@/lib/incidents/labels";
import { SlaRing } from "@/components/portal/hub-viz";
import { SlaStatusRow } from "@/components/sla/sla-status";
import { addMyCaseComment, uploadMyCaseEvidence, deleteMyCaseEvidence, escalateMyCase } from "@/lib/portal/case-actions";
import type { MyCaseDetail, CaseThreadItem, MyCaseSurvey, PortalAttachment } from "@/lib/portal/case-queries";
import { CaseCsat } from "./case-csat";

// Detalle de caso PROPIO del usuario (P2): centro de tracking client-centric. No reutiliza la
// vista de agente; muestra estado, SLA, hilo (solo mensajes no internos) y CSAT al resolverse.

function stepIndex(status: string): number {
  if (status === "closed") return 3;
  if (status === "resolved") return 2;
  if (["in_progress", "waiting", "reopened"].includes(status)) return 1;
  return 0; // new / triaged / assigned
}

export function UserCaseDetail({ detail, thread, survey, attachments = [] }: { detail: MyCaseDetail; thread: CaseThreadItem[]; survey: MyCaseSurvey | null; attachments?: PortalAttachment[] }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [reply, setReply] = useState("");
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();
  const [fileErr, setFileErr] = useState<string | null>(null);
  const [escalated, setEscalated] = useState(false);

  function onUpload(ev: React.ChangeEvent<HTMLInputElement>) {
    const file = ev.target.files?.[0];
    ev.target.value = "";
    if (!file) return;
    setFileErr(null);
    const fd = new FormData();
    fd.append("file", file);
    startBusy(async () => {
      const r = await uploadMyCaseEvidence(detail.id, fd);
      if (!r.ok) { setFileErr(r.error?.startsWith("ERR_") ? t(("err." + r.error) as MessageKey) : (r.error ?? "")); return; }
      router.refresh();
    });
  }
  function removeEvidence(id: string) {
    startBusy(async () => { const r = await deleteMyCaseEvidence(id, detail.id); if (r.ok) router.refresh(); });
  }
  function escalate() {
    startBusy(async () => { const r = await escalateMyCase(detail.id); if (r.ok) { setEscalated(true); router.refresh(); } });
  }

  const sc = statusColors(detail.status);
  const inEvolution = detail.status === "in_evolution";
  // Se puede evaluar en resuelto y tambien en cerrado sin evaluar (p.ej. cerrado por el agente);
  // si ya se envio, se muestra en solo-lectura. El estado pasa a "evaluado" al enviar.
  const showCsat = detail.status === "resolved" || detail.status === "closed" || survey?.status === "submitted";
  const canReply = detail.status !== "closed" && detail.status !== "cancelled";

  const cardTitle: React.CSSProperties = { fontFamily: "var(--font-display)", fontWeight: "var(--fw-title, 700)" as React.CSSProperties["fontWeight"], fontSize: "var(--fs-4)", letterSpacing: "var(--tracking-title, normal)", color: "var(--text)" };
  const uploadBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "var(--accent-2)", background: "var(--card)", border: "1px solid var(--accent-2)", borderRadius: "var(--r-md)", padding: "6px 12px", cursor: "pointer" };

  function send() {
    setErr(null);
    if (reply.trim().length === 0) return;
    start(async () => {
      const r = await addMyCaseComment(detail.id, reply);
      if (!r.ok) { setErr(r.error?.startsWith("ERR_") ? t(("err." + r.error) as MessageKey) : (r.error ?? "")); return; }
      setReply(""); router.refresh();
    });
  }

  const affected = detail.app || detail.service || detail.product || detail.channel || detail.business_unit || detail.reporter;
  const panel: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-card, var(--r-xl))", boxShadow: "var(--sh-e1, none)", padding: 16 };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-5)", maxWidth: "var(--w-app)" }}>
      <BackButton fallback="/portal" label="case.back" />

      {/* Cabecera: anillo SLA + numero + estado + titulo (full-width) */}
      <div style={{ ...panel, padding: 20, display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
        <SlaRing openedAt={detail.opened_at} dueAt={detail.sla_resolution_due_at} resolvedAt={detail.resolved_at} status={detail.status} size={54} />
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--accent-2)" }}>{detail.incident_number}</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10.5, fontWeight: 600, color: sc.fg, background: sc.bg, padding: "2px 9px", borderRadius: "var(--r-pill)" }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: sc.fg }} />{t(statusKey(detail.status))}
            </span>
          </div>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: "var(--fw-title, 700)" as React.CSSProperties["fontWeight"], fontSize: "var(--fs-5)", letterSpacing: "var(--tracking-title, normal)", color: "var(--text)", marginTop: 4 }}>{detail.title}</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.55fr 1fr", gap: 16, alignItems: "start" }}>
        {/* ===== IZQUIERDA: seguimiento / evaluacion / detalle / comunicacion ===== */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-5)" }}>
          {inEvolution ? (
            <div style={{ background: "var(--accent-soft)", border: "1px solid var(--accent)", borderRadius: "var(--r-md)", padding: "12px 14px", display: "flex", gap: 10, alignItems: "center" }}>
              <Icon name="zap" size={16} color="var(--accent-2)" />
              <span style={{ fontSize: 12.5, color: "var(--text)" }}>{t("case.evolution.note")}</span>
            </div>
          ) : (
            <div style={panel}><div style={{ ...cardTitle, marginBottom: 12 }}>{t("case.progress.title")}</div><CaseStepper idx={stepIndex(detail.status)} /></div>
          )}

          {detail.description && (
            <div style={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: "var(--r-md)", padding: "12px 14px", fontSize: 13, color: "var(--text)" }}>{detail.description}</div>
          )}

          {showCsat && <CaseCsat incidentId={detail.id} existing={survey} />}

          {affected && (
            <div style={panel}>
              <div style={{ ...cardTitle, marginBottom: 8 }}>{t("case.detail.title")}</div>
              <DRow label={t("inc.field.app")} value={detail.app} />
              <DRow label={t("inc.field.service")} value={detail.service} />
              <DRow label={t("inc.field.product")} value={detail.product} />
              <DRow label={t("inc.field.channel")} value={detail.channel} />
              <DRow label={t("inc.field.bu")} value={detail.business_unit} />
              <DRow label={t("inc.reported")} value={detail.reporter} />
            </div>
          )}

          <div style={panel}>
            <div style={{ ...cardTitle, marginBottom: 12 }}>{t("case.thread.title")}</div>
            {thread.length === 0 ? (
              <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("case.thread.empty")}</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {thread.map((m) => (
                  <div key={m.id} style={{ display: "flex", flexDirection: "column", gap: 3, alignItems: m.is_mine ? "flex-end" : "flex-start" }}>
                    <div style={{ maxWidth: "82%", background: m.is_mine ? "var(--accent-soft)" : "var(--paper)", border: `1px solid ${m.is_mine ? "var(--accent)" : "var(--line)"}`, borderRadius: "var(--r-lg)", padding: "10px 13px", fontSize: 13, color: "var(--text)" }}>{m.body}</div>
                    <span style={{ fontSize: 10, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>
                      {m.is_mine ? t("case.you") : m.is_system_generated ? t("case.system") : t("case.team")} · {new Date(m.created_at).toLocaleString(locale)}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {canReply && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
                <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={2} placeholder={t("case.reply.placeholder")}
                  style={{ fontSize: 13, padding: "9px 11px", borderRadius: "var(--r-md)", border: "1px solid var(--field-border, var(--line))", background: "var(--field-bg, var(--card))", color: "var(--text)", fontFamily: "var(--font-ui)", width: "100%", resize: "vertical" }} />
                {err && <div style={{ fontSize: 12, color: "var(--st-critical-fg)" }}>{err}</div>}
                <button onClick={send} disabled={pending || reply.trim().length === 0} className="cx-btn-primary" style={{ alignSelf: "flex-start" }}>
                  {pending ? t("case.reply.sending") : t("case.reply.send")}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ===== DERECHA: SLA / quien atiende / adjuntos ===== */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-5)" }}>
          <div style={panel}>
            <div style={{ ...cardTitle, marginBottom: 6 }}>{t("case.sla.title")}</div>
            <SlaStatusRow label={t("inc.sla.response")} dueAt={detail.sla_response_due_at} openedAt={detail.opened_at} resolvedAt={detail.first_response_at} status={detail.status} locale={locale} />
            <SlaStatusRow label={t("inc.sla.resolution")} dueAt={detail.sla_resolution_due_at} openedAt={detail.opened_at} resolvedAt={detail.resolved_at} status={detail.status} locale={locale} last />
          </div>

          <div style={panel}>
            <div style={cardTitle}>{t("case.attends.title")}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
              <span style={{ width: 34, height: 34, borderRadius: "50%", background: "var(--acc-blue-bg, var(--accent-soft))", color: "var(--acc-blue-ink, var(--accent-2))", display: "grid", placeItems: "center", fontFamily: "var(--font-mono)", fontSize: 12, flexShrink: 0 }}>{(detail.assignee?.trim()[0] ?? "?").toUpperCase()}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{detail.assignee ?? t("case.attends.unassigned")}</div>
                <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{t("case.attends.mgmt")}</div>
              </div>
            </div>
            {canReply && (
              <button type="button" onClick={escalate} disabled={busy || escalated} className="cx-btn-outline" style={{ marginTop: 12 }}>
                {escalated ? t("case.escalate.done") : t("case.escalate.cta")}
              </button>
            )}
          </div>

          <div style={panel}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
              <span style={cardTitle}>{t("case.evidence.title")}</span>
              <label style={{ ...uploadBtn, opacity: busy ? 0.6 : 1 }}>
                <Icon name="plus" size={13} /> {t("case.evidence.add")}
                <input type="file" onChange={onUpload} disabled={busy} style={{ display: "none" }} />
              </label>
            </div>
            {attachments.length === 0 ? (
              <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("case.evidence.empty")}</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {attachments.map((a) => (
                  <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 11px", background: "var(--paper)", borderRadius: "var(--r-md)" }}>
                    <Icon name="paperclip" size={14} color="var(--muted)" />
                    <a href={a.url ?? "#"} target="_blank" rel="noopener noreferrer" style={{ flex: 1, fontSize: 12.5, color: "var(--accent-2)", textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.file_name}</a>
                    <span style={{ fontSize: 10.5, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>{Math.round(a.size_bytes / 1024)} KB</span>
                    {a.mine && <button type="button" onClick={() => removeEvidence(a.id)} disabled={busy} title={t("case.evidence.remove")} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--muted)", display: "inline-flex" }}><Icon name="x" size={13} /></button>}
                  </div>
                ))}
              </div>
            )}
            {fileErr && <div style={{ fontSize: 11.5, color: "var(--st-critical-fg)", marginTop: 6 }}>{fileErr}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

function DRow({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "6px 0", borderBottom: "1px solid var(--line-soft)" }}>
      <span style={{ fontSize: 12, color: "var(--muted)" }}>{label}</span>
      <span style={{ fontSize: 12.5, color: "var(--text)", textAlign: "right" }}>{value}</span>
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
        const current = i === idx;
        const color = done ? "var(--accent)" : "var(--muted)";
        return (
          <div key={key} style={{ display: "flex", alignItems: "center" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
              <span style={{ width: 16, height: 16, borderRadius: "50%", background: done ? color : "transparent", border: `2px solid ${color}`, flexShrink: 0, boxShadow: current ? "var(--step-glow, none)" : "none" }} />
              <span style={{ fontSize: 11.5, fontWeight: 600, color: done ? "var(--text)" : "var(--muted)" }}>{t(key)}</span>
            </span>
            {i < steps.length - 1 && <span style={{ width: 22, height: 2, background: "var(--line)", margin: "0 8px" }} />}
          </div>
        );
      })}
    </div>
  );
}
