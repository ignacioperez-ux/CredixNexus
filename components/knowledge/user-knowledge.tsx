"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import type { KbData, ArticleRow } from "@/lib/knowledge/queries";
import { Icon } from "@/components/ui/icon";
import { ArticleTypeBadge } from "./badges";

// Familia de acento por nombre de categoria KB (tinte Claro; fallback en Nexus).
const KB_FAMILY: [RegExp, string][] = [
  [/segur|acces/i, "indigo"], [/concil|dato/i, "cyan"], [/pago|onboard|origin/i, "emerald"],
  [/aplica|app|duplic/i, "amber"], [/disput|reclam/i, "violet"], [/fraud|riesg|cargo/i, "rose"],
  [/api|proces/i, "teal"], [/infra/i, "slate"],
];
const kbFam = (name: string) => KB_FAMILY.find(([re]) => re.test(name))?.[1] ?? "slate";

// Vista de descubrimiento de conocimiento para el USUARIO final (KM real, dirección del
// arquitecto). Estructura amplia y simple por categoria/tipo reales (cero taxonomia inventada);
// sin metricas de operacion (views/deflection/health) que solo importan al curador (UX-001).

export function UserKnowledge({ data }: { data: KbData }) {
  const { t } = useI18n();
  const articles = useMemo(() => data.articles.filter((a) => a.status === "active"), [data.articles]);
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const [type, setType] = useState<string | null>(null);

  const q = query.trim().toLowerCase();
  const filtered = useMemo(() => articles.filter((a) =>
    (!q || `${a.title} ${a.category} ${a.article_type}`.toLowerCase().includes(q)) &&
    (!cat || a.category === cat) && (!type || a.article_type === type),
  ), [articles, q, cat, type]);

  const categories = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of articles) m.set(a.category, (m.get(a.category) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [articles]);

  const types = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of articles) m.set(a.article_type, (m.get(a.article_type) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [articles]);

  const popular = useMemo(() => [...articles].sort((a, b) => b.view_count - a.view_count).slice(0, 5), [articles]);
  const browsing = !q && !cat && !type;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-5)", maxWidth: "var(--w-app)" }}>
      {/* Hero + buscador */}
      <div style={{ background: "var(--acc-teal-bg, var(--paper))", border: "1px solid var(--acc-teal-border, var(--line))", borderRadius: "var(--r-card, var(--r-xl))", boxShadow: "var(--sh-hero, var(--sh-card))", padding: "26px 30px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <span style={{ width: 34, height: 34, flexShrink: 0, borderRadius: 10, display: "grid", placeItems: "center", background: "var(--acc-teal-ink, var(--teal))", color: "#fff" }}><Icon name="sparkle" size={17} color="#fff" /></span>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "var(--fs-page-title, 25px)", letterSpacing: "-0.01em", color: "var(--text)" }}>{t("ukb.title")}</div>
        </div>
        <div style={{ fontSize: 13.5, color: "var(--muted)", marginTop: 2, marginBottom: 16 }}>{t("ukb.subtitle")}</div>
        <div style={{ position: "relative", maxWidth: 560 }}>
          <span style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", display: "grid", placeItems: "center", color: "var(--acc-teal-ink, var(--teal))" }}><Icon name="sparkle" size={16} color="var(--acc-teal-ink, var(--teal))" /></span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("ukb.search")}
            style={{ width: "100%", fontSize: 13.5, padding: "13px 14px 13px 38px", borderRadius: "var(--r-md)", border: "1px solid var(--acc-teal-border, var(--line))", background: "var(--card)", color: "var(--text)", fontFamily: "var(--font-ui)" }} />
        </div>
      </div>

      {/* Chips de tipo (filtro) */}
      {types.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Chip active={!type} onClick={() => setType(null)} label={t("ukb.all")} />
          {types.map(([ty, n]) => <Chip key={ty} active={type === ty} onClick={() => setType(type === ty ? null : ty)} label={`${t(("kb.type." + ty) as MessageKey)} · ${n}`} />)}
        </div>
      )}

      {browsing ? (
        <>
          {/* Explora por tema (categorias reales) */}
          {categories.length > 0 && (
            <section>
              <SectionTitle>{t("ukb.categories")}</SectionTitle>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
                {categories.map(([c, n]) => {
                  const fam = kbFam(c);
                  return (
                  <button key={c} onClick={() => setCat(c)} className="cx-lift"
                    style={{ textAlign: "left", display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderRadius: "var(--r-lg)", background: `var(--acc-${fam}-bg, var(--card))`, border: `1px solid var(--acc-${fam}-border, var(--line))`, boxShadow: "var(--sh-e1, none)", cursor: "pointer" }}>
                    <span style={{ width: 38, height: 38, flexShrink: 0, borderRadius: 10, display: "grid", placeItems: "center", background: "var(--surface, var(--accent-soft))", color: `var(--acc-${fam}-ink, var(--accent-2))` }}><Icon name="folder" size={18} /></span>
                    <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                      <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c}</span>
                      <span style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>{n} {t("ukb.items")}</span>
                    </span>
                  </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* Mas consultados */}
          {popular.length > 0 && (
            <section>
              <SectionTitle>{t("ukb.popular")}</SectionTitle>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 12 }}>
                {popular.map((a) => <ArticleRowCard key={a.id} a={a} />)}
              </div>
            </section>
          )}
        </>
      ) : (
        <section>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
            <SectionTitle>{t("ukb.results")}</SectionTitle>
            <span style={{ fontSize: 12, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>{filtered.length}</span>
            {cat && <FilterPill label={cat} onClear={() => setCat(null)} />}
          </div>
          {filtered.length === 0 ? (
            <div style={{ background: "var(--card)", border: "1px dashed var(--line)", borderRadius: "var(--r-xl)", padding: 28, textAlign: "center", fontSize: 13, color: "var(--muted)" }}>{t("ukb.empty")}</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {filtered.map((a) => <ArticleRowCard key={a.id} a={a} />)}
            </div>
          )}
        </section>
      )}

    </div>
  );
}

function ArticleRowCard({ a }: { a: ArticleRow }) {
  return (
    <Link href={`/knowledge/${a.id}`} className="cx-lift" style={{ textDecoration: "none" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 15px", background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-md)", boxShadow: "var(--sh-e1, none)" }}>
        <span style={{ width: 32, height: 32, flexShrink: 0, borderRadius: 8, display: "grid", placeItems: "center", background: "var(--accent-soft)", color: "var(--accent-2)" }}><Icon name="folder" size={15} /></span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontSize: 13.5, fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.title}</span>
          <span style={{ fontSize: 11, color: "var(--muted)" }}>{a.category}</span>
        </span>
        <ArticleTypeBadge type={a.article_type} />
      </div>
    </Link>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "var(--fs-4)", letterSpacing: "var(--tracking-title, normal)", color: "var(--text)", marginBottom: 12 }}>{children}</div>;
}

function Chip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} style={{ fontSize: 12, fontWeight: 600, padding: "6px 13px", borderRadius: "var(--r-pill)", cursor: "pointer",
      background: active ? "var(--accent-soft)" : "var(--card)", border: active ? "1px solid var(--accent)" : "1px solid var(--line)", color: active ? "var(--accent-2)" : "var(--muted)" }}>{label}</button>
  );
}

function FilterPill({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <button onClick={onClear} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 600, padding: "4px 10px", borderRadius: "var(--r-pill)", background: "var(--accent-soft)", color: "var(--accent-2)", border: "none", cursor: "pointer" }}>
      {label} <Icon name="x" size={11} />
    </button>
  );
}
