import { getContext } from "@/lib/auth/context";
import { listSquads } from "@/lib/squads/queries";
import { SquadList } from "@/components/squads/squad-list";

export default async function SquadsPage() {
  const ctx = await getContext();
  if (!ctx) return null;
  const rows = await listSquads(ctx.supabase);
  return <SquadList rows={rows} />;
}
