"use client";

import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import type { DxData, DxRow } from "@/lib/observability/queries";
import { DxStatusBadge } from "./badges";
import { useListFilters, FilterBar, Drill, type FilterDef } from "@/components/common/filters";

export function DxTab({ data }: { data: DxData }) {
  const { t, locale } = useI18n();
  const head: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "#8A948A", padding: "10px 12px", background: "var(--head-bg)" };

  const defs: FilterDef<DxRow>[] = [
    { key: "channel", label: t("obs.dx.col.channel"), get: (e) => e.channel, allLabel: t("obs.filter.allchannel") },
    { key: "journey", label: t("obs.dx.col.journey"), get: (e) => e.journey_name, allLabel: t("obs.filter.alljourney") },
    { key: "status", label: t("obs.dx.col.status"), get: (e) => e.status, allLabel: t("obs.filter.allstatus"), render: (v) => t(("obs.dx." + v) as MessageKey) },
  ];
  const f = useListFilters(data.events, defs);
  const maxErr = Math.max(1, ...data.byJourney.map((j) => j.error_pct));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("obs.dx.intro")}</div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        <Kpi label={t("obs.kpi.events")} value={String(data.stats.events)} />
        <Kpi label={t("obs.kpi.errorpct")} value={`${data.stats.error_pct}%`} color={data.stats.error_pct > 0 ? "var(--st-critical-fg)" : undefined} />
        <Kpi label={t("obs.kpi.slowpct")} value={`${data.stats.slow_pct}%`} color={data.stats.slow_pct > 0 ? "var(--st-high-fg)" : undefined} />
        <Kpi label={t("obs.kpi.avgms")} value={`${data.stats.avg_ms}ms`} />
      </div>

      {/* Salud por recorrido */}
      <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 20 }}>
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, color: "var(--text)", marginBottom: 12 }}>{t("obs.dx.journeys")}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {data.byJourney.length === 0 && <div style={{ fontSize: 12.5, color: "var(--muted)" }}>—</div>}
          {data.byJourney.map((j) => (
            <div key={j.journey} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 12, color: "var(--text)", width: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{j.journey}</span>
              <div style={{ flex: 1, height: 8, background: "var(--paper)", borderRadius: 4, overflow: "hidden" }}><div style={{ width: `${(j.error_pct / maxErr) * 100}%`, height: "100%", background: j.error_pct > 0 ? "var(--st-critical-fg)" : "var(--st-low-fg)" }} /></div>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)", width: 46, textAlign: "right" }}>{j.error_pct}%</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)", width: 60, textAlign: "right" }}>{j.avg_ms}ms</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)", width: 34, textAlign: "right" }}>{j.total}</span>
            </div>
          ))}
        </div>
      </div>

      <FilterBar defs={defs} filters={f} />

      <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "90px 1.2fr 1.2fr 100px 100px 150px 140px", minWidth: 940 }}>
            {[t("obs.dx.col.channel"), t("obs.dx.col.journey"), t("obs.dx.col.step"), t("obs.dx.col.status"), t("obs.dx.col.rt"), t("obs.dx.col.error"), t("obs.dx.col.when")].map((h) => <div key={h} style={head}>{h}</div>)}
            {f.filtered.length === 0 && <div style={{ gridColumn: "1 / -1", padding: 36, textAlign: "center", color: "var(--muted)" }}>{t("obs.dx.empty")}</div>}
            {f.filtered.map((e) => (
              <div key={e.id} style={{ display: "contents" }}>
                <Cell><Drill onClick={() => f.set("channel", e.channel)}>{e.channel}</Drill></Cell>
                <Cell muted>{e.journey_name ? <Drill onClick={() => f.set("journey", e.journey_name as string)}>{e.journey_name}</Drill> : "—"}</Cell>
                <Cell muted>{e.step_name ?? "—"}</Cell>
                <Cell><Drill onClick={() => f.set("status", e.status)}><DxStatusBadge status={e.status} /></Drill></Cell>
                <Cell mono muted>{e.response_time_ms && e.response_time_ms > 0 ? e.response_time_ms : "—"}</Cell>
                <Cell mono muted>{e.error_code ?? "—"}</Cell>
                <Cell mono muted>{new Date(e.occurred_at).toLocaleString(locale, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</Cell>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const cellSt: React.CSSProperties = { fontSize: 12.5, padding: "11px 12px", borderTop: "1px solid var(--line-soft)", display: "flex", alignItems: "center", color: "var(--text)" };
function Cell({ children, mono, muted }: { children: React.ReactNode; mono?: boolean; muted?: boolean }) {
  return <div style={{ ...cellSt, fontFamily: mono ? "var(--font-mono)" : "var(--font-ui)", color: muted ? "var(--muted)" : "var(--text)" }}>{children}</div>;
}
function Kpi({ label, value, color }: { label: string; value: string; color?: string }) {
  return <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 16 }}>
    <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--muted)", marginBottom: 10 }}>{label}</div>
    <div style={{ fontFamily: "var(--font-mono)", fontWeight: 500, fontSize: 22, letterSpacing: "-1px", color: color ?? "var(--text)" }}>{value}</div></div>;
}
