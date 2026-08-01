"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/provider";
import { Icon } from "@/components/ui/icon";

// Bandeja de casos AGRUPADA POR ACCION (P3). Componente generico reutilizado en TODOS los perfiles:
// cambia el conjunto de datos y las columnas, NO el patron (R4). El criterio primario de agrupacion
// es "de quien es la pelota", no el estado interno del workflow. Los filtros/busqueda existen pero
// detras de un control secundario, no como estructura primaria. Tokens del DS, R5/R6/R7.

export type InboxTone = "attention" | "info" | "resolved" | "neutral";

export type InboxAction = {
  key: string;
  label: string;
  variant?: "primary" | "secondary";
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
};

export type InboxRow = {
  id: string;
  number?: string;
  title: string;
  href?: string;              // fila clicable (abrir caso)
  subtitle?: ReactNode;       // "Ana Ramirez te pregunto hace 2 horas" / avance real
  whoName?: string | null;    // avatar con iniciales (quien atiende)
  meta?: string | null;       // compromiso horario a la derecha (lenguaje humano)
  metaOverdue?: boolean;      // pinta el compromiso en rojo si esta vencido
  actions?: InboxAction[];
};

export type InboxGroup = {
  key: string;
  title: string;
  tone: InboxTone;
  icon?: string;
  hint?: string;              // "no necesitas hacer nada"
  rows: InboxRow[];
};

const TONE: Record<InboxTone, { bg: string; border: string; fg: string; dot: string }> = {
  attention: { bg: "var(--acc-amber-bg, var(--st-high-bg))", border: "var(--acc-amber-border, var(--st-high))", fg: "var(--acc-amber-ink, var(--st-high-fg))", dot: "var(--acc-amber-ink, var(--st-high))" },
  info: { bg: "var(--card)", border: "var(--line)", fg: "var(--st-info)", dot: "var(--st-info)" },
  resolved: { bg: "var(--paper)", border: "var(--line)", fg: "var(--st-low-fg, var(--st-low))", dot: "var(--st-low-fg, var(--st-low))" },
  neutral: { bg: "var(--card)", border: "var(--line)", fg: "var(--muted)", dot: "var(--muted)" },
};

function initials(name?: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/[\s@.]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

function ActionButton({ a }: { a: InboxAction }) {
  const cls = a.variant === "primary" ? "cx-btn-primary" : "cx-btn-outline";
  const style: React.CSSProperties = { height: 44, minHeight: 44, borderRadius: 11, fontSize: 13, padding: "0 16px", flexShrink: 0 };
  if (a.href) return <Link href={a.href} className={cls} style={{ ...style, textDecoration: "none", display: "inline-flex", alignItems: "center" }}>{a.label}</Link>;
  return <button type="button" onClick={a.onClick} disabled={a.disabled} className={cls} style={style}>{a.label}</button>;
}

function Row({ row, tone }: { row: InboxRow; tone: InboxTone }) {
  const t = TONE[tone];
  const inner = (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 13px", minHeight: 56, background: tone === "attention" ? "var(--card)" : "var(--paper)", border: "1px solid var(--line)", borderRadius: "var(--r-md, 12px)" }}>
      {row.whoName !== undefined ? (
        <span aria-hidden style={{ width: 34, height: 34, flexShrink: 0, borderRadius: "50%", background: "var(--accent-soft)", color: "var(--accent-2)", display: "grid", placeItems: "center", fontSize: 12.5, fontWeight: 700, fontFamily: "var(--font-mono)" }}>{initials(row.whoName)}</span>
      ) : (
        <span aria-hidden style={{ width: 9, height: 9, flexShrink: 0, borderRadius: "50%", background: t.dot }} />
      )}
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {row.number && <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--accent-2)" }}>{row.number}</span>}
          <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.title}</span>
        </span>
        {row.subtitle && <span style={{ display: "block", fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>{row.subtitle}</span>}
      </span>
      {row.meta && (
        <span style={{ fontSize: 12, fontWeight: 600, flexShrink: 0, color: row.metaOverdue ? "var(--st-critical-fg, var(--st-critical))" : "var(--muted)" }}>{row.meta}</span>
      )}
      {row.actions?.map((a) => <ActionButton key={a.key} a={a} />)}
    </div>
  );
  return row.href ? <Link href={row.href} className="cx-lift" style={{ textDecoration: "none", display: "block" }}>{inner}</Link> : inner;
}

export function CaseInbox({ groups, search, emptyLabel }: {
  groups: InboxGroup[];
  search?: { value: string; onChange: (v: string) => void; placeholder: string };
  emptyLabel?: string;
}) {
  const { t } = useI18n();
  const [showSearch, setShowSearch] = useState(false);
  const visible = groups.filter((g) => g.rows.length > 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Busqueda/filtros detras de un control SECUNDARIO (no estructura primaria, R4). */}
      {search && (
        <div>
          <button type="button" onClick={() => setShowSearch((s) => !s)} className="cx-btn-outline" style={{ height: 40, minHeight: 40, borderRadius: 10, fontSize: 13, padding: "0 14px" }}>
            <Icon name="search" size={14} aria-hidden /> {t("inbox.search.toggle")}
          </button>
          {showSearch && (
            <input value={search.value} onChange={(e) => search.onChange(e.target.value)} placeholder={search.placeholder}
              style={{ marginTop: 8, width: "100%", height: 44, padding: "0 13px", borderRadius: "var(--r-md)", border: "1px solid var(--field-border, var(--line))", background: "var(--field-bg, var(--card))", color: "var(--text)", fontFamily: "var(--font-ui)", fontSize: 14 }} />
          )}
        </div>
      )}

      {visible.length === 0 && <div style={{ fontSize: 13, color: "var(--muted)", padding: "8px 2px" }}>{emptyLabel ?? t("inbox.empty")}</div>}

      {visible.map((g) => {
        const tone = TONE[g.tone];
        return (
          <section key={g.key} style={g.tone === "attention" ? { background: tone.bg, border: `1px solid ${tone.border}`, borderRadius: "var(--r-2xl, 18px)", padding: 16 } : undefined}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              {g.tone === "attention" ? <Icon name={g.icon ?? "alert"} size={16} color={tone.fg} aria-hidden />
                : <span aria-hidden style={{ width: 9, height: 9, borderRadius: "50%", background: tone.dot }} />}
              <span style={{ fontFamily: "var(--font-display)", fontSize: 14.5, fontWeight: 700, color: g.tone === "attention" ? tone.fg : "var(--text)" }}>{g.title}</span>
              {g.hint && <span style={{ fontSize: 12, color: "var(--muted)" }}>· {g.hint}</span>}
              <span style={{ fontSize: 12, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>{g.rows.length}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {g.rows.map((r) => <Row key={r.id} row={r} tone={g.tone} />)}
            </div>
          </section>
        );
      })}
    </div>
  );
}
