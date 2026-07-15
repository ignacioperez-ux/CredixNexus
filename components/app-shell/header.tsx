"use client";

import { usePathname, useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/provider";
import { useTheme, type Theme } from "@/components/theme-provider";
import { Icon } from "@/components/ui/icon";
import { resolvePrimaryAction } from "@/lib/nav/role-ux";
import { signOutAction } from "@/lib/auth/actions";
import { NotificationBell } from "./notification-bell";
import type { NotificationsData } from "@/lib/notifications/queries";
import type { MessageKey } from "@/lib/i18n/dictionaries";

const TITLES: { prefix: string; title: MessageKey; subtitle: MessageKey }[] = [
  { prefix: "/dashboard", title: "dash.title", subtitle: "dash.subtitle" },
  { prefix: "/workspace", title: "ws.title", subtitle: "ws.subtitle" },
  { prefix: "/portal", title: "portal.title", subtitle: "portal.subtitle" },
  { prefix: "/service-catalog", title: "cat.title", subtitle: "cat.subtitle" },
  { prefix: "/analytics", title: "an.title", subtitle: "an.subtitle" },
  { prefix: "/triage", title: "tri.queue.title", subtitle: "tri.queue.subtitle" },
  { prefix: "/incidents", title: "inc.title", subtitle: "inc.subtitle" },
  { prefix: "/major-incidents", title: "mi.title", subtitle: "mi.subtitle" },
  { prefix: "/problems", title: "prob.title", subtitle: "prob.subtitle" },
  { prefix: "/changes", title: "chg.title", subtitle: "chg.subtitle" },
  { prefix: "/customers", title: "cust.title", subtitle: "cust.subtitle" },
  { prefix: "/fraud-disputes", title: "fr.title", subtitle: "fr.subtitle" },
  { prefix: "/sla-governance", title: "sla.title", subtitle: "sla.subtitle" },
  { prefix: "/risk", title: "risk.title", subtitle: "risk.subtitle" },
  { prefix: "/workflows", title: "wf.title", subtitle: "wf.subtitle" },
  { prefix: "/rules", title: "rule.title", subtitle: "rule.subtitle" },
  { prefix: "/casos-convertidos", title: "cc.title", subtitle: "cc.subtitle" },
  { prefix: "/projects", title: "proj.title", subtitle: "proj.subtitle" },
  { prefix: "/workload", title: "wl.title", subtitle: "wl.subtitle" },
  { prefix: "/squads", title: "sq.title", subtitle: "sq.subtitle" },
  { prefix: "/talent", title: "tal.title", subtitle: "tal.subtitle" },
  { prefix: "/ledger", title: "led.title", subtitle: "led.subtitle" },
  { prefix: "/knowledge", title: "kb.title", subtitle: "kb.subtitle" },
  { prefix: "/catalog", title: "md.title", subtitle: "md.subtitle" },
  { prefix: "/cmdb", title: "cmdb.title", subtitle: "cmdb.subtitle" },
  { prefix: "/processes", title: "proc.title", subtitle: "proc.subtitle" },
  { prefix: "/dependencies", title: "dep.title", subtitle: "dep.subtitle" },
  { prefix: "/delivery-areas", title: "area.title", subtitle: "area.subtitle" },
  { prefix: "/vendors", title: "vnd.title", subtitle: "vnd.subtitle" },
  { prefix: "/admin", title: "adm.title", subtitle: "adm.subtitle" },
  { prefix: "/observability", title: "obs.title", subtitle: "obs.subtitle" },
  { prefix: "/partner", title: "pp.title", subtitle: "pp.subtitle" },
  { prefix: "/ai-center", title: "aic.title", subtitle: "aic.subtitle" },
];

export function Header({ roles = [], perms = [], isAdmin = false, notifications }: { roles?: string[]; perms?: string[]; isAdmin?: boolean; notifications?: NotificationsData }) {
  const pathname = usePathname();
  const router = useRouter();
  const { t, locale, setLocale } = useI18n();
  const { theme, setTheme } = useTheme();

  const meta =
    TITLES.find((x) => pathname === x.prefix || pathname.startsWith(x.prefix + "/")) ??
    { title: "nav.dashboard" as MessageKey, subtitle: "app.tagline" as MessageKey };

  // Accion primaria por rol (FASE 2): CTA de acento resuelta por ROLE_UX, filtrada por permiso.
  const primary = resolvePrimaryAction(roles, perms, isAdmin);

  return (
    <header
      style={{
        minHeight: 66,
        flexShrink: 0,
        background: "var(--card)",
        borderBottom: "1px solid var(--line)",
        display: "flex",
        alignItems: "center",
        gap: 16,
        rowGap: 10,
        flexWrap: "wrap",       /* a ~920px envuelve: titulo en una linea, controles a la segunda */
        padding: "10px 26px",
      }}
    >
      <div style={{ flex: 1, minWidth: 240 }}>
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18, letterSpacing: "-0.3px", color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {t(meta.title)}
        </div>
        <div style={{ fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t(meta.subtitle)}</div>
      </div>

      {/* Accion primaria por rol */}
      {primary && (
        <button
          onClick={() => router.push(primary.route)}
          style={{ display: "flex", alignItems: "center", gap: 7, height: 40, padding: "0 16px", borderRadius: "var(--r-md)", background: "var(--cta-bg)", border: "none", color: "var(--cta-fg)", cursor: "pointer", fontSize: 13, fontWeight: 700, whiteSpace: "nowrap" }}
        >
          <Icon name={primary.icon} size={15} color="var(--cta-icon)" />
          <span>{t(primary.label)}</span>
        </button>
      )}

      {/* Buscador global / Command Menu (Cmd/Ctrl+K) */}
      <button
        onClick={() => window.dispatchEvent(new CustomEvent("cx:open-command"))}
        title={t("cmd.open")}
        style={{ display: "flex", alignItems: "center", gap: 8, height: 40, padding: "0 12px", borderRadius: "var(--r-md)", background: "var(--paper)", border: "1px solid var(--line)", color: "var(--muted)", cursor: "pointer", fontSize: 12.5, fontWeight: 600 }}
      >
        <Icon name="search" size={15} />
        <span>{t("cmd.open")}</span>
        <span style={{ fontSize: 10.5, fontWeight: 700, border: "1px solid var(--line)", borderRadius: 5, padding: "1px 6px" }}>Ctrl K</span>
      </button>

      {/* Toggle de tema Nexus / Claro */}
      <Segmented
        options={[
          { value: "nexus", label: t("theme.nexus") },
          { value: "claro", label: t("theme.claro") },
        ]}
        value={theme}
        onChange={(v) => setTheme(v as Theme)}
      />

      {/* Toggle de idioma */}
      <Segmented
        options={[
          { value: "es", label: "ES" },
          { value: "en", label: "EN" },
        ]}
        value={locale}
        onChange={(v) => setLocale(v as "es" | "en")}
      />

      {/* Campanita de notificaciones (v1) */}
      {notifications && <NotificationBell data={notifications} />}

      {/* Cierre de sesion server-side (limpia cookies de verdad) */}
      <form action={signOutAction}>
        <button
          type="submit"
          style={{
            height: 40,
            padding: "0 14px",
            borderRadius: "var(--r-md)",
            background: "var(--card)",
            border: "1px solid var(--line)",
            color: "var(--text)",
            fontSize: 12.5,
            fontWeight: 600,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          {t("common.signout")}
        </button>
      </form>
    </header>
  );
}

function Segmented({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 3, padding: 3, borderRadius: "var(--r-md)", background: "var(--paper)", border: "1px solid var(--line)" }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            style={{
              padding: "5px 10px",
              borderRadius: 7,
              border: "none",
              cursor: "pointer",
              fontSize: 11.5,
              fontWeight: 600,
              background: active ? "var(--cta-bg)" : "transparent",
              color: active ? "var(--cta-fg)" : "var(--muted)",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
