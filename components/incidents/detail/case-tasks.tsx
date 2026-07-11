"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import type { ChecklistData } from "@/lib/casework/queries";
import { addTask, setTaskStatus, deleteTask } from "@/lib/casework/actions";

export function CaseTasks({ incidentId, data, canManage }: { incidentId: string; data: ChecklistData; canManage: boolean }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [title, setTitle] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);

  function add() {
    if (title.trim().length < 3) { setErr(t("err.ERR_MIN_LENGTH")); return; }
    setErr(null);
    start(async () => {
      const r = await addTask(incidentId, title.trim());
      if (!r.ok) { setErr(t(("err." + (r.error ?? "ERR_INVALID_FORMAT")) as MessageKey)); return; }
      setTitle("");
      router.refresh();
    });
  }
  function toggle(id: string, done: boolean) { start(async () => { await setTaskStatus(id, done ? "done" : "open", incidentId); router.refresh(); }); }
  function remove(id: string) { start(async () => { await deleteTask(id, incidentId); router.refresh(); }); }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {data.tasks.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flex: 1, height: 6, background: "var(--paper)", borderRadius: 3, overflow: "hidden" }}>
            <div style={{ width: `${data.progress ?? 0}%`, height: "100%", background: "var(--st-low-fg)" }} />
          </div>
          <span style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>{data.done}/{data.open + data.done}</span>
        </div>
      )}

      {data.tasks.length === 0 && <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("task.empty")}</div>}
      {data.tasks.map((tk) => {
        const isDone = tk.status === "done";
        const overdue = tk.status === "open" && tk.due_date && tk.due_date < today;
        return (
          <div key={tk.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: "var(--paper)", border: "1px solid var(--line)", borderRadius: "var(--r-md)", opacity: tk.status === "cancelled" ? 0.5 : 1 }}>
            <input type="checkbox" checked={isDone} disabled={!canManage || pending || tk.status === "cancelled"} onChange={(e) => toggle(tk.id, e.target.checked)} style={{ cursor: canManage ? "pointer" : "default" }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: 13, color: "var(--text)", textDecoration: isDone || tk.status === "cancelled" ? "line-through" : "none" }}>{tk.title}</span>
              <div style={{ fontSize: 10.5, color: overdue ? "var(--st-critical-fg)" : "var(--muted)", fontFamily: "var(--font-mono)" }}>
                {tk.assigned_to ? tk.assigned_to : ""}{tk.due_date ? `${tk.assigned_to ? " · " : ""}${t("task.due")} ${new Date(tk.due_date).toLocaleDateString(locale)}` : ""}
              </div>
            </div>
            {canManage && <button onClick={() => remove(tk.id)} disabled={pending} aria-label={t("task.delete")} title={t("task.delete")} style={{ width: 20, height: 20, border: "none", background: "transparent", color: "var(--st-critical-fg)", cursor: "pointer", fontSize: 14 }}>×</button>}
          </div>
        );
      })}

      {canManage && (
        <div style={{ display: "flex", gap: 6, flexDirection: "column" }}>
          <div style={{ display: "flex", gap: 6 }}>
            <input value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }} placeholder={t("task.placeholder")}
              style={{ flex: 1, fontSize: 12.5, padding: "8px 10px", borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: "var(--card)", color: "var(--text)" }} />
            <button onClick={add} disabled={pending || title.trim().length < 3}
              style={{ fontSize: 12.5, fontWeight: 600, padding: "8px 14px", borderRadius: "var(--r-md)", border: "none", background: "var(--cta-bg)", color: "var(--cta-fg)", cursor: pending || title.trim().length < 3 ? "default" : "pointer", opacity: title.trim().length < 3 ? 0.6 : 1 }}>
              + {t("task.add")}
            </button>
          </div>
          {err && <div style={{ fontSize: 11.5, color: "var(--st-critical-fg)" }}>{err}</div>}
        </div>
      )}
    </div>
  );
}
