"use server";

import { getContext, hasPermission } from "@/lib/auth/context";
import { getReport, type ReportDataset, type ReportResult } from "@/lib/analytics/queries";

// Permiso de lectura requerido por dataset (evita exponer datos sensibles a roles sin acceso).
const DATASET_PERM: Record<ReportDataset, string> = {
  incidents: "incident.read",
  changes: "change.read",
  risk: "risk.read",
  problems: "problem.read",
};

export async function fetchReport(dataset: ReportDataset): Promise<ReportResult | { error: string }> {
  const ctx = await getContext();
  if (!ctx?.tenantId) return { error: "PERMISSION" };
  const perm = DATASET_PERM[dataset];
  if (!perm || !(await hasPermission(ctx.supabase, perm))) return { error: "PERMISSION" };
  try {
    return await getReport(ctx.supabase, dataset);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "error" };
  }
}
