"use client";

import { Icon } from "@/components/ui/icon";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import type { AtRiskData } from "@/lib/sla/queries";
import { runEscalations } from "@/lib/sla/actions";
import { BucketBadge } from "./bucket-badge";

export function RiskTab({ data, canManage }: { data: AtRiskData; canManage: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const head: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "#8A948A", padding: "10px 12px", background: "var(--head-bg)" };

  function evaluate() {
    setMsg(null);
    start(async () => {
      const r = await runEscalations();
      if (!r.ok) setMsg(r.error ?? "error");
      else {
        setMsg(t("sla.eval.done").replace("{n}", String(r.count ?? 0)));
        router.refresh();
      }
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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

      <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "120px 1.6fr 90px 160px 160px 130px", minWidth: 900 }}>
            {[t("sla.col.number"), t("sla.col.title"), t("sla.col.priority"), t("sla.col.response"), t("sla.col.resolution"), t("sla.col.overall")].map((h) => (
              <div key={h} style={head}>{h}</div>
            ))}
            {data.incidents.length === 0 && <div style={{ gridColumn: "1 / -1", padding: 36, textAlign: "center", color: "var(--muted)" }}>{t("sla.risk.empty")}</div>}
            {data.incidents.map((i) => (
              <Link key={i.id} href={`/incidents/${i.id}`} style={{ display: "contents", textDecoration: "none" }}>
                <Cell mono accent>{i.incident_number}</Cell>
                <Cell>{i.title}</Cell>
                <Cell mono muted>{i.priority.replace("p", "P").split("_")[0]}</Cell>
                <Cell><BucketBadge bucket={i.response_bucket} pct={i.response_pct} /></Cell>
                <Cell><BucketBadge bucket={i.resolution_bucket} pct={i.resolution_pct} /></Cell>
                <Cell><BucketBadge bucket={i.overall} /></Cell>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const cellSt: React.CSSProperties = { fontSize: 12.5, padding: "11px 12px", borderTop: "1px solid var(--line-soft)", display: "flex", alignItems: "center", color: "var(--text)" };
function Cell({ children, mono, accent, muted }: { children: React.ReactNode; mono?: boolean; accent?: boolean; muted?: boolean }) {
  return <div style={{ ...cellSt, fontFamily: mono ? "var(--font-mono)" : "var(--font-ui)", color: accent ? "var(--accent-2)" : muted ? "var(--muted)" : "var(--text)" }}>{children}</div>;
}
function Kpi({ label, value, color }: { label: string; value: string; color?: string }) {
  return <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 16 }}>
    <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--muted)", marginBottom: 10 }}>{label}</div>
    <div style={{ fontFamily: "var(--font-mono)", fontWeight: 500, fontSize: 22, letterSpacing: "-1px", color: color ?? "var(--text)" }}>{value}</div></div>;
}
