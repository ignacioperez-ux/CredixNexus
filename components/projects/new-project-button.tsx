"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/provider";

export function NewProjectButton() {
  const { t } = useI18n();
  return (
    <Link href="/projects/new" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 16px", borderRadius: "var(--r-md)", background: "var(--cta-bg)", color: "var(--cta-fg)", fontWeight: 700, fontSize: 13, textDecoration: "none" }}>
      <span style={{ color: "var(--cta-icon)", fontSize: 16, lineHeight: 1 }}>+</span>
      {t("proj.new")}
    </Link>
  );
}
