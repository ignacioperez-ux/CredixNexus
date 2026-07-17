"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import type { CatalogItem } from "@/lib/catalog/queries";
import { Icon } from "@/components/ui/icon";
import { RequestForm } from "./request-form";

export function CatalogGrid({ items, canRequest }: { items: CatalogItem[]; canRequest: boolean }) {
  const { t, locale } = useI18n();
  const [openId, setOpenId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const filtered = useMemo(
    () => (q ? items.filter((i) => `${i.name} ${i.description ?? ""} ${i.category_name_es ?? ""} ${i.category_name_en ?? ""} ${i.category}`.toLowerCase().includes(q)) : items),
    [items, q],
  );

  const byCategory = useMemo(() => {
    // Nombre de categoria localizado desde el maestro (i18n §10); fallback al texto legacy.
    const catName = (i: CatalogItem) => (locale === "en" ? i.category_name_en : i.category_name_es) ?? i.category;
    const m = new Map<string, CatalogItem[]>();
    for (const i of filtered) { const k = catName(i); const l = m.get(k) ?? []; l.push(i); m.set(k, l); }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered, locale]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("cat.intro")}</div>

      {/* Buscador: descubribilidad (sustituye el scroll ciego por grid). */}
      {items.length > 0 && (
        <div style={{ position: "relative", maxWidth: 420 }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", display: "grid", placeItems: "center", color: "var(--muted)" }}><Icon name="search" size={15} /></span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("cat.search.placeholder")}
            style={{ width: "100%", fontSize: 13, padding: "10px 12px 10px 34px", borderRadius: "var(--r-md)", border: "1px solid var(--field-border, var(--line))", background: "var(--field-bg, var(--card))", color: "var(--text)", fontFamily: "var(--font-ui)" }} />
        </div>
      )}

      {items.length === 0 && <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("cat.empty")}</div>}
      {items.length > 0 && byCategory.length === 0 && <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("cat.noresults")}</div>}

      {byCategory.map(([category, list]) => (
        <div key={category} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "var(--muted)" }}>{category}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
            {list.map((item) => {
              const open = openId === item.id;
              return (
                <div key={item.id} className={open ? undefined : "cx-lift"} style={{ background: "var(--card)", border: `1px solid ${open ? "var(--accent)" : "var(--line)"}`, borderRadius: "var(--r-card, var(--r-xl))", boxShadow: "var(--sh-e1, none)", padding: 18, display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ fontFamily: "var(--font-display)", fontWeight: "var(--fw-title, 700)" as React.CSSProperties["fontWeight"], fontSize: 14.5, letterSpacing: "var(--tracking-title, normal)", color: "var(--text)" }}>{item.name}</span>
                    <span title={`${t("cat.sla")} ${item.sla_hours}h`} style={{ display: "inline-flex", alignItems: "center", gap: 5, flexShrink: 0, fontFamily: "var(--font-mono)", fontSize: 10.5, fontWeight: 600, color: "var(--accent-2)", background: "var(--accent-soft)", padding: "2px 8px", borderRadius: "var(--r-pill)" }}>{t("cat.sla")} {item.sla_hours}h</span>
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
