"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import type { Attachment } from "@/lib/casework/queries";
import { uploadAttachment, deleteAttachment } from "@/lib/casework/actions";
import { formatBytes } from "@/lib/casework/validation";
import { Icon } from "@/components/ui/icon";

export function Attachments({ incidentId, attachments, canManage }: { incidentId: string; attachments: Attachment[]; canManage: boolean }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(null);
    const fd = new FormData();
    fd.set("file", file);
    start(async () => {
      const r = await uploadAttachment(incidentId, fd);
      if (inputRef.current) inputRef.current.value = "";
      if (!r.ok) { setErr(t(("err." + (r.error ?? "ERR_INVALID_FORMAT")) as MessageKey)); return; }
      router.refresh();
    });
  }
  function remove(id: string) { start(async () => { await deleteAttachment(id, incidentId); router.refresh(); }); }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {attachments.length === 0 && <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("att.empty")}</div>}
      {attachments.map((a) => (
        <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", background: "var(--paper)", border: "1px solid var(--line)", borderRadius: "var(--r-md)" }}>
          <Icon name="paperclip" size={15} color="var(--muted)" />
          <div style={{ flex: 1, minWidth: 0 }}>
            {a.url
              ? <a href={a.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: "var(--accent-2)", textDecoration: "none", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>{a.file_name}</a>
              : <span style={{ fontSize: 13, color: "var(--text)" }}>{a.file_name}</span>}
            <div style={{ fontSize: 10.5, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>
              {formatBytes(a.size_bytes)}{a.uploaded_by ? ` · ${a.uploaded_by}` : ""} · {new Date(a.created_at).toLocaleDateString(locale)}
            </div>
          </div>
          {canManage && <button onClick={() => remove(a.id)} disabled={pending} aria-label={t("att.delete")} title={t("att.delete")} style={{ width: 22, height: 22, border: "none", background: "transparent", color: "var(--st-critical-fg)", cursor: "pointer", fontSize: 15 }}>×</button>}
        </div>
      ))}

      {canManage && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ alignSelf: "flex-start", fontSize: 12.5, fontWeight: 600, padding: "8px 14px", borderRadius: "var(--r-md)", border: "1px dashed var(--accent)", color: "var(--accent-2)", cursor: pending ? "default" : "pointer", opacity: pending ? 0.6 : 1 }}>
            {pending ? t("att.uploading") : `+ ${t("att.add")}`}
            <input ref={inputRef} type="file" onChange={onPick} disabled={pending} style={{ display: "none" }} />
          </label>
          <span style={{ fontSize: 10.5, color: "var(--muted)" }}>{t("att.hint")}</span>
          {err && <div style={{ fontSize: 11.5, color: "var(--st-critical-fg)" }}>{err}</div>}
        </div>
      )}
    </div>
  );
}
