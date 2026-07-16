"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/provider";
import { Icon } from "@/components/ui/icon";
import { markAllNotificationsRead, markNotificationRead } from "@/lib/notifications/actions";
import type { NotificationsData } from "@/lib/notifications/queries";

const SEV: Record<string, string> = { success: "var(--st-low-fg)", warning: "var(--st-high-fg)", critical: "var(--st-critical-fg)", info: "var(--st-info)" };

export function OpNotificationsView({ data }: { data: NotificationsData }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 820 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: "var(--text)", margin: 0 }}>{t("nav.notificaciones")}{data.unread > 0 ? <span style={{ marginLeft: 8, fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--accent-2)", background: "var(--accent-soft)", borderRadius: 20, padding: "2px 9px" }}>{data.unread}</span> : null}</h1>
        {data.unread > 0 && (
          <button onClick={() => start(async () => { await markAllNotificationsRead(); router.refresh(); })} disabled={pending}
            style={{ fontSize: 12.5, fontWeight: 600, padding: "7px 13px", borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: "var(--card)", color: "var(--text)", cursor: "pointer" }}>{t("op.notif.markall")}</button>
        )}
      </div>

      {data.items.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "56px 20px", textAlign: "center", color: "var(--muted)" }}>
          <Icon name="bell" size={30} strokeWidth={1.4} color="var(--muted)" />
          <div style={{ fontSize: 13, color: "var(--text)", fontWeight: 600 }}>{t("op.notif.empty")}</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {data.items.map((n) => {
            const body = (
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "11px 13px", borderRadius: "var(--r-md)", background: n.is_read ? "var(--card)" : "var(--accent-soft)", border: "1px solid var(--line)" }}>
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: SEV[n.severity] ?? "var(--muted)", marginTop: 5, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: n.is_read ? 500 : 700, color: "var(--text)" }}>{n.title}</div>
                  {n.body && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2, lineHeight: 1.45 }}>{n.body}</div>}
                  <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 4, fontFamily: "var(--font-mono)" }}>{new Date(n.created_at).toLocaleString(locale)}</div>
                </div>
                {!n.is_read && <button onClick={(e) => { e.preventDefault(); start(async () => { await markNotificationRead(n.id); router.refresh(); }); }} title={t("op.notif.markone")} style={{ border: "none", background: "transparent", color: "var(--muted)", cursor: "pointer", flexShrink: 0 }}><Icon name="check" size={14} /></button>}
              </div>
            );
            return n.link ? <Link key={n.id} href={n.link} style={{ textDecoration: "none" }} onClick={() => { if (!n.is_read) start(async () => { await markNotificationRead(n.id); }); }}>{body}</Link> : <div key={n.id}>{body}</div>;
          })}
        </div>
      )}
    </div>
  );
}
