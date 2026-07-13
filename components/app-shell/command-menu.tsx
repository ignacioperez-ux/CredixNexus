"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/provider";
import { Icon } from "@/components/ui/icon";
import { canSeeNav } from "@/lib/nav/access";
import { MACRO_NAV, QUICK_ACTIONS } from "@/lib/nav/navigation";

// Command Menu global (Cmd/Ctrl+K). Navegacion y acciones rapidas sobre la config
// centralizada (lib/nav/navigation.ts), respetando permisos por rol. FASE 1: navegar
// y crear; la busqueda de entidades (tickets, clientes, etc.) llega en Fase 2.

type Entry = { id: string; label: string; hint: string; icon: string; path: string; kind: "action" | "nav" };

export function CommandMenu({ perms = [], isAdmin = false }: { perms?: string[]; isAdmin?: boolean }) {
  const router = useRouter();
  const { t } = useI18n();
  const [openMenu, setOpenMenu] = useState(false);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const entries = useMemo<Entry[]>(() => {
    const actions: Entry[] = QUICK_ACTIONS
      .filter((a) => canSeeNav(a.perm, perms, isAdmin))
      .map((a) => ({ id: a.id, label: t(a.label), hint: t("cmd.group.actions"), icon: "plus", path: a.path, kind: "action" }));
    const nav: Entry[] = MACRO_NAV.flatMap((c) =>
      c.items
        .filter((it) => canSeeNav(it.perm, perms, isAdmin))
        .map((it) => ({ id: it.id, label: t(it.label), hint: t(c.label), icon: c.icon, path: it.path, kind: "nav" as const })),
    );
    return [...actions, ...nav];
  }, [perms, isAdmin, t]);

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return entries;
    return entries.filter((e) => e.label.toLowerCase().includes(s) || e.hint.toLowerCase().includes(s));
  }, [entries, q]);

  // Atajo global + evento desde el boton del header.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpenMenu((v) => !v); }
      else if (e.key === "Escape") setOpenMenu(false);
    }
    function onOpen() { setOpenMenu(true); }
    window.addEventListener("keydown", onKey);
    window.addEventListener("cx:open-command", onOpen);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("cx:open-command", onOpen); };
  }, []);

  useEffect(() => { if (openMenu) { setQ(""); setSel(0); setTimeout(() => inputRef.current?.focus(), 0); } }, [openMenu]);
  useEffect(() => { setSel(0); }, [q]);

  function go(e: Entry) { setOpenMenu(false); router.push(e.path); }

  function onListKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setSel((i) => Math.min(i + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSel((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter" && results[sel]) { e.preventDefault(); go(results[sel]); }
  }

  if (!openMenu) return null;

  return (
    <div onClick={() => setOpenMenu(false)}
      style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,.42)", display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: "12vh" }}>
      <div onClick={(e) => e.stopPropagation()} onKeyDown={onListKey}
        style={{ width: "min(620px, 92vw)", maxHeight: "70vh", display: "flex", flexDirection: "column", background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", boxShadow: "0 24px 60px -20px rgba(0,0,0,.5)", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 16px", borderBottom: "1px solid var(--line)" }}>
          <Icon name="search" size={17} color="var(--muted)" />
          <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("cmd.placeholder")}
            style={{ flex: 1, border: "none", outline: "none", background: "transparent", color: "var(--text)", fontSize: 14.5, fontFamily: "var(--font-ui)" }} />
          <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--muted)", border: "1px solid var(--line)", borderRadius: 6, padding: "2px 6px" }}>ESC</span>
        </div>

        <div style={{ overflowY: "auto", padding: 6 }}>
          {results.length === 0 && (
            <div style={{ padding: "26px 16px", textAlign: "center", fontSize: 13, color: "var(--muted)" }}>{t("cmd.empty")}</div>
          )}
          {results.map((e, i) => {
            const active = i === sel;
            return (
              <button key={e.kind + e.id} onMouseEnter={() => setSel(i)} onClick={() => go(e)}
                style={{ display: "flex", alignItems: "center", gap: 11, width: "100%", textAlign: "left", padding: "10px 12px", borderRadius: "var(--r-md)", border: "none", cursor: "pointer", background: active ? "var(--sb-hover)" : "transparent" }}>
                <Icon name={e.icon} size={16} color={active ? "var(--accent)" : "var(--muted)"} />
                <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: "var(--text)" }}>{e.label}</span>
                <span style={{ fontSize: 11, color: "var(--muted)" }}>{e.hint}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
