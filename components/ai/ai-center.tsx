"use client";

import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import type { AiInteraction } from "@/lib/ai/queries";

const AGENTS = ["rca_agent", "score_explainer", "knowledge_agent", "business_case_agent", "exec_summary_agent"];

export function AiCenter({ interactions }: { interactions: AiInteraction[] }) {
  const { t, locale } = useI18n();
  const reviewCount = interactions.filter((i) => i.human_review_required).length;
  const activeAgents = new Set(interactions.map((i) => i.agent_name)).size;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
        <Kpi label={t("aic.kpi.total")} value={interactions.length} />
        <Kpi label={t("aic.kpi.agents")} value={`${activeAgents} / ${AGENTS.length}`} />
        <Kpi label={t("aic.kpi.review")} value={reviewCount} />
      </div>

      {/* Agentes */}
      <Card title={t("aic.agents")}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
          {AGENTS.map((a) => (
            <div key={a} style={{ border: "1px solid var(--line)", borderRadius: "var(--r-lg)", padding: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ color: "var(--accent-2)" }}>✦</span>
                <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13.5, color: "var(--text)" }}>{t(("aic.ag." + a) as MessageKey)}</span>
              </div>
              <p style={{ margin: 0, fontSize: 11.5, color: "var(--muted)", lineHeight: 1.5 }}>{t(("aic.ag." + a + ".d") as MessageKey)}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Guardrails */}
      <div style={{ background: "var(--teal-soft)", border: "1px solid var(--teal)", borderRadius: "var(--r-xl)", padding: "14px 18px" }}>
        <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "var(--teal)", marginBottom: 6 }}>🔒 {t("aic.guardrails")}</div>
        <p style={{ margin: 0, fontSize: 12.5, color: "var(--text)", lineHeight: 1.55 }}>{t("aic.guardrails.text")}</p>
      </div>

      {/* Bitácora */}
      <Card title={t("aic.log")}>
        {interactions.length === 0 ? (
          <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("aic.log.empty")}</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1.2fr 1fr 1.2fr 90px 150px", minWidth: 760 }}>
              {[t("aic.col.agent"), t("aic.col.action"), t("aic.col.entity"), t("aic.col.model"), t("aic.col.review"), t("aic.col.date")].map((h) => (
                <div key={h} style={headSt}>{h}</div>
              ))}
              {interactions.map((i) => (
                <div key={i.id} style={{ display: "contents" }}>
                  <Cell>{t(("aic.ag." + i.agent_name) as MessageKey) || i.agent_name}</Cell>
                  <Cell mono>{i.action_type}</Cell>
                  <Cell mono muted>{i.related_entity_type ?? "—"}</Cell>
                  <Cell mono muted>{i.model_name}</Cell>
                  <div style={{ ...cellSt, justifyContent: "center", color: i.human_review_required ? "var(--st-high-fg)" : "var(--muted)" }}>{i.human_review_required ? "✓" : "—"}</div>
                  <Cell mono muted>{new Date(i.created_at).toLocaleString(locale)}</Cell>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

const headSt: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "#8A948A", padding: "10px 12px", background: "var(--head-bg)" };
const cellSt: React.CSSProperties = { fontSize: 12, padding: "10px 12px", borderTop: "1px solid var(--line-soft)", color: "var(--text)", display: "flex", alignItems: "center" };
function Cell({ children, mono, muted }: { children: React.ReactNode; mono?: boolean; muted?: boolean }) {
  return <div style={{ ...cellSt, fontFamily: mono ? "var(--font-mono)" : "var(--font-ui)", fontSize: mono ? 11 : 12, color: muted ? "var(--muted)" : "var(--text)" }}>{children}</div>;
}
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 20 }}>
    <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, marginBottom: 14, color: "var(--text)" }}>{title}</div>{children}</div>;
}
function Kpi({ label, value }: { label: string; value: number | string }) {
  return <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 16 }}>
    <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--muted)", marginBottom: 10 }}>{label}</div>
    <div style={{ fontFamily: "var(--font-mono)", fontWeight: 500, fontSize: 28, letterSpacing: "-1.5px", color: "var(--text)" }}>{value}</div></div>;
}
