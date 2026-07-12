"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import type { StepRow } from "@/lib/workflows/queries";
import { allowedOutcomes, type NodeType } from "@/lib/workflows/graph";
import { advanceStep, cancelInstance } from "@/lib/workflows/actions";
import { InstanceStatusBadge, STEP_COLOR, NodeIcon } from "./badges";
import { BackButton } from "@/components/common/back-button";

type InstanceView = {
  id: string; instance_number: string; title: string; status: string; entity_type: string; entity_id: string | null;
  started_at: string; completed_at: string | null;
  definition: { id: string; code: string; name: string; entity_type: string } | null;
};
type LedgerRow = { block_height: number; action: string; current_hash: string; timestamp: string };

export function InstanceDetail({ instance, steps, ledger, canRun }: { instance: InstanceView; steps: StepRow[]; ledger: LedgerRow[]; canRun: boolean }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setMsg(null);
    start(async () => {
      const r = await fn();
      if (!r.ok) setMsg(r.error ?? "error");
      else { setNote(""); router.refresh(); }
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <BackButton fallback="/workflows" />
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--accent-2)" }}>{instance.instance_number}</span>
          <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 20, letterSpacing: "-0.3px", margin: 0, color: "var(--text)" }}>{instance.title}</h1>
          <InstanceStatusBadge status={instance.status} />
        </div>
        {canRun && instance.status === "running" && (
          <button onClick={() => run(() => cancelInstance(instance.id))} disabled={pending}
            style={{ fontSize: 12, fontWeight: 600, padding: "8px 12px", borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: "var(--card)", color: "var(--st-critical)", cursor: "pointer" }}>{t("wf.cancel")}</button>
        )}
      </div>
      {msg && <div style={{ fontSize: 12, color: "var(--st-critical)" }}>{msg}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 16 }}>
        <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 20 }}>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, marginBottom: 16 }}>{t("wf.section.timeline")}</div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {steps.map((s, idx) => {
              const c = STEP_COLOR[s.status] ?? STEP_COLOR.active;
              const nt = (s.node?.node_type ?? "task") as NodeType;
              const outcomes = s.status === "active" ? allowedOutcomes(nt) : [];
              return (
                <div key={s.id} style={{ display: "flex", gap: 12 }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <div style={{ width: 26, height: 26, borderRadius: "50%", background: c.bg, color: c.fg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, flexShrink: 0 }}><NodeIcon nodeType={nt} size={13} /></div>
                    {idx < steps.length - 1 && <div style={{ width: 2, flex: 1, background: "var(--line)", minHeight: 18 }} />}
                  </div>
                  <div style={{ flex: 1, paddingBottom: 18 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text)" }}>{s.node?.name}</span>
                      <span style={{ fontSize: 10, fontWeight: 600, color: c.fg, background: c.bg, padding: "1px 8px", borderRadius: "var(--r-pill)" }}>{t(("wf.sst." + s.status) as MessageKey)}</span>
                      {s.node?.assignee_role && <span style={{ fontSize: 10.5, color: "var(--muted)" }}>· {s.node.assignee_role}</span>}
                    </div>
                    {s.note && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>{s.note}</div>}
                    {s.completed_at && <div style={{ fontSize: 10.5, color: "var(--muted)", fontFamily: "var(--font-mono)", marginTop: 3 }}>{new Date(s.completed_at).toLocaleString(locale)}{s.outcome ? ` · ${s.outcome}` : ""}</div>}
                    {canRun && outcomes.length > 0 && (
                      <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                        {outcomes.map((o) => (
                          <button key={o} onClick={() => run(() => advanceStep(s.id, o, note))} disabled={pending}
                            style={{ fontSize: 12, fontWeight: 600, padding: "6px 12px", borderRadius: "var(--r-md)", border: "none", cursor: "pointer",
                              background: o === "rejected" ? "var(--st-critical-bg)" : "var(--cta-bg)", color: o === "rejected" ? "var(--st-critical-fg)" : "var(--cta-fg)" }}>
                            {t(("wf.outcome." + o) as MessageKey)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {steps.some((s) => s.status === "active") && canRun && (
              <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("wf.note.placeholder")} rows={2}
                style={{ marginTop: 8, width: "100%", fontSize: 12.5, padding: "8px 10px", borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: "var(--paper)", color: "var(--text)", resize: "vertical", fontFamily: "var(--font-ui)" }} />
            )}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 20 }}>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, marginBottom: 14 }}>{t("wf.section.detail")}</div>
            <Row label={t("wf.col.definition")} value={instance.definition?.name} />
            <Row label={t("wf.def.entity")} value={instance.entity_type} />
            {instance.entity_type === "incident" && instance.entity_id && (
              <div style={{ padding: "6px 0" }}><Link href={`/incidents/${instance.entity_id}`} style={{ fontSize: 12, color: "var(--accent-2)", textDecoration: "none", fontWeight: 600 }}>→ {t("wf.gotocase")}</Link></div>
            )}
            <Row label={t("wf.started")} value={new Date(instance.started_at).toLocaleString(locale)} mono />
            <Row label={t("wf.completed")} value={instance.completed_at ? new Date(instance.completed_at).toLocaleString(locale) : null} mono />
          </div>

          <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 20 }}>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, marginBottom: 14 }}>{t("inc.section.ledger")}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {ledger.length === 0 && <div style={{ fontSize: 12, color: "var(--muted)" }}>—</div>}
              {ledger.map((l) => (
                <div key={l.block_height} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5 }}>
                  <span style={{ fontFamily: "var(--font-mono)", color: "var(--muted)", width: 30 }}>#{l.block_height}</span>
                  <span style={{ color: "var(--text)", flex: 1 }}>{l.action}</span>
                  <span style={{ fontFamily: "var(--font-mono)", color: "var(--accent-2)", fontSize: 10 }}>{l.current_hash.slice(0, 8)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  return <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "6px 0", borderBottom: "1px solid var(--line-soft)" }}>
    <span style={{ fontSize: 12, color: "var(--muted)" }}>{label}</span>
    <span style={{ fontSize: 12.5, color: "var(--text)", fontFamily: mono ? "var(--font-mono)" : "var(--font-ui)", textAlign: "right" }}>{value || "—"}</span></div>;
}
