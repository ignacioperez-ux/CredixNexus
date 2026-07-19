"use client";

import { Icon } from "@/components/ui/icon";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { useErrorMessage } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import type { MiUpdateRow, MiEvidence } from "@/lib/major-incidents/queries";
import { MI_NEXT, UPDATE_TYPES, isMiClosed } from "@/lib/major-incidents/validation";
import { postUpdate, changeMiStatus, assignCommand, uploadMiEvidence, deleteMiEvidence, reopenMajorIncident } from "@/lib/major-incidents/actions";
import { formatBytes } from "@/lib/casework/validation";
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

export function MiDetail({ mi, updates, people, ledger, canManage, commanderName, commanderScope, evidence, editable }: { mi: MiView; updates: MiUpdateRow[]; people: Person[]; ledger: LedgerRow[]; canManage: boolean; commanderName: string | null; commanderScope: "ops" | "evo"; evidence: MiEvidence[]; editable: boolean }) {
  const { t, locale } = useI18n();
  const errMsg = useErrorMessage();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  // Mensaje de error legible: MI_CLOSED tiene copy propio; el resto pasa por el diccionario de errores.
  const msgText = (code: string) => (code === "MI_CLOSED" ? t("mi.err.closed") : errMsg(code) ?? code);
  const closed = isMiClosed(mi.status);
  const canEdit = canManage && editable;
  const [uType, setUType] = useState("customer");
  const [uBody, setUBody] = useState("");
  const [nextMin, setNextMin] = useState("30");
  const nexts = MI_NEXT[mi.status] ?? [];
  // War-room: solo se enlaza si es http(s) valido Y el host es PUBLICAMENTE ruteable. Un host no
  // publico (.local, localhost, IP privada) NO se enlaza -> evita mandar al navegador a NXDOMAIN
  // (DNS_PROBE_FINISHED_NXDOMAIN). En ese caso se muestra para COPIAR (por si resuelve en la red interna).
  const bridge = classifyBridge(mi.bridge_url);
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
          {/* Sala virtual publica: enlace externo real (pestana nueva, seguro). */}
          {bridge.href && (
            <a href={bridge.href} target="_blank" rel="noopener noreferrer" style={{ ...btnGhost, color: "var(--accent-2)", borderStyle: "dashed", textDecoration: "none" } as React.CSSProperties}>
              <Icon name="link" size={13} color="var(--accent-2)" style={{ verticalAlign: "-2px" }} /> {t("mi.bridge")} <span aria-hidden>&#8599;</span>
            </a>
          )}
          {/* Sala virtual NO publica: no navega (evita NXDOMAIN); clic copia el enlace. */}
          {bridge.display && !bridge.href && (
            <BridgeCopyChip url={bridge.display} label={t("mi.bridge")} tip={t("mi.bridge.notpublic")} copyLabel={t("mi.bridge.copy")} copiedLabel={t("mi.bridge.copied")} />
          )}
        </div>
      </div>
      {msg && <div style={{ fontSize: 12, color: "var(--st-critical)" }}>{msgText(msg)}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Cerrado: SOLO LECTURA. Se muestra el motivo y (con permiso) el boton Reabrir. */}
          {closed && (
            <div style={{ background: "var(--st-medium-bg, var(--paper))", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: "14px 18px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <Icon name="lock" size={16} color="var(--muted)" />
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{t("mi.readonly.title")}</div>
                <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>{t("mi.readonly.hint")}</div>
              </div>
              {canManage && <button onClick={() => run(() => reopenMajorIncident(mi.id))} disabled={pending} style={btnPrimary}>{t("mi.reopen")}</button>}
            </div>
          )}

          {canEdit && (
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

          {/* Evidencia del incidente mayor: lista siempre visible; subir/borrar solo con MI activo. */}
          <EvidencePanel miId={mi.id} evidence={evidence} canEdit={canEdit} locale={locale} t={t} errMsg={errMsg} onDone={() => router.refresh()} />

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

/** Evidencia del incidente mayor: lista con descarga firmada; subir/borrar solo con MI activo (canEdit). */
function EvidencePanel({ miId, evidence, canEdit, locale, t, errMsg, onDone }: {
  miId: string; evidence: MiEvidence[]; canEdit: boolean; locale: string;
  t: (k: MessageKey) => string; errMsg: (code: string | null) => string | null; onDone: () => void;
}) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const failMsg = (code: string | null | undefined) => (code === "MI_CLOSED" ? t("mi.err.closed") : errMsg(code ?? null) ?? t("tri.act.error"));

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(null);
    const fd = new FormData();
    fd.set("file", file);
    start(async () => {
      const r = await uploadMiEvidence(miId, fd);
      if (inputRef.current) inputRef.current.value = "";
      if (!r.ok) { setErr(failMsg(r.error)); return; }
      onDone();
    });
  }
  function remove(id: string) {
    setErr(null);
    start(async () => { const r = await deleteMiEvidence(id, miId); if (!r.ok) setErr(failMsg(r.error)); else onDone(); });
  }

  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 20 }}>
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, marginBottom: 12 }}>{t("mi.evidence.title")}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {evidence.length === 0 && <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("mi.evidence.empty")}</div>}
        {evidence.map((a) => (
          <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", background: "var(--paper)", border: "1px solid var(--line)", borderRadius: "var(--r-md)" }}>
            <Icon name="paperclip" size={15} color="var(--muted)" />
            <div style={{ flex: 1, minWidth: 0 }}>
              {a.url
                ? <a href={a.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: "var(--accent-2)", textDecoration: "none", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>{a.file_name}</a>
                : <span style={{ fontSize: 13, color: "var(--text)" }}>{a.file_name}</span>}
              <div style={{ fontSize: 10.5, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>
                {formatBytes(a.size_bytes)}{a.uploaded_by ? ` · ${a.uploaded_by}` : ""} · {new Date(a.created_at).toLocaleDateString(locale)}
              </div>
            </div>
            {canEdit && <button onClick={() => remove(a.id)} disabled={pending} aria-label={t("att.delete")} title={t("att.delete")} style={{ width: 22, height: 22, border: "none", background: "transparent", color: "var(--st-critical-fg)", cursor: "pointer", fontSize: 15 }}>&times;</button>}
          </div>
        ))}
        {canEdit && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ alignSelf: "flex-start", fontSize: 12.5, fontWeight: 600, padding: "8px 14px", borderRadius: "var(--r-md)", border: "1px dashed var(--accent)", color: "var(--accent-2)", cursor: pending ? "default" : "pointer", opacity: pending ? 0.6 : 1 }}>
              {pending ? t("att.uploading") : `+ ${t("mi.evidence.add")}`}
              <input ref={inputRef} type="file" onChange={onPick} disabled={pending} style={{ display: "none" }} />
            </label>
            <span style={{ fontSize: 10.5, color: "var(--muted)" }}>{t("att.hint")}</span>
            {err && <div style={{ fontSize: 11.5, color: "var(--st-critical-fg)" }}>{err}</div>}
          </div>
        )}
      </div>
    </div>
  );
}

/** Clasifica el bridge_url del war-room:
 *  - href: solo si es http(s) valido Y el host es publicamente ruteable -> se puede enlazar.
 *  - display: el valor http(s) valido (para copiar) aunque el host no sea ruteable.
 *  Evita enlaces relativos / esquemas peligrosos y, sobre todo, evita mandar al navegador a un host
 *  no publico (p.ej. meet.credix.local) que cae en DNS_PROBE_FINISHED_NXDOMAIN. */
function classifyBridge(u: string | null): { href: string | null; display: string | null } {
  if (!u) return { href: null, display: null };
  const s = u.trim();
  if (!/^https?:\/\//i.test(s)) return { href: null, display: null };
  let host = "";
  try { host = new URL(s).hostname.toLowerCase(); } catch { return { href: null, display: null }; }
  return { href: isPublicHost(host) ? s : null, display: s };
}

/** Host resoluble en Internet publico (no .local/localhost/IP privada/host de una sola etiqueta). */
function isPublicHost(host: string): boolean {
  if (!host || host === "localhost") return false;
  if (/\.(local|internal|localhost|test|example|invalid)$/.test(host)) return false;
  if (!host.includes(".")) return false; // una sola etiqueta: no es un FQDN publico
  if (/^(127\.|10\.|192\.168\.|169\.254\.)/.test(host)) return false;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return false;
  return true;
}

/** Sala virtual no publica: chip que NO navega; al hacer clic copia el enlace al portapapeles. */
function BridgeCopyChip({ url, label, tip, copyLabel, copiedLabel }: { url: string; label: string; tip: string; copyLabel: string; copiedLabel: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* portapapeles no disponible */ }
  };
  return (
    <button type="button" onClick={copy} title={`${tip}\n${url}`} aria-label={`${label} — ${tip}`}
      style={{ ...btnGhost, color: "var(--muted)", borderStyle: "dashed", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
      <Icon name="link" size={13} color="var(--muted)" style={{ verticalAlign: "-2px" }} /> {label}
      <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--accent-2)" }}>{copied ? copiedLabel : copyLabel}</span>
    </button>
  );
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
