"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import type { EscalationRuleRow, SlaFormOptions } from "@/lib/sla/queries";
import { upsertEscalationRule, deactivateEscalationRule, reactivateEscalationRule } from "@/lib/sla/actions";
import { SLA_TYPES, ESC_ACTIONS, PRIORITIES } from "@/lib/sla/validation";

type Draft = {
  id?: string; code: string; name: string; slaType: string; thresholdPct: number;
  priority: string; action: string; notifyRole: string; actionTarget: string;
};
const EMPTY: Draft = { code: "", name: "", slaType: "response", thresholdPct: 75, priority: "", action: "notify", notifyRole: "support_lead", actionTarget: "" };

export function RulesTab({ rules, options, canManage }: { rules: EscalationRuleRow[]; options: SlaFormOptions; canManage: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const head: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "#8A948A", padding: "10px 12px", background: "var(--head-bg)" };

  function edit(r: EscalationRuleRow) {
    setErr(null);
    setDraft({ id: r.id, code: r.code, name: r.name, slaType: r.sla_type, thresholdPct: r.threshold_pct, priority: r.priority ?? "", action: r.action, notifyRole: r.notify_role ?? "", actionTarget: r.action_target ?? "" });
  }
  function save() {
    if (!draft) return;
    setErr(null);
    start(async () => {
      const r = await upsertEscalationRule({ ...draft, priority: draft.priority || null });
      if (!r.ok) setErr(r.error ?? "error");
      else { setDraft(null); router.refresh(); }
    });
  }
  function toggle(r: EscalationRuleRow) {
    start(async () => {
      await (r.status === "active" ? deactivateEscalationRule(r.id) : reactivateEscalationRule(r.id));
      router.refresh();
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {canManage && !draft && (
        <div><button onClick={() => { setErr(null); setDraft({ ...EMPTY }); }}
          style={{ fontSize: 12.5, fontWeight: 600, padding: "8px 14px", borderRadius: "var(--r-md)", background: "var(--cta-bg)", color: "var(--cta-fg)", border: "none", cursor: "pointer" }}>+ {t("sla.rule.new")}</button></div>
      )}

      {draft && (
        <div style={{ background: "var(--card)", border: "1px solid var(--accent-2)", borderRadius: "var(--r-xl)", padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15 }}>{draft.id ? t("sla.rule.edit") : t("sla.rule.new")}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <F label={t("sla.rule.code")}><input value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} disabled={!!draft.id} style={inp} /></F>
            <F label={t("sla.rule.name")}><input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} style={inp} /></F>
            <F label={t("sla.rule.clock")}><select value={draft.slaType} onChange={(e) => setDraft({ ...draft, slaType: e.target.value })} style={inp}>{SLA_TYPES.map((s) => <option key={s} value={s}>{t(("sla.clock." + s) as MessageKey)}</option>)}</select></F>
            <F label={t("sla.rule.threshold")}><input type="number" min={1} max={100} value={draft.thresholdPct} onChange={(e) => setDraft({ ...draft, thresholdPct: Number(e.target.value) })} style={inp} /></F>
            <F label={t("sla.rule.priority")}><select value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: e.target.value })} style={inp}><option value="">{t("sla.rule.allprio")}</option>{PRIORITIES.map((p) => <option key={p} value={p}>{p.replace("p", "P").split("_")[0]}</option>)}</select></F>
            <F label={t("sla.rule.action")}><select value={draft.action} onChange={(e) => setDraft({ ...draft, action: e.target.value })} style={inp}>{ESC_ACTIONS.map((a) => <option key={a} value={a}>{t(("sla.act." + a) as MessageKey)}</option>)}</select></F>
            {draft.action === "notify" && (
              <F label={t("sla.rule.notifyrole")}><select value={draft.notifyRole} onChange={(e) => setDraft({ ...draft, notifyRole: e.target.value })} style={inp}><option value="">—</option>{options.roles.map((r) => <option key={r.code} value={r.code}>{r.name}</option>)}</select></F>
            )}
            {draft.action === "reassign_team" && (
              <F label={t("sla.rule.team")}><select value={draft.actionTarget} onChange={(e) => setDraft({ ...draft, actionTarget: e.target.value })} style={inp}><option value="">—</option>{options.teams.map((tm) => <option key={tm} value={tm}>{tm}</option>)}</select></F>
            )}
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
          <div style={{ display: "grid", gridTemplateColumns: "130px 1.4fr 130px 90px 170px 90px 120px", minWidth: 940 }}>
            {[t("sla.rule.code"), t("sla.rule.name"), t("sla.rule.clock"), t("sla.rule.threshold"), t("sla.rule.action"), t("sla.rule.statuscol"), ""].map((h, idx) => <div key={idx} style={head}>{h}</div>)}
            {rules.map((r) => (
              <div key={r.id} style={{ display: "contents" }}>
                <Cell mono accent>{r.code}</Cell>
                <Cell>{r.name}</Cell>
                <Cell muted>{t(("sla.clock." + r.sla_type) as MessageKey)}{r.priority ? ` · ${r.priority.replace("p", "P").split("_")[0]}` : ""}</Cell>
                <Cell mono>{r.threshold_pct}%</Cell>
                <Cell muted>{t(("sla.act." + r.action) as MessageKey)}{r.notify_role ? ` · ${r.notify_role}` : r.action_target ? ` · ${r.action_target}` : ""}</Cell>
                <Cell><span style={{ fontSize: 10.5, fontWeight: 600, color: r.status === "active" ? "var(--st-low-fg)" : "var(--muted)" }}>{t(("sla.st." + r.status) as MessageKey)}</span></Cell>
                <Cell>
                  {canManage && (
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => edit(r)} disabled={pending} style={btnMini}>{t("common.edit")}</button>
                      <button onClick={() => toggle(r)} disabled={pending} style={btnMini}>{r.status === "active" ? t("sla.rule.deactivate") : t("sla.rule.activate")}</button>
                    </div>
                  )}
                </Cell>
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
function Cell({ children, mono, accent, muted }: { children: React.ReactNode; mono?: boolean; accent?: boolean; muted?: boolean }) {
  return <div style={{ ...cellSt, fontFamily: mono ? "var(--font-mono)" : "var(--font-ui)", color: accent ? "var(--accent-2)" : muted ? "var(--muted)" : "var(--text)" }}>{children}</div>;
}
function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "var(--muted)", marginBottom: 6 }}>{label}</label>{children}</div>;
}
