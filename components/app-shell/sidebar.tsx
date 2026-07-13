"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import { Wordmark } from "./wordmark";
import { canSeeNav, primaryNavKeys } from "@/lib/nav/access";

// perm: permiso requerido para ver el item (string = exacto; array = any-of). Sin perm = visible
// a cualquier autenticado. Los roles admin (system_admin/tenant_admin) ven todo (bypass).
// absorbedInHub: el maestro vive tambien en el hub /catalog (Datos maestros). Se oculta del
// sidebar SOLO para quien puede ver el hub (masterdata.manage/admin); el resto lo conserva aqui.
type NavItem = { key: MessageKey; href: string; ready: boolean; perm?: string | string[]; absorbedInHub?: boolean };
type NavGroup = { label: MessageKey; items: NavItem[] };

// Navegacion agrupada por dominio (alineada al benchmark ITSM/ESM/Fintech). Todas las rutas
// existentes se conservan; solo se reagrupan para claridad y sentido de producto integrado.
const GROUPS: NavGroup[] = [
  {
    label: "nav.group.ops",
    items: [
      { key: "nav.dashboard", href: "/dashboard", ready: true, perm: "incident.read" },
      { key: "nav.workspace", href: "/workspace", ready: true, perm: "incident.read" },
      { key: "nav.incidents", href: "/incidents", ready: true, perm: "incident.read" },
      { key: "nav.triage", href: "/triage", ready: true, perm: "triage.manage" },
      { key: "nav.sla", href: "/sla-governance", ready: true, perm: "sla.read" },
      { key: "nav.customers", href: "/customers", ready: true, perm: "incident.read" },
      { key: "nav.analytics", href: "/analytics", ready: true, perm: "incident.read" },
      { key: "nav.selfservice", href: "/portal", ready: true },
      { key: "nav.partner", href: "/partner", ready: true },
    ],
  },
  {
    label: "nav.group.fintech",
    items: [
      { key: "nav.frauddisputes", href: "/fraud-disputes", ready: true, perm: ["fraud.read", "dispute.read"] },
      { key: "nav.risk", href: "/risk", ready: true, perm: "risk.read" },
      { key: "nav.servicecatalog", href: "/service-catalog", ready: true, perm: "service_catalog.read" },
    ],
  },
  {
    label: "nav.group.tech",
    items: [
      { key: "nav.majorincidents", href: "/major-incidents", ready: true, perm: "major_incident.read" },
      { key: "nav.problems", href: "/problems", ready: true, perm: "problem.read" },
      { key: "nav.changes", href: "/changes", ready: true, perm: "change.read" },
      { key: "nav.observability", href: "/observability", ready: true, perm: "observability.read" },
      { key: "nav.dependencies", href: "/dependencies", ready: true, perm: "cmdb.read" },
      { key: "nav.vendors", href: "/vendors", ready: true, perm: "vendor.read" },
    ],
  },
  {
    label: "nav.group.intel",
    items: [
      { key: "nav.knowledge", href: "/knowledge", ready: true, perm: "knowledge.read" },
      { key: "nav.aicenter", href: "/ai-center", ready: true, perm: "incident.read" },
      { key: "nav.rules", href: "/rules", ready: true, perm: "rule.read" },
      { key: "nav.workflows", href: "/workflows", ready: true, perm: "workflow.read" },
    ],
  },
  {
    label: "nav.group.evolution",
    items: [
      { key: "nav.projects", href: "/projects", ready: true, perm: "project.read" },
      { key: "nav.squads", href: "/squads", ready: true, perm: "squad.read", absorbedInHub: true },
      { key: "nav.talent", href: "/talent", ready: true, perm: "talent.read" },
      { key: "nav.resources", href: "/workload", ready: true, perm: "squad.read" },
    ],
  },
  {
    label: "nav.group.admin",
    items: [
      { key: "nav.admin", href: "/admin", ready: true, perm: "user.manage" },
      { key: "nav.processes", href: "/processes", ready: true, perm: "process.read", absorbedInHub: true },
      { key: "nav.areas", href: "/delivery-areas", ready: true, perm: "area.read" },
      { key: "nav.ledger", href: "/ledger", ready: true, perm: "audit.read" },
      { key: "nav.catalog", href: "/catalog", ready: true, perm: "masterdata.manage" },
    ],
  },
];


export function Sidebar({ userName, userRole, perms = [], isAdmin = false, roles = [] }: { userName: string; userRole: string; perms?: string[]; isAdmin?: boolean; roles?: string[] }) {
  const pathname = usePathname();
  const { t } = useI18n();
  const [showMore, setShowMore] = useState(false);

  // Cockpit por rol: se ve solo lo primario (perfil del rol); el resto permitido va a "Mas...".
  // El permiso sigue siendo el candado: un item nunca aparece si no hay permiso.
  const primary = primaryNavKeys(roles, isAdmin); // null = todo primario (admin / rol sin perfil)
  const isPrimary = (it: NavItem) => primary === null || primary.has(it.key);
  // Quien ve el hub de Datos maestros no necesita las entradas absorbidas (evita duplicar).
  const hasHub = isAdmin || perms.includes("masterdata.manage");
  const visible = (it: NavItem) => canSeeNav(it.perm, perms, isAdmin) && !(it.absorbedInHub && hasHub);

  const groups = GROUPS
    .map((g) => ({ ...g, items: g.items.filter((it) => visible(it) && isPrimary(it)) }))
    .filter((g) => g.items.length > 0);

  // Secundarios: permitidos pero fuera del cockpit del rol -> seccion "Mas..." colapsable.
  const secondary = primary === null ? [] : GROUPS.flatMap((g) => g.items).filter((it) => visible(it) && !isPrimary(it));

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
        {groups.map((g) => (
          <div key={g.label} style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "1.5px", color: "var(--sb-label)", padding: "0 12px 8px", fontWeight: 700 }}>
              {t(g.label)}
            </div>
            {g.items.map((item) => <NavLink key={item.href} item={item} active={pathname === item.href || pathname.startsWith(item.href + "/")} label={t(item.key)} soon={t("common.soon")} />)}
          </div>
        ))}

        {/* Mas...: opciones permitidas fuera del cockpit del rol */}
        {secondary.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <button onClick={() => setShowMore((s) => !s)}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", fontSize: 10, textTransform: "uppercase", letterSpacing: "1.5px", color: "var(--sb-label)", padding: "0 12px 8px", fontWeight: 700, background: "transparent", border: "none", cursor: "pointer" }}>
              <span>{t("nav.more")}</span>
              <span style={{ fontSize: 11, transition: "transform .15s", transform: showMore ? "rotate(90deg)" : "none" }}>›</span>
            </button>
            {showMore && secondary.map((item) => <NavLink key={item.href} item={item} active={pathname === item.href || pathname.startsWith(item.href + "/")} label={t(item.key)} soon={t("common.soon")} muted />)}
          </div>
        )}
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

function NavLink({ item, active, label, soon, muted }: { item: NavItem; active: boolean; label: string; soon: string; muted?: boolean }) {
  const base: React.CSSProperties = {
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
    padding: "10px 12px", borderRadius: 9, fontSize: 13.5, fontWeight: 600, marginBottom: 2,
    position: "relative", textDecoration: "none",
  };
  if (!item.ready) {
    return (
      <div style={{ ...base, color: "var(--sb-muted)", cursor: "default" }} aria-disabled title={soon}>
        <span>{label}</span>
        <span style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.5px", opacity: 0.7 }}>{soon}</span>
      </div>
    );
  }
  return (
    <Link href={item.href} style={{ ...base, color: active ? "var(--sb-fg-active)" : muted ? "var(--sb-muted)" : "var(--sb-fg)", background: active ? "var(--sb-hover)" : "transparent" }}>
      {active && <span style={{ position: "absolute", left: -12, top: 8, bottom: 8, width: 3, borderRadius: 3, background: "var(--accent)" }} />}
      <span>{label}</span>
    </Link>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/[\s@.]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "CX";
}
