"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import { maskTaxId, maskEmail, maskPhone } from "@/lib/customers/queries";
import { StatusPill } from "@/components/incidents/badges";
import { BackButton } from "@/components/common/back-button";

type Party = { id: string; display_name: string; segment: string | null; vip_flag: boolean; risk_level: string; tax_id: string | null; email: string | null; phone: string | null } | null;
type Case = { id: string; incident_number: string; title: string; status: string; case_type: string; opened_at: string; amount: number | null; currency: string };
type Data = { party: Party; cases: Case[]; products: string[]; openCases: number; totalCases: number };

export function Customer360({ data }: { data: Data }) {
  const { t, locale } = useI18n();
  const p = data.party;
  if (!p) return null;

  const alerts: string[] = [];
  if (p.vip_flag) alerts.push(t("cust.alert.vip"));
  if (p.risk_level === "high" || p.risk_level === "critical") alerts.push(t("cust.alert.highrisk"));
  if (data.openCases > 0) alerts.push(`${data.openCases} ${t("cust.alert.open")}`);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <BackButton fallback="/customers" />
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 18 }}>
        <div style={{ width: 46, height: 46, borderRadius: "50%", background: "var(--dark-surface)", color: "var(--accent-bright)", display: "grid", placeItems: "center", fontFamily: "var(--font-mono)", fontWeight: 500, flexShrink: 0 }}>
          {p.display_name.split(/\s+/).map((x) => x[0]).slice(0, 2).join("")}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 19, color: "var(--text)" }}>{p.display_name}</span>
            {p.vip_flag && <span style={{ fontSize: 10.5, padding: "2px 9px", borderRadius: "var(--r-pill)", background: "var(--accent-soft)", color: "var(--accent-2)", fontWeight: 700 }}>VIP</span>}
          </div>
          <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{p.segment ?? "—"} · {t("cust.risk")}: {t(("lvl." + p.risk_level) as MessageKey)}</div>
        </div>
      </div>

      {/* Alertas */}
      {alerts.length > 0 && (
        <div style={{ background: "var(--st-medium-bg)", border: "1px solid var(--st-medium)", borderRadius: "var(--r-lg)", padding: "12px 16px" }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--st-medium-fg)", marginBottom: 6 }}>⚠ {t("cust.alerts")}</div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: "var(--text)" }}>{alerts.map((a) => <li key={a}>{a}</li>)}</ul>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 16, alignItems: "start" }}>
        {/* Casos */}
        <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", overflow: "hidden" }}>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, color: "var(--text)", padding: "16px 20px", borderBottom: "1px solid var(--line)" }}>
            {t("cust.cases")} <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)" }}>({data.totalCases})</span>
          </div>
          {data.cases.length === 0 ? <div style={{ padding: 24, color: "var(--muted)", fontSize: 13 }}>{t("cust.nocases")}</div> : data.cases.map((c) => (
            <Link key={c.id} href={`/incidents/${c.id}`} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 20px", borderTop: "1px solid var(--line-soft)", textDecoration: "none" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--accent-2)", width: 120 }}>{c.incident_number}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.title}</div>
                <div style={{ fontSize: 10.5, color: "var(--muted)" }}>{c.case_type} · {new Date(c.opened_at).toLocaleDateString(locale)}</div>
              </div>
              <StatusPill status={c.status} />
            </Link>
          ))}
        </div>

        {/* Identidad + productos */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 20 }}>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, marginBottom: 14, color: "var(--text)" }}>🔒 {t("cust.identity")}</div>
            <Row label={t("cust.taxid")} value={maskTaxId(p.tax_id)} />
            <Row label={t("cust.email")} value={maskEmail(p.email)} />
            <Row label={t("cust.phone")} value={maskPhone(p.phone)} />
          </div>
          <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 20 }}>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, marginBottom: 12, color: "var(--text)" }}>{t("cust.products")}</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {data.products.length === 0 && <span style={{ fontSize: 12, color: "var(--muted)" }}>—</span>}
              {data.products.map((pr) => <span key={pr} style={{ fontSize: 11.5, padding: "3px 10px", borderRadius: "var(--r-pill)", background: "var(--paper)", color: "var(--text)" }}>{pr}</span>)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "6px 0", borderBottom: "1px solid var(--line-soft)" }}>
    <span style={{ fontSize: 12, color: "var(--muted)" }}>{label}</span>
    <span style={{ fontSize: 12.5, color: "var(--text)", fontFamily: "var(--font-mono)" }}>{value}</span></div>;
}
