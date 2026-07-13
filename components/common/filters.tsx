"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { Icon } from "@/components/ui/icon";

/** Estado vacio ilustrado y util para listas (icono + mensaje + pista opcional). */
export function EmptyState({ text, hint, icon = "inbox" }: { text: string; hint?: string; icon?: string }) {
  return (
    <div className="cx-empty">
      <Icon name={icon} size={34} strokeWidth={1.4} />
      <div className="t">{text}</div>
      {hint && <div className="h">{hint}</div>}
    </div>
  );
}

// Kit de filtros + drill-down reutilizable para listas. Las opciones se derivan
// de los datos reales (cero hardcode). Un filtro activo se muestra como chip con
// "x" para volver al listado mas amplio.

export type FilterDef<T> = {
  key: string;
  label: string;                          // etiqueta ya traducida
  get: (row: T) => string | null | undefined;  // valor para coincidencia y opciones
  render?: (v: string) => string;         // transforma el valor a texto visible (enums)
  allLabel: string;                       // opcion "todas"
};

export type ListFilters<T> = {
  values: Record<string, string>;
  set: (key: string, v: string) => void;
  clearAll: () => void;
  filtered: T[];
  options: (def: FilterDef<T>) => string[];
  chips: { label: string; value: string; clear: () => void }[];
  active: boolean;
};

export function useListFilters<T>(rows: T[], defs: FilterDef<T>[], initial?: Record<string, string>): ListFilters<T> {
  const [values, setValues] = useState<Record<string, string>>(initial ?? {});
  const set = (key: string, v: string) => setValues((p) => ({ ...p, [key]: v }));
  const clearAll = () => setValues({});

  const filtered = useMemo(
    () => rows.filter((r) => defs.every((d) => !values[d.key] || d.get(r) === values[d.key])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, values],
  );

  const options = (def: FilterDef<T>) =>
    [...new Set(rows.map(def.get).filter((v): v is string => !!v))].sort((a, b) => a.localeCompare(b));

  const chips = defs
    .filter((d) => values[d.key])
    .map((d) => ({
      label: d.label,
      value: d.render ? d.render(values[d.key]) : values[d.key],
      clear: () => setValues((p) => { const n = { ...p }; delete n[d.key]; return n; }),
    }));

  return { values, set, clearAll, filtered, options, chips, active: chips.length > 0 };
}

/** Barra de filtros: un dropdown por campo + chips de filtro activo + limpiar. */
export function FilterBar<T>({ defs, filters }: { defs: FilterDef<T>[]; filters: ListFilters<T> }) {
  const { t } = useI18n();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        {defs.map((d) => (
          <label key={d.key} style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 11.5, color: "var(--muted)", fontWeight: 600 }}>
            {d.label}
            <select value={filters.values[d.key] ?? ""} onChange={(e) => filters.set(d.key, e.target.value)}
              style={{ fontSize: 12, padding: "6px 10px", borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: "var(--card)", color: "var(--text)", fontFamily: "var(--font-ui)", maxWidth: 210 }}>
              <option value="">{d.allLabel}</option>
              {filters.options(d).map((o) => <option key={o} value={o}>{d.render ? d.render(o) : o}</option>)}
            </select>
          </label>
        ))}
      </div>
      {filters.active && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {filters.chips.map((c, i) => (
            <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, padding: "4px 6px 4px 11px", borderRadius: "var(--r-pill)", background: "var(--accent-soft)", color: "var(--accent-2)", fontWeight: 600 }}>
              <span style={{ opacity: 0.7 }}>{c.label}:</span> {c.value}
              <button onClick={c.clear} aria-label="quitar filtro"
                style={{ display: "inline-flex", width: 16, height: 16, alignItems: "center", justifyContent: "center", borderRadius: "50%", border: "none", background: "transparent", color: "var(--accent-2)", cursor: "pointer", fontSize: 13, lineHeight: 1 }}>×</button>
            </span>
          ))}
          <button onClick={filters.clearAll} style={{ fontSize: 11.5, fontWeight: 600, color: "var(--muted)", background: "transparent", border: "none", cursor: "pointer", textDecoration: "underline" }}>{t("inc.filter.clear")}</button>
        </div>
      )}
    </div>
  );
}

// ---- Agrupacion reutilizable -------------------------------------------------
// Agrupa filas por un campo (normalmente derivado de un maestro: estado, responsable,
// aplicacion, producto...). Devuelve grupos con etiqueta + conteo, o null si no hay agrupacion.

export type GroupDef<T> = {
  key: string;
  label: string;                               // etiqueta traducida (para el selector)
  get: (row: T) => string | null | undefined;  // valor de agrupacion
  render?: (v: string) => string;              // valor -> texto visible (enums)
};

export type Group<T> = { value: string; label: string; rows: T[] };

export function useGrouping<T>(rows: T[], defs: GroupDef<T>[]) {
  const [groupKey, setGroupKey] = useState("");
  const active = defs.find((d) => d.key === groupKey) ?? null;
  const groups = useMemo<Group<T>[] | null>(() => {
    if (!active) return null;
    const map = new Map<string, T[]>();
    for (const r of rows) {
      const raw = active.get(r);
      const k = raw == null || raw === "" ? "—" : raw;
      const arr = map.get(k);
      if (arr) arr.push(r); else map.set(k, [r]);
    }
    return [...map.entries()]
      .sort((a, b) => (a[0] === "—" ? 1 : b[0] === "—" ? -1 : a[0].localeCompare(b[0])))
      .map(([value, items]) => ({ value, label: active.render && value !== "—" ? active.render(value) : value, rows: items }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, active]);
  return { groupKey, setGroupKey, groups, defs };
}

/** Selector "Agrupar por" (un dropdown). allLabel = opcion "sin agrupar". */
export function GroupBar<T>({ defs, groupKey, setGroupKey, allLabel, label }: { defs: GroupDef<T>[]; groupKey: string; setGroupKey: (v: string) => void; allLabel: string; label: string }) {
  return (
    <label style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 11.5, color: "var(--muted)", fontWeight: 600 }}>
      {label}
      <select value={groupKey} onChange={(e) => setGroupKey(e.target.value)}
        style={{ fontSize: 12, padding: "6px 10px", borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: "var(--card)", color: "var(--text)", fontFamily: "var(--font-ui)", maxWidth: 210 }}>
        <option value="">{allLabel}</option>
        {defs.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
      </select>
    </label>
  );
}

/** Encabezado de grupo (fila de titulo con conteo) para intercalar en tablas agrupadas. */
export function GroupHeader({ label, count }: { label: string; count: number }) {
  return (
    <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", background: "var(--head-bg)", borderTop: "1px solid var(--line)" }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>{label}</span>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)" }}>{count}</span>
    </div>
  );
}

/** Valor de campo clickeable: hace drill-down (aplica el filtro) sin propagar el clic. */
export function Drill({ onClick, children, mono }: { onClick: () => void; children: React.ReactNode; mono?: boolean }) {
  const { t } = useI18n();
  return (
    <span
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClick(); }}
      title={t("inc.filter.drill")}
      style={{ cursor: "pointer", textDecorationLine: "underline", textDecorationColor: "var(--line)", textUnderlineOffset: 3, fontFamily: mono ? "var(--font-mono)" : undefined }}
    >
      {children}
    </span>
  );
}
