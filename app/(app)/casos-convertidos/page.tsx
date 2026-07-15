import { getContext } from "@/lib/auth/context";
import { getConvertedCases } from "@/lib/evolution/queries";
import { ConvertedCasesView } from "@/components/evolution/converted-cases";

const DIM_KEYS = ["converted_to", "status", "priority", "case_type", "system", "product", "process", "business_unit", "channel", "category"];
const normDim = (v: string | undefined, fb: string) => (v && DIM_KEYS.includes(v) ? v : fb);

// Casos convertidos: trazabilidad incidencia -> candidato -> mejora -> proyecto, orientada al
// Gerente de Evolucion (pipeline + viaje de cada caso). Dato del RPC converted_cases() sin cambios.
// La vista (?ver=&seg=) persiste en la URL para compartir. El mapa codigo->id de proyecto permite
// enlazar el chip verde al proyecto sin tocar el RPC (proyectos ya presentes en el pipeline).
export default async function ConvertedCasesPage({ searchParams }: { searchParams: Promise<{ ver?: string; seg?: string }> }) {
  const sp = await searchParams;
  const ctx = await getContext();
  if (!ctx) return null;
  const cases = await getConvertedCases(ctx.supabase);

  const codes = Array.from(new Set(cases.map((c) => c.project_code).filter(Boolean))) as string[];
  const projectIds: Record<string, string> = {};
  if (codes.length) {
    const { data } = await ctx.supabase.from("project").select("id, project_code").in("project_code", codes);
    for (const p of (data ?? []) as { id: string; project_code: string }[]) projectIds[p.project_code] = p.id;
  }

  return (
    <ConvertedCasesView
      cases={cases}
      projectIds={projectIds}
      initialVer={normDim(sp.ver, "converted_to")}
      initialSeg={normDim(sp.seg, "status")}
    />
  );
}
