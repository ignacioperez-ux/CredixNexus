"use client";

import { Icon } from "@/components/ui/icon";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import type { AtRiskData, AtRiskIncident } from "@/lib/sla/queries";
import { runEscalations } from "@/lib/sla/actions";
import { bucketRank, agingBucketOf, type AgingBucket } from "@/lib/sla/thresholds";
import { BucketBadge } from "./bucket-badge";
import { SlaClock } from "./sla-clock";

const PRIO_RANK: Record<string, number> = { p1_critical: 0, p2_high: 1, p3_medium: 2, p4_low: 3 };
const AGING: AgingBucket[] = ["lt24", "d1_3", "d3_7", "gt7"];
type SortCol = "number" | "title" | "priority" | "response" | "resolution" | "overall" | "status";

export function RiskTab({ data, canManage }: { data: AtRiskData; canManage: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const [fPrio, setFPrio] = useState("");
  const [fSys, setFSys] = useState("");
  const [fResp, setFResp] = useState("");
  const [fClock, setFClock] = useState<"" | "atrisk" | "breached">("");
  const [aging, setAging] = useState<AgingBucket | "">("");
  const [sort, setSort] = useState<{ col: SortCol; dir: 1 | -1 }>({ col: "overall", dir: -1 });

  const prios = useMemo(() => [...new Set(data.incidents.map((i) => i.priority))].sort((a, b) => (PRIO_RANK[a] ?? 9) - (PRIO_RANK[b] ?? 9)), [data.incidents]);
  const systems = useMemo(() => [...new Set(data.incidents.map((i) => i.system).filter((x): x is string => !!x))].sort(), [data.incidents]);
  const resps = useMemo(() => [...new Set(data.incidents.map((i) => i.assigned_team).filter((x): x is string => !!x))].sort(), [data.incidents]);
  const agingCounts = useMemo(() => {
    const c: Record<AgingBucket, number> = { lt24: 0, d1_3: 0, d3_7: 0, gt7: 0 };
    for (const i of data.incidents) { const b = agingBucketOf(i.worstOverdueMs); if (b) c[b]++; }
    return c;
  }, [data.incidents]);

  const rows = useMemo(() => {
    const key = (i: AtRiskIncident): number | string => {
      switch (sort.col) {
        case "number": return i.incident_number;
        case "title": return i.title.toLowerCase();
        case "priority": return PRIO_RANK[i.priority] ?? 9;
        case "response": return i.response.rawPct ?? -1;
        case "resolution": return i.resolution.rawPct ?? -1;
        case "status": return i.status;
        default: return bucketRank(i.overall) * 100000 + (i.worstOverdueMs ?? i.resolution.rawPct ?? 0);
      }
    };
    return data.incidents
      .filter((i) => (!fPrio || i.priority === fPrio)
        && (!fSys || i.system === fSys)
        && (!fResp || i.assigned_team === fResp)
        && (!fClock || (fClock === "breached" ? i.overall === "breached" : i.overall === "warning" || i.overall === "critical"))
        && (!aging || agingBucketOf(i.worstOverdueMs) === aging))
      .sort((a, b) => {
        const ka = key(a), kb = key(b);
        const cmp = typeof ka === "number" && typeof kb === "number" ? ka - kb : String(ka).localeCompare(String(kb));
        return cmp * sort.dir;
      });
  }, [data.incidents, fPrio, fSys, fResp, fClock, aging, sort]);

  function evaluate() {
    setMsg(null);
    start(async () => {
      const r = await runEscalations();
      if (!r.ok) setMsg(r.error ?? "error");
      else { setMsg(t("sla.eval.done").replace("{n}", String(r.count ?? 0))); router.refresh(); }
    });
  }
  const toggleSort = (col: SortCol) => setSort((s) => (s.col === col ? { col, dir: (s.dir === 1 ? -1 : 1) as 1 | -1 } : { col, dir: 1 }));
  const ariaSort = (col: SortCol) => (sort.col === col ? (sort.dir === 1 ? "ascending" : "descending") : "none");

  const COLS = "110px minmax(160px, 1.5fr) 84px 168px 168px 116px 116px";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("sla.risk.intro")}</div>
        {canManage && (
          <button onClick={evaluate} disabled={pending}
            style={{ fontSize: 12.5, fontWeight: 600, padding: "8px 14px", borderRadius: "var(--r-md)", border: "none", background: "var(--cta-bg)", color: "var(--cta-fg)", cursor: pending ? "default" : "pointer" }}>
            {pending ? t("sla.eval.running") : <><Icon name="zap" size={13} style={{ verticalAlign: "-2px" }} /> {t("sla.eval.run")}</>}
          </button>
        )}
      </div>
      {msg && <div style={{ fontSize: 12, color: "var(--accent-2)" }}>{msg}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        <Kpi label={t("sla.kpi.atrisk")} value={String(data.stats.atRisk)} />
        <Kpi label={t("sla.kpi.warning")} value={String(data.stats.warning)} color="var(--st-medium-fg)" />
        <Kpi label={t("sla.kpi.critical")} value={String(data.stats.critical)} color="var(--st-high-fg)" />
        <Kpi label={t("sla.kpi.breached")} value={String(data.stats.breached)} color="var(--st-critical-fg)" />
      </div>

      {/* Chips de antiguedad del vencimiento (filtran) */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--muted)" }}>{t("sla.aging.title")}</span>
        {AGING.map((b) => {
          const active = aging === b;
          const n = agingCounts[b];
          return (
            <button key={b} onClick={() => setAging(active ? "" : b)} aria-pressed={active}
              style={{ fontSize: 11.5, fontWeight: 600, padding: "4px 10px", borderRadius: "var(--r-pill)", cursor: "pointer", border: `1px solid ${active ? "var(--st-critical-fg)" : "var(--line)"}`, background: active ? "var(--st-critical-bg)" : "var(--card)", color: n === 0 && !active ? "var(--muted)" : active ? "var(--st-critical-fg)" : "var(--text)", opacity: n === 0 && !active ? 0.55 : 1 }}>
              {t(("sla.aging." + b) as MessageKey)} <span style={{ fontFamily: "var(--font-mono)" }}>{n}</span>
            </button>
          );
        })}
      </div>

      {/* Filtros */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Select label={t("sla.filter.priority")} value={fPrio} onChange={setFPrio} all={t("sla.filter.all")}
          options={prios.map((p) => ({ value: p, label: p.replace("p", "P").split("_")[0] }))} />
        <Select label={t("sla.filter.system")} value={fSys} onChange={setFSys} all={t("sla.filter.all")}
          options={systems.map((s) => ({ value: s, label: s }))} />
        <Select label={t("sla.filter.responsible")} value={fResp} onChange={setFResp} all={t("sla.filter.all")}
          options={resps.map((r) => ({ value: r, label: r }))} />
        <Select label={t("sla.filter.clock")} value={fClock} onChange={(v) => setFClock(v as typeof fClock)} all={t("sla.filter.all")}
          options={[{ value: "atrisk", label: t("sla.clockstate.atrisk") }, { value: "breached", label: t("sla.clockstate.breached") }]} />
      </div>

      <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: COLS, minWidth: 920 }}>
            <Th col="number" label={t("sla.col.number")} sort={sort} onSort={toggleSort} aria={ariaSort("number")} sticky />
            <Th col="title" label={t("sla.col.title")} sort={sort} onSort={toggleSort} aria={ariaSort("title")} />
            <Th col="priority" label={t("sla.col.priority")} sort={sort} onSort={toggleSort} aria={ariaSort("priority")} />
            <Th col="response" label={t("sla.col.response")} sort={sort} onSort={toggleSort} aria={ariaSort("response")} />
            <Th col="resolution" label={t("sla.col.resolution")} sort={sort} onSort={toggleSort} aria={ariaSort("resolution")} />
            <Th col="overall" label={t("sla.col.overall")} sort={sort} onSort={toggleSort} aria={ariaSort("overall")} />
            <Th col="status" label={t("sla.col.status")} sort={sort} onSort={toggleSort} aria={ariaSort("status")} />

            {rows.length === 0 && <div style={{ gridColumn: "1 / -1", padding: 36, textAlign: "center", color: "var(--muted)" }}>{t("sla.risk.empty")}</div>}
            {rows.map((i) => (
              <Link key={i.id} href={`/incidents/${i.id}`} style={{ display: "contents", textDecoration: "none" }}>
                <Cell mono accent sticky>{i.incident_number}</Cell>
                <Cell title={i.title}>{i.title}</Cell>
                <Cell mono muted>{i.priority.replace("p", "P").split("_")[0]}</Cell>
                <Cell><SlaClock clock={i.response} /></Cell>
                <Cell><SlaClock clock={i.resolution} /></Cell>
                <Cell><BucketBadge bucket={i.overall} /></Cell>
                <Cell><span style={{ fontSize: 11.5, color: "var(--muted)" }}>{t(("sla.istatus." + i.status) as MessageKey)}</span></Cell>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const headSt: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "var(--muted)", padding: "10px 12px", background: "var(--head-bg)", display: "flex", alignItems: "center", gap: 5, cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" };
function Th({ col, label, sort, onSort, aria, sticky }: { col: SortCol; label: string; sort: { col: SortCol; dir: 1 | -1 }; onSort: (c: SortCol) => void; aria: "ascending" | "descending" | "none"; sticky?: boolean }) {
  const active = sort.col === col;
  return (
    <div role="columnheader" aria-sort={aria} onClick={() => onSort(col)}
      style={{ ...headSt, ...(sticky ? { position: "sticky", left: 0, zIndex: 2 } : {}) }}>
      {label}
      <Icon name={active ? (sort.dir === 1 ? "chevron-up" : "chevron-down") : "chevron-down"} size={12} color={active ? "var(--accent)" : "var(--line)"} />
    </div>
  );
}

const cellSt: React.CSSProperties = { fontSize: 12.5, padding: "11px 12px", borderTop: "1px solid var(--line-soft)", display: "flex", alignItems: "center", color: "var(--text)", minWidth: 0 };
function Cell({ children, mono, accent, muted, sticky, title }: { children: React.ReactNode; mono?: boolean; accent?: boolean; muted?: boolean; sticky?: boolean; title?: string }) {
  return (
    <div title={title} style={{ ...cellSt, fontFamily: mono ? "var(--font-mono)" : "var(--font-ui)", color: accent ? "var(--accent-2)" : muted ? "var(--muted)" : "var(--text)", ...(sticky ? { position: "sticky", left: 0, zIndex: 1, background: "var(--card)" } : {}), ...(title ? { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block", lineHeight: "1.9" } : {}) }}>{children}</div>
  );
}
function Kpi({ label, value, color }: { label: string; value: string; color?: string }) {
  return <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 16 }}>
    <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--muted)", marginBottom: 10 }}>{label}</div>
    <div style={{ fontFamily: "var(--font-mono)", fontWeight: 500, fontSize: 22, letterSpacing: "-1px", color: color ?? "var(--text)" }}>{value}</div></div>;
}
function Select({ label, value, onChange, options, all }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; all: string }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.4px", color: "var(--muted)" }}>
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)}
        style={{ fontSize: 12.5, fontWeight: 500, textTransform: "none", letterSpacing: 0, padding: "7px 10px", borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: "var(--card)", color: "var(--text)", minWidth: 130, cursor: "pointer" }}>
        <option value="">{all}</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}
