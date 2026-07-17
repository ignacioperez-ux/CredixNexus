import { notFound } from "next/navigation";
import { getContext } from "@/lib/auth/context";
import { getMyCase, getMyCaseThread, getMyCaseSurvey, getMyCaseAttachments } from "@/lib/portal/case-queries";
import { UserCaseDetail } from "@/components/portal/user-case-detail";

// Detalle de caso PROPIO del usuario (P2). Ruta bajo /portal (libre): el acceso NO depende de
// incident.read; la propiedad la impone la RPC get_my_case (reported_by_user_id = cuenta actual).
export default async function MyCasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getContext();
  if (!ctx) return null;
  const detail = await getMyCase(ctx.supabase, id);
  if (!detail) notFound();
  const [thread, survey, attachments] = await Promise.all([
    getMyCaseThread(ctx.supabase, id),
    getMyCaseSurvey(ctx.supabase, id),
    getMyCaseAttachments(ctx.supabase, id, ctx.accountId),
  ]);
  return <UserCaseDetail detail={detail} thread={thread} survey={survey} attachments={attachments} />;
}
