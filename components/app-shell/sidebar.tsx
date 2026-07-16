"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { Wordmark } from "./wordmark";
import { Icon } from "@/components/ui/icon";
import { canSeeNav } from "@/lib/nav/access";
import { navForRoles, type NavigationItem, type NavCategory } from "@/lib/nav/navigation";

// Sidebar de primer nivel = 8 categorias macro (Estructura Macro Aprobada - FASE 1).
// El arbol vive en lib/nav/navigation.ts (config centralizada). Aqui solo se renderiza:
// visibilidad por permiso (candado), progressive disclosure (categorias colapsables) y
// enfasis por rol (auto-expansion). Todas las rutas actuales se conservan; nada se elimina.

const SIDEBAR_OPEN_KEY = "credix.sidebar.open";

export function Sidebar({ userName, userRole, perms = [], isAdmin = false, roles = [] }: { userName: string; userRole: string; perms?: string[]; isAdmin?: boolean; roles?: string[] }) {
  const pathname = usePathname();
  const { t } = useI18n();

  // Quien ve el hub /catalog no necesita los maestros absorbidos (evita duplicar).
  const hasHub = isAdmin || perms.includes("masterdata.manage");
  const visible = (it: NavigationItem) => canSeeNav(it.perm, perms, isAdmin) && !(it.absorbedInHub && hasHub);

  // Arbol segun rol: overlay de persona para el Gerente de Evolucion, MACRO_NAV para el resto.
  const tree = navForRoles(roles, isAdmin);

  // Solo categorias con al menos un item permitido.
  const cats = tree
    .map((c) => ({ cat: c, items: c.items.filter(visible) }))
    .filter((g) => g.items.length > 0);

  // Categoria activa calculada sobre el arbol RENDERIZADO (no el global): el prefijo mas
  // especifico que contiene la ruta actual. Vale para MACRO_NAV y para el overlay de persona.
  const activeCat = activeCategoryId(cats, pathname);

  // Expandir/comprimir categorias es MANUAL y PERSISTENTE: el estado que el usuario elige se
  // conserva al navegar entre rutas y entre sesiones (localStorage). Ya NO se auto-comprime al
  // cambiar de ruta. La categoria activa se resalta pero no se auto-expande (el usuario decide).
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SIDEBAR_OPEN_KEY);
      if (saved) setOpen(new Set(JSON.parse(saved) as string[]));
    } catch { /* ignore */ }
  }, []);
  const toggle = (id: string) => setOpen((prev) => {
    const n = new Set(prev);
    if (n.has(id)) n.delete(id); else n.add(id);
    try { localStorage.setItem(SIDEBAR_OPEN_KEY, JSON.stringify([...n])); } catch { /* ignore */ }
    return n;
  });
  const isOpen = (id: string) => open.has(id);

  return (
    <aside style={{ width: 248, flexShrink: 0, background: "var(--sb-bg)", borderRight: "1px solid var(--sb-border)", display: "flex", flexDirection: "column", height: "100vh" }}>
      <style>{`.sb-cat,.sb-link{transition:background .13s ease,color .13s ease}.sb-cat:hover,.sb-link:hover:not(.sb-active){background:var(--sb-hover)}`}</style>
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
                className="sb-cat"
                style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "9px 12px", borderRadius: 9, border: "none", cursor: "pointer", background: activeHere ? "var(--sb-active, var(--sb-hover))" : "transparent", color: activeHere ? "var(--sb-fg-active)" : "var(--sb-fg)", fontSize: 13, fontWeight: 700, boxShadow: activeHere ? "var(--sh-black, none)" : "none" }}>
                <Icon name={cat.icon} size={16} color={activeHere ? "var(--accent)" : "var(--sb-muted)"} />
                <span style={{ flex: 1, textAlign: "left", letterSpacing: "0.2px" }}>{t(cat.label)}</span>
                <Icon name={expanded ? "chevron-down" : "chevron-right"} size={14} color="var(--sb-muted)" />
              </button>

              {expanded && (
                <div style={{ marginTop: 2, marginBottom: 6 }}>
                  {items.map((item) => {
                    const active = pathname === item.path || pathname.startsWith(item.path + "/");
                    return <NavLink key={item.id} href={item.path} active={active} label={t(item.label)} readOnly={item.readOnly} readOnlyLabel={t("nav.readonly")} />;
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

function NavLink({ href, active, label, readOnly, readOnlyLabel }: { href: string; active: boolean; label: string; readOnly?: boolean; readOnlyLabel?: string }) {
  return (
    <Link href={href} className={active ? "sb-link sb-active" : "sb-link"} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px 8px 38px", borderRadius: 9, fontSize: 13, fontWeight: active ? 700 : 500, marginBottom: 1, position: "relative", textDecoration: "none", color: active ? "var(--sb-fg-active)" : "var(--sb-fg)", background: active ? "var(--sb-active, var(--sb-hover))" : "transparent", boxShadow: active ? "var(--sh-black, none)" : "none" }}>
      {active && <span style={{ position: "absolute", left: 14, top: 7, bottom: 7, width: 3.5, borderRadius: 3, background: "var(--accent)" }} />}
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
      {readOnly && (
        <span title={readOnlyLabel} style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 3, fontSize: 9, fontWeight: 700, letterSpacing: "0.3px", textTransform: "uppercase", color: "var(--sb-muted)", border: "1px solid var(--sb-border)", borderRadius: 5, padding: "1px 5px" }}>
          <Icon name="lock" size={9} color="var(--sb-muted)" />
          {readOnlyLabel}
        </span>
      )}
    </Link>
  );
}

/** Categoria (del arbol renderizado) que contiene la ruta activa, por prefijo mas especifico. */
function activeCategoryId(cats: { cat: NavCategory; items: NavigationItem[] }[], pathname: string): string | null {
  let best: { id: string; len: number } | null = null;
  for (const { cat, items } of cats) {
    for (const it of items) {
      if (pathname === it.path || pathname.startsWith(it.path + "/")) {
        if (!best || it.path.length > best.len) best = { id: cat.id, len: it.path.length };
      }
    }
  }
  return best?.id ?? null;
}

function initials(name: string): string {
  const parts = name.trim().split(/[\s@.]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "CX";
}
