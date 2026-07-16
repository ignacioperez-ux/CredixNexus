"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import { Icon } from "@/components/ui/icon";
import { squadColor } from "@/lib/squad-member/colors";
import { squadRoleLabel } from "@/components/squad-member/role-label";
import { canManageSquadTasks } from "@/lib/squad-member/roles";
import { moveMyTask } from "@/lib/squad-member/actions";
import type { MySquad, MySquadDetail, MyTask } from "@/lib/squad-member/queries";

const COLS = ["todo", "doing", "blocked", "done"] as const;
const COL_DOT: Record<string, string> = { todo: "var(--muted)", doing: "var(--st-info)", blocked: "var(--st-critical-fg)", done: "var(--st-low-fg)" };

export function MySquadView({ squads, detail, activeSquadId, linked }: { squads: MySquad[]; detail: MySquadDetail | null; activeSquadId: string | null; linked: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [group, setGroup] = useState<"status" | "person">("status");

  if (!linked) return <Empty t={t} title="sm.nomember.title" hint="sm.nomember.hint" icon="users" />;
  if (squads.length === 0 || !detail?.squad) return <Empty t={t} title="sm.squad.empty.title" hint="sm.squad.empty.hint" icon="users" />;

  const sq = detail.squad;
  const c = squadColor(sq.code);
  const canManage = detail.myRole ? canManageSquadTasks(detail.myRole) : false;
  const nameById = new Map(detail.roster.map((r) => [r.member_id, r.name]));

  const move = (id: string, status: string) => start(async () => { await moveMyTask(id, status); router.refresh(); });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 1320 }}>
      {/* Selector de squad (si pertenece a varios) */}
      {squads.length > 1 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {squads.map((s) => {
            const active = s.squad_id === activeSquadId;
            const sc = squadColor(s.code);
            return (
              <Link key={s.squad_id} href={`/mi-squad?squad=${s.squad_id}`}
                style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 12px", borderRadius: "var(--r-pill)", textDecoration: "none", border: active ? `1px solid ${sc.fg}` : "1px solid var(--line)", background: active ? sc.bg : "var(--card)", color: active ? sc.fg : "var(--muted)", fontSize: 12.5, fontWeight: 600 }}>
                <span style={{ width: 9, height: 9, borderRadius: 3, background: sc.fg }} /> {s.code}
              </Link>
            );
          })}
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: c.fg, background: c.bg, border: `1px solid ${c.border}`, borderRadius: "var(--r-pill)", padding: "2px 9px" }}>{sq.code}</span>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: "var(--text)", margin: 0 }}>{sq.name}</h1>
        {sq.squad_type && <span style={{ fontSize: 10.5, fontWeight: 600, color: "var(--muted)", background: "var(--paper)", borderRadius: "var(--r-pill)", padding: "2px 9px" }}>{sq.squad_type}</span>}
        {sq.status && sq.status !== "active" && <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--st-high-fg)", background: "var(--st-high-bg)", borderRadius: "var(--r-pill)", padding: "2px 9px" }}>{sq.status.replace(/_/g, " ")}</span>}
      </div>
      {sq.mission && <p style={{ margin: 0, fontSize: 13, color: "var(--muted)", lineHeight: 1.5, maxWidth: 780 }}>{sq.mission}</p>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 16, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Objetivos (maestro no cargado -> vacio) */}
          <Card title={t("sm.squad.objectives")}><Muted t={t} k="sm.squad.noobjectives" /></Card>

          {/* Roster */}
          <Card title={`${t("sm.squad.roster")} (${detail.roster.length})`}>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {detail.roster.map((r) => (
                <div key={r.member_id} style={{ display: "flex", alignItems: "center", gap: 9, padding: "6px 0", borderBottom: "1px solid var(--line-soft)" }}>
                  <span style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--paper)", color: "var(--text)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{initials(r.name)}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: r.is_me ? 700 : 500, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}{r.is_me ? ` · ${t("sm.squad.you")}` : ""}</div>
                    <div style={{ fontSize: 10.5, color: "var(--muted)" }}>{squadRoleLabel(t, r.squad_role)}</div>
                  </div>
                  {r.is_external && <span style={{ fontSize: 9, fontWeight: 700, color: "var(--muted)", background: "var(--paper)", borderRadius: "var(--r-pill)", padding: "1px 7px" }}>{t("sm.squad.embedded")}</span>}
                  {/* % dedicacion: propia visible; la ajena no se expone */}
                  {r.is_me && <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, color: "var(--text)" }}>{r.allocation_pct}%</span>}
                </div>
              ))}
            </div>
          </Card>

          {/* Interlocutores de negocio (VinculoRC no cargado -> vacio) */}
          <Card title={t("sm.squad.interlocutors")}><Muted t={t} k="sm.squad.nointerlocutors" /></Card>
        </div>

        {/* Tablero del squad */}
        <Card title={t("sm.squad.board")} action={
          <div style={{ display: "inline-flex", gap: 4, background: "var(--paper)", borderRadius: "var(--r-pill)", padding: 2 }}>
            {(["status", "person"] as const).map((gk) => (
              <button key={gk} onClick={() => setGroup(gk)} style={{ fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: "var(--r-pill)", border: "none", cursor: "pointer", background: group === gk ? "var(--card)" : "transparent", color: group === gk ? "var(--text)" : "var(--muted)" }}>{t(("sm.squad.by." + gk) as MessageKey)}</button>
            ))}
          </div>
        }>
          {detail.tasks.length === 0 ? <Muted t={t} k="sm.squad.notasks" /> : group === "status" ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 8 }}>
              {COLS.map((col) => (
                <Col key={col} label={t(("sm.col." + col) as MessageKey)} dot={COL_DOT[col]} tasks={detail.tasks.filter((x) => x.status === col)} nameById={nameById} canManage={canManage} pending={pending} onMove={move} t={t} />
              ))}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[...new Set(detail.tasks.map((x) => x.assigned_member_id ?? "—"))].map((mid) => (
                <div key={mid ?? "—"}>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>{mid && nameById.get(mid) ? nameById.get(mid) : t("sm.squad.unassigned")}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {detail.tasks.filter((x) => (x.assigned_member_id ?? "—") === mid).map((x) => <MiniTask key={x.id} task={x} canManage={canManage} pending={pending} onMove={move} t={t} />)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function Col({ label, dot, tasks, nameById, canManage, pending, onMove, t }: { label: string; dot: string; tasks: MyTask[]; nameById: Map<string, string>; canManage: boolean; pending: boolean; onMove: (id: string, s: string) => void; t: (k: MessageKey) => string }) {
  return (
    <div style={{ background: "var(--head-bg)", borderRadius: 10, padding: 8, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "2px 3px 8px" }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: dot }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text)" }}>{label}</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--muted)", marginLeft: "auto" }}>{tasks.length}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {tasks.map((x) => <MiniTask key={x.id} task={x} withOwner nameById={nameById} canManage={canManage} pending={pending} onMove={onMove} t={t} />)}
      </div>
    </div>
  );
}

function MiniTask({ task, withOwner, nameById, canManage, pending, onMove, t }: { task: MyTask; withOwner?: boolean; nameById?: Map<string, string>; canManage: boolean; pending: boolean; onMove: (id: string, s: string) => void; t: (k: MessageKey) => string }) {
  const owner = withOwner && task.assigned_member_id ? nameById?.get(task.assigned_member_id) : null;
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 8, padding: "7px 9px", display: "flex", flexDirection: "column", gap: 5, opacity: pending ? 0.7 : 1 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", lineHeight: 1.3 }}>{task.title}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 10, color: "var(--muted)" }}>
        {owner && <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 90 }}>{owner}</span>}
        <span style={{ fontFamily: "var(--font-mono)" }}>{task.effort_points} pts</span>
        {canManage && (
          <select value={task.status} disabled={pending} onChange={(e) => onMove(task.id, e.target.value)}
            style={{ marginLeft: "auto", fontSize: 10, padding: "1px 5px", borderRadius: 5, border: "1px solid var(--line)", background: "var(--card)", color: "var(--text)", cursor: "pointer" }}>
            {COLS.map((s) => <option key={s} value={s}>{t(("sm.col." + s) as MessageKey)}</option>)}
          </select>
        )}
      </div>
    </div>
  );
}

function Card({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 12 }}>
        <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, color: "var(--text)" }}>{title}</span>
        {action}
      </div>
      {children}
    </div>
  );
}
function Muted({ t, k }: { t: (k: MessageKey) => string; k: string }) { return <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{t(k as MessageKey)}</div>; }
function Empty({ t, title, hint, icon }: { t: (k: MessageKey) => string; title: string; hint: string; icon: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "64px 20px", textAlign: "center", color: "var(--muted)" }}>
      <Icon name={icon} size={34} strokeWidth={1.4} color="var(--muted)" />
      <div style={{ fontSize: 14.5, fontWeight: 700, color: "var(--text)" }}>{t(title as MessageKey)}</div>
      <div style={{ fontSize: 12.5, maxWidth: 380, lineHeight: 1.5 }}>{t(hint as MessageKey)}</div>
    </div>
  );
}
function initials(name: string): string {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase() || "—";
}
