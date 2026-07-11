"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/provider";
import { addComment } from "@/lib/incidents/actions";

type Comment = {
  id: string;
  body: string;
  visibility: string;
  is_system_generated: boolean;
  created_at: string;
  author: { full_name: string } | null;
};

export function CommentThread({ incidentId, comments }: { incidentId: string; comments: Comment[] }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [body, setBody] = useState("");
  const [visibility, setVisibility] = useState<"internal" | "partner">("internal");
  const [busy, setBusy] = useState(false);

  async function post() {
    if (body.trim().length === 0) return;
    setBusy(true);
    const res = await addComment(incidentId, body, visibility);
    setBusy(false);
    if (res.ok) {
      setBody("");
      router.refresh();
    }
  }

  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
        {comments.length === 0 && <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("inc.comment.empty")}</div>}
        {comments.map((c) => (
          <div key={c.id} style={{ borderLeft: "2px solid var(--line)", paddingLeft: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text)" }}>
                {c.is_system_generated ? "Sistema" : c.author?.full_name ?? "—"}
              </span>
              <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: "var(--r-pill)", background: c.visibility === "partner" ? "var(--accent-soft)" : "var(--paper)", color: c.visibility === "partner" ? "var(--accent-2)" : "var(--muted)" }}>
                {c.visibility === "partner" ? t("inc.comment.partner") : t("inc.comment.internal")}
              </span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--muted)" }}>
                {new Date(c.created_at).toLocaleString(locale)}
              </span>
            </div>
            <div style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.5 }}>{c.body}</div>
          </div>
        ))}
      </div>

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={t("inc.comment.placeholder")}
        style={{ width: "100%", minHeight: 70, padding: "9px 12px", borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: "var(--card)", color: "var(--text)", fontSize: 13, fontFamily: "var(--font-ui)", resize: "vertical" }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
        <select value={visibility} onChange={(e) => setVisibility(e.target.value as "internal" | "partner")}
          style={{ padding: "7px 10px", borderRadius: "var(--r-sm)", border: "1px solid var(--line)", background: "var(--card)", color: "var(--text)", fontSize: 12 }}>
          <option value="internal">{t("inc.comment.internal")}</option>
          <option value="partner">{t("inc.comment.partner")}</option>
        </select>
        <button onClick={post} disabled={busy || body.trim().length === 0}
          style={{ padding: "8px 16px", borderRadius: "var(--r-md)", background: "var(--cta-bg)", color: "var(--cta-fg)", border: "none", fontWeight: 700, fontSize: 12.5, cursor: "pointer", opacity: busy || body.trim().length === 0 ? 0.6 : 1 }}>
          {t("inc.comment.send")}
        </button>
      </div>
    </div>
  );
}
