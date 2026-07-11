"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import type { AlertData, DxData } from "@/lib/observability/queries";
import { AlertsTab } from "./alerts-tab";
import { DxTab } from "./dx-tab";

type Tab = "alerts" | "dx";

export function Observability({ alerts, dx, canManage }: { alerts: AlertData; dx: DxData; canManage: boolean }) {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>("alerts");
  const tabs: { key: Tab; label: MessageKey }[] = [
    { key: "alerts", label: "obs.tab.alerts" },
    { key: "dx", label: "obs.tab.dx" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--line)" }}>
        {tabs.map((x) => {
          const active = tab === x.key;
          return (
            <button key={x.key} onClick={() => setTab(x.key)}
              style={{ fontSize: 13, fontWeight: 600, padding: "10px 16px", border: "none", background: "transparent", color: active ? "var(--text)" : "var(--muted)", cursor: "pointer", borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent", marginBottom: -1 }}>
              {t(x.label)}
            </button>
          );
        })}
      </div>
      {tab === "alerts" && <AlertsTab data={alerts} canManage={canManage} />}
      {tab === "dx" && <DxTab data={dx} />}
    </div>
  );
}
