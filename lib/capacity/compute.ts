import type { SquadCapacity } from "./queries";

// Helpers puros compartidos por todo el bloque "Ejecucion y Capacidad" (§1). Umbrales de color
// UNIVERSALES: verde < 85% · ambar 85-100% · rojo > 100%.
export type Tone = "idle" | "ok" | "warn" | "crit";

export function loadTone(pct: number | null): Tone {
  if (pct == null) return "idle";
  if (pct > 100) return "crit";
  if (pct >= 85) return "warn";
  return "ok";
}
export function toneColor(tone: Tone): string {
  return tone === "crit" ? "var(--st-critical)" : tone === "warn" ? "var(--st-high)" : tone === "ok" ? "var(--st-low)" : "var(--muted)";
}
export function toneFg(tone: Tone): string {
  return tone === "crit" ? "var(--st-critical-fg)" : tone === "warn" ? "var(--st-high-fg)" : tone === "ok" ? "var(--st-low-fg)" : "var(--muted)";
}

export type TribeCapacity = { id: string; name: string; code: string; capacity_points: number; demand_points: number; load_pct: number | null; over: boolean; fte: number; squads: number };
export function tribeCapacities(squads: SquadCapacity[]): TribeCapacity[] {
  const map = new Map<string, TribeCapacity>();
  for (const s of squads) {
    if (!s.tribe_id) continue;
    const e = map.get(s.tribe_id) ?? { id: s.tribe_id, name: s.tribe_name ?? "—", code: s.tribe_code ?? "", capacity_points: 0, demand_points: 0, load_pct: null, over: false, fte: 0, squads: 0 };
    e.capacity_points += s.capacity_points; e.demand_points += s.demand_points; e.fte += s.fte; e.squads += 1;
    map.set(s.tribe_id, e);
  }
  return Array.from(map.values()).map((e) => {
    const pct = e.capacity_points > 0 ? Math.round((e.demand_points / e.capacity_points) * 100) : null;
    return { ...e, load_pct: pct, over: pct != null && pct > 100, fte: Math.round(e.fte * 10) / 10 };
  }).sort((a, b) => (b.load_pct ?? -1) - (a.load_pct ?? -1));
}
