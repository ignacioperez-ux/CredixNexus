import { getContext } from "@/lib/auth/context";
import { getMyWork } from "@/lib/squad-member/queries";
import { MyWorkView } from "@/components/squad-member/my-work";

// Cockpit personal del Miembro de Squad. Todo acotado a la persona (assigned_member_id) y a sus
// squads vigentes. El guard de ruta (project.read) + la denylist de persona ya se aplican en el layout.
export default async function MiTrabajoPage() {
  const ctx = await getContext();
  if (!ctx) return null;
  const firstName = ctx.name.trim().split(/\s+/)[0] || ctx.name;
  const work = await getMyWork(ctx.supabase, ctx.accountId, firstName);
  return <MyWorkView work={work} firstName={firstName} />;
}
