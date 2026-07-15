"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { useNavHistory } from "@/components/app-shell/nav-history-provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import type { ProblemFormOptions } from "@/lib/problems/queries";
import { createProblem, updateProblem, type ProblemInput } from "@/lib/problems/actions";

const PRIORITIES = ["low", "medium", "high", "critical"];

type Initial = ProblemInput & { id?: string };

export function ProblemForm({ options, initial }: { options: ProblemFormOptions; initial?: Initial }) {
  const { t } = useI18n();
  const router = useRouter();
  const { back } = useNavHistory();
  const goBack = () => back(initial?.id ? `/problems/${initial.id}` : "/problems");
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState<ProblemInput>({
    title: initial?.title ?? "",
    description: initial?.description ?? "",
    priority: initial?.priority ?? "medium",
    category: initial?.category ?? "",
    rootCauseSummary: initial?.rootCauseSummary ?? "",
    workaround: initial?.workaround ?? "",
    knownError: initial?.knownError ?? false,
    affectedServiceId: initial?.affectedServiceId ?? "",
    affectedCiId: initial?.affectedCiId ?? "",
  });
  const set = (k: keyof ProblemInput, v: unknown) => setF((p) => ({ ...p, [k]: v }));

  function submit() {
    setErr(null);
    start(async () => {
      const r = initial?.id ? await updateProblem(initial.id, f) : await createProblem(f);
      if (!r.ok) {
        setErr(r.error ?? "error");
        return;
      }
      router.push(initial?.id ? `/problems/${initial.id}` : `/problems/${r.id}`);
      router.refresh();
    });
  }

  return (
    <div style={{ maxWidth: 720, display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 22, display: "flex", flexDirection: "column", gap: 14 }}>
        <Field label={t("prob.f.title")} required>
          <input value={f.title} onChange={(e) => set("title", e.target.value)} style={inp} />
        </Field>
        <Field label={t("prob.f.description")}>
          <textarea value={f.description} onChange={(e) => set("description", e.target.value)} rows={3} style={{ ...inp, resize: "vertical" }} />
        </Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Field label={t("prob.f.priority")} required>
            <select value={f.priority} onChange={(e) => set("priority", e.target.value)} style={inp}>
              {PRIORITIES.map((p) => <option key={p} value={p}>{t(("prob.prio." + p) as MessageKey)}</option>)}
            </select>
          </Field>
          <Field label={t("prob.f.category")}>
            <select value={f.category} onChange={(e) => set("category", e.target.value)} style={inp}>
              <option value="">—</option>
              {options.categories.map((c) => <option key={c.code} value={c.name}>{c.name}</option>)}
            </select>
          </Field>
          <Field label={t("prob.f.service")}>
            <select value={f.affectedServiceId} onChange={(e) => set("affectedServiceId", e.target.value)} style={inp}>
              <option value="">—</option>
              {options.services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Field label={t("prob.f.ci")}>
            <select value={f.affectedCiId} onChange={(e) => set("affectedCiId", e.target.value)} style={inp}>
              <option value="">—</option>
              {options.apps.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </Field>
        </div>
        <Field label={t("prob.f.rca")}>
          <textarea value={f.rootCauseSummary} onChange={(e) => set("rootCauseSummary", e.target.value)} rows={3} style={{ ...inp, resize: "vertical" }} />
        </Field>
        <Field label={t("prob.f.workaround")}>
          <textarea value={f.workaround} onChange={(e) => set("workaround", e.target.value)} rows={2} style={{ ...inp, resize: "vertical" }} />
        </Field>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text)", cursor: "pointer" }}>
          <input type="checkbox" checked={f.knownError} onChange={(e) => set("knownError", e.target.checked)} />
          {t("prob.f.knownerror")}
        </label>
        {f.knownError && <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{t("prob.f.knownerror.hint")}</div>}
      </div>

      {err && <div style={{ fontSize: 12.5, color: "var(--st-critical)" }}>{err}</div>}
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={submit} disabled={pending}
          style={{ fontSize: 13, fontWeight: 600, padding: "10px 18px", borderRadius: "var(--r-md)", border: "none", background: "var(--cta-bg)", color: "var(--cta-fg)", cursor: pending ? "default" : "pointer" }}>
          {pending ? t("common.saving") : t("common.save")}
        </button>
        <button onClick={goBack} disabled={pending}
          style={{ fontSize: 13, fontWeight: 600, padding: "10px 18px", borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: "var(--card)", color: "var(--text)", cursor: "pointer" }}>
          {t("common.cancel")}
        </button>
      </div>
    </div>
  );
}

const inp: React.CSSProperties = { width: "100%", fontSize: 13, padding: "9px 11px", borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: "var(--card)", color: "var(--text)", fontFamily: "var(--font-ui)" };
function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return <div>
    <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "var(--muted)", marginBottom: 6 }}>{label}{required && <span style={{ color: "var(--st-critical)" }}> *</span>}</label>
    {children}</div>;
}
