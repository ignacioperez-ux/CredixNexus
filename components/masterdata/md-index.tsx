"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/provider";
import { CATALOGS } from "@/lib/masterdata/registry";

export function MdIndex({ counts }: { counts: Record<string, number> }) {
  const { t } = useI18n();
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14 }}>
      {CATALOGS.map((c) => (
        <Link key={c.key} href={`/catalog/${c.key}`}
          style={{ display: "block", textDecoration: "none", background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 18 }}>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, color: "var(--text)", marginBottom: 6 }}>{t(c.title)}</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 22, fontWeight: 500, color: "var(--accent-2)" }}>{counts[c.key] ?? 0}</div>
          <div style={{ fontSize: 11, color: "var(--muted)" }}>{t("md.records")}</div>
        </Link>
      ))}
    </div>
  );
}
