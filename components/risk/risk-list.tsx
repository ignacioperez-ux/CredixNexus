"use client";

import { Icon } from "@/components/ui/icon";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import type { RiskData, RiskEventRow } from "@/lib/risk/queries";
import { updateRiskStatus } from "@/lib/risk/actions";
import { useListFilters, FilterBar, EmptyState, type FilterDef } from "@/components/common/filters";

const STATUSES = ["open", "assessing", "mitigating", "closed", "accepted"];
const statusColor: Record<string, { fg: string; bg: string }> = {
  open: { fg: "var(--st-info)", bg: "var(--st-info-bg)" },
  assessing: { fg: "var(--st-eval)", bg: "var(--st-eval-bg)" },
  mitigating: { fg: "var(--st-high-fg)", bg: "var(--st-high-bg)" },
  closed: { fg: "var(--st-low-fg)", bg: "var(--st-low-bg)" },
  accepted: { fg: "var(--muted)", bg: "var(--paper)" },
};

export function RiskList({ data, canManage }: { data: RiskData; canManage: boolean }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const fmt = (n: number, c: string) => new Intl.NumberFormat(locale === "es" ? "es-CR" : "en-US", { style: "currency", currency: c || "CRC", maximumFractionDigits: 0 }).format(n);
  const cur = data.events[0]?.currency ?? "CRC";
  const rst = (s: string) => t(("risk.rst." + s) as MessageKey);

  const defs: FilterDef<RiskEventRow>[] = [
    { key: "cat", label: t("risk.col.category"), get: (e) => e.risk_category, allLabel: t("risk.filter.all") },
    { key: "status", label: t("risk.col.status"), get: (e) => e.status, allLabel: t("risk.filter.all"), render: (v) => rst(v) },
    { key: "owner", label: t("risk.filter.owner"), get: (e) => e.owner, allLabel: t("risk.filter.all") },
  ];
  const f = useListFilters(data.events, defs);
  const rows = f.filtered;

  // Stats de la vista filtrada (las tarjetas responden a los filtros).
  const view = useMemo(() => {
    const est = rows.reduce((s, e) => s + e.estimated_loss, 0);
    const act = rows.reduce((s, e) => s + e.actual_loss, 0);
    const today = new Date().toISOString().slice(0, 10);
    const mit = rows.filter((e) => ["mitigating", "closed", "accepted"].includes(e.status)).length;
    return {
      open: rows.filter((e) => e.status !== "closed").length,
      est, act, delta: act - est,
      overdue: rows.filter((e) => e.status !== "closed" && e.due_date && e.due_date < today).length,
      mitigatedPct: rows.length ? Math.round((mit / rows.length) * 100) : null,
    };
  }, [rows]);

  async function cycle(e: RiskEventRow) {
    const next = STATUSES[(STATUSES.indexOf(e.status) + 1) % STATUSES.length];
    await updateRiskStatus(e.id, next);
    router.refresh();
  }

  function exportCsv() {
    const cutoff = new Date().toISOString().slice(0, 10);
    const filtersStr = f.chips.length ? f.chips.map((c) => `${c.label}: ${c.value}`).join("; ") : t("risk.export.nofilters");
    const cols = [t("risk.col.number"), t("risk.col.category"), t("risk.col.desc"), t("risk.col.origin"), t("risk.col.estimated"), t("risk.col.actual"), t("risk.col.recovered"), t("risk.col.due"), t("risk.col.status"), t("risk.filter.owner"), t("risk.col.plan")];
    const body = rows.map((e) => [e.event_number, e.risk_category, e.description, e.incident?.incident_number ?? "", e.estimated_loss, e.actual_loss, e.recovered_amount, e.due_date ?? "", rst(e.status), e.owner ?? "", e.action_plan ?? ""]);
    const esc = (v: unknown) => `"${String(v).replace(/"/g, '""')}"`;
    const meta = [`CredixNexus - ${t("risk.title")}`, `${t("risk.export.cutoff")}: ${cutoff}`, `${t("risk.export.filters")}: ${filtersStr}`, `${rows.length} ${t("risk.export.rows")}`, ""];
    const csv = [...meta.map((m) => esc(m)), cols.map(esc).join(","), ...body.map((r) => r.map(esc).join(","))].join("\r\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `credixnexus_riesgo_${cutoff}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Tarjetas */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 }}>
        <Kpi label={t("risk.kpi.open")} value={String(view.open)} />
        <Kpi label={t("risk.kpi.estimated")} value={fmt(view.est, cur)} sub={`${t("risk.kpi.actual")}: ${fmt(view.act, cur)}`} />
        <Kpi label={t("risk.kpi.delta")} value={fmt(view.delta, cur)} danger={view.delta > 0} good={view.delta < 0} />
        <Kpi label={t("risk.kpi.overdue")} value={String(view.overdue)} danger={view.overdue > 0} />
        <Kpi label={t("risk.kpi.mitigated")} value={view.mitigatedPct == null ? "—" : `${view.mitigatedPct}%`} good={(view.mitigatedPct ?? 0) >= 60} />
      </div>

      {/* Heatmap + Tendencia */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 14 }}>
        <Heatmap rows={rows} rst={rst} fmt={(n) => fmt(n, cur)} />
        <Trend rows={rows} fmt={(n) => fmt(n, cur)} />
      </div>

      {/* Filtros + Export */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between" }}>
        <FilterBar defs={defs} filters={f} />
        <button onClick={exportCsv} disabled={rows.length === 0}
          style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, fontWeight: 600, padding: "8px 14px", borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: "var(--card)", color: "var(--text)", cursor: rows.length === 0 ? "default" : "pointer", opacity: rows.length === 0 ? 0.5 : 1 }}>
          <Icon name="download" size={14} /> {t("risk.export")}
        </button>
      </div>

      {/* Tabla completa */}
      <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "108px 110px minmax(200px, 1.5fr) 108px 108px 100px 112px 1fr", minWidth: 1040 }}>
            {[t("risk.col.number"), t("risk.col.category"), t("risk.col.desc"), t("risk.col.estimated"), t("risk.col.actual"), t("risk.col.due"), t("risk.col.status"), t("risk.col.plan")].map((h, i) => (
              <div key={h} style={{ ...headSt, textAlign: i === 3 || i === 4 ? "right" : "left", ...(i === 0 ? { position: "sticky", left: 0, zIndex: 2 } : {}) }}>{h}</div>
            ))}
            {rows.length === 0 && <EmptyState text={t("risk.empty")} icon="shield" />}
            {rows.map((e) => {
              const sc = statusColor[e.status] ?? statusColor.open;
              const overdue = e.status !== "closed" && e.due_date && e.due_date < new Date().toISOString().slice(0, 10);
              return (
                <div key={e.id} style={{ display: "contents" }}>
                  <Cell mono accent sticky>{e.event_number}</Cell>
                  <Cell muted>{e.risk_category}</Cell>
                  <Cell>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <span>{e.description}</span>
                      {e.incident && <Link href={`/incidents/${e.incident.id}`} style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--accent-2)", textDecoration: "none" }}>◂ {e.incident.incident_number}</Link>}
                    </div>
                  </Cell>
                  <Cell mono right>{fmt(e.estimated_loss, e.currency)}</Cell>
                  <Cell mono right>{fmt(e.actual_loss, e.currency)}</Cell>
                  <Cell mono muted style={overdue ? { color: "var(--st-critical-fg)", fontWeight: 700 } : undefined}>{e.due_date ?? "—"}</Cell>
                  <Cell>
                    <button onClick={() => canManage && cycle(e)} disabled={!canManage}
                      style={{ fontSize: 10.5, padding: "3px 10px", borderRadius: "var(--r-pill)", border: "none", cursor: canManage ? "pointer" : "default", color: sc.fg, background: sc.bg, fontWeight: 600, whiteSpace: "nowrap" }}>
                      {rst(e.status)}
                    </button>
                  </Cell>
                  <Cell muted title={e.action_plan ?? undefined}>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{e.action_plan || <span style={{ opacity: 0.5 }}>{t("risk.noplan")}</span>}</span>
                  </Cell>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function Heatmap({ rows, rst, fmt }: { rows: RiskEventRow[]; rst: (s: string) => string; fmt: (n: number) => string }) {
  const { t } = useI18n();
  const cats = [...new Set(rows.map((e) => e.risk_category))].sort();
  const cells = new Map<string, { count: number; est: number }>();
  let max = 0;
  for (const e of rows) {
    const k = `${e.risk_category}|${e.status}`;
    const c = cells.get(k) ?? { count: 0, est: 0 };
    c.count++; c.est += e.estimated_loss; cells.set(k, c);
    if (c.count > max) max = c.count;
  }
  return (
    <div style={panel()}>
      <PanelTitle icon="shield" title={t("risk.heatmap.title")} hint={t("risk.heatmap.hint")} />
      {cats.length === 0 ? <div style={{ padding: 16, color: "var(--muted)", fontSize: 12.5 }}>{t("risk.empty")}</div> : (
        <div style={{ overflowX: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: `minmax(96px, 1.2fr) repeat(${STATUSES.length}, 1fr)`, gap: 3, minWidth: 420 }}>
            <div />
            {STATUSES.map((s) => <div key={s} style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.3px", color: "var(--muted)", textAlign: "center", padding: "2px 0" }}>{rst(s)}</div>)}
            {cats.map((cat) => (
              <div key={cat} style={{ display: "contents" }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text)", display: "flex", alignItems: "center", paddingRight: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cat}</div>
                {STATUSES.map((s) => {
                  const c = cells.get(`${cat}|${s}`);
                  const intensity = c && max ? 0.18 + (c.count / max) * 0.55 : 0;
                  return (
                    <div key={s} title={c ? `${cat} · ${rst(s)}: ${c.count} · ${fmt(c.est)}` : undefined}
                      style={{ minHeight: 42, borderRadius: 7, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1, background: c ? `color-mix(in srgb, var(--accent) ${Math.round(intensity * 100)}%, var(--card))` : "var(--head-bg)", border: "1px solid var(--line-soft)" }}>
                      {c ? <>
                        <span style={{ fontFamily: "var(--font-mono)", fontWeight: 800, fontSize: 14, color: intensity > 0.45 ? "var(--on-accent)" : "var(--text)" }}>{c.count}</span>
                        <span style={{ fontSize: 8.5, color: intensity > 0.45 ? "var(--on-accent)" : "var(--muted)", opacity: 0.85 }}>{fmt(c.est)}</span>
                      </> : <span style={{ color: "var(--line)", fontSize: 12 }}>·</span>}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Trend({ rows, fmt }: { rows: RiskEventRow[]; fmt: (n: number) => string }) {
  const { t } = useI18n();
  const byMonth = new Map<string, { est: number; real: number }>();
  for (const e of rows) {
    if (!e.event_date) continue;
    const m = e.event_date.slice(0, 7);
    const a = byMonth.get(m) ?? { est: 0, real: 0 };
    a.est += e.estimated_loss; a.real += e.actual_loss; byMonth.set(m, a);
  }
  const months = [...byMonth.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const W = 640, H = 150, PAD = 28;
  const maxV = Math.max(1, ...months.map(([, v]) => Math.max(v.est, v.real)));
  const x = (i: number) => months.length <= 1 ? W / 2 : PAD + (i / (months.length - 1)) * (W - PAD * 2);
  const y = (v: number) => H - PAD - (v / maxV) * (H - PAD * 2);
  const line = (pick: (v: { est: number; real: number }) => number) => months.map(([, v], i) => `${x(i)},${y(pick(v))}`).join(" ");
  return (
    <div style={panel()}>
      <PanelTitle icon="activity" title={t("risk.trend.title")} />
      {months.length === 0 ? <div style={{ padding: 16, color: "var(--muted)", fontSize: 12.5 }}>{t("risk.trend.empty")}</div> : (
        <>
          <div style={{ display: "flex", gap: 14, marginBottom: 6, fontSize: 11 }}>
            <LegendDot color="var(--st-critical-fg)" label={`${t("risk.trend.real")}`} />
            <LegendDot color="var(--teal)" label={`${t("risk.trend.est")}`} />
          </div>
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="150" preserveAspectRatio="xMidYMid meet" role="img">
            <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="var(--line)" strokeWidth={1} />
            <polyline points={line((v) => v.est)} fill="none" stroke="var(--teal)" strokeWidth={2} strokeLinejoin="round" />
            <polyline points={line((v) => v.real)} fill="none" stroke="var(--st-critical-fg)" strokeWidth={2} strokeLinejoin="round" />
            {months.map(([m, v], i) => (
              <g key={m}>
                <circle cx={x(i)} cy={y(v.est)} r={3} fill="var(--teal)" />
                <circle cx={x(i)} cy={y(v.real)} r={3} fill="var(--st-critical-fg)" />
                <text x={x(i)} y={H - PAD + 14} textAnchor="middle" fontSize={9} fill="var(--muted)">{m}</text>
              </g>
            ))}
          </svg>
          <div style={{ fontSize: 10.5, color: "var(--muted)", textAlign: "right" }}>{t("risk.kpi.estimated")}: {fmt(months.reduce((s, [, v]) => s + v.est, 0))} · {t("risk.kpi.actual")}: {fmt(months.reduce((s, [, v]) => s + v.real, 0))}</div>
        </>
      )}
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "var(--muted)" }}><span style={{ width: 9, height: 9, borderRadius: "50%", background: color }} />{label}</span>;
}
function panel(): React.CSSProperties {
  return { background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 16, minWidth: 0 };
}
function PanelTitle({ icon, title, hint }: { icon: string; title: string; hint?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}><Icon name={icon} size={15} color="var(--accent)" /><span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{title}</span></span>
      {hint && <span style={{ fontSize: 10.5, color: "var(--muted)" }}>{hint}</span>}
    </div>
  );
}

const headSt: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "var(--muted)", padding: "10px 12px", background: "var(--head-bg)", whiteSpace: "nowrap" };
const cellSt: React.CSSProperties = { fontSize: 12, padding: "11px 12px", borderTop: "1px solid var(--line-soft)", color: "var(--text)", display: "flex", alignItems: "center", minWidth: 0 };
function Cell({ children, mono, accent, muted, right, sticky, style, title }: { children: React.ReactNode; mono?: boolean; accent?: boolean; muted?: boolean; right?: boolean; sticky?: boolean; style?: React.CSSProperties; title?: string }) {
  return <div title={title} style={{ ...cellSt, justifyContent: right ? "flex-end" : "flex-start", fontFamily: mono ? "var(--font-mono)" : "var(--font-ui)", color: accent ? "var(--accent-2)" : muted ? "var(--muted)" : "var(--text)", ...(sticky ? { position: "sticky", left: 0, zIndex: 1, background: "var(--card)" } : {}), ...style }}>{children}</div>;
}
function Kpi({ label, value, sub, danger, good }: { label: string; value: string; sub?: string; danger?: boolean; good?: boolean }) {
  return <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 16 }}>
    <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--muted)", marginBottom: 8 }}>{label}</div>
    <div style={{ fontFamily: "var(--font-mono)", fontWeight: 600, fontSize: 20, letterSpacing: "-0.5px", color: danger ? "var(--st-critical-fg)" : good ? "var(--st-low-fg)" : "var(--text)" }}>{value}</div>
    {sub && <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 4 }}>{sub}</div>}
  </div>;
}
