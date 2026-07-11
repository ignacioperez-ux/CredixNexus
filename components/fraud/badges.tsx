"use client";

import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";

const FRAUD_ST: Record<string, { fg: string; bg: string }> = {
  reported: { fg: "var(--st-high-fg)", bg: "var(--st-high-bg)" },
  investigating: { fg: "var(--st-medium-fg)", bg: "var(--st-medium-bg)" },
  confirmed: { fg: "var(--st-critical-fg)", bg: "var(--st-critical-bg)" },
  false_positive: { fg: "var(--muted)", bg: "var(--paper)" },
  recovered: { fg: "var(--st-low-fg)", bg: "var(--st-low-bg)" },
  closed: { fg: "var(--muted)", bg: "var(--paper)" },
};
const DISPUTE_ST: Record<string, { fg: string; bg: string }> = {
  opened: { fg: "var(--st-high-fg)", bg: "var(--st-high-bg)" },
  investigating: { fg: "var(--st-medium-fg)", bg: "var(--st-medium-bg)" },
  awaiting_customer: { fg: "var(--st-info)", bg: "var(--paper)" },
  submitted: { fg: "var(--accent-2)", bg: "var(--accent-soft)" },
  won: { fg: "var(--st-low-fg)", bg: "var(--st-low-bg)" },
  lost: { fg: "var(--st-critical-fg)", bg: "var(--st-critical-bg)" },
  cancelled: { fg: "var(--muted)", bg: "var(--paper)" },
  closed: { fg: "var(--muted)", bg: "var(--paper)" },
};

export function FraudStatusBadge({ status }: { status: string }) {
  const { t } = useI18n();
  const c = FRAUD_ST[status] ?? FRAUD_ST.reported;
  return <Pill fg={c.fg} bg={c.bg}>{t(("fr.st." + status) as MessageKey)}</Pill>;
}
export function DisputeStatusBadge({ status }: { status: string }) {
  const { t } = useI18n();
  const c = DISPUTE_ST[status] ?? DISPUTE_ST.opened;
  return <Pill fg={c.fg} bg={c.bg}>{t(("dp.st." + status) as MessageKey)}</Pill>;
}
function Pill({ fg, bg, children }: { fg: string; bg: string; children: React.ReactNode }) {
  return <span style={{ fontSize: 10.5, fontWeight: 600, color: fg, background: bg, padding: "3px 10px", borderRadius: "var(--r-pill)" }}>{children}</span>;
}
