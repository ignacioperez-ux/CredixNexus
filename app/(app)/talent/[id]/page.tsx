import { notFound } from "next/navigation";
import { getContext } from "@/lib/auth/context";
import { getAccessControl } from "@/lib/auth/session";
import { getMemberDetail, getTalentOptions } from "@/lib/talent/queries";
import { MemberDetail } from "@/components/talent/member-detail";

export default async function MemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getContext();
  if (!ctx) return null;

  const [detail, options, access] = await Promise.all([
    getMemberDetail(ctx.supabase, id),
    getTalentOptions(ctx.supabase),
    getAccessControl(),
  ]);
  if (!detail) notFound();

  const canManage = access.isAdmin || access.perms.includes("talent.manage");
  return <MemberDetail detail={detail} options={options} canManage={canManage} />;
}
