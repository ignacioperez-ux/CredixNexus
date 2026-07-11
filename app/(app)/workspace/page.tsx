import { getContext } from "@/lib/auth/context";
import { getWorkspace } from "@/lib/workspace/queries";
import { AgentWorkspace } from "@/components/workspace/agent-workspace";

export default async function WorkspacePage() {
  const ctx = await getContext();
  if (!ctx) return null;
  const ws = await getWorkspace(ctx.supabase, ctx.accountId);
  return <AgentWorkspace ws={ws} />;
}
