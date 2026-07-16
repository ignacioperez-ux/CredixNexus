import { getContext } from "@/lib/auth/context";
import { getMyProfile } from "@/lib/squad-member/queries";
import { MyProfileView } from "@/components/squad-member/my-profile";

// Mi perfil (solo lectura): asignaciones vigentes, competencias, evaluaciones propias. La edicion
// vive en Talento (gerente) y chapters. Chapter (MembresiaChapter) degrada si no esta cargado.
export default async function MiPerfilPage() {
  const ctx = await getContext();
  if (!ctx) return null;
  const profile = await getMyProfile(ctx.supabase, ctx.accountId);
  return <MyProfileView profile={profile} />;
}
