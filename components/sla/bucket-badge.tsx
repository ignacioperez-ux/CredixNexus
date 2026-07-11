"use client";

import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import type { RiskBucket } from "@/lib/sla/thresholds";

export const BUCKET_COLOR: Record<RiskBucket, { fg: string; bg: string }> = {
  na: { fg: "var(--muted)", bg: "var(--paper)" },
  ok: { fg: "var(--st-low-fg)", bg: "var(--st-low-bg)" },
  warning: { fg: "var(--st-medium-fg)", bg: "var(--st-medium-bg)" },
  critical: { fg: "var(--st-high-fg)", bg: "var(--st-high-bg)" },
  breached: { fg: "var(--st-critical-fg)", bg: "var(--st-critical-bg)" },
};

export function BucketBadge({ bucket, pct }: { bucket: RiskBucket; pct?: number | null }) {
  const { t } = useI18n();
  const c = BUCKET_COLOR[bucket];
  return (
    <span style={{ fontSize: 10.5, fontWeight: 600, color: c.fg, background: c.bg, padding: "3px 9px", borderRadius: "var(--r-pill)", whiteSpace: "nowrap" }}>
      {t(("sla.bucket." + bucket) as MessageKey)}{pct != null && bucket !== "na" ? ` · ${pct}%` : ""}
    </span>
  );
}
