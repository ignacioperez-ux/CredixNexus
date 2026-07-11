"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { createProblemFromIncident } from "@/lib/problems/actions";

type LinkedProblem = { id: string; problem_number: string; title: string; status: string; known_error: boolean };

/** Vinculo caso -> problema en el detalle del incidente. Muestra problemas ya
 *  vinculados y permite elevar el caso a un nuevo problema (RCA compartida). */
export function ProblemLink({ incidentId, problems, canManage }: { incidentId: string; problems: LinkedProblem[]; canManage: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function promote() {
    setErr(null);
    start(async () => {
      const r = await createProblemFromIncident(incidentId);
      if (!r.ok) setErr(r.error ?? "error");
      else router.push(`/problems/${r.id}`);
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {problems.length === 0 ? (
        <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("prob.link.none")}</div>
      ) : (
        problems.map((p) => (
          <Link key={p.id} href={`/problems/${p.id}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: "var(--r-md)", background: "var(--paper)", textDecoration: "none" }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent-2)" }}>{p.problem_number}</span>
            <span style={{ fontSize: 12.5, color: "var(--text)", flex: 1 }}>{p.title}</span>
            {p.known_error && <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", color: "var(--st-high-fg)" }}>KE</span>}
          </Link>
        ))
      )}
      {canManage && (
        <button onClick={promote} disabled={pending}
          style={{ fontSize: 12, fontWeight: 600, padding: "7px 12px", borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: "var(--card)", color: "var(--accent-2)", cursor: pending ? "default" : "pointer" }}>
          {pending ? t("prob.promoting") : "⚑ " + t("prob.promote")}
        </button>
      )}
      {err && <div style={{ fontSize: 11, color: "var(--st-critical)" }}>{err}</div>}
    </div>
  );
}
