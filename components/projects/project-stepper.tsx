"use client";

import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import { Icon } from "@/components/ui/icon";

// Ciclo de vida del proyecto como pasos, con el estado actual marcado (igual que el caso).
const MAIN = ["proposed", "active", "completed"] as const;
const STEP_OF: Record<string, number> = { proposed: 0, approved: 0, on_hold: 1, active: 1, completed: 2 };

export function ProjectStepper({ status }: { status: string }) {
  const { t } = useI18n();

  if (status === "cancelled") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <Chip label={t("pst.proposed")} tone="done" />
        <Icon name="chevron-right" size={13} color="var(--line)" />
        <Chip label={t("pst.cancelled")} tone="muted" />
      </div>
    );
  }

  const current = STEP_OF[status] ?? 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
      {MAIN.map((s, i) => {
        const done = i < current;
        const active = i === current;
        const label = active && s !== status ? t(("pst." + status) as MessageKey) : t(("pst." + s) as MessageKey);
        return (
          <div key={s} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <Chip label={label} tone={active ? "active" : done ? "done" : "todo"} check={done} />
            {i < MAIN.length - 1 && <Icon name="chevron-right" size={13} color="var(--line)" />}
          </div>
        );
      })}
    </div>
  );
}

function Chip({ label, tone, check }: { label: string; tone: "active" | "done" | "todo" | "muted"; check?: boolean }) {
  const styles: Record<string, { fg: string; bg: string }> = {
    active: { fg: "var(--cta-fg)", bg: "var(--cta-bg)" },
    done: { fg: "var(--st-low-fg)", bg: "var(--st-low-bg)" },
    todo: { fg: "var(--muted)", bg: "var(--paper)" },
    muted: { fg: "var(--muted)", bg: "var(--paper)" },
  };
  const c = styles[tone];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: tone === "active" ? 700 : 600, padding: "5px 11px", borderRadius: "var(--r-pill)", color: c.fg, background: c.bg, whiteSpace: "nowrap" }}>
      {check && <Icon name="check" size={11} />}
      {label}
    </span>
  );
}
