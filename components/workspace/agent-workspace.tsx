"use client";

import { Icon } from "@/components/ui/icon";

import Link from "next/link";
import { useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import type { Workspace, WsCase } from "@/lib/workspace/queries";
import { StatusPill, PriorityTag } from "@/components/incidents/badges";

type QueueKey = keyof Workspace["buckets"];

const QUEUES: { key: QueueKey; label: MessageKey; danger?: boolean }[] = [
  { key: "myCases", label: "ws.q.mine" },
  { key: "unassigned", label: "ws.q.unassigned" },
  { key: "critical", label: "ws.q.critical", danger: true },
  { key: "slaAtRisk", label: "ws.q.slarisk", danger: true },
  { key: "pendingTriage", label: "ws.q.triage" },
  { key: "reopened", label: "ws.q.reopened" },
  { key: "sensitive", label: "ws.q.sensitive" },
  { key: "highImpact", label: "ws.q.impact" },
];

export function AgentWorkspace({ ws }: { ws: Workspace }) {
  const { t, locale } = useI18n();
  const [active, setActive] = useState<QueueKey>("myCases");
  const fmt = (n: number) => new Intl.NumberFormat(locale === "es" ? "es-CR" : "en-US", { style: "currency", currency: "CRC", maximumFractionDigits: 0 }).format(n);
  const cases = ws.buckets[active];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("ws.intro")}</div>

      {/* Colas como tarjetas seleccionables */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
        {QUEUES.map((q) => {
          const n = ws.counts[q.key] ?? 0;
          const sel = active === q.key;
          const danger = q.danger && n > 0;
          return (
            <button key={q.key} onClick={() => setActive(q.key)}
              style={{ textAlign: "left", cursor: "pointer", background: "var(--card)", border: sel ? "1px solid var(--accent)" : "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 14, boxShadow: sel ? "0 0 0 2px var(--accent-soft)" : "none" }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", marginBottom: 8 }}>{t(q.label)}</div>
              <div style={{ fontFamily: "var(--font-mono)", fontWeight: 500, fontSize: 24, letterSpacing: "-1px", color: danger ? "var(--st-critical-fg)" : "var(--text)" }}>{n}</div>
            </button>
          );
        })}
      </div>

      {/* Lista de la cola activa */}
      <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", overflow: "hidden" }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, color: "var(--text)" }}>{t(QUEUES.find((q) => q.key === active)!.label)}</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)" }}>{ws.counts[active]}</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "120px 1.6fr 150px 104px 120px 120px", minWidth: 860 }}>
            {[t("inc.col.number"), t("inc.col.title"), t("inc.col.app"), t("inc.col.priority"), t("ws.col.sla"), t("inc.col.status")].map((h) => (
              <div key={h} style={head}>{h}</div>
            ))}
            {cases.length === 0 && <div style={{ gridColumn: "1 / -1", padding: 36, textAlign: "center", color: "var(--muted)" }}>{t("ws.empty")}</div>}
            {cases.map((c) => <Row key={c.id} c={c} fmt={fmt} locale={locale} highImpact={active === "highImpact"} />)}
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ c, fmt, locale, highImpact }: { c: WsCase; fmt: (n: number) => string; locale: string; highImpact: boolean }) {
  const overdue = c.sla_resolution_due_at && new Date(c.sla_resolution_due_at).getTime() < Date.now() && !c.resolved_at;
  return (
    <Link href={`/incidents/${c.id}`} style={{ display: "contents", textDecoration: "none" }}>
      <Cell mono accent>{c.incident_number}</Cell>
      <Cell>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.title}</span>
        {(c.sensitive_flag || c.pii_flag) && <span style={{ color: "var(--st-high-fg)", marginLeft: 8, flexShrink: 0, display: "inline-flex" }}><Icon name="lock" size={12} /></span>}
      </Cell>
      <Cell muted>{highImpact ? fmt(c.financial_impact_estimate) : (c.ci?.name ?? "—")}</Cell>
      <Cell><PriorityTag priority={c.priority} /></Cell>
      <Cell mono style={overdue ? { color: "var(--st-critical)" } : { color: "var(--muted)" }}>
        {c.sla_resolution_due_at ? new Date(c.sla_resolution_due_at).toLocaleDateString(locale) : "—"}{overdue ? <Icon name="alert" size={12} color="var(--st-critical)" style={{ marginLeft: 4, verticalAlign: "-2px" }} /> : ""}
      </Cell>
      <Cell><StatusPill status={c.status} /></Cell>
    </Link>
  );
}

const head: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "#8A948A", padding: "10px 12px", background: "var(--head-bg)" };
const cellSt: React.CSSProperties = { fontSize: 12.5, padding: "11px 12px", borderTop: "1px solid var(--line-soft)", display: "flex", alignItems: "center", color: "var(--text)", minWidth: 0 };
function Cell({ children, mono, accent, muted, style }: { children: React.ReactNode; mono?: boolean; accent?: boolean; muted?: boolean; style?: React.CSSProperties }) {
  return <div style={{ ...cellSt, fontFamily: mono ? "var(--font-mono)" : "var(--font-ui)", color: accent ? "var(--accent-2)" : muted ? "var(--muted)" : "var(--text)", ...style }}>{children}</div>;
}
