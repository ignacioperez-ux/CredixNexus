"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import type { CatalogItem } from "@/lib/catalog/queries";
import type { FormField } from "@/lib/catalog/validation";
import { submitRequest } from "@/lib/catalog/actions";

export function RequestForm({ item, onCancel }: { item: CatalogItem; onCancel: () => void }) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [data, setData] = useState<Record<string, string>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);

  const set = (k: string, v: string) => setData((p) => ({ ...p, [k]: v }));

  function submit() {
    setErr(null); setFieldErrors({});
    start(async () => {
      const r = await submitRequest(item.id, data);
      if (!r.ok) {
        if (r.fieldErrors) setFieldErrors(r.fieldErrors);
        setErr(t(("err." + (r.error ?? "ERR_INVALID_FORMAT")) as MessageKey));
        return;
      }
      if (r.requestId) router.push(`/service-catalog/requests/${r.requestId}`);
    });
  }

  const field: React.CSSProperties = { fontSize: 13, padding: "9px 11px", borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: "var(--card)", color: "var(--text)", fontFamily: "var(--font-ui)", width: "100%" };
  const lbl: React.CSSProperties = { fontSize: 11.5, fontWeight: 600, color: "var(--text)", marginBottom: 5, display: "block" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 6 }}>
      {item.form_schema.map((f: FormField) => (
        <div key={f.key}>
          <label style={lbl}>{f.label}{f.required && <span style={{ color: "var(--accent-2)" }}> *</span>}</label>
          {f.type === "textarea" ? (
            <textarea value={data[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)} rows={2} style={{ ...field, resize: "vertical" }} />
          ) : f.type === "select" ? (
            <select value={data[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)} style={field}>
              <option value="">{t("cat.choose")}</option>
              {(f.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          ) : (
            <input type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"} value={data[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)} style={field} />
          )}
          {fieldErrors[f.key] && <div style={{ fontSize: 11, color: "var(--st-critical-fg)", marginTop: 3 }}>{t(("err." + fieldErrors[f.key]) as MessageKey)}</div>}
        </div>
      ))}
      {err && <div style={{ fontSize: 12, color: "var(--st-critical-fg)" }}>{err}</div>}
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={submit} disabled={pending}
          style={{ fontSize: 12.5, fontWeight: 600, padding: "9px 18px", borderRadius: "var(--r-md)", border: "none", background: "var(--cta-bg)", color: "var(--cta-fg)", cursor: pending ? "default" : "pointer" }}>
          {pending ? t("cat.submitting") : t("cat.submit")}
        </button>
        <button onClick={onCancel} style={{ fontSize: 12.5, fontWeight: 600, padding: "9px 12px", borderRadius: "var(--r-md)", border: "none", background: "transparent", color: "var(--muted)", cursor: "pointer" }}>{t("common.cancel")}</button>
      </div>
    </div>
  );
}
