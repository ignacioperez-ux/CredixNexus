"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import { CaseInbox, type InboxGroup, type InboxRow } from "@/components/cases/case-inbox";
import { humanCommitment } from "@/lib/format/time";
import type { OpCase, QueueCase } from "@/lib/operador/queries";

// Bandeja del OPERADOR agrupada por ACCION (P3), reutilizando CaseInbox. El criterio es "de quien es
// la pelota": Vencen hoy / Requieren mi respuesta / Esperando al usuario / Sin asignar. Filtros y
// busqueda detras del control secundario del inbox. Nota RBAC: el operador (support_agent) NO tiene
// incident.assign/triage.manage, asi que "Tomar"/"Vincular como duplicado" son potestad del lider
// (support_lead) — aqui la cola sin asignar es de solo lectura y las acciones son Responder/Ver.

const OPEN = ["new", "received", "triaged", "assigned", "in_progress", "waiting", "reopened"];
function endOfToday(): number { const d = new Date(); d.setHours(23, 59, 59, 999); return d.getTime(); }
const isDueToday = (c: OpCase) => !c.settled && !!c.dueAt && Date.parse(c.dueAt) <= endOfToday() && c.overdueMs == null;
const isUrgent = (c: OpCase) => c.overdueMs != null || isDueToday(c);

export function OpCasesView({ cases, unassigned = [], dupCounts = {}, linked }: {
  cases: OpCase[]; unassigned?: QueueCase[]; dupCounts?: Record<string, number>; linked: boolean;
}) {
  const { t, locale } = useI18n();
  const [q, setQ] = useState("");

  const groups: InboxGroup[] = useMemo(() => {
    const term = q.trim().toLowerCase();
    const match = (c: OpCase) => !term || c.number.toLowerCase().includes(term) || c.title.toLowerCase().includes(term);
    const humanStatus = (s: string) => t(("portal.human." + s) as MessageKey);
    const reportInfo = (id: string) => {
      const n = dupCounts[id] ?? 0;
      return n > 0 ? ` · ${t("portal.dup.count").replace("{n}", String(n + 1))}` : "";
    };
    const row = (c: OpCase, action?: InboxRow["actions"]): InboxRow => ({
      id: c.id, number: c.number, title: c.title, href: `/incidents/${c.id}`,
      subtitle: `${humanStatus(c.status)}${reportInfo(c.id)}`,
      meta: humanCommitment(c.resoDueAt, locale), metaOverdue: c.overdueMs != null,
      actions: action,
    });
    const open = cases.filter((c) => OPEN.includes(c.status)).filter(match);
    const reply = (c: OpCase): InboxRow["actions"] => [{ key: "reply", label: t("op.inbox.reply"), variant: "primary", href: `/incidents/${c.id}` }];

    return [
      { key: "duetoday", tone: "attention", icon: "alert", title: t("op.inbox.duetoday"),
        rows: open.filter((c) => c.status !== "waiting" && isUrgent(c)).map((c) => row(c, reply(c))) },
      { key: "myreply", tone: "info", title: t("op.inbox.myreply"),
        rows: open.filter((c) => c.status !== "waiting" && !isUrgent(c)).map((c) => row(c, reply(c))) },
      { key: "waiting", tone: "neutral", hint: t("op.inbox.waiting.hint"), title: t("op.inbox.waiting"),
        rows: open.filter((c) => c.status === "waiting").map((c) => row(c)) },
      { key: "unassigned", tone: "neutral", title: t("op.inbox.unassigned"),
        rows: unassigned.filter(match).map((c) => row(c, [{ key: "view", label: t("op.inbox.view"), variant: "secondary", href: `/incidents/${c.id}` }])) },
    ];
  }, [cases, unassigned, dupCounts, q, t, locale]);

  if (!linked) return <div style={{ padding: "60px 20px", textAlign: "center", color: "var(--muted)" }}>{t("op.nomember.hint")}</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 1120 }}>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: "var(--text)", margin: 0 }}>{t("nav.miscasos")}</h1>
      <CaseInbox groups={groups} search={{ value: q, onChange: setQ, placeholder: t("op.search") }} emptyLabel={t("op.cases.empty")} />
    </div>
  );
}
