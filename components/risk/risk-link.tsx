"use client";

import { Icon } from "@/components/ui/icon";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { createRiskEvent } from "@/lib/risk/actions";

type Linked = { id: string; event_number: string; status: string } | null;

/** Vínculo caso <-> evento de riesgo operativo. Si ya existe lo muestra; si no,
 *  ofrece registrarlo (gated por risk.manage en el server action). */
export function RiskLink({ incidentId, linked, canManage }: { incidentId: string; linked: Linked; canManage: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  if (linked) {
    return (
      <div style={{ padding: "6px 0" }}>
        <Link href="/risk" style={{ fontSize: 12, color: "var(--st-critical)", textDecoration: "none", fontWeight: 600 }}>
          <Icon name="alert" size={13} style={{ verticalAlign: "-2px" }} /> {t("risk.linked")} · {linked.event_number}
        </Link>
      </div>
    );
  }
  if (!canManage) return null;

  function register() {
    setErr(null);
    start(async () => {
      const r = await createRiskEvent(incidentId);
      if (!r.ok) setErr(r.error ?? "error");
      else router.refresh();
    });
  }

  return (
    <div style={{ padding: "8px 0 2px" }}>
      <button
        onClick={register}
        disabled={pending}
        style={{ fontSize: 12, fontWeight: 600, padding: "7px 12px", borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: "var(--paper)", color: "var(--st-critical)", cursor: pending ? "default" : "pointer", width: "100%" }}
      >
        {pending ? t("risk.registering") : <><Icon name="alert" size={13} style={{ verticalAlign: "-2px" }} /> {t("risk.register")}</>}
      </button>
      {err && <div style={{ fontSize: 11, color: "var(--st-critical)", marginTop: 6 }}>{err}</div>}
    </div>
  );
}
