"use client";

import { useRouter } from "next/navigation";
import { useMemo, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import type { ProductChannelMatrix } from "@/lib/process/queries";
import { linkProductChannel, unlinkProductChannel } from "@/lib/process/actions";
import { matrixDensity } from "@/lib/process/validation";

const AVAIL_COLOR: Record<string, string> = { active: "var(--st-low-fg)", pilot: "var(--st-medium-fg)", retired: "var(--muted)" };
// ciclo al hacer click: vacio -> active -> pilot -> retired -> vacio
const NEXT: Record<string, string | null> = { "": "active", active: "pilot", pilot: "retired", retired: null };

export function ProductChannelMatrixView({ matrix, canManage }: { matrix: ProductChannelMatrix; canManage: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();

  const cellMap = useMemo(() => {
    const m = new Map<string, { availability: string; link_id: string }>();
    for (const c of matrix.cells) m.set(`${c.product_id}:${c.channel_id}`, { availability: c.availability, link_id: c.link_id });
    return m;
  }, [matrix.cells]);

  const density = matrixDensity(matrix.covered, matrix.products.length, matrix.channels.length);

  function cycle(productId: string, channelId: string) {
    if (!canManage || pending) return;
    const cur = cellMap.get(`${productId}:${channelId}`);
    const next = NEXT[cur?.availability ?? ""];
    start(async () => {
      if (cur && next === null) await unlinkProductChannel(cur.link_id);
      else if (cur) { await unlinkProductChannel(cur.link_id); await linkProductChannel({ productId, channelId, availability: next as string }); }
      else if (next) await linkProductChannel({ productId, channelId, availability: next });
      router.refresh();
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("proc.pc.intro")}</div>
        <span style={{ fontSize: 11.5, color: "var(--muted)" }}>{t("proc.pc.density")}: <b style={{ fontFamily: "var(--font-mono)", color: "var(--text)" }}>{density ?? "—"}%</b></span>
        {canManage && <span style={{ fontSize: 11, color: "var(--muted)" }}>{t("proc.pc.hint")}</span>}
      </div>

      {/* Leyenda */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {(["active", "pilot", "retired"] as const).map((a) => (
          <span key={a} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--muted)" }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: AVAIL_COLOR[a] }} /> {t(("proc.avail." + a) as MessageKey)}
          </span>
        ))}
      </div>

      <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", overflow: "auto" }}>
        <table style={{ borderCollapse: "collapse", minWidth: 640 }}>
          <thead>
            <tr>
              <th style={{ ...cellHead, textAlign: "left", position: "sticky", left: 0, background: "var(--head-bg)", zIndex: 2 }}>{t("proc.pc.product")}</th>
              {matrix.channels.map((c) => <th key={c.id} style={cellHead}>{c.name}</th>)}
            </tr>
          </thead>
          <tbody>
            {matrix.products.length === 0 && <tr><td colSpan={matrix.channels.length + 1} style={{ padding: 28, textAlign: "center", color: "var(--muted)" }}>—</td></tr>}
            {matrix.products.map((p) => (
              <tr key={p.id}>
                <td style={{ ...cellBody, textAlign: "left", fontWeight: 600, position: "sticky", left: 0, background: "var(--card)", whiteSpace: "nowrap" }}>{p.name}</td>
                {matrix.channels.map((ch) => {
                  const cell = cellMap.get(`${p.id}:${ch.id}`);
                  return (
                    <td key={ch.id} onClick={() => cycle(p.id, ch.id)}
                      title={cell ? t(("proc.avail." + cell.availability) as MessageKey) : ""}
                      style={{ ...cellBody, cursor: canManage ? "pointer" : "default" }}>
                      {cell
                        ? <span style={{ display: "inline-block", width: 14, height: 14, borderRadius: 4, background: AVAIL_COLOR[cell.availability] ?? "var(--muted)" }} />
                        : <span style={{ display: "inline-block", width: 14, height: 14, borderRadius: 4, border: "1px dashed var(--line)" }} />}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const cellHead: React.CSSProperties = { fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.4px", color: "#8A948A", padding: "9px 10px", background: "var(--head-bg)", textAlign: "center", whiteSpace: "nowrap" };
const cellBody: React.CSSProperties = { fontSize: 12.5, padding: "8px 10px", borderTop: "1px solid var(--line-soft)", textAlign: "center", color: "var(--text)" };
