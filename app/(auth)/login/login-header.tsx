"use client";

import { useI18n } from "@/lib/i18n/provider";
import { Wordmark } from "@/components/app-shell/wordmark";

export function LoginHeader() {
  const { t } = useI18n();
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ marginBottom: 20 }}>
        <Wordmark />
      </div>
      <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 20, letterSpacing: "-0.3px", margin: 0, color: "var(--text)" }}>
        {t("login.title")}
      </h1>
      <p style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 6 }}>{t("login.subtitle")}</p>
    </div>
  );
}
