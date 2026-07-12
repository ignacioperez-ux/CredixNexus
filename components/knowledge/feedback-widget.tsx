"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import { submitKbFeedback } from "@/lib/knowledge/actions";
import { Icon } from "@/components/ui/icon";

/** Widget de feedback util/no-util reutilizable (KB y portal). Un voto por usuario. */
export function FeedbackWidget({ articleId, source, initial, canFeedback, compact }: {
  articleId: string; source: "kb" | "portal" | "incident"; initial?: { helpful: boolean; comment: string | null } | null; canFeedback: boolean; compact?: boolean;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [vote, setVote] = useState<boolean | null>(initial ? initial.helpful : null);
  const [comment, setComment] = useState(initial?.comment ?? "");
  const [showComment, setShowComment] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!canFeedback) return null;

  function send(helpful: boolean, withComment: boolean) {
    setErr(null);
    setVote(helpful);
    start(async () => {
      const r = await submitKbFeedback(articleId, helpful, withComment ? comment : null, source);
      if (!r.ok) { setErr(t(("err." + (r.error ?? "ERR_INVALID_FORMAT")) as MessageKey)); return; }
      setDone(true);
      setShowComment(false);
      router.refresh();
    });
  }

  const btn = (active: boolean): React.CSSProperties => ({
    fontSize: compact ? 12 : 12.5, fontWeight: 600, padding: compact ? "5px 10px" : "7px 14px", borderRadius: "var(--r-md)",
    border: `1px solid ${active ? "var(--accent)" : "var(--line)"}`, background: active ? "var(--accent-soft)" : "transparent",
    color: active ? "var(--accent-2)" : "var(--text)", cursor: pending ? "default" : "pointer",
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: compact ? 11.5 : 12.5, color: "var(--muted)" }}>{done ? t("kb.fb.thanks") : t("kb.fb.ask")}</span>
        <button disabled={pending} onClick={() => send(true, false)} style={{ ...btn(vote === true), display: "inline-flex", alignItems: "center", gap: 5 }}><Icon name="thumbs-up" size={13} /> {t("kb.fb.yes")}</button>
        <button disabled={pending} onClick={() => { setVote(false); setShowComment((s) => !s); }} style={{ ...btn(vote === false), display: "inline-flex", alignItems: "center", gap: 5 }}><Icon name="thumbs-down" size={13} /> {t("kb.fb.no")}</button>
      </div>
      {showComment && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} placeholder={t("kb.fb.comment")}
            style={{ fontSize: 12.5, padding: "8px 10px", borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: "var(--card)", color: "var(--text)", resize: "vertical", fontFamily: "var(--font-ui)" }} />
          <button disabled={pending} onClick={() => send(false, true)}
            style={{ alignSelf: "flex-start", fontSize: 12, fontWeight: 600, padding: "6px 14px", borderRadius: "var(--r-md)", border: "none", background: "var(--cta-bg)", color: "var(--cta-fg)", cursor: "pointer" }}>
            {t("kb.fb.send")}
          </button>
        </div>
      )}
      {err && <div style={{ fontSize: 11, color: "var(--st-critical-fg)" }}>{err}</div>}
    </div>
  );
}
