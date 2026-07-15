"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import type { KbReviewItem } from "@/lib/knowledge/queries";
import { publishArticle, discardArticle } from "@/lib/knowledge/actions";
import { ConceptTip } from "@/components/help/concept-tip";
import { Icon } from "@/components/ui/icon";

const SRC_COLOR: Record<string, string> = { incident: "var(--st-info)", project: "var(--accent-2)", change: "var(--st-eval)", major_incident: "var(--st-critical-fg)", problem: "var(--st-high-fg)" };
const SRC_CONCEPT: Record<string, string> = { incident: "case", project: "initiative", change: "change_cab", major_incident: "major_incident", problem: "problem" };

export function KbReviewBoard({ items }: { items: KbReviewItem[] }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean }>) => start(async () => { await fn(); router.refresh(); });
  const fmtDate = (v: string) => new Date(v).toLocaleDateString(locale === "es" ? "es-CR" : "en-US", { day: "2-digit", month: "short", year: "2-digit" });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ background: "var(--hero-grad)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", boxShadow: "var(--sh-card)", padding: "22px 24px" }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 22, color: "var(--text)", margin: 0 }}>{t("kbr.title")} {items.length > 0 && <span style={{ fontFamily: "var(--font-mono)", fontSize: 16, color: "var(--accent)" }}>· {items.length}</span>}</h1>
        <p style={{ fontSize: 13, color: "var(--muted)", margin: "6px 0 0", maxWidth: 720 }}>{t("kbr.subtitle")}</p>
      </div>

      {items.length === 0 ? (
        <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: "40px 20px", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>{t("kbr.empty")}</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {items.map((a) => (
            <div key={a.id} style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", boxShadow: "var(--sh-e1, none)", padding: "14px 16px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--muted)" }}>{a.article_number}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{a.title}</span>
                  <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".3px", color: "var(--accent-2)", background: "var(--accent-soft)", padding: "1px 7px", borderRadius: "var(--r-pill)" }}>{t(("kb.type." + a.article_type) as MessageKey)}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 5, fontSize: 11.5, color: "var(--muted)" }}>
                  {a.source ? (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                      <span style={{ color: SRC_COLOR[a.source.kind] ?? "var(--muted)", fontWeight: 700 }}>{t(("kbr.src." + a.source.kind) as MessageKey)}</span>
                      {a.source.href ? <Link href={a.source.href} style={{ fontFamily: "var(--font-mono)", color: "var(--accent-2)", textDecoration: "none" }}>{a.source.label}</Link> : <span style={{ fontFamily: "var(--font-mono)" }}>{a.source.label}</span>}
                      {SRC_CONCEPT[a.source.kind] && <ConceptTip concept={SRC_CONCEPT[a.source.kind]} size={13} />}
                    </span>
                  ) : <span>{t("kbr.src.manual")}</span>}
                  <span>· {fmtDate(a.created_at)}</span>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <Link href={`/knowledge/${a.id}`} style={btn}><Icon name="edit" size={12} /> {t("kbr.open")}</Link>
                <button onClick={() => run(() => discardArticle(a.id))} disabled={pending} style={btn}>{t("kbr.discard")}</button>
                <button onClick={() => run(() => publishArticle(a.id))} disabled={pending} style={{ ...btn, background: "var(--cta-bg)", color: "var(--cta-fg)", border: "none" }}><Icon name="check" size={12} /> {t("kbr.publish")}</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const btn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 700, padding: "7px 12px", borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: "var(--card)", color: "var(--text)", cursor: "pointer", textDecoration: "none" };
