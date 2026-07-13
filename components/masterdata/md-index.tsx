"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import { CATALOGS } from "@/lib/masterdata/registry";

// Orden de las secciones del hub (todas las opciones de datos maestros bajo una sola entrada).
const GROUP_ORDER: MessageKey[] = ["md.grp.org", "md.grp.service", "md.grp.tech", "md.grp.governance"];

export function MdIndex({ counts }: { counts: Record<string, number> }) {
  const { t } = useI18n();
  const groups = GROUP_ORDER
    .map((g) => ({ group: g, items: CATALOGS.filter((c) => c.group === g) }))
    .filter((s) => s.items.length > 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <div>
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 20, color: "var(--text)" }}>{t("md.title")}</div>
        <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>{t("md.subtitle")}</div>
      </div>

      {groups.map((s) => (
        <div key={s.group} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px", color: "var(--muted)" }}>{t(s.group)}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 12 }}>
            {s.items.map((c) => (
              <Link key={c.key} href={c.explorerHref ?? `/catalog/${c.key}`} className="cx-lift"
                style={{ display: "block", textDecoration: "none", background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 16 }}>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14.5, color: "var(--text)", marginBottom: 6 }}>{t(c.title)}</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 22, fontWeight: 500, color: "var(--accent-2)" }}>{counts[c.key] ?? 0}</span>
                  <span style={{ fontSize: 11, color: "var(--muted)" }}>{t("md.records")}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
