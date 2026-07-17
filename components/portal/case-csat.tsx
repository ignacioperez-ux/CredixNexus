"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import { submitCaseCsat } from "@/lib/portal/case-actions";
import type { MyCaseSurvey } from "@/lib/portal/case-queries";
import { Icon } from "@/components/ui/icon";

// Color de estrella (gold), consistente con el CSAT del staff (components/csat/csat-panel.tsx).
const STAR = "#F7CE4B";

// CSAT del caso (P4): muy simple, 1..5 en tres dimensiones + comentario. 1 a 1: al enviar,
// el caso se cierra (regla en submit_case_csat). Sin datos inventados.

const DIMS = [
  { key: "resolution", label: "case.csat.q.resolution" as MessageKey },
  { key: "speed", label: "case.csat.q.speed" as MessageKey },
  { key: "attention", label: "case.csat.q.attention" as MessageKey },
] as const;

export function CaseCsat({ incidentId, existing }: { incidentId: string; existing: MyCaseSurvey | null }) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [scores, setScores] = useState<Record<string, number>>({});
  const [comment, setComment] = useState("");
  const [err, setErr] = useState<string | null>(null);

  if (existing?.status === "submitted") {
    return (
      <div style={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: "var(--r-card, var(--r-xl))", padding: 18 }}>
        <div style={{ fontFamily: "var(--font-display)", fontWeight: "var(--fw-title, 700)" as React.CSSProperties["fontWeight"], fontSize: "var(--fs-4)", letterSpacing: "var(--tracking-title, normal)", color: "var(--text)", marginBottom: 10 }}>{t("case.csat.done.title")}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <ReadRow label={t("case.csat.q.resolution")} value={existing.q_resolution} />
          <ReadRow label={t("case.csat.q.speed")} value={existing.q_speed} />
          <ReadRow label={t("case.csat.q.attention")} value={existing.q_attention} />
        </div>
        {existing.comment && <div style={{ marginTop: 10, fontSize: 12.5, color: "var(--muted)", fontStyle: "italic" }}>&ldquo;{existing.comment}&rdquo;</div>}
      </div>
    );
  }

  function submit() {
    setErr(null);
    if (DIMS.some((d) => !scores[d.key])) { setErr(t("case.csat.incomplete")); return; }
    start(async () => {
      const r = await submitCaseCsat(incidentId, scores.resolution, scores.speed, scores.attention, comment);
      if (!r.ok) { setErr(r.error?.startsWith("ERR_") ? t(("err." + r.error) as MessageKey) : (r.error ?? t("err.ERR_INVALID_FORMAT"))); return; }
      router.refresh();
    });
  }

  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--accent)", borderRadius: "var(--r-card, var(--r-xl))", boxShadow: "var(--sh-e1, none)", padding: 20 }}>
      <div style={{ fontFamily: "var(--font-display)", fontWeight: "var(--fw-title, 700)" as React.CSSProperties["fontWeight"], fontSize: "var(--fs-4)", letterSpacing: "var(--tracking-title, normal)", color: "var(--text)" }}>{t("case.csat.title")}</div>
      <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3, marginBottom: 8 }}>{t("case.csat.intro")}</div>
      {/* Leyenda de la escala 1-5 (antes no habia indicacion de que significan los numeros). */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", fontSize: 11, color: "var(--muted)", marginBottom: 12 }}>
        <span><b style={{ fontFamily: "var(--font-mono)", color: "var(--text)" }}>1</b> = {t("case.csat.scale.low")}</span>
        <span style={{ opacity: 0.5 }}>·</span>
        <span><b style={{ fontFamily: "var(--font-mono)", color: "var(--text)" }}>5</b> = {t("case.csat.scale.high")}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {DIMS.map((d) => (
          <div key={d.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{t(d.label)}</span>
            <div style={{ display: "flex", gap: 4 }}>
              {[1, 2, 3, 4, 5].map((n) => {
                const on = (scores[d.key] ?? 0) >= n;
                return (
                  <button key={n} type="button" onClick={() => setScores((p) => ({ ...p, [d.key]: n }))} aria-label={`${t(d.label)}: ${n}`}
                    style={{ background: "transparent", border: "none", cursor: "pointer", lineHeight: 1, padding: 2, color: on ? STAR : "var(--line)" }}>
                    <Icon name="star" size={26} fill={on ? STAR : "none"} />
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} placeholder={t("case.csat.comment.placeholder")}
          style={{ fontSize: 13, padding: "9px 11px", borderRadius: "var(--r-md)", border: "1px solid var(--field-border, var(--line))", background: "var(--field-bg, var(--paper))", color: "var(--text)", fontFamily: "var(--font-ui)", width: "100%", resize: "vertical" }} />
        {err && <div style={{ fontSize: 12, color: "var(--st-critical-fg)" }}>{err}</div>}
        <div style={{ fontSize: 11, color: "var(--muted)" }}>{t("case.csat.closenote")}</div>
        <button onClick={submit} disabled={pending} className="cx-btn-primary" style={{ alignSelf: "flex-start" }}>
          {pending ? t("case.csat.submitting") : t("case.csat.submit")}
        </button>
      </div>
    </div>
  );
}

function ReadRow({ label, value }: { label: string; value: number | null }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
      <span style={{ fontSize: 12.5, color: "var(--text)" }}>{label}</span>
      <span style={{ display: "inline-flex", gap: 2 }}>
        {[1, 2, 3, 4, 5].map((n) => { const on = !!value && n <= value; return <span key={n} style={{ display: "inline-flex", color: on ? STAR : "var(--track)" }}><Icon name="star" size={13} fill={on ? STAR : "none"} /></span>; })}
      </span>
    </div>
  );
}
