"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import type { OlaPolicyRow, SlaFormOptions } from "@/lib/sla/queries";
import { upsertOlaPolicy, deactivateOlaPolicy } from "@/lib/sla/actions";
import { PRIORITIES } from "@/lib/sla/validation";

type Draft = { id?: string; priority: string; assignedTeam: string; responseMinutes: number; resolutionMinutes: number };
const EMPTY: Draft = { priority: "p3_medium", assignedTeam: "", responseMinutes: 60, resolutionMinutes: 480 };

export function OlaTab({ policies, options, canManage }: { policies: OlaPolicyRow[]; options: SlaFormOptions; canManage: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const head: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "#8A948A", padding: "10px 12px", background: "var(--head-bg)" };

  function edit(p: OlaPolicyRow) {
    setErr(null);
    setDraft({ id: p.id, priority: p.priority, assignedTeam: p.assigned_team ?? "", responseMinutes: p.response_minutes, resolutionMinutes: p.resolution_minutes });
  }
  function save() {
    if (!draft) return;
    setErr(null);
    start(async () => {
      const r = await upsertOlaPolicy({ id: draft.id, priority: draft.priority, assignedTeam: draft.assignedTeam || null, responseMinutes: draft.responseMinutes, resolutionMinutes: draft.resolutionMinutes });
      if (!r.ok) setErr(r.error ?? "error");
      else { setDraft(null); router.refresh(); }
    });
  }
  function deactivate(id: string) {
    start(async () => { await deactivateOlaPolicy(id); router.refresh(); });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("sla.ola.intro")}</div>
      {canManage && !draft && (
        <div><button onClick={() => { setErr(null); setDraft({ ...EMPTY }); }} style={btnPrimary}>+ {t("sla.ola.new")}</button></div>
      )}

      {draft && (
        <div style={{ background: "var(--card)", border: "1px solid var(--accent-2)", borderRadius: "var(--r-xl)", padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15 }}>{draft.id ? t("sla.ola.edit") : t("sla.ola.new")}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <F label={t("sla.col.priority")}><select value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: e.target.value })} style={inp}>{PRIORITIES.map((p) => <option key={p} value={p}>{p.replace("p", "P").split("_")[0]}</option>)}</select></F>
            <F label={t("sla.ola.team")}><select value={draft.assignedTeam} onChange={(e) => setDraft({ ...draft, assignedTeam: e.target.value })} style={inp}><option value="">{t("sla.ola.default")}</option>{options.teams.map((tm) => <option key={tm} value={tm}>{tm}</option>)}</select></F>
            <F label={t("sla.ola.respmin")}><input type="number" min={1} value={draft.responseMinutes} onChange={(e) => setDraft({ ...draft, responseMinutes: Number(e.target.value) })} style={inp} /></F>
            <F label={t("sla.ola.resomin")}><input type="number" min={1} value={draft.resolutionMinutes} onChange={(e) => setDraft({ ...draft, resolutionMinutes: Number(e.target.value) })} style={inp} /></F>
          </div>
          {err && <div style={{ fontSize: 12, color: "var(--st-critical)" }}>{err}</div>}
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={save} disabled={pending} style={btnPrimary}>{pending ? t("common.saving") : t("common.save")}</button>
            <button onClick={() => setDraft(null)} disabled={pending} style={btnGhost}>{t("common.cancel")}</button>
          </div>
        </div>
      )}

      <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "110px 1fr 130px 130px 100px 120px", minWidth: 760 }}>
            {[t("sla.col.priority"), t("sla.ola.team"), t("sla.ola.respmin"), t("sla.ola.resomin"), t("sla.rule.statuscol"), ""].map((h, i) => <div key={i} style={head}>{h}</div>)}
            {policies.length === 0 && <div style={{ gridColumn: "1 / -1", padding: 36, textAlign: "center", color: "var(--muted)" }}>{t("sla.ola.empty")}</div>}
            {policies.map((p) => (
              <div key={p.id} style={{ display: "contents" }}>
                <Cell mono>{p.priority.replace("p", "P").split("_")[0]}</Cell>
                <Cell muted>{p.assigned_team ?? t("sla.ola.default")}</Cell>
                <Cell mono>{p.response_minutes}m</Cell>
                <Cell mono>{p.resolution_minutes}m</Cell>
                <Cell><span style={{ fontSize: 10.5, fontWeight: 600, color: p.status === "active" ? "var(--st-low-fg)" : "var(--muted)" }}>{t(("sla.st." + p.status) as MessageKey)}</span></Cell>
                <Cell>{canManage && p.status === "active" && (
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => edit(p)} disabled={pending} style={btnMini}>{t("common.edit")}</button>
                    <button onClick={() => deactivate(p.id)} disabled={pending} style={btnMini}>{t("sla.rule.deactivate")}</button>
                  </div>
                )}</Cell>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const inp: React.CSSProperties = { width: "100%", fontSize: 13, padding: "8px 10px", borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: "var(--card)", color: "var(--text)", fontFamily: "var(--font-ui)" };
const btnPrimary: React.CSSProperties = { fontSize: 13, fontWeight: 600, padding: "9px 16px", borderRadius: "var(--r-md)", border: "none", background: "var(--cta-bg)", color: "var(--cta-fg)", cursor: "pointer" };
const btnGhost: React.CSSProperties = { fontSize: 13, fontWeight: 600, padding: "9px 16px", borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: "var(--card)", color: "var(--text)", cursor: "pointer" };
const btnMini: React.CSSProperties = { fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: "var(--paper)", color: "var(--text)", cursor: "pointer" };
const cellSt: React.CSSProperties = { fontSize: 12.5, padding: "10px 12px", borderTop: "1px solid var(--line-soft)", display: "flex", alignItems: "center", color: "var(--text)" };
function Cell({ children, mono, muted }: { children: React.ReactNode; mono?: boolean; muted?: boolean }) {
  return <div style={{ ...cellSt, fontFamily: mono ? "var(--font-mono)" : "var(--font-ui)", color: muted ? "var(--muted)" : "var(--text)" }}>{children}</div>;
}
function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "var(--muted)", marginBottom: 6 }}>{label}</label>{children}</div>;
}
