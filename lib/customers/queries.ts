import type { SupabaseClient } from "@supabase/supabase-js";

const OPEN = ["new", "triaged", "assigned", "in_progress", "waiting", "reopened", "in_evolution"];

export type CustomerRow = {
  id: string;
  display_name: string;
  segment: string | null;
  vip_flag: boolean;
  risk_level: string;
  tax_id: string | null;
  email: string | null;
  openCases: number;
  totalCases: number;
  lastInteraction: string | null;
};

export async function listCustomers(supabase: SupabaseClient): Promise<CustomerRow[]> {
  const [partiesRes, incRes] = await Promise.all([
    supabase.from("party").select("id, display_name, segment, vip_flag, risk_level, tax_id, email").eq("party_type", "person").eq("status", "active").order("display_name"),
    supabase.from("incident").select("affected_party_id, status, opened_at"),
  ]);
  const parties = (partiesRes.data ?? []) as Omit<CustomerRow, "openCases" | "totalCases" | "lastInteraction">[];
  const incidents = (incRes.data ?? []) as { affected_party_id: string | null; status: string; opened_at: string }[];

  return parties.map((p) => {
    const cases = incidents.filter((i) => i.affected_party_id === p.id);
    const last = cases.map((c) => c.opened_at).sort().at(-1) ?? null;
    return {
      ...p,
      openCases: cases.filter((c) => OPEN.includes(c.status)).length,
      totalCases: cases.length,
      lastInteraction: last,
    };
  });
}

export async function getCustomer360(supabase: SupabaseClient, id: string) {
  const [partyRes, casesRes] = await Promise.all([
    supabase.from("party").select("id, display_name, legal_name, segment, vip_flag, risk_level, tax_id, email, phone, status").eq("id", id).maybeSingle(),
    supabase
      .from("incident")
      .select("id, incident_number, title, status, case_type, opened_at, amount, currency, product:affected_product_id(name)")
      .eq("affected_party_id", id)
      .order("opened_at", { ascending: false }),
  ]);
  const cases = (casesRes.data ?? []) as unknown as {
    id: string; incident_number: string; title: string; status: string; case_type: string; opened_at: string; amount: number | null; currency: string; product: { name: string } | null;
  }[];
  const products = [...new Set(cases.map((c) => c.product?.name).filter(Boolean))] as string[];
  return {
    party: partyRes.data,
    cases,
    products,
    openCases: cases.filter((c) => OPEN.includes(c.status)).length,
    totalCases: cases.length,
  };
}

// ---- Enmascaramiento PII (§3.4) ----
export function maskTaxId(v: string | null): string {
  if (!v) return "—";
  const clean = v.replace(/[^0-9]/g, "");
  return clean.length <= 4 ? "••••" : v.slice(0, 2) + "••••" + v.slice(-2);
}
export function maskEmail(v: string | null): string {
  if (!v || !v.includes("@")) return "—";
  const [u, d] = v.split("@");
  return (u[0] ?? "") + "•••@" + d;
}
export function maskPhone(v: string | null): string {
  if (!v) return "—";
  return v.replace(/\d(?=\d{2})/g, "•");
}
