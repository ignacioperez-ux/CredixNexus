import { getContext } from "@/lib/auth/context";
import { getFormOptions } from "@/lib/incidents/queries";
import { IncidentForm } from "@/components/incidents/incident-form";

export default async function NewIncidentPage() {
  const ctx = await getContext();
  if (!ctx) return null;
  const options = await getFormOptions(ctx.supabase);
  return <IncidentForm options={options} mode="create" />;
}
