"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { generateExecutiveSummary } from "@/lib/ai/suggestions";
import { AiReport } from "@/components/ai/ai-report";

export function AiExecSummary({ incidentId }: { incidentId: string }) {
  const { t } = useI18n();
  const [text, setText] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function gen() {
    setBusy(true);
    setNotice(null);
    const res = await generateExecutiveSummary(incidentId);
    setBusy(false);
    if (!res.ok) {
      setNotice(res.error === "ai_not_configured" ? t("ai.notconfigured") : t("ai.error"));
      return;
    }
    setText(res.text ?? "");
  }

  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 18 }}>
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14.5, marginBottom: 12, color: "var(--text)" }}>{t("inc.section.exec")}</div>
      {text ? (
        <AiReport text={text} />
      ) : (
        <button onClick={gen} disabled={busy}
          style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 14px", borderRadius: "var(--r-md)", background: "var(--dark-surface)", color: "var(--dark-surface-fg)", border: "1px solid var(--dark-surface-border)", fontWeight: 600, fontSize: 12, cursor: "pointer" }}>
          <span style={{ color: "var(--accent-bright)" }}>✦</span> {busy ? t("ai.generating") : t("ai.execsummary")}
        </button>
      )}
      {notice && <p style={{ marginTop: 8, fontSize: 11, color: "var(--st-high-fg)" }}>{notice}</p>}
    </div>
  );
}
