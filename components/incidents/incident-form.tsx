"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n, useErrorMessage } from "@/lib/i18n/provider";
import { useNavHistory } from "@/components/app-shell/nav-history-provider";
import type { FormOptions } from "@/lib/incidents/queries";
import { createIncident, updateIncident, type IncidentInput } from "@/lib/incidents/actions";
import { derivePriority, type Impact, type Urgency } from "@/lib/incidents/priority";
import { minLength, required } from "@/lib/validation";
import { PriorityTag } from "./badges";

const LEVELS: (Impact | Urgency)[] = ["critical", "high", "medium", "low"];

type Props = {
  options: FormOptions;
  mode: "create" | "edit";
  incidentId?: string;
  initial?: Partial<IncidentInput>;
};

export function IncidentForm({ options, mode, incidentId, initial }: Props) {
  const { t } = useI18n();
  const errMsg = useErrorMessage();
  const router = useRouter();
  const { back } = useNavHistory();
  const goBack = () => back(mode === "edit" && incidentId ? `/incidents/${incidentId}` : "/incidents");

  const [f, setF] = useState<IncidentInput>({
    title: initial?.title ?? "",
    description: initial?.description ?? "",
    categoryId: initial?.categoryId ?? "",
    affectedCiId: initial?.affectedCiId ?? "",
    affectedServiceId: initial?.affectedServiceId ?? "",
    affectedProductId: initial?.affectedProductId ?? "",
    affectedChannelId: initial?.affectedChannelId ?? "",
    affectedBusinessUnitId: initial?.affectedBusinessUnitId ?? "",
    impact: initial?.impact ?? "medium",
    urgency: initial?.urgency ?? "medium",
    financialImpactEstimate: initial?.financialImpactEstimate ?? 0,
    caseType: initial?.caseType ?? "Incident",
    amount: initial?.amount ?? null,
    currency: initial?.currency ?? "CRC",
    transactionReference: initial?.transactionReference ?? "",
    customerName: initial?.customerName ?? "",
    sensitiveFlag: initial?.sensitiveFlag ?? false,
    piiFlag: initial?.piiFlag ?? false,
  });
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [formErr, setFormErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (k: keyof IncidentInput, v: string | number | boolean | null) => setF((s) => ({ ...s, [k]: v }));

  function validate(): boolean {
    const e: Record<string, string | null> = {
      title: minLength(f.title, 5),
      description: minLength(f.description, 10),
      categoryId: required(f.categoryId),
    };
    setErrors(e);
    return !Object.values(e).some(Boolean);
  }

  async function onSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setFormErr(null);
    if (!validate()) return;
    setBusy(true);
    const res =
      mode === "create"
        ? await createIncident(f)
        : await updateIncident(incidentId as string, f);
    setBusy(false);
    if (!res.ok) {
      setFormErr(errMsg(res.error ?? "ERR_REQUIRED_FIELD"));
      return;
    }
    router.push(`/incidents/${res.id}`);
    router.refresh();
  }

  const priority = derivePriority(f.impact, f.urgency);

  return (
    <form onSubmit={onSubmit} noValidate style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 720 }}>
      <Card title={t("inc.section.classification")}>
        <Field label={t("inc.field.title")} error={errMsg(errors.title ?? null)}>
          <input style={inputStyle(!!errors.title)} value={f.title} onChange={(e) => set("title", e.target.value)} />
        </Field>
        <Field label={t("inc.field.description")} error={errMsg(errors.description ?? null)}>
          <textarea style={{ ...inputStyle(!!errors.description), minHeight: 90, resize: "vertical" }} value={f.description} onChange={(e) => set("description", e.target.value)} />
        </Field>
        <Field label={t("inc.field.category")} error={errMsg(errors.categoryId ?? null)}>
          <select style={inputStyle(!!errors.categoryId)} value={f.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
            <option value="">{t("inc.field.none")}</option>
            {options.categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </Field>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 12, alignItems: "end" }}>
          <Field label={t("inc.field.impact")}>
            <select style={inputStyle(false)} value={f.impact} onChange={(e) => set("impact", e.target.value)}>
              {LEVELS.map((l) => <option key={l} value={l}>{t(("lvl." + l) as never)}</option>)}
            </select>
          </Field>
          <Field label={t("inc.field.urgency")}>
            <select style={inputStyle(false)} value={f.urgency} onChange={(e) => set("urgency", e.target.value)}>
              {LEVELS.map((l) => <option key={l} value={l}>{t(("lvl." + l) as never)}</option>)}
            </select>
          </Field>
          <div style={{ paddingBottom: 10 }}>
            <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 6 }}>{t("inc.priority.computed")}</div>
            <PriorityTag priority={priority} />
          </div>
        </div>
      </Card>

      <Card title={t("inc.section.affected")}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label={t("inc.field.app")}>
            <Select value={f.affectedCiId} onChange={(v) => set("affectedCiId", v)} items={options.apps} placeholder={t("inc.field.none")} />
          </Field>
          <Field label={t("inc.field.service")}>
            <Select value={f.affectedServiceId} onChange={(v) => set("affectedServiceId", v)} items={options.services} placeholder={t("inc.field.none")} />
          </Field>
          <Field label={t("inc.field.product")}>
            <Select value={f.affectedProductId} onChange={(v) => set("affectedProductId", v)} items={options.products} placeholder={t("inc.field.none")} />
          </Field>
          <Field label={t("inc.field.channel")}>
            <Select value={f.affectedChannelId} onChange={(v) => set("affectedChannelId", v)} items={options.channels} placeholder={t("inc.field.none")} />
          </Field>
          <Field label={t("inc.field.bu")}>
            <Select value={f.affectedBusinessUnitId} onChange={(v) => set("affectedBusinessUnitId", v)} items={options.businessUnits} placeholder={t("inc.field.none")} />
          </Field>
          <Field label={t("inc.field.financial")}>
            <input type="number" min={0} step="0.01" style={{ ...inputStyle(false), fontFamily: "var(--font-mono)" }}
              value={f.financialImpactEstimate} onChange={(e) => set("financialImpactEstimate", Number(e.target.value))} />
          </Field>
        </div>
      </Card>

      <Card title={t("inc.section.fintech")}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label={t("inc.f.casetype")}>
            <select style={inputStyle(false)} value={f.caseType} onChange={(e) => set("caseType", e.target.value)}>
              {options.caseTypes.map((ct) => <option key={ct.code} value={ct.code}>{ct.name}</option>)}
            </select>
          </Field>
          <Field label={t("inc.f.customer")}>
            <input style={inputStyle(false)} value={f.customerName} onChange={(e) => set("customerName", e.target.value)} />
          </Field>
          <Field label={t("inc.f.amount")}>
            <input type="number" min={0} step="0.01" style={{ ...inputStyle(false), fontFamily: "var(--font-mono)" }}
              value={f.amount ?? ""} onChange={(e) => set("amount", e.target.value === "" ? null : Number(e.target.value))} />
          </Field>
          <Field label={t("inc.f.currency")}>
            <select style={inputStyle(false)} value={f.currency} onChange={(e) => set("currency", e.target.value)}>
              <option value="CRC">CRC</option><option value="USD">USD</option>
            </select>
          </Field>
          <Field label={t("inc.f.txn")}>
            <input style={{ ...inputStyle(false), fontFamily: "var(--font-mono)" }} value={f.transactionReference} onChange={(e) => set("transactionReference", e.target.value)} />
          </Field>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, justifyContent: "center", paddingTop: 20 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text)", cursor: "pointer" }}>
              <input type="checkbox" checked={!!f.sensitiveFlag} onChange={(e) => set("sensitiveFlag", e.target.checked)} /> {t("inc.f.sensitive")}
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text)", cursor: "pointer" }}>
              <input type="checkbox" checked={!!f.piiFlag} onChange={(e) => set("piiFlag", e.target.checked)} /> {t("inc.f.pii")}
            </label>
          </div>
        </div>
      </Card>

      {formErr && (
        <div role="alert" style={{ background: "var(--st-critical-bg)", border: "1px solid var(--st-critical)", color: "var(--st-critical-fg)", borderRadius: "var(--r-lg)", padding: "10px 12px", fontSize: 12.5 }}>
          {formErr}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 9 }}>
        <button type="button" onClick={goBack} style={secondaryBtn}>{t("common.cancel")}</button>
        <button type="submit" disabled={busy} style={{ ...primaryBtn, opacity: busy ? 0.7 : 1 }}>
          {busy ? t("inc.creating") : mode === "create" ? t("inc.create") : t("common.save")}
        </button>
      </div>
    </form>
  );
}

function Select({ value, onChange, items, placeholder }: { value?: string; onChange: (v: string) => void; items: { id: string; name: string }[]; placeholder: string }) {
  return (
    <select style={inputStyle(false)} value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
    </select>
  );
}

function Field({ label, error, children }: { label: string; error?: string | null; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6, color: "var(--text)" }}>{label}</label>
      {children}
      {error && <p style={{ color: "var(--st-critical-fg)", fontSize: 11, marginTop: 6 }}>{error}</p>}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 20 }}>
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, marginBottom: 16, color: "var(--text)" }}>{title}</div>
      {children}
    </div>
  );
}

function inputStyle(err: boolean): React.CSSProperties {
  return {
    width: "100%",
    minHeight: 40,
    padding: "9px 12px",
    borderRadius: "var(--r-md)",
    border: `1px solid ${err ? "var(--st-critical)" : "var(--line)"}`,
    background: "var(--card)",
    color: "var(--text)",
    fontSize: 13,
    fontFamily: "var(--font-ui)",
  };
}

const primaryBtn: React.CSSProperties = { minHeight: 40, padding: "0 18px", borderRadius: "var(--r-md)", background: "var(--accent)", color: "var(--on-accent)", border: "none", fontWeight: 700, fontSize: 13, cursor: "pointer" };
const secondaryBtn: React.CSSProperties = { minHeight: 40, padding: "0 16px", borderRadius: "var(--r-md)", background: "var(--card)", color: "var(--text)", border: "1px solid var(--line)", fontWeight: 600, fontSize: 13, cursor: "pointer" };
