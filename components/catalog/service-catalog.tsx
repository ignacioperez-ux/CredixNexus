"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import type { CatalogItem, RequestRow, RequestStats } from "@/lib/catalog/queries";
import { CatalogGrid } from "./catalog-grid";
import { RequestList } from "./request-list";
import { ItemManager } from "./item-manager";

type Tab = "catalog" | "requests" | "admin";

export function ServiceCatalog({ items, requests, stats, canRequest, canManage, allItems }: { items: CatalogItem[]; requests: RequestRow[]; stats: RequestStats; canRequest: boolean; canManage: boolean; allItems: CatalogItem[] }) {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>("catalog");
  const tabs: { key: Tab; label: MessageKey }[] = [
    { key: "catalog", label: "cat.tab.catalog" },
    { key: "requests", label: "cat.tab.requests" },
    ...(canManage ? [{ key: "admin" as Tab, label: "cat.tab.admin" as MessageKey }] : []),
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--line)" }}>
        {tabs.map((x) => {
          const active = tab === x.key;
          return (
            <button key={x.key} onClick={() => setTab(x.key)}
              style={{ fontSize: 13, fontWeight: 600, padding: "10px 16px", border: "none", background: "transparent", color: active ? "var(--text)" : "var(--muted)", cursor: "pointer", borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent", marginBottom: -1 }}>
              {t(x.label)}{x.key === "requests" && requests.length > 0 ? ` (${requests.length})` : ""}
            </button>
          );
        })}
      </div>
      {tab === "catalog" && <CatalogGrid items={items} canRequest={canRequest} />}
      {tab === "requests" && <RequestList rows={requests} stats={stats} />}
      {tab === "admin" && canManage && <ItemManager items={allItems} />}
    </div>
  );
}
