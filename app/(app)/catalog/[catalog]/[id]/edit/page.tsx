import { notFound, redirect } from "next/navigation";
import { getContext, hasPermission } from "@/lib/auth/context";
import { getCatalog } from "@/lib/masterdata/registry";
import { getRecord, getCatalogFkOptions } from "@/lib/masterdata/queries";
import { MdForm } from "@/components/masterdata/md-form";

export default async function EditRecordPage({ params }: { params: Promise<{ catalog: string; id: string }> }) {
  const { catalog: key, id } = await params;
  const catalog = getCatalog(key);
  if (!catalog) notFound();
  const ctx = await getContext();
  if (!ctx) return null;
  if (!(await hasPermission(ctx.supabase, "masterdata.manage"))) redirect(`/catalog/${key}`);
  const [record, fkOptions] = await Promise.all([getRecord(ctx.supabase, catalog, id), getCatalogFkOptions(ctx.supabase, catalog)]);
  if (!record) notFound();
  return <MdForm catalog={catalog} mode="edit" id={id} initial={record} fkOptions={fkOptions} />;
}
