"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import { AiReport } from "@/components/ai/ai-report";
import { portalAssist, type PortalAssistResult } from "@/lib/portal/assist";
import { createIncident } from "@/lib/incidents/actions";
import { recordKbEvent } from "@/lib/knowledge/actions";
import { FeedbackWidget } from "@/components/knowledge/feedback-widget";
import type { PortalCategory, PortalApp, MyCase } from "@/lib/portal/queries";
import type { Urgency } from "@/lib/incidents/priority";
import { statusKey, statusColors } from "@/lib/incidents/labels";
import { Icon } from "@/components/ui/icon";
import { SlaRing, StatusDonut, type StatusSlice } from "@/components/portal/hub-viz";

const URGENCIES: Urgency[] = ["critical", "high", "medium", "low"];
const MIN_CHARS = 8;
const SETTLED = ["resolved", "closed", "cancelled"];
const ATTENTION = ["waiting", "reopened"]; // esperan respuesta del usuario
// Orden canonico de estados para el donut/leyenda (espeja el enum incident.status).
const STATUS_ORDER = ["new", "triaged", "assigned", "in_progress", "waiting", "reopened", "in_evolution", "resolved", "closed", "cancelled"];

/** Urgencia de ordenamiento: abiertos SIEMPRE antes que resueltos; dentro de cada grupo,
 *  SLA mas proximo arriba y los sin-SLA al final del grupo. Magnitudes: due real ~1.7e12 ms;
 *  sentinel sin-SLA 1e14 (tras cualquier due real); bucket resuelto 1e16 (domina todo). */
const MISSING_DUE = 1e14;
const SETTLED_BUCKET = 1e16;
function sortKey(c: MyCase): number {
  const settled = SETTLED.includes(c.status) ? SETTLED_BUCKET : 0;
  const due = c.sla_resolution_due_at ? new Date(c.sla_resolution_due_at).getTime() : MISSING_DUE;
  return settled + due;
}

export function Portal({ categories, applications = [], canFeedback, canViewIncidents = false, myCases = [], userName = "" }: {
  categories: PortalCategory[]; applications?: PortalApp[]; canFeedback: boolean; canViewIncidents?: boolean; myCases?: MyCase[]; userName?: string;
}) {
  const { t, locale } = useI18n();
  const firstName = userName.trim().split(/[\s@.]+/)[0] || "";
  const openCount = myCases.filter((c) => !SETTLED.includes(c.status)).length;
  const resolvedCount = myCases.filter((c) => c.status === "resolved" || c.status === "closed").length;
  const attentionCount = myCases.filter((c) => ATTENTION.includes(c.status)).length;
  const sortedCases = [...myCases].sort((a, b) => sortKey(a) - sortKey(b));

  // Conteos por estado para el donut (solo estados presentes, en orden canonico).
  const counts = myCases.reduce<Record<string, number>>((m, c) => { m[c.status] = (m[c.status] ?? 0) + 1; return m; }, {});
  const slices: StatusSlice[] = STATUS_ORDER.filter((s) => counts[s]).map((s) => ({ status: s, count: counts[s] }));

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

  const tooShort = subject.trim().length < MIN_CHARS;

  function pickCategory(id: string) {
    setCategoryId(id);
    setAutoCat(false);
    // Lleva el foco al intake para continuar el flujo sin friccion.
    const el = subjectRef.current;
    if (el) { el.focus(); el.scrollIntoView({ behavior: "smooth", block: "center" }); }
  }

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
  const cardBox: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)" };
  const sectionTitle: React.CSSProperties = { fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "var(--fs-4)", color: "var(--text)" };
  const apps = applications;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-5)", maxWidth: "var(--w-app)" }}>
      {/* Hero de bienvenida */}
      <div style={{ position: "relative", overflow: "hidden", background: "linear-gradient(125deg, var(--accent-soft), transparent 62%)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: "22px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 15 }}>
          <div style={{ width: 46, height: 46, borderRadius: 12, background: "var(--accent)", color: "#fff", display: "grid", placeItems: "center", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 19, flexShrink: 0 }}>{(firstName[0] ?? "U").toUpperCase()}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.7px", color: "var(--accent-2)", marginBottom: 3 }}>{t("portal.hero.tag")}</div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "var(--fs-6)", color: "var(--text)", lineHeight: "var(--lh-tight)" }}>
              {t("portal.welcome")}{firstName ? `, ${firstName}` : ""}
            </div>
            <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 3 }}>
              {openCount > 0 ? t("portal.welcome.open").replace("{n}", String(openCount)) : t("portal.welcome.sub")}
            </div>
          </div>
        </div>
      </div>

      {created && (
        <div style={{ fontSize: 13, fontWeight: 600, padding: "11px 14px", borderRadius: "var(--r-md)", background: "var(--st-low-bg)", color: "var(--st-low-fg)", display: "flex", alignItems: "center", gap: 8 }}>
          <Icon name="check" size={15} /> {t("portal.created")} <span style={{ fontFamily: "var(--font-mono)" }}>{created}</span>
        </div>
      )}

      {/* Tu resumen: el estado del hilo en < 3s (donut + stat tiles). Sustituye contadores planos. */}
      {myCases.length > 0 && (
        <div style={{ ...cardBox, padding: "var(--sp-5)", display: "flex", gap: "var(--sp-6)", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
            <span style={sectionTitle}>{t("portal.donut.title")}</span>
            <StatusDonut slices={slices} total={myCases.length} labelOf={(s) => t(statusKey(s))} />
          </div>
          <div style={{ display: "flex", gap: "var(--sp-3)", flexWrap: "wrap" }}>
            <StatTile label={t("portal.summary.inprogress")} value={openCount} />
            <StatTile label={t("portal.summary.resolved")} value={resolvedCount} tone={resolvedCount > 0 ? "var(--st-low-fg)" : undefined} />
            <StatTile label={t("portal.summary.attention")} value={attentionCount} tone={attentionCount > 0 ? "var(--st-high-fg)" : undefined} icon={attentionCount > 0 ? "alert" : undefined} />
          </div>
        </div>
      )}

      {/* Explorar por categoria: seleccion rapida que alimenta el intake */}
      {categories.length > 0 && (
        <div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
            <span style={sectionTitle}>{t("portal.browse.title")}</span>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>{t("portal.browse.hint")}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(158px, 1fr))", gap: 10 }}>
            {categories.map((c) => {
              const sel = categoryId === c.id;
              return (
                <button key={c.id} type="button" onClick={() => pickCategory(c.id)} className="cx-lift"
                  style={{ display: "flex", alignItems: "center", gap: 10, textAlign: "left", padding: "11px 12px", borderRadius: "var(--r-lg)", cursor: "pointer",
                    background: sel ? "var(--accent-soft)" : "var(--card)", border: sel ? "1px solid var(--accent)" : "1px solid var(--line)" }}>
                  <span style={{ width: 32, height: 32, flexShrink: 0, borderRadius: 9, display: "grid", placeItems: "center", background: "var(--accent-soft)", color: "var(--accent-2)", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14 }}>{c.name.trim()[0]?.toUpperCase() ?? "?"}</span>
                  <span style={{ display: "flex", flexDirection: "column", minWidth: 0, gap: 1 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
                    <span style={{ fontSize: 9.5, fontFamily: "var(--font-mono)", color: sel ? "var(--accent-2)" : "var(--muted)" }}>{sel ? t("portal.cat.picked") : c.code}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Dos columnas: intake (izq) + sugerencias (der) */}
      <div style={{ display: "grid", gridTemplateColumns: "1.05fr 0.95fr", gap: 18, alignItems: "start" }}>
        {/* Intake estructurado */}
        <div style={{ ...cardBox, padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={sectionTitle}>{t("portal.intake.title")}</div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: -8 }}>{t("portal.intro")}</div>

          <div>
            <label style={lbl}>{t("portal.field.subject")}</label>
            <textarea ref={subjectRef} value={subject} onChange={(e) => setSubject(e.target.value)} onBlur={() => setTouched(true)} rows={3}
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

          {!res && <div style={{ background: "var(--paper)", border: "1px dashed var(--line)", borderRadius: "var(--r-xl)", padding: 26, textAlign: "center", fontSize: 12.5, color: "var(--muted)" }}>{t("portal.suggest.empty")}</div>}

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

      {/* Mis casos: tracking permanente del usuario, con anillo SLA vivo */}
      <div style={{ ...cardBox, padding: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <span style={sectionTitle}>{t("portal.mycases")}</span>
          {myCases.length > 0 && <span style={{ fontSize: 11, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--accent-2)", background: "var(--accent-soft)", padding: "1px 8px", borderRadius: "var(--r-pill)" }}>{myCases.length}</span>}
        </div>
        {myCases.length === 0 ? (
          <div style={{ fontSize: 12.5, color: "var(--muted)", padding: "8px 2px" }}>{t("portal.mycases.empty")}</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {sortedCases.map((c) => {
              const sc = statusColors(c.status);
              const row = (
                <div className="cx-lift" style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 12px", background: "var(--paper)", borderRadius: "var(--r-md)" }}>
                  <SlaRing openedAt={c.opened_at} dueAt={c.sla_resolution_due_at} resolvedAt={c.resolved_at} status={c.status} size={38} />
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent-2)" }}>{c.incident_number}</span>
                  <span style={{ flex: 1, fontSize: 12.5, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.title}</span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10.5, fontWeight: 600, color: sc.fg, background: sc.bg, padding: "2px 9px", borderRadius: "var(--r-pill)" }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: sc.fg }} />{t(statusKey(c.status))}
                  </span>
                  <span style={{ fontSize: 10.5, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>{new Date(c.opened_at).toLocaleDateString(locale)}</span>
                </div>
              );
              // El usuario final abre SU detalle propio (P2, /portal/cases); el agente, la vista de incidente.
              return canViewIncidents
                ? <Link key={c.id} href={`/incidents/${c.id}`} style={{ textDecoration: "none" }}>{row}</Link>
                : <Link key={c.id} href={`/portal/cases/${c.id}`} style={{ textDecoration: "none" }}>{row}</Link>;
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function StatTile({ label, value, tone, icon }: { label: string; value: number; tone?: string; icon?: string }) {
  return (
    <div style={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: "var(--r-lg)", padding: "12px 16px", minWidth: 108 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 600, color: "var(--muted)", marginBottom: 8 }}>
        {icon && <Icon name={icon} size={12} color={tone ?? "var(--muted)"} />}{label}
      </div>
      <div style={{ fontFamily: "var(--font-mono)", fontWeight: 500, fontSize: "var(--fs-hero)", letterSpacing: "-1px", color: tone ?? "var(--text)" }}>{value}</div>
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
