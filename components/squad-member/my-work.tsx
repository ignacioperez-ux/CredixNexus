"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import { Icon } from "@/components/ui/icon";
import { squadColor } from "@/lib/squad-member/colors";
import { moveMyTask, notifyBlocker } from "@/lib/squad-member/actions";
import type { MyWork, MyTask } from "@/lib/squad-member/queries";

const COLS = ["todo", "doing", "blocked", "done"] as const;
const COL_DOT: Record<string, string> = { todo: "var(--muted)", doing: "var(--st-info)", blocked: "var(--st-critical-fg)", done: "var(--st-low-fg)" };
const MS_DAY = 86_400_000;

export function MyWorkView({ work, firstName }: { work: MyWork; firstName: string }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);

  const [fSquad, setFSquad] = useState("");
  const [fInit, setFInit] = useState("");
  const [q, setQ] = useState("");

  const initiatives = useMemo(() => [...new Map(work.tasks.filter((x) => x.initiative_code).map((x) => [x.initiative_code!, x.initiative_name ?? x.initiative_code!])).entries()], [work.tasks]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return work.tasks.filter((x) =>
      (!fSquad || x.squad_id === fSquad) &&
      (!fInit || x.initiative_code === fInit) &&
      (!term || x.title.toLowerCase().includes(term)));
  }, [work.tasks, fSquad, fInit, q]);

  const move = (id: string, status: string) => {
    setBusy(id);
    start(async () => { await moveMyTask(id, status); setBusy(null); router.refresh(); });
  };

  if (!work.memberId) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "64px 20px", textAlign: "center", color: "var(--muted)" }}>
        <Icon name="users" size={34} strokeWidth={1.4} color="var(--muted)" />
        <div style={{ fontSize: 14.5, fontWeight: 700, color: "var(--text)" }}>{t("sm.nomember.title")}</div>
        <div style={{ fontSize: 12.5, maxWidth: 380, lineHeight: 1.5 }}>{t("sm.nomember.hint")}</div>
      </div>
    );
  }

  const greet = now ? t(now.getHours() < 12 ? "op.tw.greet.morning" : now.getHours() < 19 ? "op.tw.greet.afternoon" : "op.tw.greet.evening") : "";
  const dateStr = now ? new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long" }).format(now) : "";
  const s = work.status;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 1320 }}>
      {/* Saludo + linea de estado */}
      <header style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", margin: 0, letterSpacing: "-0.2px" }}>{greet ? `${greet}, ${firstName}` : firstName}</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", fontSize: 12.5, color: "var(--muted)" }}>
          {dateStr && <span style={{ textTransform: "capitalize" }}>{dateStr}</span>}
          <StatLine n={s.doing} label={t("sm.status.doing")} />
          <Dot /><StatLine n={s.todo} label={t("sm.status.todo")} />
          <Dot /><StatLine n={s.dueThisWeek} label={t("sm.status.dueweek")} danger={s.dueThisWeek > 0} />
          <Dot /><StatLine n={work.totalAllocation} label={t("sm.status.alloc")} suffix="%" tone={work.totalAllocation > 100 ? "danger" : undefined} />
        </div>
      </header>

      {/* Mi capacidad multi-squad */}
      {work.squads.length > 0 && (
        <section style={card()}>
          <SectionTitle icon="activity" title={t("sm.capacity.title")} />
          <div style={{ display: "flex", height: 14, borderRadius: 8, overflow: "hidden", background: "var(--track)", marginBottom: 10 }}>
            {work.squads.map((sq) => {
              const c = squadColor(sq.code);
              return <div key={sq.squad_id} title={`${sq.code} ${sq.allocation_pct}%`} style={{ width: `${Math.min(100, sq.allocation_pct)}%`, background: c.fg, borderRight: "2px solid var(--card)" }} />;
            })}
          </div>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            {work.capacity.map((cp) => {
              const c = squadColor(cp.code);
              return (
                <div key={cp.squad_id} style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: c.fg }} />
                  <span style={{ fontWeight: 700, color: "var(--text)" }}>{cp.code}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums", color: "var(--muted)" }}>{cp.allocation_pct}%</span>
                  <span style={{ color: "var(--muted)" }}>· {cp.committed_points} {t("sm.capacity.pts")}</span>
                </div>
              );
            })}
          </div>
          {work.totalAllocation > 100 && (
            <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8, fontSize: 11.5, color: "var(--st-high-fg)", background: "var(--st-high-bg)", padding: "7px 10px", borderRadius: 8 }}>
              <Icon name="alert" size={13} color="var(--st-high-fg)" /> {t("sm.capacity.over")}
            </div>
          )}
        </section>
      )}

      {/* Filtros */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 10px", borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: "var(--card)" }}>
          <Icon name="search" size={13} color="var(--muted)" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("sm.search")} style={{ border: "none", outline: "none", background: "transparent", color: "var(--text)", fontSize: 12.5, width: 170 }} />
        </div>
        <Select value={fSquad} onChange={setFSquad} all={t("sm.filter.allsquads")} options={work.squads.map((sq) => ({ value: sq.squad_id, label: sq.code }))} />
        <Select value={fInit} onChange={setFInit} all={t("sm.filter.allinit")} options={initiatives.map(([code, name]) => ({ value: code, label: name }))} />
      </div>

      {/* Kanban personal */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 }}>
        {COLS.map((col) => {
          const items = filtered.filter((x) => x.status === col);
          return (
            <div key={col} style={{ background: "var(--head-bg)", borderRadius: 12, padding: 10, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "2px 4px 10px" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: COL_DOT[col] }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>{t(("sm.col." + col) as MessageKey)}</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)", marginLeft: "auto" }}>{items.length}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {items.length === 0 && <div style={{ fontSize: 11.5, color: "var(--muted)", opacity: 0.6, padding: "8px 4px" }}>—</div>}
                {items.map((x) => <TaskCard key={x.id} task={x} now={now} locale={locale} t={t} busy={busy === x.id && pending} onMove={move} />)}
              </div>
            </div>
          );
        })}
      </div>

      {work.tasks.length === 0 && (
        <div style={{ padding: "16px 4px", fontSize: 12.5, color: "var(--muted)" }}>{t("sm.empty.tasks")}</div>
      )}

      {/* Bloqueos que me afectan */}
      <section style={card()}>
        <SectionTitle icon="alert" title={t("sm.blockers.title")} count={work.status.blocked} />
        {work.tasks.filter((x) => x.status === "blocked").length === 0 ? (
          <div style={{ fontSize: 12.5, color: "var(--st-low-fg)" }}>{t("sm.blockers.empty")}</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {work.tasks.filter((x) => x.status === "blocked").map((x) => <BlockerRow key={x.id} task={x} t={t} />)}
          </div>
        )}
      </section>
    </div>
  );
}

function TaskCard({ task, now, locale, t, busy, onMove }: { task: MyTask; now: Date | null; locale: string; t: (k: MessageKey) => string; busy: boolean; onMove: (id: string, s: string) => void }) {
  const c = squadColor(task.squad_code);
  const dueColor = (() => {
    if (!task.due_date || !now) return "var(--muted)";
    const diff = Date.parse(task.due_date) - now.getTime();
    return diff < 0 ? "var(--st-critical-fg)" : diff <= 3 * MS_DAY ? "var(--st-high-fg)" : "var(--muted)";
  })();
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 10, padding: "9px 10px", display: "flex", flexDirection: "column", gap: 7, opacity: busy ? 0.6 : 1 }}>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text)", lineHeight: 1.35 }}>{task.title}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <span title={task.squad_name ?? undefined} style={{ fontSize: 9.5, fontWeight: 700, color: c.fg, background: c.bg, border: `1px solid ${c.border}`, borderRadius: "var(--r-pill)", padding: "1px 7px" }}>{task.squad_code ?? "—"}</span>
        {task.initiative_code && <span style={{ fontSize: 9.5, color: "var(--muted)", background: "var(--paper)", borderRadius: "var(--r-pill)", padding: "1px 7px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 120 }} title={task.initiative_name ?? undefined}>{task.initiative_code}</span>}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 10.5, color: "var(--muted)" }}>
        <span style={{ fontFamily: "var(--font-mono)" }}>{task.effort_points} pts</span>
        {task.due_date && <span style={{ color: dueColor, fontWeight: dueColor !== "var(--muted)" ? 700 : 400 }}>{new Date(task.due_date).toLocaleDateString(locale, { day: "2-digit", month: "short" })}</span>}
        <select value={task.status} disabled={busy} onChange={(e) => onMove(task.id, e.target.value)}
          style={{ marginLeft: "auto", fontSize: 10.5, padding: "2px 6px", borderRadius: 6, border: "1px solid var(--line)", background: "var(--card)", color: "var(--text)", cursor: "pointer" }}>
          {COLS.map((s) => <option key={s} value={s}>{t(("sm.col." + s) as MessageKey)}</option>)}
        </select>
      </div>
    </div>
  );
}

function BlockerRow({ task, t }: { task: MyTask; t: (k: MessageKey) => string }) {
  const [sent, setSent] = useState(false);
  const [pending, start] = useTransition();
  const c = squadColor(task.squad_code);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, background: "var(--st-critical-bg)" }}>
      <span style={{ fontSize: 9.5, fontWeight: 700, color: c.fg, background: c.bg, border: `1px solid ${c.border}`, borderRadius: "var(--r-pill)", padding: "1px 7px", flexShrink: 0 }}>{task.squad_code ?? "—"}</span>
      <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{task.title}</span>
      {sent ? (
        <span style={{ fontSize: 11.5, color: "var(--st-low-fg)", display: "inline-flex", alignItems: "center", gap: 4 }}><Icon name="check" size={12} /> {t("sm.notified")}</span>
      ) : (
        <button onClick={() => start(async () => { const r = await notifyBlocker(task.id); if (r.ok) setSent(true); })} disabled={pending}
          style={{ fontSize: 11.5, fontWeight: 600, padding: "5px 11px", borderRadius: "var(--r-pill)", border: "1px solid var(--st-critical-fg)", background: "var(--card)", color: "var(--st-critical-fg)", cursor: "pointer", whiteSpace: "nowrap" }}>{t("sm.notify")}</button>
      )}
    </div>
  );
}

function StatLine({ n, label, suffix, danger, tone }: { n: number; label: string; suffix?: string; danger?: boolean; tone?: "danger" }) {
  const color = (danger && n > 0) || tone === "danger" ? "var(--st-critical-fg)" : "var(--text)";
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><b style={{ fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums", color }}>{n}{suffix ?? ""}</b><span style={{ opacity: 0.85 }}>{label}</span></span>;
}
function Dot() { return <span style={{ color: "var(--line)" }}>·</span>; }
function SectionTitle({ icon, title, count }: { icon: string; title: string; count?: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
      <Icon name={icon} size={16} color="var(--accent)" />
      <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", margin: 0 }}>{title}</h2>
      {count != null && count > 0 && <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: "var(--st-critical-fg)", background: "var(--st-critical-bg)", borderRadius: 20, padding: "1px 8px" }}>{count}</span>}
    </div>
  );
}
function Select({ value, onChange, options, all }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; all: string }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      style={{ fontSize: 12.5, padding: "7px 10px", borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: "var(--card)", color: "var(--text)", cursor: "pointer", maxWidth: 200 }}>
      <option value="">{all}</option>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}
function card(): React.CSSProperties {
  return { background: "var(--card)", borderRadius: 14, padding: "16px 18px", border: "1px solid color-mix(in srgb, var(--line) 55%, transparent)" };
}
