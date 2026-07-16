"use client";

import { Icon } from "@/components/ui/icon";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import { changeStatus, softDeleteIncident } from "@/lib/incidents/actions";
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

  async function move(s: string) {
    setBusy(true);
    setErr(null);
    const r = await changeStatus(incidentId, s);
    setBusy(false);
    if (!r.ok) { setErr(t(("err." + (r.error ?? "ERR_INVALID_FORMAT")) as MessageKey)); return; }
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
      {err && <div style={{ flexBasis: "100%", fontSize: 12, color: "var(--st-critical-fg)", fontWeight: 600 }}>{err}</div>}
    </div>
  );
}

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
