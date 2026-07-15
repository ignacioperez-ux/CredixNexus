"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import type { VendorData, VendorRow, VendorScorecardRow } from "@/lib/vendors/queries";
import { CriticalityBadge, VendorStatusBadge } from "./badges";
import { Icon } from "@/components/ui/icon";
import { useListFilters, FilterBar, useGrouping, GroupBar, EmptyState, type FilterDef } from "@/components/common/filters";

const CRIT_RANK: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
const CSS = `
.vl { display:flex; flex-direction:column; gap:16px; }
.vl .vl-head { display:flex; align-items:center; gap:10px; flex-wrap:wrap; background:var(--card); border:1px solid var(--line); border-radius:var(--r-xl); box-shadow:var(--sh-card); padding:12px 18px; }
.vl .vl-wrap { overflow-x:auto; }
.vl .vl-t { width:100%; border-collapse:separate; border-spacing:0; font-size:12.5px; }
.vl .vl-t th { position:sticky; top:0; background:var(--card); z-index:2; text-align:left; font-size:10.5px; font-weight:700; text-transform:uppercase; letter-spacing:.4px; color:#8A948A; padding:10px 12px; white-space:nowrap; border-bottom:1px solid var(--line); }
.vl .vl-t th.vl-r { text-align:right; }
.vl .vl-t th.vl-first, .vl .vl-t td.vl-first { position:sticky; left:0; text-align:left; background:var(--card); max-width:260px; }
.vl .vl-t th.vl-first { z-index:3; }
.vl .vl-t td { padding:10px 12px; text-align:left; white-space:nowrap; color:var(--text); border-bottom:1px solid var(--line-soft,var(--line)); background:var(--card); vertical-align:middle; }
.vl .vl-t td.vl-r { text-align:right; font-family:var(--font-mono); font-variant-numeric:tabular-nums; }
.vl .vl-t tbody tr.vl-row { cursor:pointer; }
.vl .vl-t tbody tr.vl-row:nth-child(even) td { background:var(--paper); }
.vl .vl-t tbody tr.vl-row:hover td { background:var(--accent-soft); }
.vl .vl-t tr.vl-grp td { background:var(--head-bg); font-size:10.5px; font-weight:700; text-transform:uppercase; letter-spacing:.4px; color:var(--muted); padding:8px 12px; }
@media (max-width:960px){ .vl .vl-t .vl-hide { display:none; } }
`;

export function VendorList({ data, scorecard = [], canManage }: { data: VendorData; scorecard?: VendorScorecardRow[]; canManage: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const [view, setView] = useState<"lista" | "scorecard">("lista");
  const head: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "#8A948A", padding: "10px 12px", background: "var(--head-bg)" };

  const sc = new Map(scorecard.map((s) => [s.id, s]));
  const rank = (v: VendorRow) => sc.get(v.id)?.criticality_rank ?? CRIT_RANK[v.criticality] ?? 0;

  const defs: FilterDef<VendorRow>[] = [
    { key: "cat", label: t("vnd.col.category"), get: (v) => v.category, allLabel: t("inc.filter.allcat"), render: (v) => t(("vnd.cat." + v) as MessageKey) },
    { key: "crit", label: t("vnd.col.criticality"), get: (v) => v.criticality, allLabel: t("inc.filter.allcrit"), render: (v) => t(("vnd.crit." + v) as MessageKey) },
    { key: "status", label: t("vnd.col.status"), get: (v) => v.status, allLabel: t("inc.filter.allstatus"), render: (v) => t(("sla.st." + v) as MessageKey) },
  ];
  const f = useListFilters(data.vendors, defs);
  // Orden por defecto: criticidad DESC, luego # sistemas DESC (los que mas duelen, arriba).
  const sorted = [...f.filtered].sort((a, b) => rank(b) - rank(a) || b.system_count - a.system_count);
  const g = useGrouping(sorted, defs);

  function Row(v: VendorRow) {
    const s = sc.get(v.id);
    return (
      <tr key={v.id} className="vl-row" onClick={() => router.push(`/vendors/${v.id}`)}>
        <td className="vl-first">
          <div style={{ fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis" }}>{v.name}</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--accent-2)" }}>{v.code}</div>
        </td>
        <td className="vl-hide" style={{ color: "var(--muted)" }}>{t(("vnd.cat." + v.category) as MessageKey)}</td>
        <td><CriticalityBadge criticality={v.criticality} /></td>
        <td className="vl-r">{v.system_count}</td>
        <td title={t("vnd.signals.def")}>
          <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
            <Signal icon="alert" n={s?.open_incidents ?? 0} tone="var(--st-high-fg)" />
            <Signal icon="bell" n={s?.open_alerts ?? 0} tone="var(--st-high-fg)" />
            <Signal icon="scale" n={s?.open_disputes ?? 0} tone="var(--st-critical-fg)" />
          </div>
        </td>
        <td className="vl-hide"><VendorStatusBadge status={v.status} /></td>
      </tr>
    );
  }

  return (
    <div className="vl">
      <style>{CSS}</style>
      <div className="vl-head">
        <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 16, color: "var(--text)", margin: 0, whiteSpace: "nowrap" }}>{t("nav.vendors")}</h1>
        <InfoTip text={t("vnd.intro")} />
        <span style={{ fontSize: 12.5, color: "var(--muted)", flex: 1, minWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t("vnd.intro")}</span>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
          <div style={{ display: "flex", gap: 4, background: "var(--paper)", border: "1px solid var(--line)", borderRadius: "var(--r-pill)", padding: 3 }}>
            {(["lista", "scorecard"] as const).map((v) => (
              <button key={v} onClick={() => setView(v)} aria-pressed={view === v}
                style={{ padding: "5px 14px", borderRadius: "var(--r-pill)", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, background: view === v ? "var(--card)" : "transparent", color: view === v ? "var(--text)" : "var(--muted)" }}>
                {t(v === "lista" ? "vnd.view.list" : "vnd.view.scorecard")}
              </button>
            ))}
          </div>
          {canManage && <Link href="/vendors/new" style={{ fontSize: 12.5, fontWeight: 600, padding: "8px 14px", borderRadius: "var(--r-md)", background: "var(--cta-bg)", color: "var(--cta-fg)", textDecoration: "none" }}>+ {t("vnd.new")}</Link>}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
        <Kpi label={t("vnd.kpi.active")} value={String(data.stats.active)} />
        <Kpi label={t("vnd.kpi.critical")} value={String(data.stats.critical)} color="var(--st-critical-fg)" />
        <Kpi label={t("vnd.kpi.expiring")} value={String(data.stats.expiringSoon)} color={data.stats.expiringSoon > 0 ? "var(--st-high-fg)" : undefined} />
      </div>

      {view === "scorecard" ? (
        <Scorecard rows={scorecard} t={t} head={head} />
      ) : (
        <>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between" }}>
            <FilterBar defs={defs} filters={f} />
            <GroupBar defs={defs} groupKey={g.groupKey} setGroupKey={g.setGroupKey} label={t("flt.groupby")} allLabel={t("flt.nogroup")} />
          </div>

          <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", overflow: "hidden" }}>
            <div className="vl-wrap">
              <table className="vl-t">
                <thead>
                  <tr>
                    <th className="vl-first">{t("vnd.col.name")}</th>
                    <th className="vl-hide">{t("vnd.col.category")}</th>
                    <th>{t("vnd.col.criticality")}</th>
                    <th className="vl-r">{t("vnd.col.systems")}</th>
                    <th title={t("vnd.signals.def")}>{t("vnd.col.signals")}</th>
                    <th className="vl-hide">{t("vnd.col.status")}</th>
                  </tr>
                </thead>
                {sorted.length === 0 ? (
                  <tbody><tr><td colSpan={6} style={{ padding: 0 }}><EmptyState text={t("vnd.empty")} icon="database" /></td></tr></tbody>
                ) : g.groups ? (
                  g.groups.map((grp) => (
                    <tbody key={grp.value}>
                      <tr className="vl-grp"><td colSpan={6}>{grp.label} · {grp.rows.length}</td></tr>
                      {grp.rows.map(Row)}
                    </tbody>
                  ))
                ) : (
                  <tbody>{sorted.map(Row)}</tbody>
                )}
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Signal({ icon, n, tone }: { icon: string; n: number; tone: string }) {
  const on = n > 0;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums", fontSize: 11, fontWeight: 700, color: on ? tone : "var(--muted)", background: on ? "var(--paper)" : "transparent", border: `1px solid ${on ? "var(--line)" : "transparent"}`, borderRadius: 6, padding: "2px 6px" }}>
      <Icon name={icon} size={11} color={on ? tone : "var(--muted)"} />{n}
    </span>
  );
}

function InfoTip({ text }: { text: string }) {
  return <span title={text} tabIndex={0} aria-label={text} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 15, height: 15, borderRadius: "50%", border: "1px solid var(--muted)", color: "var(--muted)", fontSize: 10, fontWeight: 800, cursor: "help", flexShrink: 0, fontFamily: "var(--font-ui)", lineHeight: 1 }}>i</span>;
}

/** Scorecard de proveedores: senales objetivas por proveedor (dato real del RPC agregado). */
function Scorecard({ rows, t, head }: { rows: VendorScorecardRow[]; t: (k: MessageKey) => string; head: React.CSSProperties }) {
  const cols = [
    { h: t("vnd.col.name"), w: "1.5fr", align: "left" as const },
    { h: t("vnd.col.criticality"), w: "110px", align: "left" as const },
    { h: t("vnd.col.systems"), w: "80px", align: "right" as const },
    { h: t("vsc.openinc"), w: "90px", align: "right" as const },
    { h: t("vsc.inc90"), w: "80px", align: "right" as const },
    { h: t("vsc.alerts"), w: "80px", align: "right" as const },
    { h: t("vsc.disputes"), w: "80px", align: "right" as const },
    { h: t("vsc.expiry"), w: "110px", align: "right" as const },
  ];
  return (
    <div>
      <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 10 }}>{t("vsc.hint")}</div>
      <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: cols.map((c) => c.w).join(" "), minWidth: 820 }}>
            {cols.map((c) => <div key={c.h} style={{ ...head, textAlign: c.align }}>{c.h}</div>)}
            {rows.length === 0 && <EmptyState text={t("vnd.empty")} icon="database" />}
            {rows.map((v) => <ScorecardRow key={v.id} v={v} t={t} />)}
          </div>
        </div>
      </div>
    </div>
  );
}
function ScorecardRow({ v, t }: { v: VendorScorecardRow; t: (k: MessageKey) => string }) {
  const expiryTone = v.days_to_expiry == null ? undefined : v.days_to_expiry <= 0 ? "var(--st-critical-fg)" : v.days_to_expiry <= 90 ? "var(--st-high-fg)" : undefined;
  const expiryText = v.days_to_expiry == null ? "—" : v.days_to_expiry <= 0 ? t("vsc.expired") : `${v.days_to_expiry} ${t("vsc.days")}`;
  return (
    <Link href={`/vendors/${v.id}`} className="cx-row" style={{ display: "contents", textDecoration: "none" }}>
      <SCell align="left"><div><div style={{ fontWeight: 600, color: "var(--text)" }}>{v.name}</div><div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--accent-2)" }}>{v.code}</div></div></SCell>
      <SCell align="left"><CriticalityBadge criticality={v.criticality} /></SCell>
      <SCell align="right" mono>{v.systems}</SCell>
      <SCell align="right" mono tone={v.open_incidents > 0 ? "var(--st-high-fg)" : undefined}>{v.open_incidents}</SCell>
      <SCell align="right" mono muted>{v.incidents_90d}</SCell>
      <SCell align="right" mono tone={v.open_alerts > 0 ? "var(--st-high-fg)" : undefined}>{v.open_alerts}</SCell>
      <SCell align="right" mono tone={v.open_disputes > 0 ? "var(--st-critical-fg)" : undefined}>{v.open_disputes}</SCell>
      <SCell align="right" mono tone={expiryTone}>{expiryText}</SCell>
    </Link>
  );
}
function SCell({ children, align, mono, muted, tone }: { children: React.ReactNode; align: "left" | "right"; mono?: boolean; muted?: boolean; tone?: string }) {
  return <div style={{ fontSize: 12.5, padding: "11px 12px", borderTop: "1px solid var(--line-soft)", display: "flex", alignItems: "center", justifyContent: align === "right" ? "flex-end" : "flex-start", fontFamily: mono ? "var(--font-mono)" : "var(--font-ui)", fontVariantNumeric: mono ? "tabular-nums" : undefined, color: tone ?? (muted ? "var(--muted)" : "var(--text)") }}>{children}</div>;
}
function Kpi({ label, value, color }: { label: string; value: string; color?: string }) {
  return <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", boxShadow: "var(--sh-card)", padding: 16 }}>
    <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--muted)", marginBottom: 10 }}>{label}</div>
    <div style={{ fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums", fontWeight: 500, fontSize: 22, letterSpacing: "-1px", color: color ?? "var(--text)" }}>{value}</div></div>;
}
