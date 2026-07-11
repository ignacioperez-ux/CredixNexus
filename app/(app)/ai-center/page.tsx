import { getContext } from "@/lib/auth/context";
import { getAiInteractions } from "@/lib/ai/queries";
import { AiCenter } from "@/components/ai/ai-center";

export default async function AiCenterPage() {
  const ctx = await getContext();
  if (!ctx) return null;
  const interactions = await getAiInteractions(ctx.supabase);
  return <AiCenter interactions={interactions} />;
}
