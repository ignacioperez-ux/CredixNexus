"use client";

import { Icon } from "@/components/ui/icon";

import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";

type Version = { version_number: number; weights_json: Record<string, number>; thresholds_json: Record<string, number>; status: string } | null;
type Gov = { item_type: string; code: string; name: string };

export function RuleConfig({ rule, version, governance }: { rule: { code: string; name: string; description: string | null }; version: Version; governance: Gov[] }) {
  const { t } = useI18n();
  const weights = version?.weights_json ?? {};
  const thresholds = version?.thresholds_json ?? {};
  const sum = Object.values(weights).reduce((s, w) => s + Number(w), 0);
  const sumOk = Math.abs(sum - 1) < 0.001;

  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, color: "var(--text)" }}>{rule.name}</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent-2)" }}>{rule.code} · v{version?.version_number ?? "—"}</span>
      </div>
      {rule.description && <p style={{ margin: "0 0 16px", fontSize: 12.5, color: "var(--muted)" }}>{rule.description}</p>}

      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 10 }}>{t("rule.factors")}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 8 }}>
        {Object.entries(weights).map(([code, w]) => (
          <div key={code} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 12.5, color: "var(--text)", width: 170 }}>{t(("factor." + code) as MessageKey)}</span>
            <div style={{ flex: 1, height: 7, borderRadius: 20, background: "var(--track)", overflow: "hidden" }}>
              <div style={{ width: `${Number(w) * 100}%`, height: "100%", background: "var(--accent-2)", borderRadius: 20 }} />
            </div>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)", width: 44, textAlign: "right" }}>{Math.round(Number(w) * 100)}%</span>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11.5, marginBottom: 18, color: sumOk ? "var(--st-low-fg)" : "var(--st-critical-fg)" }}>
        {t("rule.weightsum")}: {Math.round(sum * 100)}% {sumOk ? <Icon name="check" size={13} style={{ verticalAlign: "-2px" }} /> : <Icon name="x" size={13} style={{ verticalAlign: "-2px" }} />}
      </div>

      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 10 }}>{t("rule.thresholds")}</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
        {Object.entries(thresholds).map(([k, v]) => (
          <span key={k} style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, padding: "4px 10px", borderRadius: "var(--r-sm)", background: "var(--paper)", color: "var(--text)" }}>
            {t(("dec." + k) as MessageKey)} ≤ {String(v)}
          </span>
        ))}
      </div>

      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 10 }}>{t("rule.governance")}</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {governance.length === 0 && <span style={{ fontSize: 12, color: "var(--muted)" }}>—</span>}
        {governance.map((g) => (
          <span key={g.code} style={{ fontSize: 11.5, padding: "4px 10px", borderRadius: "var(--r-pill)", background: "var(--teal-soft)", color: "var(--teal)" }}>
            {t(("gov." + g.item_type) as MessageKey)}: {g.name}
          </span>
        ))}
      </div>
    </div>
  );
}
