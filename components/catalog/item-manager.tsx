"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import type { CatalogItem, ServiceCategory } from "@/lib/catalog/queries";
import { setItemStatus, createCategory, setCategoryStatus } from "@/lib/catalog/actions";
import { ItemForm } from "./item-form";

export function ItemManager({ items, categories }: { items: CatalogItem[]; categories: ServiceCategory[] }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [showNew, setShowNew] = useState(false);
  const catName = (i: CatalogItem) => (locale === "en" ? i.category_name_en : i.category_name_es) ?? i.category;
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

      {showNew && <ItemForm onDone={() => setShowNew(false)} categories={categories.filter((c) => c.status === "active")} />}

      <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "140px 1.6fr 120px 90px 90px 130px", minWidth: 720 }}>
            {[t("cat.item.code"), t("cat.item.name"), t("cat.item.category"), t("cat.item.sla"), t("cat.fb.fields"), t("obs.col.status")].map((h) => <div key={h} style={head}>{h}</div>)}
            {items.length === 0 && <div style={{ gridColumn: "1 / -1", padding: 36, textAlign: "center", color: "var(--muted)" }}>{t("cat.empty")}</div>}
            {items.map((it) => {
              const active = it.status === "active";
              return (
                <div key={it.id} style={{ display: "contents" }}>
                  <Cell mono accent>{it.code}</Cell>
                  <Cell>{it.name}{it.has_workflow && <span style={{ fontSize: 9.5, marginLeft: 8, color: "var(--accent-2)", textTransform: "uppercase", fontWeight: 700 }}>WF</span>}</Cell>
                  <Cell muted>{catName(it)}</Cell>
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

      <CategoryManager categories={categories} />
    </div>
  );
}

/** Maestro de categorias del catalogo (§10.5): alta, activar/desactivar, listado con i18n. */
function CategoryManager({ categories }: { categories: ServiceCategory[] }) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [showNew, setShowNew] = useState(false);
  const [code, setCode] = useState("");
  const [nameEs, setNameEs] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const valid = code.trim().length >= 2 && nameEs.trim().length >= 2 && nameEn.trim().length >= 2;
  const field: React.CSSProperties = { fontSize: 12.5, padding: "8px 10px", borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: "var(--card)", color: "var(--text)", width: "100%" };
  const head: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "#8A948A", padding: "10px 12px", background: "var(--head-bg)" };

  function add() {
    setErr(null);
    start(async () => {
      const r = await createCategory({ code: code.trim(), nameEs: nameEs.trim(), nameEn: nameEn.trim() });
      if (!r.ok) { setErr(t(("err." + (r.error ?? "ERR_INVALID_FORMAT")) as MessageKey)); return; }
      setCode(""); setNameEs(""); setNameEn(""); setShowNew(false); router.refresh();
    });
  }
  function toggle(id: string, active: boolean) { start(async () => { await setCategoryStatus(id, active); router.refresh(); }); }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, color: "var(--text)" }}>{t("cat.cats.title")}</span>
        {!showNew && <button onClick={() => setShowNew(true)} style={{ fontSize: 12, fontWeight: 600, padding: "7px 12px", borderRadius: "var(--r-md)", background: "var(--paper)", color: "var(--text)", border: "1px solid var(--line)", cursor: "pointer" }}>+ {t("cat.cat.new")}</button>}
      </div>
      {showNew && (
        <div style={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: "var(--r-md)", padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <input value={code} onChange={(e) => setCode(e.target.value.toLowerCase().replace(/\s+/g, "_"))} placeholder={t("cat.cat.code")} style={{ ...field, fontFamily: "var(--font-mono)" }} />
            <input value={nameEs} onChange={(e) => setNameEs(e.target.value)} placeholder={t("cat.cat.name_es")} style={field} />
            <input value={nameEn} onChange={(e) => setNameEn(e.target.value)} placeholder={t("cat.cat.name_en")} style={field} />
          </div>
          {err && <div style={{ fontSize: 11.5, color: "var(--st-critical-fg)" }}>{err}</div>}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={add} disabled={pending || !valid} style={{ fontSize: 12, fontWeight: 600, padding: "7px 14px", borderRadius: "var(--r-md)", border: "none", background: "var(--cta-bg)", color: "var(--cta-fg)", cursor: valid ? "pointer" : "default", opacity: valid ? 1 : 0.6 }}>{t("cat.cat.add")}</button>
            <button onClick={() => { setShowNew(false); setErr(null); }} style={{ fontSize: 12, fontWeight: 600, padding: "7px 12px", borderRadius: "var(--r-md)", border: "none", background: "transparent", color: "var(--muted)", cursor: "pointer" }}>{t("common.cancel")}</button>
          </div>
        </div>
      )}
      <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "140px 1fr 1fr 120px", minWidth: 620 }}>
            {[t("cat.cat.code"), t("cat.cat.name_es"), t("cat.cat.name_en"), t("obs.col.status")].map((h) => <div key={h} style={head}>{h}</div>)}
            {categories.map((c) => {
              const active = c.status === "active";
              return (
                <div key={c.id} style={{ display: "contents" }}>
                  <Cell mono accent>{c.code}</Cell>
                  <Cell>{c.name_es}</Cell>
                  <Cell>{c.name_en}</Cell>
                  <Cell>
                    <button disabled={pending} onClick={() => toggle(c.id, !active)} style={{ fontSize: 10.5, fontWeight: 600, padding: "4px 10px", borderRadius: "var(--r-pill)", border: "1px solid var(--line)", cursor: "pointer", color: active ? "var(--st-low-fg)" : "var(--muted)", background: active ? "var(--st-low-bg)" : "var(--paper)" }}>{active ? t("cat.admin.deactivate") : t("cat.admin.activate")}</button>
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
