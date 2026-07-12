"use client";

import { Icon } from "@/components/ui/icon";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
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
  const head: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "#8A948A", padding: "10px 12px", background: "var(--head-bg)" };

  function ack(id: string) {
    start(async () => {
      await acknowledgeEscalation(id);
      router.refresh();
    });
  }

  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", overflow: "hidden" }}>
      <div style={{ overflowX: "auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "120px 1.4fr 150px 120px 90px 110px", minWidth: 900 }}>
          {[t("sla.col.number"), t("sla.ev.rule"), t("sla.ev.action"), t("sla.ev.clock"), t("sla.ev.elapsed"), t("sla.ev.ack")].map((h) => (
            <div key={h} style={head}>{h}</div>
          ))}
          {events.length === 0 && <div style={{ gridColumn: "1 / -1", padding: 36, textAlign: "center", color: "var(--muted)" }}>{t("sla.ev.empty")}</div>}
          {events.map((e) => (
            <div key={e.id} style={{ display: "contents" }}>
              <Cell mono accent>{e.incident ? <Link href={`/incidents/${e.incident.id}`} style={{ color: "var(--accent-2)", textDecoration: "none" }}>{e.incident.incident_number}</Link> : "—"}</Cell>
              <Cell>{e.rule?.name ?? e.rule?.code ?? "—"}</Cell>
              <Cell><span style={{ fontSize: 11, fontWeight: 600, color: actionColor[e.action] ?? "var(--text)" }}>{t(("sla.act." + e.action) as MessageKey)}{e.action_detail ? ` · ${e.action_detail}` : ""}</span></Cell>
              <Cell muted>{t(("sla.clock." + e.sla_type) as MessageKey)} {e.threshold_pct}%</Cell>
              <Cell mono muted>{e.elapsed_pct}%</Cell>
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
          ))}
        </div>
      </div>
    </div>
  );
}

const cellSt: React.CSSProperties = { fontSize: 12.5, padding: "10px 12px", borderTop: "1px solid var(--line-soft)", display: "flex", alignItems: "center", color: "var(--text)" };
function Cell({ children, mono, accent, muted }: { children: React.ReactNode; mono?: boolean; accent?: boolean; muted?: boolean }) {
  return <div style={{ ...cellSt, fontFamily: mono ? "var(--font-mono)" : "var(--font-ui)", color: accent ? "var(--accent-2)" : muted ? "var(--muted)" : "var(--text)" }}>{children}</div>;
}
