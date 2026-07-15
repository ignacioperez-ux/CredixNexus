"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import type { Workload, MemberLoad } from "@/lib/workload/queries";

export function WorkloadView({ data }: { data: Workload }) {
  const { t } = useI18n();
  const [discipline, setDiscipline] = useState<string>("all");

  const disciplines = useMemo(() => {
    const s = new Set<string>();
    data.members.forEach((m) => m.discipline && s.add(m.discipline));
    return ["all", ...[...s]];
  }, [data.members]);

  const filtered = discipline === "all" ? data.members : data.members.filter((m) => m.discipline === discipline);
  const loaded = filtered.filter((m) => m.openIncidents > 0 || m.taskPoints > 0);
  const maxInc = Math.max(1, ...data.members.map((m) => m.openIncidents));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        <Kpi label={t("wl.kpi.incidents")} value={data.totals.openIncidents} />
        <Kpi label={t("wl.kpi.points")} value={data.totals.taskPoints} />
        <Kpi label={t("wl.kpi.loaded")} value={data.totals.membersWithLoad} />
        <Kpi label={t("wl.kpi.over")} value={data.totals.overCapacity} danger={data.totals.overCapacity > 0} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 16, alignItems: "start" }}>
        {/* Operaciones */}
        <Card title={t("wl.ops")}>
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {loaded.filter((m) => m.openIncidents > 0).length === 0 && <Empty />}
            {loaded.filter((m) => m.openIncidents > 0).map((m) => (
              <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 12.5, color: "var(--text)", width: 120, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.name}</span>
                <div style={{ flex: 1, height: 8, borderRadius: 20, background: "var(--track)", overflow: "hidden" }}>
                  <div style={{ width: `${(m.openIncidents / maxInc) * 100}%`, height: "100%", borderRadius: 20, background: "var(--st-high)" }} />
                </div>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)", width: 24, textAlign: "right" }}>{m.openIncidents}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Capacidad squad */}
        <Card title={t("wl.squadcap")}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {data.squads.map((s) => {
              const util = s.capacity_points > 0 ? (s.allocatedPoints / s.capacity_points) : 0;
              const over = util > 1;
              return (
                <div key={s.id}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4, gap: 8 }}>
                    <span style={{ color: "var(--text)", display: "inline-flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</span>
                      {s.is_transversal && <span style={{ flexShrink: 0, fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.4px", color: "var(--st-info)", background: "var(--st-info-bg)", padding: "1px 6px", borderRadius: "var(--r-pill)" }}>{t("sq.transversal")}</span>}
                    </span>
                    <span style={{ fontFamily: "var(--font-mono)", color: over ? "var(--st-critical)" : "var(--muted)", flexShrink: 0 }}>{s.allocatedPoints}/{s.capacity_points}</span>
                  </div>
                  <div style={{ height: 8, borderRadius: 20, background: "var(--track)", overflow: "hidden" }}>
                    <div style={{ width: `${Math.min(100, util * 100)}%`, height: "100%", borderRadius: 20, background: over ? "var(--st-critical)" : "var(--accent-2)" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Cruce N:N recurso × trabajo */}
      <Card title={t("wl.cross")}>
        <div style={{ marginBottom: 12 }}>
          <select value={discipline} onChange={(e) => setDiscipline(e.target.value)}
            style={{ padding: "7px 10px", borderRadius: "var(--r-sm)", border: "1px solid var(--line)", background: "var(--card)", color: "var(--text)", fontSize: 12 }}>
            {disciplines.map((d) => <option key={d} value={d}>{d === "all" ? t("wl.all") : d}</option>)}
          </select>
        </div>
        <CrossTable members={filtered} />
      </Card>
    </div>
  );
}

function CrossTable({ members }: { members: MemberLoad[] }) {
  const { t } = useI18n();
  const head: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "#8A948A", padding: "8px 10px" };
  const cell: React.CSSProperties = { fontSize: 12.5, padding: "9px 10px", borderTop: "1px solid var(--line-soft)" };
  const mono: React.CSSProperties = { ...cell, fontFamily: "var(--font-mono)", textAlign: "right" };
  return (
    <div style={{ overflowX: "auto" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1.3fr 90px 90px 90px 100px", minWidth: 820 }}>
        <div style={head}>{t("wl.member")}</div>
        <div style={head}>{t("wl.discipline")}</div>
        <div style={head}>{t("wl.squad")}</div>
        <div style={{ ...head, textAlign: "right" }}>{t("wl.openinc")}</div>
        <div style={{ ...head, textAlign: "right" }}>{t("wl.taskpoints")}</div>
        <div style={{ ...head, textAlign: "right" }}>{t("wl.capacity")}</div>
        <div style={{ ...head, textAlign: "right" }}>{t("wl.util")}</div>
        {members.map((m) => {
          const util = m.capacity_points > 0 ? Math.round((m.taskPoints / m.capacity_points) * 100) : 0;
          const over = m.taskPoints > m.capacity_points;
          return (
            <div key={m.id} style={{ display: "contents" }}>
              <div style={{ ...cell, color: "var(--text)", fontWeight: 600 }}>{m.name}</div>
              <div style={{ ...cell, color: "var(--muted)" }}>{m.discipline ?? "—"}</div>
              <div style={{ ...cell, display: "flex", flexWrap: "wrap", gap: 5, alignItems: "center" }}>
                {m.squads.length === 0 ? <span style={{ color: "var(--muted)" }}>—</span> : m.squads.map((s) => (
                  <span key={s.name} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, color: "var(--text)" }}>
                    {s.name}
                    {s.is_transversal && <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.4px", color: "var(--st-info)", background: "var(--st-info-bg)", padding: "1px 6px", borderRadius: "var(--r-pill)" }}>{t("sq.transversal")}</span>}
                  </span>
                ))}
              </div>
              <div style={mono}>{m.openIncidents}</div>
              <div style={mono}>{m.taskPoints}</div>
              <div style={mono}>{m.capacity_points}</div>
              <div style={{ ...mono, color: over ? "var(--st-critical)" : "var(--muted)" }}>{util}%</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Kpi({ label, value, danger }: { label: string; value: number; danger?: boolean }) {
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 16 }}>
      <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--muted)", marginBottom: 10 }}>{label}</div>
      <div style={{ fontFamily: "var(--font-mono)", fontWeight: 500, fontSize: 28, letterSpacing: "-1.5px", color: danger ? "var(--st-critical)" : "var(--text)" }}>{value}</div>
    </div>
  );
}
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 20 }}>
    <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, marginBottom: 16, color: "var(--text)" }}>{title}</div>{children}</div>;
}
function Empty() { return <div style={{ fontSize: 12.5, color: "var(--muted)" }}>—</div>; }
