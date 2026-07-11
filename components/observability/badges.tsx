"use client";

import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";

const SEV_COLOR: Record<string, { fg: string; bg: string }> = {
  critical: { fg: "var(--st-critical-fg)", bg: "var(--st-critical-bg)" },
  high: { fg: "var(--st-high-fg)", bg: "var(--st-high-bg)" },
  medium: { fg: "var(--st-medium-fg)", bg: "var(--st-medium-bg)" },
  low: { fg: "var(--st-low-fg)", bg: "var(--st-low-bg)" },
  info: { fg: "var(--muted)", bg: "var(--paper)" },
};

export function SeverityBadge({ severity }: { severity: string }) {
  const { t } = useI18n();
  const c = SEV_COLOR[severity] ?? SEV_COLOR.medium;
  return <span style={{ fontSize: 10, fontWeight: 600, color: c.fg, background: c.bg, padding: "2px 8px", borderRadius: "var(--r-pill)" }}>{t(("obs.sev." + severity) as MessageKey)}</span>;
}

const STATUS_COLOR: Record<string, { fg: string; bg: string }> = {
  open: { fg: "var(--st-high-fg)", bg: "var(--st-high-bg)" },
  acknowledged: { fg: "var(--st-medium-fg)", bg: "var(--st-medium-bg)" },
  correlated: { fg: "var(--accent-2)", bg: "var(--accent-soft)" },
  resolved: { fg: "var(--st-low-fg)", bg: "var(--st-low-bg)" },
};

export function AlertStatusBadge({ status }: { status: string }) {
  const { t } = useI18n();
  const c = STATUS_COLOR[status] ?? STATUS_COLOR.open;
  return <span style={{ fontSize: 10.5, fontWeight: 600, color: c.fg, background: c.bg, padding: "3px 10px", borderRadius: "var(--r-pill)" }}>{t(("obs.st." + status) as MessageKey)}</span>;
}

const DX_COLOR: Record<string, { fg: string; bg: string }> = {
  success: { fg: "var(--st-low-fg)", bg: "var(--st-low-bg)" },
  slow: { fg: "var(--st-medium-fg)", bg: "var(--st-medium-bg)" },
  error: { fg: "var(--st-critical-fg)", bg: "var(--st-critical-bg)" },
};

export function DxStatusBadge({ status }: { status: string }) {
  const { t } = useI18n();
  const c = DX_COLOR[status] ?? DX_COLOR.success;
  return <span style={{ fontSize: 10.5, fontWeight: 600, color: c.fg, background: c.bg, padding: "3px 10px", borderRadius: "var(--r-pill)" }}>{t(("obs.dx." + status) as MessageKey)}</span>;
}
