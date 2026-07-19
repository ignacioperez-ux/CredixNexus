"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import { Icon } from "@/components/ui/icon";
import { PriorityTag } from "@/components/incidents/badges";
import { SlaStatusInline } from "@/components/sla/sla-status";
import { changeStatus } from "@/lib/incidents/actions";
import type { OpDay, OpCase } from "@/lib/operador/queries";

// Mi dia del Operador con ESTILO TORRE, acotado a SUS casos (getMyDay ya filtra por persona:
// assigned_member_id / assigned_user_id). Misma estructura que la Torre de Operaciones: hero + chips,
// "requiere tu atencion" (siguiente mejor accion + urgentes), franja de KPIs y tabs (?tab=), pero
// todo personal. Cero datos globales de la mesa.
const COLS = ["assigned", "in_progress", "waiting", "resolved"] as const;
const COL_DOT: Record<string, string> = { assigned: "var(--muted)", in_progress: "var(--st-info)", waiting: "var(--st-high-fg)", resolved: "var(--st-low-fg)" };
const PRIO_COLOR: Record<string, string> = { p1_critical: "var(--st-critical-fg)", p2_high: "var(--st-high-fg)", p3_medium: "var(--st-medium-fg)", p4_low: "var(--st-low-fg)" };
const SEM: Record<string, string> = { breached: "var(--st-critical-fg)", critical: "var(--st-critical-fg)", warning: "var(--st-high-fg)", ok: "var(--st-low-fg)", na: "var(--muted)" };

type Tab = "resumen" | "sla" | "semana";
const TABS: Tab[] = ["resumen", "sla", "semana"];

export function OpDayView({ day, firstName }: { day: OpDay; firstName: string }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);

  const tabParam = sp.get("tab") ?? "resumen";
  const tab: Tab = (TABS as string[]).includes(tabParam) ? (tabParam as Tab) : "resumen";
  function setTab(v: Tab) {
    const params = new URLSearchParams(sp.toString());
    if (v === "resumen") params.delete("tab"); else params.set("tab", v);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  if (!day.memberId) {
    return <Empty t={t} title="op.nomember.title" hint="op.nomember.hint" icon="user" />;
  }

  const greet = now ? t(now.getHours() < 12 ? "op.tw.greet.morning" : now.getHours() < 19 ? "op.tw.greet.afternoon" : "op.tw.greet.evening") : "";
  const dateStr = now ? new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long" }).format(now) : "";
  const s = day.status;
  const move = (id: string, status: string) => { setBusy(id); start(async () => { await changeStatus(id, status); setBusy(null); router.refresh(); }); };

  const tabLabels: Record<Tab, MessageKey> = { resumen: "op.md.tab.resumen", sla: "op.md.tab.sla", semana: "op.md.tab.semana" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 1180 }}>
      {/* A) HERO COMPACTO */}
      <header style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--muted)" }}>
            {t("nav.miday")}{dateStr ? ` · ${dateStr}` : ""}
          </span>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", margin: 0, letterSpacing: "-0.02em" }}>{greet ? `${greet}, ${firstName}` : firstName}</h1>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <StatusChips s={s} t={t} />
          <span title={t("op.sem.hint")} style={{ width: 12, height: 12, borderRadius: "50%", background: SEM[s.worst] ?? "var(--st-low-fg)", boxShadow: "0 0 0 4px color-mix(in srgb, currentColor 12%, transparent)" }} />
        </div>
      </header>

      {/* B) REQUIERE TU ATENCION: siguiente mejor accion + urgentes propios */}
      <section style={card()}>
        <SectionTitle icon="zap" title={t("op.md.decide")} />
        {day.nextBest ? <NextBest c={day.nextBest} t={t} /> : (
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--st-low-fg)", fontSize: 13, padding: "6px 2px" }}>
            <Icon name="check" size={16} color="var(--st-low-fg)" /> {t("op.next.empty")}
          </div>
        )}
        {(s.overdue > 0 || s.dueToday > 0) && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 10, marginTop: 12 }}>
            {s.overdue > 0 && <DecisionChip red count={s.overdue} label={t("op.kpi.overdue")} cta={t("op.md.intervene")} t={t} />}
            {s.dueToday > 0 && <DecisionChip count={s.dueToday} label={t("op.st.duetoday")} cta={t("op.md.attend")} t={t} />}
          </div>
        )}
      </section>

      {/* C) FRANJA MI OPERACION (KPIs personales) */}
      <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--muted)" }}>{t("op.md.operation")}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          <Kpi label={t("op.kpi.active")} value={String(day.kpis.active)} sub={Object.entries(day.kpis.byStatus).map(([k, v]) => `${v} ${t(("op.col." + k) as MessageKey)}`).join(" · ")} />
          <Kpi label={t("op.kpi.due")} value={String(day.kpis.dueToday + day.kpis.overdue)} danger={day.kpis.dueToday + day.kpis.overdue > 0} sub={`${day.kpis.overdue} ${t("op.kpi.overdue")}`} />
          <Kpi label={t("op.kpi.resolved")} value={String(day.kpis.resolvedWeek)} sub={delta(day.kpis.resolvedWeek - day.kpis.resolvedPrevWeek)} />
          <Kpi label={t("op.kpi.load")} value={day.kpis.util == null ? String(day.kpis.active) : `${day.kpis.util}%`} tone={day.kpis.util == null ? undefined : day.kpis.util > 100 ? "bad" : day.kpis.util > 80 ? "warn" : "good"} sub={day.capacity > 0 ? `${day.kpis.active}/${day.capacity} ${t("op.kpi.cap")}` : undefined} />
        </div>
      </section>

      {/* D) TABS (?tab=) */}
      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--line)" }}>
        {TABS.map((k) => {
          const active = tab === k;
          return (
            <button key={k} onClick={() => setTab(k)}
              style={{ fontSize: 13, fontWeight: 600, padding: "10px 16px", border: "none", background: active ? "var(--card)" : "transparent", color: active ? "var(--text)" : "var(--muted)", cursor: "pointer", borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent", marginBottom: -1, borderRadius: "7px 7px 0 0" }}>
              {t(tabLabels[k])}
            </button>
          );
        })}
      </div>

      {/* Resumen: kanban personal */}
      {tab === "resumen" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 12 }}>
          {COLS.map((col) => {
            const items = col === "resolved"
              ? day.cases.filter((c) => c.status === "resolved" && c.resolved_at && Date.now() - Date.parse(c.resolved_at) <= 7 * 86_400_000)
              : day.open.filter((c) => c.status === col);
            return (
              <div key={col} style={{ background: "var(--head-bg)", borderRadius: 12, padding: 10, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "2px 4px 10px" }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: COL_DOT[col] }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>{t(("op.col." + col) as MessageKey)}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)", marginLeft: "auto" }}>{items.length}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {items.length === 0 && <div style={{ fontSize: 11.5, color: "var(--muted)", opacity: 0.6, padding: "8px 4px" }}>—</div>}
                  {items.map((c) => <CaseCard key={c.id} c={c} t={t} busy={busy === c.id && pending} onMove={move} />)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* SLA y prioridad: semaforo + donut de prioridad de MIS casos */}
      {tab === "sla" && (
        <section style={card()}>
          <SectionTitle icon="scale" title={t("op.md.tab.sla")} />
          <PriorityDonut data={day.byPriority} t={t} />
        </section>
      )}

      {/* Mi semana: resueltos por dia (14 d) */}
      {tab === "semana" && (
        <section style={card()}>
          <SectionTitle icon="activity" title={t("op.week.title")} />
          <WeekBars week={day.week} t={t} />
        </section>
      )}
    </div>
  );
}

function StatusChips({ s, t }: { s: OpDay["status"]; t: (k: MessageKey) => string }) {
  const chips: { n: number; label: MessageKey; danger?: boolean }[] = [
    { n: s.active, label: "op.st.active" },
    { n: s.dueToday, label: "op.st.duetoday", danger: true },
    { n: s.overdue, label: "op.kpi.overdue", danger: true },
    { n: s.atRisk, label: "op.st.atrisk", danger: true },
  ];
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {chips.map((c, i) => {
        const zero = c.n === 0;
        const alert = !!c.danger && c.n > 0;
        return (
          <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 11px", borderRadius: 20, background: zero ? "var(--head-bg)" : alert ? "var(--st-critical-bg)" : "var(--st-info-bg, var(--paper))", border: `1px solid ${zero ? "var(--line)" : "transparent"}`, opacity: zero ? 0.55 : 1 }}>
            <b style={{ fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums", fontSize: 13, fontWeight: 800, color: zero ? "var(--muted)" : alert ? "var(--st-critical-fg)" : "var(--text)" }}>{c.n}</b>
            <span style={{ fontSize: 11.5, color: zero ? "var(--muted)" : "var(--text)" }}>{t(c.label)}</span>
          </span>
        );
      })}
    </div>
  );
}

function DecisionChip({ count, label, cta, red, t }: { count: number; label: string; cta: string; red?: boolean; t: (k: MessageKey) => string }) {
  const bg = red ? "var(--st-critical-bg)" : "var(--st-high-bg)";
  const fg = red ? "var(--st-critical-fg)" : "var(--st-high-fg)";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 10, background: bg, border: `1px solid ${fg}22` }}>
      <span style={{ fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums", fontSize: 18, fontWeight: 800, color: fg, minWidth: 26, textAlign: "right" }}>{count}</span>
      <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{label}</span>
      <Link href="/mis-casos" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 13px", borderRadius: 8, background: red ? "var(--accent)" : "var(--card)", color: red ? "var(--on-accent)" : fg, border: red ? "none" : `1px solid ${fg}55`, fontSize: 12.5, fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap" }}>
        {cta}<Icon name="chevron-right" size={13} color={red ? "var(--on-accent)" : fg} />
      </Link>
    </div>
  );
}

function NextBest({ c, t }: { c: OpCase; t: (k: MessageKey) => string }) {
  return (
    <div style={{ borderLeft: `4px solid ${PRIO_COLOR[c.priority] ?? "var(--accent)"}`, paddingLeft: 14, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Icon name="zap" size={15} color="var(--accent)" />
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.4px", color: "var(--accent)" }}>{t("op.next.title")}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--accent-2)" }}>{c.number}</span>
        <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>{c.title}</span>
        <PriorityTag priority={c.priority} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", fontSize: 12, color: "var(--muted)" }}>
        {c.customer && <span>{c.customer}</span>}
        {c.app && <span>· {c.app}</span>}
        <SlaStatusInline openedAt={c.opened_at} dueAt={c.resoDueAt} resolvedAt={c.resolved_at} status={c.status} />
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <Link href={`/incidents/${c.id}`} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: "var(--r-md)", background: "var(--accent)", color: "var(--on-accent)", fontWeight: 700, fontSize: 12.5, textDecoration: "none" }}>{t("op.next.work")}</Link>
        <Link href="/mis-casos" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: "var(--r-md)", background: "var(--card)", color: "var(--text)", border: "1px solid var(--line)", fontWeight: 600, fontSize: 12.5, textDecoration: "none" }}>{t("op.next.all")}</Link>
      </div>
    </div>
  );
}

function CaseCard({ c, t, busy, onMove }: { c: OpCase; t: (k: MessageKey) => string; busy: boolean; onMove: (id: string, s: string) => void }) {
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 10, padding: "9px 10px", display: "flex", flexDirection: "column", gap: 7, opacity: busy ? 0.6 : 1, borderLeft: `3px solid ${PRIO_COLOR[c.priority] ?? "var(--line)"}` }}>
      <Link href={`/incidents/${c.id}`} style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text)", lineHeight: 1.35, textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{c.title}</Link>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", fontSize: 10.5, color: "var(--muted)" }}>
        <span style={{ fontFamily: "var(--font-mono)" }}>{c.number}</span>
        {c.app && <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 90 }}>· {c.app}</span>}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <SlaStatusInline openedAt={c.opened_at} dueAt={c.resoDueAt} resolvedAt={c.resolved_at} status={c.status} />
        <select value={c.status} disabled={busy} onChange={(e) => onMove(c.id, e.target.value)}
          style={{ marginLeft: "auto", fontSize: 10, padding: "2px 5px", borderRadius: 5, border: "1px solid var(--line)", background: "var(--card)", color: "var(--text)", cursor: "pointer" }}>
          {COLS.map((st) => <option key={st} value={st}>{t(("op.col." + st) as MessageKey)}</option>)}
        </select>
      </div>
    </div>
  );
}

function WeekBars({ week, t }: { week: { day: string; count: number }[]; t: (k: MessageKey) => string }) {
  const max = Math.max(1, ...week.map((w) => w.count));
  return (
    <div>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 8 }}>{t("op.week.resolved")}</div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 90 }}>
        {week.map((w) => (
          <div key={w.day} title={`${w.day}: ${w.count}`} style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center", gap: 3 }}>
            <div style={{ width: "100%", height: `${(w.count / max) * 100}%`, minHeight: w.count > 0 ? 4 : 1, background: w.count > 0 ? "var(--accent-2)" : "var(--track)", borderRadius: 3 }} />
          </div>
        ))}
      </div>
    </div>
  );
}

function PriorityDonut({ data, t }: { data: { key: string; count: number }[]; t: (k: MessageKey) => string }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  if (total === 0) return <div style={{ fontSize: 12, color: "var(--muted)" }}>{t("op.week.noactive")}</div>;
  let acc = 0; const R = 34, C = 2 * Math.PI * R;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <svg width={84} height={84} viewBox="0 0 84 84">
        <circle cx={42} cy={42} r={R} fill="none" stroke="var(--track)" strokeWidth={12} />
        {data.map((d) => {
          const frac = d.count / total, dash = frac * C, off = -acc * C; acc += frac;
          return <circle key={d.key} cx={42} cy={42} r={R} fill="none" stroke={PRIO_COLOR[d.key]} strokeWidth={12} strokeDasharray={`${dash} ${C - dash}`} strokeDashoffset={off} transform="rotate(-90 42 42)" />;
        })}
        <text x={42} y={47} textAnchor="middle" fontSize={18} fontWeight={800} fill="var(--text)" fontFamily="var(--font-mono)">{total}</text>
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {data.map((d) => <span key={d.key} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--muted)" }}><span style={{ width: 9, height: 9, borderRadius: 2, background: PRIO_COLOR[d.key] }} />{t(("prio." + d.key) as MessageKey)} <b style={{ color: "var(--text)", fontFamily: "var(--font-mono)" }}>{d.count}</b></span>)}
      </div>
    </div>
  );
}

function delta(d: number): string { return d === 0 ? "=" : d > 0 ? `▲ ${d}` : `▼ ${Math.abs(d)}`; }

function Kpi({ label, value, sub, danger, tone }: { label: string; value: string; sub?: string; danger?: boolean; tone?: "good" | "warn" | "bad" }) {
  const color = danger ? "var(--st-critical-fg)" : tone === "good" ? "var(--st-low-fg)" : tone === "warn" ? "var(--st-high-fg)" : tone === "bad" ? "var(--st-critical-fg)" : "var(--text)";
  return <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 16 }}>
    <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--muted)", marginBottom: 8 }}>{label}</div>
    <div style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 22, letterSpacing: "-0.5px", color }}>{value}</div>
    {sub && <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub}</div>}
  </div>;
}

function SectionTitle({ icon, title }: { icon: string; title: string }) {
  return <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}><Icon name={icon} size={16} color="var(--accent)" /><h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", margin: 0 }}>{title}</h2></div>;
}

function Empty({ t, title, hint, icon }: { t: (k: MessageKey) => string; title: string; hint: string; icon: string }) {
  return <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "64px 20px", textAlign: "center", color: "var(--muted)" }}>
    <Icon name={icon} size={34} strokeWidth={1.4} color="var(--muted)" />
    <div style={{ fontSize: 14.5, fontWeight: 700, color: "var(--text)" }}>{t(title as MessageKey)}</div>
    <div style={{ fontSize: 12.5, maxWidth: 380, lineHeight: 1.5 }}>{t(hint as MessageKey)}</div>
  </div>;
}

function card(): React.CSSProperties { return { background: "var(--card)", borderRadius: 14, padding: "16px 18px", border: "1px solid color-mix(in srgb, var(--line) 55%, transparent)" }; }
