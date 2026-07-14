"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { Wordmark } from "./wordmark";
import { Icon } from "@/components/ui/icon";
import { canSeeNav } from "@/lib/nav/access";
import { emphasisForRoles } from "@/lib/nav/role-ux";
import { MACRO_NAV, categoryOfPath, type NavigationItem } from "@/lib/nav/navigation";

// Sidebar de primer nivel = 8 categorias macro (Estructura Macro Aprobada - FASE 1).
// El arbol vive en lib/nav/navigation.ts (config centralizada). Aqui solo se renderiza:
// visibilidad por permiso (candado), progressive disclosure (categorias colapsables) y
// enfasis por rol (auto-expansion). Todas las rutas actuales se conservan; nada se elimina.

export function Sidebar({ userName, userRole, perms = [], isAdmin = false, roles = [] }: { userName: string; userRole: string; perms?: string[]; isAdmin?: boolean; roles?: string[] }) {
  const pathname = usePathname();
  const { t } = useI18n();

  // Quien ve el hub /catalog no necesita los maestros absorbidos (evita duplicar).
  const hasHub = isAdmin || perms.includes("masterdata.manage");
  const visible = (it: NavigationItem) => canSeeNav(it.perm, perms, isAdmin) && !(it.absorbedInHub && hasHub);

  // Solo categorias con al menos un item permitido.
  const cats = MACRO_NAV
    .map((c) => ({ cat: c, items: c.items.filter(visible) }))
    .filter((g) => g.items.length > 0);

  const activeCat = categoryOfPath(pathname);

  // Enfasis por rol (FASE 2): categorias macro del cockpit del rol -> auto-expandidas.
  const emphasis = emphasisForRoles(roles, isAdmin);
  const [open, setOpen] = useState<Set<string>>(() => new Set(emphasis));
  const toggle = (id: string) => setOpen((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const isOpen = (id: string) => id === activeCat || open.has(id);

  return (
    <aside style={{ width: 248, flexShrink: 0, background: "var(--sb-bg)", borderRight: "1px solid var(--sb-border)", display: "flex", flexDirection: "column", height: "100vh" }}>
      <div style={{ padding: 22, borderBottom: "1px solid var(--sb-border)" }}>
        <Wordmark />
        <div style={{ marginTop: 8, fontSize: 9.5, letterSpacing: "2px", textTransform: "uppercase", color: "var(--sb-muted)" }}>
          {t("app.tagline")}
        </div>
      </div>

      <nav style={{ flex: 1, overflowY: "auto", padding: "12px 12px" }}>
        {cats.map(({ cat, items }) => {
          const expanded = isOpen(cat.id);
          const activeHere = cat.id === activeCat;
          return (
            <div key={cat.id} style={{ marginBottom: 4 }}>
              <button
                onClick={() => toggle(cat.id)}
                aria-expanded={expanded}
                style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "9px 12px", borderRadius: 9, border: "none", cursor: "pointer", background: "transparent", color: activeHere ? "var(--sb-fg-active)" : "var(--sb-fg)", fontSize: 13, fontWeight: 700 }}>
                <Icon name={cat.icon} size={16} color={activeHere ? "var(--accent)" : "var(--sb-muted)"} />
                <span style={{ flex: 1, textAlign: "left", letterSpacing: "0.2px" }}>{t(cat.label)}</span>
                <Icon name={expanded ? "chevron-down" : "chevron-right"} size={14} color="var(--sb-muted)" />
              </button>

              {expanded && (
                <div style={{ marginTop: 2, marginBottom: 6 }}>
                  {items.map((item) => {
                    const active = pathname === item.path || pathname.startsWith(item.path + "/");
                    return <NavLink key={item.id} href={item.path} active={active} label={t(item.label)} />;
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div style={{ padding: 14, borderTop: "1px solid var(--sb-border)", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 34, height: 34, borderRadius: "50%", background: "var(--sb-hover)", color: "var(--sb-fg-active)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-mono)", fontSize: 12, flexShrink: 0 }}>
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

function NavLink({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link href={href} style={{ display: "flex", alignItems: "center", padding: "8px 12px 8px 38px", borderRadius: 9, fontSize: 13, fontWeight: active ? 700 : 500, marginBottom: 1, position: "relative", textDecoration: "none", color: active ? "var(--sb-fg-active)" : "var(--sb-fg)", background: active ? "var(--sb-hover)" : "transparent" }}>
      {active && <span style={{ position: "absolute", left: 16, top: 9, bottom: 9, width: 3, borderRadius: 3, background: "var(--accent)" }} />}
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
    </Link>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/[\s@.]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "CX";
}
