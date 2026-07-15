import { getContext } from "@/lib/auth/context";
import { getConvertedCases } from "@/lib/evolution/queries";
import { ConvertedCasesView } from "@/components/evolution/converted-cases";

// Casos convertidos (sidebar, tras Portafolio): trazabilidad incidencia -> mejora/proyecto con
// toda la info, agrupacion por concepto y graficos que varian con las variables seleccionadas.
export default async function ConvertedCasesPage() {
  const ctx = await getContext();
  if (!ctx) return null;
  const cases = await getConvertedCases(ctx.supabase);
  return <ConvertedCasesView cases={cases} />;
}
