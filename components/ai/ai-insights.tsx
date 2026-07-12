"use client";

import { Icon } from "@/components/ui/icon";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import { classifyIncident, applyCategory, analyzeSentiment, findSimilarIncidents, type ClassifyResult, type SentimentResult, type SimilarItem } from "@/lib/ai/analysis";

const SENT_COLOR: Record<string, string> = { negative: "var(--st-critical-fg)", neutral: "var(--muted)", positive: "var(--st-low-fg)" };

export function AiInsights({ incidentId, canUpdate }: { incidentId: string; canUpdate: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [cls, setCls] = useState<ClassifyResult | null>(null);
  const [sent, setSent] = useState<SentimentResult | null>(null);
  const [sim, setSim] = useState<SimilarItem[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function errText(e?: string) { return e === "ai_not_configured" ? t("ai.notconfigured") : t("ai.error"); }

  function runClassify() { setBusy("cls"); setErr(null); start(async () => { const r = await classifyIncident(incidentId); setBusy(null); if (!r.ok) setErr(errText(r.error)); else setCls(r); }); }
  function runSentiment() { setBusy("sent"); setErr(null); start(async () => { const r = await analyzeSentiment(incidentId); setBusy(null); if (!r.ok) setErr(errText(r.error)); else setSent(r); }); }
  function runSimilar() { setBusy("sim"); setErr(null); start(async () => { const r = await findSimilarIncidents(incidentId); setBusy(null); if (!r.ok) setErr(errText(r.error)); else setSim(r.items ?? []); }); }
  function apply() { if (!cls?.categoryId) return; start(async () => { await applyCategory(incidentId, cls.categoryId!); setCls(null); router.refresh(); }); }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ fontSize: 11, color: "var(--muted)" }}>{t("ai.disclaimer")}</div>

      {/* Clasificar */}
      <div>
        {cls ? (
          <div style={{ background: "var(--paper)", borderRadius: "var(--r-md)", padding: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text)" }}>{cls.name}</span>
              <span style={{ fontSize: 10.5, fontFamily: "var(--font-mono)", color: "var(--accent-2)" }}>{cls.confidence}%</span>
            </div>
            <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 8 }}>{cls.reason}</div>
            <div style={{ display: "flex", gap: 8 }}>
              {canUpdate && <button onClick={apply} disabled={pending} style={btnMini}>{t("ai2.apply")}</button>}
              <button onClick={() => setCls(null)} disabled={pending} style={btnMiniGhost}>{t("common.cancel")}</button>
            </div>
          </div>
        ) : (
          <Btn onClick={runClassify} busy={busy === "cls"} label={t("ai2.classify")} />
        )}
      </div>

      {/* Sentimiento */}
      <div>
        {sent ? (
          <div style={{ background: "var(--paper)", borderRadius: "var(--r-md)", padding: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: SENT_COLOR[sent.sentiment ?? "neutral"] }}>{t(("ai2.sent." + sent.sentiment) as MessageKey)}</span>
              <span style={{ fontSize: 10.5, color: "var(--muted)" }}>· {t("ai2.urgency")}: {t(("ai2.urg." + sent.urgency) as MessageKey)}</span>
            </div>
            <div style={{ fontSize: 12, color: "var(--text)", marginBottom: 4 }}>{sent.summary}</div>
            <div style={{ fontSize: 11.5, color: "var(--muted)" }}>→ {sent.recommendation}</div>
          </div>
        ) : (
          <Btn onClick={runSentiment} busy={busy === "sent"} label={t("ai2.sentiment")} />
        )}
      </div>

      {/* Similares */}
      <div>
        {sim ? (
          sim.length === 0 ? <div style={{ fontSize: 12, color: "var(--muted)" }}>{t("ai2.nosimilar")}</div> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {sim.map((s) => (
                <Link key={s.id} href={`/incidents/${s.id}`} style={{ background: "var(--paper)", borderRadius: "var(--r-md)", padding: "8px 10px", textDecoration: "none", display: "block" }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--accent-2)" }}>{s.incident_number}</span>
                    <span style={{ fontSize: 12, color: "var(--text)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</span>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{s.reason}</div>
                </Link>
              ))}
            </div>
          )
        ) : (
          <Btn onClick={runSimilar} busy={busy === "sim"} label={t("ai2.similar")} />
        )}
      </div>

      {err && <div style={{ fontSize: 11.5, color: "var(--st-high-fg)" }}>{err}</div>}
    </div>
  );
}

function Btn({ onClick, busy, label }: { onClick: () => void; busy: boolean; label: string }) {
  const { t } = useI18n();
  return (
    <button onClick={onClick} disabled={busy}
      style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 14px", borderRadius: "var(--r-md)", background: "var(--dark-surface)", color: "var(--dark-surface-fg)", border: "1px solid var(--dark-surface-border)", fontWeight: 600, fontSize: 12, cursor: busy ? "default" : "pointer", width: "100%", justifyContent: "center" }}>
      <Icon name="sparkle" size={13} color="var(--accent-bright)" style={{ verticalAlign: "-2px" }} /> {busy ? t("ai.generating") : label}
    </button>
  );
}

const btnMini: React.CSSProperties = { fontSize: 11.5, fontWeight: 600, padding: "5px 12px", borderRadius: "var(--r-md)", border: "none", background: "var(--accent)", color: "var(--on-accent)", cursor: "pointer" };
const btnMiniGhost: React.CSSProperties = { fontSize: 11.5, fontWeight: 600, padding: "5px 12px", borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: "var(--card)", color: "var(--text)", cursor: "pointer" };
