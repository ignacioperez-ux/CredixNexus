"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n, useErrorMessage } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import type { MemberDetail, TalentOptions } from "@/lib/talent/queries";
import {
  updateMember, setMemberStatus, addMemberSkill, removeMemberSkill,
  addMemberExpertise, removeMemberExpertise, addMemberEvaluation, deleteMemberEvaluation,
} from "@/lib/talent/actions";
import { EXTERNAL_TYPES, DISCIPLINES, SENIORITIES, EXPERTISE_ENTITIES, EVAL_TYPES } from "@/lib/talent/validation";
import { scoreColor } from "@/lib/incidents/labels";
import { BackButton } from "@/components/common/back-button";
import { Icon } from "@/components/ui/icon";

export function MemberDetail({ detail, options, canManage }: { detail: MemberDetail; options: TalentOptions; canManage: boolean }) {
  const { t, locale } = useI18n();
  const errMsg = useErrorMessage();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const m = detail.member;

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, okMsg?: string) {
    setMsg(null);
    start(async () => { const r = await fn(); if (!r.ok) setMsg(errMsg(r.error ?? "ERR_INVALID_FORMAT")); else { setMsg(okMsg ?? null); router.refresh(); } });
  }

  const entName = (type: string, id: string) => (options.entities[type] ?? []).find((e) => e.id === id)?.name ?? id.slice(0, 8);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <BackButton fallback="/talent" />

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 20, margin: 0, color: "var(--text)" }}>{m.name}</h1>
          <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: "var(--r-pill)", background: "var(--paper)", color: "var(--muted)" }}>{m.is_external ? (m.external_type ? t(("tal.ext." + m.external_type) as MessageKey) : t("tal.type.external")) : t("tal.type.internal")}</span>
          {m.status !== "active" && <span style={{ fontSize: 11, color: "var(--st-critical-fg)" }}>({t("md.status.inactive")})</span>}
        </div>
        {canManage && (
          <button onClick={() => { if (m.status === "active" && !confirm(t("tal.confirm_deactivate"))) return; run(() => setMemberStatus(m.id, m.status === "active" ? "inactive" : "active")); }}
            disabled={pending} style={{ fontSize: 12, fontWeight: 600, padding: "7px 12px", borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: "var(--card)", color: m.status === "active" ? "var(--st-critical-fg)" : "var(--st-low-fg)", cursor: "pointer" }}>
            {m.status === "active" ? t("tal.deactivate") : t("tal.activate")}
          </button>
        )}
      </div>

      {msg && <div style={{ fontSize: 12.5, color: "var(--st-low-fg)", background: "var(--st-low-bg)", padding: "8px 12px", borderRadius: "var(--r-md)" }}>{msg}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 16, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <ProfileCard m={m} options={options} canManage={canManage} onSave={(input, cb) => run(() => updateMember(m.id, input).then((r) => { if (r.ok) cb(); return r; }), t("tal.saved"))} pending={pending} />
          <SkillsCard detail={detail} options={options} canManage={canManage} run={run} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <ExpertiseCard detail={detail} options={options} canManage={canManage} run={run} entName={entName} />
          <EvalsCard detail={detail} canManage={canManage} run={run} locale={locale} />
        </div>
      </div>
    </div>
  );
}

// ---- Perfil (editable) -------------------------------------------------------
function ProfileCard({ m, options, canManage, onSave, pending }: { m: MemberDetail["member"]; options: TalentOptions; canManage: boolean; onSave: (input: MemberInputLite, cb: () => void) => void; pending: boolean }) {
  const { t } = useI18n();
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState({
    name: m.name, email: m.email ?? "", isExternal: m.is_external, externalType: m.external_type ?? "subcontractor",
    deliveryAreaId: m.delivery_area_id ?? "", discipline: m.discipline ?? "", seniority: m.seniority ?? "", capacityPoints: String(m.capacity_points),
  });

  if (!edit) {
    return (
      <Card title={t("tal.section.profile")} action={canManage ? <button onClick={() => setEdit(true)} style={ghost}><Icon name="edit" size={13} style={{ verticalAlign: "-2px" }} /> {t("common.edit")}</button> : undefined}>
        <Row label={t("tal.f.stream")} value={m.area ? `${t(("tal.stream." + m.area.code) as MessageKey)}${m.area.lead_name ? " · " + m.area.lead_name : ""}` : "—"} />
        <Row label={t("tal.f.discipline")} value={m.discipline ?? "—"} />
        <Row label={t("tal.f.seniority")} value={m.seniority ?? "—"} />
        <Row label={t("tal.f.email")} value={m.email ?? "—"} />
        <Row label={t("tal.f.capacity")} value={String(m.capacity_points)} mono />
      </Card>
    );
  }
  return (
    <Card title={t("tal.section.profile")}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Lbl t={t("tal.f.name")}><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={inp} /></Lbl>
        <Lbl t={t("tal.f.email")}><input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} style={inp} /></Lbl>
        <Lbl t={t("tal.f.stream")}>
          <select value={form.deliveryAreaId} onChange={(e) => setForm({ ...form, deliveryAreaId: e.target.value })} style={inp}>
            {options.areas.map((a) => <option key={a.id} value={a.id}>{t(("tal.stream." + a.code) as MessageKey)}{a.lead_name ? ` · ${a.lead_name}` : ""}</option>)}
          </select>
        </Lbl>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Lbl t={t("tal.f.type")}>
            <select value={form.isExternal ? "external" : "internal"} onChange={(e) => setForm({ ...form, isExternal: e.target.value === "external" })} style={inp}>
              <option value="internal">{t("tal.type.internal")}</option><option value="external">{t("tal.type.external")}</option>
            </select>
          </Lbl>
          {form.isExternal ? (
            <Lbl t={t("tal.f.exttype")}><select value={form.externalType} onChange={(e) => setForm({ ...form, externalType: e.target.value })} style={inp}>{EXTERNAL_TYPES.map((x) => <option key={x} value={x}>{t(("tal.ext." + x) as MessageKey)}</option>)}</select></Lbl>
          ) : (
            <Lbl t={t("tal.f.seniority")}><select value={form.seniority} onChange={(e) => setForm({ ...form, seniority: e.target.value })} style={inp}><option value="">—</option>{SENIORITIES.map((s) => <option key={s} value={s}>{s}</option>)}</select></Lbl>
          )}
          <Lbl t={t("tal.f.discipline")}><select value={form.discipline} onChange={(e) => setForm({ ...form, discipline: e.target.value })} style={inp}><option value="">—</option>{DISCIPLINES.map((d) => <option key={d} value={d}>{d}</option>)}</select></Lbl>
          <Lbl t={t("tal.f.capacity")}><input type="number" min={1} max={40} value={form.capacityPoints} onChange={(e) => setForm({ ...form, capacityPoints: e.target.value })} style={inp} /></Lbl>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => onSave({ name: form.name, email: form.email || undefined, isExternal: form.isExternal, externalType: form.isExternal ? form.externalType : undefined, deliveryAreaId: form.deliveryAreaId, discipline: form.discipline || undefined, seniority: form.seniority || undefined, capacityPoints: Number(form.capacityPoints) }, () => setEdit(false))}
            disabled={pending} style={cta}>{t("tal.save")}</button>
          <button onClick={() => setEdit(false)} style={ghost}>{t("common.cancel")}</button>
        </div>
      </div>
    </Card>
  );
}

type MemberInputLite = { name: string; email?: string; isExternal: boolean; externalType?: string; deliveryAreaId: string; discipline?: string; seniority?: string; capacityPoints: number };

// ---- Competencias ------------------------------------------------------------
function SkillsCard({ detail, options, canManage, run }: { detail: MemberDetail; options: TalentOptions; canManage: boolean; run: RunFn }) {
  const { t } = useI18n();
  const [skillId, setSkillId] = useState("");
  const [level, setLevel] = useState("3");
  const has = new Set(detail.skills.map((s) => s.skill?.id));
  const avail = options.skills.filter((s) => !has.has(s.id));
  return (
    <Card title={`${t("tal.section.skills")} (${detail.skills.length})`}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {detail.skills.length === 0 && <div style={{ fontSize: 12, color: "var(--muted)" }}>{t("tal.skill.none")}</div>}
        {detail.skills.map((s) => (
          <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid var(--line-soft)" }}>
            <span style={{ fontSize: 12.5, flex: 1, color: "var(--text)" }}>{s.skill?.name ?? "—"}</span>
            <LevelDots n={s.level} />
            {canManage && <RemoveBtn onClick={() => run(() => removeMemberSkill(s.id, detail.member.id))} />}
          </div>
        ))}
      </div>
      {canManage && (
        <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center" }}>
          <select value={skillId} onChange={(e) => setSkillId(e.target.value)} style={{ ...inp, flex: 1 }}>
            <option value="">{t("tal.skill.pick")}</option>
            {avail.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select value={level} onChange={(e) => setLevel(e.target.value)} style={{ ...inp, width: 70 }}>{[1, 2, 3, 4, 5].map((l) => <option key={l} value={l}>{l}</option>)}</select>
          <button onClick={() => { if (skillId) run(() => addMemberSkill(detail.member.id, { skillId, level: Number(level) }).then((r) => { if (r.ok) setSkillId(""); return r; })); }} disabled={!skillId} style={cta}>+</button>
        </div>
      )}
    </Card>
  );
}

// ---- Experiencia (procesos, areas, productos, canales, tecnologias, servicios)
function ExpertiseCard({ detail, options, canManage, run, entName }: { detail: MemberDetail; options: TalentOptions; canManage: boolean; run: RunFn; entName: (t: string, id: string) => string }) {
  const { t } = useI18n();
  const [etype, setEtype] = useState<string>(EXPERTISE_ENTITIES[0]);
  const [eid, setEid] = useState("");
  const [level, setLevel] = useState("3");
  const opts = options.entities[etype] ?? [];
  const hasSet = new Set(detail.expertise.map((e) => `${e.entity_type}:${e.entity_id}`));
  const avail = opts.filter((o) => !hasSet.has(`${etype}:${o.id}`));
  return (
    <Card title={`${t("tal.section.expertise")} (${detail.expertise.length})`}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {detail.expertise.length === 0 && <div style={{ fontSize: 12, color: "var(--muted)" }}>{t("tal.exp.none")}</div>}
        {detail.expertise.map((e) => (
          <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid var(--line-soft)" }}>
            <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", color: "var(--accent-2)", width: 90, flexShrink: 0 }}>{t(("tal.ent." + e.entity_type) as MessageKey)}</span>
            <span style={{ fontSize: 12.5, flex: 1, color: "var(--text)" }}>{entName(e.entity_type, e.entity_id)}</span>
            <LevelDots n={e.level} />
            {canManage && <RemoveBtn onClick={() => run(() => removeMemberExpertise(e.id, detail.member.id))} />}
          </div>
        ))}
      </div>
      {canManage && (
        <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
          <select value={etype} onChange={(e) => { setEtype(e.target.value); setEid(""); }} style={{ ...inp, width: 140 }}>
            {EXPERTISE_ENTITIES.map((x) => <option key={x} value={x}>{t(("tal.ent." + x) as MessageKey)}</option>)}
          </select>
          <select value={eid} onChange={(e) => setEid(e.target.value)} style={{ ...inp, flex: 1, minWidth: 120 }}>
            <option value="">{t("tal.exp.pick")}</option>
            {avail.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          <select value={level} onChange={(e) => setLevel(e.target.value)} style={{ ...inp, width: 62 }}>{[1, 2, 3, 4, 5].map((l) => <option key={l} value={l}>{l}</option>)}</select>
          <button onClick={() => { if (eid) run(() => addMemberExpertise(detail.member.id, { entityType: etype, entityId: eid, level: Number(level) }).then((r) => { if (r.ok) setEid(""); return r; })); }} disabled={!eid} style={cta}>+</button>
        </div>
      )}
    </Card>
  );
}

// ---- Evaluaciones (efectividad + empatia) ------------------------------------
function EvalsCard({ detail, canManage, run, locale }: { detail: MemberDetail; canManage: boolean; run: RunFn; locale: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [ev, setEv] = useState({ evalType: "general", effectiveness: "", empathy: "", comment: "", entityId: "" });

  function save() {
    run(() => addMemberEvaluation(detail.member.id, {
      evalType: ev.evalType,
      effectiveness: ev.effectiveness === "" ? null : Number(ev.effectiveness),
      empathy: ev.empathy === "" ? null : Number(ev.empathy),
      comment: ev.comment || undefined,
      entityType: ev.evalType === "general" ? undefined : ev.evalType,
      entityId: ev.evalType === "general" ? undefined : ev.entityId,
    }).then((r) => { if (r.ok) { setOpen(false); setEv({ evalType: "general", effectiveness: "", empathy: "", comment: "", entityId: "" }); } return r; }), t("tal.eval.saved"));
  }

  return (
    <Card title={`${t("tal.section.evals")} (${detail.evaluations.length})`} action={canManage ? <button onClick={() => setOpen((o) => !o)} style={ghost}>{open ? <Icon name="x" size={12} /> : <Icon name="plus" size={12} />} {t("tal.eval.add")}</button> : undefined}>
      {open && canManage && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12, padding: 12, background: "var(--paper)", borderRadius: "var(--r-md)" }}>
          <select value={ev.evalType} onChange={(e) => setEv({ ...ev, evalType: e.target.value })} style={inp}>
            {EVAL_TYPES.map((x) => <option key={x} value={x}>{t(("tal.eval.type." + x) as MessageKey)}</option>)}
          </select>
          {ev.evalType !== "general" && <input value={ev.entityId} onChange={(e) => setEv({ ...ev, entityId: e.target.value })} placeholder={t("tal.eval.entity")} style={inp} />}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <Lbl t={t("tal.effectiveness") + " (0-100)"}><input type="number" min={0} max={100} value={ev.effectiveness} onChange={(e) => setEv({ ...ev, effectiveness: e.target.value })} style={inp} /></Lbl>
            <Lbl t={t("tal.empathy") + " (0-100)"}><input type="number" min={0} max={100} value={ev.empathy} onChange={(e) => setEv({ ...ev, empathy: e.target.value })} style={inp} /></Lbl>
          </div>
          <textarea value={ev.comment} onChange={(e) => setEv({ ...ev, comment: e.target.value })} rows={2} placeholder={t("tal.eval.comment")} style={{ ...inp, resize: "vertical", fontFamily: "var(--font-ui)" }} />
          <button onClick={save} style={{ ...cta, alignSelf: "flex-start" }}>{t("tal.eval.save")}</button>
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {detail.evaluations.length === 0 && <div style={{ fontSize: 12, color: "var(--muted)" }}>{t("tal.eval.none")}</div>}
        {detail.evaluations.map((e) => (
          <div key={e.id} style={{ borderTop: "1px solid var(--line-soft)", paddingTop: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", color: "var(--accent-2)" }}>{t(("tal.eval.type." + e.eval_type) as MessageKey)}</span>
              {e.performance_score != null && <ScorePill label={t("tal.effectiveness")} v={Number(e.performance_score)} />}
              {e.empathy_score != null && <ScorePill label={t("tal.empathy")} v={Number(e.empathy_score)} />}
              <span style={{ fontSize: 10.5, color: "var(--muted)", marginLeft: "auto" }}>{new Date(e.created_at).toLocaleDateString(locale)}{e.evaluator ? ` · ${t("tal.eval.by")} ${e.evaluator.full_name}` : ""}</span>
              {canManage && <RemoveBtn onClick={() => run(() => deleteMemberEvaluation(e.id, detail.member.id))} />}
            </div>
            {(e.comment || e.behavior_note || e.strengths) && <p style={{ margin: "6px 0 0", fontSize: 12.5, color: "var(--text)", lineHeight: 1.5 }}>{e.comment || e.behavior_note || e.strengths}</p>}
          </div>
        ))}
      </div>
    </Card>
  );
}

// ---- Piezas UI ---------------------------------------------------------------
type RunFn = (fn: () => Promise<{ ok: boolean; error?: string }>, okMsg?: string) => void;

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
function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "6px 0", borderBottom: "1px solid var(--line-soft)" }}>
    <span style={{ fontSize: 12, color: "var(--muted)" }}>{label}</span>
    <span style={{ fontSize: 12.5, color: "var(--text)", fontFamily: mono ? "var(--font-mono)" : "var(--font-ui)", textAlign: "right" }}>{value}</span></div>;
}
function Lbl({ t, children }: { t: string; children: React.ReactNode }) {
  return <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 11, fontWeight: 600, color: "var(--muted)" }}>{t}{children}</label>;
}
function LevelDots({ n }: { n: number }) {
  return <span style={{ display: "inline-flex", gap: 2 }}>{[1, 2, 3, 4, 5].map((i) => <span key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: i <= n ? "var(--accent-2)" : "var(--track)" }} />)}</span>;
}
function ScorePill({ label, v }: { label: string; v: number }) {
  return <span style={{ fontSize: 10.5, display: "inline-flex", alignItems: "center", gap: 5, padding: "2px 8px", borderRadius: "var(--r-pill)", background: "var(--paper)" }}>
    <span style={{ color: "var(--muted)" }}>{label}</span><b style={{ fontFamily: "var(--font-mono)", color: scoreColor(v) }}>{v}</b></span>;
}
function RemoveBtn({ onClick }: { onClick: () => void }) {
  const { t } = useI18n();
  return <button onClick={onClick} title={t("tal.remove")} style={{ display: "inline-flex", padding: 4, borderRadius: "var(--r-sm)", border: "none", background: "transparent", color: "var(--st-critical-fg)", cursor: "pointer" }}><Icon name="x" size={13} /></button>;
}

const inp: React.CSSProperties = { width: "100%", fontSize: 12.5, padding: "8px 10px", borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: "var(--card)", color: "var(--text)", fontFamily: "var(--font-ui)" };
const cta: React.CSSProperties = { fontSize: 12.5, fontWeight: 700, padding: "8px 14px", borderRadius: "var(--r-md)", border: "none", background: "var(--cta-bg)", color: "var(--cta-fg)", cursor: "pointer" };
const ghost: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, padding: "6px 10px", borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: "var(--card)", color: "var(--text)", cursor: "pointer" };
