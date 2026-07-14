"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/provider";
import { Icon } from "@/components/ui/icon";

export function Unauthorized() {
  const { t } = useI18n();
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, minHeight: "60vh", textAlign: "center" }}>
      <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--st-critical-bg)", display: "grid", placeItems: "center", color: "var(--st-critical-fg)" }}><Icon name="lock" size={24} /></div>
      <h1 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, color: "var(--text)" }}>{t("unauth.title")}</h1>
      <p style={{ margin: 0, fontSize: 13.5, color: "var(--muted)", maxWidth: 420 }}>{t("unauth.body")}</p>
      {/* /start resuelve el home por rol (usuario final -> /portal); evita el bucle a /dashboard. */}
      <Link href="/start" style={{ marginTop: 6, fontSize: 13, fontWeight: 600, padding: "10px 18px", borderRadius: "var(--r-md)", background: "var(--cta-bg)", color: "var(--cta-fg)", textDecoration: "none" }}>{t("unauth.home")}</Link>
    </div>
  );
}
