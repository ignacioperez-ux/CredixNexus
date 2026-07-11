"use client";

import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";

export const CRIT_COLOR: Record<string, { fg: string; bg: string }> = {
  low: { fg: "var(--st-low-fg)", bg: "var(--st-low-bg)" },
  medium: { fg: "var(--st-medium-fg)", bg: "var(--st-medium-bg)" },
  high: { fg: "var(--st-high-fg)", bg: "var(--st-high-bg)" },
  critical: { fg: "var(--st-critical-fg)", bg: "var(--st-critical-bg)" },
};

export function CriticalityBadge({ criticality }: { criticality: string }) {
  const { t } = useI18n();
  const c = CRIT_COLOR[criticality] ?? CRIT_COLOR.medium;
  return <span style={{ fontSize: 10, fontWeight: 600, color: c.fg, background: c.bg, padding: "2px 8px", borderRadius: "var(--r-pill)" }}>{t(("vnd.crit." + criticality) as MessageKey)}</span>;
}

export function VendorStatusBadge({ status }: { status: string }) {
  const { t } = useI18n();
  const active = status === "active";
  return <span style={{ fontSize: 10.5, fontWeight: 600, color: active ? "var(--st-low-fg)" : "var(--muted)", background: active ? "var(--st-low-bg)" : "var(--paper)", padding: "3px 10px", borderRadius: "var(--r-pill)" }}>{t(("sla.st." + status) as MessageKey)}</span>;
}
