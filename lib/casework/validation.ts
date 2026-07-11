// Adjuntos + checklist de caso — validacion pura (testeable).

import { ErrorCode, minLength } from "@/lib/validation";

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10 MB (espeja el limite del bucket)
export const TASK_STATUSES = ["open", "done", "cancelled"] as const;

// Allowlist de tipos permitidos (evidencia de caso). No ejecutables.
export const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/png", "image/jpeg", "image/gif", "image/webp",
  "text/plain", "text/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/zip",
]);

export function validateAttachment(fileName: string, mime: string, size: number): string | null {
  if (!fileName || fileName.trim().length === 0) return ErrorCode.REQUIRED;
  if (!(size > 0)) return ErrorCode.FORMAT;
  if (size > MAX_ATTACHMENT_BYTES) return ErrorCode.FORMAT;
  if (!ALLOWED_MIME.has(mime)) return ErrorCode.INVALID_REFERENCE;
  return null;
}

export function validateTaskTitle(title: string): string | null {
  return minLength(title, 3);
}

/** Nombre de archivo seguro para el path de storage: solo alfanumerico, punto, guion y underscore. */
export function safeFileName(name: string): string {
  const base = (name || "archivo").trim().replace(/[^a-zA-Z0-9._-]/g, "_");
  return base.slice(0, 200) || "archivo";
}

/** Tamano legible. */
export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round((n / 1024) * 10) / 10} KB`;
  return `${Math.round((n / (1024 * 1024)) * 10) / 10} MB`;
}

/** Progreso del checklist (hechas / activas), 0-100. null si no hay tareas activas. */
export function checklistProgress(open: number, done: number): number | null {
  const total = open + done;
  if (total <= 0) return null;
  return Math.round((done / total) * 100);
}
