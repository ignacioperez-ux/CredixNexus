"use client";

import { Icon } from "@/components/ui/icon";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/provider";
import { generateKbDraft } from "@/lib/ai/suggestions";
import { saveKbArticle } from "@/lib/knowledge/actions";

export function AiKb({ incidentId }: { incidentId: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  async function gen() {
    setBusy(true);
    setNotice(null);
    const res = await generateKbDraft(incidentId);
    setBusy(false);
    if (!res.ok) {
      setNotice(res.error === "ai_not_configured" ? t("ai.notconfigured") : t("ai.error"));
      return;
    }
    setTitle(res.title ?? "");
    setContent(res.text ?? "");
  }

  async function save() {
    setBusy(true);
    setNotice(null);
    const res = await saveKbArticle(incidentId, title, content);
    setBusy(false);
    if (!res.ok) {
      setNotice(res.error === "ERR_MIN_LENGTH" ? t("err.ERR_MIN_LENGTH") : t("ai.error"));
      return;
    }
    setSaved(res.articleNumber ?? "");
    setTitle("");
    setContent("");
    router.refresh();
  }

  if (saved) {
    return <div style={{ fontSize: 13, color: "var(--st-low-fg)", display: "inline-flex", alignItems: "center", gap: 6 }}><Icon name="check" size={14} /> {t("kb.saved")} <b style={{ fontFamily: "var(--font-mono)" }}>{saved}</b></div>;
  }

  return content ? (
    <div>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 8 }}>{t("ai.disclaimer")}</div>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("kb.titlefield")}
        style={{ width: "100%", padding: "9px 12px", borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: "var(--card)", color: "var(--text)", fontSize: 13, fontWeight: 600, marginBottom: 8 }} />
      <textarea value={content} onChange={(e) => setContent(e.target.value)}
        style={{ width: "100%", minHeight: 200, padding: "10px 12px", borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: "var(--card)", color: "var(--text)", fontSize: 12.5, fontFamily: "var(--font-mono)", resize: "vertical", whiteSpace: "pre-wrap" }} />
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button onClick={save} disabled={busy} style={{ padding: "8px 16px", borderRadius: "var(--r-md)", background: "var(--accent)", color: "var(--on-accent)", border: "none", fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>{t("kb.save")}</button>
        <button onClick={() => setContent("")} style={{ padding: "8px 14px", borderRadius: "var(--r-md)", background: "var(--card)", color: "var(--text)", border: "1px solid var(--line)", fontWeight: 600, fontSize: 12.5, cursor: "pointer" }}>{t("common.cancel")}</button>
      </div>
      {notice && <p style={{ marginTop: 8, fontSize: 11.5, color: "var(--st-high-fg)" }}>{notice}</p>}
    </div>
  ) : (
    <div>
      <button onClick={gen} disabled={busy}
        style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 16px", borderRadius: "var(--r-md)", background: "var(--dark-surface)", color: "var(--dark-surface-fg)", border: "1px solid var(--dark-surface-border)", fontWeight: 600, fontSize: 12.5, cursor: "pointer" }}>
        <Icon name="sparkle" size={13} color="var(--accent-bright)" style={{ verticalAlign: "-2px" }} /> {busy ? t("ai.generating") : t("kb.gen.button")}
      </button>
      {notice && <p style={{ marginTop: 10, fontSize: 11.5, color: "var(--st-high-fg)" }}>{notice}</p>}
    </div>
  );
}
