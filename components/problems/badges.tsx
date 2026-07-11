"use client";

import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";

export const PROB_STATUS_COLOR: Record<string, { fg: string; bg: string }> = {
  new: { fg: "var(--st-info)", bg: "var(--st-info-bg)" },
  investigating: { fg: "var(--st-eval)", bg: "var(--st-eval-bg)" },
  known_error: { fg: "var(--st-high-fg)", bg: "var(--st-high-bg)" },
  resolved: { fg: "var(--st-low-fg)", bg: "var(--st-low-bg)" },
  closed: { fg: "var(--muted)", bg: "var(--paper)" },
};

export const PROB_PRIORITY_COLOR: Record<string, { fg: string; bg: string }> = {
  low: { fg: "var(--st-low-fg)", bg: "var(--st-low-bg)" },
  medium: { fg: "var(--st-info)", bg: "var(--st-info-bg)" },
  high: { fg: "var(--st-high-fg)", bg: "var(--st-high-bg)" },
  critical: { fg: "var(--st-critical-fg)", bg: "var(--st-critical-bg)" },
};

export function ProblemStatusBadge({ status }: { status: string }) {
  const { t } = useI18n();
  const c = PROB_STATUS_COLOR[status] ?? PROB_STATUS_COLOR.new;
  return (
    <span style={{ fontSize: 10.5, fontWeight: 600, color: c.fg, background: c.bg, padding: "3px 10px", borderRadius: "var(--r-pill)", whiteSpace: "nowrap" }}>
      {t(("prob.st." + status) as MessageKey)}
    </span>
  );
}
