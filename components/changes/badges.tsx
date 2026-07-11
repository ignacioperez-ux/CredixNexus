"use client";

import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";

export const CHG_STATUS_COLOR: Record<string, { fg: string; bg: string }> = {
  draft: { fg: "var(--muted)", bg: "var(--paper)" },
  assessment: { fg: "var(--st-info)", bg: "var(--st-info-bg)" },
  pending_cab: { fg: "var(--st-eval)", bg: "var(--st-eval-bg)" },
  approved: { fg: "var(--st-low-fg)", bg: "var(--st-low-bg)" },
  scheduled: { fg: "var(--st-info)", bg: "var(--st-info-bg)" },
  implementing: { fg: "var(--st-high-fg)", bg: "var(--st-high-bg)" },
  review: { fg: "var(--st-eval)", bg: "var(--st-eval-bg)" },
  closed: { fg: "var(--st-low-fg)", bg: "var(--st-low-bg)" },
  rejected: { fg: "var(--st-critical-fg)", bg: "var(--st-critical-bg)" },
  cancelled: { fg: "var(--muted)", bg: "var(--paper)" },
};

export const RISK_COLOR: Record<string, { fg: string; bg: string }> = {
  low: { fg: "var(--st-low-fg)", bg: "var(--st-low-bg)" },
  medium: { fg: "var(--st-medium-fg)", bg: "var(--st-medium-bg)" },
  high: { fg: "var(--st-critical-fg)", bg: "var(--st-critical-bg)" },
};

export function ChangeStatusBadge({ status }: { status: string }) {
  const { t } = useI18n();
  const c = CHG_STATUS_COLOR[status] ?? CHG_STATUS_COLOR.draft;
  return <span style={{ fontSize: 10.5, fontWeight: 600, color: c.fg, background: c.bg, padding: "3px 10px", borderRadius: "var(--r-pill)", whiteSpace: "nowrap" }}>{t(("chg.st." + status) as MessageKey)}</span>;
}

export function RiskBadge({ risk }: { risk: string }) {
  const { t } = useI18n();
  const c = RISK_COLOR[risk] ?? RISK_COLOR.medium;
  return <span style={{ fontSize: 10, fontWeight: 600, color: c.fg, background: c.bg, padding: "2px 8px", borderRadius: "var(--r-pill)" }}>{t(("chg.risk." + risk) as MessageKey)}</span>;
}
