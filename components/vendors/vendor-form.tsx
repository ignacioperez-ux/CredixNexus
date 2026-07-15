"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { useGoBack } from "@/lib/nav/use-go-back";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import { createVendor, updateVendor, type VendorInput } from "@/lib/vendors/actions";
import { VENDOR_CATEGORIES, CRITICALITIES } from "@/lib/vendors/validation";

type Initial = VendorInput & { id?: string };

export function VendorForm({ initial }: { initial?: Initial }) {
  const { t } = useI18n();
  const router = useRouter();
  const goBack = useGoBack(initial?.id ? `/vendors/${initial.id}` : "/vendors");
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState<VendorInput>({
    code: initial?.code ?? "", name: initial?.name ?? "", legalName: initial?.legalName ?? "",
    category: initial?.category ?? "saas", criticality: initial?.criticality ?? "medium",
    contactName: initial?.contactName ?? "", contactEmail: initial?.contactEmail ?? "", contactPhone: initial?.contactPhone ?? "",
    website: initial?.website ?? "", contractNumber: initial?.contractNumber ?? "",
    contractStart: initial?.contractStart ?? "", contractEnd: initial?.contractEnd ?? "",
    slaTerms: initial?.slaTerms ?? "", notes: initial?.notes ?? "",
  });
  const set = (k: keyof VendorInput, v: unknown) => setF((p) => ({ ...p, [k]: v }));

  function submit() {
    setErr(null);
    start(async () => {
      const r = initial?.id ? await updateVendor(initial.id, f) : await createVendor(f);
      if (!r.ok) { setErr(r.error ?? "error"); return; }
      router.push(initial?.id ? `/vendors/${initial.id}` : `/vendors/${r.id}`);
      router.refresh();
    });
  }

  return (
    <div style={{ maxWidth: 760, display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 22, display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 14 }}>
          <Field label={t("vnd.f.code")} required><input value={f.code} onChange={(e) => set("code", e.target.value)} style={inp} /></Field>
          <Field label={t("vnd.f.name")} required><input value={f.name} onChange={(e) => set("name", e.target.value)} style={inp} /></Field>
        </div>
        <Field label={t("vnd.f.legal")}><input value={f.legalName} onChange={(e) => set("legalName", e.target.value)} style={inp} /></Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Field label={t("vnd.f.category")} required><select value={f.category} onChange={(e) => set("category", e.target.value)} style={inp}>{VENDOR_CATEGORIES.map((x) => <option key={x} value={x}>{t(("vnd.cat." + x) as MessageKey)}</option>)}</select></Field>
          <Field label={t("vnd.f.criticality")} required><select value={f.criticality} onChange={(e) => set("criticality", e.target.value)} style={inp}>{CRITICALITIES.map((x) => <option key={x} value={x}>{t(("vnd.crit." + x) as MessageKey)}</option>)}</select></Field>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Field label={t("vnd.f.contact")}><input value={f.contactName} onChange={(e) => set("contactName", e.target.value)} style={inp} /></Field>
          <Field label={t("vnd.f.email")}><input value={f.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} style={inp} /></Field>
          <Field label={t("vnd.f.phone")}><input value={f.contactPhone} onChange={(e) => set("contactPhone", e.target.value)} style={inp} /></Field>
          <Field label={t("vnd.f.website")}><input value={f.website} onChange={(e) => set("website", e.target.value)} style={inp} /></Field>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
          <Field label={t("vnd.f.contractnumber")}><input value={f.contractNumber} onChange={(e) => set("contractNumber", e.target.value)} style={inp} /></Field>
          <Field label={t("vnd.f.start")}><input type="date" value={f.contractStart ?? ""} onChange={(e) => set("contractStart", e.target.value)} style={inp} /></Field>
          <Field label={t("vnd.f.end")}><input type="date" value={f.contractEnd ?? ""} onChange={(e) => set("contractEnd", e.target.value)} style={inp} /></Field>
        </div>
        <Field label={t("vnd.f.sla")}><textarea value={f.slaTerms} onChange={(e) => set("slaTerms", e.target.value)} rows={2} style={{ ...inp, resize: "vertical" }} /></Field>
        <Field label={t("vnd.f.notes")}><textarea value={f.notes} onChange={(e) => set("notes", e.target.value)} rows={2} style={{ ...inp, resize: "vertical" }} /></Field>
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
