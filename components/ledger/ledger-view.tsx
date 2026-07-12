"use client";

import { Icon } from "@/components/ui/icon";

import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import type { LedgerData, LedgerEvent } from "@/lib/ledger/queries";
import { Drill } from "@/components/common/filters";

export function LedgerView({ data }: { data: LedgerData }) {
  const { t, locale } = useI18n();
  const [entity, setEntity] = useState("all");
  const [actor, setActor] = useState("all");

  const entities = useMemo(() => ["all", ...Array.from(new Set(data.events.map((e) => e.entity_type)))], [data.events]);
  const actors = useMemo(() => ["all", ...Array.from(new Set(data.events.map((e) => e.actor_type)))], [data.events]);

  const filtered = data.events.filter((e) => (entity === "all" || e.entity_type === entity) && (actor === "all" || e.actor_type === actor));
  const broken = data.stats.broken;

  function exportCsv() {
    const header = ["block_height", "timestamp", "actor_type", "action", "entity_type", "entity_id", "current_hash", "verified"];
    const lines = [header.join(",")].concat(
      filtered.map((e) => [e.block_height, e.timestamp, e.actor_type, e.action, e.entity_type, e.entity_id, e.current_hash, e.verified].join(",")),
    );
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "credix-ledger-audit.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
        <Kpi label={t("led.kpi.blocks")} value={data.stats.total} />
        <Kpi label={t("led.kpi.verified")} value={data.stats.verified} color="var(--st-low-fg)" />
        <Kpi label={t("led.kpi.broken")} value={broken} color={broken > 0 ? "var(--st-critical)" : "var(--muted)"} />
      </div>

      <div style={{ borderRadius: "var(--r-lg)", padding: "12px 16px", fontSize: 13,
        background: broken > 0 ? "var(--st-critical-bg)" : "var(--st-low-bg)",
        border: `1px solid ${broken > 0 ? "var(--st-critical)" : "var(--st-low)"}`,
        color: broken > 0 ? "var(--st-critical-fg)" : "var(--st-low-fg)" }}>
        {broken > 0 ? <><Icon name="x" size={13} style={{ verticalAlign: "-2px" }} /> {t("led.integrity_broken")}</> : <><Icon name="check" size={13} style={{ verticalAlign: "-2px" }} /> {t("led.integrity_ok")}</>}
      </div>

      <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", overflow: "hidden" }}>
        <div style={{ display: "flex", gap: 12, padding: "14px 20px", borderBottom: "1px solid var(--line)", alignItems: "center", flexWrap: "wrap" }}>
          <Select label={t("led.filter.entity")} value={entity} onChange={setEntity} options={entities} tAll={t("led.all")} />
          <Select label={t("led.filter.actor")} value={actor} onChange={setActor} options={actors} tAll={t("led.all")} />
          <div style={{ flex: 1 }} />
          <button onClick={exportCsv} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: "var(--r-md)", background: "var(--card)", border: "1px solid var(--line)", color: "var(--text)", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
            <Icon name="download" size={14} /> {t("led.export")}
          </button>
        </div>

        <div style={{ overflowX: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "70px 160px 100px 1.4fr 1.2fr 110px 60px", minWidth: 940 }}>
            {[t("led.col.block"), t("led.col.time"), t("led.col.actor"), t("led.col.action"), t("led.col.entity"), t("led.col.hash"), t("led.col.verified")].map((h, i) => (
              <div key={h} style={{ ...headSt, textAlign: i === 0 || i === 6 ? "right" : "left" }}>{h}</div>
            ))}
            {filtered.map((e) => <Row key={e.block_height} e={e} locale={locale} onActor={() => setActor(e.actor_type)} onEntity={() => setEntity(e.entity_type)} />)}
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ e, locale, onActor, onEntity }: { e: LedgerEvent; locale: string; onActor: () => void; onEntity: () => void }) {
  const cell: React.CSSProperties = { fontSize: 12, padding: "10px 12px", borderTop: "1px solid var(--line-soft)", color: "var(--text)", display: "flex", alignItems: "center", minWidth: 0 };
  const mono: React.CSSProperties = { ...cell, fontFamily: "var(--font-mono)" };
  return (
    <div style={{ display: "contents" }}>
      <div style={{ ...mono, justifyContent: "flex-end", color: "var(--muted)" }}>#{e.block_height}</div>
      <div style={{ ...mono, fontSize: 10.5, color: "var(--muted)" }}>{new Date(e.timestamp).toLocaleString(locale)}</div>
      <div style={cell}><Drill onClick={onActor}>{e.actor_type}</Drill></div>
      <div style={{ ...cell, color: "var(--text)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.action}</div>
      <div style={{ ...mono, fontSize: 10.5, color: "var(--muted)" }}><Drill onClick={onEntity}>{e.entity_type}</Drill></div>
      <div style={{ ...mono, fontSize: 10.5, color: "var(--accent-2)" }}>{e.current_hash.slice(0, 12)}</div>
      <div style={{ ...cell, justifyContent: "flex-end", color: e.verified ? "var(--st-verified)" : "var(--st-critical)" }}>{e.verified ? <Icon name="check" size={13} /> : <Icon name="x" size={13} />}</div>
    </div>
  );
}

function Select({ label, value, onChange, options, tAll }: { label: string; value: string; onChange: (v: string) => void; options: string[]; tAll: string }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--muted)" }}>
      {label}:
      <select value={value} onChange={(e) => onChange(e.target.value)} style={{ padding: "6px 10px", borderRadius: "var(--r-sm)", border: "1px solid var(--line)", background: "var(--card)", color: "var(--text)", fontSize: 12 }}>
        {options.map((o) => <option key={o} value={o}>{o === "all" ? tAll : o}</option>)}
      </select>
    </label>
  );
}

function Kpi({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 16 }}>
      <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--muted)", marginBottom: 10 }}>{label}</div>
      <div style={{ fontFamily: "var(--font-mono)", fontWeight: 500, fontSize: 28, letterSpacing: "-1.5px", color: color ?? "var(--text)" }}>{value}</div>
    </div>
  );
}

const headSt: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "#8A948A", padding: "10px 12px", background: "var(--head-bg)" };
