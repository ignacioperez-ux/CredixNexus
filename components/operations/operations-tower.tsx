"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { Icon } from "@/components/ui/icon";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import type { OperationsTower as TowerData, OpsDecision, OpsPipelineStage, OpsKpis } from "@/lib/operations/queries";

// Torre de Control de Operaciones. Decision primero (bandeja priorizada con CTA que navega con
// filtro), luego inventario (pipeline + KPIs). Datos reales del servidor; solo presentacion aqui.
// Tokens del design system (temas Nexus/Claro), numeros en mono, ceros atenuados, cero desborde.

const DECISION_META: Record<OpsDecision["kind"], { label: MessageKey; cta: MessageKey; icon: string }> = {
  mi_comm:    { label: "op.tw.d.mi",     cta: "op.tw.cta.warroom",   icon: "alert" },
  sla_breach: { label: "op.tw.d.sla",    cta: "op.tw.cta.intervene", icon: "flag" },
  intake:     { label: "op.tw.d.intake", cta: "op.tw.cta.admit",     icon: "inbox" },
  assign:     { label: "op.tw.d.assign", cta: "op.tw.cta.assign",    icon: "user" },
  derive:     { label: "op.tw.d.derive", cta: "op.tw.cta.derive",    icon: "zap" },
};

export function OperationsTower({ tower, firstName }: { tower: TowerData; firstName: string }) {
  const { t, locale } = useI18n();
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);

  const greet = now
    ? t(now.getHours() < 12 ? "op.tw.greet.morning" : now.getHours() < 19 ? "op.tw.greet.afternoon" : "op.tw.greet.evening")
    : "";
  const dateStr = now ? new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long" }).format(now) : "";
  const { status, decisions, pipeline, kpis } = tower;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 1280 }}>
      {/* Saludo + linea de estado calculada */}
      <header style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", margin: 0, letterSpacing: "-0.2px" }}>
          {greet ? `${greet}, ${firstName}` : firstName}
        </h1>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", fontSize: 12.5, color: "var(--muted)" }}>
          {dateStr && <span style={{ textTransform: "capitalize" }}>{dateStr}</span>}
          <StatusLine status={status} />
        </div>
      </header>

      {/* Requiere tu decision */}
      <section style={card()}>
        <SectionTitle icon="flag" title={t("op.tw.decide.title")} count={decisions.length} />
        {decisions.length === 0 ? (
          <EmptyState text={t("op.tw.decide.empty")} />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {decisions.map((d) => <DecisionRow key={d.kind} d={d} t={t} />)}
          </div>
        )}
      </section>

      {/* Pipeline operativo del caso */}
      <section style={card()}>
        <SectionTitle icon="activity" title={t("op.tw.pipeline.title")} />
        <Pipeline stages={pipeline} t={t} />
      </section>

      {/* KPIs ITSM */}
      <section style={card()}>
        <SectionTitle icon="scale" title={t("op.tw.kpis.title")} />
        <Kpis kpis={kpis} t={t} />
      </section>
    </div>
  );
}

function StatusLine({ status }: { status: TowerData["status"] }) {
  const parts: { n: number; label: string; danger?: boolean }[] = [
    { n: status.pendingIntake, label: "op.tw.status.pendingIntake" as string },
    { n: status.unassigned, label: "op.tw.status.unassigned" },
    { n: status.slaBreached, label: "op.tw.status.slaBreached", danger: true },
    { n: status.miCommOverdue, label: "op.tw.status.miOverdue", danger: true },
  ];
  const { t } = useI18n();
  const anyAlert = status.slaBreached + status.miCommOverdue + status.unassigned + status.pendingIntake > 0;
  if (!anyAlert) return <span style={{ color: "var(--st-low-fg)" }}>{t("op.tw.status.allClear")}</span>;
  return (
    <span style={{ display: "inline-flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
      {parts.map((p, i) => (
        <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          {i > 0 && <span style={{ color: "var(--line)" }}>·</span>}
          <b style={{ fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums", opacity: p.n === 0 ? 0.4 : 1, color: p.danger && p.n > 0 ? "var(--st-critical-fg)" : "var(--text)" }}>{p.n}</b>
          <span style={{ opacity: p.n === 0 ? 0.5 : 0.85 }}>{t(p.label as MessageKey)}</span>
        </span>
      ))}
    </span>
  );
}

function DecisionRow({ d, t }: { d: OpsDecision; t: (k: MessageKey) => string }) {
  const meta = DECISION_META[d.kind];
  const red = d.severity === "red";
  const bg = red ? "var(--st-critical-bg)" : "var(--st-high-bg)";
  const fg = red ? "var(--st-critical-fg)" : "var(--st-high-fg)";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 10, background: bg, border: `1px solid ${fg}22` }}>
      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: 8, background: "var(--card)", color: fg, flexShrink: 0 }}>
        <Icon name={meta.icon} size={16} color={fg} />
      </span>
      <span style={{ fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums", fontSize: 18, fontWeight: 800, color: fg, minWidth: 30, textAlign: "right" }}>{d.count}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t(meta.label)}</div>
        {d.oldestDays != null && d.oldestDays > 0 && (
          <div style={{ fontSize: 11, color: "var(--muted)" }}>{t("op.tw.oldest")}: {d.oldestDays} d</div>
        )}
      </div>
      <Link href={d.link} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 13px", borderRadius: 8, background: red ? "var(--accent)" : "var(--card)", color: red ? "var(--on-accent)" : fg, border: red ? "none" : `1px solid ${fg}55`, fontSize: 12.5, fontWeight: 700, textDecoration: "none", flexShrink: 0, whiteSpace: "nowrap" }}>
        {t(meta.cta)}
        <Icon name="chevron-right" size={13} color={red ? "var(--on-accent)" : fg} />
      </Link>
    </div>
  );
}

function Pipeline({ stages, t }: { stages: OpsPipelineStage[]; t: (k: MessageKey) => string }) {
  const link = (key: string) => (key === "in_evolution" ? "/casos-convertidos" : `/incidents?status=${key}`);
  return (
    <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 }}>
      {stages.map((s, i) => {
        const evo = s.key === "in_evolution";
        return (
          <div key={s.key} style={{ display: "flex", alignItems: "stretch", gap: 6, minWidth: 0, flex: "1 1 0" }}>
            <Link href={link(s.key)} style={{ flex: 1, minWidth: 96, display: "flex", flexDirection: "column", gap: 3, padding: "10px 12px", borderRadius: 10, background: evo ? "var(--teal-soft)" : "var(--head-bg)", border: `1px solid ${evo ? "var(--teal)" : "var(--line)"}44`, textDecoration: "none" }}>
              <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.3px", textTransform: "uppercase", color: evo ? "var(--teal)" : "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t(`op.tw.st.${s.key}` as MessageKey)}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums", fontSize: 24, fontWeight: 800, lineHeight: 1, color: s.count === 0 ? "var(--muted)" : "var(--text)", opacity: s.count === 0 ? 0.4 : 1 }}>{s.count}</span>
              <span style={{ fontSize: 10, color: "var(--muted)", opacity: s.maxAgeDays > 0 ? 0.9 : 0 }}>{t("op.tw.maxage")} {s.maxAgeDays} d</span>
            </Link>
            {i < stages.length - 1 && !evo && (
              <span style={{ alignSelf: "center", color: "var(--line)", flexShrink: 0 }}><Icon name="chevron-right" size={14} color="var(--muted)" /></span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Kpis({ kpis, t }: { kpis: OpsKpis; t: (k: MessageKey) => string }) {
  const pct = (v: number | null) => (v == null ? "—" : `${v}%`);
  const items: { label: MessageKey; def: MessageKey; value: string; tone: "good" | "warn" | "bad" | "neutral" }[] = [
    { label: "op.tw.k.sla", def: "op.tw.k.sla.def", value: pct(kpis.slaCompliancePct), tone: kpis.slaCompliancePct == null ? "neutral" : kpis.slaCompliancePct >= 90 ? "good" : kpis.slaCompliancePct >= 75 ? "warn" : "bad" },
    { label: "op.tw.k.backlog", def: "op.tw.k.backlog.def", value: String(kpis.backlogOpen), tone: "neutral" },
    { label: "op.tw.k.unassigned", def: "op.tw.k.unassigned.def", value: pct(kpis.unassignedPct), tone: kpis.unassignedPct == null ? "neutral" : kpis.unassignedPct > 30 ? "bad" : kpis.unassignedPct > 10 ? "warn" : "good" },
    { label: "op.tw.k.mttr", def: "op.tw.k.mttr.def", value: kpis.mttrHours == null ? "—" : `${kpis.mttrHours} h`, tone: "neutral" },
    { label: "op.tw.k.csat", def: "op.tw.k.csat.def", value: kpis.csat == null ? "—" : String(kpis.csat), tone: kpis.csat == null ? "neutral" : kpis.csat >= 4 ? "good" : kpis.csat >= 3 ? "warn" : "bad" },
  ];
  const toneColor = (tone: string) => tone === "good" ? "var(--st-low-fg)" : tone === "warn" ? "var(--st-high-fg)" : tone === "bad" ? "var(--st-critical-fg)" : "var(--text)";
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
      {items.map((k) => (
        <div key={k.label} title={t(k.def)} style={{ display: "flex", flexDirection: "column", gap: 4, padding: "12px 14px", borderRadius: 10, background: "var(--head-bg)", border: "1px solid color-mix(in srgb, var(--line) 60%, transparent)" }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t(k.label)}</span>
          <span style={{ fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums", fontSize: 26, fontWeight: 800, lineHeight: 1, color: toneColor(k.tone) }}>{k.value}</span>
        </div>
      ))}
    </div>
  );
}

function SectionTitle({ icon, title, count }: { icon: string; title: string; count?: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
      <Icon name={icon} size={16} color="var(--accent)" />
      <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", margin: 0 }}>{title}</h2>
      {count != null && count > 0 && (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: "var(--accent)", background: "var(--accent-soft)", borderRadius: 20, padding: "1px 8px" }}>{count}</span>
      )}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "16px 12px", color: "var(--st-low-fg)", fontSize: 13 }}>
      <Icon name="check" size={16} color="var(--st-low-fg)" />
      {text}
    </div>
  );
}

function card(): React.CSSProperties {
  return { background: "var(--card)", borderRadius: 14, padding: "16px 18px", boxShadow: "var(--sh-card)", border: "1px solid color-mix(in srgb, var(--line) 50%, transparent)" };
}
