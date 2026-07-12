"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import type { DependencyGraph, ServiceNode, ServiceOption } from "@/lib/dependencies/queries";
import { DEPENDENCY_TYPES } from "@/lib/dependencies/validation";
import { addDependency, removeDependency } from "@/lib/dependencies/actions";
import { Icon } from "@/components/ui/icon";

const CRIT: Record<string, string> = { critical: "var(--st-critical-fg)", high: "var(--st-high-fg)", medium: "var(--st-medium-fg)", low: "var(--st-low-fg)" };

export function DependencyGraphView({ graph, canManage }: { graph: DependencyGraph; canManage: boolean }) {
  const { t } = useI18n();
  const [selectedId, setSelectedId] = useState<string | null>(graph.nodes[0]?.id ?? null);
  const selected = graph.nodes.find((n) => n.id === selectedId) ?? null;

  const byDomain = useMemo(() => {
    const m = new Map<string, ServiceNode[]>();
    for (const n of graph.nodes) { const l = m.get(n.domain) ?? []; l.push(n); m.set(n.domain, l); }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [graph.nodes]);

  const totalEdges = graph.nodes.reduce((s, n) => s + n.dependsOn.length, 0);
  const totalActive = graph.nodes.reduce((s, n) => s + n.activeIncidents, 0);
  const affected = graph.nodes.filter((n) => n.activeIncidents > 0).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("dep.intro")}</div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        <Kpi label={t("dep.kpi.services")} value={graph.nodes.length} />
        <Kpi label={t("dep.kpi.edges")} value={totalEdges} />
        <Kpi label={t("dep.kpi.affected")} value={affected} color={affected > 0 ? "var(--st-high-fg)" : undefined} />
        <Kpi label={t("dep.kpi.activeinc")} value={totalActive} color={totalActive > 0 ? "var(--st-critical-fg)" : undefined} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 16, alignItems: "start" }}>
        {/* Columna izquierda: servicios por dominio */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {byDomain.map(([domain, nodes]) => (
            <div key={domain} style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", overflow: "hidden" }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "var(--muted)", padding: "9px 14px", background: "var(--head-bg)" }}>{domain}</div>
              {nodes.map((n) => (
                <button key={n.id} onClick={() => setSelectedId(n.id)}
                  style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", padding: "10px 14px", border: "none", borderTop: "1px solid var(--line-soft)", background: n.id === selectedId ? "var(--accent-soft)" : "transparent", cursor: "pointer" }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: n.activeIncidents > 0 ? "var(--st-critical-fg)" : "var(--st-low-fg)", flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 12.5, fontWeight: n.id === selectedId ? 700 : 500, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.name}</span>
                  <span style={{ fontSize: 9.5, fontWeight: 700, color: CRIT[n.criticality], textTransform: "uppercase" }}>{t(("lvl." + n.criticality) as MessageKey)}</span>
                  {n.activeIncidents > 0 && <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--st-critical-fg)" }}>{n.activeIncidents}</span>}
                </button>
              ))}
            </div>
          ))}
        </div>

        {/* Columna derecha: impacto (blast radius) del servicio seleccionado */}
        {selected ? (
          <ImpactPanel node={selected} services={graph.services} canManage={canManage} onSelect={setSelectedId} />
        ) : (
          <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 36, textAlign: "center", color: "var(--muted)" }}>{t("dep.select.hint")}</div>
        )}
      </div>
    </div>
  );
}

function ImpactPanel({ node, services, canManage, onSelect }: { node: ServiceNode; services: ServiceOption[]; canManage: boolean; onSelect: (id: string) => void }) {
  const { t } = useI18n();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700, color: "var(--text)" }}>{node.name}</h2>
          <span style={{ fontSize: 10.5, fontWeight: 700, color: CRIT[node.criticality], background: "var(--paper)", padding: "3px 10px", borderRadius: "var(--r-pill)", textTransform: "uppercase" }}>{t(("lvl." + node.criticality) as MessageKey)}</span>
          <span style={{ fontSize: 11.5, color: "var(--muted)" }}>{node.domain}</span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <Section title={t("dep.dependson")}>
            {node.dependsOn.length === 0 ? <Empty /> : node.dependsOn.map((d) => (
              <DepChip key={d.edgeId} name={d.name} type={t(("dep.type." + d.type) as MessageKey)} onClick={() => onSelect(d.id)} />
            ))}
          </Section>
          <Section title={t("dep.dependedonby")}>
            {node.dependedOnBy.length === 0 ? <Empty /> : node.dependedOnBy.map((d) => (
              <DepChip key={d.edgeId} name={d.name} type={t(("dep.type." + d.type) as MessageKey)} onClick={() => onSelect(d.id)} />
            ))}
          </Section>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <Section title={`${t("dep.cis.title")} (${node.cis.length})`}>
            {node.cis.length === 0 ? <Empty label={t("dep.cis.none")} /> : (
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {node.cis.map((c) => (
                  <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--text)" }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: c.ci_type === "application" ? "var(--accent-2)" : "var(--st-info)", textTransform: "uppercase" }}>{t(("cmdb.type." + c.ci_type) as MessageKey)}</span>
                    {c.name}
                  </div>
                ))}
              </div>
            )}
          </Section>
          <Section title={`${t("dep.products.title")} (${node.products.length})`}>
            {node.products.length === 0 ? <Empty label={t("dep.products.none")} /> : (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {node.products.map((p) => <span key={p.id} style={{ fontSize: 11.5, color: "var(--text)", background: "var(--paper)", padding: "4px 10px", borderRadius: "var(--r-pill)" }}>{p.name}</span>)}
              </div>
            )}
          </Section>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10.5, color: "var(--muted)", borderTop: "1px solid var(--line-soft)", paddingTop: 10 }}><Icon name="sparkle" size={12} /> {t("dep.derived.note")}</div>
      </div>

      {/* Incidentes activos (impacto operativo real) */}
      <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 20 }}>
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, color: "var(--text)", marginBottom: 12 }}>{t("dep.incidents.title")} ({node.activeIncidents})</div>
        {node.incidents.length === 0 ? <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("dep.incidents.none")}</div> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {node.incidents.map((i) => (
              <Link key={i.id} href={`/incidents/${i.id}`} style={{ textDecoration: "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", background: "var(--paper)", borderRadius: "var(--r-md)" }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent-2)" }}>{i.incident_number}</span>
                  <span style={{ flex: 1, fontSize: 12.5, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{i.title}</span>
                  <span style={{ fontSize: 10, fontWeight: 600, color: "var(--muted)" }}>{t(("prio." + i.priority) as MessageKey)}</span>
                  <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", color: i.via === "service" ? "var(--accent-2)" : "var(--st-info)" }}>{t(("dep.via." + i.via) as MessageKey)}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {canManage && <DependencyEditor node={node} services={services} />}
    </div>
  );
}

function DependencyEditor({ node, services }: { node: ServiceNode; services: ServiceOption[] }) {
  const { t } = useI18n();
  const router = useRouter();
  const [dependsOnId, setDependsOnId] = useState("");
  const [type, setType] = useState<string>("sync");
  const [crit, setCrit] = useState<string>("medium");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const options = services.filter((s) => s.id !== node.id && !node.dependsOn.some((d) => d.id === s.id));

  function add() {
    setErr(null);
    start(async () => {
      const r = await addDependency({ serviceId: node.id, dependsOnId, dependencyType: type, criticality: crit });
      if (!r.ok) { setErr(r.error ?? "ERR_INVALID_STATE"); return; }
      setDependsOnId("");
      router.refresh();
    });
  }
  function remove(edgeId: string) {
    start(async () => { await removeDependency(edgeId); router.refresh(); });
  }

  const field: React.CSSProperties = { fontSize: 12.5, padding: "8px 10px", borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: "var(--card)", color: "var(--text)", fontFamily: "var(--font-ui)" };

  return (
    <div style={{ background: "var(--paper)", border: "1px dashed var(--line)", borderRadius: "var(--r-xl)", padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, color: "var(--text)" }}>{t("dep.edit.title")}</div>

      {node.dependsOn.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {node.dependsOn.map((d) => (
            <span key={d.edgeId} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, padding: "4px 6px 4px 11px", borderRadius: "var(--r-pill)", background: "var(--card)", border: "1px solid var(--line)", color: "var(--text)" }}>
              {d.name}
              <button onClick={() => remove(d.edgeId)} disabled={pending} aria-label={t("dep.edit.remove")} title={t("dep.edit.remove")}
                style={{ width: 16, height: 16, borderRadius: "50%", border: "none", background: "transparent", color: "var(--st-critical-fg)", cursor: "pointer", fontSize: 13, lineHeight: 1 }}>×</button>
            </span>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>
          {t("dep.edit.dependson")}
          <select value={dependsOnId} onChange={(e) => setDependsOnId(e.target.value)} style={{ ...field, minWidth: 200 }}>
            <option value="">{t("dep.edit.choose")}</option>
            {options.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>
          {t("dep.edit.type")}
          <select value={type} onChange={(e) => setType(e.target.value)} style={field}>
            {DEPENDENCY_TYPES.map((ty) => <option key={ty} value={ty}>{t(("dep.type." + ty) as MessageKey)}</option>)}
          </select>
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>
          {t("dep.edit.crit")}
          <select value={crit} onChange={(e) => setCrit(e.target.value)} style={field}>
            {["critical", "high", "medium", "low"].map((c) => <option key={c} value={c}>{t(("lvl." + c) as MessageKey)}</option>)}
          </select>
        </label>
        <button onClick={add} disabled={pending || !dependsOnId}
          style={{ fontSize: 12.5, fontWeight: 600, padding: "9px 16px", borderRadius: "var(--r-md)", border: "none", background: "var(--cta-bg)", color: "var(--cta-fg)", cursor: pending || !dependsOnId ? "default" : "pointer", opacity: !dependsOnId ? 0.6 : 1 }}>
          {pending ? t("dep.edit.adding") : t("dep.edit.add")}
        </button>
      </div>
      {err && <div style={{ fontSize: 12, color: "var(--st-critical-fg)" }}>{err === "ERR_INVALID_STATE" ? t("dep.edit.cycle") : t(("err." + err) as MessageKey)}</div>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.7px", color: "var(--accent-2)" }}>{title}</div>
      {children}
    </div>
  );
}
function DepChip({ name, type, onClick }: { name: string; type: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12, padding: "6px 11px", borderRadius: "var(--r-pill)", background: "var(--paper)", border: "1px solid var(--line)", color: "var(--text)", cursor: "pointer", alignSelf: "flex-start" }}>
      <span style={{ fontWeight: 600 }}>{name}</span>
      <span style={{ fontSize: 9.5, textTransform: "uppercase", color: "var(--muted)" }}>{type}</span>
    </button>
  );
}
function Empty({ label }: { label?: string }) {
  const { t } = useI18n();
  return <div style={{ fontSize: 12, color: "var(--muted)" }}>{label ?? t("dep.none")}</div>;
}
function Kpi({ label, value, color }: { label: string; value: number; color?: string }) {
  return <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 16 }}>
    <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--muted)", marginBottom: 10 }}>{label}</div>
    <div style={{ fontFamily: "var(--font-mono)", fontWeight: 500, fontSize: 22, letterSpacing: "-1px", color: color ?? "var(--text)" }}>{value}</div></div>;
}
