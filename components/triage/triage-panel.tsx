"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import { CLASSIFICATIONS } from "@/lib/triage/validation";
import { acceptCase, discardCase } from "@/lib/triage/actions";

type Kb = { id: string; article_number: string; title: string };

/** Protocolo de admision: admitir + clasificar (con chequeo KB) o descartar con motivo. */
export function TriagePanel({ incidentId, knowledge = [] }: { incidentId: string; knowledge?: Kb[] }) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [mode, setMode] = useState<"accept" | "discard">("accept");
  const [classification, setClassification] = useState("incident");
  const [kbId, setKbId] = useState("");
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setErr(null);
    start(async () => { const r = await fn(); if (!r.ok) setErr(r.error ?? "error"); else router.refresh(); });
  }

  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--accent)", borderLeft: "3px solid var(--accent)", borderRadius: "var(--r-xl)", padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--accent-2)", background: "var(--accent-soft)", padding: "2px 9px", borderRadius: "var(--r-pill)" }}>{t("tri.pending")}</span>
        <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, color: "var(--text)" }}>{t("tri.title")}</span>
      </div>
      <p style={{ margin: "0 0 14px", fontSize: 12, color: "var(--muted)" }}>{t("tri.intro")}</p>

      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {(["accept", "discard"] as const).map((m) => (
          <button key={m} onClick={() => setMode(m)}
            style={{ fontSize: 12.5, fontWeight: 600, padding: "6px 14px", borderRadius: "var(--r-pill)", cursor: "pointer",
              border: mode === m ? "none" : "1px solid var(--line)",
              background: mode === m ? (m === "discard" ? "var(--st-critical-bg)" : "var(--cta-bg)") : "var(--card)",
              color: mode === m ? (m === "discard" ? "var(--st-critical-fg)" : "var(--cta-fg)") : "var(--muted)" }}>
            {t(("tri.mode." + m) as MessageKey)}
          </button>
        ))}
      </div>

      {mode === "accept" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={lbl}>{t("tri.classify")}</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {CLASSIFICATIONS.map((c) => (
                <button key={c} onClick={() => setClassification(c)}
                  style={{ fontSize: 12.5, fontWeight: 600, padding: "8px 14px", borderRadius: "var(--r-md)", cursor: "pointer",
                    border: classification === c ? "1px solid var(--accent)" : "1px solid var(--line)",
                    background: classification === c ? "var(--accent-soft)" : "var(--card)", color: classification === c ? "var(--accent-2)" : "var(--text)" }}>
                  {t(("tri.class." + c) as MessageKey)}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 6 }}>
              {classification === "incident" ? t("tri.route.ops") : t("tri.route.evo")}
            </div>
          </div>

          {classification === "incident" && knowledge.length > 0 && (
            <div>
              <label style={lbl}>{t("tri.kb")}</label>
              <select value={kbId} onChange={(e) => setKbId(e.target.value)} style={inp}>
                <option value="">{t("tri.kb.none")}</option>
                {knowledge.map((k) => <option key={k.id} value={k.id}>{k.article_number} · {k.title}</option>)}
              </select>
              {kbId && <div style={{ fontSize: 11, color: "var(--st-low-fg)", marginTop: 6 }}>{t("tri.kb.resolve")}</div>}
            </div>
          )}

          {err && <div style={{ fontSize: 12, color: "var(--st-critical)" }}>{err}</div>}
          <button onClick={() => run(() => acceptCase(incidentId, classification, kbId || undefined))} disabled={pending}
            style={{ alignSelf: "flex-start", fontSize: 13, fontWeight: 700, padding: "9px 18px", borderRadius: "var(--r-md)", border: "none", background: "var(--cta-bg)", color: "var(--cta-fg)", cursor: pending ? "default" : "pointer" }}>
            {pending ? t("tri.processing") : t("tri.accept.confirm")}
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{t("tri.discard.hint")}</div>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder={t("tri.discard.reason")} style={{ ...inp, resize: "vertical" }} />
          {err && <div style={{ fontSize: 12, color: "var(--st-critical)" }}>{err}</div>}
          <button onClick={() => run(() => discardCase(incidentId, reason))} disabled={pending || !reason}
            style={{ alignSelf: "flex-start", fontSize: 13, fontWeight: 700, padding: "9px 18px", borderRadius: "var(--r-md)", border: "none", background: "var(--st-critical)", color: "#fff", cursor: pending || !reason ? "default" : "pointer" }}>
            {pending ? t("tri.processing") : t("tri.discard.confirm")}
          </button>
        </div>
      )}
    </div>
  );
}

const lbl: React.CSSProperties = { display: "block", fontSize: 11.5, fontWeight: 600, color: "var(--muted)", marginBottom: 6 };
const inp: React.CSSProperties = { width: "100%", fontSize: 12.5, padding: "8px 10px", borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: "var(--card)", color: "var(--text)", fontFamily: "var(--font-ui)" };
