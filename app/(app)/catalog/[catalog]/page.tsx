import { notFound } from "next/navigation";
import { getContext, hasPermission } from "@/lib/auth/context";
import { getCatalog } from "@/lib/masterdata/registry";
import { listRecords, getCatalogFkOptions } from "@/lib/masterdata/queries";
import { MdList } from "@/components/masterdata/md-list";

export default async function CatalogListPage({ params }: { params: Promise<{ catalog: string }> }) {
  const { catalog: key } = await params;
  const catalog = getCatalog(key);
  if (!catalog) notFound();
  const ctx = await getContext();
  if (!ctx) return null;
  const [records, canManage, fkOptions] = await Promise.all([
    listRecords(ctx.supabase, catalog, { includeInactive: true }),
    hasPermission(ctx.supabase, "masterdata.manage"),
    getCatalogFkOptions(ctx.supabase, catalog),
  ]);
  return <MdList catalog={catalog} records={records as never} canManage={canManage} fkOptions={fkOptions} />;
}
