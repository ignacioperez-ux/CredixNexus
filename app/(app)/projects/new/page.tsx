import { getContext } from "@/lib/auth/context";
import { getProjectOptions } from "@/lib/projects/queries";
import { ProjectForm } from "@/components/projects/project-form";

export default async function NewProjectPage() {
  const ctx = await getContext();
  if (!ctx) return null;
  const options = await getProjectOptions(ctx.supabase);
  return <ProjectForm options={options} mode="create" />;
}
