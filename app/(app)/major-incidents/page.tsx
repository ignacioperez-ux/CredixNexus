import { getContext } from "@/lib/auth/context";
import { listMajorIncidents } from "@/lib/major-incidents/queries";
import { MiList } from "@/components/major-incidents/mi-list";

export default async function MajorIncidentsPage() {
  const ctx = await getContext();
  if (!ctx) return null;
  const data = await listMajorIncidents(ctx.supabase);
  return <MiList data={data} />;
}
