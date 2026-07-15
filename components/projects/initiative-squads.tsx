"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/provider";
import type { InitiativeSquad } from "@/lib/projects/queries";
import { addProjectSquad, removeProjectSquad, setInitiativeLead } from "@/lib/projects/actions";
import { ConceptTip } from "@/components/help/concept-tip";
import { Icon } from "@/components/ui/icon";

const TYPE_COLOR: Record<string, string> = { domain: "var(--accent)", enabler: "var(--st-eval)", transient: "var(--muted)" };

// Iniciativa 360: los squads que atienden la iniciativa (uno lidera, otros contribuyen).
export function InitiativeSquads({ projectId, squads, options, canManage }: {
  projectId: string; squads: InitiativeSquad[]; options: { id: string; name: string }[]; canManage: boolean;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [pick, setPick] = useState("");
  const involved = new Set(squads.map((s) => s.squad_id));
  const avail = options.filter((o) => !involved.has(o.id));
  const ordered = [...squads].sort((a, b) => (a.role === "lead" ? -1 : 1) - (b.role === "lead" ? -1 : 1));

  const run = (fn: () => Promise<{ ok: boolean }>) => start(async () => { await fn(); router.refresh(); });

  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 12 }}>
        <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, color: "var(--text)" }}>{t("initsq.title")}</span>
        <ConceptTip concept="squad" />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {ordered.length === 0 && <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("initsq.empty")}</div>}
        {ordered.map((s) => (
          <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: TYPE_COLOR[s.squad?.squad_type ?? "domain"], flexShrink: 0 }} />
            <Link href="/evolucion/mapa" style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: "var(--text)", textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.squad?.name ?? "—"}</Link>
            {s.role === "lead"
              ? <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".4px", color: "var(--accent)", background: "var(--accent-soft)", padding: "1px 7px", borderRadius: "var(--r-pill)" }}>{t("initsq.lead")}</span>
              : canManage && <button onClick={() => run(() => setInitiativeLead(projectId, s.squad_id))} disabled={pending} title={t("initsq.makelead")} style={mini}>{t("initsq.makelead")}</button>}
            {canManage && s.role !== "lead" && <button onClick={() => run(() => removeProjectSquad(s.id, projectId))} disabled={pending} title={t("sq.remove")} style={{ ...mini, color: "var(--st-critical-fg)", borderColor: "transparent" }}><Icon name="x" size={12} /></button>}
          </div>
        ))}
      </div>
      {canManage && avail.length > 0 && (
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <select value={pick} onChange={(e) => setPick(e.target.value)} style={{ flex: 1, fontSize: 12, padding: "7px 9px", borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: "var(--card)", color: "var(--text)" }}>
            <option value="">{t("initsq.add")}</option>
            {avail.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          <button onClick={() => { if (pick) run(() => addProjectSquad(projectId, pick).then((r) => { if (r.ok) setPick(""); return r; })); }} disabled={!pick || pending}
            style={{ padding: "7px 13px", borderRadius: "var(--r-md)", background: "var(--cta-bg)", color: "var(--cta-fg)", border: "none", fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>+</button>
        </div>
      )}
    </div>
  );
}

const mini: React.CSSProperties = { fontSize: 10.5, fontWeight: 600, padding: "2px 8px", borderRadius: "var(--r-pill)", border: "1px solid var(--line)", background: "var(--card)", color: "var(--muted)", cursor: "pointer" };

// (label helper eliminado: se usa t() directo)
export type { InitiativeSquad };
