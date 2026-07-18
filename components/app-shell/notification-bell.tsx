"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/provider";
import { Icon } from "@/components/ui/icon";
import type { NotificationItem, NotificationsData } from "@/lib/notifications/queries";
import { markNotificationRead, markAllNotificationsRead, fetchNotifications } from "@/lib/notifications/actions";

const SEV_COLOR: Record<string, string> = {
  info: "var(--st-info-fg, var(--accent-2))", success: "var(--st-low-fg)", warning: "var(--st-high-fg)", critical: "var(--st-critical-fg)",
};

const POLL_MS = 60000; // refresco en vivo de la campanita (sin realtime): cada 60s + al enfocar

export function NotificationBell({ data }: { data: NotificationsData }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [, start] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  // Estado propio sembrado por el server; se refresca en vivo sin recargar la pagina.
  const [feed, setFeed] = useState<NotificationsData>(data);
  useEffect(() => { setFeed(data); }, [data]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  // Refresco en vivo: polling + al recuperar foco/visibilidad de la pestana.
  useEffect(() => {
    let alive = true;
    const refresh = () => { fetchNotifications().then((d) => { if (alive) setFeed(d); }).catch(() => {}); };
    const id = setInterval(refresh, POLL_MS);
    const onVis = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", refresh);
    return () => { alive = false; clearInterval(id); document.removeEventListener("visibilitychange", onVis); window.removeEventListener("focus", refresh); };
  }, []);

  const unread = feed.unread;

  function openItem(n: NotificationItem) {
    setOpen(false);
    // Marca leida de forma optimista para que el badge no quede obsoleto.
    if (!n.is_read) setFeed((f) => ({ items: f.items.map((i) => i.id === n.id ? { ...i, is_read: true } : i), unread: Math.max(0, f.unread - 1) }));
    start(async () => {
      if (!n.is_read) await markNotificationRead(n.id);
      // Fallback: si la notificacion no trae link, abre el centro de notificaciones (nunca un click muerto).
      router.push(n.link || "/notificaciones");
      router.refresh();
    });
  }
  function markAll() {
    setFeed((f) => ({ items: f.items.map((i) => ({ ...i, is_read: true })), unread: 0 }));
    start(async () => { await markAllNotificationsRead(); const d = await fetchNotifications(); setFeed(d); router.refresh(); });
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        title={t("notif.title")}
        aria-label={t("notif.title")}
        style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", width: 40, height: 40, borderRadius: "var(--r-md)", background: open ? "var(--paper)" : "var(--card)", border: "1px solid var(--line)", color: "var(--text)", cursor: "pointer" }}
      >
        <Icon name="bell" size={17} />
        {unread > 0 && (
          <span style={{ position: "absolute", top: -5, right: -5, minWidth: 17, height: 17, padding: "0 4px", borderRadius: 9, background: "var(--accent)", color: "var(--on-accent, #fff)", fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid var(--card)" }}>
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div style={{ position: "absolute", top: 46, right: 0, width: 340, maxWidth: "90vw", background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", boxShadow: "0 18px 44px -18px rgba(0,0,0,.4)", zIndex: 60, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderBottom: "1px solid var(--line)" }}>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, color: "var(--text)" }}>{t("notif.title")}</span>
            {unread > 0 && <button onClick={markAll} style={{ fontSize: 11.5, fontWeight: 600, color: "var(--accent-2)", background: "none", border: "none", cursor: "pointer" }}>{t("notif.markall")}</button>}
          </div>
          <div style={{ maxHeight: 380, overflowY: "auto" }}>
            {feed.items.length === 0 ? (
              <div style={{ padding: "28px 16px", textAlign: "center", color: "var(--muted)", fontSize: 12.5 }}>{t("notif.empty")}</div>
            ) : feed.items.map((n) => (
              <button key={n.id} onClick={() => openItem(n)}
                style={{ display: "flex", gap: 10, width: "100%", textAlign: "left", padding: "11px 14px", borderBottom: "1px solid var(--line-soft, var(--line))", background: n.is_read ? "transparent" : "var(--accent-soft, var(--paper))", border: "none", cursor: "pointer" }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", marginTop: 5, flexShrink: 0, background: n.is_read ? "transparent" : (SEV_COLOR[n.severity] ?? "var(--accent)") }} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 12.5, fontWeight: n.is_read ? 500 : 700, color: "var(--text)" }}>{n.title}</span>
                  {n.body && <span style={{ display: "block", fontSize: 11.5, color: "var(--muted)", marginTop: 2, lineHeight: 1.4 }}>{n.body}</span>}
                  <span style={{ display: "block", fontSize: 10.5, color: "var(--muted)", marginTop: 3, fontFamily: "var(--font-mono)" }}>{timeAgo(n.created_at, locale, t("notif.now"))}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function timeAgo(iso: string, locale: string, nowLabel: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return nowLabel;
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString(locale === "es" ? "es-CR" : "en-US", { day: "2-digit", month: "short" });
}
