import { notFound } from "next/navigation";
import { getContext, hasPermission } from "@/lib/auth/context";
import { getArticle } from "@/lib/knowledge/queries";
import { recordKbEvent } from "@/lib/knowledge/actions";
import { ArticleView } from "@/components/knowledge/article-view";

export default async function ArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getContext();
  if (!ctx) return null;
  const [detail, canManage, canFeedback] = await Promise.all([
    getArticle(ctx.supabase, id, ctx.accountId),
    hasPermission(ctx.supabase, "knowledge.manage"),
    hasPermission(ctx.supabase, "knowledge.feedback"),
  ]);
  if (!detail) notFound();
  // Registrar vista (telemetria de uso).
  await recordKbEvent(id, "view", "kb");
  return <ArticleView detail={detail} canManage={canManage} canFeedback={canFeedback} />;
}
