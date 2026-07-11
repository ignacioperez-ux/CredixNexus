import { getContext } from "@/lib/auth/context";
import { listConfigItems } from "@/lib/cmdb/queries";
import { CmdbList } from "@/components/cmdb/cmdb-list";

export default async function CmdbPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const sp = await searchParams;
  const ctx = await getContext();
  if (!ctx) return null;
  const rows = await listConfigItems(ctx.supabase);
  const initialType = sp.type === "application" || sp.type === "system" ? sp.type : undefined;
  return <CmdbList rows={rows} initialType={initialType} />;
}
