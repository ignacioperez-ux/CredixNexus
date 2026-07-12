"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n, useErrorMessage } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import type { TalentProfile } from "@/lib/talent/queries";
import { createMember } from "@/lib/talent/actions";
import { EXTERNAL_TYPES, DISCIPLINES, SENIORITIES } from "@/lib/talent/validation";
import { scoreColor } from "@/lib/incidents/labels";
import { useListFilters, FilterBar, Drill, useGrouping, GroupBar, GroupHeader, type FilterDef } from "@/components/common/filters";
import { Icon } from "@/components/ui/icon";

type Area = { id: string; code: string; name: string; lead_name: string | null };

export function TalentList({ profiles, areas = [], canManage = false }: { profiles: TalentProfile[]; areas?: Area[]; canManage?: boolean }) {
  const { t } = useI18n();
  const errMsg = useErrorMessage();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const empty = { name: "", email: "", isExternal: false, externalType: "subcontractor", deliveryAreaId: areas[0]?.id ?? "", discipline: "", seniority: "", capacityPoints: "8" };
  const [form, setForm] = useState(empty);

  const head: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "#8A948A", padding: "10px 12px", background: "var(--head-bg)" };
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

  function Line(p: TalentProfile) {
    return (
      <Link key={p.id} href={`/talent/${p.id}`} style={{ display: "contents", textDecoration: "none" }}>
        <Cell>
          <span style={{ fontWeight: 600, color: "var(--text)" }}>{p.name}</span>
          {p.is_external && <span style={{ fontSize: 9.5, fontWeight: 700, marginLeft: 8, padding: "1px 7px", borderRadius: "var(--r-pill)", background: "var(--paper)", color: "var(--muted)" }}>{p.external_type ? t(("tal.ext." + p.external_type) as MessageKey) : t("tal.type.external")}</span>}
          {p.status !== "active" && <span style={{ fontSize: 9.5, marginLeft: 8, color: "var(--muted)" }}>({t("md.status.inactive")})</span>}
        </Cell>
        <Cell muted>{p.discipline ? <Drill onClick={() => f.set("disc", p.discipline!)}>{p.discipline}</Drill> : "—"}</Cell>
        <Cell muted>{p.stream_name ? <Drill onClick={() => f.set("stream", p.stream_name!)}>{p.stream_name}</Drill> : "—"}{p.stream_lead ? <span style={{ fontSize: 10.5, color: "var(--muted)" }}> · {p.stream_lead}</span> : ""}</Cell>
        <Cell mono muted right>{p.openIncidents}</Cell>
        <Cell right>{p.effectiveness != null ? <Score v={p.effectiveness} /> : <span style={{ color: "var(--muted)" }}>—</span>}</Cell>
        <Cell right>{p.empathy != null ? <Score v={p.empathy} /> : <span style={{ color: "var(--muted)" }}>—</span>}</Cell>
      </Link>
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
        <FilterBar defs={defs} filters={f} />
        <GroupBar defs={defs} groupKey={g.groupKey} setGroupKey={g.setGroupKey} label={t("flt.groupby")} allLabel={t("flt.nogroup")} />
      </div>

      <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.5fr 110px 1.4fr 90px 110px 110px", minWidth: 860 }}>
            {[t("tal.col.member"), t("tal.f.discipline"), t("tal.col.stream"), t("tal.load"), t("tal.col.effectiveness"), t("tal.col.empathy")].map((h, i) => (
              <div key={h} style={{ ...head, textAlign: i >= 3 ? "right" : "left" }}>{h}</div>
            ))}
            {f.filtered.length === 0 && <div style={{ gridColumn: "1 / -1", padding: 36, textAlign: "center", color: "var(--muted)" }}>{t("tal.empty")}</div>}
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

function Score({ v }: { v: number }) {
  return <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 600, color: scoreColor(v) }}>{v}</span>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 11, fontWeight: 600, color: "var(--muted)" }}>{label}{children}</label>;
}
const inp: React.CSSProperties = { width: "100%", fontSize: 12.5, padding: "8px 10px", borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: "var(--card)", color: "var(--text)", fontFamily: "var(--font-ui)" };
const cellSt: React.CSSProperties = { fontSize: 12.5, padding: "11px 12px", borderTop: "1px solid var(--line-soft)", display: "flex", alignItems: "center", color: "var(--text)" };
function Cell({ children, mono, muted, right }: { children: React.ReactNode; mono?: boolean; muted?: boolean; right?: boolean }) {
  return <div style={{ ...cellSt, justifyContent: right ? "flex-end" : "flex-start", fontFamily: mono ? "var(--font-mono)" : "var(--font-ui)", color: muted ? "var(--muted)" : "var(--text)" }}>{children}</div>;
}
