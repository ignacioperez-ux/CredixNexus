"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import { BackButton } from "@/components/common/back-button";
import { DisputeStatusBadge } from "./badges";
import { disputeNextStates, maskName } from "@/lib/fraud/validation";
import { advanceDisputeStatus, recordDisputeRecovery } from "@/lib/fraud/actions";

export type DisputeDetailData = {
  id: string; dispute_number: string; dispute_type: string; status: string; reason_code: string | null;
  disputed_amount: number | null; amount_recovered: number; currency: string; transaction_reference: string | null;
  due_date: string | null; outcome: string | null; opened_at: string;
  incident: { id: string; incident_number: string; title: string; status: string; priority: string; customer_name: string | null } | null;
  processor: { name: string } | null;
};

export function DisputeDetail({ dc, canManage }: { dc: DisputeDetailData; canManage: boolean }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [recovery, setRecovery] = useState(String(dc.amount_recovered || ""));
  const money = (n: number) => new Intl.NumberFormat(locale === "es" ? "es-CR" : "en-US", { style: "currency", currency: dc.currency, maximumFractionDigits: 0 }).format(n);
  const next = disputeNextStates(dc.status);

  function advance(to: string) {
    setMsg(null);
    start(async () => {
      const r = await advanceDisputeStatus(dc.id, to);
      if (!r.ok) setMsg({ kind: "err", text: t(("err." + (r.error ?? "ERR_INVALID_STATE")) as MessageKey) });
      else { setMsg({ kind: "ok", text: t("fr.msg.advanced") }); router.refresh(); }
    });
  }
  function saveRecovery() {
    setMsg(null);
    const amt = Number(recovery);
    if (Number.isNaN(amt)) { setMsg({ kind: "err", text: t("err.ERR_INVALID_FORMAT") }); return; }
    start(async () => {
      const r = await recordDisputeRecovery(dc.id, amt);
      if (!r.ok) setMsg({ kind: "err", text: t(("err." + (r.error ?? "ERR_INVALID_FORMAT")) as MessageKey) });
      else { setMsg({ kind: "ok", text: t("fr.msg.recovery") }); router.refresh(); }
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <BackButton fallback="/fraud-disputes" />
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 18, color: "var(--accent-2)" }}>{dc.dispute_number}</span>
        <DisputeStatusBadge status={dc.status} />
        <span style={{ fontSize: 12, color: "var(--muted)" }}>{t(("dp.type." + dc.dispute_type) as MessageKey)}</span>
      </div>

      {msg && <div style={{ fontSize: 12.5, fontWeight: 600, padding: "9px 14px", borderRadius: "var(--r-md)", background: msg.kind === "ok" ? "var(--st-low-bg)" : "var(--st-critical-bg)", color: msg.kind === "ok" ? "var(--st-low-fg)" : "var(--st-critical-fg)" }}>{msg.text}</div>}

      {dc.incident && (
        <Link href={`/incidents/${dc.incident.id}`} style={{ textDecoration: "none" }}>
          <div style={{ background: "var(--paper)", border: "1px solid var(--line)", borderLeft: "3px solid var(--accent)", borderRadius: "var(--r-md)", padding: "12px 14px" }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "var(--accent-2)", marginBottom: 4 }}>{t("fr.anchor")}</div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--accent-2)" }}>{dc.incident.incident_number}</span>
              <span style={{ fontSize: 13, color: "var(--text)" }}>{dc.incident.title}</span>
            </div>
          </div>
        </Link>
      )}

      <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 20, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 16 }}>
        <Field label={t("dp.col.disputed")} value={dc.disputed_amount != null ? money(dc.disputed_amount) : "—"} mono />
        <Field label={t("fr.kpi.recovered")} value={money(dc.amount_recovered)} mono />
        <Field label={t("dp.col.due")} value={dc.due_date ?? "—"} mono />
        <Field label={t("dp.field.reason")} value={dc.reason_code ?? "—"} />
        <Field label={t("dp.field.processor")} value={dc.processor?.name ?? "—"} />
        <Field label={t("fr.field.customer")} value={maskName(dc.incident?.customer_name)} />
        <Field label={t("fr.field.txn")} value={dc.transaction_reference ?? "—"} mono />
      </div>

      {canManage && (
        <div style={{ background: "var(--paper)", border: "1px dashed var(--line)", borderRadius: "var(--r-xl)", padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, color: "var(--text)" }}>{t("dp.manage")}</div>
          {next.length > 0 ? (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {next.map((s) => (
                <button key={s} disabled={pending} onClick={() => advance(s)}
                  style={{ fontSize: 12.5, fontWeight: 600, padding: "8px 14px", borderRadius: "var(--r-md)", border: "1px solid var(--accent)", background: "transparent", color: "var(--accent-2)", cursor: "pointer" }}>
                  → {t(("dp.st." + s) as MessageKey)}
                </button>
              ))}
            </div>
          ) : <div style={{ fontSize: 12, color: "var(--muted)" }}>{t("fr.terminal")}</div>}

          {(dc.status === "won" || dc.status === "submitted") && (
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
