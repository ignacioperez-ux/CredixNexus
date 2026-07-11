"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import { evaluateIncident, type EvaluationResult } from "@/lib/rules/engine";
import { explainScore } from "@/lib/ai/suggestions";
import { AiReport } from "@/components/ai/ai-report";

export function EvaluatePanel({ incidentId }: { incidentId: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [res, setRes] = useState<EvaluationResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [explaining, setExplaining] = useState(false);
  const [aiNotice, setAiNotice] = useState<string | null>(null);

  async function explain() {
    setExplaining(true);
    setAiNotice(null);
    const r = await explainScore(incidentId);
    setExplaining(false);
    if (!r.ok) {
      setAiNotice(r.error === "ai_not_configured" ? t("ai.notconfigured") : t("ai.error"));
      return;
    }
    setExplanation(r.text ?? "");
  }

  async function run() {
    setBusy(true);
    const r = await evaluateIncident(incidentId);
    setBusy(false);
    setRes(r);
    if (r.ok) router.refresh();
  }

  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 18 }}>
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14.5, marginBottom: 12, color: "var(--text)" }}>
        {t("rule.active")}
      </div>
      <button onClick={run} disabled={busy}
        style={{ width: "100%", padding: "10px", borderRadius: "var(--r-md)", background: "var(--cta-bg)", color: "var(--cta-fg)", border: "none", fontWeight: 700, fontSize: 13, cursor: "pointer", opacity: busy ? 0.7 : 1 }}>
        {busy ? t("rule.evaluating") : t("rule.evaluate")}
      </button>

      {res?.ok && res.factors && (
        <div style={{ marginTop: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>{t("rule.score")}</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 24, fontWeight: 500, color: "var(--accent-2)" }}>{res.score}</span>
          </div>
          <div style={{ display: "inline-block", padding: "3px 11px", borderRadius: "var(--r-pill)", background: "var(--accent-soft)", color: "var(--accent-2)", fontSize: 11.5, fontWeight: 600, marginBottom: 12 }}>
            {t(("dec." + res.decision) as MessageKey)}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {res.factors.map((f) => (
              <div key={f.code} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11, color: "var(--muted)", width: 120, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {t(("factor." + f.code) as MessageKey)}
                </span>
                <div style={{ flex: 1, height: 6, borderRadius: 20, background: "var(--track)", overflow: "hidden" }}>
                  <div style={{ width: `${f.raw}%`, height: "100%", background: "var(--accent-2)", borderRadius: 20 }} />
                </div>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--muted)", width: 46, textAlign: "right" }}>
                  {Math.round(f.raw)}·{Math.round(f.weight * 100)}%
                </span>
              </div>
            ))}
          </div>

          {/* Explicacion en lenguaje natural (IA) */}
          <div style={{ marginTop: 14, borderTop: "1px solid var(--line-soft)", paddingTop: 12 }}>
            {explanation ? (
              <AiReport text={explanation} />
            ) : (
              <button onClick={explain} disabled={explaining}
                style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 14px", borderRadius: "var(--r-md)", background: "var(--dark-surface)", color: "var(--dark-surface-fg)", border: "1px solid var(--dark-surface-border)", fontWeight: 600, fontSize: 12, cursor: "pointer" }}>
                <span style={{ color: "var(--accent-bright)" }}>✦</span> {explaining ? t("ai.explaining") : t("ai.explain")}
              </button>
            )}
            {aiNotice && <p style={{ marginTop: 8, fontSize: 11, color: "var(--st-high-fg)" }}>{aiNotice}</p>}
          </div>
        </div>
      )}
      {res && !res.ok && (
        <p style={{ marginTop: 10, fontSize: 11.5, color: "var(--st-critical-fg)" }}>Error: {res.error}</p>
      )}
    </div>
  );
}
