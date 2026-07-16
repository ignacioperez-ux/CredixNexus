"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import { Icon } from "@/components/ui/icon";
import { PriorityTag } from "@/components/incidents/badges";
import { SlaStatusInline } from "@/components/sla/sla-status";
import { changeStatus } from "@/lib/incidents/actions";
import type { OpDay, OpCase } from "@/lib/operador/queries";

// Estructura espejo del cockpit del rol Squad (Mi trabajo): saludo + linea de estado, "siguiente
// mejor accion", KPIs personales, kanban personal y "mi semana". Todo del operador autenticado.
const COLS = ["assigned", "in_progress", "waiting", "resolved"] as const;
const COL_DOT: Record<string, string> = { assigned: "var(--muted)", in_progress: "var(--st-info)", waiting: "var(--st-high-fg)", resolved: "var(--st-low-fg)" };
const PRIO_COLOR: Record<string, string> = { p1_critical: "var(--st-critical-fg)", p2_high: "var(--st-high-fg)", p3_medium: "var(--st-medium-fg)", p4_low: "var(--st-low-fg)" };
const SEM: Record<string, string> = { breached: "var(--st-critical-fg)", critical: "var(--st-critical-fg)", warning: "var(--st-high-fg)", ok: "var(--st-low-fg)", na: "var(--muted)" };

export function OpDayView({ day, firstName }: { day: OpDay; firstName: string }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);

  if (!day.memberId) {
    return <Empty t={t} title="op.nomember.title" hint="op.nomember.hint" icon="user" />;
  }

  const greet = now ? t(now.getHours() < 12 ? "op.tw.greet.morning" : now.getHours() < 19 ? "op.tw.greet.afternoon" : "op.tw.greet.evening") : "";
  const dateStr = now ? new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long" }).format(now) : "";
  const s = day.status;
  const move = (id: string, status: string) => { setBusy(id); start(async () => { await changeStatus(id, status); setBusy(null); router.refresh(); }); };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 1320 }}>
      {/* Encabezado + linea de estado + semaforo global */}
      <header style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap", justifyContent: "space-between" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", margin: 0, letterSpacing: "-0.2px" }}>{greet ? `${greet}, ${firstName}` : firstName}</h1>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", fontSize: 12.5, color: "var(--muted)" }}>
            {dateStr && <span style={{ textTransform: "capitalize" }}>{dateStr}</span>}
            <Stat n={s.active} label={t("op.st.active")} />
            <Dot /><Stat n={s.dueToday} label={t("op.st.duetoday")} danger={s.dueToday > 0} />
            <Dot /><Stat n={s.atRisk} label={t("op.st.atrisk")} danger={s.atRisk > 0} />
          </div>
        </div>
        <span title={t("op.sem.hint")} style={{ width: 14, height: 14, borderRadius: "50%", background: SEM[s.worst] ?? "var(--st-low-fg)", marginTop: 6, boxShadow: "0 0 0 4px color-mix(in srgb, currentColor 12%, transparent)" }} />
      </header>

      {/* Siguiente mejor accion */}
      {day.nextBest ? <NextBest c={day.nextBest} t={t} /> : (
        <div style={{ ...card(), color: "var(--st-low-fg)", display: "flex", alignItems: "center", gap: 8 }}>
          <Icon name="check" size={16} color="var(--st-low-fg)" /> {t("op.next.empty")}
        </div>
      )}

      {/* KPIs personales */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        <Kpi label={t("op.kpi.active")} value={String(day.kpis.active)} sub={Object.entries(day.kpis.byStatus).map(([k, v]) => `${v} ${t(("op.col." + k) as MessageKey)}`).join(" · ")} />
        <Kpi label={t("op.kpi.due")} value={String(day.kpis.dueToday + day.kpis.overdue)} danger={day.kpis.dueToday + day.kpis.overdue > 0} sub={`${day.kpis.overdue} ${t("op.kpi.overdue")}`} />
        <Kpi label={t("op.kpi.resolved")} value={String(day.kpis.resolvedWeek)} sub={delta(day.kpis.resolvedWeek - day.kpis.resolvedPrevWeek)} />
        <Kpi label={t("op.kpi.load")} value={day.kpis.util == null ? String(day.kpis.active) : `${day.kpis.util}%`} tone={day.kpis.util == null ? undefined : day.kpis.util > 100 ? "bad" : day.kpis.util > 80 ? "warn" : "good"} sub={day.capacity > 0 ? `${day.kpis.active}/${day.capacity} ${t("op.kpi.cap")}` : undefined} />
      </div>

      {/* Kanban personal */}
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

      {/* Mi semana */}
      <section style={card()}>
        <SectionTitle icon="activity" title={t("op.week.title")} />
        <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 20, alignItems: "center" }}>
          <WeekBars week={day.week} t={t} />
          <PriorityDonut data={day.byPriority} t={t} />
        </div>
      </section>
    </div>
  );
}

function NextBest({ c, t }: { c: OpCase; t: (k: MessageKey) => string }) {
  return (
    <div style={{ ...card(), borderLeft: `4px solid ${PRIO_COLOR[c.priority] ?? "var(--accent)"}`, display: "flex", flexDirection: "column", gap: 10 }}>
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
      <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 70 }}>
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

function Stat({ n, label, danger }: { n: number; label: string; danger?: boolean }) {
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><b style={{ fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums", color: danger && n > 0 ? "var(--st-critical-fg)" : "var(--text)" }}>{n}</b><span style={{ opacity: 0.85 }}>{label}</span></span>;
}
function Dot() { return <span style={{ color: "var(--line)" }}>·</span>; }
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
