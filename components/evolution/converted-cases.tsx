"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import type { ConvertedCase } from "@/lib/evolution/queries";

type DimKey = "converted_to" | "status" | "priority" | "case_type" | "system" | "product" | "process" | "business_unit" | "channel" | "category";
const DIMS: { key: DimKey; label: MessageKey }[] = [
  { key: "converted_to", label: "cc.dim.converted" },
  { key: "status", label: "cc.dim.status" },
  { key: "priority", label: "cc.dim.priority" },
  { key: "case_type", label: "cc.dim.casetype" },
  { key: "system", label: "cc.dim.system" },
  { key: "product", label: "cc.dim.product" },
  { key: "process", label: "cc.dim.process" },
  { key: "business_unit", label: "cc.dim.bu" },
  { key: "channel", label: "cc.dim.channel" },
  { key: "category", label: "cc.dim.category" },
];
const PALETTE = ["var(--accent-2)", "var(--st-eval)", "var(--st-info)", "var(--st-medium)", "var(--st-low)", "var(--st-high)", "var(--st-critical)", "var(--muted)"];
const UNSET = "—";

export function ConvertedCasesView({ cases }: { cases: ConvertedCase[] }) {
  const { t, locale } = useI18n();
  const [groupBy, setGroupBy] = useState<DimKey>("converted_to");
  const [stackBy, setStackBy] = useState<DimKey>("status");

  const convLabel = (v: string) => t((v === "project" ? "cc.conv.project" : v === "improvement" ? "cc.conv.improvement" : "cc.conv.candidate") as MessageKey);
  const dimVal = (c: ConvertedCase, k: DimKey): string => {
    const raw = c[k];
    if (k === "converted_to") return convLabel(String(raw));
    return raw == null || String(raw).trim() === "" ? UNSET : String(raw);
  };

  const kpi = useMemo(() => ({
    total: cases.length,
    candidate: cases.filter((c) => c.converted_to === "candidate").length,
    improvement: cases.filter((c) => c.converted_to === "improvement").length,
    project: cases.filter((c) => c.converted_to === "project").length,
  }), [cases]);

  // Agrupacion primaria + desglose (stack): ambos varian con los selectores.
  const { groups, stackValues } = useMemo(() => {
    const sv = Array.from(new Set(cases.map((c) => dimVal(c, stackBy)))).sort();
    const map = new Map<string, { total: number; seg: Map<string, number>; rows: ConvertedCase[] }>();
    for (const c of cases) {
      const g = dimVal(c, groupBy);
      const s = dimVal(c, stackBy);
      const e = map.get(g) ?? { total: 0, seg: new Map<string, number>(), rows: [] as ConvertedCase[] };
      e.total += 1;
      e.seg.set(s, (e.seg.get(s) ?? 0) + 1);
      e.rows.push(c);
      map.set(g, e);
    }
    const groups = Array.from(map.entries()).map(([value, e]) => ({ value, ...e })).sort((a, b) => b.total - a.total);
    return { groups, stackValues: sv };
  }, [cases, groupBy, stackBy]); // eslint-disable-line react-hooks/exhaustive-deps

  const stackColor = (s: string) => PALETTE[stackValues.indexOf(s) % PALETTE.length];
  const maxTotal = Math.max(1, ...groups.map((g) => g.total));
  const fmtDate = (v: string | null) => (v ? new Date(v).toLocaleDateString(locale === "es" ? "es-CR" : "en-US", { day: "2-digit", month: "short", year: "2-digit" }) : "—");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Hero */}
      <div style={{ background: "var(--hero-grad)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", boxShadow: "var(--sh-card)", padding: "22px 24px" }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 22, color: "var(--text)", margin: 0 }}>{t("cc.title")}</h1>
        <p style={{ fontSize: 13, color: "var(--muted)", margin: "6px 0 0", maxWidth: 760 }}>{t("cc.subtitle")}</p>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
        <Kpi label={t("cc.kpi.total")} value={kpi.total} />
        <Kpi label={t("cc.conv.candidate")} value={kpi.candidate} />
        <Kpi label={t("cc.conv.improvement")} value={kpi.improvement} />
        <Kpi label={t("cc.conv.project")} value={kpi.project} tone="good" />
      </div>

      {/* Selectores de variables */}
      <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
        <DimPicker label={t("cc.groupby")} value={groupBy} onChange={setGroupBy} t={t} />
        <DimPicker label={t("cc.stackby")} value={stackBy} onChange={setStackBy} t={t} />
      </div>

      {/* Grafico dinamico: barras por groupBy, segmentadas por stackBy */}
      <Panel title={`${t("cc.chart")} · ${t(DIMS.find((d) => d.key === groupBy)!.label)}`} hint={t("cc.chart.hint")}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 6, marginBottom: 4 }}>
          {stackValues.map((s) => (
            <span key={s} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--muted)" }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: stackColor(s) }} />{s}
            </span>
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
          {groups.map((g) => (
            <div key={g.value} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 150, flexShrink: 0, fontSize: 12, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={g.value}>{g.value}</span>
              <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ flex: 1, display: "flex", height: 14, borderRadius: 5, overflow: "hidden", background: "var(--track, var(--paper))", width: `${(g.total / maxTotal) * 100}%`, minWidth: 2 }}>
                  {stackValues.map((s) => {
                    const v = g.seg.get(s) ?? 0;
                    return v > 0 ? <div key={s} title={`${s}: ${v}`} style={{ flex: v, background: stackColor(s), marginRight: 1 }} /> : null;
                  })}
                </div>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, color: "var(--text)", width: 26, textAlign: "right", flexShrink: 0 }}>{g.total}</span>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      {/* Tabla completa, agrupada por groupBy */}
      <Panel title={t("cc.table")} hint={t("cc.table.hint")}>
        <div style={{ overflowX: "auto", marginTop: 8 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 1080 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--muted)", borderBottom: "1px solid var(--line)" }}>
                {[t("cc.col.case"), t("cc.col.reporter"), t("cc.col.opened"), t("cc.col.status"), t("cc.col.converted"), t("cc.col.system"), t("cc.col.product"), t("cc.col.process"), t("cc.col.bu"), t("cc.col.channel"), t("cc.col.category"), t("cc.col.priority")].map((h) => (
                  <th key={h} style={{ padding: "8px 10px", fontWeight: 700, whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groups.length === 0 && <tr><td colSpan={12} style={{ padding: 24, color: "var(--muted)" }}>{t("cc.empty")}</td></tr>}
              {groups.map((g) => (
                <GroupBlock key={g.value} label={`${t(DIMS.find((d) => d.key === groupBy)!.label)}: ${g.value}`} count={g.total} rows={g.rows} convLabel={convLabel} fmtDate={fmtDate} t={t} />
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function GroupBlock({ label, count, rows, convLabel, fmtDate, t }: { label: string; count: number; rows: ConvertedCase[]; convLabel: (v: string) => string; fmtDate: (v: string | null) => string; t: (k: MessageKey) => string }) {
  return (
    <>
      <tr style={{ background: "var(--paper)" }}>
        <td colSpan={12} style={{ padding: "7px 10px", fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.4px" }}>{label} · {count}</td>
      </tr>
      {rows.map((c) => (
        <tr key={c.id} style={{ borderBottom: "1px solid var(--line-soft, var(--line))" }}>
          <Td><span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--accent-2)" }}>{c.incident_number}</span><div style={{ color: "var(--text)", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.title}</div></Td>
          <Td>{c.reporter ?? "—"}</Td>
          <Td mono>{fmtDate(c.opened_at)}</Td>
          <Td>{t(("st." + c.status) as MessageKey)}</Td>
          <Td><ConvBadge to={c.converted_to} label={convLabel(c.converted_to)} project={c.project_code} /></Td>
          <Td>{c.system ?? "—"}</Td>
          <Td>{c.product ?? "—"}</Td>
          <Td>{c.process ?? "—"}</Td>
          <Td>{c.business_unit ?? "—"}</Td>
          <Td>{c.channel ?? "—"}</Td>
          <Td>{c.category ?? "—"}</Td>
          <Td>{t(("prio." + c.priority) as MessageKey)}</Td>
        </tr>
      ))}
    </>
  );
}
function ConvBadge({ to, label, project }: { to: string; label: string; project: string | null }) {
  const bg = to === "project" ? "var(--st-low-bg)" : to === "improvement" ? "var(--accent-soft)" : "var(--paper)";
  const fg = to === "project" ? "var(--st-low-fg)" : to === "improvement" ? "var(--accent-2)" : "var(--muted)";
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: "var(--r-pill)", background: bg, color: fg, whiteSpace: "nowrap" }}>{label}{project ? ` · ${project}` : ""}</span>;
}
function Td({ children, mono }: { children: React.ReactNode; mono?: boolean }) {
  return <td style={{ padding: "8px 10px", color: "var(--text)", whiteSpace: "nowrap", fontFamily: mono ? "var(--font-mono)" : undefined }}>{children}</td>;
}
function DimPicker({ label, value, onChange, t }: { label: string; value: DimKey; onChange: (v: DimKey) => void; t: (k: MessageKey) => string }) {
  return (
    <div>
      <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.6px", textTransform: "uppercase", color: "var(--muted)", marginBottom: 7 }}>{label}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {DIMS.map((d) => (
          <button key={d.key} onClick={() => onChange(d.key)} aria-pressed={value === d.key}
            style={{ cursor: "pointer", fontSize: 12, fontWeight: value === d.key ? 700 : 500, padding: "5px 11px", borderRadius: 9, border: value === d.key ? "1px solid var(--accent)" : "1px solid var(--line)", background: value === d.key ? "var(--accent-soft)" : "var(--card)", color: value === d.key ? "var(--accent)" : "var(--text)" }}>
            {t(d.label)}
          </button>
        ))}
      </div>
    </div>
  );
}
function Kpi({ label, value, tone }: { label: string; value: number; tone?: "good" }) {
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 16 }}>
      <div style={{ fontSize: 10.5, fontWeight: 600, color: "var(--muted)", marginBottom: 8 }}>{label}</div>
      <div style={{ fontFamily: "var(--font-mono)", fontWeight: 500, fontSize: 24, letterSpacing: "-1px", color: tone === "good" ? "var(--st-low-fg)" : "var(--text)" }}>{value}</div>
    </div>
  );
}
function Panel({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 20 }}>
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, color: "var(--text)" }}>{title}</div>
      {hint && <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 4 }}>{hint}</div>}
      {children}
    </div>
  );
}
