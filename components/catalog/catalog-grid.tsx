"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import type { CatalogItem } from "@/lib/catalog/queries";
import { RequestForm } from "./request-form";

export function CatalogGrid({ items, canRequest }: { items: CatalogItem[]; canRequest: boolean }) {
  const { t } = useI18n();
  const [openId, setOpenId] = useState<string | null>(null);

  const byCategory = useMemo(() => {
    const m = new Map<string, CatalogItem[]>();
    for (const i of items) { const l = m.get(i.category) ?? []; l.push(i); m.set(i.category, l); }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [items]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("cat.intro")}</div>
      {items.length === 0 && <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("cat.empty")}</div>}
      {byCategory.map(([category, list]) => (
        <div key={category} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "var(--muted)" }}>{category}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
            {list.map((item) => {
              const open = openId === item.id;
              return (
                <div key={item.id} style={{ background: "var(--card)", border: `1px solid ${open ? "var(--accent)" : "var(--line)"}`, borderRadius: "var(--r-xl)", padding: 18, display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14.5, color: "var(--text)" }}>{item.name}</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--muted)" }}>{t("cat.sla")}: {item.sla_hours}h</span>
                  </div>
                  {item.description && <div style={{ fontSize: 12, color: "var(--muted)" }}>{item.description}</div>}
                  {!open ? (
                    canRequest ? (
                      <button onClick={() => setOpenId(item.id)}
                        style={{ alignSelf: "flex-start", fontSize: 12.5, fontWeight: 600, padding: "8px 14px", borderRadius: "var(--r-md)", border: "1px solid var(--accent)", background: "transparent", color: "var(--accent-2)", cursor: "pointer", marginTop: 4 }}>
                        {t("cat.request")}
                      </button>
                    ) : <span style={{ fontSize: 11.5, color: "var(--muted)" }}>{t("cat.norequest")}</span>
                  ) : (
                    <RequestForm item={item} onCancel={() => setOpenId(null)} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
