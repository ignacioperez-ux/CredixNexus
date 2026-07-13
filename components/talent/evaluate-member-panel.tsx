"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n, useErrorMessage } from "@/lib/i18n/provider";
import { addMemberEvaluation } from "@/lib/talent/actions";
import { Icon } from "@/components/ui/icon";

type M = { id: string; name: string };

/** Panel de evaluacion al cierre (opt-in): en un caso resuelto evalua al responsable; en un
 *  proyecto completado, a un miembro del squad. Registra efectividad + empatia + comentario,
 *  enlazado al caso/proyecto. El parent solo lo muestra si el usuario tiene talent.manage. */
export function EvaluateMemberPanel({ members, entityType, entityId, title }: {
  members: M[];
  entityType: "incident" | "project";
  entityId: string;
  title: string;
}) {
  const { t } = useI18n();
  const errMsg = useErrorMessage();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [memberId, setMemberId] = useState(members.length === 1 ? members[0].id : "");
  const [eff, setEff] = useState("");
  const [emp, setEmp] = useState("");
  const [comment, setComment] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  if (members.length === 0) return null;

  function save() {
    setErr(null); setMsg(null);
    start(async () => {
      const r = await addMemberEvaluation(memberId, {
        evalType: entityType, entityType, entityId,
        effectiveness: eff === "" ? null : Number(eff),
        empathy: emp === "" ? null : Number(emp),
        comment: comment || undefined,
      });
      if (!r.ok) { setErr(errMsg(r.error ?? "ERR_INVALID_FORMAT")); return; }
      setMsg(t("tal.eval.saved")); setEff(""); setEmp(""); setComment(""); setOpen(false); router.refresh();
    });
  }

  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14.5, color: "var(--text)" }}>
          <Icon name="star" size={14} fill="currentColor" color="var(--accent-2)" /> {title}
        </span>
        <button onClick={() => setOpen((o) => !o)} style={ghost}>{open ? <Icon name="x" size={12} /> : <Icon name="plus" size={12} />} {t("eval.open")}</button>
      </div>

      {msg && <div style={{ fontSize: 12, color: "var(--st-low-fg)", marginTop: 8 }}>{msg}</div>}

      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
          <div style={{ fontSize: 11, color: "var(--muted)" }}>{t("eval.hint")}</div>
          {members.length > 1 && (
            <select value={memberId} onChange={(e) => setMemberId(e.target.value)} style={inp}>
              <option value="">{t("eval.pick")}</option>
              {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <Lbl t={t("tal.effectiveness") + " (0-100)"}><input type="number" min={0} max={100} value={eff} onChange={(e) => setEff(e.target.value)} style={inp} /></Lbl>
            <Lbl t={t("tal.empathy") + " (0-100)"}><input type="number" min={0} max={100} value={emp} onChange={(e) => setEmp(e.target.value)} style={inp} /></Lbl>
          </div>
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} placeholder={t("tal.eval.comment")} style={{ ...inp, resize: "vertical", fontFamily: "var(--font-ui)" }} />
          {err && <div style={{ fontSize: 12, color: "var(--st-critical-fg)" }}>{err}</div>}
          <button onClick={save} disabled={pending || !memberId} style={{ alignSelf: "flex-start", fontSize: 12.5, fontWeight: 700, padding: "8px 16px", borderRadius: "var(--r-md)", border: "none", background: memberId ? "var(--cta-bg)" : "var(--paper)", color: memberId ? "var(--cta-fg)" : "var(--muted)", cursor: pending || !memberId ? "default" : "pointer" }}>
            {t("tal.eval.save")}
          </button>
        </div>
      )}
    </div>
  );
}

function Lbl({ t, children }: { t: string; children: React.ReactNode }) {
  return <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 11, fontWeight: 600, color: "var(--muted)" }}>{t}{children}</label>;
}
const inp: React.CSSProperties = { width: "100%", fontSize: 12.5, padding: "8px 10px", borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: "var(--card)", color: "var(--text)", fontFamily: "var(--font-ui)" };
const ghost: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, padding: "6px 10px", borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: "var(--card)", color: "var(--text)", cursor: "pointer" };
