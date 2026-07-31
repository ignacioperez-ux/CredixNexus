"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TextField, SelectField, TextArea } from "@/components/ui/field";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  upsertSsoDomain,
  setSsoDomainStatus,
  type SsoDomainRow,
  type SsoRoleOption,
} from "@/lib/auth/sso-domains";

// Pantalla de datos maestros: dominios corporativos permitidos para SSO (JIT).
// Reutiliza los componentes base del Design System Credix. CRUD + estados + mensajes (§10.5/§10.6).

function roleName(row: SsoDomainRow): string {
  const r = row.role;
  const one = Array.isArray(r) ? r[0] : r;
  return one?.name ?? "—";
}

export function SsoDomainsAdmin({ domains, roles }: { domains: SsoDomainRow[]; roles: SsoRoleOption[] }) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [domain, setDomain] = useState("");
  const [roleId, setRoleId] = useState<string>(roles.find((r) => r.code === "partner_user")?.id ?? "");
  const [notes, setNotes] = useState("");
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [errField, setErrField] = useState<string | null>(null);

  function resetForm() {
    setEditingId(null);
    setDomain("");
    setRoleId(roles.find((r) => r.code === "partner_user")?.id ?? "");
    setNotes("");
    setErrField(null);
  }

  function onEdit(row: SsoDomainRow) {
    setEditingId(row.id);
    setDomain(row.domain);
    setRoleId(row.default_role_id);
    setNotes(row.notes ?? "");
    setErrField(null);
    setMsg(null);
  }

  function submit() {
    setMsg(null);
    setErrField(null);
    start(async () => {
      const res = await upsertSsoDomain(editingId, { domain, default_role_id: roleId, notes });
      if (!res.ok) {
        setErrField(res.errorField ?? null);
        setMsg({ kind: "err", text: t(res.error as MessageKey) || (res.error ?? "Error") });
        return;
      }
      setMsg({ kind: "ok", text: t(editingId ? "sso.admin.updated" : "sso.admin.created") });
      resetForm();
      router.refresh();
    });
  }

  function toggleStatus(row: SsoDomainRow) {
    const activating = row.status !== "active";
    if (!activating && !window.confirm(t("sso.admin.confirm_deactivate"))) return;
    setMsg(null);
    start(async () => {
      const res = await setSsoDomainStatus(row.id, activating);
      if (!res.ok) {
        setMsg({ kind: "err", text: t(res.error as MessageKey) || (res.error ?? "Error") });
        return;
      }
      setMsg({ kind: "ok", text: t(activating ? "sso.admin.activated" : "sso.admin.deactivated") });
      router.refresh();
    });
  }

  return (
    <div style={{ maxWidth: "var(--w-app, 1120px)", margin: "0 auto", padding: "var(--sp-6, 24px)" }}>
      <PageHeader title={t("sso.admin.title")} subtitle={t("sso.admin.subtitle")} />

      {msg && (
        <div
          role={msg.kind === "err" ? "alert" : "status"}
          style={{
            marginBottom: 16,
            padding: "10px 14px",
            borderRadius: "var(--r-md, 12px)",
            fontSize: 13,
            border: "1px solid",
            borderColor: msg.kind === "err" ? "var(--st-critical, #FF4965)" : "var(--st-low, #19D27E)",
            background: msg.kind === "err" ? "var(--st-critical-bg)" : "var(--st-low-bg)",
            color: msg.kind === "err" ? "var(--st-critical-fg, var(--st-critical))" : "var(--st-low-fg, var(--st-low))",
          }}
        >
          {msg.text}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 20 }}>
        {/* Formulario alta/edicion */}
        <Card>
          <div style={{ display: "grid", gap: 14, gridTemplateColumns: "1fr 1fr" }}>
            <TextField
              label={t("sso.admin.domain")}
              placeholder={t("sso.admin.domain_ph")}
              value={domain}
              required
              onChange={(e) => setDomain(e.target.value)}
              error={errField === "domain" && msg?.kind === "err" ? msg.text : undefined}
              autoComplete="off"
              inputMode="url"
            />
            <SelectField
              label={t("sso.admin.role")}
              value={roleId}
              required
              onChange={(e) => setRoleId(e.target.value)}
              error={errField === "default_role_id" && msg?.kind === "err" ? msg.text : undefined}
            >
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </SelectField>
          </div>
          <div style={{ marginTop: 14 }}>
            <TextArea label={t("sso.admin.notes")} value={notes} rows={2} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
            <Button onClick={submit} disabled={pending} icon={editingId ? "check" : "plus"}>
              {editingId ? t("common.save") : t("sso.admin.add")}
            </Button>
            {editingId && (
              <Button variant="text" onClick={resetForm} disabled={pending}>
                {t("common.cancel")}
              </Button>
            )}
          </div>
        </Card>

        {/* Lista */}
        <Card padding={0}>
          {domains.length === 0 ? (
            <div style={{ padding: 8 }}>
              <EmptyState icon="shield" title={t("sso.admin.empty")} hint={t("sso.admin.empty_hint")} />
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
                <thead>
                  <tr style={{ background: "var(--head-bg)", textAlign: "left" }}>
                    <th style={th}>{t("sso.admin.domain")}</th>
                    <th style={th}>{t("sso.admin.role")}</th>
                    <th style={th}>{t("sso.admin.notes")}</th>
                    <th style={th}>{t("sso.admin.status")}</th>
                    <th style={{ ...th, textAlign: "right" }} />
                  </tr>
                </thead>
                <tbody>
                  {domains.map((row) => (
                    <tr key={row.id} style={{ borderTop: "1px solid var(--line)" }}>
                      <td style={{ ...td, fontFamily: "var(--font-mono)" }}>{row.domain}</td>
                      <td style={td}>{roleName(row)}</td>
                      <td style={{ ...td, color: "var(--muted)" }}>{row.notes ?? "—"}</td>
                      <td style={td}>
                        <StatusBadge
                          tone={row.status === "active" ? "success" : "neutral"}
                          label={t(row.status === "active" ? "md.status.active" : "md.status.inactive")}
                        />
                      </td>
                      <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>
                        <Button size="sm" variant="text" onClick={() => onEdit(row)} icon="edit">
                          {t("common.edit")}
                        </Button>
                        <Button
                          size="sm"
                          variant="text"
                          onClick={() => toggleStatus(row)}
                          disabled={pending}
                        >
                          {row.status === "active" ? t("sso.admin.deactivate") : t("sso.admin.activate")}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

const th: React.CSSProperties = { padding: "10px 14px", fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.3px", color: "var(--muted)" };
const td: React.CSSProperties = { padding: "11px 14px", verticalAlign: "middle" };
