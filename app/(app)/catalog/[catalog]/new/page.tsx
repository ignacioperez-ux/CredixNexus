import { notFound, redirect } from "next/navigation";
import { getContext, hasPermission } from "@/lib/auth/context";
import { getCatalog } from "@/lib/masterdata/registry";
import { getCatalogFkOptions } from "@/lib/masterdata/queries";
import { MdForm } from "@/components/masterdata/md-form";

export default async function NewRecordPage({ params }: { params: Promise<{ catalog: string }> }) {
  const { catalog: key } = await params;
  const catalog = getCatalog(key);
  if (!catalog) notFound();
  const ctx = await getContext();
  if (!ctx) return null;
  if (!(await hasPermission(ctx.supabase, "masterdata.manage"))) redirect(`/catalog/${key}`);
  const fkOptions = await getCatalogFkOptions(ctx.supabase, catalog);
  return <MdForm catalog={catalog} mode="create" fkOptions={fkOptions} />;
}
