"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n, useErrorMessage } from "@/lib/i18n/provider";
import { useNavHistory } from "@/components/app-shell/nav-history-provider";
import type { FormOptions } from "@/lib/incidents/queries";
import { createIncident, updateIncident, checkSimilarCases, searchResolvedSimilar, findSimilarSemantic, type IncidentInput } from "@/lib/incidents/actions";
import { refineSimilarAtIntake, type RefinedSimilar } from "@/lib/ai/analysis";
import type { SimilarCaseHit } from "@/lib/incidents/similar";
import type { SemanticHit } from "@/lib/ai/embeddings";
import type { SearchResult } from "@/lib/portal/queries";
import { derivePriority, type Impact, type Urgency } from "@/lib/incidents/priority";
import { statusKey, statusColors } from "@/lib/incidents/labels";
import { minLength, required } from "@/lib/validation";
import { PriorityTag } from "./badges";

const LEVELS: (Impact | Urgency)[] = ["critical", "high", "medium", "low"];

type Props = {
  options: FormOptions;
  mode: "create" | "edit";
  incidentId?: string;
  initial?: Partial<IncidentInput>;
};

export function IncidentForm({ options, mode, incidentId, initial }: Props) {
  const { t } = useI18n();
  const errMsg = useErrorMessage();
  const router = useRouter();
  const { back } = useNavHistory();
  const goBack = () => back(mode === "edit" && incidentId ? `/incidents/${incidentId}` : "/incidents");

  const [f, setF] = useState<IncidentInput>({
    title: initial?.title ?? "",
    description: initial?.description ?? "",
    categoryId: initial?.categoryId ?? "",
    affectedCiId: initial?.affectedCiId ?? "",
    affectedServiceId: initial?.affectedServiceId ?? "",
    affectedProductId: initial?.affectedProductId ?? "",
    affectedChannelId: initial?.affectedChannelId ?? "",
    affectedBusinessUnitId: initial?.affectedBusinessUnitId ?? "",
    impact: initial?.impact ?? "medium",
    urgency: initial?.urgency ?? "medium",
    financialImpactEstimate: initial?.financialImpactEstimate ?? 0,
    caseType: initial?.caseType ?? "Incident",
    amount: initial?.amount ?? null,
    currency: initial?.currency ?? "CRC",
    transactionReference: initial?.transactionReference ?? "",
    customerName: initial?.customerName ?? "",
    sensitiveFlag: initial?.sensitiveFlag ?? false,
    piiFlag: initial?.piiFlag ?? false,
  });
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [formErr, setFormErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [similar, setSimilar] = useState<SimilarCaseHit[]>([]);
  const [resolved, setResolved] = useState<SearchResult | null>(null);
  const [searchingKb, setSearchingKb] = useState(false);
  const [semantic, setSemantic] = useState<SemanticHit[] | null>(null);
  const [semBusy, setSemBusy] = useState(false);

  // Busqueda por significado (semantica, gte-small). A demanda; tercera senal ademas del lexico.
  async function searchSemantic() {
    if (f.title.trim().length < 5) return;
    setSemBusy(true);
    const r = await findSimilarSemantic({ title: f.title.trim(), description: f.description });
    setSemBusy(false);
    if (r.ok && r.items) setSemantic(r.items);
  }
  const [aiVerdicts, setAiVerdicts] = useState<Record<string, RefinedSimilar>>({});
  const [aiBusy, setAiBusy] = useState(false);
  const [aiOff, setAiOff] = useState(false);

  // Refuerzo IA sobre los candidatos lexicos ambiguos (a demanda; la IA sugiere, el humano decide).
  async function analyzeAi() {
    if (similar.length === 0) return;
    setAiBusy(true);
    setAiOff(false);
    const r = await refineSimilarAtIntake({ title: f.title.trim(), description: f.description }, similar.map((s) => s.id));
    setAiBusy(false);
    if (r.ok && r.items) {
      setAiVerdicts(Object.fromEntries(r.items.map((i) => [i.id, i])));
    } else if (r.error === "ai_not_configured") {
      setAiOff(true);
    }
  }

  const set = (k: keyof IncidentInput, v: string | number | boolean | null) => setF((s) => ({ ...s, [k]: v }));

  // Busqueda a demanda de conocimiento reutilizable (resueltos + KB). A diferencia del panel de
  // duplicados (automatico), esta la dispara el agente con un boton. Sugiere sin bloquear (§11).
  async function searchKb() {
    const q = `${f.title} ${f.description}`.trim();
    if (f.title.trim().length < 5) return;
    setSearchingKb(true);
    const r = await searchResolvedSimilar(q);
    setSearchingKb(false);
    if (r.ok && r.result) setResolved(r.result);
  }

  // Deteccion de duplicados en vivo (solo alta): consulta casos abiertos similares con debounce.
  // Sugiere sin bloquear el registro (§11). No corre en edicion.
  useEffect(() => {
    if (mode !== "create") return;
    const title = f.title.trim();
    if (title.length < 5) { setSimilar([]); return; }
    const handle = setTimeout(async () => {
      const r = await checkSimilarCases({ title, description: f.description, categoryId: f.categoryId || undefined, affectedCiId: f.affectedCiId || undefined });
      if (r.ok && r.items) { setSimilar(r.items); setAiVerdicts({}); setAiOff(false); }
    }, 500);
    return () => clearTimeout(handle);
  }, [mode, f.title, f.description, f.categoryId, f.affectedCiId]);

  function validate(): boolean {
    const e: Record<string, string | null> = {
      title: minLength(f.title, 5),
      description: minLength(f.description, 10),
      categoryId: required(f.categoryId),
    };
    setErrors(e);
    return !Object.values(e).some(Boolean);
  }

  async function onSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setFormErr(null);
    if (!validate()) return;
    setBusy(true);
    const res =
      mode === "create"
        ? await createIncident(f)
        : await updateIncident(incidentId as string, f);
    setBusy(false);
    if (!res.ok) {
      setFormErr(errMsg(res.error ?? "ERR_REQUIRED_FIELD"));
      return;
    }
    router.push(`/incidents/${res.id}`);
    router.refresh();
  }

  const priority = derivePriority(f.impact, f.urgency);

  return (
    <form onSubmit={onSubmit} noValidate style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 720 }}>
      <Card title={t("inc.section.classification")}>
        <Field label={t("inc.field.title")} error={errMsg(errors.title ?? null)}>
          <input style={inputStyle(!!errors.title)} value={f.title} onChange={(e) => set("title", e.target.value)} />
        </Field>
        <Field label={t("inc.field.description")} error={errMsg(errors.description ?? null)}>
          <textarea style={{ ...inputStyle(!!errors.description), minHeight: 90, resize: "vertical" }} value={f.description} onChange={(e) => set("description", e.target.value)} />
        </Field>
        <Field label={t("inc.field.category")} error={errMsg(errors.categoryId ?? null)}>
          <select style={inputStyle(!!errors.categoryId)} value={f.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
            <option value="">{t("inc.field.none")}</option>
            {options.categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </Field>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 12, alignItems: "end" }}>
          <Field label={t("inc.field.impact")}>
            <select style={inputStyle(false)} value={f.impact} onChange={(e) => set("impact", e.target.value)}>
              {LEVELS.map((l) => <option key={l} value={l}>{t(("lvl." + l) as never)}</option>)}
            </select>
          </Field>
          <Field label={t("inc.field.urgency")}>
            <select style={inputStyle(false)} value={f.urgency} onChange={(e) => set("urgency", e.target.value)}>
              {LEVELS.map((l) => <option key={l} value={l}>{t(("lvl." + l) as never)}</option>)}
            </select>
          </Field>
          <div style={{ paddingBottom: 10 }}>
            <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 6 }}>{t("inc.priority.computed")}</div>
            <PriorityTag priority={priority} />
          </div>
        </div>
      </Card>

      {mode === "create" && similar.length > 0 && (
        <div role="status" style={{ background: "var(--st-medium-bg)", border: "1px solid var(--st-medium)", borderRadius: "var(--r-xl)", padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, color: "var(--st-medium-fg)" }}>{t("similar.title")}</span>
            <span style={{ fontSize: 11, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--st-medium-fg)", background: "var(--card)", padding: "1px 8px", borderRadius: "var(--r-pill)" }}>{similar.length}</span>
            <button type="button" onClick={analyzeAi} disabled={aiBusy} style={{ ...aiBtn, opacity: aiBusy ? 0.6 : 1, marginLeft: "auto" }}>
              {aiBusy ? t("similar.ai.analyzing") : t("similar.ai.btn")}
            </button>
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>{t("similar.hint")}</div>
          {aiOff && <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 10 }}>{t("similar.ai.off")}</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {similar.map((s) => {
              const sc = statusColors(s.status);
              const v = aiVerdicts[s.id];
              return (
                <Link key={s.id} href={`/incidents/${s.id}`} className="cx-lift" title={v?.reason ?? undefined} style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-md)" }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent-2)" }}>{s.incident_number}</span>
                  <span style={{ flex: 1, fontSize: 12.5, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</span>
                  {v && (
                    <span title={v.reason} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10, fontWeight: 700, padding: "2px 9px", borderRadius: "var(--r-pill)", cursor: "help",
                      color: v.isDuplicate ? "var(--st-critical-fg)" : "var(--st-low-fg)",
                      background: v.isDuplicate ? "var(--st-critical-bg)" : "var(--st-low-bg)" }}>
                      {v.isDuplicate ? t("similar.ai.dup") : t("similar.ai.nodup")} · {v.confidence}%
                    </span>
                  )}
                  {!v && s.sameCategory && <span style={badgeStyle}>{t("similar.samecat")}</span>}
                  {!v && s.sameCi && <span style={badgeStyle}>{t("similar.sameapp")}</span>}
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10.5, fontWeight: 600, color: sc.fg, background: sc.bg, padding: "2px 9px", borderRadius: "var(--r-pill)" }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: sc.fg }} />{t(statusKey(s.status))}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "var(--accent-2)" }}>{t("similar.view")}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {mode === "create" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <button type="button" onClick={searchKb} disabled={searchingKb || f.title.trim().length < 5} style={{ ...secondaryBtn, opacity: searchingKb || f.title.trim().length < 5 ? 0.6 : 1 }}>
              {searchingKb ? t("portal.search.searching") : t("similar.resolved.btn")}
            </button>
            <button type="button" onClick={searchSemantic} disabled={semBusy || f.title.trim().length < 5} style={{ ...secondaryBtn, opacity: semBusy || f.title.trim().length < 5 ? 0.6 : 1 }}>
              {semBusy ? t("portal.search.searching") : t("similar.sem.btn")}
            </button>
            <span style={{ fontSize: 11.5, color: "var(--muted)" }}>{t("similar.resolved.caption")}</span>
          </div>

          {semantic && (
            <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={panelHeader}>{t("similar.sem.title")}</div>
              {semantic.length === 0 && <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("similar.sem.none")}</div>}
              {semantic.map((s) => {
                const sc = statusColors(s.status);
                return (
                  <Link key={s.incident_id} href={`/incidents/${s.incident_id}`} className="cx-lift" style={rowLink}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent-2)" }}>{s.incident_number}</span>
                    <span style={{ flex: 1, fontSize: 12.5, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--muted)" }}>{Math.round(s.similarity * 100)}%</span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10, fontWeight: 600, color: sc.fg, background: sc.bg, padding: "2px 8px", borderRadius: "var(--r-pill)" }}>
                      <span style={{ width: 5, height: 5, borderRadius: "50%", background: sc.fg }} />{t(statusKey(s.status))}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
          {resolved && (
            <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
              {resolved.articles.length === 0 && resolved.cases.length === 0 && (
                <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("similar.resolved.none")}</div>
              )}
              {resolved.articles.length > 0 && <div style={panelHeader}>{t("portal.kb.title")}</div>}
              {resolved.articles.map((a) => (
                <Link key={a.id} href={`/knowledge/${a.id}`} className="cx-lift" style={rowLink}>
                  <span style={badgeStyle}>{t("portal.kb.badge")}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--muted)" }}>{a.article_number}</span>
                  <span style={{ flex: 1, fontSize: 12.5, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.title}</span>
                </Link>
              ))}
              {resolved.cases.length > 0 && <div style={panelHeader}>{t("portal.cases.title")}</div>}
              {resolved.cases.map((c) => (
                <Link key={c.id} href={`/incidents/${c.id}`} className="cx-lift" style={rowLink}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent-2)" }}>{c.incident_number}</span>
                  <span style={{ flex: 1, fontSize: 12.5, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.title}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      <Card title={t("inc.section.affected")}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label={t("inc.field.app")}>
            <Select value={f.affectedCiId} onChange={(v) => set("affectedCiId", v)} items={options.apps} placeholder={t("inc.field.none")} />
          </Field>
          <Field label={t("inc.field.service")}>
            <Select value={f.affectedServiceId} onChange={(v) => set("affectedServiceId", v)} items={options.services} placeholder={t("inc.field.none")} />
          </Field>
          <Field label={t("inc.field.product")}>
            <Select value={f.affectedProductId} onChange={(v) => set("affectedProductId", v)} items={options.products} placeholder={t("inc.field.none")} />
          </Field>
          <Field label={t("inc.field.channel")}>
            <Select value={f.affectedChannelId} onChange={(v) => set("affectedChannelId", v)} items={options.channels} placeholder={t("inc.field.none")} />
          </Field>
          <Field label={t("inc.field.bu")}>
            <Select value={f.affectedBusinessUnitId} onChange={(v) => set("affectedBusinessUnitId", v)} items={options.businessUnits} placeholder={t("inc.field.none")} />
          </Field>
          <Field label={t("inc.field.financial")}>
            <input type="number" min={0} step="0.01" style={{ ...inputStyle(false), fontFamily: "var(--font-mono)" }}
              value={f.financialImpactEstimate} onChange={(e) => set("financialImpactEstimate", Number(e.target.value))} />
          </Field>
        </div>
      </Card>

      <Card title={t("inc.section.fintech")}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label={t("inc.f.casetype")}>
            <select style={inputStyle(false)} value={f.caseType} onChange={(e) => set("caseType", e.target.value)}>
              {options.caseTypes.map((ct) => <option key={ct.code} value={ct.code}>{ct.name}</option>)}
            </select>
          </Field>
          <Field label={t("inc.f.customer")}>
            <input style={inputStyle(false)} value={f.customerName} onChange={(e) => set("customerName", e.target.value)} />
          </Field>
          <Field label={t("inc.f.amount")}>
            <input type="number" min={0} step="0.01" style={{ ...inputStyle(false), fontFamily: "var(--font-mono)" }}
              value={f.amount ?? ""} onChange={(e) => set("amount", e.target.value === "" ? null : Number(e.target.value))} />
          </Field>
          <Field label={t("inc.f.currency")}>
            <select style={inputStyle(false)} value={f.currency} onChange={(e) => set("currency", e.target.value)}>
              <option value="CRC">CRC</option><option value="USD">USD</option>
            </select>
          </Field>
          <Field label={t("inc.f.txn")}>
            <input style={{ ...inputStyle(false), fontFamily: "var(--font-mono)" }} value={f.transactionReference} onChange={(e) => set("transactionReference", e.target.value)} />
          </Field>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, justifyContent: "center", paddingTop: 20 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text)", cursor: "pointer" }}>
              <input type="checkbox" checked={!!f.sensitiveFlag} onChange={(e) => set("sensitiveFlag", e.target.checked)} /> {t("inc.f.sensitive")}
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text)", cursor: "pointer" }}>
              <input type="checkbox" checked={!!f.piiFlag} onChange={(e) => set("piiFlag", e.target.checked)} /> {t("inc.f.pii")}
            </label>
          </div>
        </div>
      </Card>

      {formErr && (
        <div role="alert" style={{ background: "var(--st-critical-bg)", border: "1px solid var(--st-critical)", color: "var(--st-critical-fg)", borderRadius: "var(--r-lg)", padding: "10px 12px", fontSize: 12.5 }}>
          {formErr}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 9 }}>
        <button type="button" onClick={goBack} style={secondaryBtn}>{t("common.cancel")}</button>
        <button type="submit" disabled={busy} style={{ ...primaryBtn, opacity: busy ? 0.7 : 1 }}>
          {busy ? t("inc.creating") : mode === "create" ? t("inc.create") : t("common.save")}
        </button>
      </div>
    </form>
  );
}

function Select({ value, onChange, items, placeholder }: { value?: string; onChange: (v: string) => void; items: { id: string; name: string }[]; placeholder: string }) {
  return (
    <select style={inputStyle(false)} value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
    </select>
  );
}

function Field({ label, error, children }: { label: string; error?: string | null; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6, color: "var(--text)" }}>{label}</label>
      {children}
      {error && <p style={{ color: "var(--st-critical-fg)", fontSize: 11, marginTop: 6 }}>{error}</p>}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 20 }}>
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, marginBottom: 16, color: "var(--text)" }}>{title}</div>
      {children}
    </div>
  );
}

function inputStyle(err: boolean): React.CSSProperties {
  return {
    width: "100%",
    minHeight: 40,
    padding: "9px 12px",
    borderRadius: "var(--r-md)",
    border: `1px solid ${err ? "var(--st-critical)" : "var(--line)"}`,
    background: "var(--card)",
    color: "var(--text)",
    fontSize: 13,
    fontFamily: "var(--font-ui)",
  };
}

const badgeStyle: React.CSSProperties = { fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.4px", color: "var(--accent-2)", background: "var(--accent-soft)", padding: "2px 7px", borderRadius: "var(--r-pill)", whiteSpace: "nowrap" };
const aiBtn: React.CSSProperties = { padding: "5px 12px", borderRadius: "var(--r-md)", background: "var(--card)", color: "var(--accent-2)", border: "1px solid var(--accent-2)", fontWeight: 700, fontSize: 11.5, cursor: "pointer" };
const panelHeader: React.CSSProperties = { fontSize: 11.5, fontWeight: 700, color: "var(--text)", marginTop: 2 };
const rowLink: React.CSSProperties = { textDecoration: "none", display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", background: "var(--paper)", border: "1px solid var(--line)", borderRadius: "var(--r-md)" };
const primaryBtn: React.CSSProperties = { minHeight: 40, padding: "0 18px", borderRadius: "var(--r-md)", background: "var(--accent)", color: "var(--on-accent)", border: "none", fontWeight: 700, fontSize: 13, cursor: "pointer" };
const secondaryBtn: React.CSSProperties = { minHeight: 40, padding: "0 16px", borderRadius: "var(--r-md)", background: "var(--card)", color: "var(--text)", border: "1px solid var(--line)", fontWeight: 600, fontSize: 13, cursor: "pointer" };
