import type { SupabaseClient } from "@supabase/supabase-js";

const OPEN = ["new", "triaged", "assigned", "in_progress", "waiting", "reopened", "in_evolution"];

export type TalentProfile = {
  id: string;
  name: string;
  discipline: string | null;
  is_external: boolean;
  seniority: string | null;
  capacity_points: number;
  skills: { name: string; level: number }[];
  expertiseCount: number;
  openIncidents: number;
  performance: number | null; // solo si el usuario tiene permiso talent.read (RLS)
};

export async function getTalentProfiles(supabase: SupabaseClient): Promise<TalentProfile[]> {
  const [membersRes, skillsRes, expRes, incRes, evalRes] = await Promise.all([
    supabase.from("team_member").select("id, name, discipline, is_external, seniority, capacity_points").eq("status", "active").order("name"),
    supabase.from("member_skill").select("member_id, level, skill:skill_id(name)"),
    supabase.from("member_expertise").select("member_id"),
    supabase.from("incident").select("assigned_member_id, status"),
    supabase.from("member_evaluation").select("member_id, performance_score"), // RLS: vacío si no hay permiso
  ]);

  const members = (membersRes.data ?? []) as { id: string; name: string; discipline: string | null; is_external: boolean; seniority: string | null; capacity_points: number }[];
  const skills = (skillsRes.data ?? []) as unknown as { member_id: string; level: number; skill: { name: string } | null }[];
  const exp = (expRes.data ?? []) as { member_id: string }[];
  const incidents = (incRes.data ?? []) as { assigned_member_id: string | null; status: string }[];
  const evals = (evalRes.data ?? []) as { member_id: string; performance_score: number | null }[];

  return members.map((m) => ({
    id: m.id,
    name: m.name,
    discipline: m.discipline,
    is_external: m.is_external,
    seniority: m.seniority,
    capacity_points: m.capacity_points,
    skills: skills.filter((s) => s.member_id === m.id).map((s) => ({ name: (s.skill as unknown as { name: string } | null)?.name ?? "—", level: s.level })),
    expertiseCount: exp.filter((e) => e.member_id === m.id).length,
    openIncidents: incidents.filter((i) => i.assigned_member_id === m.id && OPEN.includes(i.status)).length,
    performance: evals.find((e) => e.member_id === m.id)?.performance_score ?? null,
  }));
}
