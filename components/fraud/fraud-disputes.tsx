"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import type { FraudRow, FraudStats, DisputeRow, DisputeStats } from "@/lib/fraud/queries";
import { FraudList } from "./fraud-list";
import { DisputeList } from "./dispute-list";

type Tab = "fraud" | "dispute";

export function FraudDisputes({ fraud, fraudStats, disputes, disputeStats }: { fraud: FraudRow[]; fraudStats: FraudStats; disputes: DisputeRow[]; disputeStats: DisputeStats }) {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>("fraud");
  const tabs: { key: Tab; label: MessageKey }[] = [
    { key: "fraud", label: "fr.tab.fraud" },
    { key: "dispute", label: "fr.tab.disputes" },
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
      {tab === "fraud" ? <FraudList rows={fraud} stats={fraudStats} /> : <DisputeList rows={disputes} stats={disputeStats} />}
    </div>
  );
}
