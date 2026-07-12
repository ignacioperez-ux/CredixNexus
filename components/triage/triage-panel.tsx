"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import { acceptCase, discardCase } from "@/lib/triage/actions";
import { Icon } from "@/components/ui/icon";

type Kb = { id: string; article_number: string; title: string };

/** Protocolo de admision simplificado: la decision principal es binaria — Incidencia
 *  (Operaciones) vs Evolucion (oportunidad estructural). Si es Evolucion, un sub-tipo
 *  Mejora/Proyecto. O descartar con motivo. El backend recibe incident/improvement/project. */
export function TriagePanel({ incidentId, knowledge = [] }: { incidentId: string; knowledge?: Kb[] }) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [mode, setMode] = useState<"accept" | "discard">("accept");
  const [route, setRoute] = useState<"ops" | "evo">("ops");
  const [evoKind, setEvoKind] = useState<"improvement" | "project">("improvement");
  const [kbId, setKbId] = useState("");
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const classification = route === "ops" ? "incident" : evoKind;

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
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Decision principal: dos opciones claras */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <OptionCard selected={route === "ops"} onClick={() => setRoute("ops")} icon="gear"
              title={t("tri.class.incident")} desc={t("tri.opt.incident.desc")} />
            <OptionCard selected={route === "evo"} onClick={() => setRoute("evo")} icon="sparkle"
              title={t("tri.opt.evo.title")} desc={t("tri.opt.evo.desc")} />
          </div>

          {/* Sub-tipo solo si es Evolucion */}
          {route === "evo" && (
            <div>
              <label style={lbl}>{t("tri.evo.kind")}</label>
              <div style={{ display: "flex", gap: 8 }}>
                {(["improvement", "project"] as const).map((k) => (
                  <button key={k} onClick={() => setEvoKind(k)}
                    style={{ fontSize: 12.5, fontWeight: 600, padding: "7px 16px", borderRadius: "var(--r-md)", cursor: "pointer",
                      border: evoKind === k ? "1px solid var(--accent)" : "1px solid var(--line)",
                      background: evoKind === k ? "var(--accent-soft)" : "var(--card)", color: evoKind === k ? "var(--accent-2)" : "var(--text)" }}>
                    {t(("tri.class." + k) as MessageKey)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Resolucion directa por KB solo para incidencias, opcional */}
          {route === "ops" && knowledge.length > 0 && (
            <div>
              <label style={lbl}>{t("tri.kb.q")}</label>
              <select value={kbId} onChange={(e) => setKbId(e.target.value)} style={inp}>
                <option value="">{t("tri.kb.none")}</option>
                {knowledge.map((k) => <option key={k.id} value={k.id}>{k.article_number} · {k.title}</option>)}
              </select>
              {kbId && <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--st-low-fg)", marginTop: 6 }}><Icon name="check" size={12} /> {t("tri.kb.resolve")}</div>}
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

function OptionCard({ selected, onClick, icon, title, desc }: { selected: boolean; onClick: () => void; icon: string; title: string; desc: string }) {
  return (
    <button onClick={onClick}
      style={{ textAlign: "left", cursor: "pointer", padding: "12px 14px", borderRadius: "var(--r-lg)",
        border: selected ? "1px solid var(--accent)" : "1px solid var(--line)",
        background: selected ? "var(--accent-soft)" : "var(--card)", display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13.5, fontWeight: 700, color: selected ? "var(--accent-2)" : "var(--text)" }}>
        <Icon name={icon} size={15} /> {title}
      </span>
      <span style={{ fontSize: 11.5, color: "var(--muted)", lineHeight: 1.45 }}>{desc}</span>
    </button>
  );
}

const lbl: React.CSSProperties = { display: "block", fontSize: 11.5, fontWeight: 600, color: "var(--muted)", marginBottom: 6 };
const inp: React.CSSProperties = { width: "100%", fontSize: 12.5, padding: "8px 10px", borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: "var(--card)", color: "var(--text)", fontFamily: "var(--font-ui)" };
