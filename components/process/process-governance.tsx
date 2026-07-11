"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import type { ProcessRow, ProcessStats, ProductChannelMatrix } from "@/lib/process/queries";
import { ProcessList } from "./process-list";
import { ProductChannelMatrixView } from "./product-channel-matrix";

type Tab = "processes" | "matrix";

export function ProcessGovernance({ rows, stats, matrix, canManage }: { rows: ProcessRow[]; stats: ProcessStats; matrix: ProductChannelMatrix; canManage: boolean }) {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>("processes");
  const tabs: { key: Tab; label: MessageKey }[] = [
    { key: "processes", label: "proc.tab.processes" },
    { key: "matrix", label: "proc.tab.matrix" },
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
      {tab === "processes" ? <ProcessList rows={rows} stats={stats} /> : <ProductChannelMatrixView matrix={matrix} canManage={canManage} />}
    </div>
  );
}
