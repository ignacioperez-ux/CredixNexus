"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import { Icon } from "@/components/ui/icon";
import { PriorityTag, StatusPill } from "@/components/incidents/badges";
import { SlaStatusInline } from "@/components/sla/sla-status";
import { EmptyState } from "@/components/common/filters";
import type { OpCase } from "@/lib/operador/queries";

const OPEN = ["new", "triaged", "assigned", "in_progress", "waiting", "reopened"];
type Quick = "active" | "duetoday" | "overdue" | "waiting" | "resolved30";

export function OpCasesView({ cases, linked }: { cases: OpCase[]; linked: boolean }) {
  const { t, locale } = useI18n();
  const [quick, setQuick] = useState<Quick>("active");
  const [q, setQ] = useState("");
  const now = Date.now();

  const counts = useMemo(() => ({
    active: cases.filter((c) => OPEN.includes(c.status)).length,
    duetoday: cases.filter((c) => !c.settled && c.dueAt && Date.parse(c.dueAt) <= endOfToday() && c.overdueMs == null).length,
    overdue: cases.filter((c) => c.overdueMs != null).length,
    waiting: cases.filter((c) => c.status === "waiting").length,
    resolved30: cases.filter((c) => c.resolved_at && now - Date.parse(c.resolved_at) <= 30 * 86_400_000).length,
  }), [cases, now]);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return cases.filter((c) => {
      const okQuick = quick === "active" ? OPEN.includes(c.status)
        : quick === "duetoday" ? (!c.settled && c.dueAt && Date.parse(c.dueAt) <= endOfToday() && c.overdueMs == null)
        : quick === "overdue" ? c.overdueMs != null
        : quick === "waiting" ? c.status === "waiting"
        : (c.resolved_at != null && now - Date.parse(c.resolved_at) <= 30 * 86_400_000);
      return okQuick && (!term || c.number.toLowerCase().includes(term) || c.title.toLowerCase().includes(term));
    });
  }, [cases, quick, q, now]);

  if (!linked) return <div style={{ padding: "60px 20px", textAlign: "center", color: "var(--muted)" }}>{t("op.nomember.hint")}</div>;

  const CHIPS: { k: Quick; n: number }[] = [
    { k: "active", n: counts.active }, { k: "duetoday", n: counts.duetoday }, { k: "overdue", n: counts.overdue }, { k: "waiting", n: counts.waiting }, { k: "resolved30", n: counts.resolved30 },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 1320 }}>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: "var(--text)", margin: 0 }}>{t("nav.miscasos")}</h1>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {CHIPS.map(({ k, n }) => {
          const active = quick === k;
          return (
            <button key={k} onClick={() => setQuick(k)}
              style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 12px", borderRadius: "var(--r-pill)", cursor: "pointer", border: active ? "1px solid var(--accent)" : "1px solid var(--line)", background: active ? "var(--accent-soft)" : "var(--card)", color: active ? "var(--accent-2)" : "var(--muted)", fontSize: 12.5, fontWeight: 600 }}>
              {t(("op.quick." + k) as MessageKey)}<span style={{ fontFamily: "var(--font-mono)", opacity: 0.7 }}>{n}</span>
            </button>
          );
        })}
        <div style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 10px", borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: "var(--card)" }}>
          <Icon name="search" size={13} color="var(--muted)" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("op.search")} style={{ border: "none", outline: "none", background: "transparent", color: "var(--text)", fontSize: 12.5, width: 180 }} />
        </div>
      </div>

      <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "110px minmax(180px,1.5fr) 92px 96px 190px 130px", minWidth: 900 }}>
            {[t("inc.col.number"), t("inc.col.title"), t("inc.col.priority"), t("inc.col.status"), t("inc.col.sla"), t("inc.col.app")].map((h) => <div key={h} style={head}>{h}</div>)}
            {rows.length === 0 && <EmptyState text={t("op.cases.empty")} icon="inbox" />}
            {rows.map((c) => (
              <Link key={c.id} href={`/incidents/${c.id}`} className="cx-row" style={{ display: "contents", textDecoration: "none" }}>
                <Cell mono accent>{c.number}</Cell>
                <Cell title={c.title}>{c.title}</Cell>
                <Cell><PriorityTag priority={c.priority} /></Cell>
                <Cell><StatusPill status={c.status} /></Cell>
                <Cell><SlaStatusInline openedAt={c.opened_at} dueAt={c.resoDueAt} resolvedAt={c.resolved_at} status={c.status} /></Cell>
                <Cell muted>{c.app ?? "—"}</Cell>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function endOfToday(): number { const d = new Date(); d.setHours(23, 59, 59, 999); return d.getTime(); }
const head: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "var(--muted)", padding: "10px 12px", background: "var(--head-bg)", whiteSpace: "nowrap" };
const cellSt: React.CSSProperties = { fontSize: 12.5, padding: "11px 12px", borderTop: "1px solid var(--line-soft)", display: "flex", alignItems: "center", color: "var(--text)", minWidth: 0 };
function Cell({ children, mono, accent, muted, title }: { children: React.ReactNode; mono?: boolean; accent?: boolean; muted?: boolean; title?: string }) {
  return <div title={title} style={{ ...cellSt, fontFamily: mono ? "var(--font-mono)" : "var(--font-ui)", color: accent ? "var(--accent-2)" : muted ? "var(--muted)" : "var(--text)", ...(title ? { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block", lineHeight: "2" } : {}) }}>{children}</div>;
}
