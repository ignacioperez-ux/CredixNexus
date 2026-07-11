import { getContext } from "@/lib/auth/context";
import { CATALOGS } from "@/lib/masterdata/registry";
import { MdIndex } from "@/components/masterdata/md-index";

export default async function CatalogIndexPage() {
  const ctx = await getContext();
  if (!ctx) return null;
  const counts: Record<string, number> = {};
  await Promise.all(
    CATALOGS.map(async (c) => {
      const { count } = await ctx.supabase.from(c.table).select("*", { count: "exact", head: true }).eq("status", "active");
      counts[c.key] = count ?? 0;
    }),
  );
  return <MdIndex counts={counts} />;
}
