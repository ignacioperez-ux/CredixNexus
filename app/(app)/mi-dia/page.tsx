import { getContext } from "@/lib/auth/context";
import { getMyDay } from "@/lib/operador/queries";
import { OpDayView } from "@/components/operador/mi-dia";

// Cockpit personal del Operador. Solo datos del operador autenticado; cero KPIs globales de la mesa.
export default async function MiDiaPage() {
  const ctx = await getContext();
  if (!ctx) return null;
  const firstName = ctx.name.trim().split(/\s+/)[0] || ctx.name;
  const day = await getMyDay(ctx.supabase, ctx.accountId, firstName);
  return <OpDayView day={day} firstName={firstName} />;
}
