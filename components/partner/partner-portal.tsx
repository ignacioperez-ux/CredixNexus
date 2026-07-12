"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/provider";
import type { PartnerPortal } from "@/lib/partner/queries";
import { StatusPill } from "@/components/incidents/badges";

export function PartnerPortalView({ data }: { data: PartnerPortal }) {
  const { t, locale } = useI18n();
  // Acento de marca Credix (rojo). Un partner real puede traer su propio brand_accent.
  const accent = data.party?.accent ?? "var(--accent)";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Branding del partner */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 18 }}>
        <div style={{ width: 46, height: 46, borderRadius: 12, background: accent, color: "#fff", display: "grid", placeItems: "center", fontFamily: "var(--font-mono)", fontWeight: 500, fontSize: 16, flexShrink: 0 }}>
          {data.party?.monogram ?? "PP"}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18, color: "var(--text)" }}>
            {t("pp.title")} — {data.party?.name ?? "—"}
          </div>
          <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("pp.subtitle")}</div>
        </div>
        <span style={{ fontSize: 11.5, fontWeight: 600, padding: "5px 12px", borderRadius: "var(--r-pill)", background: "var(--accent-soft)", color: "var(--accent-2)" }}>
          🔒 {t("pp.isolation")}
        </span>
      </div>

      {/* KPIs del partner */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
        <Kpi label={t("pp.kpi.open")} value={data.kpis.open} />
        <Kpi label={t("pp.kpi.resolved")} value={data.kpis.resolved} />
        <Kpi label={t("pp.kpi.total")} value={data.kpis.total} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 16, alignItems: "start" }}>
        {/* Mis tickets */}
        <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", overflow: "hidden" }}>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, color: "var(--text)", padding: "16px 20px", borderBottom: "1px solid var(--line)" }}>{t("pp.mytickets")}</div>
          {data.tickets.length === 0 ? (
            <div style={{ padding: 30, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>{t("pp.empty")}</div>
          ) : (
            data.tickets.map((tk) => (
              <div key={tk.incident_number} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 20px", borderTop: "1px solid var(--line-soft)" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--accent-2)", width: 120 }}>{tk.incident_number}</span>
                <span style={{ flex: 1, fontSize: 13, color: "var(--text)" }}>{tk.title}</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--muted)" }}>{new Date(tk.opened_at).toLocaleDateString(locale)}</span>
                <StatusPill status={tk.status} />
              </div>
            ))
          )}
        </div>

        {/* Autoservicio */}
        <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 20 }}>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, color: "var(--text)", marginBottom: 14 }}>{t("pp.selfservice")}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[{ label: t("pp.ss.newticket"), href: "/portal" }, { label: t("pp.ss.kb"), href: "/knowledge" }].map((s) => (
              <Link key={s.href} href={s.href} style={{ display: "block", padding: "11px 14px", borderRadius: "var(--r-md)", background: "var(--paper)", fontSize: 13, color: "var(--text)", cursor: "pointer", textDecoration: "none" }}>{s.label} →</Link>
            ))}
          </div>
          <p style={{ marginTop: 16, fontSize: 11.5, color: "var(--muted)", lineHeight: 1.5 }}>{t("pp.governance")}</p>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 16 }}>
      <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--muted)", marginBottom: 10 }}>{label}</div>
      <div style={{ fontFamily: "var(--font-mono)", fontWeight: 500, fontSize: 28, letterSpacing: "-1.5px", color: "var(--text)" }}>{value}</div>
    </div>
  );
}
