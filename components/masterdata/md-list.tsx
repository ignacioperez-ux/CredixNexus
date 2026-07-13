"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import type { Catalog } from "@/lib/masterdata/registry";
import type { FkOptions } from "@/lib/masterdata/queries";
import { setRecordStatus } from "@/lib/masterdata/actions";
import { useListFilters, FilterBar, Drill, useGrouping, GroupBar, GroupHeader, EmptyState, type FilterDef } from "@/components/common/filters";
import { Icon } from "@/components/ui/icon";

type Rec = Record<string, unknown> & { id: string; code: string; name: string; status: string };

export function MdList({ catalog, records, canManage, fkOptions = {} }: { catalog: Catalog; records: Rec[]; canManage: boolean; fkOptions?: FkOptions }) {
  const { t } = useI18n();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const extraFields = catalog.fields.filter((f) => catalog.listCols.includes(f.name));

  // Valor visible de un campo (null si vacio) — sirve para mostrar y para filtrar.
  function disp(r: Rec, fname: string): string | null {
    const f = catalog.fields.find((x) => x.name === fname);
    const v = r[fname];
    if (f?.type === "bool") return v ? t("common.yes") : null;
    if (f?.type === "fk") return v ? ((fkOptions[fname] ?? []).find((o) => o.id === v)?.name ?? null) : null;
    return v == null || v === "" ? null : String(v);
  }

  const base = useMemo(() => records.filter((r) => showInactive || r.status === "active"), [records, showInactive]);

  // Filtros por campo (dropdowns + drill) sobre las columnas extra del catalogo.
  const defs: FilterDef<Rec>[] = extraFields.map((fld) => ({
    key: fld.name, label: t(fld.label), get: (r) => disp(r, fld.name), allLabel: t("md.filter.all"),
  }));
  const f = useListFilters(base, defs);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return f.filtered;
    return f.filtered.filter((r) => String(r.code).toLowerCase().includes(s) || String(r.name).toLowerCase().includes(s));
  }, [f.filtered, search]);

  const g = useGrouping(filtered, defs);

  function Line(r: Rec) {
    return (
      <div key={r.id} className="cx-row" style={{ display: "contents" }}>
        <Cell mono accent>{r.code}</Cell>
        <Cell bold>{r.name}</Cell>
        {extraFields.map((fld) => {
          const d = disp(r, fld.name);
          return <Cell key={fld.name}>{d ? <Drill onClick={() => f.set(fld.name, d)}>{d}</Drill> : "—"}</Cell>;
        })}
        <Cell>
          <span style={{ fontSize: 10.5, padding: "2px 8px", borderRadius: "var(--r-pill)", background: r.status === "active" ? "var(--st-low-bg)" : "var(--paper)", color: r.status === "active" ? "var(--st-low-fg)" : "var(--muted)", whiteSpace: "nowrap" }}>
            {t(("md.status." + r.status) as MessageKey)}
          </span>
        </Cell>
        <div style={{ ...cellSt, justifyContent: "flex-end", gap: 8 }}>
          {canManage ? (
            <>
              <Link href={`/catalog/${catalog.key}/${r.id}/edit`} title={t("common.edit")} style={{ display: "inline-flex", color: "var(--accent-2)", textDecoration: "none" }}><Icon name="edit" size={14} /></Link>
              <button onClick={() => toggle(r)} disabled={busy === r.id}
                style={{ fontSize: 11.5, padding: "4px 10px", borderRadius: "var(--r-sm)", border: "1px solid var(--line)", background: "var(--card)", color: r.status === "active" ? "var(--st-critical-fg)" : "var(--st-low-fg)", cursor: "pointer", whiteSpace: "nowrap" }}>
                {r.status === "active" ? t("md.deactivate") : t("md.activate")}
              </button>
            </>
          ) : (
            <span style={{ fontSize: 11, color: "var(--muted)" }}>—</span>
          )}
        </div>
      </div>
    );
  }

  async function toggle(r: Rec) {
    if (r.status === "active" && !confirm(t("md.confirm_deactivate"))) return;
    setBusy(r.id);
    await setRecordStatus(catalog.key, r.id, r.status === "active" ? "inactive" : "active");
    setBusy(null);
    router.refresh();
  }

  const cols = `130px minmax(200px, 1.4fr) ${extraFields.map(() => "minmax(130px, 1fr)").join(" ")} 110px 150px`;
  const minW = 640 + extraFields.length * 150;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Volver al indice de datos maestros + titulo del catalogo */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <Link href="/catalog" style={{ fontSize: 12.5, fontWeight: 600, color: "var(--accent-2)", textDecoration: "none" }}>← {t("md.back")}</Link>
        <span style={{ color: "var(--muted)" }}>/</span>
        <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, color: "var(--text)" }}>{t(catalog.title)}</span>
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("md.search")}
          style={{ flex: 1, minWidth: 220, maxWidth: 360, padding: "9px 12px", borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: "var(--card)", color: "var(--text)", fontSize: 13 }} />
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--text)", cursor: "pointer" }}>
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} /> {t("md.showinactive")}
        </label>
        <div style={{ flex: 1 }} />
        {canManage && (
          <Link href={`/catalog/${catalog.key}/new`} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 16px", borderRadius: "var(--r-md)", background: "var(--cta-bg)", color: "var(--cta-fg)", fontWeight: 700, fontSize: 13, textDecoration: "none" }}>
            <span style={{ color: "var(--cta-icon)" }}>+</span> {t("md.new")}
          </Link>
        )}
      </div>

      {defs.length > 0 && (
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between" }}>
          <FilterBar defs={defs} filters={f} />
          <GroupBar defs={defs} groupKey={g.groupKey} setGroupKey={g.setGroupKey} label={t("flt.groupby")} allLabel={t("flt.nogroup")} />
        </div>
      )}

      <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <div style={{ minWidth: minW }}>
            <div style={{ display: "grid", gridTemplateColumns: cols }}>
              <Head>{t("md.f.code")}</Head>
              <Head>{t("md.f.name")}</Head>
              {extraFields.map((fld) => <Head key={fld.name}>{t(fld.label)}</Head>)}
              <Head>{t("md.col.status")}</Head>
              <Head right>·</Head>

              {filtered.length === 0 && <EmptyState text={t("md.empty")} icon="database" />}

              {g.groups
                ? g.groups.map((grp) => (
                    <div key={grp.value} style={{ display: "contents" }}>
                      <GroupHeader label={grp.label} count={grp.rows.length} />
                      {grp.rows.map(Line)}
                    </div>
                  ))
                : filtered.map(Line)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const headSt: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "#8A948A", padding: "10px 12px", background: "var(--head-bg)" };
const cellSt: React.CSSProperties = { fontSize: 12.5, padding: "11px 12px", borderTop: "1px solid var(--line-soft)", color: "var(--text)", display: "flex", alignItems: "center", minWidth: 0 };

function Head({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <div style={{ ...headSt, textAlign: right ? "right" : "left" }}>{children}</div>;
}
function Cell({ children, mono, accent, bold }: { children: React.ReactNode; mono?: boolean; accent?: boolean; bold?: boolean }) {
  return (
    <div style={{ ...cellSt, fontFamily: mono ? "var(--font-mono)" : "var(--font-ui)", color: accent ? "var(--accent-2)" : "var(--text)", fontWeight: bold ? 600 : 400 }}>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{children}</span>
    </div>
  );
}
