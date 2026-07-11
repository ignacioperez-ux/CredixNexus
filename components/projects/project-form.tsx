"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n, useErrorMessage } from "@/lib/i18n/provider";
import { createProject, updateProject, type ProjectInput } from "@/lib/projects/actions";
import { minLength } from "@/lib/validation";

type Options = { squads: { id: string; name: string }[]; businessUnits: { id: string; name: string }[] };

export function ProjectForm({ options, mode, projectId, initial }: { options: Options; mode: "create" | "edit"; projectId?: string; initial?: Partial<ProjectInput> }) {
  const { t } = useI18n();
  const errMsg = useErrorMessage();
  const router = useRouter();

  const [f, setF] = useState<ProjectInput>({
    name: initial?.name ?? "",
    description: initial?.description ?? "",
    projectType: initial?.projectType ?? "evolution",
    squadId: initial?.squadId ?? "",
    businessUnitId: initial?.businessUnitId ?? "",
    estimatedBenefitAmount: initial?.estimatedBenefitAmount ?? 0,
    estimatedCostAmount: initial?.estimatedCostAmount ?? 0,
    businessValue: initial?.businessValue ?? 5,
    timeCriticality: initial?.timeCriticality ?? 5,
    riskReduction: initial?.riskReduction ?? 5,
    jobSize: initial?.jobSize ?? 5,
  });
  const [nameErr, setNameErr] = useState<string | null>(null);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof ProjectInput, v: string | number) => setF((s) => ({ ...s, [k]: v }));

  const wsjf = ((f.businessValue ?? 0) + (f.timeCriticality ?? 0) + (f.riskReduction ?? 0)) / Math.max(1, f.jobSize ?? 1);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const ne = minLength(f.name, 5);
    setNameErr(ne);
    setFormErr(null);
    if (ne) return;
    setBusy(true);
    const res = mode === "create" ? await createProject(f) : await updateProject(projectId as string, f);
    setBusy(false);
    if (!res.ok) { setFormErr(errMsg(res.error ?? "ERR_REQUIRED_FIELD")); return; }
    router.push(`/projects/${res.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} noValidate style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 720 }}>
      <Card title={t("proj.field.name")}>
        <Field label={t("proj.field.name")} error={errMsg(nameErr)}>
          <input style={inp(!!nameErr)} value={f.name} onChange={(e) => set("name", e.target.value)} />
        </Field>
        <Field label={t("proj.field.description")}>
          <textarea style={{ ...inp(false), minHeight: 80, resize: "vertical" }} value={f.description} onChange={(e) => set("description", e.target.value)} />
        </Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label={t("proj.field.squad")}>
            <select style={inp(false)} value={f.squadId} onChange={(e) => set("squadId", e.target.value)}>
              <option value="">{t("proj.field.none")}</option>
              {options.squads.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Field label={t("proj.field.bu")}>
            <select style={inp(false)} value={f.businessUnitId} onChange={(e) => set("businessUnitId", e.target.value)}>
              <option value="">{t("proj.field.none")}</option>
              {options.businessUnits.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </Field>
          <Field label={t("proj.field.benefit")}>
            <input type="number" min={0} step="1000" style={{ ...inp(false), fontFamily: "var(--font-mono)" }} value={f.estimatedBenefitAmount} onChange={(e) => set("estimatedBenefitAmount", Number(e.target.value))} />
          </Field>
          <Field label={t("proj.field.cost")}>
            <input type="number" min={0} step="1000" style={{ ...inp(false), fontFamily: "var(--font-mono)" }} value={f.estimatedCostAmount} onChange={(e) => set("estimatedCostAmount", Number(e.target.value))} />
          </Field>
        </div>
      </Card>

      <Card title={`${t("proj.wsjf")} = ${wsjf.toFixed(1)}`}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          <Num label={t("proj.wsjf.bv")} value={f.businessValue ?? 0} onChange={(v) => set("businessValue", v)} />
          <Num label={t("proj.wsjf.tc")} value={f.timeCriticality ?? 0} onChange={(v) => set("timeCriticality", v)} />
          <Num label={t("proj.wsjf.rr")} value={f.riskReduction ?? 0} onChange={(v) => set("riskReduction", v)} />
          <Num label={t("proj.wsjf.js")} value={f.jobSize ?? 1} onChange={(v) => set("jobSize", v)} min={1} />
        </div>
      </Card>

      {formErr && <div role="alert" style={{ background: "var(--st-critical-bg)", border: "1px solid var(--st-critical)", color: "var(--st-critical-fg)", borderRadius: "var(--r-lg)", padding: "10px 12px", fontSize: 12.5 }}>{formErr}</div>}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 9 }}>
        <button type="button" onClick={() => router.back()} style={secondary}>{t("common.cancel")}</button>
        <button type="submit" disabled={busy} style={{ ...primary, opacity: busy ? 0.7 : 1 }}>{busy ? t("proj.creating") : mode === "create" ? t("proj.create") : t("proj.save")}</button>
      </div>
    </form>
  );
}

function Num({ label, value, onChange, min = 0 }: { label: string; value: number; onChange: (v: number) => void; min?: number }) {
  return <Field label={label}><input type="number" min={min} style={{ ...inp(false), fontFamily: "var(--font-mono)" }} value={value} onChange={(e) => onChange(Number(e.target.value))} /></Field>;
}
function Field({ label, error, children }: { label: string; error?: string | null; children: React.ReactNode }) {
  return <div style={{ marginBottom: 14 }}><label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6, color: "var(--text)" }}>{label}</label>{children}{error && <p style={{ color: "var(--st-critical-fg)", fontSize: 11, marginTop: 6 }}>{error}</p>}</div>;
}
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 20 }}><div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, marginBottom: 16, color: "var(--text)" }}>{title}</div>{children}</div>;
}
function inp(err: boolean): React.CSSProperties {
  return { width: "100%", minHeight: 40, padding: "9px 12px", borderRadius: "var(--r-md)", border: `1px solid ${err ? "var(--st-critical)" : "var(--line)"}`, background: "var(--card)", color: "var(--text)", fontSize: 13, fontFamily: "var(--font-ui)" };
}
const primary: React.CSSProperties = { minHeight: 40, padding: "0 18px", borderRadius: "var(--r-md)", background: "var(--accent)", color: "var(--on-accent)", border: "none", fontWeight: 700, fontSize: 13, cursor: "pointer" };
const secondary: React.CSSProperties = { minHeight: 40, padding: "0 16px", borderRadius: "var(--r-md)", background: "var(--card)", color: "var(--text)", border: "1px solid var(--line)", fontWeight: 600, fontSize: 13, cursor: "pointer" };
