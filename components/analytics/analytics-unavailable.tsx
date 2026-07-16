"use client";

import { useI18n } from "@/lib/i18n/provider";
import { Icon } from "@/components/ui/icon";

// Fallback resiliente: si un RPC de analitica (gateado por analytics.read) falla o el rol no
// tiene permiso, la pantalla degrada a este mensaje en vez de tumbar el Server Component.
export function AnalyticsUnavailable() {
  const { t } = useI18n();
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, padding: "64px 20px", color: "var(--muted)", textAlign: "center" }}>
      <Icon name="activity" size={34} strokeWidth={1.4} color="var(--muted)" />
      <div style={{ fontSize: 14.5, fontWeight: 700, color: "var(--text)" }}>{t("analytics.unavailable.title")}</div>
      <div style={{ fontSize: 12.5, maxWidth: 380, lineHeight: 1.5 }}>{t("analytics.unavailable.hint")}</div>
    </div>
  );
}
