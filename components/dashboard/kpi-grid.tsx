"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";

export type DashboardCounts = {
  apps: number;
  systems: number;
  processes: number;
  products: number;
  ledger: number;
};

const CARDS: { key: keyof DashboardCounts; label: MessageKey; href: string }[] = [
  { key: "apps", label: "dash.kpi.apps", href: "/cmdb?type=application" },
  { key: "systems", label: "dash.kpi.systems", href: "/cmdb?type=system" },
  { key: "processes", label: "dash.kpi.processes", href: "/catalog/processes" },
  { key: "products", label: "dash.kpi.products", href: "/catalog/products" },
  { key: "ledger", label: "dash.kpi.ledger", href: "/ledger" },
];

export function KpiGrid({ counts }: { counts: DashboardCounts }) {
  const { t } = useI18n();
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14, marginBottom: 16 }}>
        {CARDS.map((c) => (
          <Link
            key={c.key}
            href={c.href}
            className="cx-lift"
            style={{
              display: "block",
              textDecoration: "none",
              background: "var(--card)",
              border: "1px solid var(--line)",
              borderRadius: "var(--r-xl)",
              padding: 16,
            }}
          >
            <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--muted)", marginBottom: 10 }}>{t(c.label)}</div>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontWeight: 500, fontSize: 28, letterSpacing: "-1.5px", color: "var(--text)" }}>
                {counts[c.key].toLocaleString()}
              </span>
              <span style={{ fontSize: 14, color: "var(--accent-2)" }}>→</span>
            </div>
          </Link>
        ))}
      </div>
      <div style={{ fontSize: 12, color: "var(--muted)" }}>{t("dash.inventory")}</div>
    </>
  );
}
