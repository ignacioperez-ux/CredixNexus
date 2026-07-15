"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import type { Workload } from "@/lib/workload/queries";
import type { SquadCapacity } from "@/lib/capacity/queries";
import { loadTone, toneColor, toneFg } from "@/lib/capacity/compute";
import { Icon } from "@/components/ui/icon";

const CSS = `
.wl { display:flex; flex-direction:column; gap:16px; min-width:0; }
.wl .wl-card { background:var(--card); border:1px solid var(--line); border-radius:var(--r-xl); box-shadow:var(--sh-card); padding:20px; min-width:0; }
.wl .wl-kpis { display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:14px; }
.wl .wl-row2 { display:grid; grid-template-columns:minmax(0,1fr); gap:16px; align-items:start; }
@media (min-width:1280px){ .wl .wl-row2 { grid-template-columns:minmax(0,2.4fr) minmax(0,1fr); } }
.wl .wl-wrap { overflow-x:auto; margin-top:12px; }
.wl .wl-t { width:100%; border-collapse:separate; border-spacing:0; font-size:12.5px; }
.wl .wl-t th { position:sticky; top:0; background:var(--card); z-index:2; text-align:right; font-size:10.5px; font-weight:700; text-transform:uppercase; letter-spacing:.4px; color:#8A948A; padding:10px 12px; white-space:nowrap; border-bottom:1px solid var(--line); }
.wl .wl-t th.wl-first, .wl .wl-t td.wl-first { position:sticky; left:0; text-align:left; max-width:220px; overflow:hidden; text-overflow:ellipsis; }
.wl .wl-t th.wl-first { z-index:3; }
.wl .wl-t td { padding:9px 12px; text-align:right; font-family:var(--font-mono); font-variant-numeric:tabular-nums; white-space:nowrap; color:var(--text); border-bottom:1px solid var(--line-soft,var(--line)); background:var(--card); }
.wl .wl-t td.wl-first { font-family:var(--font-ui); font-weight:600; }
.wl .wl-t td.wl-l { text-align:left; font-family:var(--font-ui); }
.wl .wl-t tbody tr:nth-child(even) td { background:var(--paper); }
.wl .wl-t tbody tr:hover td { background:var(--accent-soft); }
@media (max-width:1000px){ .wl .wl-hide { display:none; } }
`;

function interp(s: string, m: Record<string, string | number>) { return s.replace(/\{(\w+)\}/g, (_, k) => String(m[k] ?? "")); }

export function WorkloadView({ data, squads }: { data: Workload; squads: SquadCapacity[] }) {
  const { t } = useI18n();
  const [discipline, setDiscipline] = useState<string>("all");

  const disciplines = useMemo(() => {
    const s = new Set<string>();
    data.members.forEach((m) => m.discipline && s.add(m.discipline));
    return ["all", ...[...s]];
  }, [data.members]);
  const rows = (discipline === "all" ? data.members : data.members.filter((m) => m.discipline === discipline))
    .slice().sort((a, b) => (b.taskPoints / Math.max(1, b.capacity_points)) - (a.taskPoints / Math.max(1, a.capacity_points)));

  // Accion sugerida (regla simple, sin IA): squad mas cargado (>100%) + squad ocioso (0%).
  const ranked = squads.filter((s) => s.capacity_points > 0).slice().sort((a, b) => (b.load_pct ?? 0) - (a.load_pct ?? 0));
  const over = ranked[0];
  const idle = ranked.slice().reverse().find((s) => (s.load_pct ?? 0) === 0);
  const suggestion = over && idle && (over.load_pct ?? 0) > 100 && over.id !== idle.id
    ? interp(t("wl.suggest"), { a: over.name, x: over.load_pct ?? 0, b: idle.name, y: idle.load_pct ?? 0 })
    : null;

  return (
    <div className="wl">
      <style>{CSS}</style>
      <div className="wl-kpis">
        <Kpi label={t("wl.kpi.incidents")} value={data.totals.openIncidents} />
        <Kpi label={t("wl.kpi.points")} value={data.totals.taskPoints} />
        <Kpi label={t("wl.kpi.loaded")} value={data.totals.membersWithLoad} />
        <Kpi label={t("wl.kpi.over")} value={data.totals.overCapacity} danger={data.totals.overCapacity > 0} />
      </div>

      {suggestion && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", background: "var(--st-high-bg, var(--paper))", border: "1px solid var(--st-high-border, var(--line))", borderRadius: 12, padding: "12px 16px" }}>
          <Icon name="alert" size={17} color="var(--st-high-fg)" style={{ flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".4px", color: "var(--st-high-fg)", marginBottom: 2 }}>{t("wl.suggest.title")}</div>
            <div style={{ fontSize: 12.5, color: "var(--text)", wordBreak: "break-word" }}>{suggestion}</div>
          </div>
          <div style={{ display: "flex", gap: 6, flexShrink: 0, flexWrap: "wrap" }}>
            {over && <Link href={`/squads/${over.id}`} style={chip}>{over.name}</Link>}
            {idle && <Link href={`/squads/${idle.id}`} style={chip}>{idle.name}</Link>}
          </div>
        </div>
      )}

      <div className="wl-row2">
        {/* Matriz unica de utilizacion (§4) */}
        <div className="wl-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, color: "var(--text)" }}>{t("wl.matrix")}</div>
              <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 4 }}>{t("wl.matrix.hint")}</div>
            </div>
            <select value={discipline} onChange={(e) => setDiscipline(e.target.value)} style={{ padding: "7px 10px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--card)", color: "var(--text)", fontSize: 12 }}>
              {disciplines.map((d) => <option key={d} value={d}>{d === "all" ? t("wl.all") : d}</option>)}
            </select>
          </div>
          <div className="wl-wrap">
            <table className="wl-t">
              <thead>
                <tr>
                  <th className="wl-first">{t("wl.member")}</th>
                  <th className="wl-l wl-hide" style={{ textAlign: "left" }}>{t("wl.squad")}</th>
                  <th className="wl-l wl-hide" style={{ textAlign: "left" }}>{t("wl.discipline")}</th>
                  <th>{t("wl.openinc")}</th>
                  <th>{t("wl.taskpoints")}</th>
                  <th className="wl-hide">{t("wl.capacity")}</th>
                  <th title={t("wl.util.def")}>{t("wl.util")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => {
                  const util = m.capacity_points > 0 ? Math.round((m.taskPoints / m.capacity_points) * 100) : 0;
                  const tone = loadTone(m.capacity_points > 0 ? util : null);
                  return (
                    <tr key={m.id}>
                      <td className="wl-first" title={m.name}>{m.name}</td>
                      <td className="wl-l wl-hide" title={m.squads.map((s) => s.name).join(", ")} style={{ color: "var(--muted)", whiteSpace: "normal" }}>{m.squads.length ? m.squads.map((s) => s.name).join(", ") : "—"}</td>
                      <td className="wl-l wl-hide" title={m.discipline ?? undefined} style={{ color: "var(--muted)", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis" }}>{m.discipline ?? "—"}</td>
                      <td>{m.openIncidents}</td>
                      <td>{m.taskPoints}</td>
                      <td className="wl-hide">{m.capacity_points}</td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
                          <div style={{ width: 64, height: 7, background: "var(--track,var(--paper))", borderRadius: 4, overflow: "hidden" }}>
                            <div style={{ width: `${Math.min(100, util)}%`, height: "100%", background: toneColor(tone), borderRadius: 4 }} />
                          </div>
                          <span style={{ color: toneFg(tone), fontWeight: 700, width: 40, textAlign: "right" }}>{m.capacity_points > 0 ? `${util}%` : "—"}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 && <tr><td colSpan={7} style={{ textAlign: "center", color: "var(--muted)", padding: 24 }}>—</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        {/* Capacidad por squad (fuente unica, navega a Squad 360) */}
        <div className="wl-card">
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, color: "var(--text)", marginBottom: 14 }}>{t("wl.squadcap")}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
            {squads.map((s) => {
              const tone = loadTone(s.load_pct);
              return (
                <Link key={s.id} href={`/squads/${s.id}`} title={s.name} style={{ textDecoration: "none", display: "block" }}>
                  {/* Dos lineas: nombre completo arriba (nunca se trunca sin tooltip), carga + barra abajo. */}
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text)", marginBottom: 5, lineHeight: 1.25, wordBreak: "break-word" }}>{s.name}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0, height: 8, borderRadius: 4, background: "var(--track,var(--paper))", overflow: "hidden" }}>
                      <div style={{ width: `${Math.min(100, s.load_pct ?? 0)}%`, height: "100%", borderRadius: 4, background: toneColor(tone) }} />
                    </div>
                    <span style={{ fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums", fontSize: 11.5, color: toneFg(tone), fontWeight: 700, flexShrink: 0 }}>{s.demand_points}/{s.capacity_points} · {s.load_pct ?? "—"}%</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

const chip: React.CSSProperties = { fontSize: 11.5, fontWeight: 600, color: "var(--accent-2)", background: "var(--card)", border: "1px solid var(--line)", borderRadius: 8, padding: "5px 10px", textDecoration: "none", whiteSpace: "nowrap" };

function Kpi({ label, value, danger }: { label: string; value: number; danger?: boolean }) {
  return (
    <div className="wl-card" style={{ padding: 16 }}>
      <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--muted)", marginBottom: 10 }}>{label}</div>
      <div style={{ fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums", fontWeight: 500, fontSize: 28, letterSpacing: "-1.5px", color: danger ? "var(--st-critical-fg)" : "var(--text)" }}>{value}</div>
    </div>
  );
}
