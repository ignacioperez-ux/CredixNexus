"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/provider";
import { requestFederatedAccess } from "@/lib/auth/access-request";
import { signOutAction } from "@/lib/auth/actions";

// Tarjeta de "sin acceso": registra la solicitud SI_SOLICITUD_ACCESO (RPC) y cierra la sesion.
export function NoAccessCard({ email, fullName }: { email: string; fullName: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [state, setState] = useState<"idle" | "sending" | "sent" | "duplicate" | "error">("idle");

  async function onRequest() {
    setState("sending");
    const r = await requestFederatedAccess(fullName || undefined);
    if (!r.ok) { setState("error"); return; }
    setState(r.duplicate ? "duplicate" : "sent");
  }

  const done = state === "sent" || state === "duplicate";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 800, color: "var(--text)", margin: 0 }}>
        {t("noaccess.title")}
      </h1>
      <p style={{ fontSize: 13.5, color: "var(--muted)", lineHeight: 1.5, margin: 0 }}>{t("noaccess.body")}</p>

      {email && (
        <div style={{ fontSize: 12.5, color: "var(--text)", background: "var(--paper)", border: "1px solid var(--line)", borderRadius: "var(--r-md)", padding: "10px 12px" }}>
          <span style={{ color: "var(--muted)", marginRight: 6 }}>{t("noaccess.account")}</span>
          <span style={{ fontWeight: 600 }}>{email}</span>
        </div>
      )}

      {done && (
        <div role="status" style={{ fontSize: 12.5, color: "var(--st-low-fg)", background: "var(--st-low-bg)", border: "1px solid var(--st-low)", borderRadius: "var(--r-md)", padding: "10px 12px" }}>
          {t(state === "duplicate" ? "noaccess.duplicate" : "noaccess.sent")}
        </div>
      )}
      {state === "error" && (
        <div role="alert" style={{ fontSize: 12.5, color: "var(--st-critical-fg)", background: "var(--st-critical-bg)", border: "1px solid var(--st-critical)", borderRadius: "var(--r-md)", padding: "10px 12px" }}>
          {t("noaccess.error")}
        </div>
      )}

      {!done && (
        <button
          onClick={onRequest}
          disabled={state === "sending"}
          style={{ minHeight: 44, borderRadius: "var(--r-md)", background: "var(--cta-bg)", color: "var(--cta-fg)", border: "none", fontWeight: 700, fontSize: 13, cursor: state === "sending" ? "default" : "pointer", opacity: state === "sending" ? 0.7 : 1 }}
        >
          {state === "sending" ? t("noaccess.sending") : t("noaccess.cta")}
        </button>
      )}

      <button
        onClick={() => { if (done) { router.push("/login"); } else { signOutAction(); } }}
        style={{ minHeight: 40, borderRadius: "var(--r-md)", background: "transparent", color: "var(--muted)", border: "1px solid var(--line)", fontWeight: 600, fontSize: 12.5, cursor: "pointer" }}
      >
        {t("noaccess.signout")}
      </button>
    </div>
  );
}
