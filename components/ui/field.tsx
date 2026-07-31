"use client";

import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { useId } from "react";

/* ============================================================================
 * Field / TextField / SelectField / TextArea — campos outlined del DS Credix.
 * Borde outline (#74787A), radio xs (4px, DS text field), foco/error via globals.css
 * (reglas [data-theme="claro"]). Conserva name/id/value/onChange/validaciones del DOM:
 * NO altera logica de formularios, solo presentacion + a11y (label asociado, aria).
 * ========================================================================== */

const baseInput: React.CSSProperties = {
  width: "100%",
  height: 40,
  padding: "0 12px",
  background: "var(--field-bg, var(--card))",
  border: "1px solid var(--field-border, var(--line))",
  borderRadius: "var(--credix-radius-xs, 4px)",
  color: "var(--text)",
  fontFamily: "var(--font-ui)",
  fontSize: 14,
  outline: "none",
};

function Label({ htmlFor, children, required }: { htmlFor: string; children: ReactNode; required?: boolean }) {
  return (
    <label htmlFor={htmlFor} style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--muted)", marginBottom: 6 }}>
      {children}
      {required && <span style={{ color: "var(--credix-color-error, #FF4965)" }}> *</span>}
    </label>
  );
}

function Help({ error, hint, id }: { error?: string; hint?: string; id: string }) {
  if (error) return <p id={id} role="alert" style={{ margin: "6px 0 0", fontSize: 12, color: "var(--credix-color-error, #FF4965)" }}>{error}</p>;
  if (hint) return <p id={id} style={{ margin: "6px 0 0", fontSize: 12, color: "var(--muted)" }}>{hint}</p>;
  return null;
}

type FieldWrap = { label?: ReactNode; hint?: string; error?: string; required?: boolean };

export function TextField({ label, hint, error, required, style, id, ...rest }: FieldWrap & InputHTMLAttributes<HTMLInputElement>) {
  const auto = useId();
  const fid = id ?? auto;
  const hid = fid + "-help";
  return (
    <div>
      {label && <Label htmlFor={fid} required={required}>{label}</Label>}
      <input
        id={fid}
        aria-invalid={!!error}
        aria-describedby={error || hint ? hid : undefined}
        {...rest}
        style={{ ...baseInput, borderColor: error ? "var(--credix-color-error, #FF4965)" : undefined, ...style }}
      />
      <Help error={error} hint={hint} id={hid} />
    </div>
  );
}

export function SelectField({ label, hint, error, required, children, style, id, ...rest }: FieldWrap & SelectHTMLAttributes<HTMLSelectElement>) {
  const auto = useId();
  const fid = id ?? auto;
  const hid = fid + "-help";
  return (
    <div>
      {label && <Label htmlFor={fid} required={required}>{label}</Label>}
      <select id={fid} aria-invalid={!!error} aria-describedby={error || hint ? hid : undefined} {...rest} style={{ ...baseInput, ...style }}>
        {children}
      </select>
      <Help error={error} hint={hint} id={hid} />
    </div>
  );
}

export function TextArea({ label, hint, error, required, style, id, rows = 4, ...rest }: FieldWrap & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const auto = useId();
  const fid = id ?? auto;
  const hid = fid + "-help";
  return (
    <div>
      {label && <Label htmlFor={fid} required={required}>{label}</Label>}
      <textarea
        id={fid}
        rows={rows}
        aria-invalid={!!error}
        aria-describedby={error || hint ? hid : undefined}
        {...rest}
        style={{ ...baseInput, height: undefined, padding: "10px 12px", resize: "vertical", ...style }}
      />
      <Help error={error} hint={hint} id={hid} />
    </div>
  );
}
