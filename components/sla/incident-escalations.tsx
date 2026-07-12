"use client";

import { Icon } from "@/components/ui/icon";

import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";

type Esc = { id: string; sla_type: string; threshold_pct: number; elapsed_pct: number; action: string; acknowledged: boolean; triggered_at: string; rule: { code: string; name: string } | null };

const actionColor: Record<string, string> = {
  notify: "var(--st-info)",
  raise_priority: "var(--st-high-fg)",
  reassign_team: "var(--st-eval)",
};

/** Escalaciones SLA disparadas para un caso (solo lectura en el detalle). */
export function IncidentEscalations({ escalations }: { escalations: Esc[] }) {
  const { t, locale } = useI18n();
  if (escalations.length === 0) {
    return <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("sla.linked.none")}</div>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {escalations.map((e) => (
        <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: "var(--r-md)", background: "var(--paper)" }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: actionColor[e.action] ?? "var(--text)", whiteSpace: "nowrap" }}>{t(("sla.act." + e.action) as MessageKey)}</span>
          <span style={{ fontSize: 12, color: "var(--text)", flex: 1 }}>{t(("sla.clock." + e.sla_type) as MessageKey)} · {e.threshold_pct}% <span style={{ color: "var(--muted)", fontFamily: "var(--font-mono)" }}>({e.elapsed_pct}%)</span></span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)" }}>{new Date(e.triggered_at).toLocaleDateString(locale)}</span>
          {e.acknowledged && <span style={{ color: "var(--st-low-fg)", display: "inline-flex" }}><Icon name="check" size={13} /></span>}
        </div>
      ))}
    </div>
  );
}
