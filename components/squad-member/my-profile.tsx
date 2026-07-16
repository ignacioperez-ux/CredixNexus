"use client";

import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import { Icon } from "@/components/ui/icon";
import { scoreColor } from "@/lib/incidents/labels";
import { squadColor } from "@/lib/squad-member/colors";
import { squadRoleLabel } from "@/components/squad-member/role-label";
import type { MyProfile } from "@/lib/squad-member/queries";

export function MyProfileView({ profile }: { profile: MyProfile }) {
  const { t, locale } = useI18n();

  if (!profile.memberId) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "64px 20px", textAlign: "center", color: "var(--muted)" }}>
        <Icon name="user" size={34} strokeWidth={1.4} color="var(--muted)" />
        <div style={{ fontSize: 14.5, fontWeight: 700, color: "var(--text)" }}>{t("sm.nomember.title")}</div>
        <div style={{ fontSize: 12.5, maxWidth: 380, lineHeight: 1.5 }}>{t("sm.nomember.hint")}</div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 1100 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: "var(--text)", margin: 0 }}>{profile.name ?? t("nav.myprofile")}</h1>
        <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: "var(--r-pill)", background: "var(--paper)", color: "var(--muted)" }}>{profile.is_external ? t("tal.type.external") : t("tal.type.internal")}</span>
        {profile.seniority && <span style={{ fontSize: 11, color: "var(--muted)" }}>{profile.seniority}</span>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 16, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Asignaciones vigentes */}
          <Card title={t("sm.profile.assignments")}>
            {profile.assignments.length === 0 ? <Muted t={t} k="sm.profile.noassign" /> : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {profile.assignments.map((a) => {
                  const c = squadColor(a.code);
                  return (
                    <div key={a.code} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, background: "var(--paper)" }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: c.fg, background: c.bg, border: `1px solid ${c.border}`, borderRadius: "var(--r-pill)", padding: "1px 8px" }}>{a.code}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}</div>
                        <div style={{ fontSize: 10.5, color: "var(--muted)" }}>{squadRoleLabel(t, a.squad_role)} · {a.valid_from ? new Date(a.valid_from).toLocaleDateString(locale, { day: "2-digit", month: "short", year: "2-digit" }) : "—"}{a.valid_to ? ` → ${new Date(a.valid_to).toLocaleDateString(locale, { day: "2-digit", month: "short", year: "2-digit" })}` : ""}</div>
                      </div>
                      <span style={{ fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums", fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{a.allocation_pct}%</span>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Mi chapter (maestro no cargado -> vacio elegante) */}
          <Card title={t("sm.profile.chapter")}>
            <Muted t={t} k="sm.profile.nochapter" />
          </Card>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Competencias */}
          <Card title={`${t("sm.profile.skills")} (${profile.skills.length})`}>
            {profile.skills.length === 0 ? <Muted t={t} k="sm.profile.noskills" /> : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {profile.skills.map((s) => (
                  <div key={s.name} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ flex: 1, fontSize: 12.5, color: "var(--text)" }}>{s.name}</span>
                    <span style={{ display: "inline-flex", gap: 3 }}>{[1, 2, 3, 4, 5].map((i) => <span key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: i <= s.level ? "var(--accent-2)" : "var(--track)" }} />)}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Evaluaciones (solo propias) */}
          <Card title={`${t("sm.profile.evals")} (${profile.evaluations.length})`}>
            {profile.evaluations.length === 0 ? <Muted t={t} k="sm.profile.noevals" /> : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {profile.evaluations.map((e) => (
                  <div key={e.id} style={{ borderTop: "1px solid var(--line-soft)", paddingTop: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", color: "var(--accent-2)" }}>{t(("tal.eval.type." + e.eval_type) as MessageKey)}</span>
                      {e.performance_score != null && <Pill label={t("tal.effectiveness")} v={Number(e.performance_score)} />}
                      {e.empathy_score != null && <Pill label={t("tal.empathy")} v={Number(e.empathy_score)} />}
                      <span style={{ marginLeft: "auto", fontSize: 10.5, color: "var(--muted)" }}>{new Date(e.created_at).toLocaleDateString(locale)}</span>
                    </div>
                    {(e.strengths || e.comment) && <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--text)", lineHeight: 1.5 }}>{e.strengths || e.comment}</p>}
                    {e.development_areas && <p style={{ margin: "4px 0 0", fontSize: 11.5, color: "var(--muted)", lineHeight: 1.45 }}>{t("sm.profile.areas")}: {e.development_areas}</p>}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 18 }}>
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, marginBottom: 12, color: "var(--text)" }}>{title}</div>
      {children}
    </div>
  );
}
function Muted({ t, k }: { t: (k: MessageKey) => string; k: string }) { return <div style={{ fontSize: 12, color: "var(--muted)" }}>{t(k as MessageKey)}</div>; }
function Pill({ label, v }: { label: string; v: number }) {
  return <span style={{ fontSize: 10.5, display: "inline-flex", alignItems: "center", gap: 5, padding: "2px 8px", borderRadius: "var(--r-pill)", background: "var(--paper)" }}><span style={{ color: "var(--muted)" }}>{label}</span><b style={{ fontFamily: "var(--font-mono)", color: scoreColor(v) }}>{v}</b></span>;
}
