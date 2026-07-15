"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/provider";
import { decideRecommendation } from "@/lib/rules/actions";
import type { RecommendationRow } from "@/lib/rules/queries";
import { scoreColor } from "@/lib/incidents/labels";
import { useListFilters, FilterBar, type FilterDef } from "@/components/common/filters";

export function RecommendationsQueue({ rows, canDecide = false }: { rows: RecommendationRow[]; canDecide?: boolean }) {
  const { t } = useI18n();
  const defs: FilterDef<RecommendationRow>[] = [
    { key: "status", label: t("inc.col.status"), get: (r) => r.recommendation_status, allLabel: t("inc.filter.allstatus") },
  ];
  const f = useListFilters(rows, defs);

  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 20 }}>
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, color: "var(--text)", marginBottom: 4 }}>{t("reco.title")}</div>
      <p style={{ margin: "0 0 14px", fontSize: 12, color: "var(--muted)" }}>{t("reco.decidedby")}</p>

      {rows.length > 0 && <div style={{ marginBottom: 14 }}><FilterBar defs={defs} filters={f} /></div>}

      {f.filtered.length === 0 ? (
        <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("reco.empty")}</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {f.filtered.map((r) => <RecoCard key={r.id} r={r} canDecide={canDecide} onFilterStatus={() => f.set("status", r.recommendation_status)} />)}
        </div>
      )}
    </div>
  );
}

function RecoCard({ r, canDecide, onFilterStatus }: { r: RecommendationRow; canDecide: boolean; onFilterStatus: () => void }) {
  const { t } = useI18n();
  const router = useRouter();
  const [priority, setPriority] = useState<string>(r.business_priority ? String(r.business_priority) : "");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // Solo el RC (recommendation.decide) ve los controles de decision; el resto, cola en solo-lectura.
  const pending = canDecide && (r.recommendation_status === "pending" || r.recommendation_status === "deferred");

  async function decide(status: "approved" | "rejected" | "deferred") {
    setErr(null);
    setBusy(true);
    const res = await decideRecommendation(r.id, status, priority ? Number(priority) : null, reason);
    setBusy(false);
    if (!res.ok) { setErr(res.error ?? "error"); return; }
    router.refresh();
  }

  return (
    <div style={{ border: "1px solid var(--line)", borderRadius: "var(--r-lg)", padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 18, fontWeight: 500, color: scoreColor(r.transformation_score) }}>{Math.round(r.transformation_score)}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{r.recommended_name}</div>
          {r.incident && (
            <Link href={`/incidents/${r.incident.id}`} style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent-2)", textDecoration: "none" }}>
              ◂ {r.incident.incident_number}
            </Link>
          )}
        </div>
        <span onClick={onFilterStatus} title={t("inc.filter.drill")} style={{ fontSize: 11, padding: "3px 10px", borderRadius: "var(--r-pill)", background: "var(--paper)", color: "var(--muted)", cursor: "pointer" }}>{r.recommendation_status}</span>
      </div>

      {pending ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <input type="number" min={1} placeholder={t("reco.priority")} value={priority} onChange={(e) => setPriority(e.target.value)}
            style={{ width: 130, padding: "7px 10px", borderRadius: "var(--r-sm)", border: "1px solid var(--line)", background: "var(--card)", color: "var(--text)", fontSize: 12, fontFamily: "var(--font-mono)" }} />
          <input placeholder={t("reco.reason")} value={reason} onChange={(e) => setReason(e.target.value)}
            style={{ flex: 1, minWidth: 160, padding: "7px 10px", borderRadius: "var(--r-sm)", border: "1px solid var(--line)", background: "var(--card)", color: "var(--text)", fontSize: 12 }} />
          <button onClick={() => decide("approved")} disabled={busy} style={btn("var(--accent)", "var(--on-accent)")}>{t("reco.approve")}</button>
          <button onClick={() => decide("deferred")} disabled={busy} style={btn("var(--card)", "var(--text)", true)}>{t("reco.defer")}</button>
          <button onClick={() => decide("rejected")} disabled={busy} style={btn("var(--card)", "var(--st-critical-fg)", true)}>{t("reco.reject")}</button>
          {err && <span style={{ fontSize: 11, color: "var(--st-critical-fg)" }}>{err === "ERR_REQUIRED_FIELD" ? t("err.ERR_REQUIRED_FIELD") : err}</span>}
        </div>
      ) : (
        <div style={{ fontSize: 12, color: "var(--muted)" }}>
          {r.business_priority && <span>{t("reco.priority")}: <b style={{ fontFamily: "var(--font-mono)", color: "var(--text)" }}>{r.business_priority}</b>. </span>}
          {r.review_reason}
        </div>
      )}
    </div>
  );
}

function btn(bg: string, fg: string, border = false): React.CSSProperties {
  return { padding: "7px 12px", borderRadius: "var(--r-md)", background: bg, color: fg, border: border ? "1px solid var(--line)" : "none", fontWeight: 700, fontSize: 12, cursor: "pointer" };
}
