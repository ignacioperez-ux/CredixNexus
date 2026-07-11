"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/provider";
import type { AreaRow } from "@/lib/areas/queries";
import { updateDeliveryArea } from "@/lib/areas/actions";

const areaColor: Record<string, string> = { operations: "var(--st-info)", evolution: "var(--accent-2)" };

export function AreaList({ rows, canManage }: { rows: AreaRow[]; canManage: boolean }) {
  const { t } = useI18n();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("area.intro")}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 16 }}>
        {rows.map((a) => <AreaCard key={a.id} a={a} canManage={canManage} />)}
      </div>
    </div>
  );
}

function AreaCard({ a, canManage }: { a: AreaRow; canManage: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [edit, setEdit] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState({ description: a.description ?? "", leadName: a.lead_name ?? "", leadEmail: a.lead_email ?? "", deputyName: a.deputy_name ?? "", deputyEmail: a.deputy_email ?? "" });
  const color = areaColor[a.code] ?? "var(--muted)";
  const isOps = a.code === "operations";

  function save() {
    setErr(null);
    start(async () => { const r = await updateDeliveryArea(a.id, f); if (!r.ok) setErr(r.error ?? "error"); else { setEdit(false); router.refresh(); } });
  }

  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderLeft: `3px solid ${color}`, borderRadius: "var(--r-xl)", padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 17, color: "var(--text)" }}>{a.name}</span>
        <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", color, background: isOps ? "var(--st-info-bg)" : "var(--accent-soft)", padding: "2px 9px", borderRadius: "var(--r-pill)" }}>{a.code}</span>
      </div>
      {a.description && <p style={{ margin: 0, fontSize: 12.5, color: "var(--muted)", lineHeight: 1.5 }}>{a.description}</p>}

      <div style={{ display: "flex", gap: 10 }}>
        <Stat label={isOps ? t("area.stat.incidents") : t("area.stat.projects")} value={String(isOps ? a.incident_count : a.project_count)} href={isOps ? "/incidents" : "/projects"} />
        <Stat label={t("area.owns")} value={isOps ? t("area.owns.incidents") : t("area.owns.projects")} />
      </div>

      {edit ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Field label={t("area.lead")}><input value={f.leadName} onChange={(e) => setF({ ...f, leadName: e.target.value })} style={inp} /></Field>
          <Field label={t("area.lead.email")}><input value={f.leadEmail} onChange={(e) => setF({ ...f, leadEmail: e.target.value })} style={inp} placeholder="correo@credix.com" /></Field>
          <Field label={t("area.deputy")}><input value={f.deputyName} onChange={(e) => setF({ ...f, deputyName: e.target.value })} style={inp} /></Field>
          <Field label={t("area.deputy.email")}><input value={f.deputyEmail} onChange={(e) => setF({ ...f, deputyEmail: e.target.value })} style={inp} /></Field>
          {err && <div style={{ fontSize: 11.5, color: "var(--st-critical)" }}>{err}</div>}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={save} disabled={pending} style={btnPrimary}>{pending ? t("common.saving") : t("common.save")}</button>
            <button onClick={() => setEdit(false)} disabled={pending} style={btnGhost}>{t("common.cancel")}</button>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <Row label={t("area.lead")} value={a.lead_name} sub={a.lead_email} />
          <Row label={t("area.deputy")} value={a.deputy_name} sub={a.deputy_email} />
          {canManage && <button onClick={() => setEdit(true)} style={{ ...btnGhost, alignSelf: "flex-start", marginTop: 4 }}>{t("common.edit")}</button>}
        </div>
      )}
    </div>
  );
}

const inp: React.CSSProperties = { width: "100%", fontSize: 12.5, padding: "8px 10px", borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: "var(--card)", color: "var(--text)", fontFamily: "var(--font-ui)" };
const btnPrimary: React.CSSProperties = { fontSize: 12.5, fontWeight: 600, padding: "8px 14px", borderRadius: "var(--r-md)", border: "none", background: "var(--cta-bg)", color: "var(--cta-fg)", cursor: "pointer" };
const btnGhost: React.CSSProperties = { fontSize: 12.5, fontWeight: 600, padding: "8px 14px", borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: "var(--card)", color: "var(--text)", cursor: "pointer" };
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--muted)", marginBottom: 4 }}>{label}</label>{children}</div>;
}
function Row({ label, value, sub }: { label: string; value?: string | null; sub?: string | null }) {
  return <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "5px 0", borderBottom: "1px solid var(--line-soft)" }}>
    <span style={{ fontSize: 12, color: "var(--muted)" }}>{label}</span>
    <span style={{ fontSize: 12.5, color: "var(--text)", textAlign: "right" }}>{value || "—"}{sub && <span style={{ display: "block", fontSize: 10.5, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>{sub}</span>}</span></div>;
}
function Stat({ label, value, href }: { label: string; value: string; href?: string }) {
  const inner = <div style={{ flex: 1, background: "var(--paper)", borderRadius: "var(--r-md)", padding: "10px 12px" }}>
    <div style={{ fontSize: 10.5, color: "var(--muted)", marginBottom: 4 }}>{label}</div>
    <div style={{ fontFamily: "var(--font-mono)", fontSize: 15, fontWeight: 500, color: "var(--text)" }}>{value}</div></div>;
  return href ? <Link href={href} style={{ flex: 1, textDecoration: "none" }}>{inner}</Link> : inner;
}
