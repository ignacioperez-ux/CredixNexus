import { getContext } from "@/lib/auth/context";
import { getKb } from "@/lib/knowledge/queries";
import { KbBrowser } from "@/components/knowledge/kb-browser";

export default async function KnowledgePage() {
  const ctx = await getContext();
  if (!ctx) return null;
  const data = await getKb(ctx.supabase);
  return <KbBrowser data={data} />;
}
