"use client";

import { useI18n } from "@/lib/i18n/provider";
import type { TalentProfile } from "@/lib/talent/queries";

export function TalentList({ profiles }: { profiles: TalentProfile[] }) {
  const { t } = useI18n();
  const head: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "#8A948A", padding: "10px 12px" };

  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", overflow: "hidden" }}>
      <div style={{ overflowX: "auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 100px 90px 2fr 90px 90px 110px", minWidth: 820 }}>
          <div style={head}>{t("tal.col.member")}</div>
          <div style={head}>{t("tal.col.discipline")}</div>
          <div style={head}>Tipo</div>
          <div style={head}>{t("tal.skills")}</div>
          <div style={{ ...head, textAlign: "right" }}>{t("tal.expertise")}</div>
          <div style={{ ...head, textAlign: "right" }}>{t("tal.load")}</div>
          <div style={{ ...head, textAlign: "right" }}>{t("tal.perf")}</div>

          {profiles.map((p) => (
            <div key={p.id} style={{ display: "contents" }}>
              <div style={cell}><span style={{ fontWeight: 600, color: "var(--text)" }}>{p.name}</span>{p.seniority && <span style={{ fontSize: 11, color: "var(--muted)" }}> · {p.seniority}</span>}</div>
              <div style={{ ...cell, color: "var(--muted)" }}>{p.discipline ?? "—"}</div>
              <div style={cell}>
                <span style={{ fontSize: 10.5, padding: "2px 8px", borderRadius: "var(--r-pill)", background: p.is_external ? "var(--st-high-bg)" : "var(--st-low-bg)", color: p.is_external ? "var(--st-high-fg)" : "var(--st-low-fg)" }}>
                  {p.is_external ? t("tal.external") : t("tal.internal")}
                </span>
              </div>
              <div style={cell}>
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                  {p.skills.length === 0 && <span style={{ color: "var(--muted)", fontSize: 12 }}>—</span>}
                  {p.skills.map((s) => (
                    <span key={s.name} style={{ fontSize: 10.5, padding: "2px 8px", borderRadius: "var(--r-pill)", background: "var(--paper)", color: "var(--text)" }}>
                      {s.name} <b style={{ fontFamily: "var(--font-mono)", color: "var(--accent-2)" }}>{s.level}</b>
                    </span>
                  ))}
                </div>
              </div>
              <div style={{ ...cell, textAlign: "right", fontFamily: "var(--font-mono)" }}>{p.expertiseCount}</div>
              <div style={{ ...cell, textAlign: "right", fontFamily: "var(--font-mono)" }}>{p.openIncidents}</div>
              <div style={{ ...cell, textAlign: "right", fontFamily: "var(--font-mono)" }}>
                {p.performance != null ? p.performance : <span style={{ fontSize: 10.5, fontFamily: "var(--font-ui)", color: "var(--muted)" }}>{t("tal.perf.restricted")}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const cell: React.CSSProperties = { fontSize: 12.5, padding: "11px 12px", borderTop: "1px solid var(--line-soft)", color: "var(--text)", display: "flex", alignItems: "center" };
