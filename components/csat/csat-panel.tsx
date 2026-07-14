"use client";

import { Icon } from "@/components/ui/icon";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import type { CsatSurvey } from "@/lib/csat/queries";
import { submitCsat } from "@/lib/csat/actions";

/** Encuesta de satisfaccion (CSAT) del caso resuelto: captura 1-5 + comentario. */
export function CsatPanel({ incidentId, survey, canSubmit }: { incidentId: string; survey: CsatSurvey | null; canSubmit: boolean }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [score, setScore] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const submitted = survey?.status === "submitted";

  function send() {
    if (!score) return;
    setErr(null);
    start(async () => { const r = await submitCsat(incidentId, score, comment); if (!r.ok) setErr(r.error ?? "error"); else router.refresh(); });
  }

  if (submitted) {
    const s = survey!;
    // Dimensiones que captura el usuario final (Resolucion/Rapidez/Atencion); nulas si fue puntaje unico.
    const dims: { label: MessageKey; value: number | null }[] = [
      { label: "case.csat.q.resolution", value: s.q_resolution },
      { label: "case.csat.q.speed", value: s.q_speed },
      { label: "case.csat.q.attention", value: s.q_attention },
    ];
    const hasDims = dims.some((d) => d.value != null);
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Stars value={s.score ?? 0} />
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--text)" }}>{s.score}/5</span>
        </div>
        {hasDims && (
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 2 }}>
            {dims.filter((d) => d.value != null).map((d) => (
              <div key={d.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <span style={{ fontSize: 11.5, color: "var(--muted)" }}>{t(d.label)}</span>
                <Stars value={d.value ?? 0} />
              </div>
            ))}
          </div>
        )}
        {s.comment && <div style={{ fontSize: 12, color: "var(--muted)" }}>&ldquo;{s.comment}&rdquo;</div>}
        {s.submitted_at && <div style={{ fontSize: 10.5, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>{new Date(s.submitted_at).toLocaleDateString(locale)}</div>}
      </div>
    );
  }

  if (!canSubmit) return <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("csat.pending")}</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontSize: 12, color: "var(--muted)" }}>{t("csat.ask")}</div>
      <div style={{ display: "flex", gap: 4 }} onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} onClick={() => setScore(n)} onMouseEnter={() => setHover(n)}
            style={{ background: "transparent", border: "none", cursor: "pointer", lineHeight: 1, padding: 0, color: (hover || score) >= n ? "#F7CE4B" : "var(--line)" }}><Icon name="star" size={22} fill={(hover || score) >= n ? "#F7CE4B" : "none"} /></button>
        ))}
      </div>
      <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} placeholder={t("csat.comment")}
        style={{ fontSize: 12.5, padding: "8px 10px", borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: "var(--card)", color: "var(--text)", resize: "vertical", fontFamily: "var(--font-ui)" }} />
      {err && <div style={{ fontSize: 11, color: "var(--st-critical)" }}>{err}</div>}
      <button onClick={send} disabled={pending || !score}
        style={{ alignSelf: "flex-start", fontSize: 12.5, fontWeight: 600, padding: "8px 16px", borderRadius: "var(--r-md)", border: "none", background: "var(--cta-bg)", color: "var(--cta-fg)", cursor: pending || !score ? "default" : "pointer" }}>
        {pending ? t("csat.sending") : t("csat.send")}
      </button>
    </div>
  );
}

function Stars({ value }: { value: number }) {
  return <span style={{ display: "inline-flex", gap: 2 }}>{[1, 2, 3, 4, 5].map((n) => <span key={n} style={{ color: value >= n ? "#F7CE4B" : "var(--line)", display: "inline-flex" }}><Icon name="star" size={15} fill={value >= n ? "#F7CE4B" : "none"} /></span>)}</span>;
}
