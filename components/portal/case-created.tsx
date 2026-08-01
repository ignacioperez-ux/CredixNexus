"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/provider";
import { Icon } from "@/components/ui/icon";
import { humanTimeOnly, humanCommitment } from "@/lib/format/time";

// Confirmacion con EXPECTATIVA EXPLICITA (P5). Tras registrar, el usuario ve que su caso fue
// recibido, el numero, y los 3 pasos con horas legibles (no jerga de SLA, R5). Tokens del DS,
// tema claro/oscuro, R6/R7.

export type Confirmation = {
  id: string;
  number: string;
  openedAt: string | null;
  responseDueAt: string | null;
  resolutionDueAt: string | null;
};

export function CaseCreated({ conf, caseHref, onNew }: {
  conf: Confirmation; caseHref: (id: string) => string; onNew: () => void;
}) {
  const { t, locale } = useI18n();
  const steps = [
    { key: "recv", label: t("portal.done.step.received"), time: humanTimeOnly(conf.openedAt, locale), active: true },
    { key: "take", label: t("portal.done.step.taken"), time: humanCommitment(conf.responseDueAt, locale), active: false },
    { key: "done", label: t("portal.done.step.resolved"), time: humanCommitment(conf.resolutionDueAt, locale), active: false },
  ];
  return (
    <div style={{ maxWidth: 560, margin: "0 auto", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "12px 4px", textAlign: "center" }}>
      <span aria-hidden style={{ width: 72, height: 72, borderRadius: "var(--r-2xl, 22px)", background: "var(--st-low-bg)", color: "var(--st-low-fg, var(--st-low))", display: "grid", placeItems: "center", marginBottom: 4 }}>
        <Icon name="check" size={34} color="var(--st-low-fg, var(--st-low))" />
      </span>
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 24, color: "var(--text)" }}>{t("portal.done.title")}</div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 20, fontWeight: 700, color: "var(--accent-2)" }}>{conf.number}</div>
      <div style={{ fontSize: 13.5, color: "var(--muted)", maxWidth: "46ch", lineHeight: 1.5 }}>{t("portal.done.email")}</div>

      {/* 3 pasos verticales; el paso actual resaltado en superficie roja tenue. */}
      <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 8, margin: "14px 0 6px" }}>
        {steps.map((s, i) => (
          <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 12, textAlign: "left", padding: "12px 14px", borderRadius: "var(--r-md, 12px)",
            background: s.active ? "var(--accent-soft)" : "var(--paper)", border: `1px solid ${s.active ? "var(--accent)" : "var(--line)"}` }}>
            <span aria-hidden style={{ width: 26, height: 26, flexShrink: 0, borderRadius: "50%", display: "grid", placeItems: "center", fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700,
              background: s.active ? "var(--accent)" : "var(--track)", color: s.active ? "var(--on-accent, #fff)" : "var(--muted)" }}>{i + 1}</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 13.5, fontWeight: 700, color: "var(--text)" }}>{s.label}</span>
              {s.time && <span style={{ display: "block", fontSize: 12.5, color: "var(--muted)", marginTop: 1 }}>{s.time}</span>}
            </span>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center", marginTop: 4 }}>
        <Link href={caseHref(conf.id)} className="cx-btn-primary" style={{ height: 48, borderRadius: 12, textDecoration: "none", display: "inline-flex", alignItems: "center" }}>{t("portal.done.view")}</Link>
        <button type="button" onClick={onNew} className="cx-btn-outline" style={{ height: 48, borderRadius: 12 }}>{t("portal.done.another")}</button>
      </div>
    </div>
  );
}
