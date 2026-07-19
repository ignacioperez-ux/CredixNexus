"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import type { DefinitionRow } from "@/lib/workflows/queries";
import { createDefinition } from "@/lib/workflows/actions";
import { DefStatusBadge } from "./badges";
import { useListFilters, FilterBar, Drill, type FilterDef } from "@/components/common/filters";

const ENTITY_TYPES = ["generic", "incident", "problem", "change", "request", "project"];

export function DefinitionsTab({ definitions, canManage }: { definitions: DefinitionRow[]; canManage: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [form, setForm] = useState<{ code: string; name: string; entityType: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const head: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "#8A948A", padding: "10px 12px", background: "var(--head-bg)" };
  const defs: FilterDef<DefinitionRow>[] = [
    { key: "entity", label: t("wf.def.entity"), get: (d) => d.entity_type, allLabel: t("inc.filter.alltype"), render: (v) => t(("wf.entity." + v) as MessageKey) },
    { key: "status", label: t("wf.col.status"), get: (d) => d.status, allLabel: t("inc.filter.allstatus"), render: (v) => t(("sla.st." + v) as MessageKey) },
  ];
  const f = useListFilters(definitions, defs);

  function create() {
    if (!form) return;
    setErr(null);
    start(async () => {
      const r = await createDefinition(form);
      if (!r.ok) setErr(r.error ?? "error");
      else router.push(`/workflows/definitions/${r.id}`);
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {canManage && !form && <div><button onClick={() => { setErr(null); setForm({ code: "", name: "", entityType: "generic" }); }} style={btnPrimary}>+ {t("wf.def.new")}</button></div>}
      {form && (
        <div style={{ background: "var(--card)", border: "1px solid var(--accent-2)", borderRadius: "var(--r-xl)", padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15 }}>{t("wf.def.new")}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <F label={t("wf.def.code")}><input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} style={inp} /></F>
            <F label={t("wf.def.name")}><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={inp} /></F>
            <F label={t("wf.def.entity")}><select value={form.entityType} onChange={(e) => setForm({ ...form, entityType: e.target.value })} style={inp}>{ENTITY_TYPES.map((x) => <option key={x} value={x}>{t(("wf.entity." + x) as MessageKey)}</option>)}</select></F>
          </div>
          {err && <div style={{ fontSize: 12, color: "var(--st-critical)" }}>{err}</div>}
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={create} disabled={pending} style={btnPrimary}>{pending ? t("common.saving") : t("common.save")}</button>
            <button onClick={() => setForm(null)} disabled={pending} style={btnGhost}>{t("common.cancel")}</button>
          </div>
        </div>
      )}

      <FilterBar defs={defs} filters={f} />

      <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "150px 1.5fr 110px 80px 90px 110px", minWidth: 700 }}>
            {[t("wf.def.code"), t("wf.def.name"), t("wf.def.entity"), t("wf.def.nodes"), t("wf.def.insts"), t("wf.col.status")].map((h) => <div key={h} style={head}>{h}</div>)}
            {f.filtered.length === 0 && <div style={{ gridColumn: "1 / -1", padding: 36, textAlign: "center", color: "var(--muted)" }}>{t("wf.def.empty")}</div>}
            {f.filtered.map((d) => (
              <Link key={d.id} href={`/workflows/definitions/${d.id}`} style={{ display: "contents", textDecoration: "none" }}>
                <Cell mono accent>{d.code}</Cell>
                <Cell>{d.name}</Cell>
                <Cell muted><Drill onClick={() => f.set("entity", d.entity_type)}>{t(("wf.entity." + d.entity_type) as MessageKey)}</Drill></Cell>
                <Cell mono muted>{d.node_count}</Cell>
                <Cell mono muted>{d.instance_count}</Cell>
                <Cell><Drill onClick={() => f.set("status", d.status)}><DefStatusBadge status={d.status} /></Drill></Cell>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const inp: React.CSSProperties = { width: "100%", fontSize: 13, padding: "8px 10px", borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: "var(--card)", color: "var(--text)", fontFamily: "var(--font-ui)" };
const btnPrimary: React.CSSProperties = { fontSize: 13, fontWeight: 600, padding: "9px 16px", borderRadius: "var(--r-md)", border: "none", background: "var(--cta-bg)", color: "var(--cta-fg)", cursor: "pointer" };
const btnGhost: React.CSSProperties = { fontSize: 13, fontWeight: 600, padding: "9px 16px", borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: "var(--card)", color: "var(--text)", cursor: "pointer" };
const cellSt: React.CSSProperties = { fontSize: 12.5, padding: "11px 12px", borderTop: "1px solid var(--line-soft)", display: "flex", alignItems: "center", color: "var(--text)" };
function Cell({ children, mono, accent, muted }: { children: React.ReactNode; mono?: boolean; accent?: boolean; muted?: boolean }) {
  return <div style={{ ...cellSt, fontFamily: mono ? "var(--font-mono)" : "var(--font-ui)", color: accent ? "var(--accent-2)" : muted ? "var(--muted)" : "var(--text)" }}>{children}</div>;
}
function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "var(--muted)", marginBottom: 6 }}>{label}</label>{children}</div>;
}
