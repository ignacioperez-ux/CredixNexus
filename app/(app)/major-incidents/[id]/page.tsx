import { notFound } from "next/navigation";
import { getContext, hasPermission } from "@/lib/auth/context";
import { getMajorIncident, getMajorIncidentUpdates, getCommandOptions, getMiCommanders, pickCommander, isCaseInEvolution } from "@/lib/major-incidents/queries";
import { getLedgerForEntity } from "@/lib/incidents/queries";
import { MiDetail } from "@/components/major-incidents/mi-detail";

export default async function MajorIncidentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getContext();
  if (!ctx) return null;

  const mi = await getMajorIncident(ctx.supabase, id);
  if (!mi) notFound();

  const [updates, people, ledger, canManage, commanders] = await Promise.all([
    getMajorIncidentUpdates(ctx.supabase, id),
    getCommandOptions(ctx.supabase),
    getLedgerForEntity(ctx.supabase, id),
    hasPermission(ctx.supabase, "major_incident.manage"),
    getMiCommanders(ctx.supabase),
  ]);

  // Comandante fijo, derivado del rol (§11): Gerencia de Operaciones por defecto; Lider de
  // Evolucion si el caso ya paso a Evolucion. No editable desde la UI.
  const inEvolution = isCaseInEvolution((mi as { incident?: { status?: string } }).incident?.status);
  const commander = pickCommander(commanders, inEvolution);

  return <MiDetail mi={mi as never} updates={updates} people={people} ledger={ledger as never} canManage={canManage} commanderName={commander.ref?.full_name ?? null} commanderScope={commander.scope} />;
}
