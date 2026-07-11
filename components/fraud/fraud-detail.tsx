"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import { BackButton } from "@/components/common/back-button";
import { FraudStatusBadge } from "./badges";
import { fraudNextStates, maskName } from "@/lib/fraud/validation";
import { advanceFraudStatus, recordFraudRecovery } from "@/lib/fraud/actions";

export type FraudDetailData = {
  id: string; fraud_number: string; fraud_type: string; status: string; detection_source: string;
  risk_score: number | null; amount_exposed: number | null; amount_recovered: number; currency: string;
  resolution_notes: string | null; reported_at: string;
  incident: { id: string; incident_number: string; title: string; status: string; priority: string; customer_name: string | null; transaction_reference: string | null } | null;
};

export function FraudDetail({ fc, canManage }: { fc: FraudDetailData; canManage: boolean }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [recovery, setRecovery] = useState(String(fc.amount_recovered || ""));
  const money = (n: number) => new Intl.NumberFormat(locale === "es" ? "es-CR" : "en-US", { style: "currency", currency: fc.currency, maximumFractionDigits: 0 }).format(n);
  const next = fraudNextStates(fc.status);

  function advance(to: string) {
    setMsg(null);
    start(async () => {
      const r = await advanceFraudStatus(fc.id, to);
      if (!r.ok) setMsg({ kind: "err", text: t(("err." + (r.error ?? "ERR_INVALID_STATE")) as MessageKey) });
      else { setMsg({ kind: "ok", text: t("fr.msg.advanced") }); router.refresh(); }
    });
  }
  function saveRecovery() {
    setMsg(null);
    const amt = Number(recovery);
    if (Number.isNaN(amt)) { setMsg({ kind: "err", text: t("err.ERR_INVALID_FORMAT") }); return; }
    start(async () => {
      const r = await recordFraudRecovery(fc.id, amt);
      if (!r.ok) setMsg({ kind: "err", text: t(("err." + (r.error ?? "ERR_INVALID_FORMAT")) as MessageKey) });
      else { setMsg({ kind: "ok", text: t("fr.msg.recovery") }); router.refresh(); }
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <BackButton fallback="/fraud-disputes" />
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 18, color: "var(--accent-2)" }}>{fc.fraud_number}</span>
        <FraudStatusBadge status={fc.status} />
        <span style={{ fontSize: 12, color: "var(--muted)" }}>{t(("fr.type." + fc.fraud_type) as MessageKey)}</span>
      </div>

      {msg && <div style={{ fontSize: 12.5, fontWeight: 600, padding: "9px 14px", borderRadius: "var(--r-md)", background: msg.kind === "ok" ? "var(--st-low-bg)" : "var(--st-critical-bg)", color: msg.kind === "ok" ? "var(--st-low-fg)" : "var(--st-critical-fg)" }}>{msg.text}</div>}

      {/* Ancla: la mesa nunca pierde el control */}
      {fc.incident && (
        <Link href={`/incidents/${fc.incident.id}`} style={{ textDecoration: "none" }}>
          <div style={{ background: "var(--paper)", border: "1px solid var(--line)", borderLeft: "3px solid var(--accent)", borderRadius: "var(--r-md)", padding: "12px 14px" }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "var(--accent-2)", marginBottom: 4 }}>{t("fr.anchor")}</div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--accent-2)" }}>{fc.incident.incident_number}</span>
              <span style={{ fontSize: 13, color: "var(--text)" }}>{fc.incident.title}</span>
            </div>
          </div>
        </Link>
      )}

      <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 20, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 16 }}>
        <Field label={t("fr.col.source")} value={t(("fr.src." + fc.detection_source) as MessageKey)} />
        <Field label={t("fr.col.risk")} value={fc.risk_score != null ? String(fc.risk_score) : "—"} mono />
        <Field label={t("fr.col.exposed")} value={fc.amount_exposed != null ? money(fc.amount_exposed) : "—"} mono />
        <Field label={t("fr.kpi.recovered")} value={money(fc.amount_recovered)} mono />
        <Field label={t("fr.field.customer")} value={maskName(fc.incident?.customer_name)} />
        <Field label={t("fr.field.txn")} value={fc.incident?.transaction_reference ?? "—"} mono />
      </div>

      {canManage && (
        <div style={{ background: "var(--paper)", border: "1px dashed var(--line)", borderRadius: "var(--r-xl)", padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, color: "var(--text)" }}>{t("fr.manage")}</div>
          {next.length > 0 ? (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {next.map((s) => (
                <button key={s} disabled={pending} onClick={() => advance(s)}
                  style={{ fontSize: 12.5, fontWeight: 600, padding: "8px 14px", borderRadius: "var(--r-md)", border: "1px solid var(--accent)", background: "transparent", color: "var(--accent-2)", cursor: "pointer" }}>
                  → {t(("fr.st." + s) as MessageKey)}
                </button>
              ))}
            </div>
          ) : <div style={{ fontSize: 12, color: "var(--muted)" }}>{t("fr.terminal")}</div>}

          {(fc.status === "confirmed" || fc.status === "recovered") && (
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>
                {t("fr.recovery.label")}
                <input value={recovery} onChange={(e) => setRecovery(e.target.value)} inputMode="decimal"
                  style={{ fontSize: 12.5, padding: "8px 10px", borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: "var(--card)", color: "var(--text)", width: 160 }} />
              </label>
              <button disabled={pending} onClick={saveRecovery}
                style={{ fontSize: 12.5, fontWeight: 600, padding: "9px 16px", borderRadius: "var(--r-md)", border: "none", background: "var(--cta-bg)", color: "var(--cta-fg)", cursor: "pointer" }}>{t("fr.recovery.save")}</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 10.5, fontWeight: 600, color: "var(--muted)", marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: 13.5, color: "var(--text)", fontFamily: mono ? "var(--font-mono)" : "var(--font-ui)" }}>{value}</div>
    </div>
  );
}
