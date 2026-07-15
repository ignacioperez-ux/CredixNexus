"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n, useErrorMessage } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import type { TribeRow, SquadLite } from "@/lib/tribes/queries";
import { SQUAD_TYPES } from "@/lib/tribes/validation";
import { createTribe, updateTribe, setTribeStatus, assignSquadToTribe, setSquadTypeLock } from "@/lib/tribes/actions";
import { ConceptTip } from "@/components/help/concept-tip";
import { Icon } from "@/components/ui/icon";
import { BackButton } from "@/components/common/back-button";

const TYPE_COLOR: Record<string, string> = { domain: "var(--accent)", enabler: "var(--st-eval)", transient: "var(--muted)" };
const emptyForm = { code: "", name: "", mission: "", valueStream: "" };

export function TribeMap({ tribes, squads, canManage }: { tribes: TribeRow[]; squads: SquadLite[]; canManage: boolean }) {
  const { t } = useI18n();
  const errMsg = useErrorMessage();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);

  const active = tribes.filter((t) => t.status !== "inactive");
  const squadsByTribe = (id: string | null) => squads.filter((s) => (s.tribe_id ?? null) === id);
  const untribed = squadsByTribe(null);
  const typeLabel = (ty: string) => t(("tribe.type." + ty) as MessageKey);

  const kpi = {
    tribes: active.length,
    domain: squads.filter((s) => s.squad_type === "domain").length,
    enabler: squads.filter((s) => s.squad_type === "enabler").length,
    untribed: untribed.length,
  };

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, okMsg?: string, after?: () => void) {
    setMsg(null); setErr(null);
    start(async () => { const r = await fn(); if (!r.ok) setErr(errMsg(r.error ?? "ERR_INVALID_FORMAT")); else { setMsg(okMsg ?? null); after?.(); router.refresh(); } });
  }
  function submit() {
    run(() => (editId ? updateTribe(editId, form) : createTribe(form)), t("tribe.saved"), () => { setForm(emptyForm); setEditId(null); setShowForm(false); });
  }
  function edit(tr: TribeRow) {
    setEditId(tr.id); setShowForm(true);
    setForm({ code: tr.code, name: tr.name, mission: tr.mission ?? "", valueStream: tr.value_stream ?? "" });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <BackButton fallback="/evolucion" />
      {/* Hero */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", background: "var(--hero-grad)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", boxShadow: "var(--sh-card)", padding: "22px 24px" }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 22, color: "var(--text)", margin: 0, display: "inline-flex", alignItems: "center", gap: 8 }}>
            {t("tribe.title")} <ConceptTip concept="tribe" />
          </h1>
          <p style={{ fontSize: 13, color: "var(--muted)", margin: "6px 0 0", maxWidth: 720 }}>{t("tribe.subtitle")}</p>
        </div>
        {canManage && (
          <button onClick={() => { setEditId(null); setForm(emptyForm); setShowForm((v) => !v); }} style={cta}>
            <Icon name={showForm ? "x" : "plus"} size={13} /> {t("tribe.new")}
          </button>
        )}
      </div>

      {(msg || err) && <div style={{ fontSize: 12.5, padding: "8px 12px", borderRadius: "var(--r-md)", background: err ? "var(--st-critical-bg)" : "var(--st-low-bg)", color: err ? "var(--st-critical-fg)" : "var(--st-low-fg)" }}>{err ?? msg}</div>}

      {/* Form alta/edicion */}
      {canManage && showForm && (
        <div style={{ background: "var(--card)", border: "1px solid var(--accent)", borderRadius: "var(--r-xl)", padding: 16, display: "grid", gridTemplateColumns: "120px 1.3fr 1.6fr auto", gap: 10, alignItems: "end" }}>
          <Field label={t("tribe.form.code")}><input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="CRE" style={inp} /></Field>
          <Field label={t("tribe.form.name")}><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t("tribe.form.name.ph")} style={inp} /></Field>
          <Field label={t("tribe.form.mission")}><input value={form.mission} onChange={(e) => setForm({ ...form, mission: e.target.value })} style={inp} /></Field>
          <button onClick={submit} disabled={pending} style={cta}>{editId ? t("tribe.save") : t("tribe.create")}</button>
        </div>
      )}

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
        <Kpi label={t("tribe.kpi.tribes")} value={kpi.tribes} />
        <Kpi label={t("tribe.kpi.domain")} value={kpi.domain} />
        <Kpi label={t("tribe.kpi.enabler")} value={kpi.enabler} />
        <Kpi label={t("tribe.kpi.untribed")} value={kpi.untribed} tone={kpi.untribed > 0 ? "warn" : undefined} />
      </div>

      {/* Leyenda */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, fontSize: 12.5, color: "var(--ink-2, var(--muted))" }}>
        {SQUAD_TYPES.map((ty) => (
          <span key={ty} style={{ display: "inline-flex", alignItems: "center", gap: 7, color: "var(--muted)" }}>
            <span style={{ width: 11, height: 11, borderRadius: 3, background: TYPE_COLOR[ty] }} /> {typeLabel(ty)}
          </span>
        ))}
        <ConceptTip concept="squad" />
      </div>

      {/* Tribus con sus squads */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 14 }}>
        {active.length === 0 && untribed.length === 0 && <Empty text={t("tribe.empty")} />}
        {active.map((tr) => (
          <TribeCard key={tr.id} tr={tr} squads={squadsByTribe(tr.id)} tribes={active} canManage={canManage}
            typeLabel={typeLabel} onEdit={() => edit(tr)}
            onToggle={() => run(() => setTribeStatus(tr.id, "inactive"), t("tribe.saved"))}
            onAssign={(sid, tid, ty) => run(() => assignSquadToTribe(sid, tid, ty), t("tribe.saved"))}
            onLock={(sid, locked) => run(() => setSquadTypeLock(sid, locked), t("tribe.saved"))}
            t={t} pending={pending} />
        ))}
        {/* Squads sin tribu */}
        {untribed.length > 0 && (
          <div style={{ background: "var(--card)", border: "1px dashed var(--line)", borderRadius: "var(--r-xl)", padding: 16 }}>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, color: "var(--st-high-fg)", marginBottom: 10 }}>{t("tribe.untribed")} · {untribed.length}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {untribed.map((s) => (
                <SquadRow key={s.id} s={s} tribes={active} canManage={canManage} typeLabel={typeLabel}
                  onAssign={(tid, ty) => run(() => assignSquadToTribe(s.id, tid, ty), t("tribe.saved"))}
                  onLock={(locked) => run(() => setSquadTypeLock(s.id, locked), t("tribe.saved"))} t={t} pending={pending} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TribeCard({ tr, squads, tribes, canManage, typeLabel, onEdit, onToggle, onAssign, onLock, t, pending }: {
  tr: TribeRow; squads: SquadLite[]; tribes: TribeRow[]; canManage: boolean; typeLabel: (ty: string) => string;
  onEdit: () => void; onToggle: () => void; onAssign: (sid: string, tid: string | null, ty?: string) => void; onLock: (sid: string, locked: boolean) => void; t: (k: MessageKey) => string; pending: boolean;
}) {
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", boxShadow: "var(--sh-card, none)", padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent-2)" }}>{tr.code}</span>
        <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 15, color: "var(--text)", flex: 1 }}>{tr.name}</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)" }}>{squads.length}</span>
        {canManage && <button title={t("common.edit")} onClick={onEdit} style={iconBtn}><Icon name="edit" size={12} /></button>}
        {canManage && <button title={t("tribe.deactivate")} onClick={onToggle} disabled={pending} style={iconBtn}><Icon name="x" size={12} /></button>}
      </div>
      {tr.mission && <p style={{ margin: 0, fontSize: 12, color: "var(--muted)", lineHeight: 1.45 }}>{tr.mission}</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 2 }}>
        {squads.length === 0 && <span style={{ fontSize: 12, color: "var(--muted)" }}>{t("tribe.nosquads")}</span>}
        {squads.map((s) => (
          <SquadRow key={s.id} s={s} tribes={tribes} canManage={canManage} typeLabel={typeLabel}
            onAssign={(tid, ty) => onAssign(s.id, tid, ty)} onLock={(locked) => onLock(s.id, locked)} t={t} pending={pending} />
        ))}
      </div>
    </div>
  );
}

function SquadRow({ s, tribes, canManage, typeLabel, onAssign, onLock, t, pending }: {
  s: SquadLite; tribes: TribeRow[]; canManage: boolean; typeLabel: (ty: string) => string;
  onAssign: (tid: string | null, ty?: string) => void; onLock: (locked: boolean) => void; t: (k: MessageKey) => string; pending: boolean;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <span style={{ width: 8, height: 8, borderRadius: 2, background: TYPE_COLOR[s.squad_type], flexShrink: 0 }} />
      <span style={{ fontSize: 12.5, color: "var(--text)", flex: 1, minWidth: 120 }}>{s.name}</span>
      {!canManage && <span style={{ fontSize: 10.5, color: "var(--muted)" }}>{typeLabel(s.squad_type)}{s.type_locked ? " 🔒" : ""}</span>}
      {canManage && (
        <>
          <select value={s.squad_type} onChange={(e) => onAssign(s.tribe_id, e.target.value)} disabled={pending} title={t("tribe.col.type")} style={sel}>
            {SQUAD_TYPES.map((ty) => <option key={ty} value={ty}>{typeLabel(ty)}</option>)}
          </select>
          <button onClick={() => onLock(!s.type_locked)} disabled={pending}
            title={s.type_locked ? t("tribe.lock.on") : t("tribe.lock.off")}
            style={{ display: "inline-flex", padding: 5, borderRadius: "var(--r-sm)", border: "1px solid var(--line)", cursor: "pointer",
              background: s.type_locked ? "var(--accent-soft)" : "var(--card)", color: s.type_locked ? "var(--accent)" : "var(--muted)" }}>
            <Icon name="lock" size={12} />
          </button>
          <select value={s.tribe_id ?? ""} onChange={(e) => onAssign(e.target.value || null)} disabled={pending} title={t("tribe.col.tribe")} style={sel}>
            <option value="">{t("tribe.untribed.opt")}</option>
            {tribes.map((tr) => <option key={tr.id} value={tr.id}>{tr.name}</option>)}
          </select>
        </>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 11, fontWeight: 600, color: "var(--muted)" }}>{label}{children}</label>;
}
function Kpi({ label, value, tone }: { label: string; value: number; tone?: "warn" }) {
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 16 }}>
      <div style={{ fontSize: 10.5, fontWeight: 600, color: "var(--muted)", marginBottom: 8 }}>{label}</div>
      <div style={{ fontFamily: "var(--font-mono)", fontWeight: 500, fontSize: 24, letterSpacing: "-1px", color: tone === "warn" ? "var(--st-high-fg)" : "var(--text)" }}>{value}</div>
    </div>
  );
}
function Empty({ text }: { text: string }) { return <div style={{ fontSize: 12.5, color: "var(--muted)", padding: "16px 0" }}>{text}</div>; }

const inp: React.CSSProperties = { width: "100%", fontSize: 12.5, padding: "8px 10px", borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: "var(--card)", color: "var(--text)", fontFamily: "var(--font-ui)" };
const sel: React.CSSProperties = { fontSize: 11.5, padding: "5px 7px", borderRadius: "var(--r-sm)", border: "1px solid var(--line)", background: "var(--card)", color: "var(--text)" };
const cta: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 700, padding: "9px 15px", borderRadius: "var(--r-md)", border: "none", background: "var(--cta-bg)", color: "var(--cta-fg)", cursor: "pointer", whiteSpace: "nowrap" };
const iconBtn: React.CSSProperties = { display: "inline-flex", padding: 5, borderRadius: "var(--r-sm)", border: "1px solid var(--line)", background: "var(--card)", color: "var(--muted)", cursor: "pointer" };
