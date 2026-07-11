"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/provider";
import type { FitSuggestion } from "@/lib/talent/recommender";
import { assignIncidentMember } from "@/lib/talent/actions";
import { scoreColor } from "@/lib/incidents/labels";

export function FitPanel({ incidentId, suggestions }: { incidentId: string; suggestions: FitSuggestion[] }) {
  const { t } = useI18n();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function assign(memberId: string) {
    setBusy(memberId);
    await assignIncidentMember(incidentId, memberId);
    setBusy(null);
    router.refresh();
  }

  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 18 }}>
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14.5, marginBottom: 12, color: "var(--text)" }}>{t("tal.fit.title")}</div>
      {suggestions.length === 0 ? (
        <div style={{ fontSize: 12, color: "var(--muted)" }}>{t("tal.fit.none")}</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {suggestions.map((s) => (
            <div key={s.id} style={{ borderTop: "1px solid var(--line-soft)", paddingTop: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 16, fontWeight: 500, color: scoreColor(s.fit), width: 34 }}>{s.fit}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{s.name}</div>
                  <div style={{ fontSize: 10.5, color: "var(--muted)" }}>
                    {s.discipline ?? "—"} · {s.is_external ? t("tal.external") : t("tal.internal")}
                  </div>
                </div>
                <button onClick={() => assign(s.id)} disabled={busy === s.id}
                  style={{ padding: "6px 12px", borderRadius: "var(--r-md)", background: "var(--accent)", color: "var(--on-accent)", border: "none", fontWeight: 700, fontSize: 11.5, cursor: "pointer" }}>
                  {t("tal.fit.assign")}
                </button>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <Chip label={t("tal.fit.exp")} value={s.expertiseLevel} />
                <Chip label={t("tal.fit.skill")} value={s.skillLevel} />
                <Chip label={t("tal.fit.avail")} value={5 - Math.min(5, s.load)} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Chip({ label, value }: { label: string; value: number }) {
  return (
    <span style={{ fontSize: 10.5, padding: "2px 8px", borderRadius: "var(--r-pill)", background: "var(--paper)", color: "var(--muted)" }}>
      {label}: <b style={{ fontFamily: "var(--font-mono)", color: "var(--text)" }}>{value}</b>
    </span>
  );
}
