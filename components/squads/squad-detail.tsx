"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import type { RosterRow, SquadLeads, SquadInitiative } from "@/lib/squads/queries";
import type { SquadCapacity } from "@/lib/capacity/queries";
import { loadTone, toneColor, toneFg } from "@/lib/capacity/compute";
import { SQUAD_ROLES } from "@/lib/squads/validation";
import { addSquadMember, updateSquadMember, removeSquadMember } from "@/lib/squads/actions";
import { SquadRoleBadge } from "./badges";
import { BackButton } from "@/components/common/back-button";
import { ConceptTip } from "@/components/help/concept-tip";

type SquadView = { id: string; code: string; name: string; is_transversal: boolean; capacity_points: number | null; business_unit: { name: string } | null;
  mission?: string | null; squad_type?: string; tribe?: { name: string; code: string } | null; handles_run?: boolean; handles_change?: boolean };
type Assignable = { id: string; name: string; discipline: string | null; is_external: boolean };
const OPEN = ["proposed", "approved", "on_hold", "active"];
const TYPE_COLOR: Record<string, string> = { domain: "var(--accent)", enabler: "var(--st-eval)", transient: "var(--muted)" };

export function SquadDetail({ squad, roster, assignable, canManage, leads, initiatives = [], capacity = null }: { squad: SquadView; roster: RosterRow[]; assignable: Assignable[]; canManage: boolean; leads?: SquadLeads; initiatives?: SquadInitiative[]; capacity?: SquadCapacity | null }) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [newMember, setNewMember] = useState("");
  const [newRole, setNewRole] = useState("developer");
  const [newAlloc, setNewAlloc] = useState("100");
  const [editId, setEditId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState("");
  const [editAlloc, setEditAlloc] = useState("");

  const allocated = roster.filter((r) => r.status === "active").reduce((s, r) => s + (r.allocation_pct ?? 0), 0);
  const head: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "#8A948A", padding: "10px 12px", background: "var(--head-bg)" };

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) {
    setMsg(null);
    start(async () => { const r = await fn(); if (!r.ok) setMsg(r.error ?? "error"); else { after?.(); router.refresh(); } });
  }
  function add() { if (!newMember) return; run(() => addSquadMember(squad.id, { memberId: newMember, squadRole: newRole, allocationPct: Number(newAlloc) }), () => { setNewMember(""); setNewAlloc("100"); setNewRole("developer"); }); }
  function saveEdit(id: string) { run(() => updateSquadMember(id, squad.id, editRole, Number(editAlloc)), () => setEditId(null)); }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <BackButton fallback="/squads" />
      {/* Encabezado (hero credix.com: degradado calido en Claro, sobrio en Nexus) */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, background: "var(--hero-grad)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", boxShadow: "var(--sh-card)", padding: "20px 22px" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--accent-2)" }}>{squad.code}</span>
        <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 20, margin: 0, color: "var(--text)", display: "inline-flex", alignItems: "center", gap: 7 }}>{squad.name} <ConceptTip concept="squad" /></h1>
        {squad.squad_type && <span style={{ fontSize: 10.5, fontWeight: 700, color: TYPE_COLOR[squad.squad_type], background: "var(--paper)", border: `1px solid ${TYPE_COLOR[squad.squad_type]}`, padding: "2px 9px", borderRadius: "var(--r-pill)" }}>{t(("tribe.type." + squad.squad_type) as MessageKey)}</span>}
        {squad.tribe && <Link href="/evolucion/mapa" style={{ fontSize: 10.5, fontWeight: 600, color: "var(--accent-2)", background: "var(--accent-soft)", padding: "3px 10px", borderRadius: "var(--r-pill)", textDecoration: "none" }}>{squad.tribe.name}</Link>}
        {squad.is_transversal && <span style={{ fontSize: 10.5, fontWeight: 600, color: "var(--st-info)", background: "var(--st-info-bg)", padding: "3px 10px", borderRadius: "var(--r-pill)" }}>{t("sq.transversal")}</span>}
        <div style={{ flex: 1 }} />
        {canManage && <Link href={`/catalog/squads/${squad.id}/edit`} style={{ fontSize: 12.5, fontWeight: 600, color: "var(--accent-2)", textDecoration: "none" }}>{t("common.edit")}</Link>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        <Kpi label={t("sq.col.bu")} value={squad.business_unit?.name ?? "—"} />
        <Kpi label={t("sq.fte")} value={`${capacity ? capacity.fte : Math.round((allocated / 100) * 10) / 10} (${roster.filter((r) => r.status === "active").length} ${t("sq.people")})`} title={t("sq.fte.def")} />
        <Kpi label={t("sq.load")} value={capacity ? `${capacity.demand_points}/${capacity.capacity_points} · ${capacity.load_pct ?? "—"}%` : "—"} title={t("sq.load.def")} color={capacity ? toneFg(loadTone(capacity.load_pct)) : undefined} />
        <Kpi label={t("md.f.capacity")} value={squad.capacity_points ? `${squad.capacity_points} ${t("sq.pts")}` : "—"} />
      </div>

      {/* Squad 360: dominio + liderazgo + capacidad vs demanda + backlog */}
      <Squad360 squad={squad} leads={leads} initiatives={initiatives} capacity={capacity} t={t} />

      {msg && <div style={{ fontSize: 12, color: "var(--st-critical)" }}>{msg}</div>}

      <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", overflow: "hidden" }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--line)", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15 }}>{t("sq.roster")}</div>

        {canManage && (
          <div style={{ display: "flex", gap: 8, padding: "12px 16px", borderBottom: "1px solid var(--line-soft)", flexWrap: "wrap", alignItems: "center", background: "var(--paper)" }}>
            <select value={newMember} onChange={(e) => setNewMember(e.target.value)} style={{ ...inp, minWidth: 200 }}>
              <option value="">{t("sq.addpick")}</option>
              {assignable.map((m) => <option key={m.id} value={m.id}>{m.name}{m.is_external ? " · ext" : ""}{m.discipline ? ` (${m.discipline})` : ""}</option>)}
            </select>
            <select value={newRole} onChange={(e) => setNewRole(e.target.value)} style={inp}>{SQUAD_ROLES.map((r) => <option key={r} value={r}>{t(("sq.role." + r) as MessageKey)}</option>)}</select>
            <input type="number" min={0} max={100} value={newAlloc} onChange={(e) => setNewAlloc(e.target.value)} style={{ ...inp, width: 90 }} title={t("sq.col.allocation")} />
            <button onClick={add} disabled={pending || !newMember} style={{ fontSize: 12.5, fontWeight: 600, padding: "8px 14px", borderRadius: "var(--r-md)", border: "none", background: "var(--cta-bg)", color: "var(--cta-fg)", cursor: pending || !newMember ? "default" : "pointer" }}>+ {t("sq.add")}</button>
          </div>
        )}

        <div style={{ overflowX: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: `1.4fr 150px 110px 100px ${canManage ? "150px" : ""}`, minWidth: canManage ? 720 : 560 }}>
            {[t("sq.col.member"), t("sq.col.role"), t("sq.col.discipline"), t("sq.col.allocation")].concat(canManage ? [""] : []).map((h, i) => <div key={i} style={head}>{h}</div>)}
            {roster.filter((r) => r.status === "active").length === 0 && <div style={{ gridColumn: "1 / -1", padding: 28, textAlign: "center", color: "var(--muted)" }}>{t("sq.roster.empty")}</div>}
            {roster.filter((r) => r.status === "active").map((r) => (
              <div key={r.id} style={{ display: "contents" }}>
                <Cell>
                  <span>{r.member?.name ?? "—"}</span>
                  {r.member?.is_external && <span style={{ fontSize: 9.5, fontWeight: 700, color: "var(--st-high-fg)", marginLeft: 8 }}>EXT</span>}
                </Cell>
                <Cell>{editId === r.id ? <select value={editRole} onChange={(e) => setEditRole(e.target.value)} style={inp}>{SQUAD_ROLES.map((x) => <option key={x} value={x}>{t(("sq.role." + x) as MessageKey)}</option>)}</select> : <SquadRoleBadge role={r.squad_role} />}</Cell>
                <Cell muted>{r.member?.discipline ?? "—"}{r.member?.seniority ? ` · ${r.member.seniority}` : ""}</Cell>
                <Cell mono>{editId === r.id ? <input type="number" min={0} max={100} value={editAlloc} onChange={(e) => setEditAlloc(e.target.value)} style={{ ...inp, width: 70 }} /> : `${r.allocation_pct}%`}</Cell>
                {canManage && (
                  <div style={{ ...cellSt, gap: 6 }}>
                    {editId === r.id ? (
                      <>
                        <button onClick={() => saveEdit(r.id)} disabled={pending} style={btnMini}>{t("common.save")}</button>
                        <button onClick={() => setEditId(null)} disabled={pending} style={btnMini}>{t("common.cancel")}</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => { setEditId(r.id); setEditRole(r.squad_role); setEditAlloc(String(r.allocation_pct)); }} disabled={pending} style={btnMini}>{t("common.edit")}</button>
                        <button onClick={() => run(() => removeSquadMember(r.id, squad.id))} disabled={pending} style={{ ...btnMini, color: "var(--st-critical)" }}>{t("sq.remove")}</button>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const inp: React.CSSProperties = { fontSize: 12, padding: "7px 9px", borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: "var(--card)", color: "var(--text)", fontFamily: "var(--font-ui)" };
const btnMini: React.CSSProperties = { fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: "var(--card)", color: "var(--text)", cursor: "pointer" };
const cellSt: React.CSSProperties = { fontSize: 12.5, padding: "10px 12px", borderTop: "1px solid var(--line-soft)", display: "flex", alignItems: "center", color: "var(--text)" };
function Cell({ children, mono, muted }: { children: React.ReactNode; mono?: boolean; muted?: boolean }) {
  return <div style={{ ...cellSt, fontFamily: mono ? "var(--font-mono)" : "var(--font-ui)", color: muted ? "var(--muted)" : "var(--text)" }}>{children}</div>;
}
function Kpi({ label, value, title, color }: { label: string; value: string; title?: string; color?: string }) {
  return <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 14 }} title={title}>
    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", marginBottom: 8 }}>{label}</div>
    <div style={{ fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums", fontWeight: 500, fontSize: 18, color: color ?? "var(--text)" }}>{value}</div></div>;
}

function Squad360({ squad, leads, initiatives, capacity, t }: { squad: SquadView; leads?: SquadLeads; initiatives: SquadInitiative[]; capacity?: SquadCapacity | null; t: (k: MessageKey) => string }) {
  const open = initiatives.filter((i) => OPEN.includes(i.status));
  // Demanda CANONICA (§0): esfuerzo de tareas abiertas via project.squad_id — misma fuente en todo el app.
  const demand = capacity ? capacity.demand_points : 0;
  const cap = capacity ? capacity.capacity_points : (squad.capacity_points ?? 0);
  const loadPct = capacity ? capacity.load_pct : (cap > 0 ? Math.round((demand / cap) * 100) : null);
  const over = loadPct != null && loadPct > 100;
  const barColor = toneColor(loadTone(loadPct));
  const card: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 18 };
  const h3: React.CSSProperties = { fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, color: "var(--text)", marginBottom: 12, display: "flex", alignItems: "center", gap: 7 };
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 16, alignItems: "start" }}>
      <div style={card}>
        <div style={h3}>{t("sq360.title")} <ConceptTip concept="domain" /></div>
        <Row360 label={t("sq360.mission")} value={squad.mission || "—"} wrap />
        <Row360 label={t("sq360.runchange")} value={[squad.handles_run !== false ? t("sq360.run") : null, squad.handles_change !== false ? t("sq360.change") : null].filter(Boolean).join(" · ") || "—"} />
        <Row360 label={t("sq360.po")} value={leads?.po ?? "—"} />
        <Row360 label={t("sq360.bo")} value={leads?.businessOwner ?? "—"} />
        <Row360 label={t("sq360.tech")} value={leads?.techLead ?? "—"} />
        <Row360 label={t("sq360.agile")} value={leads?.agileLead ?? "—"} last />
      </div>
      <div style={card}>
        <div style={h3}>{t("sq360.backlog")} <ConceptTip concept="capacity" /></div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 5 }}>
          <span style={{ color: "var(--muted)" }}>{t("sq360.demand")}</span>
          <span style={{ fontFamily: "var(--font-mono)", color: over ? "var(--st-critical-fg)" : "var(--muted)" }}>{demand}/{cap}{loadPct != null ? ` · ${loadPct}%` : ""}</span>
        </div>
        <div style={{ height: 8, background: "var(--track, var(--paper))", borderRadius: 4, overflow: "hidden", marginBottom: 12 }}>
          <div style={{ width: `${Math.min(100, loadPct ?? 0)}%`, height: "100%", background: barColor, borderRadius: 4 }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {open.length === 0 && <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("sq360.nobacklog")}</div>}
          {open.map((i) => (
            <Link key={i.id} href={`/projects/${i.id}`} className="cx-row" style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 7px", borderRadius: 7, textDecoration: "none" }}>
              {i.role === "lead" && <span title={t("initsq.lead")} style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)", flexShrink: 0 }} />}
              <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{i.name}</span>
              <span style={{ fontSize: 9.5, fontWeight: 700, color: "var(--accent-2)", textTransform: "uppercase" }}>{t(("init.type." + i.initiative_type) as MessageKey)}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, fontWeight: 700, color: "var(--accent-2)", width: 30, textAlign: "right" }}>{Number(i.wsjf).toFixed(1)}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
function Row360({ label, value, wrap, last }: { label: string; value: string; wrap?: boolean; last?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "6px 0", borderBottom: last ? "none" : "1px solid var(--line-soft)" }}>
      <span style={{ fontSize: 12, color: "var(--muted)", flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 12.5, color: "var(--text)", textAlign: "right", ...(wrap ? {} : { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }) }}>{value}</span>
    </div>
  );
}
