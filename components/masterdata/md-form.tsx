"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n, useErrorMessage } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import type { Catalog, Field } from "@/lib/masterdata/registry";
import type { FkOptions } from "@/lib/masterdata/queries";
import { upsertRecord } from "@/lib/masterdata/actions";

const CODE_RE = /^[A-Z0-9_\-]{2,80}$/;

export function MdForm({ catalog, mode, id, initial, fkOptions = {} }: { catalog: Catalog; mode: "create" | "edit"; id?: string; initial?: Record<string, unknown>; fkOptions?: FkOptions }) {
  const { t } = useI18n();
  const errMsg = useErrorMessage();
  const router = useRouter();

  const [values, setValues] = useState<Record<string, unknown>>(() => {
    const v: Record<string, unknown> = {};
    for (const f of catalog.fields) {
      const iv = initial?.[f.name];
      v[f.name] = f.type === "bool" ? iv === true : iv ?? "";
    }
    return v;
  });
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [formErr, setFormErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (name: string, val: unknown) => setValues((s) => ({ ...s, [name]: val }));

  function validate(): boolean {
    const e: Record<string, string | null> = {};
    for (const f of catalog.fields) {
      const raw = values[f.name];
      if (f.type === "bool") continue;
      if (f.type === "number") {
        if ((raw === "" || raw == null) && f.required) e[f.name] = "ERR_REQUIRED_FIELD";
        else if (raw !== "" && raw != null) {
          const n = Number(raw);
          if (Number.isNaN(n) || (f.min != null && n < f.min) || (f.max != null && n > f.max)) e[f.name] = "ERR_INVALID_FORMAT";
        }
        continue;
      }
      const s = typeof raw === "string" ? raw.trim() : "";
      if (!s) { if (f.required) e[f.name] = "ERR_REQUIRED_FIELD"; continue; }
      if (f.type === "fk") continue;
      if (f.type === "code" && !CODE_RE.test(s)) e[f.name] = "ERR_INVALID_FORMAT";
      else if (f.min != null && s.length < f.min) e[f.name] = "ERR_MIN_LENGTH";
    }
    setErrors(e);
    return !Object.values(e).some(Boolean);
  }

  async function onSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setFormErr(null);
    if (!validate()) return;
    setBusy(true);
    const res = await upsertRecord(catalog.key, id ?? null, values);
    setBusy(false);
    if (!res.ok) {
      if (res.errorField) setErrors((s) => ({ ...s, [res.errorField as string]: res.error ?? null }));
      else setFormErr(errMsg(res.error ?? "ERR_INVALID_FORMAT"));
      return;
    }
    router.push(`/catalog/${catalog.key}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} noValidate style={{ maxWidth: 560, display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 22, display: "flex", flexDirection: "column", gap: 14 }}>
        {catalog.fields.map((f) => (
          <FieldInput key={f.name} f={f} value={values[f.name]} error={errMsg(errors[f.name] ?? null)} onChange={(v) => set(f.name, v)} label={t(f.label)} fkOptions={fkOptions[f.name]} />
        ))}
      </div>

      {formErr && <div role="alert" style={{ marginTop: 12, background: "var(--st-critical-bg)", border: "1px solid var(--st-critical)", color: "var(--st-critical-fg)", borderRadius: "var(--r-lg)", padding: "10px 12px", fontSize: 12.5 }}>{formErr}</div>}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 9, marginTop: 14 }}>
        <button type="button" onClick={() => router.back()} style={secondary}>{t("common.cancel")}</button>
        <button type="submit" disabled={busy} style={{ ...primary, opacity: busy ? 0.7 : 1 }}>{mode === "create" ? t("md.create") : t("md.save")}</button>
      </div>
    </form>
  );
}

function FieldInput({ f, value, error, onChange, label, fkOptions }: { f: Field; value: unknown; error?: string | null; onChange: (v: unknown) => void; label: string; fkOptions?: { id: string; name: string }[] }) {
  if (f.type === "bool") {
    return (
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text)", cursor: "pointer" }}>
        <input type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} /> {label}
      </label>
    );
  }
  return (
    <div>
      <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6, color: "var(--text)" }}>{label}{f.required ? " *" : ""}</label>
      {f.type === "fk" ? (
        <select value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} style={inp(!!error)}>
          <option value="">—</option>
          {(fkOptions ?? []).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
      ) : f.type === "enum" ? (
        <select value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} style={inp(!!error)}>
          <option value="">—</option>
          {f.options?.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input type={f.type === "number" ? "number" : "text"} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)}
          style={{ ...inp(!!error), fontFamily: f.type === "code" || f.type === "number" ? "var(--font-mono)" : "var(--font-ui)" }} />
      )}
      {error && <p style={{ color: "var(--st-critical-fg)", fontSize: 11, marginTop: 6 }}>{error}</p>}
    </div>
  );
}

function inp(err: boolean): React.CSSProperties {
  return { width: "100%", minHeight: 40, padding: "9px 12px", borderRadius: "var(--r-md)", border: `1px solid ${err ? "var(--st-critical)" : "var(--line)"}`, background: "var(--card)", color: "var(--text)", fontSize: 13 };
}
const primary: React.CSSProperties = { minHeight: 40, padding: "0 18px", borderRadius: "var(--r-md)", background: "var(--accent)", color: "var(--on-accent)", border: "none", fontWeight: 700, fontSize: 13, cursor: "pointer" };
const secondary: React.CSSProperties = { minHeight: 40, padding: "0 16px", borderRadius: "var(--r-md)", background: "var(--card)", color: "var(--text)", border: "1px solid var(--line)", fontWeight: 600, fontSize: 13, cursor: "pointer" };
