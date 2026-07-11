"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import type { DefinitionRow, InstanceRow } from "@/lib/workflows/queries";
import { InstancesTab } from "./instances-tab";
import { DefinitionsTab } from "./definitions-tab";

export function Workflows({ instances, definitions, canManage }: { instances: InstanceRow[]; definitions: DefinitionRow[]; canManage: boolean }) {
  const { t } = useI18n();
  const [tab, setTab] = useState<"instances" | "definitions">("instances");
  const running = instances.filter((i) => i.status === "running").length;
  const tabs: { key: "instances" | "definitions"; label: MessageKey; badge?: number }[] = [
    { key: "instances", label: "wf.tab.instances", badge: running },
    { key: "definitions", label: "wf.tab.definitions", badge: definitions.length },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--line)" }}>
        {tabs.map((x) => {
          const active = tab === x.key;
          return (
            <button key={x.key} onClick={() => setTab(x.key)}
              style={{ fontSize: 13, fontWeight: 600, padding: "10px 16px", border: "none", background: "transparent", color: active ? "var(--text)" : "var(--muted)", cursor: "pointer", borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent", marginBottom: -1, display: "flex", alignItems: "center", gap: 8 }}>
              {t(x.label)}
              {x.badge ? <span style={{ fontSize: 10.5, fontWeight: 700, minWidth: 18, textAlign: "center", padding: "1px 6px", borderRadius: "var(--r-pill)", background: active ? "var(--accent)" : "var(--paper)", color: active ? "var(--cta-fg)" : "var(--muted)" }}>{x.badge}</span> : null}
            </button>
          );
        })}
      </div>
      {tab === "instances" && <InstancesTab instances={instances} />}
      {tab === "definitions" && <DefinitionsTab definitions={definitions} canManage={canManage} />}
    </div>
  );
}
