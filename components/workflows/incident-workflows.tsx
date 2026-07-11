"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { startWorkflow } from "@/lib/workflows/actions";
import { InstanceStatusBadge } from "./badges";

type Linked = { id: string; instance_number: string; title: string; status: string; definition: { name: string } | null };
type Def = { id: string; code: string; name: string };

/** Workflows ligados a un caso + iniciar uno nuevo (tracking client-centric). */
export function IncidentWorkflows({ incidentId, incidentTitle, linked, definitions, canRun }: { incidentId: string; incidentTitle: string; linked: Linked[]; definitions: Def[]; canRun: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [pick, setPick] = useState("");
  const [err, setErr] = useState<string | null>(null);

  function begin() {
    if (!pick) return;
    setErr(null);
    start(async () => {
      const r = await startWorkflow(pick, "incident", incidentId, incidentTitle);
      if (!r.ok) setErr(r.error ?? "error");
      else router.push(`/workflows/${r.id}`);
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {linked.length === 0 ? (
        <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("wf.link.none")}</div>
      ) : (
        linked.map((w) => (
          <Link key={w.id} href={`/workflows/${w.id}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: "var(--r-md)", background: "var(--paper)", textDecoration: "none" }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent-2)" }}>{w.instance_number}</span>
            <span style={{ fontSize: 12.5, color: "var(--text)", flex: 1 }}>{w.definition?.name ?? w.title}</span>
            <InstanceStatusBadge status={w.status} />
          </Link>
        ))
      )}
      {canRun && definitions.length > 0 && (
        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          <select value={pick} onChange={(e) => setPick(e.target.value)} style={{ flex: 1, fontSize: 12.5, padding: "7px 9px", borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: "var(--card)", color: "var(--text)" }}>
            <option value="">{t("wf.link.pick")}</option>
            {definitions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <button onClick={begin} disabled={pending || !pick} style={{ fontSize: 12, fontWeight: 600, padding: "7px 12px", borderRadius: "var(--r-md)", border: "none", background: "var(--cta-bg)", color: "var(--cta-fg)", cursor: pending || !pick ? "default" : "pointer" }}>{pending ? t("wf.starting") : t("wf.start")}</button>
        </div>
      )}
      {err && <div style={{ fontSize: 11, color: "var(--st-critical)" }}>{err}</div>}
    </div>
  );
}
