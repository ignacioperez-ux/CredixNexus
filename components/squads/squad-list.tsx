"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n, useErrorMessage } from "@/lib/i18n/provider";
import type { SquadRow } from "@/lib/squads/queries";
import { createSquad } from "@/lib/squads/actions";
import { useListFilters, FilterBar, Drill, useGrouping, GroupBar, GroupHeader, EmptyState, type FilterDef } from "@/components/common/filters";
import { Icon } from "@/components/ui/icon";

type Bu = { id: string; name: string };

export function SquadList({ rows, businessUnits = [], canManage = false }: { rows: SquadRow[]; businessUnits?: Bu[]; canManage?: boolean }) {
  const { t } = useI18n();
  const errMsg = useErrorMessage();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ code: "", name: "", businessUnitId: "", isTransversal: true, capacityPoints: "7" });
  const [err, setErr] = useState<string | null>(null);

  const head: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "#8A948A", padding: "10px 12px", background: "var(--head-bg)" };
  const defs: FilterDef<SquadRow>[] = [
    { key: "bu", label: t("sq.col.bu"), get: (s) => s.business_unit?.name, allLabel: t("inc.filter.allbu") },
    { key: "transversal", label: t("sq.transversal"), get: (s) => (s.is_transversal ? "yes" : "no"), allLabel: t("md.filter.all"), render: (v) => (v === "yes" ? t("common.yes") : t("common.no")) },
  ];
  const f = useListFilters(rows, defs);
  const g = useGrouping(f.filtered, defs);

  function Line(s: SquadRow) {
    return (
      <Link key={s.id} href={`/squads/${s.id}`} className="cx-row" style={{ display: "contents", textDecoration: "none" }}>
        <Cell mono accent>{s.code}</Cell>
        <Cell>{s.name}</Cell>
        <Cell muted>{s.business_unit?.name ? <Drill onClick={() => f.set("bu", s.business_unit!.name)}>{s.business_unit.name}</Drill> : "—"}</Cell>
        <Cell mono>{s.member_count}</Cell>
        <Cell mono muted>{s.allocated_points}%{s.capacity_points ? ` / ${s.capacity_points}p` : ""}</Cell>
        <Cell>
          <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: "var(--r-pill)", background: s.is_transversal ? "var(--st-info-bg)" : "var(--paper)", color: s.is_transversal ? "var(--st-info)" : "var(--muted)" }}>
            {s.is_transversal ? t("sq.type.transversal") : t("sq.type.dedicated")}
          </span>
        </Cell>
      </Link>
    );
  }

  function create() {
    setErr(null);
    start(async () => {
      const r = await createSquad({
        code: form.code, name: form.name,
        businessUnitId: form.businessUnitId || undefined,
        isTransversal: form.isTransversal,
        capacityPoints: Number(form.capacityPoints),
      });
      if (!r.ok) { setErr(errMsg(r.error ?? "ERR_INVALID_FORMAT")); return; }
      setForm({ code: "", name: "", businessUnitId: "", isTransversal: true, capacityPoints: "7" });
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("sq.intro")}</div>
        {canManage && (
          <button onClick={() => setOpen((o) => !o)} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, padding: "8px 14px", borderRadius: "var(--r-md)", background: open ? "var(--card)" : "var(--cta-bg)", color: open ? "var(--text)" : "var(--cta-fg)", border: open ? "1px solid var(--line)" : "none", cursor: "pointer" }}>
            {open ? <Icon name="x" size={13} /> : <Icon name="plus" size={13} />} {t("sq.new")}
          </button>
        )}
      </div>

      {open && canManage && (
        <div style={{ background: "var(--card)", border: "1px solid var(--accent)", borderRadius: "var(--r-xl)", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "140px 1.5fr 1.3fr 120px", gap: 10, alignItems: "end" }}>
            <Field label={t("sq.form.code")}>
              <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="EVO-01" style={inp} />
            </Field>
            <Field label={t("sq.col.name")}>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={inp} />
            </Field>
            <Field label={t("sq.col.bu")}>
              <select value={form.businessUnitId} onChange={(e) => setForm({ ...form, businessUnitId: e.target.value })} style={inp}>
                <option value="">{t("sq.form.nobu")}</option>
                {businessUnits.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </Field>
            <Field label={t("sq.form.capacity")}>
              <input type="number" min={1} max={999} value={form.capacityPoints} onChange={(e) => setForm({ ...form, capacityPoints: e.target.value })} style={inp} />
            </Field>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, color: "var(--text)", cursor: "pointer" }}>
              <input type="checkbox" checked={form.isTransversal} onChange={(e) => setForm({ ...form, isTransversal: e.target.checked })} />
              {t("sq.transversal")}
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
      <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "150px 1.4fr 1fr 90px 120px 110px", minWidth: 820 }}>
            {[t("sq.col.code"), t("sq.col.name"), t("sq.col.bu"), t("sq.col.members"), t("sq.col.allocation"), t("sq.col.type")].map((h) => <div key={h} style={head}>{h}</div>)}
            {f.filtered.length === 0 && <EmptyState text={t("sq.empty")} icon="users" />}
            {g.groups
              ? g.groups.map((grp) => (
                  <div key={grp.value} style={{ display: "contents" }}>
                    <GroupHeader label={grp.label} count={grp.rows.length} />
                    {grp.rows.map(Line)}
                  </div>
                ))
              : f.filtered.map(Line)}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 11, fontWeight: 600, color: "var(--muted)" }}>
      {label}
      {children}
    </label>
  );
}

const inp: React.CSSProperties = { width: "100%", fontSize: 12.5, padding: "8px 10px", borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: "var(--card)", color: "var(--text)", fontFamily: "var(--font-ui)" };
const cellSt: React.CSSProperties = { fontSize: 12.5, padding: "11px 12px", borderTop: "1px solid var(--line-soft)", display: "flex", alignItems: "center", color: "var(--text)" };
function Cell({ children, mono, accent, muted }: { children: React.ReactNode; mono?: boolean; accent?: boolean; muted?: boolean }) {
  return <div style={{ ...cellSt, fontFamily: mono ? "var(--font-mono)" : "var(--font-ui)", color: accent ? "var(--accent-2)" : muted ? "var(--muted)" : "var(--text)" }}>{children}</div>;
}
