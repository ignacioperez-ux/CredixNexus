import { getContext } from "@/lib/auth/context";
import { listProjects, getConvertibleRecommendations, getProjectOptions } from "@/lib/projects/queries";
import { ProjectsKanban } from "@/components/projects/kanban";
import { NewProjectButton, PortfolioLink } from "@/components/projects/new-project-button";

export default async function ProjectsPage() {
  const ctx = await getContext();
  if (!ctx) return null;

  const [projects, convertibles, options] = await Promise.all([
    listProjects(ctx.supabase),
    getConvertibleRecommendations(ctx.supabase),
    getProjectOptions(ctx.supabase),
  ]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 9 }}>
        <PortfolioLink />
        <NewProjectButton />
      </div>
      <ProjectsKanban projects={projects} convertibles={convertibles} squads={options.squads} />
    </div>
  );
}
