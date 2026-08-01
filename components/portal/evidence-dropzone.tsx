"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { Icon } from "@/components/ui/icon";

// Zona de evidencia (P1.4): tres vias de carga -> arrastrar, PEGAR con Ctrl+V (captura del
// portapapeles) y seleccionar archivo. El pegado es critico: el usuario acaba de hacer una captura.
// Opcional. Valida <=10MB por archivo con mensaje claro. Tokens del DS (tema claro/oscuro), R6/R7.

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export function EvidenceDropzone({ files, onAdd, onRemove }: {
  files: File[];
  onAdd: (files: File[]) => void;
  onRemove: (index: number) => void;
}) {
  const { t } = useI18n();
  const [dragOver, setDragOver] = useState(false);
  const [tooBig, setTooBig] = useState<string | null>(null);
  const zoneRef = useRef<HTMLDivElement>(null);

  function accept(list: FileList | File[] | null | undefined) {
    const incoming = Array.from(list ?? []);
    if (incoming.length === 0) return;
    const ok = incoming.filter((f) => f.size <= MAX_BYTES);
    const rejected = incoming.filter((f) => f.size > MAX_BYTES);
    setTooBig(rejected.length ? rejected.map((f) => f.name).join(", ") : null);
    if (ok.length) onAdd(ok);
  }

  // Pegar desde el portapapeles (Ctrl+V) cuando el foco esta dentro de la zona: convierte la
  // captura de pantalla en un archivo adjunto sin pasos extra.
  useEffect(() => {
    const el = zoneRef.current;
    if (!el) return;
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const pasted: File[] = [];
      for (const it of Array.from(items)) {
        if (it.kind === "file") {
          const f = it.getAsFile();
          if (f) pasted.push(f);
        }
      }
      if (pasted.length) { e.preventDefault(); accept(pasted); }
    };
    el.addEventListener("paste", onPaste as EventListener);
    return () => el.removeEventListener("paste", onPaste as EventListener);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <div
        ref={zoneRef}
        tabIndex={0}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); accept(e.dataTransfer?.files); }}
        style={{
          display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
          padding: "18px 16px", borderRadius: "var(--r-xl, 14px)",
          border: `1.5px dashed ${dragOver ? "var(--accent)" : "var(--field-border, var(--line))"}`,
          background: dragOver ? "var(--accent-soft)" : "var(--field-bg, var(--paper))",
          textAlign: "center", outlineOffset: 2,
        }}
      >
        <Icon name="paperclip" size={20} color="var(--muted)" aria-hidden />
        <label style={{ fontSize: 12.5, color: "var(--muted)", cursor: "pointer" }}>
          {t("portal.evidence.hint")}
          <input
            type="file"
            multiple
            accept="image/*,application/pdf"
            onChange={(e) => { accept(e.target.files); e.target.value = ""; }}
            style={{ position: "absolute", width: 1, height: 1, opacity: 0, overflow: "hidden" }}
          />
        </label>
      </div>

      {tooBig && (
        <div role="alert" style={{ fontSize: 11.5, color: "var(--st-critical-fg, var(--st-critical))", marginTop: 6 }}>
          {t("portal.evidence.toobig")}: {tooBig}
        </div>
      )}

      {files.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 8 }}>
          {files.map((f, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--text)" }}>
              <Icon name="paperclip" size={13} color="var(--muted)" aria-hidden />
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--muted)" }}>{Math.round(f.size / 1024)} KB</span>
              <button type="button" onClick={() => onRemove(i)} aria-label={t("common.cancel")} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--muted)", display: "inline-flex", padding: 4 }}>
                <Icon name="x" size={13} aria-hidden />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
