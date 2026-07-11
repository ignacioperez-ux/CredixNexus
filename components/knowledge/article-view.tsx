"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import type { ArticleDetail } from "@/lib/knowledge/queries";
import { ARTICLE_TYPES } from "@/lib/knowledge/validation";
import { setArticleType, publishArticle } from "@/lib/knowledge/actions";
import { AiReport } from "@/components/ai/ai-report";
import { BackButton } from "@/components/common/back-button";
import { ArticleTypeBadge, HealthBadge } from "./badges";
import { FeedbackWidget } from "./feedback-widget";

export function ArticleView({ detail, canManage, canFeedback }: { detail: ArticleDetail; canManage: boolean; canFeedback: boolean }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const a = detail.article;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 860 }}>
      <BackButton fallback="/knowledge" />

      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--accent-2)" }}>{a.article_number}</span>
        <ArticleTypeBadge type={a.article_type} />
        <HealthBadge health={a.health} pct={a.helpful_pct} />
        {a.status !== "active" && <span style={{ fontSize: 10.5, fontWeight: 600, color: "var(--muted)", background: "var(--paper)", padding: "3px 10px", borderRadius: "var(--r-pill)" }}>{t(("sla.st." + a.status) as MessageKey)}</span>}
      </div>
      <h1 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 700, color: "var(--text)" }}>{a.title}</h1>

      {/* Metricas de uso */}
      <div style={{ display: "flex", gap: 18, flexWrap: "wrap", fontSize: 12, color: "var(--muted)" }}>
        <Stat label={t("kb.col.views")} value={a.view_count} />
        <Stat label={t("kb.kpi.deflections")} value={a.deflection_count} />
        <Stat label={t("kb.kpi.escalations")} value={a.escalation_count} />
        <Stat label={t("kb.fb.yes")} value={a.helpful_count} />
        <Stat label={t("kb.fb.no")} value={a.not_helpful_count} />
      </div>

      {/* Contenido */}
      <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 22 }}>
        {a.content ? <AiReport text={a.content} framed={false} /> : <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("kb.nocontent")}</div>}
        {a.tags.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--line-soft)" }}>
            {a.tags.map((tg) => <span key={tg} style={{ fontSize: 11, color: "var(--muted)", background: "var(--paper)", padding: "3px 9px", borderRadius: "var(--r-pill)" }}>#{tg}</span>)}
          </div>
        )}
      </div>

      {/* Origen: problema / incidente ancla */}
      {(detail.problem || a.source_incident_id) && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {detail.problem && (
            <Link href={`/problems/${detail.problem.id}`} style={anchorCard}>
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "var(--accent-2)" }}>{t("kb.from.problem")}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--accent-2)" }}>{detail.problem.problem_number}</span>
              <span style={{ fontSize: 12.5, color: "var(--text)" }}>{detail.problem.title}</span>
            </Link>
          )}
          {a.source_incident_id && (
            <Link href={`/incidents/${a.source_incident_id}`} style={anchorCard}>
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "var(--accent-2)" }}>{t("kb.from.incident")}</span>
              <span style={{ fontSize: 12.5, color: "var(--text)" }}>{t("kb.from.incident.link")}</span>
            </Link>
          )}
        </div>
      )}

      {/* Feedback (KB viva) */}
      <div style={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 18 }}>
        <FeedbackWidget articleId={a.id} source="kb" initial={detail.myFeedback} canFeedback={canFeedback} />
      </div>

      {/* Gestion (autor) */}
      {canManage && (
        <div style={{ background: "var(--paper)", border: "1px dashed var(--line)", borderRadius: "var(--r-xl)", padding: 18, display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>
            {t("kb.col.type")}
            <select defaultValue={a.article_type} disabled={pending}
              onChange={(e) => { const v = e.target.value; start(async () => { await setArticleType(a.id, v); router.refresh(); }); }}
              style={{ fontSize: 12.5, padding: "8px 10px", borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: "var(--card)", color: "var(--text)" }}>
              {ARTICLE_TYPES.map((ty) => <option key={ty} value={ty}>{t(("kb.type." + ty) as MessageKey)}</option>)}
            </select>
          </label>
          {a.status !== "active" && (
            <button disabled={pending} onClick={() => start(async () => { await publishArticle(a.id); router.refresh(); })}
              style={{ fontSize: 12.5, fontWeight: 600, padding: "9px 16px", borderRadius: "var(--r-md)", border: "none", background: "var(--cta-bg)", color: "var(--cta-fg)", cursor: "pointer" }}>{t("kb.publish")}</button>
          )}
          <span style={{ fontSize: 11, color: "var(--muted)" }}>{t("kb.updated")}: {new Date(a.updated_at).toLocaleDateString(locale)}</span>
        </div>
      )}
    </div>
  );
}

const anchorCard: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "var(--paper)", border: "1px solid var(--line)", borderLeft: "3px solid var(--accent)", borderRadius: "var(--r-md)", textDecoration: "none" };
function Stat({ label, value }: { label: string; value: number }) {
  return <span><b style={{ fontFamily: "var(--font-mono)", color: "var(--text)", fontWeight: 600 }}>{value}</b> {label}</span>;
}
