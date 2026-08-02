"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/provider";
import { Icon } from "@/components/ui/icon";
import type { Aggregator } from "@/lib/portal/duplicates";

// Bloque de duplicados en el registro (P4). Es la palanca de mayor impacto sobre el desempeno de
// la mesa: en vez de abrir el decimo duplicado, el usuario se suma a un caso agrupador (caso hijo
// vinculado). Tokens del DS (tema claro/oscuro), R5 (tiempos en lenguaje humano), R6/R7.

/** Compromiso horario en lenguaje humano (R5): "hoy antes de las 3:22 p. m." Nunca jerga ni negativos. */
function formatEta(iso: string | null, locale: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const time = d.toLocaleTimeString(locale === "en" ? "en-US" : "es-CR", { hour: "numeric", minute: "2-digit", hour12: true });
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const tomorrow = new Date(today.getTime() + 86400000);
  const isTomorrow = d.toDateString() === tomorrow.toDateString();
  if (sameDay) return locale === "en" ? `today before ${time}` : `hoy antes de las ${time}`;
  if (isTomorrow) return locale === "en" ? `tomorrow before ${time}` : `mañana antes de las ${time}`;
  const date = d.toLocaleDateString(locale === "en" ? "en-US" : "es-CR", { day: "numeric", month: "short" });
  return locale === "en" ? `${date} before ${time}` : `${date} antes de las ${time}`;
}

/** P4.2 · "N personas reportaron lo mismo hoy" + causa + accion/ETA + sumarse / mi caso es distinto. */
export function DuplicateBlock({ agg, busy, onJoin, onDismiss }: {
  agg: Aggregator; busy: boolean; onJoin: () => void; onDismiss: () => void;
}) {
  const { t, locale } = useI18n();
  const eta = formatEta(agg.etaAt, locale);
  return (
    <div role="status" style={{ background: "var(--st-info-bg)", border: "1px solid var(--st-info)", borderRadius: "var(--r-lg, 16px)", padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 8 }}>
        <span aria-hidden style={{ width: 30, height: 30, flexShrink: 0, borderRadius: 9, display: "grid", placeItems: "center", background: "var(--st-info)", color: "#fff" }}><Icon name="users" size={16} color="#fff" /></span>
        <span style={{ fontSize: 14.5, fontWeight: 700, color: "var(--st-info)" }}>{t("portal.dup.headline").replace("{n}", String(agg.reportCount))}</span>
      </div>
      <div style={{ fontSize: 13, color: "var(--text)", fontWeight: 600, marginBottom: agg.cause || agg.correctiveAction || eta ? 8 : 12 }}>{agg.title}</div>
      {agg.cause && <div style={{ fontSize: 12.5, color: "var(--text)", marginBottom: 4 }}><b>{t("portal.dup.cause")}:</b> {agg.cause}</div>}
      {agg.correctiveAction && <div style={{ fontSize: 12.5, color: "var(--text)", marginBottom: 4 }}><b>{t("portal.dup.action")}:</b> {agg.correctiveAction}</div>}
      {eta && <div style={{ fontSize: 12.5, color: "var(--text)", marginBottom: 12 }}><b>{t("portal.dup.eta")}:</b> {eta}</div>}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 4 }}>
        <button type="button" onClick={onJoin} disabled={busy} className="cx-btn-primary" style={{ height: 46, borderRadius: 12 }}>
          {t("portal.dup.join")}
        </button>
        <button type="button" onClick={onDismiss} disabled={busy} className="cx-btn-outline" style={{ height: 46, borderRadius: 12 }}>
          {t("portal.dup.distinct")}
        </button>
      </div>
    </div>
  );
}

/** (b) · "Esto ya se resolvio antes": casos PROPIOS parecidos que ya estan resueltos. Bloque
 *  independiente y DESCARTABLE (X). Cada fila enlaza al caso y ofrece "Volvio a pasar" (reporta un
 *  caso nuevo marcado reincidencia). Complementa (a) "ya reportado por otras personas" (DuplicateBlock).
 *  Tokens del DS (tema claro/oscuro), R5/R6/R7. */
export type ResolvedHit = { id: string; number: string; title: string; href: string; canOpen: boolean };
export function ResolvedBefore({ items, busy, onAgain, onDismiss }: {
  items: ResolvedHit[]; busy: boolean; onAgain: (id: string) => void; onDismiss: () => void;
}) {
  const { t } = useI18n();
  if (items.length === 0) return null;
  return (
    <div role="status" style={{ background: "var(--st-low-bg)", border: "1px solid var(--st-low-fg, var(--st-low))", borderRadius: "var(--r-lg, 16px)", padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 4 }}>
        <span aria-hidden style={{ width: 30, height: 30, flexShrink: 0, borderRadius: 9, display: "grid", placeItems: "center", background: "var(--st-low-fg, var(--st-low))", color: "#fff" }}><Icon name="check" size={16} color="#fff" /></span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontSize: 14.5, fontWeight: 700, color: "var(--st-low-fg, var(--st-low))" }}>{t("portal.resolved.title")}</span>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>{t("portal.resolved.sub")}</span>
        </span>
        <button type="button" onClick={onDismiss} aria-label={t("portal.strip.dismiss")} className="cx-ds-btn"
          style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--st-low-fg, var(--st-low))", display: "inline-flex", padding: 10, minHeight: 44, minWidth: 44, alignItems: "center", justifyContent: "center" }}>
          <Icon name="x" size={16} aria-hidden />
        </button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
        {items.map((it) => (
          <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 13px", background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-md, 12px)", minHeight: 52 }}>
            <span style={{ flexShrink: 0, fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--accent-2)" }}>{it.number}</span>
            <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.title}</span>
            {it.canOpen && (
              <Link href={it.href} className="cx-ds-btn" style={{ flexShrink: 0, fontSize: 12.5, fontWeight: 700, color: "var(--accent-2)", textDecoration: "none", padding: "6px 8px" }}>
                {t("portal.strip.action.open")} →
              </Link>
            )}
            <button type="button" onClick={() => onAgain(it.id)} disabled={busy} className="cx-btn-outline" style={{ height: 40, borderRadius: 11, fontSize: 12.5, padding: "0 14px", flexShrink: 0 }}>
              {t("inbox.user.again")}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/** P4.5 · "Reportado hoy por otras personas": hasta 3 agrupadores 24h, cada uno con "Tambien me pasa"
 *  (registra el reporte en un clic, sin llenar el formulario). Es la via mas rapida y la que mas
 *  duplicados evita. */
export function TrendingAggregators({ items, busyId, onJoin }: {
  items: Aggregator[]; busyId: string | null; onJoin: (a: Aggregator) => void;
}) {
  const { t } = useI18n();
  if (items.length === 0) return null;
  return (
    <div>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>{t("portal.dup.trending.title")}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map((a) => (
          <div key={a.parentId} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 13px", background: "var(--paper)", border: "1px solid var(--line)", borderRadius: "var(--r-md, 12px)", minHeight: 52 }}>
            <span style={{ flexShrink: 0, fontSize: 11.5, fontWeight: 700, color: "var(--st-info)", background: "var(--st-info-bg)", padding: "3px 9px", borderRadius: "var(--r-pill)" }}>
              {t("portal.dup.count").replace("{n}", String(a.reportCount))}
            </span>
            <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.title}</span>
            <button type="button" onClick={() => onJoin(a)} disabled={busyId === a.parentId} className="cx-btn-outline" style={{ height: 40, borderRadius: 11, fontSize: 13, padding: "0 16px", flexShrink: 0 }}>
              {busyId === a.parentId ? t("portal.create.submitting") : t("portal.dup.metoo")}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
