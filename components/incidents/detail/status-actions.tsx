"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/provider";
import { changeStatus, softDeleteIncident } from "@/lib/incidents/actions";

const FLOW = ["triaged", "in_progress", "waiting", "resolved"];

export function StatusActions({ incidentId, status }: { incidentId: string; status: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function move(s: string) {
    setBusy(true);
    await changeStatus(incidentId, s);
    setBusy(false);
    router.refresh();
  }

  async function remove() {
    if (!confirm(t("common.soon") === "" ? "" : "¿Cancelar (eliminación lógica) este incidente?")) return;
    setBusy(true);
    await softDeleteIncident(incidentId);
    setBusy(false);
    router.push("/incidents");
    router.refresh();
  }

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      {FLOW.filter((s) => s !== status).map((s) => (
        <button key={s} onClick={() => move(s)} disabled={busy} style={ghostBtn}>
          → {t(("st." + s) as never)}
        </button>
      ))}
      <Link href={`/incidents/${incidentId}/edit`} style={{ ...ghostBtn, textDecoration: "none", display: "inline-block" }}>
        ✎ Editar
      </Link>
      <button onClick={remove} disabled={busy} style={{ ...ghostBtn, color: "var(--st-critical-fg)", borderColor: "var(--st-critical)" }}>
        Eliminar
      </button>
    </div>
  );
}

const ghostBtn: React.CSSProperties = {
  padding: "7px 12px",
  borderRadius: "var(--r-md)",
  background: "var(--card)",
  border: "1px solid var(--line)",
  color: "var(--text)",
  fontSize: 12.5,
  fontWeight: 600,
  cursor: "pointer",
};
