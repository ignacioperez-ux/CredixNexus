"use client";

import { Icon } from "@/components/ui/icon";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import type { EscalationEventRow } from "@/lib/sla/queries";
import { acknowledgeEscalation } from "@/lib/sla/actions";

const actionColor: Record<string, string> = {
  notify: "var(--st-info)",
  raise_priority: "var(--st-high-fg)",
  reassign_team: "var(--st-eval)",
};

export function EventsTab({ events, canManage }: { events: EscalationEventRow[]; canManage: boolean }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [fClock, setFClock] = useState("");
  const [fAck, setFAck] = useState<"" | "pending" | "ack">("");
  const head: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "var(--muted)", padding: "10px 12px", background: "var(--head-bg)", whiteSpace: "nowrap" };

  const rows = useMemo(() => events.filter((e) =>
    (!fClock || e.sla_type === fClock) && (!fAck || (fAck === "ack" ? e.acknowledged : !e.acknowledged))), [events, fClock, fAck]);

  function ack(id: string) {
    start(async () => { await acknowledgeEscalation(id); router.refresh(); });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Select label={t("sla.ev.clock")} value={fClock} onChange={setFClock} all={t("sla.filter.all")}
          options={[{ value: "response", label: t("sla.clock.response") }, { value: "resolution", label: t("sla.clock.resolution") }]} />
        <Select label={t("sla.ev.ack")} value={fAck} onChange={(v) => setFAck(v as typeof fAck)} all={t("sla.filter.all")}
          options={[{ value: "pending", label: t("sla.ev.pending") }, { value: "ack", label: t("sla.ev.acked") }]} />
      </div>

      <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "116px 1.3fr 150px 130px 96px 116px 92px", minWidth: 940 }}>
            {[t("sla.col.number"), t("sla.ev.rule"), t("sla.ev.action"), t("sla.ev.clock"), t("sla.ev.elapsed"), t("sla.ev.when"), t("sla.ev.ack")].map((h) => (
              <div key={h} style={head}>{h}</div>
            ))}
            {rows.length === 0 && <div style={{ gridColumn: "1 / -1", padding: 36, textAlign: "center", color: "var(--muted)" }}>{t("sla.ev.empty")}</div>}
            {rows.map((e) => {
              const raw = e.elapsed_pct;
              const over = raw > 100;
              return (
                <div key={e.id} style={{ display: "contents" }}>
                  <Cell mono accent>{e.incident ? <Link href={`/incidents/${e.incident.id}`} style={{ color: "var(--accent-2)", textDecoration: "none" }}>{e.incident.incident_number}</Link> : "—"}</Cell>
                  <Cell>{e.rule?.name ?? e.rule?.code ?? "—"}</Cell>
                  <Cell><span style={{ fontSize: 11, fontWeight: 600, color: actionColor[e.action] ?? "var(--text)" }}>{t(("sla.act." + e.action) as MessageKey)}{e.action_detail ? ` · ${e.action_detail}` : ""}</span></Cell>
                  <Cell muted>{t(("sla.clock." + e.sla_type) as MessageKey)} · {e.threshold_pct}%</Cell>
                  <Cell mono muted title={over ? `${raw}%` : undefined}>
                    <span style={{ color: over ? "var(--st-critical-fg)" : "var(--muted)" }}>{Math.min(raw, 100)}%{over ? "+" : ""}</span>
                  </Cell>
                  <Cell mono muted>{new Date(e.triggered_at).toLocaleDateString(locale, { day: "2-digit", month: "short" })}</Cell>
                  <Cell>
                    {e.acknowledged ? (
                      <span style={{ color: "var(--st-low-fg)", display: "inline-flex" }}><Icon name="check" size={13} /></span>
                    ) : canManage ? (
                      <button onClick={() => ack(e.id)} disabled={pending}
                        style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: "var(--r-pill)", border: "1px solid var(--line)", background: "var(--paper)", color: "var(--text)", cursor: pending ? "default" : "pointer" }}>
                        {t("sla.ev.acknowledge")}
                      </button>
                    ) : (
                      <span style={{ fontSize: 11, color: "var(--muted)" }}>—</span>
                    )}
                  </Cell>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

const cellSt: React.CSSProperties = { fontSize: 12.5, padding: "10px 12px", borderTop: "1px solid var(--line-soft)", display: "flex", alignItems: "center", color: "var(--text)" };
function Cell({ children, mono, accent, muted, title }: { children: React.ReactNode; mono?: boolean; accent?: boolean; muted?: boolean; title?: string }) {
  return <div title={title} style={{ ...cellSt, fontFamily: mono ? "var(--font-mono)" : "var(--font-ui)", color: accent ? "var(--accent-2)" : muted ? "var(--muted)" : "var(--text)" }}>{children}</div>;
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
