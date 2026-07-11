"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import type { AtRiskData, EscalationEventRow, EscalationRuleRow, OlaPolicyRow, SlaFormOptions } from "@/lib/sla/queries";
import { RiskTab } from "./risk-tab";
import { EventsTab } from "./events-tab";
import { RulesTab } from "./rules-tab";
import { OlaTab } from "./ola-tab";

type Tab = "risk" | "events" | "rules" | "ola";

export function Governance({ risk, events, rules, ola, options, canManage }: {
  risk: AtRiskData; events: EscalationEventRow[]; rules: EscalationRuleRow[]; ola: OlaPolicyRow[]; options: SlaFormOptions; canManage: boolean;
}) {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>("risk");
  const tabs: { key: Tab; label: MessageKey; badge?: number }[] = [
    { key: "risk", label: "sla.tab.risk", badge: risk.stats.atRisk },
    { key: "events", label: "sla.tab.events", badge: risk.stats.openEvents },
    { key: "rules", label: "sla.tab.rules" },
    { key: "ola", label: "sla.tab.ola" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--line)" }}>
        {tabs.map((x) => {
          const active = tab === x.key;
          return (
            <button key={x.key} onClick={() => setTab(x.key)}
              style={{ position: "relative", fontSize: 13, fontWeight: 600, padding: "10px 16px", border: "none", background: "transparent", color: active ? "var(--text)" : "var(--muted)", cursor: "pointer", borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent", marginBottom: -1, display: "flex", alignItems: "center", gap: 8 }}>
              {t(x.label)}
              {x.badge ? <span style={{ fontSize: 10.5, fontWeight: 700, minWidth: 18, textAlign: "center", padding: "1px 6px", borderRadius: "var(--r-pill)", background: active ? "var(--accent)" : "var(--paper)", color: active ? "var(--cta-fg)" : "var(--muted)" }}>{x.badge}</span> : null}
            </button>
          );
        })}
      </div>

      {tab === "risk" && <RiskTab data={risk} canManage={canManage} />}
      {tab === "events" && <EventsTab events={events} canManage={canManage} />}
      {tab === "rules" && <RulesTab rules={rules} options={options} canManage={canManage} />}
      {tab === "ola" && <OlaTab policies={ola} options={options} canManage={canManage} />}
    </div>
  );
}
