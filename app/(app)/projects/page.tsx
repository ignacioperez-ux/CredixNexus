import { getContext } from "@/lib/auth/context";
import { listProjects, getConvertibleRecommendations, getProjectOptions } from "@/lib/projects/queries";
import { ProjectsKanban } from "@/components/projects/kanban";

export default async function ProjectsPage() {
  const ctx = await getContext();
  if (!ctx) return null;

  const [projects, convertibles, options] = await Promise.all([
    listProjects(ctx.supabase),
    getConvertibleRecommendations(ctx.supabase),
    getProjectOptions(ctx.supabase),
  ]);

  return <ProjectsKanban projects={projects} convertibles={convertibles} squads={options.squads} />;
}
