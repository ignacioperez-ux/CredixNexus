"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import { AiReport } from "@/components/ai/ai-report";
import { portalAssist, type PortalAssistResult } from "@/lib/portal/assist";
import { createIncident } from "@/lib/incidents/actions";
import { recordKbEvent } from "@/lib/knowledge/actions";
import { FeedbackWidget } from "@/components/knowledge/feedback-widget";
import type { PortalCategory, MyCase } from "@/lib/portal/queries";
import type { Urgency } from "@/lib/incidents/priority";
import { statusKey } from "@/lib/incidents/labels";

const URGENCIES: Urgency[] = ["critical", "high", "medium", "low"];

export function Portal({ categories, canFeedback, canViewIncidents = false, myCases = [] }: { categories: PortalCategory[]; canFeedback: boolean; canViewIncidents?: boolean; myCases?: MyCase[] }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [res, setRes] = useState<PortalAssistResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [searching, startSearch] = useTransition();
  const [showCreate, setShowCreate] = useState(false);
  const [created, setCreated] = useState<string | null>(null);

  function search() {
    setErr(null);
    startSearch(async () => {
      const r = await portalAssist(query);
      if (!r.ok) { setErr(r.error ?? "ERR_INVALID_FORMAT"); setRes(null); return; }
      setRes(r);
      setShowCreate(false);
    });
  }

  const hasResults = res && (res.articles.length > 0 || res.cases.length > 0 || !!res.guidance);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 900 }}>
      <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("portal.intro")}</div>

      {created && (
        <div style={{ fontSize: 13, fontWeight: 600, padding: "11px 14px", borderRadius: "var(--r-md)", background: "var(--st-low-bg)", color: "var(--st-low-fg)", display: "flex", alignItems: "center", gap: 8 }}>
          ✓ {t("portal.created")} <span style={{ fontFamily: "var(--font-mono)" }}>{created}</span>
        </div>
      )}

      {/* Mis casos: lo que el usuario reporto (auto-scope). Su "operacion" como usuario final. */}
      {myCases.length > 0 && (
        <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 18 }}>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, color: "var(--text)", marginBottom: 12 }}>{t("portal.mycases")} ({myCases.length})</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {myCases.map((c) => {
              const row = (
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", background: "var(--paper)", borderRadius: "var(--r-md)" }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent-2)" }}>{c.incident_number}</span>
                  <span style={{ flex: 1, fontSize: 12.5, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.title}</span>
                  <span style={{ fontSize: 10.5, fontWeight: 600, color: "var(--muted)" }}>{t(statusKey(c.status))}</span>
                  <span style={{ fontSize: 10.5, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>{new Date(c.opened_at).toLocaleDateString(locale)}</span>
                </div>
              );
              return canViewIncidents
                ? <Link key={c.id} href={`/incidents/${c.id}`} style={{ textDecoration: "none" }}>{row}</Link>
                : <div key={c.id}>{row}</div>;
            })}
          </div>
        </div>
      )}

      {/* Buscador */}
      <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>{t("portal.search.label")}</label>
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) search(); }}
          rows={3}
          placeholder={t("portal.search.placeholder")}
          style={{ fontSize: 13.5, padding: "10px 12px", borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: "var(--paper)", color: "var(--text)", resize: "vertical", fontFamily: "var(--font-ui)" }}
        />
        {err && <div style={{ fontSize: 12, color: "var(--st-critical-fg)" }}>{t(("err." + err) as MessageKey)}</div>}
        <button onClick={search} disabled={searching || query.trim().length < 8}
          style={{ alignSelf: "flex-start", fontSize: 13, fontWeight: 600, padding: "9px 18px", borderRadius: "var(--r-md)", border: "none", background: "var(--cta-bg)", color: "var(--cta-fg)", cursor: searching || query.trim().length < 8 ? "default" : "pointer", opacity: query.trim().length < 8 ? 0.6 : 1 }}>
          {searching ? t("portal.search.searching") : t("portal.search.btn")}
        </button>
      </div>

      {res && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {!res.aiConfigured && (
            <div style={{ fontSize: 12, color: "var(--muted)", background: "var(--paper)", border: "1px solid var(--line)", borderRadius: "var(--r-md)", padding: "9px 12px" }}>{t("portal.ai.off")}</div>
          )}

          {/* Guia IA */}
          {res.guidance && (
            <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <h3 style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, color: "var(--text)" }}>{t("portal.guidance.title")}</h3>
                {typeof res.confidence === "number" && <Chip>{t("portal.confidence")}: {res.confidence}%</Chip>}
                {res.resolved === false && <Chip warn>{t("portal.resolved.no")}</Chip>}
                {res.resolved === true && <Chip ok>{t("portal.resolved.yes")}</Chip>}
              </div>
              <AiReport text={res.guidance} />
            </section>
          )}

          {/* Articulos KB */}
          <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <h3 style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, color: "var(--text)" }}>{t("portal.kb.title")}</h3>
            {res.articles.length === 0 && <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("portal.kb.none")}</div>}
            {res.articles.map((a) => <KbCard key={a.id} id={a.id} number={a.article_number} title={a.title} summary={a.summary} content={a.content} canFeedback={canFeedback} />)}
          </section>

          {/* Casos similares */}
          <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <h3 style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, color: "var(--text)" }}>{t("portal.cases.title")}</h3>
            {res.cases.length === 0 && <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("portal.cases.none")}</div>}
            {res.cases.map((c) => (
              <Link key={c.id} href={`/incidents/${c.id}`} style={{ textDecoration: "none" }}>
                <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-md)", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent-2)" }}>{c.incident_number}</span>
                    <span style={{ fontSize: 13, color: "var(--text)", fontWeight: 600 }}>{c.title}</span>
                  </div>
                  {c.resolution && <div style={{ fontSize: 12, color: "var(--muted)" }}>{c.resolution}</div>}
                </div>
              </Link>
            ))}
          </section>

          {!hasResults && <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("portal.empty")}</div>}

          {/* No resolvio -> crear caso */}
          <div style={{ background: "var(--paper)", border: "1px dashed var(--line)", borderRadius: "var(--r-xl)", padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("portal.create.hint")}</div>
            {!showCreate ? (
              <button onClick={() => setShowCreate(true)}
                style={{ alignSelf: "flex-start", fontSize: 13, fontWeight: 600, padding: "9px 18px", borderRadius: "var(--r-md)", border: "1px solid var(--accent)", background: "transparent", color: "var(--accent-2)", cursor: "pointer" }}>
                {t("portal.create.cta")}
              </button>
            ) : (
              <CreateCaseForm
                defaultTitle={query.slice(0, 120)}
                defaultDescription={query}
                categories={categories}
                suggestedCategoryId={res.suggestedCategoryId}
                shownArticleIds={res.articles.map((a) => a.id)}
                query={query}
                onDone={(id, number) => {
                  if (canViewIncidents) { router.push(`/incidents/${id}`); return; }
                  // Usuario final: no puede abrir la vista de agente; se queda en el portal,
                  // ve su caso en "Mis casos" y una confirmacion con el numero.
                  setShowCreate(false); setRes(null); setQuery(""); setCreated(number ?? "");
                  router.refresh();
                }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CreateCaseForm({
  defaultTitle, defaultDescription, categories, suggestedCategoryId, shownArticleIds, query, onDone,
}: { defaultTitle: string; defaultDescription: string; categories: PortalCategory[]; suggestedCategoryId?: string; shownArticleIds: string[]; query: string; onDone: (id: string, number?: string) => void }) {
  const { t } = useI18n();
  const [title, setTitle] = useState(defaultTitle);
  const [description, setDescription] = useState(defaultDescription);
  const [categoryId, setCategoryId] = useState(suggestedCategoryId ?? "");
  const [urgency, setUrgency] = useState<Urgency>("medium");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit() {
    setErr(null);
    start(async () => {
      const r = await createIncident({ title: title.trim(), description: description.trim(), categoryId, impact: "medium", urgency });
      if (!r.ok || !r.id) { setErr(r.error ?? "ERR_INVALID_FORMAT"); return; }
      // Los articulos mostrados no evitaron el caso: telemetria de escalacion (KB viva).
      await Promise.all(shownArticleIds.map((aid) => recordKbEvent(aid, "escalation", "portal", query)));
      onDone(r.id, r.number);
    });
  }

  const field: React.CSSProperties = { fontSize: 13, padding: "9px 11px", borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: "var(--card)", color: "var(--text)", fontFamily: "var(--font-ui)", width: "100%" };
  const lbl: React.CSSProperties = { fontSize: 11.5, fontWeight: 600, color: "var(--text)", marginBottom: 5, display: "block" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div><label style={lbl}>{t("portal.create.field.title")}</label><input value={title} onChange={(e) => setTitle(e.target.value)} style={field} /></div>
      <div><label style={lbl}>{t("portal.create.field.desc")}</label><textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} style={{ ...field, resize: "vertical" }} /></div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label style={lbl}>{t("portal.create.field.cat")}</label>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} style={field}>
            <option value="">{t("portal.cat.choose")}</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label style={lbl}>{t("portal.create.field.urgency")}</label>
          <select value={urgency} onChange={(e) => setUrgency(e.target.value as Urgency)} style={field}>
            {URGENCIES.map((u) => <option key={u} value={u}>{t(("lvl." + u) as MessageKey)}</option>)}
          </select>
        </div>
      </div>
      {err && <div style={{ fontSize: 12, color: "var(--st-critical-fg)" }}>{t(("err." + err) as MessageKey)}</div>}
      <button onClick={submit} disabled={pending || !categoryId || title.trim().length < 5 || description.trim().length < 10}
        style={{ alignSelf: "flex-start", fontSize: 13, fontWeight: 600, padding: "9px 18px", borderRadius: "var(--r-md)", border: "none", background: "var(--cta-bg)", color: "var(--cta-fg)", cursor: pending ? "default" : "pointer", opacity: !categoryId || title.trim().length < 5 || description.trim().length < 10 ? 0.6 : 1 }}>
        {pending ? t("portal.create.submitting") : t("portal.create.submit")}
      </button>
    </div>
  );
}

function KbCard({ id, number, title, summary, content, canFeedback }: { id: string; number: string; title: string; summary: string | null; content: string; canFeedback: boolean }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-md)", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "var(--accent-2)", background: "var(--accent-soft)", padding: "2px 8px", borderRadius: "var(--r-pill)" }}>{t("portal.kb.badge")}</span>
        <Link href={`/knowledge/${id}`} style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)", textDecoration: "none" }}>{number}</Link>
        <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text)" }}>{title}</span>
      </div>
      {summary && <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{summary}</div>}
      {open && content && <AiReport text={content} framed={false} />}
      {content && (
        <button onClick={() => setOpen((o) => !o)}
          style={{ alignSelf: "flex-start", fontSize: 12, fontWeight: 600, color: "var(--accent-2)", background: "transparent", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline" }}>
          {open ? t("portal.kb.hide") : t("portal.kb.read")}
        </button>
      )}
      {canFeedback && <div style={{ borderTop: "1px solid var(--line-soft)", paddingTop: 8 }}><FeedbackWidget articleId={id} source="portal" canFeedback={canFeedback} compact /></div>}
    </div>
  );
}

function Chip({ children, ok, warn }: { children: React.ReactNode; ok?: boolean; warn?: boolean }) {
  const fg = ok ? "var(--st-low-fg)" : warn ? "var(--st-high-fg)" : "var(--muted)";
  const bg = ok ? "var(--st-low-bg)" : warn ? "var(--st-high-bg)" : "var(--paper)";
  return <span style={{ fontSize: 10.5, fontWeight: 600, color: fg, background: bg, padding: "3px 10px", borderRadius: "var(--r-pill)" }}>{children}</span>;
}
