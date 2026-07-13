"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/provider";
import type { IncidentRow, CaseTypeMeta } from "@/lib/incidents/queries";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import { priorityKey, statusKey } from "@/lib/incidents/labels";
import { StatusPill, PriorityTag, ScoreBadge, SlaBadge } from "./badges";
import { useGrouping, GroupBar, EmptyState, type GroupDef } from "@/components/common/filters";
import { Icon } from "@/components/ui/icon";

const STATUS_FILTERS = ["all", "new", "triaged", "in_progress", "in_evolution", "resolved"];
const DOMAIN_FILTERS = ["all", "business", "technology", "service"];
const PRIORITY_ORDER = ["p1_critical", "p2_high", "p3_medium", "p4_low"];
const OPEN_STATES = ["new", "triaged", "assigned", "in_progress", "waiting", "reopened", "in_evolution"];
const SETTLED_STATES = ["resolved", "closed", "cancelled"];

/** SLA vencido: con fecha de vencimiento pasada, aun sin resolver y en estado abierto. */
function slaBreached(r: IncidentRow, now: number): boolean {
  return !!r.sla_resolution_due_at && !r.resolved_at && !SETTLED_STATES.includes(r.status)
    && new Date(r.sla_resolution_due_at).getTime() < now;
}

// Vistas guardadas (presets semanticos del work-queue). Predicado puro sobre la fila.
type ViewDef = { key: string; label: MessageKey; icon: string; needsMember?: boolean; pred: (r: IncidentRow, myMemberId: string | null, now: number) => boolean };
const SAVED_VIEWS: ViewDef[] = [
  { key: "all", label: "inc.view.all", icon: "inbox", pred: () => true },
  { key: "mine", label: "inc.view.mine", icon: "user", needsMember: true, pred: (r, m) => !!m && r.assigned_member_id === m },
  { key: "unassigned", label: "inc.view.unassigned", icon: "users", pred: (r) => !r.assignee && OPEN_STATES.includes(r.status) },
  { key: "sla", label: "inc.view.sla", icon: "alert", pred: (r, _m, now) => slaBreached(r, now) },
  { key: "candidates", label: "inc.view.candidates", icon: "zap", pred: (r) => r.transformation_candidate },
];
const domainColor: Record<string, string> = { business: "var(--accent-2)", technology: "var(--st-info)", service: "var(--teal)" };

export function IncidentTable({ rows, caseTypes = {}, myMemberId = null, defaultView = "all", onSelect, selectedId }: { rows: IncidentRow[]; caseTypes?: CaseTypeMeta; myMemberId?: string | null; defaultView?: string; onSelect?: (r: IncidentRow) => void; selectedId?: string | null }) {
  const { t } = useI18n();
  const router = useRouter();
  const [view, setView] = useState(defaultView);
  const [filter, setFilter] = useState("all");
  const [domain, setDomain] = useState("all");
  const [bu, setBu] = useState("");
  const [app, setApp] = useState("");
  const [prio, setPrio] = useState("");
  const [resp, setResp] = useState("");

  const domainOf = (r: IncidentRow) => caseTypes[r.case_type]?.domain ?? "business";
  const now = useMemo(() => Date.now(), [rows]);
  const views = useMemo(() => SAVED_VIEWS.filter((v) => !v.needsMember || myMemberId), [myMemberId]);
  const viewPred = (views.find((v) => v.key === view) ?? SAVED_VIEWS[0]).pred;

  // Opciones de filtro derivadas de los datos reales (cero hardcode).
  const buOptions = useMemo(() => distinct(rows.map((r) => r.business_unit?.name)), [rows]);
  const appOptions = useMemo(() => distinct(rows.map((r) => r.ci?.name)), [rows]);
  const respOptions = useMemo(() => distinct(rows.map((r) => r.assignee?.name)), [rows]);
  const prioOptions = useMemo(() => PRIORITY_ORDER.filter((p) => rows.some((r) => r.priority === p)), [rows]);

  const filtered = useMemo(
    () => rows.filter((r) =>
      viewPred(r, myMemberId, now) &&
      (filter === "all" || r.status === filter) &&
      (domain === "all" || domainOf(r) === domain) &&
      (!bu || r.business_unit?.name === bu) &&
      (!app || r.ci?.name === app) &&
      (!resp || r.assignee?.name === resp) &&
      (!prio || r.priority === prio)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, view, filter, domain, bu, app, prio, resp, myMemberId, now],
  );

  // Agrupacion por campo de maestro (estado, responsable, aplicacion, unidad, prioridad).
  const groupDefs: GroupDef<IncidentRow>[] = [
    { key: "gstatus", label: t("inc.col.status"), get: (r) => r.status, render: (v) => t(statusKey(v)) },
    { key: "gprio", label: t("inc.col.priority"), get: (r) => r.priority, render: (v) => t(priorityKey(v)) },
    { key: "gresp", label: t("flt.responsible"), get: (r) => r.assignee?.name },
    { key: "gapp", label: t("inc.field.app"), get: (r) => r.ci?.name },
    { key: "gbu", label: t("inc.field.bu"), get: (r) => r.business_unit?.name },
  ];
  const g = useGrouping(filtered, groupDefs);

  function Line(r: IncidentRow) {
    const sel = selectedId === r.id;
    return (
      <div key={r.id} onClick={() => (onSelect ? onSelect(r) : router.push(`/incidents/${r.id}`))}
        style={{ ...gridStyle(false), cursor: "pointer", background: sel ? "var(--row-hover)" : "transparent" }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--row-hover)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = sel ? "var(--row-hover)" : "transparent")}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--accent-2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.incident_number}</div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.title}</div>
          <div style={{ fontSize: 11, color: "var(--muted)", display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 9.5, padding: "1px 7px", borderRadius: "var(--r-pill)", background: "var(--paper)", color: "var(--text)", fontWeight: 600, whiteSpace: "nowrap", flexShrink: 0 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: domainColor[domainOf(r)] ?? "var(--muted)" }} />
              {caseTypes[r.case_type]?.name ?? r.case_type}
            </span>
            {r.business_unit?.name
              ? <Drill onClick={() => setBu(r.business_unit!.name)}>{r.business_unit.name}</Drill>
              : <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.category?.name ?? "—"}</span>}
          </div>
        </div>
        <div style={{ minWidth: 0 }}>
          {r.ci?.name
            ? <Drill onClick={() => setApp(r.ci!.name)}>{r.ci.name}</Drill>
            : <span style={{ fontSize: 12.5, color: "var(--muted)" }}>—</span>}
        </div>
        <div style={{ minWidth: 0 }}>
          <span onClick={(e) => { e.stopPropagation(); setPrio(r.priority); }} style={{ cursor: "pointer" }} title={t("inc.filter.drill")}>
            <PriorityTag priority={r.priority} />
          </span>
        </div>
        <div style={{ minWidth: 0 }}><SlaBadge dueAt={r.sla_resolution_due_at} resolvedAt={r.resolved_at} status={r.status} /></div>
        <div style={{ textAlign: "right" }}><ScoreBadge score={r.transformation_score} /></div>
        <div style={{ minWidth: 0 }}><StatusPill status={r.status} /></div>
      </div>
    );
  }

  const chips = [
    bu && { label: t("inc.field.bu"), value: bu, clear: () => setBu("") },
    app && { label: t("inc.field.app"), value: app, clear: () => setApp("") },
    resp && { label: t("flt.responsible"), value: resp, clear: () => setResp("") },
    prio && { label: t("inc.col.priority"), value: t(priorityKey(prio)), clear: () => setPrio("") },
    domain !== "all" && { label: t("inc.domain"), value: t(("dom." + domain) as MessageKey), clear: () => setDomain("all") },
    filter !== "all" && { label: t("inc.col.status"), value: t(("st." + filter) as MessageKey), clear: () => setFilter("all") },
  ].filter(Boolean) as { label: string; value: string; clear: () => void }[];

  function clearAll() { setFilter("all"); setDomain("all"); setBu(""); setApp(""); setPrio(""); setResp(""); }

  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", overflow: "hidden" }}>
      {/* Vistas guardadas (work-queue): presets semanticos */}
      <div style={{ display: "flex", gap: 8, padding: "12px 20px", borderBottom: "1px solid var(--line)", flexWrap: "wrap", alignItems: "center" }}>
        {views.map((v) => {
          const active = view === v.key;
          const count = rows.filter((r) => v.pred(r, myMemberId, now)).length;
          return (
            <button key={v.key} onClick={() => setView(v.key)}
              style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 13px", borderRadius: "var(--r-pill)", cursor: "pointer",
                border: active ? "1px solid var(--accent)" : "1px solid var(--line)",
                background: active ? "var(--accent-soft)" : "var(--card)", color: active ? "var(--accent-2)" : "var(--muted)", fontSize: 12.5, fontWeight: 600 }}>
              <Icon name={v.icon} size={14} color={active ? "var(--accent-2)" : "var(--muted)"} />
              {t(v.label)}
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, opacity: 0.7 }}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Filtro por dominio: Negocio vs TI vs Servicio */}
      <div style={{ display: "flex", gap: 8, padding: "12px 20px", borderBottom: "1px solid var(--line-soft)", flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 700 }}>{t("inc.domain")}</span>
        {DOMAIN_FILTERS.map((d) => {
          const active = domain === d;
          const count = d === "all" ? rows.length : rows.filter((r) => domainOf(r) === d).length;
          return (
            <button key={d} onClick={() => setDomain(d)}
              style={{ padding: "5px 12px", borderRadius: "var(--r-pill)", border: active ? "none" : "1px solid var(--line)",
                background: active ? (d === "all" ? "var(--cta-bg)" : domainColor[d]) : "var(--card)",
                color: active ? "#fff" : "var(--muted)", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "inline-flex", gap: 6 }}>
              {t(("dom." + d) as MessageKey)}<span style={{ fontFamily: "var(--font-mono)", opacity: 0.7 }}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Filtros por estado */}
      <div style={{ display: "flex", gap: 8, padding: "14px 20px 10px", flexWrap: "wrap" }}>
        {STATUS_FILTERS.map((f) => {
          const active = filter === f;
          const count = f === "all" ? rows.length : rows.filter((r) => r.status === f).length;
          return (
            <button key={f} onClick={() => setFilter(f)}
              style={{ padding: "5px 12px", borderRadius: "var(--r-pill)", border: active ? "none" : "1px solid var(--line)",
                background: active ? "var(--cta-bg)" : "var(--card)", color: active ? "var(--cta-fg)" : "var(--muted)",
                fontSize: 12, fontWeight: 600, cursor: "pointer", display: "inline-flex", gap: 6 }}>
              {f === "all" ? t("nav.incidents") : t(("st." + f) as MessageKey)}
              <span style={{ fontFamily: "var(--font-mono)", opacity: 0.6 }}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Filtros por campo (dropdowns) */}
      <div style={{ display: "flex", gap: 10, padding: "0 20px 12px", flexWrap: "wrap", alignItems: "center" }}>
        <FieldSelect label={t("inc.field.bu")} value={bu} onChange={setBu} options={buOptions} allLabel={t("inc.filter.allbu")} />
        <FieldSelect label={t("inc.field.app")} value={app} onChange={setApp} options={appOptions} allLabel={t("inc.filter.allapp")} />
        <FieldSelect label={t("flt.responsible")} value={resp} onChange={setResp} options={respOptions} allLabel={t("flt.allresp")} />
        <FieldSelect label={t("inc.col.priority")} value={prio} onChange={setPrio}
          options={prioOptions} allLabel={t("inc.filter.allprio")} render={(p) => t(priorityKey(p))} />
        <GroupBar defs={groupDefs} groupKey={g.groupKey} setGroupKey={g.setGroupKey} label={t("flt.groupby")} allLabel={t("flt.nogroup")} />
      </div>

      {/* Chips de filtro activo (× para volver / quitar el filtro) */}
      {chips.length > 0 && (
        <div style={{ display: "flex", gap: 8, padding: "0 20px 14px", flexWrap: "wrap", alignItems: "center" }}>
          {chips.map((c, i) => (
            <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, padding: "4px 6px 4px 11px", borderRadius: "var(--r-pill)", background: "var(--accent-soft)", color: "var(--accent-2)", fontWeight: 600 }}>
              <span style={{ opacity: 0.7 }}>{c.label}:</span> {c.value}
              <button onClick={c.clear} aria-label="quitar filtro"
                style={{ display: "inline-flex", width: 16, height: 16, alignItems: "center", justifyContent: "center", borderRadius: "50%", border: "none", background: "transparent", color: "var(--accent-2)", cursor: "pointer" }}><Icon name="x" size={12} /></button>
            </span>
          ))}
          <button onClick={clearAll} style={{ fontSize: 11.5, fontWeight: 600, color: "var(--muted)", background: "transparent", border: "none", cursor: "pointer", textDecoration: "underline" }}>{t("inc.filter.clear")}</button>
        </div>
      )}

      {/* Tabla */}
      <div style={{ borderTop: "1px solid var(--line)", overflowX: "auto" }}>
        <div style={{ minWidth: 940 }}>
          <div style={gridStyle(true)}>
            <div>{t("inc.col.number")}</div>
            <div>{t("inc.col.title")}</div>
            <div>{t("inc.col.app")}</div>
            <div>{t("inc.col.priority")}</div>
            <div>{t("inc.col.sla")}</div>
            <div style={{ textAlign: "right" }}>{t("inc.col.score")}</div>
            <div>{t("inc.col.status")}</div>
          </div>

          {filtered.length === 0 ? (
            <EmptyState text={t("inc.empty")} icon="inbox" />
          ) : g.groups ? (
            g.groups.map((grp) => (
              <div key={grp.value}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 20px", background: "var(--head-bg)", borderTop: "1px solid var(--line)" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>{grp.label}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)" }}>{grp.rows.length}</span>
                </div>
                {grp.rows.map(Line)}
              </div>
            ))
          ) : (
            filtered.map(Line)
          )}
        </div>
      </div>
    </div>
  );
}

/** Valor de campo clickeable: hace drill-down (aplica el filtro) sin abrir el detalle. */
function Drill({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  const { t } = useI18n();
  return (
    <span
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      title={t("inc.filter.drill")}
      style={{ fontSize: 12.5, color: "var(--text)", cursor: "pointer", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecorationLine: "underline", textDecorationColor: "var(--line)", textUnderlineOffset: 3 }}
    >
      {children}
    </span>
  );
}

function FieldSelect({ label, value, onChange, options, allLabel, render }: { label: string; value: string; onChange: (v: string) => void; options: string[]; allLabel: string; render?: (v: string) => string }) {
  return (
    <label style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 11.5, color: "var(--muted)", fontWeight: 600 }}>
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)}
        style={{ fontSize: 12, padding: "6px 10px", borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: "var(--card)", color: "var(--text)", fontFamily: "var(--font-ui)", maxWidth: 200 }}>
        <option value="">{allLabel}</option>
        {options.map((o) => <option key={o} value={o}>{render ? render(o) : o}</option>)}
      </select>
    </label>
  );
}

function distinct(values: (string | null | undefined)[]): string[] {
  return [...new Set(values.filter((v): v is string => !!v))].sort((a, b) => a.localeCompare(b));
}

function gridStyle(header: boolean): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "120px minmax(180px, 1fr) 150px 104px 100px 64px 128px",
    gap: 12,
    alignItems: "center",
    padding: header ? "10px 20px" : "14px 20px",
    borderBottom: "1px solid var(--line-soft)",
    background: header ? "var(--head-bg)" : "transparent",
    fontSize: header ? 10.5 : 13,
    fontWeight: header ? 700 : 400,
    letterSpacing: header ? "0.6px" : undefined,
    textTransform: header ? "uppercase" : undefined,
    color: header ? "#8A948A" : "var(--text)",
  };
}
