import type { SupabaseClient } from "@supabase/supabase-js";

const OPEN = ["new", "triaged", "assigned", "in_progress", "waiting", "reopened", "in_evolution"];

export type FitSuggestion = {
  id: string;
  name: string;
  discipline: string | null;
  is_external: boolean;
  fit: number;
  expertiseLevel: number;
  skillLevel: number;
  load: number;
};

/** Sugiere el perfil que mejor se ajusta a un incidente. Todo data-driven:
 *  - experiencia en la aplicacion afectada (member_expertise)
 *  - habilidad de dominio de la categoria (incident_category.related_skill_id -> member_skill)
 *  - disponibilidad (carga actual de incidentes abiertos)
 *  fit = 0.5*experiencia + 0.3*habilidad + 0.2*disponibilidad. */
export async function suggestForIncident(supabase: SupabaseClient, incidentId: string): Promise<FitSuggestion[]> {
  const { data: inc } = await supabase
    .from("incident")
    .select("affected_ci_id, category_id, category:category_id(related_skill_id)")
    .eq("id", incidentId)
    .maybeSingle();
  if (!inc) return [];

  const relatedSkillId = (inc.category as unknown as { related_skill_id: string | null } | null)?.related_skill_id ?? null;

  // Todo depende solo de `inc`: se resuelve en paralelo (un solo hop) en vez de encadenado.
  const [membersRes, openIncRes, expRes, skillRes] = await Promise.all([
    supabase.from("team_member").select("id, name, discipline, is_external").eq("status", "active"),
    supabase.from("incident").select("assigned_member_id, status"),
    inc.affected_ci_id
      ? supabase.from("member_expertise").select("member_id, level").eq("entity_type", "configuration_item").eq("entity_id", inc.affected_ci_id)
      : Promise.resolve({ data: [] as { member_id: string; level: number }[] }),
    relatedSkillId
      ? supabase.from("member_skill").select("member_id, level").eq("skill_id", relatedSkillId)
      : Promise.resolve({ data: [] as { member_id: string; level: number }[] }),
  ]);
  const members = (membersRes.data ?? []) as { id: string; name: string; discipline: string | null; is_external: boolean }[];

  const expByMember = new Map<string, number>();
  ((expRes.data ?? []) as { member_id: string; level: number }[]).forEach((e) => expByMember.set(e.member_id, e.level));

  const skillByMember = new Map<string, number>();
  ((skillRes.data ?? []) as { member_id: string; level: number }[]).forEach((s) => skillByMember.set(s.member_id, s.level));

  const loadByMember = new Map<string, number>();
  ((openIncRes.data ?? []) as { assigned_member_id: string | null; status: string }[]).forEach((i) => {
    if (i.assigned_member_id && OPEN.includes(i.status)) loadByMember.set(i.assigned_member_id, (loadByMember.get(i.assigned_member_id) ?? 0) + 1);
  });

  return members
    .map((m) => {
      const expertiseLevel = expByMember.get(m.id) ?? 0;
      const skillLevel = skillByMember.get(m.id) ?? 0;
      const load = loadByMember.get(m.id) ?? 0;
      const fit = Math.round(0.5 * (expertiseLevel / 5) * 100 + 0.3 * (skillLevel / 5) * 100 + 0.2 * Math.max(0, 100 - load * 25));
      return { id: m.id, name: m.name, discipline: m.discipline, is_external: m.is_external, fit, expertiseLevel, skillLevel, load };
    })
    .filter((x) => x.expertiseLevel > 0 || x.skillLevel > 0)
    .sort((a, b) => b.fit - a.fit)
    .slice(0, 4);
}
