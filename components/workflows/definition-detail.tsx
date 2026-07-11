"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import type { NodeRow, EdgeRow } from "@/lib/workflows/queries";
import { addNode, deleteNode, addEdge, deleteEdge, publishDefinition, setDefinitionStatus } from "@/lib/workflows/actions";
import { DefStatusBadge, NODE_ICON } from "./badges";
import { BackButton } from "@/components/common/back-button";

type DefView = { id: string; code: string; name: string; description: string | null; entity_type: string; status: string };
type Options = { roles: { code: string; name: string }[]; teams: string[] };
const NODE_TYPES = ["start", "task", "approval", "automated", "end"];
const GUARDS = ["", "approved", "rejected", "done"];

export function DefinitionDetail({ def, nodes, edges, options, canManage }: { def: DefView; nodes: NodeRow[]; edges: EdgeRow[]; options: Options; canManage: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [issues, setIssues] = useState<{ code: string; node?: string }[]>([]);
  const isDraft = def.status === "draft";
  const editable = canManage && isDraft;
  const nodeName = (id: string) => nodes.find((n) => n.id === id)?.code ?? "?";

  const [nd, setNd] = useState({ code: "", name: "", nodeType: "task", assigneeRole: "", slaMinutes: "" });
  const [ed, setEd] = useState({ fromNodeId: "", toNodeId: "", guard: "", label: "" });

  function run(fn: () => Promise<{ ok: boolean; error?: string; issues?: { code: string; node?: string }[] }>) {
    setMsg(null); setIssues([]);
    start(async () => {
      const r = await fn();
      if (!r.ok) { setMsg(r.error ?? "error"); if (r.issues) setIssues(r.issues); }
      else router.refresh();
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <BackButton fallback="/workflows" />
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--accent-2)" }}>{def.code}</span>
          <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 20, margin: 0, color: "var(--text)" }}>{def.name}</h1>
          <DefStatusBadge status={def.status} />
        </div>
        {canManage && (
          <div style={{ display: "flex", gap: 8 }}>
            {isDraft && <button onClick={() => run(() => publishDefinition(def.id))} disabled={pending} style={btnPrimary}>{t("wf.publish")}</button>}
            {def.status === "active" && <button onClick={() => run(() => setDefinitionStatus(def.id, "draft"))} disabled={pending} style={btnGhost}>{t("wf.unpublish")}</button>}
            {def.status === "active" && <button onClick={() => run(() => setDefinitionStatus(def.id, "inactive"))} disabled={pending} style={btnGhost}>{t("sla.rule.deactivate")}</button>}
            {def.status === "inactive" && <button onClick={() => run(() => setDefinitionStatus(def.id, "draft"))} disabled={pending} style={btnGhost}>{t("wf.toDraft")}</button>}
          </div>
        )}
      </div>
      {def.description && <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{def.description}</div>}
      {msg && issues.length === 0 && <div style={{ fontSize: 12, color: "var(--st-critical)" }}>{msg}</div>}
      {issues.length > 0 && (
        <div style={{ background: "var(--st-critical-bg)", borderRadius: "var(--r-md)", padding: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--st-critical-fg)", marginBottom: 6 }}>{t("wf.publish.blocked")}</div>
          {issues.map((i, k) => <div key={k} style={{ fontSize: 12, color: "var(--st-critical-fg)" }}>• {t(i.code as MessageKey)}{i.node ? `: ${i.node}` : ""}</div>)}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Nodos */}
        <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 20 }}>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, marginBottom: 14 }}>{t("wf.nodes")} ({nodes.length})</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: editable ? 16 : 0 }}>
            {nodes.map((n) => (
              <div key={n.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: "var(--r-md)", background: "var(--paper)" }}>
                <span style={{ fontSize: 13 }}>{NODE_ICON[n.node_type] ?? "◻"}</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent-2)" }}>{n.code}</span>
                <span style={{ fontSize: 12.5, color: "var(--text)", flex: 1 }}>{n.name}</span>
                <span style={{ fontSize: 10.5, color: "var(--muted)" }}>{t(("wf.nt." + n.node_type) as MessageKey)}{n.assignee_role ? ` · ${n.assignee_role}` : ""}</span>
                {editable && <button onClick={() => run(() => deleteNode(def.id, n.id))} disabled={pending} style={btnX}>✕</button>}
              </div>
            ))}
          </div>
          {editable && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, borderTop: "1px solid var(--line-soft)", paddingTop: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <input placeholder={t("wf.def.code")} value={nd.code} onChange={(e) => setNd({ ...nd, code: e.target.value })} style={inp} />
                <input placeholder={t("wf.def.name")} value={nd.name} onChange={(e) => setNd({ ...nd, name: e.target.value })} style={inp} />
                <select value={nd.nodeType} onChange={(e) => setNd({ ...nd, nodeType: e.target.value })} style={inp}>{NODE_TYPES.map((x) => <option key={x} value={x}>{t(("wf.nt." + x) as MessageKey)}</option>)}</select>
                <select value={nd.assigneeRole} onChange={(e) => setNd({ ...nd, assigneeRole: e.target.value })} style={inp}><option value="">{t("wf.norole")}</option>{options.roles.map((r) => <option key={r.code} value={r.code}>{r.name}</option>)}</select>
              </div>
              <button onClick={() => run(async () => { const r = await addNode(def.id, { ...nd, slaMinutes: nd.slaMinutes ? Number(nd.slaMinutes) : null }); if (r.ok) setNd({ code: "", name: "", nodeType: "task", assigneeRole: "", slaMinutes: "" }); return r; })} disabled={pending} style={btnAdd}>+ {t("wf.addnode")}</button>
            </div>
          )}
        </div>

        {/* Aristas */}
        <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 20 }}>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, marginBottom: 14 }}>{t("wf.edges")} ({edges.length})</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: editable ? 16 : 0 }}>
            {edges.map((e) => (
              <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: "var(--r-md)", background: "var(--paper)", fontFamily: "var(--font-mono)", fontSize: 11 }}>
                <span style={{ color: "var(--text)" }}>{nodeName(e.from_node_id)}</span>
                <span style={{ color: "var(--muted)" }}>→</span>
                <span style={{ color: "var(--text)", flex: 1 }}>{nodeName(e.to_node_id)}</span>
                {e.guard && <span style={{ fontSize: 10, color: "var(--st-eval)", background: "var(--st-eval-bg)", padding: "1px 6px", borderRadius: "var(--r-pill)" }}>{e.guard}</span>}
                {editable && <button onClick={() => run(() => deleteEdge(def.id, e.id))} disabled={pending} style={btnX}>✕</button>}
              </div>
            ))}
          </div>
          {editable && nodes.length >= 2 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, borderTop: "1px solid var(--line-soft)", paddingTop: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                <select value={ed.fromNodeId} onChange={(e) => setEd({ ...ed, fromNodeId: e.target.value })} style={inp}><option value="">{t("wf.from")}</option>{nodes.map((n) => <option key={n.id} value={n.id}>{n.code}</option>)}</select>
                <select value={ed.toNodeId} onChange={(e) => setEd({ ...ed, toNodeId: e.target.value })} style={inp}><option value="">{t("wf.to")}</option>{nodes.map((n) => <option key={n.id} value={n.id}>{n.code}</option>)}</select>
                <select value={ed.guard} onChange={(e) => setEd({ ...ed, guard: e.target.value })} style={inp}>{GUARDS.map((g) => <option key={g} value={g}>{g || t("wf.guard.default")}</option>)}</select>
              </div>
              <button onClick={() => run(async () => { const r = await addEdge(def.id, ed); if (r.ok) setEd({ fromNodeId: "", toNodeId: "", guard: "", label: "" }); return r; })} disabled={pending || !ed.fromNodeId || !ed.toNodeId} style={btnAdd}>+ {t("wf.addedge")}</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const inp: React.CSSProperties = { width: "100%", fontSize: 12.5, padding: "7px 9px", borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: "var(--card)", color: "var(--text)", fontFamily: "var(--font-ui)" };
const btnPrimary: React.CSSProperties = { fontSize: 12.5, fontWeight: 600, padding: "8px 14px", borderRadius: "var(--r-md)", border: "none", background: "var(--cta-bg)", color: "var(--cta-fg)", cursor: "pointer" };
const btnGhost: React.CSSProperties = { fontSize: 12.5, fontWeight: 600, padding: "8px 14px", borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: "var(--card)", color: "var(--text)", cursor: "pointer" };
const btnAdd: React.CSSProperties = { fontSize: 12, fontWeight: 600, padding: "7px 12px", borderRadius: "var(--r-md)", border: "1px dashed var(--line)", background: "transparent", color: "var(--accent-2)", cursor: "pointer" };
const btnX: React.CSSProperties = { fontSize: 11, padding: "2px 7px", borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: "var(--card)", color: "var(--st-critical)", cursor: "pointer" };
