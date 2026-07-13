"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import type { Overview, Performance, Supervisor } from "@/lib/analytics/queries";
import { ExecDashboard } from "./exec-dashboard";
import { ReportExport } from "./report-export";
import { PerformanceTab } from "./performance-tab";
import { SupervisorDashboard } from "./supervisor-dashboard";

type Tab = "exec" | "supervisor" | "performance" | "reports";

export function Analytics({ overview, performance, supervisor, categoryTrends = {} }: { overview: Overview; performance: Performance; supervisor: Supervisor; categoryTrends?: Record<string, number[]> }) {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>("exec");
  const tabs: { key: Tab; label: MessageKey }[] = [
    { key: "exec", label: "an.tab.exec" },
    { key: "supervisor", label: "an.tab.supervisor" },
    { key: "performance", label: "an.tab.performance" },
    { key: "reports", label: "an.tab.reports" },
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
      {tab === "exec" && <ExecDashboard o={overview} trends={categoryTrends} />}
      {tab === "supervisor" && <SupervisorDashboard s={supervisor} />}
      {tab === "performance" && <PerformanceTab p={performance} />}
      {tab === "reports" && <ReportExport />}
    </div>
  );
}
