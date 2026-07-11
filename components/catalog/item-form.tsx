"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import type { FormField } from "@/lib/catalog/validation";
import { createItem } from "@/lib/catalog/actions";
import { FormBuilder } from "./form-builder";

export function ItemForm({ onDone }: { onDone: () => void }) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [slaHours, setSlaHours] = useState("24");
  const [schema, setSchema] = useState<FormField[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const schemaValid = schema.every((f) => f.key.trim() && f.label.trim() && (f.type !== "select" || (f.options ?? []).length > 0));
  const noDupKeys = new Set(schema.map((f) => f.key.trim())).size === schema.length;
  const valid = code.trim().length >= 2 && name.trim().length >= 3 && Number(slaHours) > 0 && schemaValid && noDupKeys;

  function submit() {
    setErr(null);
    start(async () => {
      const r = await createItem({ code: code.trim(), name: name.trim(), description: description.trim() || undefined, category: category.trim() || "general", slaHours: Number(slaHours), formSchema: schema });
      if (!r.ok) { setErr(t(("err." + (r.error ?? "ERR_INVALID_FORMAT")) as MessageKey)); return; }
      onDone();
      router.refresh();
    });
  }

  const field: React.CSSProperties = { fontSize: 13, padding: "9px 11px", borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: "var(--card)", color: "var(--text)", fontFamily: "var(--font-ui)", width: "100%" };
  const lbl: React.CSSProperties = { fontSize: 11.5, fontWeight: 600, color: "var(--text)", marginBottom: 5, display: "block" };

  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--accent)", borderRadius: "var(--r-xl)", padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, color: "var(--text)" }}>{t("cat.item.new")}</div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div><label style={lbl}>{t("cat.item.code")}</label><input value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s+/g, "_"))} placeholder="SR_ACCESO_X" style={{ ...field, fontFamily: "var(--font-mono)" }} /></div>
        <div><label style={lbl}>{t("cat.item.name")}</label><input value={name} onChange={(e) => setName(e.target.value)} style={field} /></div>
      </div>
      <div><label style={lbl}>{t("cat.item.description")}</label><textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} style={{ ...field, resize: "vertical" }} /></div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div><label style={lbl}>{t("cat.item.category")}</label><input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="acceso" style={field} /></div>
        <div><label style={lbl}>{t("cat.item.sla")}</label><input type="number" min={1} value={slaHours} onChange={(e) => setSlaHours(e.target.value)} style={field} /></div>
      </div>

      {/* Constructor visual + vista previa */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={{ border: "1px solid var(--line)", borderRadius: "var(--r-md)", padding: 14 }}>
          <FormBuilder value={schema} onChange={setSchema} />
        </div>
        <div style={{ border: "1px solid var(--line-soft)", borderRadius: "var(--r-md)", padding: 14, background: "var(--paper)" }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text)", marginBottom: 10 }}>{t("cat.fb.preview")}</div>
          <FormPreview schema={schema} />
        </div>
      </div>

      {err && <div style={{ fontSize: 12, color: "var(--st-critical-fg)" }}>{err}</div>}
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={submit} disabled={pending || !valid}
          style={{ fontSize: 12.5, fontWeight: 600, padding: "9px 18px", borderRadius: "var(--r-md)", border: "none", background: "var(--cta-bg)", color: "var(--cta-fg)", cursor: pending || !valid ? "default" : "pointer", opacity: valid ? 1 : 0.6 }}>
          {pending ? t("cat.item.saving") : t("cat.item.save")}
        </button>
        <button onClick={onDone} style={{ fontSize: 12.5, fontWeight: 600, padding: "9px 12px", borderRadius: "var(--r-md)", border: "none", background: "transparent", color: "var(--muted)", cursor: "pointer" }}>{t("common.cancel")}</button>
      </div>
    </div>
  );
}

/** Vista previa: renderiza el formulario tal como lo verá el solicitante (deshabilitado). */
export function FormPreview({ schema }: { schema: FormField[] }) {
  const { t } = useI18n();
  const field: React.CSSProperties = { fontSize: 12.5, padding: "8px 10px", borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: "var(--card)", color: "var(--muted)", width: "100%" };
  if (schema.length === 0) return <div style={{ fontSize: 12, color: "var(--muted)" }}>{t("cat.fb.preview.empty")}</div>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {schema.map((f, i) => (
        <div key={i}>
          <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text)", marginBottom: 4, display: "block" }}>{f.label || <span style={{ color: "var(--muted)" }}>({t("cat.fb.label")})</span>}{f.required && <span style={{ color: "var(--accent-2)" }}> *</span>}</label>
          {f.type === "textarea" ? <textarea disabled rows={2} style={{ ...field, resize: "none" }} />
            : f.type === "select" ? <select disabled style={field}><option>{(f.options ?? []).join(" / ") || "…"}</option></select>
            : <input disabled type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"} style={field} />}
        </div>
      ))}
    </div>
  );
}
