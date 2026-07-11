"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import { deactivateVendor, reactivateVendor } from "@/lib/vendors/actions";
import { CriticalityBadge, VendorStatusBadge } from "./badges";
import { BackButton } from "@/components/common/back-button";

type VendorView = {
  id: string; code: string; name: string; legal_name: string | null; category: string; criticality: string; status: string;
  contact_name: string | null; contact_email: string | null; contact_phone: string | null; website: string | null;
  contract_number: string | null; contract_start: string | null; contract_end: string | null; sla_terms: string | null; notes: string | null;
};
type Sys = { id: string; name: string; ci_type: string };
type Inc = { id: string; incident_number: string; title: string; status: string; priority: string };

export function VendorDetail({ vendor, systems, incidents, canManage }: { vendor: VendorView; systems: Sys[]; incidents: Inc[]; canManage: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();

  function toggle() {
    start(async () => {
      await (vendor.status === "active" ? deactivateVendor(vendor.id) : reactivateVendor(vendor.id));
      router.refresh();
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <BackButton fallback="/vendors" />
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--accent-2)" }}>{vendor.code}</span>
          <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 20, margin: 0, color: "var(--text)" }}>{vendor.name}</h1>
          <CriticalityBadge criticality={vendor.criticality} />
          <VendorStatusBadge status={vendor.status} />
        </div>
        {canManage && (
          <div style={{ display: "flex", gap: 8 }}>
            <Link href={`/vendors/${vendor.id}/edit`} style={{ ...btnGhost, textDecoration: "none" } as React.CSSProperties}>{t("common.edit")}</Link>
            <button onClick={toggle} disabled={pending} style={btnGhost}>{vendor.status === "active" ? t("vnd.deactivate") : t("vnd.activate")}</button>
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Card title={t("vnd.section.detail")}>
          <Row label={t("vnd.f.legal")} value={vendor.legal_name} />
          <Row label={t("vnd.f.category")} value={t(("vnd.cat." + vendor.category) as MessageKey)} />
          <Row label={t("vnd.f.contact")} value={vendor.contact_name} />
          <Row label={t("vnd.f.email")} value={vendor.contact_email} />
          <Row label={t("vnd.f.phone")} value={vendor.contact_phone} />
          <Row label={t("vnd.f.website")} value={vendor.website} />
        </Card>
        <Card title={t("vnd.section.contract")}>
          <Row label={t("vnd.f.contractnumber")} value={vendor.contract_number} mono />
          <Row label={t("vnd.f.start")} value={vendor.contract_start} mono />
          <Row label={t("vnd.f.end")} value={vendor.contract_end} mono />
          {vendor.sla_terms && <p style={pStyle}>{vendor.sla_terms}</p>}
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 16 }}>
        <Card title={`${t("vnd.section.systems")} (${systems.length})`}>
          {systems.length === 0 ? <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("vnd.nosystems")}</div> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {systems.map((s) => (
                <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: "var(--r-md)", background: "var(--paper)" }}>
                  <span style={{ fontSize: 12.5, color: "var(--text)", flex: 1 }}>{s.name}</span>
                  <span style={{ fontSize: 10.5, color: "var(--muted)" }}>{s.ci_type}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card title={`${t("vnd.section.incidents")} (${incidents.length})`}>
          {incidents.length === 0 ? <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("vnd.noincidents")}</div> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {incidents.map((i) => (
                <Link key={i.id} href={`/incidents/${i.id}`} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: "var(--r-md)", background: "var(--paper)", textDecoration: "none" }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent-2)" }}>{i.incident_number}</span>
                  <span style={{ fontSize: 12.5, color: "var(--text)", flex: 1 }}>{i.title}</span>
                  <span style={{ fontSize: 10.5, color: "var(--muted)" }}>{i.status}</span>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

const pStyle: React.CSSProperties = { margin: "8px 0 0", fontSize: 12.5, lineHeight: 1.5, color: "var(--muted)" };
const btnGhost: React.CSSProperties = { fontSize: 12.5, fontWeight: 600, padding: "8px 14px", borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: "var(--card)", color: "var(--text)", cursor: "pointer" };
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 20 }}>
    <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, marginBottom: 14, color: "var(--text)" }}>{title}</div>{children}</div>;
}
function Row({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  return <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "6px 0", borderBottom: "1px solid var(--line-soft)" }}>
    <span style={{ fontSize: 12, color: "var(--muted)" }}>{label}</span>
    <span style={{ fontSize: 12.5, color: "var(--text)", fontFamily: mono ? "var(--font-mono)" : "var(--font-ui)", textAlign: "right" }}>{value || "—"}</span></div>;
}
