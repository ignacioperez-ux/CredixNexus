import { getContext } from "@/lib/auth/context";
import { getTeamQueue } from "@/lib/operador/queries";
import { OpQueueView } from "@/components/operador/cola-equipo";

// Cola del equipo en SOLO LECTURA: sin asignar + asignados a otros. Contexto/colaboracion, nunca
// accion. Sin botones, sin seleccion, sin "Tomar siguiente".
export default async function ColaEquipoPage() {
  const ctx = await getContext();
  if (!ctx) return null;
  const queue = await getTeamQueue(ctx.supabase, ctx.accountId);
  return <OpQueueView queue={queue} />;
}
