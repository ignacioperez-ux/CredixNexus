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
import { useDictation } from "./use-dictation";
import { addMyCaseComment, uploadMyCaseEvidence, deleteMyCaseEvidence, escalateMyCase } from "@/lib/portal/case-actions";
import { setIncidentRecurrence } from "@/lib/incidents/actions";
import type { MyCaseDetail, CaseThreadItem, MyCaseSurvey, PortalAttachment } from "@/lib/portal/case-queries";
import { CaseCsat } from "./case-csat";
import { humanCommitment, humanAgo } from "@/lib/format/time";

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
  // Dictado por voz para responder en el hilo (mismo mecanismo que el intake). Degrada si no hay soporte.
  const dictation = useDictation(locale === "en" ? "en-US" : "es-ES", (txt) => setReply((r) => (r ? `${r} ${txt}` : txt)));

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
  // El reportante puede cambiar libremente su propio flag de reincidencia (sin motivo).
  function toggleRecurrence(next: boolean) {
    startBusy(async () => { const r = await setIncidentRecurrence(detail.id, next); if (r.ok) router.refresh(); });
  }

  const sc = statusColors(detail.status);
  const inEvolution = detail.status === "in_evolution";
  // P6: el caso espera al usuario (en pausa esperando su dato). Ultima pregunta de la mesa = ultimo
  // mensaje que no es mio ni del sistema (una consulta del equipo).
  const awaitingUser = detail.status === "waiting" || detail.status === "reopened";
  const lastStaffMsg = [...thread].reverse().find((m) => !m.is_mine && !m.is_system_generated) ?? null;
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
          <h1 style={{ margin: "6px 0 0", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 28, lineHeight: 1.15, letterSpacing: "-0.01em", color: "var(--text)" }}>{detail.title}</h1>
        </div>
      </div>

      {/* P6.2 · El caso espera al usuario: pregunta de la mesa + respuesta INLINE (no obligar a bajar al hilo). */}
      {awaitingUser && canReply && (
        <div style={{ background: "var(--acc-amber-bg, var(--st-high-bg))", border: "1px solid var(--acc-amber-border, var(--st-high))", borderRadius: "var(--r-2xl, 18px)", padding: 18 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <span aria-hidden style={{ width: 40, height: 40, flexShrink: 0, borderRadius: "50%", background: "var(--acc-amber-ink, var(--st-high))", color: "#fff", display: "grid", placeItems: "center", fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700 }}>{(detail.assignee?.trim()[0] ?? "?").toUpperCase()}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
                {detail.assignee ?? t("case.team")} <span style={{ fontWeight: 500, color: "var(--muted)" }}>· {t("case.attends.desk")}</span>
              </div>
              <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 1 }}>
                {t("case.await.title")}{lastStaffMsg ? ` · ${humanAgo(lastStaffMsg.created_at, locale)}` : ""}
              </div>
              {lastStaffMsg && (
                <blockquote style={{ margin: "10px 0 0", padding: "10px 14px", background: "var(--card)", borderLeft: "3px solid var(--acc-amber-ink, var(--st-high))", borderRadius: "var(--r-md)", fontSize: 14, color: "var(--text)" }}>“{lastStaffMsg.body}”</blockquote>
              )}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
            <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={2} placeholder={t("case.reply.placeholder")}
              style={{ fontSize: 14, padding: "10px 12px", borderRadius: "var(--r-md)", border: "1px solid var(--field-border, var(--line))", background: "var(--field-bg, var(--card))", color: "var(--text)", fontFamily: "var(--font-ui)", width: "100%", resize: "vertical" }} />
            {err && <div role="alert" style={{ fontSize: 12.5, color: "var(--st-critical-fg)" }}>{err}</div>}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button onClick={send} disabled={pending || reply.trim().length === 0} className="cx-btn-primary" style={{ height: 46, borderRadius: 12 }}>
                {pending ? t("case.reply.sending") : t("case.reply.send")}
              </button>
              <label style={{ ...uploadBtn, height: 46, borderRadius: 12, opacity: busy ? 0.6 : 1 }}>
                <Icon name="paperclip" size={14} aria-hidden /> {t("case.evidence.add")}
                <input type="file" onChange={onUpload} disabled={busy} style={{ display: "none" }} />
              </label>
            </div>
          </div>
        </div>
      )}

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

          {/* Reincidencia: el reportante puede marcar/desmarcar libremente su propio caso. */}
          <div style={{ ...panel, padding: "12px 14px" }}>
            <label style={{ display: "flex", alignItems: "flex-start", gap: 9, cursor: busy ? "default" : "pointer" }}>
              <input type="checkbox" checked={detail.is_recurrence} disabled={busy} onChange={(e) => toggleRecurrence(e.target.checked)} style={{ marginTop: 2, cursor: "inherit" }} />
              <span style={{ fontSize: 12.5, color: "var(--text)", fontWeight: 600 }}>
                {t("portal.recurrence.label")}
                {detail.is_recurrence && detail.recurrence_of_number && (
                  <span style={{ display: "block", fontWeight: 400, fontSize: 11.5, color: "var(--muted)", marginTop: 3 }}>{t("inc.recurrence.of")}: <span style={{ fontFamily: "var(--font-mono)", color: "var(--accent-2)" }}>{detail.recurrence_of_number}</span></span>
                )}
              </span>
            </label>
          </div>

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
            <div style={{ ...cardTitle, marginBottom: 12 }}>{t("case.history.title")}</div>
            {thread.length === 0 ? (
              <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("case.thread.empty")}</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {thread.map((m) => {
                  // Punto de color: exito = hito del sistema; espera-usuario = advertencia; avance = info.
                  const isQuestion = !m.is_mine && !m.is_system_generated && m.id === lastStaffMsg?.id && awaitingUser;
                  const dot = m.is_system_generated ? "var(--st-low-fg, var(--st-low))" : isQuestion ? "var(--acc-amber-ink, var(--st-high))" : m.is_mine ? "var(--accent-2)" : "var(--st-info)";
                  return (
                    <div key={m.id} style={{ display: "flex", gap: 11, alignItems: "flex-start" }}>
                      <span aria-hidden style={{ width: 10, height: 10, borderRadius: "50%", background: dot, flexShrink: 0, marginTop: 5 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, color: "var(--text)", lineHeight: 1.5 }}>{m.body}</div>
                        <span style={{ fontSize: 11, color: "var(--muted)" }}>
                          {m.is_mine ? t("case.you") : m.is_system_generated ? t("case.system") : t("case.team")} · {humanAgo(m.created_at, locale)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {canReply && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
                {dictation.supported && (
                  <button type="button" onClick={dictation.toggle} title={t("portal.voice")}
                    style={{ alignSelf: "flex-end", display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, padding: "4px 9px", borderRadius: "var(--r-pill)", cursor: "pointer",
                      border: `1px solid ${dictation.listening ? "var(--accent)" : "var(--line)"}`, background: dictation.listening ? "var(--accent-soft)" : "var(--card)", color: dictation.listening ? "var(--accent-2)" : "var(--muted)" }}>
                    <Icon name={dictation.listening ? "power" : "play"} size={12} /> {dictation.listening ? t("portal.voice.stop") : t("portal.voice")}
                  </button>
                )}
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

        {/* ===== DERECHA: cuando se resuelve / SLA / quien atiende / adjuntos ===== */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-5)" }}>
          {/* P6.3 · Cuando se resuelve (compromiso legible + motivo si esta en pausa). */}
          <div style={panel}>
            <div style={{ ...cardTitle, marginBottom: 8 }}>{t("case.when.title")}</div>
            {detail.status === "resolved" || detail.status === "closed" ? (
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--st-low-fg, var(--st-low))" }}>{t("case.when.resolved")}</div>
            ) : (
              <>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 18, color: "var(--text)" }}>{humanCommitment(detail.sla_resolution_due_at, locale) ?? t("case.when.tbd")}</div>
                {awaitingUser && <div style={{ marginTop: 6, fontSize: 12.5, fontWeight: 600, color: "var(--acc-amber-ink, var(--st-high-fg))" }}>{t("case.when.paused")}</div>}
              </>
            )}
          </div>

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
