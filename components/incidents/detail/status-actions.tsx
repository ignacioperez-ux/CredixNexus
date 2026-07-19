"use client";

import { Icon } from "@/components/ui/icon";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import { changeStatus, softDeleteIncident, resolveIncident } from "@/lib/incidents/actions";
import { uploadAttachment } from "@/lib/casework/actions";
import { requiresAssignee } from "@/lib/incidents/transitions";

// Transiciones sugeridas desde cada estado (guiado, sin flechas que parezcan un "flujo").
// El progreso del ciclo de vida lo muestra el StatusStepper; aqui solo se avanza.
const NEXT: Record<string, string[]> = {
  new: ["triaged"],
  triaged: ["assigned", "in_progress"],
  assigned: ["in_progress"],
  in_progress: ["waiting", "resolved"],
  waiting: ["in_progress", "resolved"],
  resolved: ["closed", "reopened"],
  reopened: ["in_progress", "resolved"],
  closed: ["reopened"],
};

export function StatusActions({ incidentId, status, hasAssignee }: { incidentId: string; status: string; hasAssignee: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // #11: resolver exige el reporte de solucion (modal). Otros estados avanzan directo.
  const [resolveOpen, setResolveOpen] = useState(false);
  const [solution, setSolution] = useState("");
  const [rootCause, setRootCause] = useState("");
  const [files, setFiles] = useState<File[]>([]);

  function errText(code?: string) { const c = code ?? "ERR_INVALID_FORMAT"; return c.startsWith("ERR_") ? t(("err." + c) as MessageKey) : (c === "RESOLUTION_REPORT_REQUIRED" ? t("inc.resolve.required") : c); }

  async function move(s: string) {
    if (s === "resolved") { setErr(null); setResolveOpen(true); return; }
    setBusy(true);
    setErr(null);
    const r = await changeStatus(incidentId, s);
    setBusy(false);
    if (!r.ok) { setErr(errText(r.error)); return; }
    router.refresh();
  }

  async function submitResolve() {
    setErr(null);
    if (solution.trim().length < 15) { setErr(t("inc.resolve.required")); return; }
    setBusy(true);
    const r = await resolveIncident(incidentId, solution, rootCause || undefined);
    if (!r.ok) { setBusy(false); setErr(errText(r.error)); return; }
    // Evidencia opcional: se adjunta al caso ya resuelto (owner-checked, <=10MB).
    for (const f of files) { const fd = new FormData(); fd.append("file", f); await uploadAttachment(incidentId, fd); }
    setBusy(false); setResolveOpen(false); setSolution(""); setRootCause(""); setFiles([]);
    router.refresh();
  }

  async function cancelCase() {
    if (!confirm(t("inc.cancelcase.confirm"))) return;
    setBusy(true);
    await softDeleteIncident(incidentId);
    setBusy(false);
    router.push("/incidents");
    router.refresh();
  }

  const nexts = NEXT[status] ?? [];

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      {nexts.map((s, i) => {
        // A1: no se puede pasar a "Asignado" sin al menos un responsable (regla pura compartida).
        const blocked = requiresAssignee(s) && !hasAssignee;
        return (
          <button key={s} onClick={() => move(s)} disabled={busy || blocked}
            title={blocked ? t("err.ERR_NO_ASSIGNEE") : undefined}
            style={{ ...(i === 0 ? primaryBtn : ghostBtn), ...(blocked ? { opacity: 0.5, cursor: "not-allowed" } : {}) }}>
            {i === 0 && <Icon name="chevron-right" size={13} style={{ verticalAlign: "-2px" }} />} {t(("st." + s) as MessageKey)}
          </button>
        );
      })}
      <Link href={`/incidents/${incidentId}/edit`} style={{ ...ghostBtn, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 5 }}>
        <Icon name="edit" size={13} /> {t("common.edit")}
      </Link>
      {/* Accion destructiva separada y de-enfatizada: no es un paso del flujo. */}
      <button onClick={cancelCase} disabled={busy} style={cancelBtn} title={t("inc.cancelcase")}>
        {t("inc.cancelcase")}
      </button>
      {err && !resolveOpen && <div style={{ flexBasis: "100%", fontSize: 12, color: "var(--st-critical-fg)", fontWeight: 600 }}>{err}</div>}

      {/* #11: modal de resolucion — reporte de solucion OBLIGATORIO (alimenta KB) + evidencia. */}
      {resolveOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", display: "grid", placeItems: "center", zIndex: 80, padding: 16 }} onClick={() => !busy && setResolveOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "min(560px, 96vw)", maxHeight: "90vh", overflowY: "auto", background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", boxShadow: "var(--sh-modal, 0 18px 44px -18px rgba(0,0,0,.5))", padding: 20, display: "flex", flexDirection: "column", gap: 10, textAlign: "left" }}>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16, color: "var(--text)" }}>{t("inc.resolve.title")}</div>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>{t("inc.resolve.hint")}</div>
            <label style={lblSt}>{t("inc.resolve.solution")} *</label>
            <textarea value={solution} onChange={(e) => setSolution(e.target.value)} rows={4} placeholder={t("inc.resolve.solution.ph")} style={inputSt} />
            <label style={lblSt}>{t("inc.resolve.rootcause")}</label>
            <textarea value={rootCause} onChange={(e) => setRootCause(e.target.value)} rows={2} placeholder={t("inc.resolve.rootcause.ph")} style={inputSt} />
            <label style={lblSt}>{t("inc.resolve.evidence")}</label>
            <input type="file" multiple onChange={(e) => { const fs = Array.from(e.target.files ?? []); e.target.value = ""; setFiles((p) => [...p, ...fs]); }} style={{ fontSize: 12, color: "var(--muted)" }} />
            {files.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {files.map((f, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--text)" }}>
                    <Icon name="paperclip" size={12} color="var(--muted)" />
                    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                    <button type="button" onClick={() => setFiles((p) => p.filter((_, j) => j !== i))} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--muted)", display: "inline-flex" }}><Icon name="x" size={12} /></button>
                  </div>
                ))}
              </div>
            )}
            {err && <div style={{ fontSize: 12, color: "var(--st-critical-fg)", fontWeight: 600 }}>{err}</div>}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
              <button onClick={() => { setResolveOpen(false); setErr(null); }} disabled={busy} style={ghostBtn}>{t("inc.resolve.cancel")}</button>
              <button onClick={submitResolve} disabled={busy || solution.trim().length < 15} style={{ ...primaryBtn, opacity: busy || solution.trim().length < 15 ? 0.6 : 1 }}>{busy ? t("inc.resolve.saving") : t("inc.resolve.submit")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const lblSt: React.CSSProperties = { fontSize: 11.5, fontWeight: 600, color: "var(--text)", marginTop: 2 };
const inputSt: React.CSSProperties = { fontSize: 12.5, padding: "8px 10px", borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: "var(--card)", color: "var(--text)", fontFamily: "var(--font-ui)", resize: "vertical", width: "100%" };

const primaryBtn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 4,
  padding: "8px 14px", borderRadius: "var(--r-md)", background: "var(--cta-bg)", border: "none",
  color: "var(--cta-fg)", fontSize: 12.5, fontWeight: 700, cursor: "pointer",
};

const ghostBtn: React.CSSProperties = {
  padding: "7px 12px", borderRadius: "var(--r-md)", background: "var(--card)", border: "1px solid var(--line)",
  color: "var(--text)", fontSize: 12.5, fontWeight: 600, cursor: "pointer",
};

const cancelBtn: React.CSSProperties = {
  padding: "7px 10px", borderRadius: "var(--r-md)", background: "transparent", border: "none",
  color: "var(--muted)", fontSize: 12, fontWeight: 600, cursor: "pointer", textDecoration: "underline",
  textDecorationColor: "var(--line)", textUnderlineOffset: 3,
};
