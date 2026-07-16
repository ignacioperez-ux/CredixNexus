"use client";

import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import { Icon } from "@/components/ui/icon";
import { scoreColor } from "@/lib/incidents/labels";
import { InfoTip } from "@/components/help/info-tip";
import type { OpPerformance } from "@/lib/operador/queries";

export function OpPerformanceView({ perf }: { perf: OpPerformance }) {
  const { t, locale } = useI18n();
  if (!perf.memberId) return <div style={{ padding: "60px 20px", textAlign: "center", color: "var(--muted)" }}>{t("op.nomember.hint")}</div>;

  const slaColor = (v: number | null) => v == null ? "var(--text)" : v >= 90 ? "var(--st-low-fg)" : v >= 75 ? "var(--st-high-fg)" : "var(--st-critical-fg)";
  const utilColor = perf.util == null ? "var(--text)" : perf.util > 100 ? "var(--st-critical-fg)" : perf.util > 80 ? "var(--st-high-fg)" : "var(--st-low-fg)";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 1100 }}>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: "var(--text)", margin: 0 }}>{t("nav.midesempeno")}</h1>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Mis SLA */}
          <Card title={t("op.perf.sla")} tip="op.perf.sla.tip">
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
              <Metric label={t("op.perf.compliance")} value={perf.sla.compliancePct == null ? "—" : `${perf.sla.compliancePct}%`} color={slaColor(perf.sla.compliancePct)} />
              <Metric label={t("op.perf.mttr")} value={perf.sla.mttrHours == null ? "—" : `${perf.sla.mttrHours} h`} />
              <Metric label={t("op.perf.resolved30")} value={String(perf.sla.resolved30)} />
            </div>
          </Card>

          {/* Mi capacidad */}
          <Card title={t("op.perf.capacity")} tip="op.perf.capacity.tip">
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 8 }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 28, fontWeight: 800, color: utilColor }}>{perf.util == null ? perf.activeLoad : `${perf.util}%`}</span>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>{perf.capacity > 0 ? `${perf.activeLoad} / ${perf.capacity} ${t("op.perf.cap")}` : `${perf.activeLoad} ${t("op.perf.active")}`}</span>
            </div>
            <div style={{ height: 8, borderRadius: 4, background: "var(--track)", overflow: "hidden" }}>
              <div style={{ width: `${Math.min(100, perf.util ?? 0)}%`, height: "100%", background: utilColor, borderRadius: 4 }} />
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 8 }}>{t("op.perf.capacity.note")}</div>
          </Card>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Mis evaluaciones */}
          <Card title={t("op.perf.evals")} tip="op.perf.evals.tip">
            {perf.csat.avg != null && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>CSAT</span>
                <b style={{ fontFamily: "var(--font-mono)", fontSize: 18, color: scoreColor(perf.csat.avg * 20) }}>{perf.csat.avg}</b>
                <span style={{ fontSize: 11, color: "var(--muted)" }}>({perf.csat.count})</span>
              </div>
            )}
            {perf.evaluations.length === 0 && perf.csat.count === 0 ? <Muted t={t} k="op.perf.noevals" /> : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {perf.evaluations.slice(0, 4).map((e) => (
                  <div key={e.id} style={{ borderTop: "1px solid var(--line-soft)", paddingTop: 9 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      {e.performance_score != null && <Pill label={t("tal.effectiveness")} v={Number(e.performance_score)} />}
                      {e.empathy_score != null && <Pill label={t("tal.empathy")} v={Number(e.empathy_score)} />}
                      <span style={{ marginLeft: "auto", fontSize: 10.5, color: "var(--muted)" }}>{new Date(e.created_at).toLocaleDateString(locale)}</span>
                    </div>
                    {(e.strengths || e.comment) && <p style={{ margin: "5px 0 0", fontSize: 12, color: "var(--text)", lineHeight: 1.5 }}>{e.strengths || e.comment}</p>}
                    {e.development_areas && <p style={{ margin: "3px 0 0", fontSize: 11.5, color: "var(--muted)" }}>{t("op.perf.areas")}: {e.development_areas}</p>}
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Mis competencias */}
          <Card title={`${t("op.perf.skills")} (${perf.skills.length})`} tip="op.perf.skills.tip">
            {perf.skills.length === 0 ? <Muted t={t} k="op.perf.noskills" /> : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {perf.skills.map((s) => (
                  <div key={s.name} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ flex: 1, fontSize: 12.5, color: "var(--text)" }}>{s.name}</span>
                    <span style={{ display: "inline-flex", gap: 3 }}>{[1, 2, 3, 4, 5].map((i) => <span key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: i <= s.level ? "var(--accent-2)" : "var(--track)" }} />)}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function Card({ title, tip, children }: { title: string; tip?: MessageKey; children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 12 }}>
        <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, color: "var(--text)" }}>{title}</span>
        {tip && <InfoTip tip={tip} />}
      </div>
      {children}
    </div>
  );
}
function Metric({ label, value, color }: { label: string; value: string; color?: string }) {
  return <div><div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>{label}</div><div style={{ fontFamily: "var(--font-mono)", fontSize: 22, fontWeight: 800, color: color ?? "var(--text)" }}>{value}</div></div>;
}
function Muted({ t, k }: { t: (k: MessageKey) => string; k: string }) { return <div style={{ fontSize: 12, color: "var(--muted)" }}>{t(k as MessageKey)}</div>; }
function Pill({ label, v }: { label: string; v: number }) {
  return <span style={{ fontSize: 10.5, display: "inline-flex", alignItems: "center", gap: 5, padding: "2px 8px", borderRadius: "var(--r-pill)", background: "var(--paper)" }}><span style={{ color: "var(--muted)" }}>{label}</span><b style={{ fontFamily: "var(--font-mono)", color: scoreColor(v) }}>{v}</b></span>;
}
