"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import { BackButton } from "@/components/common/back-button";
import { StatusPill } from "./request-list";
import type { FormField } from "@/lib/catalog/validation";
import { fulfillRequest, cancelRequest } from "@/lib/catalog/actions";

export type RequestDetailData = {
  id: string; request_number: string; status: string; form_data: Record<string, unknown>; sla_due_at: string | null; created_at: string; fulfilled_at: string | null;
  item: { name: string; code: string; form_schema: FormField[]; sla_hours: number } | null;
  incident: { id: string; incident_number: string; title: string; status: string; priority: string } | null;
  requester: { full_name: string } | null;
};

export function RequestDetail({ req, canManage }: { req: RequestDetailData; canManage: boolean }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const schema = req.item?.form_schema ?? [];

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, okKey: MessageKey) {
    setMsg(null);
    start(async () => {
      const r = await fn();
      if (!r.ok) setMsg({ kind: "err", text: t(("err." + (r.error ?? "ERR_INVALID_STATE")) as MessageKey) });
      else { setMsg({ kind: "ok", text: t(okKey) }); router.refresh(); }
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 820 }}>
      <BackButton fallback="/service-catalog" />
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 18, color: "var(--accent-2)" }}>{req.request_number}</span>
        <StatusPill status={req.status} />
        <span style={{ fontSize: 13, color: "var(--text)" }}>{req.item?.name}</span>
      </div>

      {msg && <div style={{ fontSize: 12.5, fontWeight: 600, padding: "9px 14px", borderRadius: "var(--r-md)", background: msg.kind === "ok" ? "var(--st-low-bg)" : "var(--st-critical-bg)", color: msg.kind === "ok" ? "var(--st-low-fg)" : "var(--st-critical-fg)" }}>{msg.text}</div>}

      {/* Ancla: la mesa nunca pierde el control */}
      {req.incident && (
        <Link href={`/incidents/${req.incident.id}`} style={{ textDecoration: "none" }}>
          <div style={{ background: "var(--paper)", border: "1px solid var(--line)", borderLeft: "3px solid var(--accent)", borderRadius: "var(--r-md)", padding: "12px 14px" }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "var(--accent-2)", marginBottom: 4 }}>{t("cat.anchor")}</div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--accent-2)" }}>{req.incident.incident_number}</span>
              <span style={{ fontSize: 13, color: "var(--text)" }}>{req.incident.title}</span>
            </div>
          </div>
        </Link>
      )}

      {/* Datos del formulario */}
      <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 20, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
        {schema.length === 0 && <div style={{ fontSize: 12.5, color: "var(--muted)" }}>—</div>}
        {schema.map((f) => (
          <div key={f.key}>
            <div style={{ fontSize: 10.5, fontWeight: 600, color: "var(--muted)", marginBottom: 5 }}>{f.label}</div>
            <div style={{ fontSize: 13.5, color: "var(--text)" }}>{req.form_data[f.key] != null && String(req.form_data[f.key]).length > 0 ? String(req.form_data[f.key]) : "—"}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 18, flexWrap: "wrap", fontSize: 12, color: "var(--muted)" }}>
        <span>{t("cat.requester")}: <b style={{ color: "var(--text)" }}>{req.requester?.full_name ?? "—"}</b></span>
        <span>{t("cat.col.due")}: <b style={{ color: "var(--text)", fontFamily: "var(--font-mono)" }}>{req.sla_due_at ? new Date(req.sla_due_at).toLocaleString(locale) : "—"}</b></span>
        {req.fulfilled_at && <span>{t("cat.st.fulfilled")}: <b style={{ color: "var(--text)", fontFamily: "var(--font-mono)" }}>{new Date(req.fulfilled_at).toLocaleString(locale)}</b></span>}
      </div>

      {canManage && req.status === "open" && (
        <div style={{ background: "var(--paper)", border: "1px dashed var(--line)", borderRadius: "var(--r-xl)", padding: 18, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button disabled={pending} onClick={() => run(() => fulfillRequest(req.id), "cat.msg.fulfilled")}
            style={{ fontSize: 12.5, fontWeight: 600, padding: "9px 16px", borderRadius: "var(--r-md)", border: "none", background: "var(--cta-bg)", color: "var(--cta-fg)", cursor: "pointer" }}>{t("cat.fulfill")}</button>
          <button disabled={pending} onClick={() => run(() => cancelRequest(req.id), "cat.msg.cancelled")}
            style={{ fontSize: 12.5, fontWeight: 600, padding: "9px 16px", borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: "transparent", color: "var(--text)", cursor: "pointer" }}>{t("cat.cancel")}</button>
        </div>
      )}
    </div>
  );
}
