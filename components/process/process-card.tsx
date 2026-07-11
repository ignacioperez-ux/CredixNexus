"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import { BackButton } from "@/components/common/back-button";
import type { ProcessDetail } from "@/lib/process/queries";
import { SYSTEM_ROLES } from "@/lib/process/validation";
import { linkProcessSystem, unlinkProcessSystem } from "@/lib/process/actions";

const CRIT: Record<string, string> = { critical: "var(--st-critical-fg)", high: "var(--st-high-fg)", medium: "var(--st-medium-fg)", low: "var(--st-low-fg)" };

export function ProcessCard({ detail, systems, canManage }: { detail: ProcessDetail; systems: { id: string; name: string; ci_type: string }[]; canManage: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [ciId, setCiId] = useState("");
  const [role, setRole] = useState("primary");
  const [crit, setCrit] = useState("medium");
  const [err, setErr] = useState<string | null>(null);
  const p = detail.process;

  const linkedIds = new Set(detail.systems.map((s) => s.ci_id));
  const options = systems.filter((s) => !linkedIds.has(s.id));

  function add() {
    setErr(null);
    start(async () => {
      const r = await linkProcessSystem({ processId: p.id, ciId, role, criticality: crit });
      if (!r.ok) { setErr(r.error === "ERR_DUPLICATE_CODE" ? t("err.ERR_DUPLICATE_CODE") : t(("err." + (r.error ?? "ERR_INVALID_FORMAT")) as MessageKey)); return; }
      setCiId("");
      router.refresh();
    });
  }
  function remove(id: string) { start(async () => { await unlinkProcessSystem(id, p.id); router.refresh(); }); }

  const sel: React.CSSProperties = { fontSize: 12.5, padding: "8px 10px", borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: "var(--card)", color: "var(--text)" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 900 }}>
      <BackButton fallback="/processes" />
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--accent-2)" }}>{p.code}</span>
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: p.process_level === "macro" ? "var(--accent-2)" : "var(--muted)" }}>{t(("proc.level." + p.process_level) as MessageKey)}</span>
        {p.parent && <Link href={`/processes/${p.parent.id}`} style={{ fontSize: 11.5, color: "var(--muted)", textDecoration: "none" }}>↑ {p.parent.name}</Link>}
      </div>
      <h1 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 700, color: "var(--text)" }}>{p.name}</h1>

      {/* Ficha: dueno (accountable) + objetivo */}
      <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 20, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
        <Field label={t("proc.owner.accountable")} value={p.business_unit ?? "—"} />
        <Field label={t("proc.col.level")} value={t(("proc.level." + p.process_level) as MessageKey)} />
        <Field label={t("proc.subprocesses")} value={String(detail.children.length)} mono />
        <Field label={t("proc.col.systems")} value={String(detail.systems.length)} mono />
      </div>
      {p.objective && (
        <div style={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: "var(--r-md)", padding: "12px 14px", fontSize: 13, color: "var(--text)" }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", color: "var(--muted)", marginBottom: 4 }}>{t("proc.objective")}</div>
          {p.objective}
        </div>
      )}

      {/* Subprocesos */}
      {detail.children.length > 0 && (
        <Section title={`${t("proc.subprocesses")} (${detail.children.length})`}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {detail.children.map((c) => (
              <Link key={c.id} href={`/processes/${c.id}`} style={{ fontSize: 12, color: "var(--text)", background: "var(--paper)", border: "1px solid var(--line)", padding: "6px 11px", borderRadius: "var(--r-pill)", textDecoration: "none" }}>{c.name}</Link>
            ))}
          </div>
        </Section>
      )}

      {/* Matriz proceso -> sistema */}
      <Section title={t("proc.systems.title")}>
        {detail.systems.length === 0 ? <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("proc.systems.none")}</div> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {detail.systems.map((s) => (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-md)" }}>
                <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", color: s.ci_type === "application" ? "var(--accent-2)" : "var(--st-info)", width: 70 }}>{s.ci_type}</span>
                <span style={{ flex: 1, fontSize: 13, color: "var(--text)" }}>{s.ci_name}</span>
                <span style={{ fontSize: 10.5, fontWeight: 600, color: "var(--muted)" }}>{t(("proc.role." + s.role) as MessageKey)}</span>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: CRIT[s.criticality] }}>{t(("lvl." + s.criticality) as MessageKey)}</span>
                {canManage && <button onClick={() => remove(s.id)} disabled={pending} aria-label={t("proc.unlink")} style={{ width: 20, height: 20, borderRadius: "50%", border: "none", background: "transparent", color: "var(--st-critical-fg)", cursor: "pointer", fontSize: 14 }}>×</button>}
              </div>
            ))}
          </div>
        )}

        {canManage && (
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap", marginTop: 12, paddingTop: 12, borderTop: "1px dashed var(--line)" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>
              {t("proc.systems.add")}
              <select value={ciId} onChange={(e) => setCiId(e.target.value)} style={{ ...sel, minWidth: 200 }}>
                <option value="">{t("proc.systems.choose")}</option>
                {options.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>
              {t("proc.role")}
              <select value={role} onChange={(e) => setRole(e.target.value)} style={sel}>
                {SYSTEM_ROLES.map((r) => <option key={r} value={r}>{t(("proc.role." + r) as MessageKey)}</option>)}
              </select>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>
              {t("proc.criticality")}
              <select value={crit} onChange={(e) => setCrit(e.target.value)} style={sel}>
                {["critical", "high", "medium", "low"].map((c) => <option key={c} value={c}>{t(("lvl." + c) as MessageKey)}</option>)}
              </select>
            </label>
            <button onClick={add} disabled={pending || !ciId}
              style={{ fontSize: 12.5, fontWeight: 600, padding: "9px 16px", borderRadius: "var(--r-md)", border: "none", background: "var(--cta-bg)", color: "var(--cta-fg)", cursor: pending || !ciId ? "default" : "pointer", opacity: !ciId ? 0.6 : 1 }}>
              {t("proc.systems.link")}
            </button>
          </div>
        )}
        {err && <div style={{ fontSize: 12, color: "var(--st-critical-fg)", marginTop: 8 }}>{err}</div>}
      </Section>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return <div><div style={{ fontSize: 10.5, fontWeight: 600, color: "var(--muted)", marginBottom: 5 }}>{label}</div><div style={{ fontSize: 13.5, color: "var(--text)", fontFamily: mono ? "var(--font-mono)" : "var(--font-ui)" }}>{value}</div></div>;
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 20 }}>
    <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, color: "var(--text)", marginBottom: 12 }}>{title}</div>{children}</div>;
}
