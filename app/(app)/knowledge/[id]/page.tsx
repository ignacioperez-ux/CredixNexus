import { notFound } from "next/navigation";
import { getContext } from "@/lib/auth/context";
import { getAccessControl } from "@/lib/auth/session";
import { getArticle } from "@/lib/knowledge/queries";
import { recordKbEvent } from "@/lib/knowledge/actions";
import { ArticleView } from "@/components/knowledge/article-view";

export default async function ArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getContext();
  if (!ctx) return null;
  const [detail, access] = await Promise.all([
    getArticle(ctx.supabase, id, ctx.accountId),
    getAccessControl(),
  ]);
  if (!detail) notFound();
  const canManage = access.isAdmin || access.perms.includes("knowledge.manage");
  const canFeedback = access.isAdmin || access.perms.includes("knowledge.feedback");
  // Metricas de operacion: solo staff (curador o agente); el usuario final (partner) no las ve.
  const showOps = canManage || access.perms.includes("incident.read");
  // Registrar vista (telemetria de uso).
  await recordKbEvent(id, "view", "kb");
  return <ArticleView detail={detail} canManage={canManage} canFeedback={canFeedback} showOps={showOps} />;
}
