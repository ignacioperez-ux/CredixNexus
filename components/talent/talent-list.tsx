"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n, useErrorMessage } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import type { TalentProfile } from "@/lib/talent/queries";
import { createMember } from "@/lib/talent/actions";
import { EXTERNAL_TYPES, DISCIPLINES, SENIORITIES } from "@/lib/talent/validation";
import { loadTone, toneColor, toneFg } from "@/lib/capacity/compute";
import { useListFilters, FilterBar, useGrouping, GroupBar, EmptyState, type FilterDef } from "@/components/common/filters";
import { Icon } from "@/components/ui/icon";

type Area = { id: string; code: string; name: string; lead_name: string | null };

const CSS = `
.tl-wrap { overflow-x:auto; }
.tl-t { width:100%; border-collapse:separate; border-spacing:0; font-size:12.5px; }
.tl-t th { position:sticky; top:0; background:var(--card); z-index:2; text-align:right; font-size:10.5px; font-weight:700; text-transform:uppercase; letter-spacing:.4px; color:#8A948A; padding:10px 12px; white-space:nowrap; border-bottom:1px solid var(--line); }
.tl-t th.tl-l { text-align:left; }
.tl-t th.tl-first, .tl-t td.tl-first { position:sticky; left:0; text-align:left; background:var(--card); }
.tl-t th.tl-first { z-index:3; }
.tl-t td { padding:9px 12px; text-align:right; white-space:nowrap; color:var(--text); border-bottom:1px solid var(--line-soft,var(--line)); background:var(--card); vertical-align:middle; }
.tl-t td.tl-l { text-align:left; }
.tl-t tbody tr.tl-row { cursor:pointer; }
.tl-t tbody tr.tl-row:nth-child(even) td { background:var(--paper); }
.tl-t tbody tr.tl-row:hover td { background:var(--accent-soft); }
.tl-t tr.tl-grp td { background:var(--head-bg); font-size:10.5px; font-weight:700; text-transform:uppercase; letter-spacing:.4px; color:var(--muted); padding:8px 12px; text-align:left; }
@media (max-width:1000px){ .tl-t .tl-hide { display:none; } }
`;
function effColor(v: number): string { return v >= 85 ? "var(--st-low-fg)" : v >= 70 ? "var(--st-high-fg)" : "var(--st-critical-fg)"; }

export function TalentList({ profiles, areas = [], canManage = false, load = {} }: { profiles: TalentProfile[]; areas?: Area[]; canManage?: boolean; load?: Record<string, number> }) {
  const { t } = useI18n();
  const errMsg = useErrorMessage();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const empty = { name: "", email: "", isExternal: false, externalType: "subcontractor", deliveryAreaId: areas[0]?.id ?? "", discipline: "", seniority: "", capacityPoints: "8" };
  const [form, setForm] = useState(empty);

  const defs: FilterDef<TalentProfile>[] = [
    { key: "stream", label: t("tal.col.stream"), get: (p) => p.stream_name, allLabel: t("md.filter.all") },
    { key: "type", label: t("tal.col.type"), get: (p) => (p.is_external ? "external" : "internal"), allLabel: t("md.filter.all"), render: (v) => t(("tal.type." + v) as MessageKey) },
    { key: "disc", label: t("tal.f.discipline"), get: (p) => p.discipline, allLabel: t("md.filter.all") },
  ];
  const f = useListFilters(profiles, defs);
  const g = useGrouping(f.filtered, defs);

  function create() {
    setErr(null);
    start(async () => {
      const r = await createMember({
        name: form.name, email: form.email || undefined, isExternal: form.isExternal,
        externalType: form.isExternal ? form.externalType : undefined, deliveryAreaId: form.deliveryAreaId,
        discipline: form.discipline || undefined, seniority: form.seniority || undefined, capacityPoints: Number(form.capacityPoints),
      });
      if (!r.ok) { setErr(errMsg(r.error ?? "ERR_INVALID_FORMAT")); return; }
      setOpen(false);
      setForm(empty);
      router.push(`/talent/${r.id}`);
    });
  }

  const matchQ = (p: TalentProfile) => !q.trim() || p.name.toLowerCase().includes(q.trim().toLowerCase());

  function Row(p: TalentProfile) {
    const points = load[p.id] ?? 0;
    const util = p.capacity_points > 0 ? Math.round((points / p.capacity_points) * 100) : 0;
    const uTone = loadTone(p.capacity_points > 0 ? util : null);
    const topSkills = p.skills.slice().sort((a, b) => b.level - a.level).slice(0, 2);
    return (
      <tr key={p.id} className="tl-row" onClick={() => router.push(`/talent/${p.id}`)}>
        <td className="tl-first">
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 600, color: "var(--text)" }}>{p.name}</span>
            {p.is_external && <span style={{ fontSize: 9.5, fontWeight: 700, padding: "1px 7px", borderRadius: "var(--r-pill)", background: "var(--paper)", color: "var(--muted)" }}>{p.external_type ? t(("tal.ext." + p.external_type) as MessageKey) : t("tal.type.external")}</span>}
            {p.status !== "active" && <span style={{ fontSize: 9.5, color: "var(--muted)" }}>({t("md.status.inactive")})</span>}
          </div>
          {topSkills.length > 0 && (
            <div style={{ display: "flex", gap: 5, marginTop: 5, flexWrap: "wrap" }}>
              {topSkills.map((s) => <span key={s.name} style={{ fontSize: 10, color: "var(--accent-2)", background: "var(--accent-soft)", borderRadius: 6, padding: "1px 7px" }}>{s.name}</span>)}
              {p.skills.length > 2 && <span style={{ fontSize: 10, color: "var(--muted)" }}>+{p.skills.length - 2}</span>}
            </div>
          )}
        </td>
        <td className="tl-l tl-hide">
          {p.stream_name ? <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text)", background: "var(--paper)", border: "1px solid var(--line)", borderRadius: "var(--r-pill)", padding: "2px 9px" }}>{p.stream_name}</span> : <span style={{ color: "var(--muted)" }}>—</span>}
          {p.stream_lead && <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 3 }}>{p.stream_lead}</div>}
        </td>
        <td className="tl-l tl-hide" style={{ color: "var(--muted)" }}>{p.discipline ?? "—"}</td>
        <td title={t("tal.carga.def")}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
            <div style={{ width: 56, height: 7, background: "var(--track,var(--paper))", borderRadius: 4, overflow: "hidden" }}><div style={{ width: `${Math.min(100, util)}%`, height: "100%", background: toneColor(uTone), borderRadius: 4 }} /></div>
            <span style={{ fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums", color: toneFg(uTone), fontWeight: 700, width: 40, textAlign: "right" }}>{p.capacity_points > 0 ? `${util}%` : "—"}</span>
          </div>
        </td>
        <td>
          {p.effectiveness != null
            ? <span title={t("tal.eff.def")} style={{ fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums", fontSize: 14, fontWeight: 700, color: effColor(p.effectiveness) }}>{p.effectiveness}</span>
            : <Link href={`/talent/${p.id}`} onClick={(e) => e.stopPropagation()} style={{ display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none" }}>
                <span style={{ fontSize: 11, color: "var(--muted)", fontStyle: "italic", opacity: 0.8 }}>{t("tal.unrated")}</span>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--accent-2)", background: "var(--accent-soft)", borderRadius: 7, padding: "2px 8px" }}>{t("tal.evaluate")}</span>
              </Link>}
        </td>
      </tr>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ fontSize: 12.5, color: "var(--muted)", maxWidth: 620 }}>{t("tal.intro")}</div>
        {canManage && (
          <button onClick={() => setOpen((o) => !o)} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, padding: "8px 14px", borderRadius: "var(--r-md)", background: open ? "var(--card)" : "var(--cta-bg)", color: open ? "var(--text)" : "var(--cta-fg)", border: open ? "1px solid var(--line)" : "none", cursor: "pointer", whiteSpace: "nowrap" }}>
            {open ? <Icon name="x" size={13} /> : <Icon name="plus" size={13} />} {t("tal.new")}
          </button>
        )}
      </div>

      {open && canManage && (
        <div style={{ background: "var(--card)", border: "1px solid var(--accent)", borderRadius: "var(--r-xl)", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1.4fr 130px 120px", gap: 10 }}>
            <Field label={t("tal.f.name")}><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={inp} /></Field>
            <Field label={t("tal.f.email")}><input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="opcional" style={inp} /></Field>
            <Field label={t("tal.f.discipline")}>
              <select value={form.discipline} onChange={(e) => setForm({ ...form, discipline: e.target.value })} style={inp}>
                <option value="">—</option>{DISCIPLINES.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </Field>
            <Field label={t("tal.f.capacity")}><input type="number" min={1} max={40} value={form.capacityPoints} onChange={(e) => setForm({ ...form, capacityPoints: e.target.value })} style={inp} /></Field>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr 130px", gap: 10, alignItems: "end" }}>
            <Field label={t("tal.f.stream")}>
              <select value={form.deliveryAreaId} onChange={(e) => setForm({ ...form, deliveryAreaId: e.target.value })} style={inp}>
                {areas.map((a) => <option key={a.id} value={a.id}>{t(("tal.stream." + a.code) as MessageKey)}{a.lead_name ? ` · ${a.lead_name}` : ""}</option>)}
              </select>
            </Field>
            <Field label={t("tal.f.type")}>
              <select value={form.isExternal ? "external" : "internal"} onChange={(e) => setForm({ ...form, isExternal: e.target.value === "external" })} style={inp}>
                <option value="internal">{t("tal.type.internal")}</option>
                <option value="external">{t("tal.type.external")}</option>
              </select>
            </Field>
            {form.isExternal ? (
              <Field label={t("tal.f.exttype")}>
                <select value={form.externalType} onChange={(e) => setForm({ ...form, externalType: e.target.value })} style={inp}>
                  {EXTERNAL_TYPES.map((x) => <option key={x} value={x}>{t(("tal.ext." + x) as MessageKey)}</option>)}
                </select>
              </Field>
            ) : (
              <Field label={t("tal.f.seniority")}>
                <select value={form.seniority} onChange={(e) => setForm({ ...form, seniority: e.target.value })} style={inp}>
                  <option value="">—</option>{SENIORITIES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {err && <span style={{ fontSize: 12, color: "var(--st-critical-fg)" }}>{err}</span>}
            <button onClick={create} disabled={pending || !form.name || !form.deliveryAreaId} style={{ marginLeft: "auto", fontSize: 12.5, fontWeight: 700, padding: "8px 16px", borderRadius: "var(--r-md)", border: "none", background: (!form.name || !form.deliveryAreaId) ? "var(--paper)" : "var(--cta-bg)", color: (!form.name || !form.deliveryAreaId) ? "var(--muted)" : "var(--cta-fg)", cursor: pending ? "default" : "pointer" }}>
              {pending ? t("tal.creating") : t("tal.create")}
            </button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, border: "1px solid var(--line)", borderRadius: 9, padding: "0 10px", background: "var(--card)" }}>
            <Icon name="search" size={14} color="var(--muted)" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("tal.search")} style={{ border: "none", background: "transparent", color: "var(--text)", fontSize: 12.5, padding: "8px 0", outline: "none", width: 170 }} />
          </div>
          <FilterBar defs={defs} filters={f} />
        </div>
        <GroupBar defs={defs} groupKey={g.groupKey} setGroupKey={g.setGroupKey} label={t("flt.groupby")} allLabel={t("flt.nogroup")} />
      </div>

      <style>{CSS}</style>
      <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", overflow: "hidden" }}>
        <div className="tl-wrap">
          <table className="tl-t">
            <thead>
              <tr>
                <th className="tl-first">{t("tal.col.member")}</th>
                <th className="tl-l tl-hide">{t("tal.col.stream")}</th>
                <th className="tl-l tl-hide">{t("tal.f.discipline")}</th>
                <th title={t("tal.carga.def")}>{t("tal.carga")}</th>
                <th title={t("tal.eff.def")}>{t("tal.col.effectiveness")}</th>
              </tr>
            </thead>
            {f.filtered.filter(matchQ).length === 0 ? (
              <tbody><tr><td colSpan={5} style={{ textAlign: "center", padding: 0 }}><EmptyState text={t("tal.empty")} icon="users" /></td></tr></tbody>
            ) : g.groups ? (
              g.groups.map((grp) => {
                const rows = grp.rows.filter(matchQ);
                if (rows.length === 0) return null;
                return (
                  <tbody key={grp.value}>
                    <tr className="tl-grp"><td colSpan={5}>{grp.label} · {rows.length}</td></tr>
                    {rows.map(Row)}
                  </tbody>
                );
              })
            ) : (
              <tbody>{f.filtered.filter(matchQ).map(Row)}</tbody>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 11, fontWeight: 600, color: "var(--muted)" }}>{label}{children}</label>;
}
const inp: React.CSSProperties = { width: "100%", fontSize: 12.5, padding: "8px 10px", borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: "var(--card)", color: "var(--text)", fontFamily: "var(--font-ui)" };
