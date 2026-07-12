import type { SupabaseClient } from "@supabase/supabase-js";

const OPEN = ["new", "triaged", "assigned", "in_progress", "waiting", "reopened", "in_evolution"];

export type TalentProfile = {
  id: string;
  name: string;
  email: string | null;
  discipline: string | null;
  seniority: string | null;
  is_external: boolean;
  external_type: string | null;
  stream_code: string | null;   // operations | evolution
  stream_name: string | null;
  stream_lead: string | null;   // responsable (delivery_area.lead_name)
  status: string;
  capacity_points: number;
  skills: { name: string; level: number }[];
  expertiseCount: number;
  openIncidents: number;
  effectiveness: number | null; // promedio performance_score (0-100)
  empathy: number | null;       // promedio empathy_score (0-100)
  evalCount: number;
};

export type AssignableMember = { id: string; name: string; discipline: string | null; is_external: boolean };

/** Lista simple de responsables asignables (activos) para el selector manual de asignacion. */
export async function getAssignableMembers(supabase: SupabaseClient): Promise<AssignableMember[]> {
  const { data } = await supabase
    .from("team_member")
    .select("id, name, discipline, is_external")
    .eq("status", "active")
    .order("name");
  return (data ?? []) as AssignableMember[];
}

const avg = (arr: (number | null)[]): number | null => {
  const v = arr.filter((x): x is number => x != null).map(Number);
  return v.length ? Math.round(v.reduce((s, n) => s + n, 0) / v.length) : null;
};

export async function getTalentProfiles(supabase: SupabaseClient): Promise<TalentProfile[]> {
  const [membersRes, skillsRes, expRes, incRes, evalRes] = await Promise.all([
    supabase.from("team_member").select("id, name, email, discipline, is_external, external_type, seniority, capacity_points, status, area:delivery_area_id(code, name, lead_name)").order("name"),
    supabase.from("member_skill").select("member_id, level, skill:skill_id(name)"),
    supabase.from("member_expertise").select("member_id"),
    supabase.from("incident").select("assigned_member_id, status"),
    supabase.from("member_evaluation").select("member_id, performance_score, empathy_score"),
  ]);

  const members = (membersRes.data ?? []) as unknown as {
    id: string; name: string; email: string | null; discipline: string | null; is_external: boolean;
    external_type: string | null; seniority: string | null; capacity_points: number; status: string;
    area: { code: string; name: string; lead_name: string | null } | null;
  }[];
  const skills = (skillsRes.data ?? []) as unknown as { member_id: string; level: number; skill: { name: string } | null }[];
  const exp = (expRes.data ?? []) as { member_id: string }[];
  const incidents = (incRes.data ?? []) as { assigned_member_id: string | null; status: string }[];
  const evals = (evalRes.data ?? []) as { member_id: string; performance_score: number | null; empathy_score: number | null }[];

  return members.map((m) => {
    const myEvals = evals.filter((e) => e.member_id === m.id);
    return {
      id: m.id, name: m.name, email: m.email ?? null,
      discipline: m.discipline, seniority: m.seniority, is_external: m.is_external, external_type: m.external_type ?? null,
      stream_code: m.area?.code ?? null, stream_name: m.area?.name ?? null, stream_lead: m.area?.lead_name ?? null,
      status: m.status, capacity_points: m.capacity_points,
      skills: skills.filter((s) => s.member_id === m.id).map((s) => ({ name: (s.skill as { name: string } | null)?.name ?? "—", level: s.level })),
      expertiseCount: exp.filter((e) => e.member_id === m.id).length,
      openIncidents: incidents.filter((i) => i.assigned_member_id === m.id && OPEN.includes(i.status)).length,
      effectiveness: avg(myEvals.map((e) => e.performance_score)),
      empathy: avg(myEvals.map((e) => e.empathy_score)),
      evalCount: myEvals.length,
    };
  });
}

// ---- Detalle de un profesional -----------------------------------------------

export type MemberSkillRow = { id: string; level: number; skill: { id: string; name: string; category: string } | null };
export type MemberExpertiseRow = { id: string; entity_type: string; entity_id: string; level: number };
export type MemberEvalRow = {
  id: string; eval_type: string; performance_score: number | null; empathy_score: number | null;
  comment: string | null; behavior_note: string | null; strengths: string | null; development_areas: string | null;
  period: string; entity_type: string | null; entity_id: string | null; created_at: string;
  evaluator: { full_name: string } | null;
};
export type MemberDetail = {
  member: {
    id: string; name: string; email: string | null; discipline: string | null; seniority: string | null;
    is_external: boolean; external_type: string | null; capacity_points: number; status: string;
    delivery_area_id: string | null; area: { id: string; code: string; name: string; lead_name: string | null } | null;
  };
  skills: MemberSkillRow[];
  expertise: MemberExpertiseRow[];
  evaluations: MemberEvalRow[];
  openIncidents: number;
};

export async function getMemberDetail(supabase: SupabaseClient, id: string): Promise<MemberDetail | null> {
  const { data: m } = await supabase
    .from("team_member")
    .select("id, name, email, discipline, seniority, is_external, external_type, capacity_points, status, delivery_area_id, area:delivery_area_id(id, code, name, lead_name)")
    .eq("id", id)
    .maybeSingle();
  if (!m) return null;

  const [skillsRes, expRes, evalRes, incRes] = await Promise.all([
    supabase.from("member_skill").select("id, level, skill:skill_id(id, name, category)").eq("member_id", id),
    supabase.from("member_expertise").select("id, entity_type, entity_id, level").eq("member_id", id),
    supabase.from("member_evaluation").select("id, eval_type, performance_score, empathy_score, comment, behavior_note, strengths, development_areas, period, entity_type, entity_id, created_at, evaluator:evaluator_user_id(full_name)").eq("member_id", id).order("created_at", { ascending: false }),
    supabase.from("incident").select("assigned_member_id, status"),
  ]);

  const incidents = (incRes.data ?? []) as { assigned_member_id: string | null; status: string }[];
  return {
    member: m as unknown as MemberDetail["member"],
    skills: (skillsRes.data ?? []) as unknown as MemberSkillRow[],
    expertise: (expRes.data ?? []) as MemberExpertiseRow[],
    evaluations: (evalRes.data ?? []) as unknown as MemberEvalRow[],
    openIncidents: incidents.filter((i) => i.assigned_member_id === id && OPEN.includes(i.status)).length,
  };
}

// ---- Opciones (catalogos reales) para formularios de Talento -----------------

export type TalentOptions = {
  skills: { id: string; name: string; category: string }[];
  areas: { id: string; code: string; name: string; lead_name: string | null }[];
  entities: Record<string, { id: string; name: string }[]>; // por entity_type de experiencia
};

export async function getTalentOptions(supabase: SupabaseClient): Promise<TalentOptions> {
  const [skills, areas, processes, bus, products, channels, cis, services] = await Promise.all([
    supabase.from("skill").select("id, name, category").eq("status", "active").order("name"),
    supabase.from("delivery_area").select("id, code, name, lead_name").eq("status", "active").order("name"),
    supabase.from("process").select("id, name").order("name"),
    supabase.from("business_unit").select("id, name").order("name"),
    supabase.from("product").select("id, name").order("name"),
    supabase.from("channel").select("id, name").order("name"),
    supabase.from("configuration_item").select("id, name").order("name"),
    supabase.from("service").select("id, name").order("name"),
  ]);
  return {
    skills: (skills.data ?? []) as { id: string; name: string; category: string }[],
    areas: (areas.data ?? []) as { id: string; code: string; name: string; lead_name: string | null }[],
    entities: {
      process: (processes.data ?? []) as { id: string; name: string }[],
      business_unit: (bus.data ?? []) as { id: string; name: string }[],
      product: (products.data ?? []) as { id: string; name: string }[],
      channel: (channels.data ?? []) as { id: string; name: string }[],
      configuration_item: (cis.data ?? []) as { id: string; name: string }[],
      service: (services.data ?? []) as { id: string; name: string }[],
    },
  };
}
