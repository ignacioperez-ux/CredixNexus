"use client";

import { Icon } from "@/components/ui/icon";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/provider";
import { ChangeStatusBadge } from "./badges";

type LinkedChange = { id: string; change_number: string; title: string; status: string; risk_level: string };

/** Cambios ligados a un caso/problema + crear uno nuevo prellenando el origen. */
export function ChangeLink({ changes, canManage, newHref }: { changes: LinkedChange[]; canManage: boolean; newHref: string }) {
  const { t } = useI18n();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {changes.length === 0 ? (
        <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("chg.link.none")}</div>
      ) : (
        changes.map((c) => (
          <Link key={c.id} href={`/changes/${c.id}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: "var(--r-md)", background: "var(--paper)", textDecoration: "none" }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent-2)" }}>{c.change_number}</span>
            <span style={{ fontSize: 12.5, color: "var(--text)", flex: 1 }}>{c.title}</span>
            <ChangeStatusBadge status={c.status} />
          </Link>
        ))
      )}
      {canManage && (
        <Link href={newHref} style={{ fontSize: 12, fontWeight: 600, padding: "7px 12px", borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: "var(--card)", color: "var(--accent-2)", textDecoration: "none", textAlign: "center" }}>
          <Icon name="gear" size={13} style={{ verticalAlign: "-2px" }} /> {t("chg.create")}
        </Link>
      )}
    </div>
  );
}
