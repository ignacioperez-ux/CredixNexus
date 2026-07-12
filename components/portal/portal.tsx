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
import type { PortalCategory, PortalApp, MyCase } from "@/lib/portal/queries";
import type { Urgency } from "@/lib/incidents/priority";
import { statusKey } from "@/lib/incidents/labels";

const URGENCIES: Urgency[] = ["critical", "high", "medium", "low"];
const MIN_CHARS = 8;

export function Portal({ categories, applications = [], canFeedback, canViewIncidents = false, myCases = [], userName = "" }: {
  categories: PortalCategory[]; applications?: PortalApp[]; canFeedback: boolean; canViewIncidents?: boolean; myCases?: MyCase[]; userName?: string;
}) {
  const { t, locale } = useI18n();
  const firstName = userName.trim().split(/[\s@.]+/)[0] || "";
  const openCount = myCases.filter((c) => !["resolved", "closed", "cancelled"].includes(c.status)).length;
  const router = useRouter();
  const [subject, setSubject] = useState("");
  const [touched, setTouched] = useState(false);
  const [appId, setAppId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [autoCat, setAutoCat] = useState(false);
  const [urgency, setUrgency] = useState<Urgency>("medium");
  const [res, setRes] = useState<PortalAssistResult | null>(null);
  const [searching, startSearch] = useTransition();
  const [registering, startReg] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [created, setCreated] = useState<string | null>(null);

  const tooShort = subject.trim().length < MIN_CHARS;

  function consult() {
    setErr(null);
    startSearch(async () => {
      const r = await portalAssist(subject);
      if (!r.ok) { setErr(r.error ?? "ERR_INVALID_FORMAT"); return; }
      setRes(r);
      // Pre-selecciona la categoria sugerida por IA si el usuario no eligio una.
      if (r.suggestedCategoryId && !categoryId) { setCategoryId(r.suggestedCategoryId); setAutoCat(true); }
    });
  }

  function register() {
    setErr(null);
    if (tooShort) { setTouched(true); return; }
    if (!categoryId) { setErr("ERR_REQUIRED_FIELD"); return; }
    startReg(async () => {
      const r = await createIncident({ title: subject.trim().slice(0, 120), description: subject.trim(), categoryId, affectedCiId: appId || undefined, impact: "medium", urgency });
      if (!r.ok || !r.id) { setErr(t(("err." + (r.error ?? "ERR_INVALID_FORMAT")) as MessageKey)); return; }
      if (res) await Promise.all(res.articles.map((a) => recordKbEvent(a.id, "escalation", "portal", subject)));
      if (canViewIncidents) { router.push(`/incidents/${r.id}`); return; }
      setCreated(r.number ?? ""); setSubject(""); setRes(null); setCategoryId(""); setAppId(""); setAutoCat(false); setTouched(false);
      router.refresh();
    });
  }

  const field: React.CSSProperties = { fontSize: 13, padding: "9px 11px", borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: "var(--card)", color: "var(--text)", fontFamily: "var(--font-ui)", width: "100%" };
  const lbl: React.CSSProperties = { fontSize: 11.5, fontWeight: 600, color: "var(--text)", marginBottom: 5, display: "block" };
  const apps = applications;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 1120 }}>
      {/* Saludo de bienvenida personalizado */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, background: "linear-gradient(120deg, var(--accent-soft), transparent 70%)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: "16px 20px" }}>
        <span style={{ fontSize: 30, lineHeight: 1 }}>👋</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18, color: "var(--text)" }}>
            {t("portal.welcome")}{firstName ? `, ${firstName}` : ""}
          </div>
          <div style={{ fontSize: 12.5, color: "var(--muted)" }}>
            {openCount > 0 ? t("portal.welcome.open").replace("{n}", String(openCount)) : t("portal.welcome.sub")}
          </div>
        </div>
      </div>

      <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("portal.intro")}</div>

      {created && (
        <div style={{ fontSize: 13, fontWeight: 600, padding: "11px 14px", borderRadius: "var(--r-md)", background: "var(--st-low-bg)", color: "var(--st-low-fg)", display: "flex", alignItems: "center", gap: 8 }}>
          ✓ {t("portal.created")} <span style={{ fontFamily: "var(--font-mono)" }}>{created}</span>
        </div>
      )}

      {/* Mis casos */}
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

      {/* Dos columnas: intake (izq) + sugerencias (der) */}
      <div style={{ display: "grid", gridTemplateColumns: "1.05fr 0.95fr", gap: 18, alignItems: "start" }}>
        {/* Intake estructurado */}
        <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, color: "var(--text)" }}>{t("portal.intake.title")}</div>

          <div>
            <label style={lbl}>{t("portal.field.subject")}</label>
            <textarea value={subject} onChange={(e) => setSubject(e.target.value)} onBlur={() => setTouched(true)} rows={3}
              placeholder={t("portal.search.placeholder")}
              style={{ ...field, resize: "vertical", borderColor: touched && tooShort ? "var(--st-critical-fg)" : "var(--line)" }} />
            <div style={{ fontSize: 10.5, marginTop: 4, color: touched && tooShort ? "var(--st-critical-fg)" : "var(--muted)" }}>
              {touched && tooShort ? t("portal.subject.min") : t("portal.subject.hint")}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={lbl}>{t("portal.field.app")}</label>
              <select value={appId} onChange={(e) => setAppId(e.target.value)} style={field}>
                <option value="">{t("portal.field.app.none")}</option>
                {apps.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>{t("portal.create.field.cat")}{autoCat && <span style={{ color: "var(--accent-2)", fontWeight: 500 }}> · {t("portal.cat.auto")}</span>}</label>
              <select value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setAutoCat(false); }} style={field}>
                <option value="">{t("portal.cat.choose")}</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          <div style={{ maxWidth: 220 }}>
            <label style={lbl}>{t("portal.create.field.urgency")}</label>
            <select value={urgency} onChange={(e) => setUrgency(e.target.value as Urgency)} style={field}>
              {URGENCIES.map((u) => <option key={u} value={u}>{t(("lvl." + u) as MessageKey)}</option>)}
            </select>
          </div>

          {err && <div style={{ fontSize: 12, color: "var(--st-critical-fg)" }}>{err.startsWith("ERR_") ? t(("err." + err) as MessageKey) : err}</div>}

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={consult} disabled={searching || tooShort}
              style={{ fontSize: 13, fontWeight: 600, padding: "9px 18px", borderRadius: "var(--r-md)", border: "1px solid var(--accent)", background: "transparent", color: "var(--accent-2)", cursor: searching || tooShort ? "default" : "pointer", opacity: tooShort ? 0.6 : 1 }}>
              {searching ? t("portal.search.searching") : t("portal.consult")}
            </button>
            <button onClick={register} disabled={registering || tooShort || !categoryId}
              style={{ fontSize: 13, fontWeight: 600, padding: "9px 18px", borderRadius: "var(--r-md)", border: "none", background: "var(--cta-bg)", color: "var(--cta-fg)", cursor: registering || tooShort || !categoryId ? "default" : "pointer", opacity: tooShort || !categoryId ? 0.6 : 1 }}>
              {registering ? t("portal.create.submitting") : t("portal.register")}
            </button>
          </div>
        </div>

        {/* Sugerencias (derecha) */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, color: "var(--text)" }}>{t("portal.suggest.title")}</div>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>{t("portal.suggest.caption")}</div>
          </div>

          {!res && <div style={{ background: "var(--paper)", border: "1px dashed var(--line)", borderRadius: "var(--r-xl)", padding: 26, textAlign: "center", fontSize: 12.5, color: "var(--muted)" }}>{t("portal.suggest.empty")}</div>}

          {res && (
            <>
              {!res.aiConfigured && <div style={{ fontSize: 11.5, color: "var(--muted)", background: "var(--paper)", border: "1px solid var(--line)", borderRadius: "var(--r-md)", padding: "8px 11px" }}>{t("portal.ai.off")}</div>}

              {res.guidance && (
                <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-md)", padding: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text)" }}>{t("portal.guidance.title")}</span>
                    {typeof res.confidence === "number" && <span style={{ fontSize: 10.5, color: "var(--muted)" }}>· {res.confidence}%</span>}
                  </div>
                  <AiReport text={res.guidance} framed={false} />
                </div>
              )}

              {res.articles.map((a) => <KbCard key={a.id} id={a.id} number={a.article_number} title={a.title} summary={a.summary} content={a.content} canFeedback={canFeedback} />)}

              {res.cases.map((c) => (
                <Link key={c.id} href={canViewIncidents ? `/incidents/${c.id}` : "#"} style={{ textDecoration: "none", pointerEvents: canViewIncidents ? "auto" : "none" }}>
                  <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-md)", padding: "11px 13px" }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--accent-2)" }}>{c.incident_number}</span>
                      <span style={{ fontSize: 12.5, color: "var(--text)", fontWeight: 600 }}>{c.title}</span>
                    </div>
                    {c.resolution && <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 3 }}>{c.resolution}</div>}
                  </div>
                </Link>
              ))}

              {res.articles.length === 0 && res.cases.length === 0 && (
                <div style={{ fontSize: 12, color: "var(--muted)", padding: "8px 2px" }}>{t("portal.suggest.none")}</div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function KbCard({ id, number, title, summary, content, canFeedback }: { id: string; number: string; title: string; summary: string | null; content: string; canFeedback: boolean }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-md)", padding: "13px 15px", display: "flex", flexDirection: "column", gap: 7 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--accent-2)", background: "var(--accent-soft)", padding: "2px 7px", borderRadius: "var(--r-pill)" }}>{t("portal.kb.badge")}</span>
        <Link href={`/knowledge/${id}`} style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--muted)", textDecoration: "none" }}>{number}</Link>
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{title}</span>
      </div>
      {summary && <div style={{ fontSize: 12, color: "var(--muted)" }}>{summary}</div>}
      {open && content && <AiReport text={content} framed={false} />}
      {content && (
        <button onClick={() => setOpen((o) => !o)} style={{ alignSelf: "flex-start", fontSize: 11.5, fontWeight: 600, color: "var(--accent-2)", background: "transparent", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline" }}>
          {open ? t("portal.kb.hide") : t("portal.kb.read")}
        </button>
      )}
      {canFeedback && <div style={{ borderTop: "1px solid var(--line-soft)", paddingTop: 7 }}><FeedbackWidget articleId={id} source="portal" canFeedback={canFeedback} compact /></div>}
    </div>
  );
}
