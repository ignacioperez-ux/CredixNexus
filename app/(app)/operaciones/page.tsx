import { getContext } from "@/lib/auth/context";
import { getOperationsTower } from "@/lib/operations/queries";
import { OperationsTower } from "@/components/operations/operations-tower";

// Torre de Control del Gerente de Operaciones (support_lead). Misma filosofia que la de Evolucion:
// decision primero (bandeja priorizada con CTA), luego inventario (pipeline + KPIs ITSM). Todo dato
// real y agregado en servidor desde tablas existentes (lib/operations/queries). El guard de ruta
// (incident.read) + la denylist de persona ya se aplican en app/(app)/layout.tsx.
export default async function OperacionesPage() {
  const ctx = await getContext();
  if (!ctx) return null;
  const tower = await getOperationsTower(ctx.supabase);
  const firstName = ctx.name.trim().split(/\s+/)[0] || ctx.name;
  return <OperationsTower tower={tower} firstName={firstName} />;
}
