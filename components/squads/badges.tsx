"use client";

import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";

export const ROLE_COLOR: Record<string, { fg: string; bg: string }> = {
  lead: { fg: "var(--accent-2)", bg: "var(--accent-soft)" },
  product_owner: { fg: "var(--st-eval)", bg: "var(--st-eval-bg)" },
  tech_lead: { fg: "var(--st-info)", bg: "var(--st-info-bg)" },
  developer: { fg: "var(--muted)", bg: "var(--paper)" },
  qa: { fg: "var(--st-medium-fg)", bg: "var(--st-medium-bg)" },
  analyst: { fg: "var(--st-low-fg)", bg: "var(--st-low-bg)" },
  scrum_master: { fg: "var(--st-high-fg)", bg: "var(--st-high-bg)" },
};

export function SquadRoleBadge({ role }: { role: string }) {
  const { t } = useI18n();
  const c = ROLE_COLOR[role] ?? ROLE_COLOR.developer;
  return <span style={{ fontSize: 10.5, fontWeight: 600, color: c.fg, background: c.bg, padding: "2px 9px", borderRadius: "var(--r-pill)", whiteSpace: "nowrap" }}>{t(("sq.role." + role) as MessageKey)}</span>;
}
