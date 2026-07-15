"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { useNavHistory } from "@/components/app-shell/nav-history-provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import type { ChangeFormOptions } from "@/lib/changes/queries";
import { createChange, updateChange, type ChangeInput } from "@/lib/changes/actions";
import { CHANGE_TYPES, RISK_LEVELS } from "@/lib/changes/validation";

type Initial = ChangeInput & { id?: string };

export function ChangeForm({ options, initial }: { options: ChangeFormOptions; initial?: Initial }) {
  const { t } = useI18n();
  const router = useRouter();
  const { back } = useNavHistory();
  const goBack = () => back(initial?.id ? `/changes/${initial.id}` : "/changes");
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState<ChangeInput>({
    title: initial?.title ?? "",
    description: initial?.description ?? "",
    changeType: initial?.changeType ?? "normal",
    riskLevel: initial?.riskLevel ?? "medium",
    justification: initial?.justification ?? "",
    implementationPlan: initial?.implementationPlan ?? "",
    rollbackPlan: initial?.rollbackPlan ?? "",
    affectedServiceId: initial?.affectedServiceId ?? "",
    affectedCiId: initial?.affectedCiId ?? "",
    relatedIncidentId: initial?.relatedIncidentId ?? null,
    relatedProblemId: initial?.relatedProblemId ?? null,
    plannedStart: initial?.plannedStart ?? "",
    plannedEnd: initial?.plannedEnd ?? "",
  });
  const set = (k: keyof ChangeInput, v: unknown) => setF((p) => ({ ...p, [k]: v }));

  function submit() {
    setErr(null);
    start(async () => {
      const r = initial?.id ? await updateChange(initial.id, f) : await createChange(f);
      if (!r.ok) { setErr(r.error ?? "error"); return; }
      router.push(initial?.id ? `/changes/${initial.id}` : `/changes/${r.id}`);
      router.refresh();
    });
  }

  return (
    <div style={{ maxWidth: 760, display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 22, display: "flex", flexDirection: "column", gap: 14 }}>
        <Field label={t("chg.f.title")} required><input value={f.title} onChange={(e) => set("title", e.target.value)} style={inp} /></Field>
        <Field label={t("chg.f.description")}><textarea value={f.description} onChange={(e) => set("description", e.target.value)} rows={2} style={{ ...inp, resize: "vertical" }} /></Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
          <Field label={t("chg.f.type")} required><select value={f.changeType} onChange={(e) => set("changeType", e.target.value)} style={inp}>{CHANGE_TYPES.map((x) => <option key={x} value={x}>{t(("chg.type." + x) as MessageKey)}</option>)}</select></Field>
          <Field label={t("chg.f.risk")} required><select value={f.riskLevel} onChange={(e) => set("riskLevel", e.target.value)} style={inp}>{RISK_LEVELS.map((x) => <option key={x} value={x}>{t(("chg.risk." + x) as MessageKey)}</option>)}</select></Field>
          <Field label={t("chg.f.service")}><select value={f.affectedServiceId} onChange={(e) => set("affectedServiceId", e.target.value)} style={inp}><option value="">—</option>{options.services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
        </div>
        <Field label={t("chg.f.ci")}><select value={f.affectedCiId} onChange={(e) => set("affectedCiId", e.target.value)} style={inp}><option value="">—</option>{options.apps.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field>
        <Field label={t("chg.f.justification")}><textarea value={f.justification} onChange={(e) => set("justification", e.target.value)} rows={2} style={{ ...inp, resize: "vertical" }} /></Field>
        <Field label={t("chg.f.implementation")}><textarea value={f.implementationPlan} onChange={(e) => set("implementationPlan", e.target.value)} rows={2} style={{ ...inp, resize: "vertical" }} /></Field>
        <Field label={t("chg.f.rollback")}><textarea value={f.rollbackPlan} onChange={(e) => set("rollbackPlan", e.target.value)} rows={2} style={{ ...inp, resize: "vertical" }} /></Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Field label={t("chg.f.pstart")}><input type="datetime-local" value={f.plannedStart ?? ""} onChange={(e) => set("plannedStart", e.target.value)} style={inp} /></Field>
          <Field label={t("chg.f.pend")}><input type="datetime-local" value={f.plannedEnd ?? ""} onChange={(e) => set("plannedEnd", e.target.value)} style={inp} /></Field>
        </div>
      </div>
      {err && <div style={{ fontSize: 12.5, color: "var(--st-critical)" }}>{err}</div>}
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={submit} disabled={pending} style={btnPrimary}>{pending ? t("common.saving") : t("common.save")}</button>
        <button onClick={goBack} disabled={pending} style={btnGhost}>{t("common.cancel")}</button>
      </div>
    </div>
  );
}

const inp: React.CSSProperties = { width: "100%", fontSize: 13, padding: "9px 11px", borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: "var(--card)", color: "var(--text)", fontFamily: "var(--font-ui)" };
const btnPrimary: React.CSSProperties = { fontSize: 13, fontWeight: 600, padding: "10px 18px", borderRadius: "var(--r-md)", border: "none", background: "var(--cta-bg)", color: "var(--cta-fg)", cursor: "pointer" };
const btnGhost: React.CSSProperties = { fontSize: 13, fontWeight: 600, padding: "10px 18px", borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: "var(--card)", color: "var(--text)", cursor: "pointer" };
function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return <div><label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "var(--muted)", marginBottom: 6 }}>{label}{required && <span style={{ color: "var(--st-critical)" }}> *</span>}</label>{children}</div>;
}
