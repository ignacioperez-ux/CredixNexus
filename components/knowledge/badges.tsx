"use client";

import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";

const TYPE_COLOR: Record<string, string> = {
  how_to: "var(--st-info)", runbook: "var(--accent-2)", known_error: "var(--st-critical-fg)", faq: "var(--st-medium-fg)", policy: "var(--st-low-fg)",
};

export function ArticleTypeBadge({ type }: { type: string }) {
  const { t } = useI18n();
  return <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.4px", color: TYPE_COLOR[type] ?? "var(--muted)", background: "var(--paper)", padding: "2px 8px", borderRadius: "var(--r-pill)" }}>{t(("kb.type." + type) as MessageKey)}</span>;
}

const HEALTH_COLOR: Record<string, { fg: string; bg: string }> = {
  good: { fg: "var(--st-low-fg)", bg: "var(--st-low-bg)" },
  mixed: { fg: "var(--st-medium-fg)", bg: "var(--st-medium-bg)" },
  poor: { fg: "var(--st-critical-fg)", bg: "var(--st-critical-bg)" },
  unrated: { fg: "var(--muted)", bg: "var(--paper)" },
};

export function HealthBadge({ health, pct }: { health: string; pct: number | null }) {
  const { t } = useI18n();
  const c = HEALTH_COLOR[health] ?? HEALTH_COLOR.unrated;
  return <span style={{ fontSize: 10.5, fontWeight: 600, color: c.fg, background: c.bg, padding: "3px 10px", borderRadius: "var(--r-pill)" }}>{pct != null ? `${pct}% ` : ""}{t(("kb.health." + health) as MessageKey)}</span>;
}
