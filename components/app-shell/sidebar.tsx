"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import { Wordmark } from "./wordmark";

type NavItem = { key: MessageKey; href: string; ready: boolean };
type NavGroup = { label: MessageKey; items: NavItem[] };

const GROUPS: NavGroup[] = [
  {
    label: "nav.group.ops",
    items: [
      { key: "nav.dashboard", href: "/dashboard", ready: true },
      { key: "nav.workspace", href: "/workspace", ready: true },
      { key: "nav.selfservice", href: "/portal", ready: true },
      { key: "nav.servicecatalog", href: "/service-catalog", ready: true },
      { key: "nav.analytics", href: "/analytics", ready: true },
      { key: "nav.triage", href: "/triage", ready: true },
      { key: "nav.incidents", href: "/incidents", ready: true },
      { key: "nav.majorincidents", href: "/major-incidents", ready: true },
      { key: "nav.problems", href: "/problems", ready: true },
      { key: "nav.changes", href: "/changes", ready: true },
      { key: "nav.customers", href: "/customers", ready: true },
      { key: "nav.frauddisputes", href: "/fraud-disputes", ready: true },
      { key: "nav.sla", href: "/sla-governance", ready: true },
      { key: "nav.risk", href: "/risk", ready: true },
      { key: "nav.projects", href: "/projects", ready: true },
      { key: "nav.rules", href: "/rules", ready: true },
    ],
  },
  {
    label: "nav.group.gov",
    items: [
      { key: "nav.workflows", href: "/workflows", ready: true },
      { key: "nav.resources", href: "/workload", ready: true },
      { key: "nav.squads", href: "/squads", ready: true },
      { key: "nav.talent", href: "/talent", ready: true },
      { key: "nav.aicenter", href: "/ai-center", ready: true },
      { key: "nav.ledger", href: "/ledger", ready: true },
      { key: "nav.knowledge", href: "/knowledge", ready: true },
      { key: "nav.catalog", href: "/catalog", ready: true },
      { key: "nav.dependencies", href: "/dependencies", ready: true },
      { key: "nav.areas", href: "/delivery-areas", ready: true },
      { key: "nav.vendors", href: "/vendors", ready: true },
      { key: "nav.observability", href: "/observability", ready: true },
      { key: "nav.partner", href: "/partner", ready: true },
    ],
  },
];

export function Sidebar({ userName, userRole }: { userName: string; userRole: string }) {
  const pathname = usePathname();
  const { t } = useI18n();

  return (
    <aside
      style={{
        width: 248,
        flexShrink: 0,
        background: "var(--sb-bg)",
        borderRight: "1px solid var(--sb-border)",
        display: "flex",
        flexDirection: "column",
        height: "100vh",
      }}
    >
      <div style={{ padding: 22, borderBottom: "1px solid var(--sb-border)" }}>
        <Wordmark />
        <div style={{ marginTop: 8, fontSize: 9.5, letterSpacing: "2px", textTransform: "uppercase", color: "var(--sb-muted)" }}>
          {t("app.tagline")}
        </div>
      </div>

      <nav style={{ flex: 1, overflowY: "auto", padding: "14px 12px" }}>
        {GROUPS.map((g) => (
          <div key={g.label} style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "1.5px", color: "var(--sb-label)", padding: "0 12px 8px", fontWeight: 700 }}>
              {t(g.label)}
            </div>
            {g.items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
              const label = t(item.key);
              const base: React.CSSProperties = {
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                padding: "10px 12px",
                borderRadius: 9,
                fontSize: 13.5,
                fontWeight: 600,
                marginBottom: 2,
                position: "relative",
                textDecoration: "none",
              };
              if (!item.ready) {
                return (
                  <div key={item.href} style={{ ...base, color: "var(--sb-muted)", cursor: "default" }} aria-disabled title={t("common.soon")}>
                    <span>{label}</span>
                    <span style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.5px", opacity: 0.7 }}>{t("common.soon")}</span>
                  </div>
                );
              }
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    ...base,
                    color: active ? "var(--sb-fg-active)" : "var(--sb-fg)",
                    background: active ? "var(--sb-hover)" : "transparent",
                  }}
                >
                  {active && (
                    <span style={{ position: "absolute", left: -12, top: 8, bottom: 8, width: 3, borderRadius: 3, background: "var(--accent)" }} />
                  )}
                  <span>{label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div style={{ padding: 14, borderTop: "1px solid var(--sb-border)", display: "flex", alignItems: "center", gap: 10 }}>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: "50%",
            background: "var(--sb-hover)",
            color: "var(--sb-fg-active)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            flexShrink: 0,
          }}
        >
          {initials(userName)}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--sb-fg-active)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {userName}
          </div>
          <div style={{ fontSize: 11, color: "var(--sb-muted)" }}>{userRole}</div>
        </div>
      </div>
    </aside>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/[\s@.]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "CX";
}
