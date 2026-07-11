"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import { FRAUD_TYPES, DISPUTE_TYPES } from "@/lib/fraud/validation";
import { openFraudCase, openDispute } from "@/lib/fraud/actions";

export type FinancialCase = { kind: "fraud" | "dispute"; id: string; number: string; status: string } | null;

/** Panel ancla en el incidente: enlaza el flujo especializado (fraude/disputa) o permite
 *  abrirlo. La mesa mantiene el tracking; el incidente sigue siendo el ancla. */
export function FinancialCaseLink({ incidentId, existing, amount, canFraud, canDispute }: {
  incidentId: string; existing: FinancialCase; amount: number | null; canFraud: boolean; canDispute: boolean;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [mode, setMode] = useState<"none" | "fraud" | "dispute">("none");
  const [fraudType, setFraudType] = useState<string>("other");
  const [disputeType, setDisputeType] = useState<string>("other");
  const [err, setErr] = useState<string | null>(null);

  if (existing) {
    const href = existing.kind === "fraud" ? `/fraud-disputes/fraud/${existing.id}` : `/fraud-disputes/dispute/${existing.id}`;
    return (
      <Link href={href} style={{ textDecoration: "none" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "var(--paper)", border: "1px solid var(--line)", borderRadius: "var(--r-md)" }}>
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: existing.kind === "fraud" ? "var(--st-critical-fg)" : "var(--accent-2)" }}>{t(("fc." + existing.kind) as MessageKey)}</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--accent-2)" }}>{existing.number}</span>
          <span style={{ fontSize: 11.5, color: "var(--muted)", marginLeft: "auto" }}>{t((`${existing.kind === "fraud" ? "fr" : "dp"}.st.` + existing.status) as MessageKey)}</span>
        </div>
      </Link>
    );
  }

  if (!canFraud && !canDispute) return <div style={{ fontSize: 12, color: "var(--muted)" }}>{t("fc.none")}</div>;

  function run(fn: () => Promise<{ ok: boolean; error?: string; id?: string }>, kind: "fraud" | "dispute") {
    setErr(null);
    start(async () => {
      const r = await fn();
      if (!r.ok || !r.id) { setErr(t(("err." + (r.error ?? "ERR_INVALID_FORMAT")) as MessageKey)); return; }
      router.push(`/fraud-disputes/${kind}/${r.id}`);
    });
  }
  const sel: React.CSSProperties = { fontSize: 12.5, padding: "8px 10px", borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: "var(--card)", color: "var(--text)" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontSize: 12, color: "var(--muted)" }}>{t("fc.hint")}</div>
      {mode === "none" && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {canFraud && <button onClick={() => setMode("fraud")} style={btn("var(--st-critical-fg)")}>{t("fc.open.fraud")}</button>}
          {canDispute && <button onClick={() => setMode("dispute")} style={btn("var(--accent-2)")}>{t("fc.open.dispute")}</button>}
        </div>
      )}
      {mode === "fraud" && (
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
          <select value={fraudType} onChange={(e) => setFraudType(e.target.value)} style={sel}>
            {FRAUD_TYPES.map((ty) => <option key={ty} value={ty}>{t(("fr.type." + ty) as MessageKey)}</option>)}
          </select>
          <button disabled={pending} onClick={() => run(() => openFraudCase(incidentId, { fraudType, detectionSource: "customer_report", amountExposed: amount }), "fraud")} style={ctaBtn}>{t("fc.create")}</button>
          <button onClick={() => setMode("none")} style={ghostBtn}>{t("common.cancel")}</button>
        </div>
      )}
      {mode === "dispute" && (
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
          <select value={disputeType} onChange={(e) => setDisputeType(e.target.value)} style={sel}>
            {DISPUTE_TYPES.map((ty) => <option key={ty} value={ty}>{t(("dp.type." + ty) as MessageKey)}</option>)}
          </select>
          <button disabled={pending} onClick={() => run(() => openDispute(incidentId, { disputeType, disputedAmount: amount }), "dispute")} style={ctaBtn}>{t("fc.create")}</button>
          <button onClick={() => setMode("none")} style={ghostBtn}>{t("common.cancel")}</button>
        </div>
      )}
      {err && <div style={{ fontSize: 11.5, color: "var(--st-critical-fg)" }}>{err}</div>}
    </div>
  );
}

function btn(color: string): React.CSSProperties {
  return { fontSize: 12.5, fontWeight: 600, padding: "8px 14px", borderRadius: "var(--r-md)", border: `1px solid ${color}`, background: "transparent", color, cursor: "pointer" };
}
const ctaBtn: React.CSSProperties = { fontSize: 12.5, fontWeight: 600, padding: "9px 16px", borderRadius: "var(--r-md)", border: "none", background: "var(--cta-bg)", color: "var(--cta-fg)", cursor: "pointer" };
const ghostBtn: React.CSSProperties = { fontSize: 12.5, fontWeight: 600, padding: "9px 12px", borderRadius: "var(--r-md)", border: "none", background: "transparent", color: "var(--muted)", cursor: "pointer" };
