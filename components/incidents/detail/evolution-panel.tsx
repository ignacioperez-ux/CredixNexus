"use client";

import { Icon } from "@/components/ui/icon";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/provider";
import { InfoTip } from "@/components/help/info-tip";
import { DeriveModal } from "./derive-modal";

export function EvolutionPanel({ incidentId, status, score, candidate }: { incidentId: string; status: string; score: number; candidate: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const inEvolution = status === "in_evolution";

  return (
    <div style={{ background: "var(--dark-surface)", border: "1px solid var(--dark-surface-border)", borderRadius: "var(--r-xl)", padding: 18, color: "var(--dark-surface-fg)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14.5 }}>{t("inc.section.evolution")}</span>
          <InfoTip tip="inc.tip.transform" />
        </span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 20, fontWeight: 500, color: "var(--accent-bright)" }}>{Math.round(score)}</span>
      </div>

      {inEvolution ? (
        <div style={{ fontSize: 12.5, lineHeight: 1.5 }}>
          <div style={{ display: "inline-block", padding: "3px 10px", borderRadius: "var(--r-pill)", background: "var(--dark-chip)", color: "var(--accent-bright)", fontSize: 11.5, fontWeight: 600, marginBottom: 8 }}>
            {t("inc.evolution.inflow")}
          </div>
          <p style={{ margin: 0, opacity: 0.85 }}>{t("inc.evolution.note")}</p>
        </div>
      ) : (
        <div>
          {candidate && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--accent-bright)", marginBottom: 8 }}><Icon name="sparkle" size={13} fill="currentColor" /> {t("inc.evolution.candidate")}</div>
          )}
          <p style={{ margin: "0 0 12px", fontSize: 12.5, opacity: 0.85, lineHeight: 1.5 }}>{t("inc.evolution.note")}</p>
          <button onClick={() => setOpen(true)}
            style={{ width: "100%", padding: "10px", borderRadius: "var(--r-md)", background: "var(--accent)", color: "var(--on-accent)", border: "none", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
            {t("inc.evolution.send")}
          </button>
        </div>
      )}
      {open && <DeriveModal incidentId={incidentId} initialScore={score} onClose={() => setOpen(false)} onDone={() => { setOpen(false); router.refresh(); }} />}
    </div>
  );
}
