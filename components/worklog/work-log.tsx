"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import type { IncidentEffort } from "@/lib/worklog/queries";
import { logWork } from "@/lib/worklog/actions";

/** Registro de esfuerzo (tiempo) por caso. Alimenta la medicion por persona (F5). */
export function WorkLog({ incidentId, effort, canLog }: { incidentId: string; effort: IncidentEffort; canLog: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [minutes, setMinutes] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const totalH = Math.round((effort.totalMinutes / 60) * 10) / 10;

  function add() {
    setErr(null);
    start(async () => {
      const r = await logWork(incidentId, Number(minutes), note);
      if (!r.ok) setErr(r.error ?? "error");
      else { setMinutes(""); setNote(""); router.refresh(); }
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 20, fontWeight: 500, color: "var(--text)" }}>{totalH > 0 ? `${totalH}h` : "—"}</span>
        <span style={{ fontSize: 11.5, color: "var(--muted)" }}>{t("wl2.total")}</span>
      </div>

      {effort.entries.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {effort.entries.slice(0, 5).map((e) => (
            <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5 }}>
              <span style={{ fontFamily: "var(--font-mono)", color: "var(--accent-2)" }}>{e.minutes}m</span>
              <span style={{ color: "var(--text)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.note ?? "—"}</span>
              <span style={{ color: "var(--muted)" }}>{e.member?.name ?? ""}</span>
            </div>
          ))}
        </div>
      )}

      {canLog && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", borderTop: "1px solid var(--line-soft)", paddingTop: 8 }}>
          <input type="number" min={1} value={minutes} onChange={(e) => setMinutes(e.target.value)} placeholder={t("wl2.minutes")} style={{ ...inp, width: 90 }} />
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("wl2.note")} style={{ ...inp, flex: 1, minWidth: 120 }} />
          <button onClick={add} disabled={pending || !minutes} style={{ fontSize: 12, fontWeight: 600, padding: "7px 12px", borderRadius: "var(--r-md)", border: "none", background: "var(--cta-bg)", color: "var(--cta-fg)", cursor: pending || !minutes ? "default" : "pointer" }}>{t("wl2.log")}</button>
        </div>
      )}
      {err && <div style={{ fontSize: 11, color: "var(--st-critical)" }}>{err}</div>}
    </div>
  );
}

const inp: React.CSSProperties = { fontSize: 12, padding: "7px 9px", borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: "var(--card)", color: "var(--text)", fontFamily: "var(--font-ui)" };
