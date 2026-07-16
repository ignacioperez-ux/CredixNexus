"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import { Icon } from "@/components/ui/icon";
import { PriorityTag, StatusPill } from "@/components/incidents/badges";
import { SlaStatusInline } from "@/components/sla/sla-status";
import type { QueueCase } from "@/lib/operador/queries";

const PRIO_COLOR: Record<string, string> = { p1_critical: "var(--st-critical-fg)", p2_high: "var(--st-high-fg)", p3_medium: "var(--st-medium-fg)", p4_low: "var(--st-low-fg)" };

export function OpQueueView({ queue }: { queue: { unassigned: QueueCase[]; others: QueueCase[] } }) {
  const { t } = useI18n();
  const [tab, setTab] = useState<"unassigned" | "others">("unassigned");
  const list = tab === "unassigned" ? queue.unassigned : queue.others;
  const byPrio = ["p1_critical", "p2_high", "p3_medium", "p4_low"].map((k) => ({ key: k, count: list.filter((c) => c.priority === k).length })).filter((x) => x.count > 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 1320 }}>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: "var(--text)", margin: 0 }}>{t("nav.colaequipo")}</h1>

      {/* Banner permanente de solo lectura */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", borderRadius: "var(--r-md)", background: "var(--st-info-bg)", color: "var(--st-info)", fontSize: 12.5 }}>
        <Icon name="lock" size={14} color="var(--st-info)" /> {t("op.queue.banner")}
      </div>

      {/* Toggle secciones */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {(["unassigned", "others"] as const).map((k) => {
          const active = tab === k; const n = k === "unassigned" ? queue.unassigned.length : queue.others.length;
          return (
            <button key={k} onClick={() => setTab(k)}
              style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 13px", borderRadius: "var(--r-pill)", cursor: "pointer", border: active ? "1px solid var(--accent)" : "1px solid var(--line)", background: active ? "var(--accent-soft)" : "var(--card)", color: active ? "var(--accent-2)" : "var(--muted)", fontSize: 12.5, fontWeight: 600 }}>
              {t(("op.queue." + k) as MessageKey)}<span style={{ fontFamily: "var(--font-mono)", opacity: 0.7 }}>{n}</span>
            </button>
          );
        })}
      </div>

      {/* Donut por prioridad (visual) */}
      {byPrio.length > 0 && (
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "center", background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 16 }}>
          <Donut data={byPrio} />
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {byPrio.map((d) => <span key={d.key} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--muted)" }}><span style={{ width: 10, height: 10, borderRadius: 2, background: PRIO_COLOR[d.key] }} />{t(("prio." + d.key) as MessageKey)} <b style={{ color: "var(--text)", fontFamily: "var(--font-mono)" }}>{d.count}</b></span>)}
          </div>
        </div>
      )}

      {/* Tabla ligera de SOLO LECTURA (sin acciones, cursor default) */}
      <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "110px minmax(180px,1.5fr) 90px 96px 160px 190px", minWidth: 900 }}>
            {[t("inc.col.number"), t("inc.col.title"), t("inc.col.priority"), t("inc.col.status"), t("flt.responsible"), t("inc.col.sla")].map((h) => <div key={h} style={head}>{h}</div>)}
            {list.length === 0 && <div style={{ gridColumn: "1 / -1", padding: 32, textAlign: "center", color: "var(--muted)", fontSize: 12.5 }}>{t("op.queue.empty")}</div>}
            {list.map((c) => (
              <div key={c.id} style={{ display: "contents" }}>
                <Cell mono muted>{c.number}</Cell>
                <Cell title={c.title}>{c.title}</Cell>
                <Cell><PriorityTag priority={c.priority} /></Cell>
                <Cell><StatusPill status={c.status} /></Cell>
                <Cell muted>{c.owner ? <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Avatar name={c.owner} /> {c.owner}</span> : <span style={{ fontStyle: "italic", opacity: 0.7 }}>{t("op.queue.nobody")}</span>}</Cell>
                <Cell><SlaStatusInline openedAt={c.opened_at} dueAt={c.resoDueAt} resolvedAt={c.resolved_at} status={c.status} /></Cell>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Donut({ data }: { data: { key: string; count: number }[] }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  let acc = 0; const R = 34, C = 2 * Math.PI * R;
  return (
    <svg width={84} height={84} viewBox="0 0 84 84">
      <circle cx={42} cy={42} r={R} fill="none" stroke="var(--track)" strokeWidth={12} />
      {data.map((d) => { const frac = d.count / total, dash = frac * C, off = -acc * C; acc += frac; return <circle key={d.key} cx={42} cy={42} r={R} fill="none" stroke={PRIO_COLOR[d.key]} strokeWidth={12} strokeDasharray={`${dash} ${C - dash}`} strokeDashoffset={off} transform="rotate(-90 42 42)" />; })}
      <text x={42} y={47} textAnchor="middle" fontSize={18} fontWeight={800} fill="var(--text)" fontFamily="var(--font-mono)">{total}</text>
    </svg>
  );
}
function Avatar({ name }: { name: string }) {
  const ini = name.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  return <span style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--paper)", color: "var(--text)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 9.5, fontWeight: 700 }}>{ini}</span>;
}
const head: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "var(--muted)", padding: "10px 12px", background: "var(--head-bg)", whiteSpace: "nowrap" };
const cellSt: React.CSSProperties = { fontSize: 12.5, padding: "11px 12px", borderTop: "1px solid var(--line-soft)", display: "flex", alignItems: "center", color: "var(--text)", minWidth: 0, cursor: "default" };
function Cell({ children, mono, muted, title }: { children: React.ReactNode; mono?: boolean; muted?: boolean; title?: string }) {
  return <div title={title} style={{ ...cellSt, fontFamily: mono ? "var(--font-mono)" : "var(--font-ui)", color: muted ? "var(--muted)" : "var(--text)", ...(title ? { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block", lineHeight: "2" } : {}) }}>{children}</div>;
}
