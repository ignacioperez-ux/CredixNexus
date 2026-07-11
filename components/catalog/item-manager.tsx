"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/provider";
import type { CatalogItem } from "@/lib/catalog/queries";
import { setItemStatus } from "@/lib/catalog/actions";
import { ItemForm } from "./item-form";

export function ItemManager({ items }: { items: CatalogItem[] }) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [showNew, setShowNew] = useState(false);
  const head: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "#8A948A", padding: "10px 12px", background: "var(--head-bg)" };

  function toggle(id: string, active: boolean) {
    start(async () => { await setItemStatus(id, active); router.refresh(); });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("cat.admin.intro")}</div>
        {!showNew && <button onClick={() => setShowNew(true)} style={{ fontSize: 12.5, fontWeight: 600, padding: "8px 14px", borderRadius: "var(--r-md)", background: "var(--cta-bg)", color: "var(--cta-fg)", border: "none", cursor: "pointer" }}>+ {t("cat.item.new")}</button>}
      </div>

      {showNew && <ItemForm onDone={() => setShowNew(false)} />}

      <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "140px 1.6fr 120px 90px 90px 130px", minWidth: 820 }}>
            {[t("cat.item.code"), t("cat.item.name"), t("cat.item.category"), t("cat.item.sla"), t("cat.fb.fields"), t("obs.col.status")].map((h) => <div key={h} style={head}>{h}</div>)}
            {items.length === 0 && <div style={{ gridColumn: "1 / -1", padding: 36, textAlign: "center", color: "var(--muted)" }}>{t("cat.empty")}</div>}
            {items.map((it) => {
              const active = it.status === "active";
              return (
                <div key={it.id} style={{ display: "contents" }}>
                  <Cell mono accent>{it.code}</Cell>
                  <Cell>{it.name}{it.has_workflow && <span style={{ fontSize: 9.5, marginLeft: 8, color: "var(--accent-2)", textTransform: "uppercase", fontWeight: 700 }}>WF</span>}</Cell>
                  <Cell muted>{it.category}</Cell>
                  <Cell mono muted>{it.sla_hours}h</Cell>
                  <Cell mono muted>{it.form_schema.length}</Cell>
                  <Cell>
                    <button disabled={pending} onClick={() => toggle(it.id, !active)}
                      style={{ fontSize: 10.5, fontWeight: 600, padding: "4px 10px", borderRadius: "var(--r-pill)", border: "1px solid var(--line)", cursor: "pointer",
                        color: active ? "var(--st-low-fg)" : "var(--muted)", background: active ? "var(--st-low-bg)" : "var(--paper)" }}>
                      {active ? t("cat.admin.deactivate") : t("cat.admin.activate")}
                    </button>
                  </Cell>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

const cellSt: React.CSSProperties = { fontSize: 12.5, padding: "11px 12px", borderTop: "1px solid var(--line-soft)", display: "flex", alignItems: "center", color: "var(--text)" };
function Cell({ children, mono, accent, muted }: { children: React.ReactNode; mono?: boolean; accent?: boolean; muted?: boolean }) {
  return <div style={{ ...cellSt, fontFamily: mono ? "var(--font-mono)" : "var(--font-ui)", color: accent ? "var(--accent-2)" : muted ? "var(--muted)" : "var(--text)" }}>{children}</div>;
}
