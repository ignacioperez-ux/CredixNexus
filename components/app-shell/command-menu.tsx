"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import { Icon } from "@/components/ui/icon";
import { createClient } from "@/lib/supabase/client";
import { canSeeNav } from "@/lib/nav/access";
import { MACRO_NAV, QUICK_ACTIONS } from "@/lib/nav/navigation";
import { changeStatus, sendToEvolution } from "@/lib/incidents/actions";

// Command Menu global (Cmd/Ctrl+K). FASE 2: navegacion + acciones rapidas + busqueda de
// entidades + recientes. FASE 3.1: comandos que EJECUTAN sobre el ticket en contexto
// (resolver / enviar a evolucion), reutilizando las server actions endurecidas.

type Kind = "action" | "nav" | "entity" | "recent" | "command";
type Entry = { id: string; label: string; hint: string; icon: string; path: string; kind: Kind; run?: () => Promise<{ ok: boolean; error?: string }> };

const RECENTS_KEY = "cx:cmd:recents";
function loadRecents(): Entry[] {
  try { const v = JSON.parse(localStorage.getItem(RECENTS_KEY) ?? "[]"); return Array.isArray(v) ? v : []; } catch { return []; }
}
function pushRecent(e: Entry) {
  try {
    const cur = loadRecents().filter((x) => x.path !== e.path);
    cur.unshift({ ...e, kind: "recent" });
    localStorage.setItem(RECENTS_KEY, JSON.stringify(cur.slice(0, 6)));
  } catch { /* localStorage no disponible */ }
}

type SupabaseClient = ReturnType<typeof createClient>;
type EntityDef = { perm: string; table: string; cols: string; icon: string; typeKey: MessageKey; label: (r: Record<string, unknown>) => string; path: (r: Record<string, unknown>) => string; num?: string };
const ENTITIES: EntityDef[] = [
  { perm: "incident.read", table: "incident", cols: "id, incident_number, title", num: "incident_number", icon: "inbox", typeKey: "cmd.type.ticket",
    label: (r) => `${r.incident_number} · ${r.title}`, path: (r) => `/incidents/${r.id}` },
  { perm: "project.read", table: "project", cols: "id, project_code, name", num: "project_code", icon: "zap", typeKey: "cmd.type.project",
    label: (r) => `${r.project_code ? r.project_code + " · " : ""}${r.name}`, path: (r) => `/projects/${r.id}` },
  { perm: "incident.read", table: "party", cols: "id, display_name", icon: "users", typeKey: "cmd.type.customer",
    label: (r) => String(r.display_name), path: (r) => `/customers/${r.id}` },
  { perm: "knowledge.read", table: "knowledge_article", cols: "id, article_number, title", num: "article_number", icon: "sparkle", typeKey: "cmd.type.article",
    label: (r) => `${r.article_number} · ${r.title}`, path: (r) => `/knowledge/${r.id}` },
];

async function searchEntities(supabase: SupabaseClient, raw: string, perms: string[], isAdmin: boolean, t: (k: MessageKey) => string): Promise<Entry[]> {
  const q = raw.replace(/[%,()*]/g, " ").trim(); // sanea el patron para el filtro .or de PostgREST
  if (q.length < 2) return [];
  const like = `%${q}%`;
  const defs = ENTITIES.filter((e) => canSeeNav(e.perm, perms, isAdmin));
  const runs = defs.map(async (e) => {
    const cols = e.cols.split(",").map((c) => c.trim());
    const searchable = cols.filter((c) => c !== "id");
    const orFilter = searchable.map((c) => `${c}.ilike.${like}`).join(",");
    const { data } = await supabase.from(e.table).select(e.cols).or(orFilter).limit(6);
    const rows = (data ?? []) as unknown as Record<string, unknown>[];
    return rows.map((row) => ({ id: e.table + ":" + row.id, label: e.label(row), hint: t(e.typeKey), icon: e.icon, path: e.path(row), kind: "entity" as const }));
  });
  const groups = await Promise.all(runs);
  // "Abrir por numero": prioriza coincidencias exactas de numero cuando el query lo parece.
  const flat = groups.flat();
  const looksLikeNumber = /\d/.test(q);
  if (looksLikeNumber) {
    flat.sort((a, b) => Number(b.label.toLowerCase().startsWith(q.toLowerCase())) - Number(a.label.toLowerCase().startsWith(q.toLowerCase())));
  }
  return flat.slice(0, 12);
}

export function CommandMenu({ perms = [], isAdmin = false }: { perms?: string[]; isAdmin?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useI18n();
  const supabase = useMemo(() => createClient(), []);
  const [openMenu, setOpenMenu] = useState(false);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const [recents, setRecents] = useState<Entry[]>([]);
  const [entities, setEntities] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Ticket en contexto (si estamos en su detalle) -> comandos que ejecutan sobre el.
  const incMatch = pathname.match(/^\/incidents\/([^/]+)$/);
  const currentIncidentId = incMatch && incMatch[1] !== "new" ? incMatch[1] : null;

  // Comandos + navegacion + acciones (sincronas, sobre la config).
  const staticEntries = useMemo<Entry[]>(() => {
    const commands: Entry[] = [];
    if (currentIncidentId) {
      if (isAdmin || perms.includes("incident.resolve"))
        commands.push({ id: "cmd:resolve", label: t("cmd.cmd.resolve"), hint: t("cmd.group.command"), icon: "check", path: "", kind: "command", run: () => changeStatus(currentIncidentId, "resolved") });
      if (isAdmin || perms.includes("problem.manage") || perms.includes("project.manage"))
        commands.push({ id: "cmd:evolve", label: t("cmd.cmd.evolve"), hint: t("cmd.group.command"), icon: "zap", path: "", kind: "command", run: () => sendToEvolution(currentIncidentId) });
    }
    const actions: Entry[] = QUICK_ACTIONS
      .filter((a) => canSeeNav(a.perm, perms, isAdmin))
      .map((a) => ({ id: "qa:" + a.id, label: t(a.label), hint: t("cmd.group.actions"), icon: "plus", path: a.path, kind: "action" }));
    const nav: Entry[] = MACRO_NAV.flatMap((c) =>
      c.items.filter((it) => canSeeNav(it.perm, perms, isAdmin))
        .map((it) => ({ id: "nav:" + it.id, label: t(it.label), hint: t(c.label), icon: c.icon, path: it.path, kind: "nav" as const })),
    );
    return [...commands, ...actions, ...nav];
  }, [perms, isAdmin, t, currentIncidentId]);

  const results = useMemo<Entry[]>(() => {
    const s = q.trim().toLowerCase();
    // Sin query: recientes + estaticos, pero un estatico ya presente en recientes no se repite
    // (visitar Autoservicio/Conocimiento los dejaba en ambas listas -> opciones duplicadas).
    if (!s) {
      const recentPaths = new Set(recents.map((r) => r.path));
      return [...recents, ...staticEntries.filter((e) => !e.path || !recentPaths.has(e.path))];
    }
    const filtered = staticEntries.filter((e) => e.label.toLowerCase().includes(s) || e.hint.toLowerCase().includes(s));
    return [...entities, ...filtered];
  }, [q, recents, staticEntries, entities]);

  // Atajo global + evento del boton del header.
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

  useEffect(() => { if (openMenu) { setQ(""); setSel(0); setErr(null); setEntities([]); setRecents(loadRecents()); setTimeout(() => inputRef.current?.focus(), 0); } }, [openMenu]);
  useEffect(() => { setSel(0); setErr(null); }, [q]);

  // Busqueda de entidades (debounce + cancelacion de resultados obsoletos).
  useEffect(() => {
    const s = q.trim();
    if (s.length < 2) { setEntities([]); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    const h = setTimeout(async () => {
      const r = await searchEntities(supabase, s, perms, isAdmin, t);
      if (!cancelled) { setEntities(r); setLoading(false); }
    }, 240);
    return () => { cancelled = true; clearTimeout(h); };
  }, [q, perms, isAdmin, supabase, t]);

  async function go(e: Entry) {
    if (e.run) {
      setErr(null);
      const r = await e.run();
      if (!r.ok) { setErr(t("common.error")); return; }
      setOpenMenu(false); router.refresh(); return;
    }
    setOpenMenu(false);
    if (e.kind === "nav" || e.kind === "entity" || e.kind === "recent") pushRecent(e);
    router.push(e.path);
  }

  function onListKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setSel((i) => Math.min(i + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSel((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter" && results[sel]) { e.preventDefault(); go(results[sel]); }
  }

  if (!openMenu) return null;

  return (
    <div onClick={() => setOpenMenu(false)}
      style={{ position: "fixed", inset: 0, zIndex: 100, background: "var(--overlay)", display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: "12vh" }}>
      <div onClick={(e) => e.stopPropagation()} onKeyDown={onListKey}
        style={{ width: "min(640px, 92vw)", maxHeight: "70vh", display: "flex", flexDirection: "column", background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", boxShadow: "var(--sh-modal)", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 16px", borderBottom: "1px solid var(--line)" }}>
          <Icon name="search" size={17} color="var(--muted)" />
          <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("cmd.placeholder")}
            style={{ flex: 1, border: "none", outline: "none", background: "transparent", color: "var(--text)", fontSize: 14.5, fontFamily: "var(--font-ui)" }} />
          {loading && <span style={{ fontSize: 11, color: "var(--muted)" }}>{t("cmd.searching")}</span>}
          <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--muted)", border: "1px solid var(--line)", borderRadius: 6, padding: "2px 6px" }}>ESC</span>
        </div>

        {err && <div role="alert" style={{ fontSize: 12, color: "var(--st-critical-fg)", background: "var(--st-critical-bg)", padding: "8px 16px", borderBottom: "1px solid var(--line)" }}>{err}</div>}

        <div style={{ overflowY: "auto", padding: 6 }}>
          {results.length === 0 && !loading && (
            <div style={{ padding: "26px 16px", textAlign: "center", fontSize: 13, color: "var(--muted)" }}>{t("cmd.empty")}</div>
          )}
          {results.map((e, i) => {
            const active = i === sel;
            return (
              <button key={e.kind + e.id} onMouseEnter={() => setSel(i)} onClick={() => go(e)}
                style={{ display: "flex", alignItems: "center", gap: 11, width: "100%", textAlign: "left", padding: "10px 12px", borderRadius: "var(--r-md)", border: "none", cursor: "pointer", background: active ? "var(--sb-hover)" : "transparent" }}>
                <Icon name={e.kind === "recent" ? "chevron-right" : e.icon} size={16} color={active ? "var(--accent)" : "var(--muted)"} />
                <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.label}</span>
                <span style={{ fontSize: 11, color: "var(--muted)", whiteSpace: "nowrap" }}>{e.kind === "recent" ? t("cmd.recent") : e.hint}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
