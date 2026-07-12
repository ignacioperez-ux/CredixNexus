"use client";

import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import { Icon } from "@/components/ui/icon";

export const INST_COLOR: Record<string, { fg: string; bg: string }> = {
  running: { fg: "var(--st-info)", bg: "var(--st-info-bg)" },
  completed: { fg: "var(--st-low-fg)", bg: "var(--st-low-bg)" },
  cancelled: { fg: "var(--muted)", bg: "var(--paper)" },
};
export const STEP_COLOR: Record<string, { fg: string; bg: string }> = {
  active: { fg: "var(--st-info)", bg: "var(--st-info-bg)" },
  done: { fg: "var(--st-low-fg)", bg: "var(--st-low-bg)" },
  rejected: { fg: "var(--st-critical-fg)", bg: "var(--st-critical-bg)" },
  skipped: { fg: "var(--muted)", bg: "var(--paper)" },
};
// Mapa tipo-de-nodo -> icono geometrico (sin glifos Unicode). fill para nodos "solidos".
const NODE_ICON_MAP: Record<string, { name: string; fill?: boolean }> = {
  start: { name: "play", fill: true },
  task: { name: "square" },
  approval: { name: "scale" },
  automated: { name: "gear" },
  end: { name: "square", fill: true },
};

export function NodeIcon({ nodeType, size = 13 }: { nodeType: string; size?: number }) {
  const m = NODE_ICON_MAP[nodeType] ?? { name: "square" };
  return <Icon name={m.name} size={size} fill={m.fill ? "currentColor" : "none"} />;
}

export function InstanceStatusBadge({ status }: { status: string }) {
  const { t } = useI18n();
  const c = INST_COLOR[status] ?? INST_COLOR.running;
  return <span style={{ fontSize: 10.5, fontWeight: 600, color: c.fg, background: c.bg, padding: "3px 10px", borderRadius: "var(--r-pill)", whiteSpace: "nowrap" }}>{t(("wf.ist." + status) as MessageKey)}</span>;
}
export function DefStatusBadge({ status }: { status: string }) {
  const { t } = useI18n();
  const active = status === "active";
  return <span style={{ fontSize: 10.5, fontWeight: 600, color: active ? "var(--st-low-fg)" : status === "draft" ? "var(--st-medium-fg)" : "var(--muted)", background: active ? "var(--st-low-bg)" : status === "draft" ? "var(--st-medium-bg)" : "var(--paper)", padding: "3px 10px", borderRadius: "var(--r-pill)" }}>{t(("sla.st." + status) as MessageKey)}</span>;
}
