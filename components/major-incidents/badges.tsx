"use client";

import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";

export const MI_STATUS_COLOR: Record<string, { fg: string; bg: string }> = {
  declared: { fg: "var(--st-critical-fg)", bg: "var(--st-critical-bg)" },
  investigating: { fg: "var(--st-high-fg)", bg: "var(--st-high-bg)" },
  identified: { fg: "var(--st-eval)", bg: "var(--st-eval-bg)" },
  mitigating: { fg: "var(--st-high-fg)", bg: "var(--st-high-bg)" },
  monitoring: { fg: "var(--st-info)", bg: "var(--st-info-bg)" },
  resolved: { fg: "var(--st-low-fg)", bg: "var(--st-low-bg)" },
  stood_down: { fg: "var(--muted)", bg: "var(--paper)" },
};

export const SEV_COLOR: Record<string, { fg: string; bg: string }> = {
  sev1: { fg: "var(--st-critical-fg)", bg: "var(--st-critical-bg)" },
  sev2: { fg: "var(--st-high-fg)", bg: "var(--st-high-bg)" },
  sev3: { fg: "var(--st-medium-fg)", bg: "var(--st-medium-bg)" },
};

export const UPDATE_COLOR: Record<string, string> = {
  internal: "var(--muted)",
  customer: "var(--st-info)",
  stakeholder: "var(--st-eval)",
  status: "var(--st-high-fg)",
};

export function MiStatusBadge({ status }: { status: string }) {
  const { t } = useI18n();
  const c = MI_STATUS_COLOR[status] ?? MI_STATUS_COLOR.declared;
  return <span style={{ fontSize: 10.5, fontWeight: 600, color: c.fg, background: c.bg, padding: "3px 10px", borderRadius: "var(--r-pill)", whiteSpace: "nowrap" }}>{t(("mi.st." + status) as MessageKey)}</span>;
}

export function SevBadge({ severity }: { severity: string }) {
  const { t } = useI18n();
  const c = SEV_COLOR[severity] ?? SEV_COLOR.sev2;
  return <span style={{ fontSize: 10, fontWeight: 700, color: c.fg, background: c.bg, padding: "2px 8px", borderRadius: "var(--r-pill)", textTransform: "uppercase" }}>{t(("mi.sev." + severity) as MessageKey)}</span>;
}
