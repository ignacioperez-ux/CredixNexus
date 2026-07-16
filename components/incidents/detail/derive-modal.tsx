"use client";

import { Icon } from "@/components/ui/icon";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import { getIncidentEvaluation, type IncidentEvaluation } from "@/lib/rules/actions";
import { evaluateIncident } from "@/lib/rules/engine";
import { sendToEvolution } from "@/lib/incidents/actions";
import { explainScore } from "@/lib/ai/suggestions";
import { AiReport } from "@/components/ai/ai-report";

// Modal de "Derivar a Evolucion" (§4). Orquesta lo existente: lee la evaluacion de regla
// (score + factores + decision) para mostrarla ANTES de confirmar; si el caso no fue evaluado,
// ofrece evaluar con el motor. Al confirmar usa sendToEvolution (el caso queda de ancla,
// in_evolution). La decision de negocio sigue siendo del RC: se deja claro en el microcopy.
export function DeriveModal({ incidentId, initialScore, onClose, onDone }: { incidentId: string; initialScore: number; onClose: () => void; onDone: () => void }) {
  const { t } = useI18n();
  const [ev, setEv] = useState<IncidentEvaluation | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [explaining, setExplaining] = useState(false);
  const [aiNotice, setAiNotice] = useState<string | null>(null);

  useEffect(() => {
    getIncidentEvaluation(incidentId).then(setEv).catch(() => setEv({ ok: false }));
  }, [incidentId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function evaluate() {
    setEvaluating(true); setErr(null);
    const r = await evaluateIncident(incidentId);
    setEvaluating(false);
    if (!r.ok) { setErr(t("inc.derive.error")); return; }
    setEv({ ok: true, score: r.score, decision: r.decision, factors: r.factors });
  }
  async function explain() {
    setExplaining(true); setAiNotice(null);
    const r = await explainScore(incidentId);
    setExplaining(false);
    if (!r.ok) { setAiNotice(r.error === "ai_not_configured" ? t("ai.notconfigured") : t("ai.error")); return; }
    setExplanation(r.text ?? "");
  }
  async function confirm() {
    setSending(true); setErr(null);
    const r = await sendToEvolution(incidentId);
    setSending(false);
    if (!r.ok) { setErr(t("inc.derive.error")); return; }
    onDone();
  }

  const loading = ev == null;
  const hasFactors = !!ev?.factors?.length;
  const score = ev?.score ?? initialScore;

  return (
    <div onClick={onClose} role="dialog" aria-modal="true" aria-label={t("inc.derive.title")}
      style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", width: "min(480px, 100%)", maxHeight: "86vh", overflowY: "auto", boxShadow: "var(--sh-float, 0 18px 50px rgba(0,0,0,.4))" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px", borderBottom: "1px solid var(--line)" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 14.5, color: "var(--text)" }}><Icon name="zap" size={16} color="var(--accent)" /> {t("inc.derive.title")}</span>
          <button onClick={onClose} aria-label={t("inc.derive.cancel")} style={{ border: "none", background: "transparent", color: "var(--muted)", cursor: "pointer", display: "inline-flex" }}><Icon name="x" size={16} /></button>
        </div>

        <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
          {loading ? (
            <div style={{ color: "var(--muted)", fontSize: 12.5, padding: "12px 0" }}>{t("inc.derive.loading")}</div>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>{t("rule.score")}</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 26, fontWeight: 600, color: "var(--accent-2)" }}>{Math.round(score)}</span>
              </div>
              {ev?.decision && (
                <div style={{ alignSelf: "flex-start", padding: "3px 11px", borderRadius: "var(--r-pill)", background: "var(--accent-soft)", color: "var(--accent-2)", fontSize: 11.5, fontWeight: 600 }}>
                  {t(("dec." + ev.decision) as MessageKey)}
                </div>
              )}

              {hasFactors ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  {ev!.factors!.map((f) => (
                    <div key={f.code} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 11, color: "var(--muted)", width: 128, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t(("factor." + f.code) as MessageKey)}</span>
                      <div style={{ flex: 1, height: 6, borderRadius: 20, background: "var(--track)", overflow: "hidden" }}>
                        <div style={{ width: `${Math.min(f.raw, 100)}%`, height: "100%", background: "var(--accent-2)", borderRadius: 20 }} />
                      </div>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--muted)", width: 46, textAlign: "right" }}>{Math.round(f.raw)}·{Math.round(f.weight * 100)}%</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <p style={{ margin: 0, fontSize: 12.5, color: "var(--muted)" }}>{t("inc.derive.noeval")}</p>
                  <button onClick={evaluate} disabled={evaluating}
                    style={{ padding: "9px 12px", borderRadius: "var(--r-md)", background: "var(--cta-bg)", color: "var(--cta-fg)", border: "none", fontWeight: 700, fontSize: 12.5, cursor: "pointer", opacity: evaluating ? 0.7 : 1 }}>
                    {evaluating ? t("inc.derive.evaluating") : t("inc.derive.evaluate")}
                  </button>
                </div>
              )}

              {hasFactors && (
                <div style={{ borderTop: "1px solid var(--line-soft)", paddingTop: 12 }}>
                  {explanation ? <AiReport text={explanation} /> : (
                    <button onClick={explain} disabled={explaining}
                      style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 14px", borderRadius: "var(--r-md)", background: "var(--dark-surface)", color: "var(--dark-surface-fg)", border: "1px solid var(--dark-surface-border)", fontWeight: 600, fontSize: 12, cursor: "pointer" }}>
                      <Icon name="sparkle" size={13} color="var(--accent-bright)" /> {explaining ? t("ai.explaining") : t("ai.explain")}
                    </button>
                  )}
                  {aiNotice && <p style={{ marginTop: 8, fontSize: 11, color: "var(--st-high-fg)" }}>{aiNotice}</p>}
                </div>
              )}

              <div style={{ display: "flex", gap: 8, padding: "10px 12px", borderRadius: "var(--r-md)", background: "var(--accent-soft)", fontSize: 11.5, lineHeight: 1.5, color: "var(--text)" }}>
                <Icon name="shield" size={15} color="var(--accent-2)" style={{ flexShrink: 0, marginTop: 1 }} />
                <span>{t("inc.derive.rcNote")}</span>
              </div>

              {err && <p style={{ margin: 0, fontSize: 12, color: "var(--st-critical-fg)" }}>{err}</p>}
            </>
          )}
        </div>

        <div style={{ display: "flex", gap: 10, padding: "14px 18px", borderTop: "1px solid var(--line)" }}>
          <button onClick={onClose} style={{ flex: 1, padding: "10px", borderRadius: "var(--r-md)", background: "var(--card)", color: "var(--muted)", border: "1px solid var(--line)", fontWeight: 600, fontSize: 12.5, cursor: "pointer" }}>{t("inc.derive.cancel")}</button>
          <button onClick={confirm} disabled={sending || loading}
            style={{ flex: 2, padding: "10px", borderRadius: "var(--r-md)", background: "var(--accent)", color: "var(--on-accent)", border: "none", fontWeight: 700, fontSize: 12.5, cursor: sending || loading ? "default" : "pointer", opacity: sending || loading ? 0.6 : 1 }}>
            {sending ? t("inc.derive.sending") : t("inc.derive.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
