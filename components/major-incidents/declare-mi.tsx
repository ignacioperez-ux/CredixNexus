"use client";

import { Icon } from "@/components/ui/icon";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import { declareMajorIncident } from "@/lib/major-incidents/actions";
import { SEVERITIES } from "@/lib/major-incidents/validation";
import { MiStatusBadge } from "./badges";

type Linked = { id: string; mi_number: string; severity: string; status: string } | null;

/** Declara un incidente mayor desde el caso, o muestra el vinculo si ya existe. */
export function DeclareMi({ incidentId, incidentTitle, isP1, linked, canManage }: { incidentId: string; incidentTitle: string; isP1: boolean; linked: Linked; canManage: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [sev, setSev] = useState("sev1");
  const [err, setErr] = useState<string | null>(null);

  if (linked) {
    return (
      <Link href={`/major-incidents/${linked.id}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: "var(--r-md)", background: "var(--st-critical-bg)", textDecoration: "none" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--st-critical-fg)", fontWeight: 700 }}>{linked.mi_number}</span>
        <span style={{ fontSize: 12.5, color: "var(--text)", flex: 1 }}>{t("mi.linked")}</span>
        <MiStatusBadge status={linked.status} />
      </Link>
    );
  }
  if (!canManage) return <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("mi.none")}</div>;

  function declare() {
    setErr(null);
    start(async () => {
      const r = await declareMajorIncident({ incidentId, title: incidentTitle, severity: sev });
      if (!r.ok) setErr(r.error ?? "error");
      else router.push(`/major-incidents/${r.id}`);
    });
  }

  if (!open) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {!isP1 && <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{t("mi.hint.notp1")}</div>}
        <button onClick={() => setOpen(true)} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, padding: "7px 12px", borderRadius: "var(--r-md)", border: "1px solid var(--st-critical)", background: "var(--st-critical-bg)", color: "var(--st-critical-fg)", cursor: "pointer" }}><Icon name="alert" size={13} /> {t("mi.declare")}</button>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <select value={sev} onChange={(e) => setSev(e.target.value)} style={{ fontSize: 12.5, padding: "7px 9px", borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: "var(--card)", color: "var(--text)" }}>
        {SEVERITIES.map((s) => <option key={s} value={s}>{t(("mi.sev." + s) as MessageKey)}</option>)}
      </select>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={declare} disabled={pending} style={{ flex: 1, fontSize: 12, fontWeight: 600, padding: "7px 12px", borderRadius: "var(--r-md)", border: "none", background: "var(--st-critical)", color: "#fff", cursor: "pointer" }}>{pending ? t("mi.declaring") : t("mi.declare.confirm")}</button>
        <button onClick={() => setOpen(false)} disabled={pending} style={{ fontSize: 12, fontWeight: 600, padding: "7px 12px", borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: "var(--card)", color: "var(--text)", cursor: "pointer" }}>{t("common.cancel")}</button>
      </div>
      {err && <div style={{ fontSize: 11, color: "var(--st-critical)" }}>{err}</div>}
    </div>
  );
}
