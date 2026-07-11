"use client";

import { useMemo } from "react";
import { useI18n } from "@/lib/i18n/provider";
import type { IncidentRow } from "@/lib/incidents/queries";
import { priorityKey, priorityColor } from "@/lib/incidents/labels";

const PRIORITIES = ["p1_critical", "p2_high", "p3_medium", "p4_low"];

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 20 }}>
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, color: "var(--text)", marginBottom: 16 }}>{title}</div>
      {children}
    </div>
  );
}

export function IncidentStats({ rows }: { rows: IncidentRow[] }) {
  const { t } = useI18n();

  const byPriority = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(r.priority, (m.get(r.priority) ?? 0) + 1);
    return PRIORITIES.map((p) => ({ p, n: m.get(p) ?? 0 }));
  }, [rows]);

  const byCategory = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) {
      const name = r.category?.name ?? "—";
      m.set(name, (m.get(name) ?? 0) + 1);
    }
    return [...m.entries()].map(([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n).slice(0, 6);
  }, [rows]);

  const total = rows.length || 1;
  const candidates = rows.filter((r) => r.transformation_candidate).length;
  const catMax = Math.max(1, ...byCategory.map((c) => c.n));

  // Donut por prioridad (conic-gradient)
  let acc = 0;
  const segments = byPriority.map(({ p, n }) => {
    const start = (acc / total) * 360;
    acc += n;
    const end = (acc / total) * 360;
    return `${priorityColor(p)} ${start}deg ${end}deg`;
  });

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr 0.8fr", gap: 16, marginBottom: 16 }}>
      <Card title={t("inc.col.priority")}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: "50%",
              background: `conic-gradient(${segments.join(", ")})`,
              flexShrink: 0,
              display: "grid",
              placeItems: "center",
            }}
          >
            <div style={{ width: 60, height: 60, borderRadius: "50%", background: "var(--card)", display: "grid", placeItems: "center" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 20, fontWeight: 500, color: "var(--text)" }}>{rows.length}</span>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {byPriority.map(({ p, n }) => (
              <div key={p} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                <span style={{ width: 9, height: 9, borderRadius: 3, background: priorityColor(p) }} />
                <span style={{ color: "var(--muted)", minWidth: 54 }}>{t(priorityKey(p))}</span>
                <span style={{ fontFamily: "var(--font-mono)", color: "var(--text)" }}>{n}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <Card title={t("inc.col.category")}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {byCategory.map((c) => (
            <div key={c.name} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 12, color: "var(--text)", width: 150, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</span>
              <div style={{ flex: 1, height: 7, borderRadius: 20, background: "var(--track)", overflow: "hidden" }}>
                <div style={{ width: `${(c.n / catMax) * 100}%`, height: "100%", borderRadius: 20, background: "var(--accent-2)" }} />
              </div>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)", width: 20, textAlign: "right" }}>{c.n}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card title={t("inc.evolution.candidate")}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 30, fontWeight: 500, color: "var(--accent-2)", letterSpacing: "-1.5px" }}>
          {candidates}
        </div>
        <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>
          {candidates} / {rows.length} → {t("inc.section.evolution")}
        </div>
      </Card>
    </div>
  );
}
