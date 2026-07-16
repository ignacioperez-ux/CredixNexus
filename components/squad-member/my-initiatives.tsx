"use client";

import { useI18n } from "@/lib/i18n/provider";
import { Icon } from "@/components/ui/icon";
import { squadColor } from "@/lib/squad-member/colors";
import type { MyInitiative } from "@/lib/squad-member/queries";

const HEALTH: Record<string, { fg: string; bg: string }> = {
  green: { fg: "var(--st-low-fg)", bg: "var(--st-low-bg)" },
  amber: { fg: "var(--st-high-fg)", bg: "var(--st-high-bg)" },
  red: { fg: "var(--st-critical-fg)", bg: "var(--st-critical-bg)" },
};

export function MyInitiativesView({ initiatives, linked }: { initiatives: MyInitiative[]; linked: boolean }) {
  const { t, locale } = useI18n();

  if (!linked) return <Empty t={t} title="sm.nomember.title" hint="sm.nomember.hint" />;
  if (initiatives.length === 0) return <Empty t={t} title="sm.init.empty.title" hint="sm.init.empty.hint" icon="zap" />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 1280 }}>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: "var(--text)", margin: 0 }}>{t("nav.myinitiatives")}</h1>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
        {initiatives.map((i) => {
          const c = squadColor(i.squad_code);
          const h = i.health ? HEALTH[i.health] : null;
          const minePct = i.mineTotal > 0 ? Math.round((i.mineDone / i.mineTotal) * 100) : null;
          const teamPct = i.teamTotal > 0 ? Math.round((i.teamDone / i.teamTotal) * 100) : 0;
          return (
            <div key={i.project_id} style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 14, padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                {i.code && <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent-2)" }}>{i.code}</span>}
                {i.squad_code && <span style={{ fontSize: 9.5, fontWeight: 700, color: c.fg, background: c.bg, border: `1px solid ${c.border}`, borderRadius: "var(--r-pill)", padding: "1px 7px" }}>{i.squad_code}</span>}
                <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.3px" }}>{i.status}</span>
                {h && <span style={{ width: 9, height: 9, borderRadius: "50%", background: h.fg }} title={i.health ?? undefined} />}
              </div>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text)", lineHeight: 1.35 }}>{i.name}</div>

              <Prog label={t("sm.init.mine")} pct={minePct} done={i.mineDone} total={i.mineTotal} color="var(--accent-2)" />
              <Prog label={t("sm.init.team")} pct={teamPct} done={i.teamDone} total={i.teamTotal} color="var(--teal)" />

              <div style={{ fontSize: 11, color: "var(--muted)", display: "flex", alignItems: "center", gap: 6 }}>
                <Icon name="flag" size={11} color="var(--muted)" />
                {i.nextDue ? `${t("sm.init.nextdue")}: ${new Date(i.nextDue).toLocaleDateString(locale, { day: "2-digit", month: "short" })}` : t("sm.init.nodue")}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Prog({ label, pct, done, total, color }: { label: string; pct: number | null; done: number; total: number; color: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--muted)" }}>
        <span>{label}</span>
        <span style={{ fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" }}>{pct == null ? "—" : `${done}/${total} · ${pct}%`}</span>
      </div>
      <div style={{ height: 6, borderRadius: 4, background: "var(--track)", overflow: "hidden" }}>
        <div style={{ width: `${pct ?? 0}%`, height: "100%", background: color, borderRadius: 4 }} />
      </div>
    </div>
  );
}

function Empty({ t, title, hint, icon = "users" }: { t: (k: import("@/lib/i18n/dictionaries").MessageKey) => string; title: string; hint: string; icon?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "64px 20px", textAlign: "center", color: "var(--muted)" }}>
      <Icon name={icon} size={34} strokeWidth={1.4} color="var(--muted)" />
      <div style={{ fontSize: 14.5, fontWeight: 700, color: "var(--text)" }}>{t(title as import("@/lib/i18n/dictionaries").MessageKey)}</div>
      <div style={{ fontSize: 12.5, maxWidth: 380, lineHeight: 1.5 }}>{t(hint as import("@/lib/i18n/dictionaries").MessageKey)}</div>
    </div>
  );
}
