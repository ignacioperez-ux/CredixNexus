"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import { AiReport } from "@/components/ai/ai-report";
import { portalAssist, type PortalAssistResult } from "@/lib/portal/assist";
import { createIncident, checkMySimilarCases } from "@/lib/incidents/actions";
import { uploadMyCaseEvidence } from "@/lib/portal/case-actions";
import type { SimilarCaseHit } from "@/lib/incidents/similar";
import { recordKbEvent } from "@/lib/knowledge/actions";
import { FeedbackWidget } from "@/components/knowledge/feedback-widget";
import { evalState, type PortalCategory, type PortalApp, type MyCase, type MyActivityItem } from "@/lib/portal/queries";
import { derivePriority, type Urgency, type Impact } from "@/lib/incidents/priority";
import { statusKey, statusColors, priorityKey, priorityColor } from "@/lib/incidents/labels";
import { Icon } from "@/components/ui/icon";
import { SlaRing } from "@/components/portal/hub-viz";

// Tipos minimos de Web Speech API (no estan en la lib estandar de TS).
type SpeechRec = {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
  onend: () => void; onerror: () => void; start: () => void; stop: () => void;
};
type VoiceWindow = { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };

type Tab = "inicio" | "autoservicio" | "miscasos" | "registrar";
const TABS: Tab[] = ["inicio", "autoservicio", "miscasos", "registrar"];

const URGENCIES: Urgency[] = ["critical", "high", "medium", "low"];
// Impacto estimado del autoservicio: el usuario reporta su propio caso (impacto acotado). Se hace
// EXPLICITO y explicable (no silencioso); la mesa puede ajustarlo. Espeja el enum de la BD.
const INTAKE_IMPACT: Impact = "medium";
const MIN_CHARS = 8;
const SETTLED = ["resolved", "closed", "cancelled"];
const ATTENTION = ["waiting", "reopened"]; // esperan respuesta del usuario

// Familia de acento por categoria (tinte del tema Claro; en Nexus usa fallback a --card/--line).
const CAT_FAMILY: Record<string, string> = {
  ACCESS: "indigo", SECURITY: "indigo",
  DATA_QUALITY: "cyan", RECONCILIATION: "blue",
  PAYMENTS: "emerald", ONBOARDING: "emerald", PAYMENT_NOT_APPLIED: "emerald",
  APPLICATION: "amber", DUPLICATE_CHARGE: "amber",
  DISPUTE: "violet", CUSTOMER_COMPLAINT: "violet",
  FRAUD_SUSPICION: "rose", OPERATIONAL_RISK: "rose", UNRECOGNIZED_CHARGE: "rose",
  API_FAILURE: "teal", INFRASTRUCTURE: "slate",
};
const catFam = (code: string) => CAT_FAMILY[code] ?? "slate";

/** Urgencia de ordenamiento: abiertos SIEMPRE antes que resueltos; dentro de cada grupo,
 *  SLA mas proximo arriba y los sin-SLA al final del grupo. */
const MISSING_DUE = 1e14;
const SETTLED_BUCKET = 1e16;
function sortKey(c: MyCase): number {
  const settled = SETTLED.includes(c.status) ? SETTLED_BUCKET : 0;
  const due = c.sla_resolution_due_at ? new Date(c.sla_resolution_due_at).getTime() : MISSING_DUE;
  return settled + due;
}

export function Portal({ categories, applications = [], canFeedback, canViewIncidents = false, myCases = [], caseTypes = {}, activity = [], userName = "" }: {
  categories: PortalCategory[]; applications?: PortalApp[]; canFeedback: boolean; canViewIncidents?: boolean; myCases?: MyCase[]; caseTypes?: Record<string, { name: string }>; activity?: MyActivityItem[]; userName?: string;
}) {
  const { t, locale } = useI18n();
  const firstName = userName.trim().split(/[\s@.]+/)[0] || "";
  const catLabel = (c: PortalCategory) => (locale === "en" ? c.name_en : c.name) ?? c.name;
  const openCount = myCases.filter((c) => !SETTLED.includes(c.status)).length;
  const resolvedCount = myCases.filter((c) => c.status === "resolved" || c.status === "closed").length;
  const attentionCount = myCases.filter((c) => ATTENTION.includes(c.status)).length;
  const sortedCases = [...myCases].sort((a, b) => sortKey(a) - sortKey(b));
  const toEvalCases = sortedCases.filter((c) => evalState(c.status, c.survey_status) === "pending_eval");
  const caseHref = (id: string) => (canViewIncidents ? `/incidents/${id}` : `/portal/cases/${id}`);

  // Tiempo de respuesta promedio (dato REAL): horas entre apertura y primera respuesta, cuando existe.
  const responded = myCases.filter((c) => c.first_response_at);
  const avgRespH = responded.length
    ? Math.round((responded.reduce((s, c) => s + (new Date(c.first_response_at as string).getTime() - new Date(c.opened_at).getTime()), 0) / responded.length) / 3600000 * 10) / 10
    : null;

  // Conteo por TIPO de caso (barras verde-agua). Nombre desde el catalogo (cero hardcode §11).
  const byType = myCases.reduce<Record<string, number>>((m, c) => { const k = c.case_type || "Incident"; m[k] = (m[k] ?? 0) + 1; return m; }, {});
  const typeRows = Object.entries(byType).sort((a, b) => b[1] - a[1]);
  const maxType = Math.max(1, ...typeRows.map(([, n]) => n));
  const typeName = (code: string) => caseTypes[code]?.name ?? code;

  const router = useRouter();
  const subjectRef = useRef<HTMLTextAreaElement>(null);
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
  const [mine, setMine] = useState<SimilarCaseHit[]>([]);
  const [files, setFiles] = useState<File[]>([]);            // evidencia adjunta ANTES de registrar
  const [caseQuery, setCaseQuery] = useState("");            // buscador de "Mis casos"
  const [caseFilter, setCaseFilter] = useState<string | null>(null); // chip de estado activo

  // Dictado por voz (Web Speech API): opcional, degradado si el navegador no lo soporta.
  const [listening, setListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const recogRef = useRef<SpeechRec | null>(null);
  useEffect(() => {
    const w = window as unknown as VoiceWindow;
    setVoiceSupported(!!(w.SpeechRecognition || w.webkitSpeechRecognition));
  }, []);
  function toggleVoice() {
    if (listening) { recogRef.current?.stop(); return; }
    const w = window as unknown as VoiceWindow;
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = locale === "en" ? "en-US" : "es-ES";
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (e) => {
      const last = e.results[e.results.length - 1];
      const text = last?.[0]?.transcript?.trim();
      if (text) setSubject((s) => (s ? `${s} ${text}` : text));
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recogRef.current = rec;
    setListening(true);
    rec.start();
  }

  const tooShort = subject.trim().length < MIN_CHARS;
  const estPriority = derivePriority(INTAKE_IMPACT, urgency);

  const searchParams = useSearchParams();
  const reportSignal = searchParams.get("report");
  const tabParam = searchParams.get("tab") ?? "inicio";
  const tab: Tab = (TABS as string[]).includes(tabParam) ? (tabParam as Tab) : "inicio";
  // La CTA "Reportar caso" (?report=1) enfoca el intake de la pestana Registrar.
  useEffect(() => {
    if (reportSignal === null) return;
    const el = subjectRef.current;
    if (el) { el.focus(); el.scrollIntoView({ behavior: "smooth", block: "center" }); }
  }, [reportSignal, tab]);

  // Deteccion de duplicados del propio usuario (debounce; sugiere sin bloquear, §11).
  useEffect(() => {
    const text = subject.trim();
    if (text.length < MIN_CHARS) { setMine([]); return; }
    const handle = setTimeout(async () => {
      const r = await checkMySimilarCases({ title: text, description: text, categoryId: categoryId || undefined, affectedCiId: appId || undefined });
      if (r.ok && r.items) setMine(r.items);
    }, 500);
    return () => clearTimeout(handle);
  }, [subject, categoryId, appId]);

  function pickCategory(id: string) {
    setCategoryId(id);
    setAutoCat(false);
    router.push("/portal?tab=registrar");
    const el = subjectRef.current;
    if (el) { el.focus(); el.scrollIntoView({ behavior: "smooth", block: "center" }); }
  }

  function consult() {
    setErr(null);
    startSearch(async () => {
      const draft = { title: subject.trim(), description: subject.trim(), categoryId: categoryId || undefined, affectedCiId: appId || undefined };
      const [r, m] = await Promise.all([portalAssist(subject), checkMySimilarCases(draft)]);
      if (!r.ok) { setErr(r.error ?? "ERR_INVALID_FORMAT"); return; }
      setRes(r);
      if (m.ok && m.items) setMine(m.items);
      if (r.suggestedCategoryId && !categoryId) { setCategoryId(r.suggestedCategoryId); setAutoCat(true); }
    });
  }

  function register() {
    setErr(null);
    if (tooShort) { setTouched(true); return; }
    if (!categoryId) { setErr("ERR_REQUIRED_FIELD"); return; }
    startReg(async () => {
      const r = await createIncident({ title: subject.trim().slice(0, 120), description: subject.trim(), categoryId, affectedCiId: appId || undefined, impact: INTAKE_IMPACT, urgency });
      if (!r.ok || !r.id) { setErr(t(("err." + (r.error ?? "ERR_INVALID_FORMAT")) as MessageKey)); return; }
      if (res) await Promise.all(res.articles.map((a) => recordKbEvent(a.id, "escalation", "portal", subject)));
      // Evidencia opcional adjuntada en el intake: se sube al caso recien creado (owner-checked).
      for (const f of files) { const fd = new FormData(); fd.append("file", f); await uploadMyCaseEvidence(r.id, fd); }
      if (canViewIncidents) { router.push(`/incidents/${r.id}`); return; }
      setCreated(r.number ?? ""); setSubject(""); setRes(null); setCategoryId(""); setAppId(""); setAutoCat(false); setTouched(false); setFiles([]);
      router.refresh();
    });
  }

  const field: React.CSSProperties = { fontSize: 13, padding: "9px 11px", borderRadius: "var(--r-md)", border: "1px solid var(--field-border, var(--line))", background: "var(--field-bg, var(--card))", color: "var(--text)", fontFamily: "var(--font-ui)", width: "100%" };
  const lbl: React.CSSProperties = { fontSize: 11.5, fontWeight: 600, color: "var(--text)", marginBottom: 5, display: "block" };
  const cardBox: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-card, var(--r-xl))", boxShadow: "var(--sh-e1, none)" };
  const sectionTitle: React.CSSProperties = { fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "var(--fs-4)", letterSpacing: "var(--tracking-title, normal)", color: "var(--text)" };
  const apps = applications;

  // "Mis casos": filtro por chip de estado + busqueda por asunto/codigo/tipo.
  const filteredCases = sortedCases.filter((c) =>
    (!caseFilter || c.status === caseFilter) &&
    (!caseQuery.trim() || `${c.title} ${c.incident_number} ${caseTypes[c.case_type || ""]?.name ?? ""}`.toLowerCase().includes(caseQuery.trim().toLowerCase())),
  );
  const CASE_FILTERS: (string | null)[] = [null, "new", "assigned", "in_progress", "waiting", "resolved"];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-5)", maxWidth: "var(--w-app)" }}>
      {created && (
        <div style={{ fontSize: 13, fontWeight: 600, padding: "11px 14px", borderRadius: "var(--r-md)", background: "var(--st-low-bg)", color: "var(--st-low-fg)", display: "flex", alignItems: "center", gap: 8 }}>
          <Icon name="check" size={15} /> {t("portal.created")} <span style={{ fontFamily: "var(--font-mono)" }}>{created}</span>
        </div>
      )}

      {/* ================= INICIO ================= */}
      {tab === "inicio" && (
        <>
          {/* Hero saludo */}
          <div style={{ position: "relative", overflow: "hidden", background: "var(--hero-grad)", border: "1px solid var(--line)", borderRadius: "var(--r-card, var(--r-xl))", boxShadow: "var(--sh-hero, var(--sh-card))", padding: "28px 30px" }}>
            <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".16em", color: "var(--accent-2)", marginBottom: 8 }}>{t("portal.hero.tag")}</div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "var(--fs-greeting, var(--fs-hero))", letterSpacing: "-0.01em", color: "var(--text)", lineHeight: 1.05 }}>
              {t("portal.welcome")}{firstName ? `, ${firstName}` : ""}
            </div>
            <div style={{ fontSize: 14, color: "var(--muted)", marginTop: 8 }}>
              {openCount > 0 ? t("portal.welcome.open").replace("{n}", String(openCount)) : t("portal.welcome.sub")}
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
              <Link href="/portal?tab=registrar" className="cx-btn-primary" style={{ textDecoration: "none" }}><Icon name="plus" size={15} color="var(--on-primary, #fff)" /> {t("portal.register")}</Link>
              <Link href="/portal?tab=miscasos" className="cx-btn-outline" style={{ textDecoration: "none" }}>{t("portal.cta.mycases")}</Link>
            </div>
          </div>

          {toEvalCases.length > 0 && <EvalBanner cases={toEvalCases} t={t} caseHref={caseHref} />}

          {/* MIS INDICADORES */}
          <div>
            <div style={overline}>{t("portal.metrics.title")}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
              <MetricCard label={t("portal.summary.inprogress")} value={openCount} fam="blue" icon="inbox" />
              <MetricCard label={t("portal.summary.resolved")} value={resolvedCount} fam="emerald" icon="check" />
              <MetricCard label={t("portal.metric.response")} value={avgRespH ?? "—"} unit={avgRespH != null ? " h" : ""} fam="teal" icon="power" />
              <MetricCard label={t("portal.summary.attention")} value={attentionCount} fam="amber" icon="alert" />
            </div>
          </div>

          {/* 2-col: por tipo + actividad reciente */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}>
            <div style={{ ...cardBox, padding: "var(--sp-5)" }}>
              <span style={sectionTitle}>{t("portal.bytype.title")}</span>
              {typeRows.length === 0 ? (
                <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 10 }}>{t("portal.mycases.empty")}</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: "var(--sp-3)" }}>
                  {typeRows.map(([code, n]) => (
                    <div key={code} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ width: 130, flexShrink: 0, fontSize: 12, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{typeName(code)}</span>
                      <div style={{ flex: 1, height: 10, background: "var(--track)", borderRadius: "var(--r-pill)", overflow: "hidden" }}>
                        <div style={{ width: `${Math.round((n / maxType) * 100)}%`, height: "100%", background: "var(--teal)", borderRadius: "var(--r-pill)" }} />
                      </div>
                      <span style={{ width: 22, textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)" }}>{n}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ ...cardBox, padding: "var(--sp-5)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <span style={sectionTitle}>{t("portal.activity.title")}</span>
                {activity.length > 0 && <Link href="/portal?tab=miscasos" style={{ fontSize: 12, fontWeight: 600, color: "var(--accent-2)", textDecoration: "none" }}>{t("portal.activity.all")} →</Link>}
              </div>
              {activity.length === 0 ? (
                <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("portal.mycases.empty")}</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {activity.slice(0, 6).map((a, i) => {
                    const who = a.is_mine ? t("case.you") : a.is_system ? t("case.system") : t("case.team");
                    return (
                      <Link key={`${a.incident_id}-${i}`} href={caseHref(a.incident_id)} className="cx-lift" style={{ textDecoration: "none", display: "flex", gap: 10, padding: "9px 12px", background: "var(--paper)", borderRadius: "var(--r-md)" }}>
                        <span style={{ width: 30, height: 30, flexShrink: 0, borderRadius: 8, display: "grid", placeItems: "center", background: "var(--accent-soft)", color: "var(--accent-2)" }}><Icon name={a.is_system ? "zap" : a.is_mine ? "user" : "inbox"} size={14} /></span>
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--accent-2)" }}>{a.incident_number}</span>
                            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)" }}>{who}</span>
                            <span style={{ fontSize: 10.5, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>{new Date(a.created_at).toLocaleDateString(locale)}</span>
                          </span>
                          <span style={{ display: "block", fontSize: 12.5, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2 }}>{a.body}</span>
                        </span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ================= AUTOSERVICIO ================= */}
      {tab === "autoservicio" && (
        <>
          <div style={{ position: "relative", overflow: "hidden", background: "var(--hero-grad)", border: "1px solid var(--line)", borderRadius: "var(--r-card, var(--r-xl))", boxShadow: "var(--sh-hero, var(--sh-card))", padding: "26px 30px" }}>
            <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".16em", color: "var(--accent-2)", marginBottom: 8 }}>{t("portal.auto.tag")}</div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "var(--fs-page-title, 25px)", letterSpacing: "-0.01em", color: "var(--text)" }}>{t("portal.auto.title")}</div>
            <div style={{ fontSize: 14, color: "var(--muted)", marginTop: 6 }}>{t("portal.auto.sub")}</div>
            <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
              <Link href="/portal?tab=registrar" className="cx-btn-primary" style={{ textDecoration: "none" }}><Icon name="plus" size={15} color="var(--on-primary, #fff)" /> {t("portal.register")}</Link>
              <Link href="/knowledge" className="cx-btn-outline" style={{ textDecoration: "none" }}>{t("portal.auto.searchkb")}</Link>
            </div>
          </div>

          {categories.length > 0 && (
            <div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
                <span style={sectionTitle}>{t("portal.browse.title")}</span>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>{t("portal.browse.hint")}</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
                {categories.map((c) => {
                  const fam = catFam(c.code);
                  return (
                    <button key={c.id} type="button" onClick={() => pickCategory(c.id)} className="cx-lift"
                      style={{ display: "flex", alignItems: "center", gap: 11, textAlign: "left", padding: "13px 14px", borderRadius: "var(--r-lg)", cursor: "pointer",
                        background: `var(--acc-${fam}-bg, var(--card))`, border: `1px solid var(--acc-${fam}-border, var(--line))`, boxShadow: "var(--sh-e1, none)" }}>
                      <span style={{ width: 34, height: 34, flexShrink: 0, borderRadius: 10, display: "grid", placeItems: "center", background: `var(--acc-${fam}-ink, var(--accent-2))`, color: "#fff", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 15 }}>{catLabel(c).trim()[0]?.toUpperCase() ?? "?"}</span>
                      <span style={{ display: "flex", flexDirection: "column", minWidth: 0, gap: 2 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{catLabel(c)}</span>
                        <span style={{ fontSize: 9.5, fontFamily: "var(--font-mono)", color: "var(--muted)" }}>{c.code}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Link href="/portal?tab=registrar" className="cx-lift" style={{ ...cardBox, padding: 18, textDecoration: "none", display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ width: 40, height: 40, flexShrink: 0, borderRadius: 11, display: "grid", placeItems: "center", background: "var(--cta-grad, var(--accent))", color: "#fff", boxShadow: "var(--sh-red, none)" }}><Icon name="plus" size={18} color="#fff" /></span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{t("portal.access.register")}</span>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>{t("portal.access.register.sub")}</span>
              </span>
            </Link>
            <Link href="/knowledge" className="cx-lift" style={{ background: "var(--acc-teal-bg, var(--paper))", border: "1px solid var(--acc-teal-border, var(--line))", borderRadius: "var(--r-card, var(--r-xl))", boxShadow: "var(--sh-e1, none)", padding: 18, textDecoration: "none", display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ width: 40, height: 40, flexShrink: 0, borderRadius: 11, display: "grid", placeItems: "center", background: "var(--acc-teal-ink, var(--teal))", color: "#fff" }}><Icon name="sparkle" size={18} color="#fff" /></span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{t("portal.access.kb")}</span>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>{t("portal.access.kb.sub")}</span>
              </span>
            </Link>
          </div>
        </>
      )}

      {/* ================= MIS CASOS ================= */}
      {tab === "miscasos" && (
        <>
          {/* Banner IA (deflection): "se parece a otro ya resuelto?" -> Conocimiento */}
          <Link href="/knowledge" className="cx-lift" style={{ background: "var(--acc-teal-bg, var(--paper))", border: "1px solid var(--acc-teal-border, var(--line))", borderRadius: "var(--r-md)", padding: "13px 15px", textDecoration: "none", display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ width: 34, height: 34, flexShrink: 0, borderRadius: 9, display: "grid", placeItems: "center", background: "var(--acc-teal-ink, var(--teal))", color: "#fff" }}><Icon name="sparkle" size={16} color="#fff" /></span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{t("portal.mycases.ai")}</span>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>{t("portal.mycases.ai.sub")}</span>
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--acc-teal-ink, var(--teal))" }}>{t("portal.mycases.ai.cta")} →</span>
          </Link>

          <div style={{ ...cardBox, padding: 18 }}>
            {/* Barra: buscador + chips de estado */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
              <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
                <span style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", display: "grid", placeItems: "center", color: "var(--muted)" }}><Icon name="search" size={14} /></span>
                <input value={caseQuery} onChange={(e) => setCaseQuery(e.target.value)} placeholder={t("portal.mycases.search")} style={{ ...field, padding: "9px 11px 9px 32px" }} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 14 }}>
              {CASE_FILTERS.map((s) => {
                const active = caseFilter === s;
                return (
                  <button key={s ?? "all"} type="button" onClick={() => setCaseFilter(s)}
                    style={{ fontSize: 12, fontWeight: 600, padding: "5px 12px", borderRadius: "var(--r-pill)", cursor: "pointer",
                      background: active ? "var(--accent)" : "var(--card)", border: active ? "1px solid var(--accent)" : "1px solid var(--line)", color: active ? "var(--on-accent, #fff)" : "var(--muted)" }}>
                    {s ? t(statusKey(s)) : t("portal.mycases.all")}
                  </button>
                );
              })}
            </div>

            {filteredCases.length === 0 ? (
              <div style={{ fontSize: 12.5, color: "var(--muted)", padding: "8px 2px" }}>{myCases.length === 0 ? t("portal.mycases.empty") : t("portal.mycases.nofilter")}</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {filteredCases.map((c) => {
                  const sc = statusColors(c.status);
                  const es = evalState(c.status, c.survey_status);
                  const row = (
                    <div className="cx-lift" style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 12px 9px 13px", background: "var(--paper)", borderRadius: "var(--r-md)", borderLeft: `3px solid ${sc.fg}` }}>
                      <SlaRing openedAt={c.opened_at} dueAt={c.sla_resolution_due_at} resolvedAt={c.resolved_at} status={c.status} size={38} />
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent-2)" }}>{c.incident_number}</span>
                      <span style={{ flex: 1, fontSize: 12.5, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.title}</span>
                      {es && (
                        <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 9px", borderRadius: "var(--r-pill)",
                          color: es === "evaluated" ? "var(--st-low-fg)" : "var(--st-high-fg)",
                          background: es === "evaluated" ? "var(--st-low-bg)" : "var(--st-high-bg)" }}>
                          {t(es === "evaluated" ? "case.eval.done" : "case.eval.pending")}
                        </span>
                      )}
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10.5, fontWeight: 600, color: sc.fg, background: sc.bg, padding: "2px 9px", borderRadius: "var(--r-pill)" }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: sc.fg }} />{t(statusKey(c.status))}
                      </span>
                      <span style={{ fontSize: 10.5, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>{new Date(c.opened_at).toLocaleDateString(locale)}</span>
                    </div>
                  );
                  return <Link key={c.id} href={caseHref(c.id)} style={{ textDecoration: "none" }}>{row}</Link>;
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* ================= REGISTRAR ================= */}
      {tab === "registrar" && (
        <div style={{ display: "grid", gridTemplateColumns: "1.05fr 0.95fr", gap: 18, alignItems: "start" }}>
          {/* Intake estructurado */}
          <div style={{ ...cardBox, padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={sectionTitle}>{t("portal.intake.title")}</div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: -8 }}>{t("portal.intro")}</div>

            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <label style={lbl}>{t("portal.field.subject")}</label>
                {voiceSupported && (
                  <button type="button" onClick={toggleVoice} title={t("portal.voice")}
                    style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, padding: "4px 9px", borderRadius: "var(--r-pill)", cursor: "pointer",
                      border: `1px solid ${listening ? "var(--accent)" : "var(--line)"}`, background: listening ? "var(--accent-soft)" : "var(--card)", color: listening ? "var(--accent-2)" : "var(--muted)" }}>
                    <Icon name={listening ? "power" : "play"} size={12} /> {listening ? t("portal.voice.stop") : t("portal.voice")}
                  </button>
                )}
              </div>
              <textarea ref={subjectRef} value={subject} onChange={(e) => setSubject(e.target.value)} onBlur={() => setTouched(true)} rows={4}
                placeholder={t("portal.search.placeholder")}
                style={{ ...field, resize: "vertical", borderColor: touched && tooShort ? "var(--st-critical-fg)" : "var(--field-border, var(--line))" }} />
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
                  {categories.map((c) => <option key={c.id} value={c.id}>{catLabel(c)}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label style={lbl}>{t("portal.create.field.urgency")}</label>
              <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <select value={urgency} onChange={(e) => setUrgency(e.target.value as Urgency)} style={{ ...field, maxWidth: 220 }}>
                  {URGENCIES.map((u) => <option key={u} value={u}>{t(("lvl." + u) as MessageKey)}</option>)}
                </select>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 11.5, color: "var(--muted)" }}>
                  {t("portal.priority.est")}
                  <span title={t("portal.priority.note")} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontWeight: 600, color: priorityColor(estPriority), background: "var(--paper)", border: "1px solid var(--line)", padding: "3px 10px", borderRadius: "var(--r-pill)", cursor: "help" }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: priorityColor(estPriority) }} />{t(priorityKey(estPriority))}
                  </span>
                </span>
              </div>
              <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 5 }}>{t("portal.priority.note")}</div>
            </div>

            {/* Evidencia (opcional): se adjunta al caso al registrarlo (owner-checked, <=10MB). */}
            <div>
              <label style={lbl}>{t("portal.evidence.title")}</label>
              <label style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: 16, borderRadius: "var(--r-md)", border: "1.5px dashed var(--field-border, var(--line))", background: "var(--field-bg, var(--paper))", cursor: "pointer", textAlign: "center" }}>
                <Icon name="paperclip" size={18} color="var(--muted)" />
                <span style={{ fontSize: 12, color: "var(--muted)" }}>{t("portal.evidence.hint")}</span>
                <input type="file" multiple onChange={(e) => { const fs = Array.from(e.target.files ?? []); e.target.value = ""; setFiles((p) => [...p, ...fs]); }} style={{ display: "none" }} />
              </label>
              {files.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 8 }}>
                  {files.map((f, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--text)" }}>
                      <Icon name="paperclip" size={12} color="var(--muted)" />
                      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--muted)" }}>{Math.round(f.size / 1024)} KB</span>
                      <button type="button" onClick={() => setFiles((p) => p.filter((_, j) => j !== i))} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--muted)", display: "inline-flex" }}><Icon name="x" size={12} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {err && <div style={{ fontSize: 12, color: "var(--st-critical-fg)" }}>{err.startsWith("ERR_") ? t(("err." + err) as MessageKey) : err}</div>}

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button onClick={consult} disabled={searching || tooShort} className="cx-btn-outline">
                {searching ? t("portal.search.searching") : t("portal.consult")}
              </button>
              <button onClick={register} disabled={registering || tooShort || !categoryId} className="cx-btn-primary">
                {registering ? t("portal.create.submitting") : t("portal.register")}
              </button>
            </div>
          </div>

          {/* Sugerencias (derecha) */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <div style={sectionTitle}>{t("portal.suggest.title")}</div>
              <div style={{ fontSize: 11, color: "var(--muted)" }}>{t("portal.suggest.caption")}</div>
            </div>

            {mine.length > 0 && (
              <div role="status" style={{ background: "var(--st-medium-bg)", border: "1px solid var(--st-medium)", borderRadius: "var(--r-md)", padding: 13 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--st-medium-fg)", marginBottom: 3 }}>{t("similar.mine.title")}</div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 9 }}>{t("similar.mine.hint")}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {mine.map((s) => {
                    const sc = statusColors(s.status);
                    return (
                      <Link key={s.id} href={`/portal/cases/${s.id}`} className="cx-lift" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 9, padding: "8px 11px", background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-md)" }}>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--accent-2)" }}>{s.incident_number}</span>
                        <span style={{ flex: 1, fontSize: 12, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</span>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10, fontWeight: 600, color: sc.fg, background: sc.bg, padding: "2px 8px", borderRadius: "var(--r-pill)" }}>
                          <span style={{ width: 5, height: 5, borderRadius: "50%", background: sc.fg }} />{t(statusKey(s.status))}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {!res && mine.length === 0 && <div style={{ background: "var(--acc-teal-bg, var(--paper))", border: "1px dashed var(--acc-teal-border, var(--line))", borderRadius: "var(--r-xl)", padding: 26, textAlign: "center", fontSize: 12.5, color: "var(--muted)" }}>{t("portal.suggest.empty")}</div>}

            {res && (
              <>
                {!res.aiConfigured && <div style={{ fontSize: 11.5, color: "var(--muted)", background: "var(--paper)", border: "1px solid var(--line)", borderRadius: "var(--r-md)", padding: "8px 11px" }}>{t("portal.ai.off")}</div>}

                {res.guidance && (
                  <div style={{ ...cardBox, borderRadius: "var(--r-md)", padding: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text)" }}>{t("portal.guidance.title")}</span>
                      {typeof res.confidence === "number" && <span style={{ fontSize: 10.5, color: "var(--muted)" }}>· {res.confidence}%</span>}
                    </div>
                    <AiReport text={res.guidance} framed={false} />
                  </div>
                )}

                {res.articles.map((a) => <KbCard key={a.id} id={a.id} number={a.article_number} title={a.title} summary={a.summary} content={a.content} canFeedback={canFeedback} />)}

                {res.cases.length > 0 && <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text)", marginTop: 2 }}>{t("portal.cases.title")}</div>}
                {res.cases.map((c) => (
                  <Link key={c.id} href={canViewIncidents ? `/incidents/${c.id}` : "#"} className={canViewIncidents ? "cx-lift" : undefined} style={{ textDecoration: "none", pointerEvents: canViewIncidents ? "auto" : "none" }}>
                    <div style={{ ...cardBox, borderRadius: "var(--r-md)", padding: "11px 13px" }}>
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
      )}
    </div>
  );
}

const overline: React.CSSProperties = { fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".14em", color: "var(--muted)", marginBottom: 10 };

function MetricCard({ label, value, unit = "", fam, icon }: { label: string; value: number | string; unit?: string; fam?: string; icon?: string }) {
  const bg = fam ? `var(--acc-${fam}-bg, var(--paper))` : "var(--paper)";
  const border = fam ? `var(--acc-${fam}-border, var(--line))` : "var(--line)";
  const ink = fam ? `var(--acc-${fam}-ink, var(--text))` : "var(--text)";
  return (
    <div style={{ background: "var(--card)", border: `1px solid var(--line)`, borderRadius: "var(--r-xl)", boxShadow: "var(--sh-e1, none)", padding: "16px 18px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        {icon && <span style={{ width: 28, height: 28, flexShrink: 0, borderRadius: 8, display: "grid", placeItems: "center", background: bg, border: `1px solid ${border}`, color: ink }}><Icon name={icon} size={14} color={ink} /></span>}
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>{label}</span>
      </div>
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 30, letterSpacing: "-0.02em", color: ink, fontVariantNumeric: "tabular-nums" }}>{value}<span style={{ fontSize: 15, fontWeight: 600 }}>{unit}</span></div>
    </div>
  );
}

function EvalBanner({ cases, t, caseHref }: { cases: MyCase[]; t: (k: MessageKey) => string; caseHref: (id: string) => string }) {
  return (
    <div style={{ background: "var(--acc-amber-bg, var(--st-high-bg))", borderRadius: "var(--r-md)", borderLeft: "3px solid var(--acc-amber-ink, var(--st-high))", border: "1px solid var(--acc-amber-border, var(--st-high))", borderLeftWidth: 3, borderLeftColor: "var(--acc-amber-ink, var(--st-high))", padding: "13px 15px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <Icon name="star" size={15} color="var(--acc-amber-ink, var(--st-high-fg))" />
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--acc-amber-ink, var(--st-high-fg))" }}>{t("portal.eval.banner").replace("{n}", String(cases.length))}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {cases.map((c) => (
          <Link key={c.id} href={caseHref(c.id)} className="cx-lift" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 9, padding: "8px 11px", background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-md)" }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--accent-2)" }}>{c.incident_number}</span>
            <span style={{ flex: 1, fontSize: 12.5, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.title}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--accent-2)" }}>{t("portal.eval.cta")} →</span>
          </Link>
        ))}
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
