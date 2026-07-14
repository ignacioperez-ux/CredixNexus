import { getContext } from "@/lib/auth/context";
import { getAccessControl } from "@/lib/auth/session";
import { getKb } from "@/lib/knowledge/queries";
import { KbBrowser } from "@/components/knowledge/kb-browser";
import { UserKnowledge } from "@/components/knowledge/user-knowledge";

export default async function KnowledgePage() {
  const ctx = await getContext();
  if (!ctx) return null;
  const [data, access] = await Promise.all([getKb(ctx.supabase), getAccessControl()]);
  // El curador (knowledge.manage/admin) mantiene la tabla de gestion; el usuario final recibe
  // la vista de descubrimiento (KM real, sin metricas de operacion).
  const isCurator = access.isAdmin || access.perms.includes("knowledge.manage");
  return isCurator ? <KbBrowser data={data} /> : <UserKnowledge data={data} />;
}
