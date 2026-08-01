"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import { searchKb } from "@/lib/portal/assist";
import type { SearchResult } from "@/lib/portal/queries";
import { createIncident, checkMySimilarCases } from "@/lib/incidents/actions";
import { uploadMyCaseEvidence } from "@/lib/portal/case-actions";
import type { SimilarCaseHit } from "@/lib/incidents/similar";
import { evalState, type PortalCategory, type PortalApp, type MyCase, type MyActivityItem } from "@/lib/portal/queries";
import { derivePriority, bumpPriority, type Urgency, type Impact } from "@/lib/incidents/priority";
import { UrgencySegmented } from "@/components/portal/urgency-segmented";
import { EvidenceDropzone } from "@/components/portal/evidence-dropzone";
import { SuggestionsStrip, type StripItem } from "@/components/portal/suggestions-strip";
import { getReportAggregators, joinAsChildCase, reportRecurrence, type Aggregator } from "@/lib/portal/duplicates";
import { DuplicateBlock, TrendingAggregators } from "@/components/portal/duplicate-group";
import { CaseInbox, type InboxGroup } from "@/components/cases/case-inbox";
import { CaseCreated, type Confirmation } from "@/components/portal/case-created";
import { humanAgo, humanCommitment } from "@/lib/format/time";
import { priorityKey, priorityColor } from "@/lib/incidents/labels";
import { Icon } from "@/components/ui/icon";

// Tipos minimos de Web Speech API (no estan en la lib estandar de TS).
type SpeechRec = {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
  onend: () => void; onerror: () => void; start: () => void; stop: () => void;
};
type VoiceWindow = { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };

type Tab = "inicio" | "autoservicio" | "miscasos" | "registrar";
const TABS: Tab[] = ["inicio", "autoservicio", "miscasos", "registrar"];

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

export function Portal({ categories, applications = [], canViewIncidents = false, myCases = [], caseTypes = {}, activity = [], userName = "" }: {
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
  const [isRecurrence, setIsRecurrence] = useState(false);       // reincidencia: fix previo fallido
  const [recurrenceOf, setRecurrenceOf] = useState("");          // caso previo (opcional)
  const [registering, startReg] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [conf, setConf] = useState<Confirmation | null>(null); // P5: confirmacion con expectativa explicita
  const [mine, setMine] = useState<SimilarCaseHit[]>([]);
  const [kb, setKb] = useState<SearchResult>({ articles: [], cases: [] }); // sugerencias KB en vivo (al tipear)
  const [suggestDismissed, setSuggestDismissed] = useState(false); // P2: la X cierra la tira de forma persistente durante esta redaccion
  const [agg, setAgg] = useState<Aggregator | null>(null);   // P4: caso agrupador que mejor matchea el borrador
  const [trending, setTrending] = useState<Aggregator[]>([]); // P4.5: agrupadores 24h ("reportado hoy por otras personas")
  const [aggDismissed, setAggDismissed] = useState(false);   // "mi caso es distinto"
  const [joinBusyId, setJoinBusyId] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);            // evidencia adjunta ANTES de registrar
  const [caseQuery, setCaseQuery] = useState("");            // buscador de "Mis casos"

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

  // Al SALIR de "Registrar", limpia el estado transitorio del intake. En Next App Router la
  // navegacion entre pestanas (?tab=) y router.refresh() NO desmontan el componente cliente, asi
  // que sin esto quedan pegados el mensaje "caso creado", el texto, la categoria y las sugerencias
  // (casos propios / base de conocimiento) al salir y volver a entrar.
  useEffect(() => {
    if (tab === "registrar") return;
    setSubject(""); setTouched(false); setCategoryId(""); setAppId(""); setAutoCat(false);
    setKb({ articles: [], cases: [] }); setMine([]); setFiles([]); setSuggestDismissed(false);
    setAgg(null); setTrending([]); setAggDismissed(false);
    setConf(null); setErr(null);
  }, [tab]);

  // La CTA "Reportar caso" (?report=1) enfoca el intake de la pestana Registrar.
  useEffect(() => {
    if (reportSignal === null) return;
    const el = subjectRef.current;
    if (el) { el.focus(); el.scrollIntoView({ behavior: "smooth", block: "center" }); }
  }, [reportSignal, tab]);

  // Sugerencia en vivo mientras se escribe (debounce, sin bloquear, §11): casos propios
  // parecidos (deduplicacion) + base de conocimiento/casos resueltos (deflection, sin IA).
  useEffect(() => {
    const text = subject.trim();
    if (text.length < MIN_CHARS) { setMine([]); setKb({ articles: [], cases: [] }); setAgg(null); setTrending([]); return; }
    const handle = setTimeout(async () => {
      const draft = { title: text, description: text, categoryId: categoryId || undefined, affectedCiId: appId || undefined };
      const [r, k, a] = await Promise.all([
        checkMySimilarCases(draft),
        searchKb(text),
        getReportAggregators(draft),   // P4: agrupadores abiertos con >=2 reportes
      ]);
      if (r.ok && r.items) setMine(r.items);
      setKb(k);
      if (a.ok) { setAgg(a.top ?? null); setTrending(a.others ?? []); }
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

  function register() {
    setErr(null);
    // R2: lo unico obligatorio es la descripcion (min 8). La categoria NO se exige; si falta, el
    // caso entra sin clasificar y la mesa lo clasifica. Nunca se devuelve el caso por falta de datos.
    if (tooShort) { setTouched(true); return; }
    startReg(async () => {
      const r = await createIncident({ title: subject.trim().slice(0, 120), description: subject.trim(), categoryId: categoryId || undefined, affectedCiId: appId || undefined, impact: INTAKE_IMPACT, urgency, isRecurrence, recurrenceOfIncidentId: recurrenceOf || undefined });
      if (!r.ok || !r.id) { setErr(t(("err." + (r.error ?? "ERR_INVALID_FORMAT")) as MessageKey)); return; }
      // Evidencia opcional adjuntada en el intake: se sube al caso recien creado (owner-checked).
      for (const f of files) { const fd = new FormData(); fd.append("file", f); await uploadMyCaseEvidence(r.id, fd); }
      if (canViewIncidents) { router.push(`/incidents/${r.id}`); return; }
      resetIntake(r);
      router.refresh();
    });
  }

  // Limpia el intake tras registrar/sumarse y muestra la CONFIRMACION (P5) con numero + compromisos SLA.
  type CaseResult = { id?: string; number?: string; openedAt?: string | null; responseDueAt?: string | null; resolutionDueAt?: string | null };
  function resetIntake(r: CaseResult) {
    setConf({ id: r.id ?? "", number: r.number ?? "", openedAt: r.openedAt ?? null, responseDueAt: r.responseDueAt ?? null, resolutionDueAt: r.resolutionDueAt ?? null });
    setSubject(""); setKb({ articles: [], cases: [] }); setCategoryId(""); setAppId(""); setAutoCat(false);
    setTouched(false); setFiles([]); setIsRecurrence(false); setRecurrenceOf(""); setSuggestDismissed(false);
    setAgg(null); setTrending([]); setAggDismissed(false);
  }

  // P4.3/P4.5: el usuario se SUMA a un caso agrupador -> caso hijo vinculado (no un duplicado nuevo).
  // desc opcional: en el bloque principal usa el texto escrito; en "Tambien me pasa" (pie) va en 1 clic.
  function joinCase(parentId: string, desc?: string) {
    setErr(null);
    setJoinBusyId(parentId);
    startReg(async () => {
      const r = await joinAsChildCase(parentId, desc);
      setJoinBusyId(null);
      if (!r.ok || !r.id) { setErr(t(("err." + (r.error ?? "ERR_INVALID_FORMAT")) as MessageKey)); return; }
      if (canViewIncidents) { router.push(`/incidents/${r.id}`); return; }
      resetIntake(r);
      router.refresh();
    });
  }

  // "Volvio a pasar" (P3): reporta un caso resuelto que reincide -> caso nuevo marcado reincidencia.
  function reportAgain(originalId: string) {
    setErr(null);
    startReg(async () => {
      const r = await reportRecurrence(originalId);
      if (!r.ok || !r.id) { setErr(t(("err." + (r.error ?? "ERR_INVALID_FORMAT")) as MessageKey)); return; }
      if (canViewIncidents) { router.push(`/incidents/${r.id}`); return; }
      resetIntake(r); router.refresh();
    });
  }

  // P3: bandeja del usuario agrupada por ACCION (no por estado). Busqueda detras de control secundario.
  const q = caseQuery.trim().toLowerCase();
  const inboxCases = q ? sortedCases.filter((c) => `${c.title} ${c.incident_number} ${caseTypes[c.case_type || ""]?.name ?? ""}`.toLowerCase().includes(q)) : sortedCases;
  const humanStatus = (s: string) => t(("portal.human." + s) as MessageKey);
  const userInbox: InboxGroup[] = [
    {
      key: "action", tone: "attention", icon: "alert", title: t("inbox.user.action"),
      rows: inboxCases.filter((c) => ATTENTION.includes(c.status)).map((c) => ({
        id: c.id, number: c.incident_number, title: c.title, href: caseHref(c.id),
        subtitle: `${c.assignee_name ?? t("case.team")} ${t("inbox.user.asked")} · ${humanAgo(c.updated_at ?? c.opened_at, locale)}`,
        actions: [{ key: "reply", label: t("inbox.user.reply"), variant: "primary" as const, href: caseHref(c.id) }],
      })),
    },
    {
      key: "desk", tone: "info", hint: t("inbox.user.desk.hint"), title: t("inbox.user.desk"),
      rows: inboxCases.filter((c) => !SETTLED.includes(c.status) && !ATTENTION.includes(c.status)).map((c) => ({
        id: c.id, number: c.incident_number, title: c.title, href: caseHref(c.id),
        whoName: c.assignee_name ?? undefined, subtitle: humanStatus(c.status),
        meta: humanCommitment(c.sla_resolution_due_at, locale),
        metaOverdue: !!c.sla_resolution_due_at && new Date(c.sla_resolution_due_at).getTime() < Date.now(),
      })),
    },
    {
      key: "resolved", tone: "resolved", title: t("inbox.user.resolved"),
      rows: inboxCases.filter((c) => SETTLED.includes(c.status)).map((c) => ({
        id: c.id, number: c.incident_number, title: c.title, href: caseHref(c.id),
        subtitle: c.resolved_at ? `${t("portal.human.resolved")} · ${humanAgo(c.resolved_at, locale)}` : undefined,
        actions: [{ key: "again", label: t("inbox.user.again"), variant: "secondary" as const, onClick: () => reportAgain(c.id), disabled: registering }],
      })),
    },
  ];

  // Prioridad mostrada en el chip: sube un nivel si el usuario marca reincidencia (P1.5), igual que el backend.
  const shownPriority = isRecurrence ? bumpPriority(estPriority) : estPriority;

  // P2: la tira reune casos propios parecidos (dedup) + base de conocimiento + casos resueltos.
  // Un resultado por fila con etiqueta de origen. Limite ~6 para no exceder el alto.
  const stripItems: StripItem[] = [
    ...kb.articles.map((a) => ({ key: `kb-${a.id}`, origin: "kb" as const, title: a.title, number: a.article_number, href: `/knowledge/${a.id}`, actionKey: "portal.strip.action.solution" as const })),
    ...mine.map((s) => ({ key: `mine-${s.id}`, origin: (SETTLED.includes(s.status) ? "previous" : "open") as StripItem["origin"], title: s.title, number: s.incident_number, href: `/portal/cases/${s.id}`, actionKey: "portal.strip.action.open" as const })),
    ...kb.cases.map((c) => ({ key: `case-${c.id}`, origin: "previous" as const, title: c.title, number: c.incident_number, href: canViewIncidents ? `/incidents/${c.id}` : "#", actionKey: "portal.strip.action.solution" as const, disabled: !canViewIncidents })),
  ].slice(0, 6);

  const field: React.CSSProperties = { fontSize: 13, padding: "9px 11px", borderRadius: "var(--r-md)", border: "1px solid var(--field-border, var(--line))", background: "var(--field-bg, var(--card))", color: "var(--text)", fontFamily: "var(--font-ui)", width: "100%" };
  const lbl: React.CSSProperties = { fontSize: 11.5, fontWeight: 600, color: "var(--text)", marginBottom: 5, display: "block" };
  const cardBox: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-card, var(--r-xl))", boxShadow: "var(--sh-e1, none)" };
  const sectionTitle: React.CSSProperties = { fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "var(--fs-4)", letterSpacing: "var(--tracking-title, normal)", color: "var(--text)" };
  const apps = applications;


  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-5)", maxWidth: "var(--w-app)" }}>
      {conf && tab !== "registrar" && (
        <div style={{ fontSize: 13, fontWeight: 600, padding: "11px 14px", borderRadius: "var(--r-md)", background: "var(--st-low-bg)", color: "var(--st-low-fg)", display: "flex", alignItems: "center", gap: 8 }}>
          <Icon name="check" size={15} /> {t("portal.created")} <span style={{ fontFamily: "var(--font-mono)" }}>{conf.number}</span>
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
            {myCases.length === 0 ? (
              <div style={{ fontSize: 13, color: "var(--muted)", padding: "8px 2px" }}>{t("portal.mycases.empty")}</div>
            ) : (
              <CaseInbox
                groups={userInbox}
                search={{ value: caseQuery, onChange: setCaseQuery, placeholder: t("portal.mycases.search") }}
                emptyLabel={t("portal.mycases.nofilter")}
              />
            )}
          </div>
        </>
      )}

      {/* ================= REGISTRAR ================= */}
      {tab === "registrar" && conf && (
        <div style={{ maxWidth: 720 }}>
          <div style={{ ...cardBox, padding: "28px 20px" }}>
            <CaseCreated conf={conf} caseHref={caseHref} onNew={() => setConf(null)} />
          </div>
        </div>
      )}

      {tab === "registrar" && !conf && (
        <div style={{ maxWidth: 720 }}>
          <div style={{ ...cardBox, padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <div style={sectionTitle}>{t("portal.intake.title")}</div>
              <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>{t("portal.intro")}</div>
            </div>

            {/* 1 · Texto libre: primero y lo mas grande. Dictar a la derecha de la etiqueta (P1.1). */}
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <label htmlFor="intake-subject" style={{ ...lbl, fontWeight: 700, fontSize: 12.5 }}>{t("portal.field.subject")}</label>
                {voiceSupported && (
                  <button type="button" onClick={toggleVoice} title={t("portal.voice")}
                    style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 600, padding: "6px 11px", minHeight: 32, borderRadius: "var(--r-pill)", cursor: "pointer",
                      border: `1px solid ${listening ? "var(--accent)" : "var(--line)"}`, background: listening ? "var(--accent-soft)" : "var(--card)", color: listening ? "var(--accent-2)" : "var(--muted)" }}>
                    <Icon name={listening ? "power" : "play"} size={13} aria-hidden /> {listening ? t("portal.voice.stop") : t("portal.voice")}
                  </button>
                )}
              </div>
              <textarea id="intake-subject" ref={subjectRef} value={subject} onChange={(e) => setSubject(e.target.value)} onBlur={() => setTouched(true)}
                placeholder={t("portal.intake.placeholder")}
                style={{ ...field, minHeight: 132, fontSize: 16.5, lineHeight: 1.5, padding: "12px 14px", resize: "vertical", borderColor: touched && tooShort ? "var(--st-critical-fg)" : "var(--field-border, var(--line))" }} />
              <div style={{ fontSize: 12, marginTop: 5, color: touched && tooShort ? "var(--st-critical-fg)" : "var(--muted)" }}>
                {touched && tooShort ? t("portal.subject.min") : t("portal.subject.hint")}
              </div>
            </div>

            {/* 2 · Tira de sugerencias descartable, DEBAJO del texto (P2). No panel lateral. */}
            {!tooShort && !suggestDismissed && (
              <SuggestionsStrip items={stripItems} onDismiss={() => setSuggestDismissed(true)} />
            )}

            {/* P4.2 · Duplicados: "N personas reportaron lo mismo" -> sumarse a un caso hijo vinculado. */}
            {!tooShort && agg && !aggDismissed && (
              <DuplicateBlock agg={agg} busy={registering} onJoin={() => joinCase(agg.parentId, subject)} onDismiss={() => setAggDismissed(true)} />
            )}

            {/* 3 · Categorizacion opcional (2 col, 50px). Aplicacion y categoria desde la BD (§11). */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label htmlFor="intake-app" style={{ ...lbl, fontWeight: 700 }}>{t("portal.field.app")}</label>
                <select id="intake-app" value={appId} onChange={(e) => setAppId(e.target.value)} style={{ ...field, height: 50, borderRadius: "var(--r-md)" }}>
                  <option value="">{t("portal.field.app.none")}</option>
                  {apps.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="intake-cat" style={{ ...lbl, fontWeight: 700 }}>{t("portal.create.field.cat")}{autoCat && <span style={{ color: "var(--accent-2)", fontWeight: 500 }}> · {t("portal.cat.auto")}</span>}</label>
                <select id="intake-cat" value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setAutoCat(false); }} style={{ ...field, height: 50, borderRadius: "var(--r-md)" }}>
                  <option value="">{t("portal.cat.none")}</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{catLabel(c)}</option>)}
                </select>
              </div>
            </div>

            {/* 4 · Urgencia segmentada (un clic) + chip de prioridad en vivo (P1.3). */}
            <div>
              <label style={{ ...lbl, fontWeight: 700 }}>{t("portal.create.field.urgency")}</label>
              <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 260 }}><UrgencySegmented value={urgency} onChange={setUrgency} /></div>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12, color: "var(--muted)", flexShrink: 0 }}>
                  {t("portal.priority.est")}
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontWeight: 700, color: priorityColor(shownPriority), background: "var(--paper)", border: "1px solid var(--line)", padding: "5px 12px", borderRadius: "var(--r-pill)" }}>
                    <span aria-hidden style={{ width: 7, height: 7, borderRadius: "50%", background: priorityColor(shownPriority) }} />{t(priorityKey(shownPriority))}
                  </span>
                </span>
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>{t("portal.priority.note")}</div>
            </div>

            {/* 5 · Evidencia opcional (arrastrar + pegar Ctrl+V + seleccionar) — P1.4. */}
            <div>
              <label style={{ ...lbl, fontWeight: 700 }}>{t("portal.evidence.title")}</label>
              <EvidenceDropzone files={files} onAdd={(fs) => setFiles((p) => [...p, ...fs])} onRemove={(i) => setFiles((p) => p.filter((_, j) => j !== i))} />
            </div>

            {/* 6 · Reincidencia: bloque clicable completo (no solo el checkbox). Sube prioridad (P1.5). */}
            <div style={{ borderRadius: "var(--r-xl, 14px)", border: `1px solid ${isRecurrence ? "var(--accent)" : "var(--line)"}`, background: isRecurrence ? "var(--accent-soft)" : "var(--paper)" }}>
              <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", padding: "13px 15px" }}>
                <input type="checkbox" checked={isRecurrence} onChange={(e) => { setIsRecurrence(e.target.checked); if (!e.target.checked) setRecurrenceOf(""); }} style={{ marginTop: 2, width: 18, height: 18, cursor: "pointer", accentColor: "var(--accent)" }} />
                <span style={{ fontSize: 13.5, color: "var(--text)", fontWeight: 600 }}>{t("portal.recurrence.label")}</span>
              </label>
              {isRecurrence && (
                <div style={{ padding: "0 15px 14px 43px" }}>
                  <label htmlFor="intake-prior" style={lbl}>{t("portal.recurrence.prior")}</label>
                  <select id="intake-prior" value={recurrenceOf} onChange={(e) => setRecurrenceOf(e.target.value)} style={{ ...field, height: 44 }}>
                    <option value="">{t("portal.recurrence.priornone")}</option>
                    {sortedCases.map((c) => <option key={c.id} value={c.id}>{c.incident_number} · {c.title}</option>)}
                  </select>
                </div>
              )}
            </div>

            {err && <div role="alert" style={{ fontSize: 12.5, color: "var(--st-critical-fg)" }}>{err.startsWith("ERR_") ? t(("err." + err) as MessageKey) : err}</div>}

            {/* 7 · Envio: un solo boton, 54px, con la garantia de "solo el asunto es obligatorio". */}
            <div style={{ borderTop: "1px solid var(--line-soft, var(--line))", paddingTop: 16, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
              <button onClick={register} disabled={registering || tooShort} className="cx-btn-primary" style={{ height: 54, borderRadius: 13, fontSize: 15 }}>
                {registering ? t("portal.create.submitting") : t("portal.register.case")}
              </button>
              <span style={{ fontSize: 12.5, color: "var(--muted)", flex: 1, minWidth: 200 }}>{t("portal.register.guarantee")}</span>
            </div>

            {/* P4.5 · "Reportado hoy por otras personas": sumarse en un clic (la via que mas duplicados evita). */}
            {trending.length > 0 && (
              <div style={{ borderTop: "1px solid var(--line-soft, var(--line))", paddingTop: 16 }}>
                <TrendingAggregators items={trending} busyId={joinBusyId} onJoin={(a) => joinCase(a.parentId)} />
              </div>
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

