"use client";

import { useMemo, useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import type { ReportDataset, ReportResult } from "@/lib/analytics/queries";
import { fetchReport } from "@/app/(app)/analytics/actions";
import { toCsv } from "@/lib/analytics/format";
import { Icon } from "@/components/ui/icon";

const DATASETS: ReportDataset[] = ["incidents", "changes", "risk", "problems"];

export function ReportExport() {
  const { t } = useI18n();
  const [pending, start] = useTransition();
  const [dataset, setDataset] = useState<ReportDataset>("incidents");
  const [result, setResult] = useState<ReportResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [colFilters, setColFilters] = useState<Record<number, string>>({});

  function load(ds: ReportDataset) {
    setDataset(ds); setErr(null); setResult(null); setSearch(""); setColFilters({});
    start(async () => {
      const r = await fetchReport(ds);
      if ("error" in r) setErr(r.error);
      else setResult(r);
    });
  }

  // Columnas categoricas (pocos valores distintos) -> se filtran con dropdown + drill.
  const catCols = useMemo(() => {
    if (!result) return [] as { index: number; values: string[] }[];
    return result.columns.map((_, idx) => {
      const vals = new Set<string>();
      for (const row of result.rows) { const v = row[idx]; if (v != null && String(v) !== "") vals.add(String(v)); if (vals.size > 15) break; }
      return { index: idx, values: [...vals].sort() };
    }).filter((c) => c.values.length >= 2 && c.values.length <= 15);
  }, [result]);
  const catSet = useMemo(() => new Set(catCols.map((c) => c.index)), [catCols]);

  const filtered = useMemo(() => {
    if (!result) return [];
    const s = search.trim().toLowerCase();
    return result.rows.filter((row) => {
      for (const [idxStr, val] of Object.entries(colFilters)) { if (val && String(row[Number(idxStr)] ?? "") !== val) return false; }
      if (!s) return true;
      return row.some((c) => String(c ?? "").toLowerCase().includes(s));
    });
  }, [result, search, colFilters]);

  const activeChips = Object.entries(colFilters).filter(([, v]) => v);

  function download() {
    if (!result) return;
    const csv = toCsv(result.columns, filtered);
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `credixnexus-${dataset}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("an.rep.dataset")}</span>
        {DATASETS.map((ds) => (
          <button key={ds} onClick={() => load(ds)} disabled={pending}
            style={{ fontSize: 12.5, fontWeight: 600, padding: "7px 14px", borderRadius: "var(--r-pill)", cursor: "pointer",
              border: dataset === ds && result ? "1px solid var(--accent)" : "1px solid var(--line)",
              background: dataset === ds && result ? "var(--accent)" : "var(--card)", color: dataset === ds && result ? "var(--cta-fg)" : "var(--text)" }}>
            {t(("an.rep." + ds) as MessageKey)}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        {result && <button onClick={download} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, padding: "8px 16px", borderRadius: "var(--r-md)", border: "none", background: "var(--cta-bg)", color: "var(--cta-fg)", cursor: "pointer" }}><Icon name="download" size={14} /> {t("an.rep.csv")}</button>}
      </div>
      {err && <div style={{ fontSize: 12.5, color: "var(--st-critical)" }}>{err}</div>}
      {pending && <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("common.loading")}</div>}
      {!result && !pending && <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("an.rep.pick")}</div>}

      {result && (
        <>
          {/* Filtros: busqueda + dropdown por columna categorica */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("an.rep.search")}
              style={{ minWidth: 200, flex: "0 1 260px", fontSize: 12.5, padding: "7px 11px", borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: "var(--card)", color: "var(--text)" }} />
            {catCols.map((c) => (
              <label key={c.index} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--muted)", fontWeight: 600 }}>
                {result.columns[c.index]}
                <select value={colFilters[c.index] ?? ""} onChange={(e) => setColFilters((p) => ({ ...p, [c.index]: e.target.value }))}
                  style={{ fontSize: 12, padding: "6px 9px", borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: "var(--card)", color: "var(--text)", maxWidth: 170 }}>
                  <option value="">{t("md.filter.all")}</option>
                  {c.values.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </label>
            ))}
          </div>
          {(activeChips.length > 0 || search) && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              {activeChips.map(([idx, v]) => (
                <span key={idx} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, padding: "4px 6px 4px 11px", borderRadius: "var(--r-pill)", background: "var(--accent-soft)", color: "var(--accent-2)", fontWeight: 600 }}>
                  <span style={{ opacity: 0.7 }}>{result.columns[Number(idx)]}:</span> {v}
                  <button onClick={() => setColFilters((p) => { const n = { ...p }; delete n[Number(idx)]; return n; })} style={{ width: 16, height: 16, borderRadius: "50%", border: "none", background: "transparent", color: "var(--accent-2)", cursor: "pointer", fontSize: 13, lineHeight: 1 }}>×</button>
                </span>
              ))}
              <button onClick={() => { setSearch(""); setColFilters({}); }} style={{ fontSize: 11.5, fontWeight: 600, color: "var(--muted)", background: "transparent", border: "none", cursor: "pointer", textDecoration: "underline" }}>{t("inc.filter.clear")}</button>
            </div>
          )}

          <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", overflow: "hidden" }}>
            <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--line)", fontSize: 12, color: "var(--muted)" }}>{filtered.length} / {result.rows.length} {t("an.rep.rows")}</div>
            <div style={{ overflowX: "auto", maxHeight: 480, overflowY: "auto" }}>
              <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 640 }}>
                <thead>
                  <tr>{result.columns.map((c) => <th key={c} style={{ position: "sticky", top: 0, fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "#8A948A", padding: "9px 12px", background: "var(--head-bg)", textAlign: "left", whiteSpace: "nowrap" }}>{c}</th>)}</tr>
                </thead>
                <tbody>
                  {filtered.slice(0, 200).map((row, i) => (
                    <tr key={i}>{row.map((cell, j) => {
                      const drillable = catSet.has(j) && cell != null && String(cell) !== "";
                      return (
                        <td key={j} onClick={drillable ? () => setColFilters((p) => ({ ...p, [j]: String(cell) })) : undefined}
                          title={drillable ? t("inc.filter.drill") : undefined}
                          style={{ fontSize: 12, padding: "8px 12px", borderTop: "1px solid var(--line-soft)", color: "var(--text)", whiteSpace: "nowrap", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", cursor: drillable ? "pointer" : "default", textDecoration: drillable ? "underline" : "none", textDecorationColor: "var(--line)" }}>
                          {cell ?? "—"}
                        </td>
                      );
                    })}</tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filtered.length > 200 && <div style={{ padding: "8px 14px", fontSize: 11, color: "var(--muted)" }}>{t("an.rep.truncated")}</div>}
          </div>
        </>
      )}
    </div>
  );
}
