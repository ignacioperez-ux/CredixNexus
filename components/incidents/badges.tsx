"use client";

import { useI18n } from "@/lib/i18n/provider";
import { statusKey, priorityKey, statusColors, priorityColor, scoreColor } from "@/lib/incidents/labels";

export function StatusPill({ status }: { status: string }) {
  const { t } = useI18n();
  const c = statusColors(status);
  return (
    <span style={{ display: "inline-block", padding: "4px 11px", borderRadius: "var(--r-pill)", fontSize: 11.5, fontWeight: 600, color: c.fg, background: c.bg, whiteSpace: "nowrap" }}>
      {t(statusKey(status))}
    </span>
  );
}

export function PriorityTag({ priority }: { priority: string }) {
  const { t } = useI18n();
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, color: "var(--text)" }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: priorityColor(priority), flexShrink: 0 }} />
      {t(priorityKey(priority))}
    </span>
  );
}

export function ScoreBadge({ score }: { score: number }) {
  const rounded = Math.round(score);
  return (
    <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 500, color: scoreColor(score) }}>
      {rounded}
    </span>
  );
}

/** SLA: en tiempo / incumplido, segun due de resolucion y si esta resuelto. */
export function SlaBadge({ dueAt, resolvedAt, status }: { dueAt: string | null; resolvedAt: string | null; status: string }) {
  const { t } = useI18n();
  if (!dueAt || status === "closed" || status === "cancelled") return <span style={{ color: "var(--muted)" }}>—</span>;
  const settled = resolvedAt || status === "resolved" || status === "in_evolution";
  const breached = !settled && new Date(dueAt).getTime() < Date.now();
  const color = breached ? "var(--st-critical)" : "var(--st-low-fg)";
  return (
    <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color }}>
      {breached ? t("inc.sla.breached") : t("inc.sla.ontrack")}
    </span>
  );
}
