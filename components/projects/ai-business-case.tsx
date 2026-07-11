"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/provider";
import { generateBusinessCase } from "@/lib/ai/suggestions";
import { saveBusinessCase } from "@/lib/projects/actions";
import { AiReport } from "@/components/ai/ai-report";

export function AiBusinessCase({ projectId, current }: { projectId: string; current: string | null }) {
  const { t } = useI18n();
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function gen() {
    setBusy(true);
    setNotice(null);
    const res = await generateBusinessCase(projectId);
    setBusy(false);
    if (!res.ok) {
      setNotice(res.error === "ai_not_configured" ? t("ai.notconfigured") : t("ai.error"));
      return;
    }
    setDraft(res.text ?? "");
  }

  async function save() {
    setBusy(true);
    await saveBusinessCase(projectId, draft);
    setBusy(false);
    setDraft("");
    router.refresh();
  }

  return (
    <div>
      {current && !draft && <div style={{ marginBottom: 12 }}><AiReport text={current} /></div>}

      {draft ? (
        <div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 8 }}>{t("ai.disclaimer")}</div>
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)}
            style={{ width: "100%", minHeight: 220, padding: "10px 12px", borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: "var(--card)", color: "var(--text)", fontSize: 12.5, fontFamily: "var(--font-ui)", resize: "vertical", whiteSpace: "pre-wrap" }} />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button onClick={save} disabled={busy} style={{ padding: "8px 16px", borderRadius: "var(--r-md)", background: "var(--accent)", color: "var(--on-accent)", border: "none", fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>{t("bc.save")}</button>
            <button onClick={() => setDraft("")} style={{ padding: "8px 14px", borderRadius: "var(--r-md)", background: "var(--card)", color: "var(--text)", border: "1px solid var(--line)", fontWeight: 600, fontSize: 12.5, cursor: "pointer" }}>{t("common.cancel")}</button>
          </div>
        </div>
      ) : (
        <button onClick={gen} disabled={busy}
          style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 16px", borderRadius: "var(--r-md)", background: "var(--dark-surface)", color: "var(--dark-surface-fg)", border: "1px solid var(--dark-surface-border)", fontWeight: 600, fontSize: 12.5, cursor: "pointer" }}>
          <span style={{ color: "var(--accent-bright)" }}>✦</span> {busy ? t("ai.generating") : t("bc.gen")}
        </button>
      )}
      {notice && <p style={{ marginTop: 10, fontSize: 11.5, color: "var(--st-high-fg)" }}>{notice}</p>}
    </div>
  );
}
