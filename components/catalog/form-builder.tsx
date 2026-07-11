"use client";

import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import { FIELD_TYPES, type FormField, type FieldType } from "@/lib/catalog/validation";

// Constructor visual del form_schema: agregar/editar/reordenar/quitar campos.
// Controlado: el padre mantiene el arreglo de FormField y recibe onChange.

export function FormBuilder({ value, onChange }: { value: FormField[]; onChange: (v: FormField[]) => void }) {
  const { t } = useI18n();

  const update = (i: number, patch: Partial<FormField>) => onChange(value.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= value.length) return;
    const next = [...value];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const add = () => onChange([...value, { key: "", label: "", type: "text", required: false }]);

  const field: React.CSSProperties = { fontSize: 12.5, padding: "7px 9px", borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: "var(--card)", color: "var(--text)", fontFamily: "var(--font-ui)", width: "100%" };
  const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 600, color: "var(--muted)", marginBottom: 3, display: "block", textTransform: "uppercase", letterSpacing: "0.4px" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text)" }}>{t("cat.fb.title")}</div>
        <span style={{ fontSize: 11, color: "var(--muted)" }}>{value.length} {t("cat.fb.fields")}</span>
      </div>

      {value.length === 0 && <div style={{ fontSize: 12, color: "var(--muted)" }}>{t("cat.fb.empty")}</div>}

      {value.map((f, i) => {
        const dupKey = f.key.trim() !== "" && value.filter((x) => x.key.trim() === f.key.trim()).length > 1;
        return (
          <div key={i} style={{ border: "1px solid var(--line)", borderRadius: "var(--r-md)", padding: 12, background: "var(--paper)", display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 130px", gap: 8 }}>
              <div>
                <label style={lbl}>{t("cat.fb.key")}</label>
                <input value={f.key} onChange={(e) => update(i, { key: e.target.value.replace(/\s+/g, "_").toLowerCase() })} placeholder="sistema" style={{ ...field, borderColor: dupKey || f.key.trim() === "" ? "var(--st-critical-fg)" : "var(--line)", fontFamily: "var(--font-mono)" }} />
              </div>
              <div>
                <label style={lbl}>{t("cat.fb.label")}</label>
                <input value={f.label} onChange={(e) => update(i, { label: e.target.value })} placeholder="Sistema" style={{ ...field, borderColor: f.label.trim() === "" ? "var(--st-critical-fg)" : "var(--line)" }} />
              </div>
              <div>
                <label style={lbl}>{t("cat.fb.type")}</label>
                <select value={f.type} onChange={(e) => update(i, { type: e.target.value as FieldType })} style={field}>
                  {FIELD_TYPES.map((ty) => <option key={ty} value={ty}>{t(("cat.fb.type." + ty) as MessageKey)}</option>)}
                </select>
              </div>
            </div>

            {f.type === "select" && (
              <div>
                <label style={lbl}>{t("cat.fb.options")}</label>
                <input value={(f.options ?? []).join(", ")} onChange={(e) => update(i, { options: e.target.value.split(",").map((o) => o.trim()).filter(Boolean) })}
                  placeholder={t("cat.fb.options.ph")} style={{ ...field, borderColor: (f.options ?? []).length === 0 ? "var(--st-critical-fg)" : "var(--line)" }} />
              </div>
            )}

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text)", cursor: "pointer" }}>
                <input type="checkbox" checked={!!f.required} onChange={(e) => update(i, { required: e.target.checked })} />
                {t("cat.fb.required")}
              </label>
              <div style={{ display: "flex", gap: 4 }}>
                <IconBtn label="↑" onClick={() => move(i, -1)} disabled={i === 0} />
                <IconBtn label="↓" onClick={() => move(i, 1)} disabled={i === value.length - 1} />
                <IconBtn label="×" onClick={() => remove(i)} danger />
              </div>
            </div>
            {dupKey && <div style={{ fontSize: 10.5, color: "var(--st-critical-fg)" }}>{t("cat.fb.dupkey")}</div>}
          </div>
        );
      })}

      <button onClick={add} style={{ alignSelf: "flex-start", fontSize: 12.5, fontWeight: 600, padding: "8px 14px", borderRadius: "var(--r-md)", border: "1px dashed var(--accent)", background: "transparent", color: "var(--accent-2)", cursor: "pointer" }}>
        + {t("cat.fb.add")}
      </button>
    </div>
  );
}

function IconBtn({ label, onClick, disabled, danger }: { label: string; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ width: 26, height: 26, borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: "var(--card)", color: danger ? "var(--st-critical-fg)" : "var(--text)", cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.4 : 1, fontSize: 13, lineHeight: 1 }}>
      {label}
    </button>
  );
}
