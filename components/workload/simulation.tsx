"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import type { SimulationInputs } from "@/lib/workload/simulation";

const RESOURCE_CAP = 8; // capacidad de referencia por recurso/sprint (team_member default)

export function Simulation({ inputs }: { inputs: SimulationInputs }) {
  const { t } = useI18n();
  const [horizon, setHorizon] = useState(4);
  const [extraPct, setExtraPct] = useState(0);
  const [includeActive, setIncludeActive] = useState(true);

  const result = useMemo(() => {
    const backlog = inputs.backlog.filter((b) => includeActive || b.status !== "active");
    const perSquad = inputs.squads.map((s) => {
      const items = backlog.filter((b) => b.squadId === s.id);
      const demand = items.reduce((sum, i) => sum + i.size, 0);
      const capPerSprint = s.capacity * (1 + extraPct / 100);
      const capHorizon = capPerSprint * horizon;
      const gap = Math.max(0, demand - capHorizon);
      const sprints = capPerSprint > 0 ? Math.ceil(demand / capPerSprint) : Infinity;
      return { id: s.id, name: s.name, demand, capHorizon: Math.round(capHorizon), gap: Math.round(gap), sprints, items: items.length };
    });
    const totalGap = perSquad.reduce((sum, s) => sum + s.gap, 0);
    const totalDemand = perSquad.reduce((sum, s) => sum + s.demand, 0);
    const totalCap = perSquad.reduce((sum, s) => sum + s.capHorizon, 0);
    const extraResources = Math.ceil(totalGap / (RESOURCE_CAP * horizon));
    return { perSquad, totalGap, totalDemand, totalCap, extraResources };
  }, [inputs, horizon, extraPct, includeActive]);

  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 20 }}>
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, color: "var(--text)" }}>{t("sim.title")}</div>
      <p style={{ margin: "4px 0 16px", fontSize: 12, color: "var(--muted)" }}>{t("sim.help")}</p>

      {/* Controles */}
      <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 18, alignItems: "center" }}>
        <label style={ctrl}>
          <span style={ctrlLbl}>{t("sim.horizon")}: <b style={{ fontFamily: "var(--font-mono)" }}>{horizon}</b></span>
          <input type="range" min={1} max={8} value={horizon} onChange={(e) => setHorizon(Number(e.target.value))} />
        </label>
        <label style={ctrl}>
          <span style={ctrlLbl}>{t("sim.extracap")}: <b style={{ fontFamily: "var(--font-mono)" }}>{extraPct}%</b></span>
          <input type="range" min={0} max={100} step={10} value={extraPct} onChange={(e) => setExtraPct(Number(e.target.value))} />
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--text)", cursor: "pointer" }}>
          <input type="checkbox" checked={includeActive} onChange={(e) => setIncludeActive(e.target.checked)} />
          {t("sim.include_active")}
        </label>
      </div>

      {/* Necesidad de recursos */}
      <div style={{ borderRadius: "var(--r-lg)", padding: "14px 16px", marginBottom: 18,
        background: result.totalGap > 0 ? "var(--st-critical-bg)" : "var(--st-low-bg)",
        border: `1px solid ${result.totalGap > 0 ? "var(--st-critical)" : "var(--st-low)"}` }}>
        <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: result.totalGap > 0 ? "var(--st-critical-fg)" : "var(--st-low-fg)", marginBottom: 6 }}>
          {t("sim.needs_title")}
        </div>
        {result.totalGap > 0 ? (
          <div style={{ fontSize: 13.5, color: "var(--text)" }}>
            <b style={{ fontFamily: "var(--font-mono)", fontSize: 22, color: "var(--st-critical)" }}>+{result.extraResources}</b> {t("sim.needs_resources")} · {t("sim.gap")}: <b style={{ fontFamily: "var(--font-mono)" }}>{result.totalGap}</b>
          </div>
        ) : (
          <div style={{ fontSize: 13, color: "var(--st-low-fg)" }}>✓ {t("sim.needs_none")}</div>
        )}
      </div>

      {/* Por squad */}
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 90px 90px 90px 120px", gap: 0 }}>
        {[t("sim.squad"), t("sim.demand"), t("sim.capacity"), t("sim.gap"), t("sim.sprints")].map((h, i) => (
          <div key={h} style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "#8A948A", padding: "8px 10px", textAlign: i === 0 ? "left" : "right" }}>{h}</div>
        ))}
        {result.perSquad.map((s) => {
          const over = s.gap > 0;
          const util = s.capHorizon > 0 ? Math.min(100, (s.demand / s.capHorizon) * 100) : 100;
          return (
            <div key={s.id} style={{ display: "contents" }}>
              <div style={{ padding: "10px", borderTop: "1px solid var(--line-soft)" }}>
                <div style={{ fontSize: 12.5, color: "var(--text)", fontWeight: 600, marginBottom: 5 }}>{s.name}</div>
                <div style={{ height: 6, borderRadius: 20, background: "var(--track)", overflow: "hidden" }}>
                  <div style={{ width: `${util}%`, height: "100%", borderRadius: 20, background: over ? "var(--st-critical)" : "var(--accent-2)" }} />
                </div>
              </div>
              <Cell v={s.demand} />
              <Cell v={s.capHorizon} />
              <Cell v={s.gap} danger={over} />
              <div style={{ padding: "10px", borderTop: "1px solid var(--line-soft)", textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 12, color: over ? "var(--st-critical)" : "var(--muted)" }}>
                {s.sprints > horizon || !isFinite(s.sprints) ? `>${horizon} · ${t("sim.overflow")}` : s.sprints}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Cell({ v, danger }: { v: number; danger?: boolean }) {
  return <div style={{ padding: "10px", borderTop: "1px solid var(--line-soft)", textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 12.5, color: danger ? "var(--st-critical)" : "var(--text)" }}>{v}</div>;
}
const ctrl: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 4 };
const ctrlLbl: React.CSSProperties = { fontSize: 12, color: "var(--muted)" };
