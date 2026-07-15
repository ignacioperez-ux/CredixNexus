"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n, useErrorMessage } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import type { SquadCard } from "@/lib/capacity/queries";
import { loadTone, toneColor, toneFg } from "@/lib/capacity/compute";
import { createSquad } from "@/lib/squads/actions";
import { useListFilters, FilterBar, useGrouping, GroupBar, EmptyState, type FilterDef } from "@/components/common/filters";
import { Icon } from "@/components/ui/icon";

type Bu = { id: string; name: string };
const TYPE_COLOR: Record<string, string> = { domain: "var(--accent)", enabler: "var(--st-eval)", transient: "var(--muted)" };

const CSS = `
.sq { display:flex; flex-direction:column; gap:14px; }
.sq .sq-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:12px; }
.sq .sq-card { display:flex; flex-direction:column; gap:11px; background:var(--card); border:1px solid var(--line); border-radius:14px; box-shadow:var(--sh-card); padding:16px; text-decoration:none; transition:border-color .12s; }
.sq .sq-card:hover { border-color:var(--accent); }
.sq .sq-track { height:8px; background:var(--track,var(--paper)); border-radius:4px; overflow:hidden; }
.sq .sq-av { width:24px; height:24px; border-radius:50%; background:var(--paper); border:1px solid var(--line); display:inline-flex; align-items:center; justify-content:center; font-family:var(--font-mono); font-size:9.5px; color:var(--text); }
.sq .sq-num { font-family:var(--font-mono); font-variant-numeric:tabular-nums; }
.sq .sq-trow { display:grid; grid-template-columns:1.5fr 130px 1fr 150px 150px 1fr 70px; align-items:center; }
.sq .sq-trow.sq-body { border-top:1px solid var(--line-soft,var(--line)); }
.sq .sq-trow.sq-body:hover { background:var(--accent-soft); }
.sq .sq-tc { padding:10px 12px; font-size:12.5px; color:var(--text); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
@media (max-width:900px){ .sq .sq-trow { grid-template-columns:1.5fr 150px 150px 70px; } .sq .sq-hide { display:none; } }
`;

function initials(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase() || "?";
}

export function SquadList({ cards, businessUnits = [], canManage = false }: { cards: SquadCard[]; businessUnits?: Bu[]; canManage?: boolean }) {
  const { t } = useI18n();
  const errMsg = useErrorMessage();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"cards" | "table">("cards");
  const [form, setForm] = useState({ code: "", name: "", businessUnitId: "", isTransversal: true, capacityPoints: "7" });
  const [err, setErr] = useState<string | null>(null);

  const defs: FilterDef<SquadCard>[] = [
    { key: "bu", label: t("sq.col.bu"), get: (s) => s.business_unit_name ?? undefined, allLabel: t("inc.filter.allbu") },
    { key: "transversal", label: t("sq.transversal"), get: (s) => (s.is_transversal ? "yes" : "no"), allLabel: t("md.filter.all"), render: (v) => (v === "yes" ? t("common.yes") : t("common.no")) },
  ];
  const f = useListFilters(cards, defs);
  const g = useGrouping(f.filtered, defs);

  const typeLabel = (s: SquadCard) => s.squad_type ? t(("tribe.type." + s.squad_type) as MessageKey) : s.is_transversal ? t("sq.type.transversal") : t("sq.type.dedicated");
  const typeColor = (s: SquadCard) => (s.squad_type ? TYPE_COLOR[s.squad_type] : s.is_transversal ? "var(--st-info)" : "var(--muted)") ?? "var(--muted)";

  function create() {
    setErr(null);
    start(async () => {
      const r = await createSquad({ code: form.code, name: form.name, businessUnitId: form.businessUnitId || undefined, isTransversal: form.isTransversal, capacityPoints: Number(form.capacityPoints) });
      if (!r.ok) { setErr(errMsg(r.error ?? "ERR_INVALID_FORMAT")); return; }
      setForm({ code: "", name: "", businessUnitId: "", isTransversal: true, capacityPoints: "7" });
      setOpen(false); router.refresh();
    });
  }

  return (
    <div className="sq">
      <style>{CSS}</style>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("sq.intro")}</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Segmented value={view} onChange={setView} options={[{ v: "cards", l: t("sq.view.cards") }, { v: "table", l: t("sq.view.table") }]} />
          {canManage && (
            <button onClick={() => setOpen((o) => !o)} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, padding: "8px 14px", borderRadius: "var(--r-md)", background: open ? "var(--card)" : "var(--cta-bg)", color: open ? "var(--text)" : "var(--cta-fg)", border: open ? "1px solid var(--line)" : "none", cursor: "pointer" }}>
              {open ? <Icon name="x" size={13} /> : <Icon name="plus" size={13} />} {t("sq.new")}
            </button>
          )}
        </div>
      </div>

      {open && canManage && (
        <div style={{ background: "var(--card)", border: "1px solid var(--accent)", borderRadius: "var(--r-xl)", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "140px 1.5fr 1.3fr 120px", gap: 10, alignItems: "end" }}>
            <Field label={t("sq.form.code")}><input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="EVO-01" style={inp} /></Field>
            <Field label={t("sq.col.name")}><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={inp} /></Field>
            <Field label={t("sq.col.bu")}>
              <select value={form.businessUnitId} onChange={(e) => setForm({ ...form, businessUnitId: e.target.value })} style={inp}>
                <option value="">{t("sq.form.nobu")}</option>
                {businessUnits.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </Field>
            <Field label={t("sq.form.capacity")}><input type="number" min={1} max={999} value={form.capacityPoints} onChange={(e) => setForm({ ...form, capacityPoints: e.target.value })} style={inp} /></Field>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, color: "var(--text)", cursor: "pointer" }}>
              <input type="checkbox" checked={form.isTransversal} onChange={(e) => setForm({ ...form, isTransversal: e.target.checked })} /> {t("sq.transversal")}
            </label>
            {err && <span style={{ fontSize: 12, color: "var(--st-critical-fg)" }}>{err}</span>}
            <button onClick={create} disabled={pending || !form.code || !form.name} style={{ marginLeft: "auto", fontSize: 12.5, fontWeight: 700, padding: "8px 16px", borderRadius: "var(--r-md)", border: "none", background: (!form.code || !form.name) ? "var(--paper)" : "var(--cta-bg)", color: (!form.code || !form.name) ? "var(--muted)" : "var(--cta-fg)", cursor: pending || !form.code || !form.name ? "default" : "pointer" }}>
              {pending ? t("sq.creating") : t("sq.create")}
            </button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between" }}>
        <FilterBar defs={defs} filters={f} />
        <GroupBar defs={defs} groupKey={g.groupKey} setGroupKey={g.setGroupKey} label={t("flt.groupby")} allLabel={t("flt.nogroup")} />
      </div>

      {f.filtered.length === 0 ? <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 8 }}><EmptyState text={t("sq.empty")} icon="users" /></div> : view === "cards" ? (
        g.groups ? g.groups.map((grp) => (
          <div key={grp.value} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".4px", color: "var(--muted)" }}>{grp.label} · {grp.rows.length}</div>
            <div className="sq-grid">{grp.rows.map((s) => <SquadCardView key={s.id} s={s} t={t} typeLabel={typeLabel(s)} typeColor={typeColor(s)} />)}</div>
          </div>
        )) : <div className="sq-grid">{f.filtered.map((s) => <SquadCardView key={s.id} s={s} t={t} typeLabel={typeLabel(s)} typeColor={typeColor(s)} />)}</div>
      ) : (
        <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", overflow: "hidden" }}>
          <div className="sq-trow" style={{ background: "var(--head-bg)" }}>
            {[["", t("sq.col.name")], ["", t("sq.col.type")], ["sq-hide", t("sq.col.bu")], ["", t("sq.col.fte")], ["", t("sq.col.load")], ["sq-hide", t("sq.col.po")], ["", t("sq.col.members")]].map(([cls, h], i) => (
              <div key={i} className={cls} style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".5px", color: "#8A948A", padding: "10px 12px" }}>{h}</div>
            ))}
          </div>
          {(g.groups ? g.groups.flatMap((grp) => grp.rows) : f.filtered).map((s) => {
            const tone = loadTone(s.load_pct);
            return (
              <Link key={s.id} href={`/squads/${s.id}`} className="sq-trow sq-body" style={{ textDecoration: "none" }}>
                <div className="sq-tc" title={s.code} style={{ fontWeight: 600 }}>{s.name}</div>
                <div className="sq-tc"><span style={{ fontSize: 10.5, fontWeight: 700, color: typeColor(s) }}>{typeLabel(s)}</span></div>
                <div className="sq-tc sq-hide" style={{ color: "var(--muted)" }}>{s.business_unit_name ?? "—"}</div>
                <div className="sq-tc sq-num" title={t("sq.fte.def")}>{s.fte} <span style={{ color: "var(--muted)" }}>({s.member_count})</span></div>
                <div className="sq-tc sq-num" title={t("sq.load.def")} style={{ color: toneFg(tone) }}>{s.demand_points}/{s.capacity_points} · {s.load_pct ?? "—"}%</div>
                <div className="sq-tc sq-hide" style={{ color: s.po_name ? "var(--text)" : "var(--st-high-fg)" }}>{s.po_name ?? t("sq.noPo")}</div>
                <div className="sq-tc sq-num">{s.member_count}</div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SquadCardView({ s, t, typeLabel, typeColor }: { s: SquadCard; t: (k: MessageKey) => string; typeLabel: string; typeColor: string }) {
  const tone = loadTone(s.load_pct);
  const shown = s.roster.slice(0, 4);
  return (
    <Link href={`/squads/${s.id}`} className="sq-card">
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 9, height: 9, borderRadius: "50%", background: toneColor(tone), flexShrink: 0 }} title={t("sq.health.def")} />
            <span title={s.code} style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 5, flexWrap: "wrap" }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: typeColor, border: `1px solid ${typeColor}`, borderRadius: "var(--r-pill)", padding: "1px 8px" }}>{typeLabel}</span>
            <span style={{ fontSize: 11, color: "var(--muted)" }}>{s.tribe_name ?? s.business_unit_name ?? "—"}</span>
          </div>
        </div>
      </div>

      {/* Carga (§1) */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, marginBottom: 4 }}>
          <span style={{ color: "var(--muted)" }} title={t("sq.load.def")}>{t("sq.load")}</span>
          <span className="sq-num" style={{ color: toneFg(tone), fontWeight: 700 }}>{s.demand_points}/{s.capacity_points} {t("sq.pts")} · {s.load_pct ?? "—"}%</span>
        </div>
        <div className="sq-track"><div style={{ width: `${Math.min(100, s.load_pct ?? 0)}%`, height: "100%", background: toneColor(tone), borderRadius: 4 }} /></div>
      </div>

      {/* PO */}
      <div style={{ fontSize: 12, color: s.po_name ? "var(--text)" : "var(--st-high-fg)", display: "flex", alignItems: "center", gap: 6 }}>
        {!s.po_name && <Icon name="alert" size={13} color="var(--st-high-fg)" />}
        {s.po_name ? <><span style={{ color: "var(--muted)" }}>{t("sq.po")}:</span> {s.po_name}</> : t("sq.noPo")}
      </div>

      {/* Roster + FTE (§1) */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center" }}>
          {shown.map((m, i) => <span key={m.id} className="sq-av" title={m.name} style={{ marginLeft: i === 0 ? 0 : -6 }}>{initials(m.name)}</span>)}
          {s.roster.length > 4 && <span className="sq-av" style={{ marginLeft: -6, color: "var(--muted)" }}>+{s.roster.length - 4}</span>}
        </div>
        <span className="sq-num" style={{ fontSize: 11.5, color: "var(--muted)" }} title={t("sq.fte.def")}>{s.fte} {t("sq.fte")} ({s.member_count} {t("sq.people")})</span>
      </div>

      {/* Top backlog */}
      {s.backlog.length > 0 && (
        <div style={{ borderTop: "1px solid var(--line-soft, var(--line))", paddingTop: 9, display: "flex", flexDirection: "column", gap: 5 }}>
          {s.backlog.map((b) => (
            <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: "var(--accent-2)", textTransform: "uppercase" }}>{t(("init.type." + b.type) as MessageKey)}</span>
              <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.name}</span>
              <span className="sq-num" style={{ fontSize: 11, fontWeight: 700, color: "var(--accent-2)" }}>{b.wsjf.toFixed(1)}</span>
            </div>
          ))}
        </div>
      )}
    </Link>
  );
}

function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { v: T; l: string }[] }) {
  return (
    <div style={{ display: "inline-flex", gap: 3, padding: 3, borderRadius: "var(--r-md)", background: "var(--paper)", border: "1px solid var(--line)" }}>
      {options.map((o) => (
        <button key={o.v} onClick={() => onChange(o.v)} style={{ padding: "5px 12px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 11.5, fontWeight: 600, background: o.v === value ? "var(--cta-bg)" : "transparent", color: o.v === value ? "var(--cta-fg)" : "var(--muted)" }}>{o.l}</button>
      ))}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 11, fontWeight: 600, color: "var(--muted)" }}>{label}{children}</label>;
}
const inp: React.CSSProperties = { width: "100%", fontSize: 12.5, padding: "8px 10px", borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: "var(--card)", color: "var(--text)", fontFamily: "var(--font-ui)" };
