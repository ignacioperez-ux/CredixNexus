"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useI18n, useErrorMessage } from "@/lib/i18n/provider";
import { useRouter } from "next/navigation";
import { markDuplicate, revokeDuplicate, checkSimilarCases } from "@/lib/incidents/actions";
import type { DuplicateLinks } from "@/lib/incidents/duplicates";
import type { SimilarCaseHit } from "@/lib/incidents/similar";
import { statusKey, statusColors } from "@/lib/incidents/labels";
import { Icon } from "@/components/ui/icon";

// Panel de duplicados (Fase 3). No destructivo: marcar duplicado NO cierra el caso; solo enlaza y
// preserva el hilo (client-centric). Marcar/revocar es gestion (canManage = assign/triage).

export function DuplicatesPanel({ incidentId, incidentTitle, links, canManage }: {
  incidentId: string; incidentTitle: string; links: DuplicateLinks; canManage: boolean;
}) {
  const { t } = useI18n();
  const errMsg = useErrorMessage();
  const router = useRouter();
  const [picking, setPicking] = useState(false);
  const [candidates, setCandidates] = useState<SimilarCaseHit[] | null>(null);
  const [busy, startBusy] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function openPicker() {
    setErr(null);
    setPicking(true);
    startBusy(async () => {
      const r = await checkSimilarCases({ title: incidentTitle, excludeId: incidentId });
      setCandidates(r.ok && r.items ? r.items : []);
    });
  }

  function mark(primaryId: string) {
    setErr(null);
    startBusy(async () => {
      const r = await markDuplicate(incidentId, primaryId, { source: "manual" });
      if (!r.ok) { setErr(errMsg(r.error ?? "ERR_INVALID_FORMAT")); return; }
      setPicking(false); setCandidates(null);
      router.refresh();
    });
  }

  function revoke(linkId: string) {
    setErr(null);
    startBusy(async () => {
      const r = await revokeDuplicate(linkId);
      if (!r.ok) { setErr(errMsg(r.error ?? "ERR_INVALID_FORMAT")); return; }
      router.refresh();
    });
  }

  const dupOf = links.duplicateOf;
  const primaryOf = links.primaryOf;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Este caso ES duplicado de otro */}
      {dupOf && (
        <div style={{ background: "var(--st-medium-bg)", border: "1px solid var(--st-medium)", borderRadius: "var(--r-md)", padding: "11px 13px" }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--st-medium-fg)", marginBottom: 6 }}>{t("dup.is_duplicate_of")}</div>
          <CaseRow id={dupOf.incident_id} number={dupOf.incident_number} title={dupOf.title} status={dupOf.status} />
          {canManage && <RevokeBtn onClick={() => revoke(dupOf.link_id)} disabled={busy} label={t("dup.revoke")} />}
        </div>
      )}

      {/* Este caso es CANONICO de otros */}
      {primaryOf.length > 0 && (
        <div>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>{t("dup.primary_of")} ({primaryOf.length})</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {primaryOf.map((d) => (
              <div key={d.link_id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ flex: 1 }}><CaseRow id={d.incident_id} number={d.incident_number} title={d.title} status={d.status} confidence={d.confidence} /></div>
                {canManage && <RevokeBtn onClick={() => revoke(d.link_id)} disabled={busy} label={t("dup.revoke")} />}
              </div>
            ))}
          </div>
        </div>
      )}

      {!dupOf && primaryOf.length === 0 && (
        <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("dup.empty")}</div>
      )}

      {/* Marcar este caso como duplicado (solo si aun no lo es) */}
      {canManage && !dupOf && (
        <div>
          {!picking ? (
            <button type="button" onClick={openPicker} disabled={busy} style={outlineBtn}>{t("dup.mark.btn")}</button>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>{t("dup.mark.pick")}</div>
              {busy && !candidates && <div style={{ fontSize: 12, color: "var(--muted)" }}>{t("portal.search.searching")}</div>}
              {candidates && candidates.length === 0 && <div style={{ fontSize: 12, color: "var(--muted)" }}>{t("dup.mark.none")}</div>}
              {candidates && candidates.map((c) => (
                <button key={c.id} type="button" onClick={() => mark(c.id)} disabled={busy} className="cx-lift"
                  style={{ textAlign: "left", display: "flex", alignItems: "center", gap: 8, padding: "8px 11px", background: "var(--paper)", border: "1px solid var(--line)", borderRadius: "var(--r-md)", cursor: "pointer" }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent-2)" }}>{c.incident_number}</span>
                  <span style={{ flex: 1, fontSize: 12.5, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.title}</span>
                  <Icon name="check" size={13} color="var(--accent-2)" />
                </button>
              ))}
              <button type="button" onClick={() => { setPicking(false); setCandidates(null); setErr(null); }} style={{ ...outlineBtn, alignSelf: "flex-start" }}>{t("dup.mark.cancel")}</button>
            </div>
          )}
        </div>
      )}

      {err && <div style={{ fontSize: 12, color: "var(--st-critical-fg)" }}>{err}</div>}
    </div>
  );
}

function CaseRow({ id, number, title, status, confidence }: { id: string; number: string; title: string; status: string; confidence?: number | null }) {
  const { t } = useI18n();
  const sc = statusColors(status);
  return (
    <Link href={`/incidents/${id}`} className="cx-lift" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 9, padding: "7px 10px", background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-md)" }}>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent-2)" }}>{number}</span>
      <span style={{ flex: 1, fontSize: 12.5, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</span>
      {confidence != null && <span style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>{confidence}%</span>}
      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10, fontWeight: 600, color: sc.fg, background: sc.bg, padding: "2px 8px", borderRadius: "var(--r-pill)" }}>
        <span style={{ width: 5, height: 5, borderRadius: "50%", background: sc.fg }} />{t(statusKey(status))}
      </span>
    </Link>
  );
}

function RevokeBtn({ onClick, disabled, label }: { onClick: () => void; disabled: boolean; label: string }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} style={{ marginTop: 8, fontSize: 11, fontWeight: 600, color: "var(--muted)", background: "transparent", border: "1px solid var(--line)", borderRadius: "var(--r-md)", padding: "4px 10px", cursor: "pointer" }}>{label}</button>
  );
}

const outlineBtn: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: "var(--accent-2)", background: "var(--card)", border: "1px solid var(--accent-2)", borderRadius: "var(--r-md)", padding: "7px 12px", cursor: "pointer" };
