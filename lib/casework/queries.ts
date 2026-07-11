import type { SupabaseClient } from "@supabase/supabase-js";
import { checklistProgress } from "@/lib/casework/validation";

// Adjuntos + tareas del caso. RLS aisla por tenant. Los adjuntos viven en Storage
// (bucket privado); se generan URLs firmadas al listar.

export const ATTACHMENT_BUCKET = "case-attachments";
const SIGNED_URL_TTL = 3600; // 1 hora

export type Attachment = {
  id: string; file_name: string; mime_type: string | null; size_bytes: number;
  created_at: string; uploaded_by: string | null; url: string | null;
};

export async function getAttachments(supabase: SupabaseClient, incidentId: string): Promise<Attachment[]> {
  const { data, error } = await supabase
    .from("case_attachment")
    .select("id, file_name, mime_type, size_bytes, storage_path, created_at, uploader:uploaded_by(full_name)")
    .eq("incident_id", incidentId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Record<string, unknown>[];

  const paths = rows.map((r) => r.storage_path as string);
  const urls = new Map<string, string>();
  if (paths.length > 0) {
    const { data: signed } = await supabase.storage.from(ATTACHMENT_BUCKET).createSignedUrls(paths, SIGNED_URL_TTL);
    for (const s of signed ?? []) if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl);
  }

  return rows.map((r) => {
    const up = r.uploader as { full_name: string } | null;
    return {
      id: r.id as string, file_name: r.file_name as string, mime_type: (r.mime_type as string | null) ?? null,
      size_bytes: Number(r.size_bytes), created_at: r.created_at as string,
      uploaded_by: up?.full_name ?? null, url: urls.get(r.storage_path as string) ?? null,
    };
  });
}

export type CaseTask = {
  id: string; title: string; status: string; due_date: string | null; done_at: string | null;
  assigned_to: string | null; position: number;
};
export type ChecklistData = { tasks: CaseTask[]; open: number; done: number; progress: number | null };

export async function getTasks(supabase: SupabaseClient, incidentId: string): Promise<ChecklistData> {
  const { data, error } = await supabase
    .from("case_task")
    .select("id, title, status, due_date, done_at, position, assignee:assigned_to_user_id(full_name)")
    .eq("incident_id", incidentId)
    .order("position")
    .order("created_at");
  if (error) throw new Error(error.message);
  const tasks: CaseTask[] = (data ?? []).map((r) => {
    const row = r as Record<string, unknown>;
    const a = row.assignee as { full_name: string } | null;
    return {
      id: row.id as string, title: row.title as string, status: row.status as string,
      due_date: (row.due_date as string | null) ?? null, done_at: (row.done_at as string | null) ?? null,
      assigned_to: a?.full_name ?? null, position: (row.position as number) ?? 0,
    };
  });
  const open = tasks.filter((t) => t.status === "open").length;
  const done = tasks.filter((t) => t.status === "done").length;
  return { tasks, open, done, progress: checklistProgress(open, done) };
}
