"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import type { AdminOverview, AdminUser, AdminRole } from "@/lib/admin/queries";
import { setUserRoles, setUserStatus } from "@/lib/admin/actions";
import { Icon, type IconName } from "@/components/ui/icon";

export function AdminHub({ overview, users, roles, selfAccountId }: { overview: AdminOverview; users: AdminUser[]; roles: AdminRole[]; selfAccountId: string | null }) {
  const { t } = useI18n();
  const roleName = (code: string) => roles.find((r) => r.code === code)?.name ?? code;
  const cards: { icon: IconName; label: MessageKey; value: string }[] = [
    { icon: "users", label: "adm.kpi.users", value: `${overview.users_active} / ${overview.users_total}` },
    { icon: "shield", label: "adm.kpi.roles", value: String(overview.roles) },
    { icon: "inbox", label: "adm.kpi.cases", value: String(overview.incidents) },
    { icon: "folder", label: "adm.kpi.projects", value: String(overview.projects) },
    { icon: "activity", label: "adm.kpi.audit", value: String(overview.audit_events) },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("adm.intro")}</div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14 }}>
        {cards.map((c) => (
          <div key={c.label} style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--muted)", marginBottom: 10 }}>
              <Icon name={c.icon} size={15} /><span style={{ fontSize: 11.5, fontWeight: 600 }}>{t(c.label)}</span>
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontWeight: 500, fontSize: 22, letterSpacing: "-1px", color: "var(--text)" }}>{c.value}</div>
          </div>
        ))}
      </div>

      <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 18px", borderBottom: "1px solid var(--line)" }}>
          <Icon name="users" size={16} color="var(--accent-2)" />
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, color: "var(--text)" }}>{t("adm.users.title")}</span>
          <span style={{ fontSize: 11.5, color: "var(--muted)", marginLeft: "auto" }}>{users.length}</span>
        </div>
        {users.map((u) => (
          <UserRow key={u.account_id} user={u} roles={roles} roleName={roleName} isSelf={u.account_id === selfAccountId} />
        ))}
        {users.length === 0 && <div style={{ padding: 30, textAlign: "center", color: "var(--muted)", fontSize: 12.5 }}>—</div>}
      </div>
    </div>
  );
}

function UserRow({ user, roles, roleName, isSelf }: { user: AdminUser; roles: AdminRole[]; roleName: (c: string) => string; isSelf: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [sel, setSel] = useState<string[]>(user.roles);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const active = user.status === "active";

  function toggleRole(code: string) { setSel((s) => (s.includes(code) ? s.filter((x) => x !== code) : [...s, code])); }
  function save() {
    setMsg(null);
    start(async () => {
      const r = await setUserRoles(user.account_id, sel);
      if (!r.ok) setMsg({ kind: "err", text: t(("err." + (r.error ?? "ERR_INVALID_FORMAT")) as MessageKey) });
      else { setEditing(false); router.refresh(); }
    });
  }
  function toggleStatus() {
    setMsg(null);
    start(async () => {
      const r = await setUserStatus(user.account_id, !active);
      if (!r.ok) setMsg({ kind: "err", text: t(("err." + (r.error ?? "ERR_INVALID_FORMAT")) as MessageKey) });
      else router.refresh();
    });
  }

  return (
    <div style={{ borderTop: "1px solid var(--line-soft)", padding: "12px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--accent-soft)", color: "var(--accent-2)", display: "grid", placeItems: "center", fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600, flexShrink: 0 }}>{initials(user.full_name)}</div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{user.full_name}{isSelf && <span style={{ fontSize: 10.5, color: "var(--muted)", fontWeight: 400 }}> · {t("adm.you")}</span>}</div>
          <div style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>{user.email}</div>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", flex: 1 }}>
          {user.roles.map((r) => <span key={r} style={{ fontSize: 10.5, fontWeight: 600, color: "var(--text)", background: "var(--paper)", padding: "3px 9px", borderRadius: "var(--r-pill)" }}>{roleName(r)}</span>)}
          {user.roles.length === 0 && <span style={{ fontSize: 11, color: "var(--muted)" }}>{t("adm.noroles")}</span>}
        </div>
        <span style={{ fontSize: 10.5, fontWeight: 600, color: active ? "var(--st-low-fg)" : "var(--muted)", background: active ? "var(--st-low-bg)" : "var(--paper)", padding: "3px 10px", borderRadius: "var(--r-pill)" }}>{t(active ? "adm.active" : "adm.inactive")}</span>
        {!isSelf && (
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => { setEditing((e) => !e); setSel(user.roles); }} disabled={pending} style={btn()}>{t("adm.editroles")}</button>
            <button onClick={toggleStatus} disabled={pending} style={btn()}>{t(active ? "adm.deactivate" : "adm.activate")}</button>
          </div>
        )}
      </div>

      {editing && (
        <div style={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: "var(--r-md)", padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 6 }}>
            {roles.map((r) => (
              <label key={r.code} style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12, color: "var(--text)", cursor: "pointer" }}>
                <input type="checkbox" checked={sel.includes(r.code)} onChange={() => toggleRole(r.code)} />
                {r.name}
              </label>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={save} disabled={pending} style={{ ...btn(true), display: "inline-flex", alignItems: "center", gap: 6 }}><Icon name="check" size={14} />{t("adm.save")}</button>
            <button onClick={() => setEditing(false)} disabled={pending} style={btn()}>{t("common.cancel")}</button>
          </div>
        </div>
      )}
      {msg && <div style={{ fontSize: 11.5, color: msg.kind === "ok" ? "var(--st-low-fg)" : "var(--st-critical-fg)" }}>{msg.text}</div>}
    </div>
  );
}

function btn(cta?: boolean): React.CSSProperties {
  return { fontSize: 11.5, fontWeight: 600, padding: "6px 11px", borderRadius: "var(--r-md)", border: cta ? "none" : "1px solid var(--line)", background: cta ? "var(--cta-bg)" : "transparent", color: cta ? "var(--cta-fg)" : "var(--text)", cursor: "pointer" };
}
function initials(name: string): string {
  const p = name.trim().split(/[\s@.]+/).filter(Boolean);
  return ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase() || "U";
}
