"use client";

import { Icon } from "@/components/ui/icon";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import type { MiUpdateRow } from "@/lib/major-incidents/queries";
import { MI_NEXT, UPDATE_TYPES } from "@/lib/major-incidents/validation";
import { postUpdate, changeMiStatus, assignCommand } from "@/lib/major-incidents/actions";
import { MiStatusBadge, SevBadge, UPDATE_COLOR } from "./badges";
import { BackButton } from "@/components/common/back-button";

type MiView = {
  id: string; mi_number: string; title: string; severity: string; status: string;
  summary: string | null; impact_summary: string | null; bridge_url: string | null;
  declared_at: string; resolved_at: string | null; next_update_due_at: string | null;
  incident: { id: string; incident_number: string; title: string } | null;
  commander: { full_name: string } | null; comms_lead: { full_name: string } | null;
  commander_user_id: string | null; comms_lead_user_id: string | null;
};
type Person = { id: string; full_name: string };
type LedgerRow = { block_height: number; action: string; current_hash: string; timestamp: string };

export function MiDetail({ mi, updates, people, ledger, canManage, commanderName, commanderScope }: { mi: MiView; updates: MiUpdateRow[]; people: Person[]; ledger: LedgerRow[]; canManage: boolean; commanderName: string | null; commanderScope: "ops" | "evo" }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [uType, setUType] = useState("customer");
  const [uBody, setUBody] = useState("");
  const [nextMin, setNextMin] = useState("30");
  const nexts = MI_NEXT[mi.status] ?? [];
  // Solo se enlaza al war-room si es una URL externa http(s) valida. Una URL relativa o con otro
  // esquema (p.ej. javascript:) NO se convierte en enlace: evita navegacion in-app rota o insegura.
  const bridgeHref = safeExternalUrl(mi.bridge_url);
  const overdue = mi.next_update_due_at && new Date(mi.next_update_due_at).toISOString() < new Date().toISOString() && mi.status !== "resolved" && mi.status !== "stood_down";

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) {
    setMsg(null);
    start(async () => { const r = await fn(); if (!r.ok) setMsg(r.error ?? "error"); else { after?.(); router.refresh(); } });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <BackButton fallback="/major-incidents" />
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--accent-2)" }}>{mi.mi_number}</span>
          <SevBadge severity={mi.severity} />
          <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 20, margin: 0, color: "var(--text)" }}>{mi.title}</h1>
          <MiStatusBadge status={mi.status} />
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          {/* Avanzar de estado (cadena de mando ITIL): acciones IN-APP, agrupadas y rotuladas. */}
          {canManage && nexts.length > 0 && (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".3px", color: "var(--muted)" }}>{t("mi.advance")}</span>
              {nexts.map((s) => <button key={s} onClick={() => run(() => changeMiStatus(mi.id, s))} disabled={pending} style={btnGhost}>{t(("mi.st." + s) as MessageKey)}</button>)}
            </div>
          )}
          {/* Enlace EXTERNO al puente/sala virtual: estilo distinto (guiones + flecha externa) para
              que no se confunda con un paso de la cadena de estado. Abre en pestana nueva y seguro. */}
          {bridgeHref && (
            <a href={bridgeHref} target="_blank" rel="noopener noreferrer" style={{ ...btnGhost, color: "var(--accent-2)", borderStyle: "dashed", textDecoration: "none" } as React.CSSProperties}>
              <Icon name="link" size={13} color="var(--accent-2)" style={{ verticalAlign: "-2px" }} /> {t("mi.bridge")} <span aria-hidden>&#8599;</span>
            </a>
          )}
        </div>
      </div>
      {msg && <div style={{ fontSize: 12, color: "var(--st-critical)" }}>{msg}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {canManage && (
            <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 20 }}>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, marginBottom: 12 }}>{t("mi.post.title")}</div>
              <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                <select value={uType} onChange={(e) => setUType(e.target.value)} style={{ ...inp, width: 160 }}>{UPDATE_TYPES.map((x) => <option key={x} value={x}>{t(("mi.ut." + x) as MessageKey)}</option>)}</select>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--muted)" }}>{t("mi.post.next")}<input value={nextMin} onChange={(e) => setNextMin(e.target.value)} style={{ ...inp, width: 60 }} />min</div>
              </div>
              <textarea value={uBody} onChange={(e) => setUBody(e.target.value)} rows={2} placeholder={t("mi.post.body")} style={{ ...inp, resize: "vertical" }} />
              <button onClick={() => run(() => postUpdate(mi.id, uType, uBody, nextMin ? Number(nextMin) : undefined), () => setUBody(""))} disabled={pending || !uBody} style={{ ...btnPrimary, marginTop: 8 }}>{t("mi.post.send")}</button>
            </div>
          )}

          <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 20 }}>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, marginBottom: 14 }}>{t("mi.timeline")}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {updates.length === 0 && <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("mi.noupdates")}</div>}
              {updates.map((u) => (
                <div key={u.id} style={{ display: "flex", gap: 10 }}>
                  <div style={{ width: 3, borderRadius: 3, background: UPDATE_COLOR[u.update_type] ?? "var(--line)", flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: UPDATE_COLOR[u.update_type] ?? "var(--muted)" }}>{t(("mi.ut." + u.update_type) as MessageKey)}</span>
                      <span style={{ fontSize: 10.5, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>{new Date(u.posted_at).toLocaleString(locale)}</span>
                      {u.poster && <span style={{ fontSize: 10.5, color: "var(--muted)" }}>· {u.poster.full_name}</span>}
                    </div>
                    <div style={{ fontSize: 13, color: "var(--text)", marginTop: 3, lineHeight: 1.5 }}>{u.body}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 20 }}>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, marginBottom: 14 }}>{t("mi.command")}</div>
            {/* Comandante FIJO por rol (§11): no editable. Gerencia de Operaciones por defecto;
                Lider de Evolucion si el caso ya paso a Evolucion. */}
            <CommanderRow label={t("mi.commander")} value={commanderName} hint={t(commanderScope === "evo" ? "mi.commander.byrole.evo" : "mi.commander.byrole.ops")} lockedTip={t("mi.commander.locked")} />
            <RoleRow label={t("mi.commslead")} value={mi.comms_lead?.full_name} people={people} current={mi.comms_lead_user_id} canManage={canManage} pending={pending} onSet={(uid) => run(() => assignCommand(mi.id, "comms_lead", uid))} />
            <Row label={t("mi.declared")} value={new Date(mi.declared_at).toLocaleString(locale)} mono />
            <Row label={t("mi.nextupdate")} value={mi.next_update_due_at ? new Date(mi.next_update_due_at).toLocaleString(locale) : null} mono style={overdue ? { color: "var(--st-critical)" } : undefined} />
            <Row label={t("mi.resolved")} value={mi.resolved_at ? new Date(mi.resolved_at).toLocaleString(locale) : null} mono />
          </div>

          {(mi.summary || mi.impact_summary) && (
            <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 20 }}>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, marginBottom: 12 }}>{t("mi.impact")}</div>
              {mi.summary && <p style={{ margin: "0 0 8px", fontSize: 13, lineHeight: 1.5, color: "var(--text)" }}>{mi.summary}</p>}
              {mi.impact_summary && <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5, color: "var(--muted)" }}>{mi.impact_summary}</p>}
            </div>
          )}

          {mi.incident && (
            <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 20 }}>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, marginBottom: 10 }}>{t("mi.source")}</div>
              <Link href={`/incidents/${mi.incident.id}`} style={{ fontSize: 12, color: "var(--accent-2)", textDecoration: "none", fontWeight: 600 }}>◂ {mi.incident.incident_number} · {mi.incident.title}</Link>
            </div>
          )}

          <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 20 }}>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, marginBottom: 12 }}>{t("inc.section.ledger")}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {ledger.length === 0 && <div style={{ fontSize: 12, color: "var(--muted)" }}>—</div>}
              {ledger.slice(0, 12).map((l) => (
                <div key={l.block_height} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5 }}>
                  <span style={{ fontFamily: "var(--font-mono)", color: "var(--muted)", width: 30 }}>#{l.block_height}</span>
                  <span style={{ color: "var(--text)", flex: 1 }}>{l.action}</span>
                  <span style={{ fontFamily: "var(--font-mono)", color: "var(--accent-2)", fontSize: 10 }}>{l.current_hash.slice(0, 8)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Solo acepta URLs externas absolutas http(s). Evita enlaces relativos (navegacion in-app rota)
 *  o esquemas peligrosos (javascript:, data:) que romperian o comprometerian la pantalla. */
function safeExternalUrl(u: string | null): string | null {
  if (!u) return null;
  const s = u.trim();
  if (!/^https?:\/\//i.test(s)) return null;
  try { new URL(s); return s; } catch { return null; }
}

const inp: React.CSSProperties = { fontSize: 12.5, padding: "8px 10px", borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: "var(--card)", color: "var(--text)", fontFamily: "var(--font-ui)", width: "100%" };
const btnPrimary: React.CSSProperties = { fontSize: 12.5, fontWeight: 600, padding: "8px 14px", borderRadius: "var(--r-md)", border: "none", background: "var(--cta-bg)", color: "var(--cta-fg)", cursor: "pointer" };
const btnGhost: React.CSSProperties = { fontSize: 12, fontWeight: 600, padding: "8px 12px", borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: "var(--card)", color: "var(--text)", cursor: "pointer" };
function Row({ label, value, mono, style }: { label: string; value?: string | null; mono?: boolean; style?: React.CSSProperties }) {
  return <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "6px 0", borderBottom: "1px solid var(--line-soft)" }}>
    <span style={{ fontSize: 12, color: "var(--muted)" }}>{label}</span>
    <span style={{ fontSize: 12.5, color: "var(--text)", fontFamily: mono ? "var(--font-mono)" : "var(--font-ui)", textAlign: "right", ...style }}>{value || "—"}</span></div>;
}
/** Comandante de solo lectura: asignado por rol, no modificable. Muestra candado + rotulo del rol. */
function CommanderRow({ label, value, hint, lockedTip }: { label: string; value: string | null; hint: string; lockedTip: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, padding: "6px 0", borderBottom: "1px solid var(--line-soft)" }}>
      <span style={{ fontSize: 12, color: "var(--muted)" }}>{label}</span>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2, minWidth: 0 }}>
        <span title={lockedTip} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, color: "var(--text)", fontWeight: 600, textAlign: "right" }}>
          <Icon name="lock" size={11} color="var(--muted)" style={{ verticalAlign: "-1px", flexShrink: 0 }} />
          {value || "—"}
        </span>
        <span style={{ fontSize: 10.5, color: "var(--muted)", textAlign: "right" }}>{hint}</span>
      </div>
    </div>
  );
}
function RoleRow({ label, value, people, current, canManage, pending, onSet }: { label: string; value?: string | null; people: Person[]; current: string | null; canManage: boolean; pending: boolean; onSet: (uid: string) => void }) {
  if (!canManage) return <Row label={label} value={value} />;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "6px 0", borderBottom: "1px solid var(--line-soft)" }}>
      <span style={{ fontSize: 12, color: "var(--muted)" }}>{label}</span>
      <select value={current ?? ""} onChange={(e) => onSet(e.target.value)} disabled={pending} style={{ ...inp, width: 170, fontSize: 12 }}>
        <option value="">—</option>
        {people.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
      </select>
    </div>
  );
}
