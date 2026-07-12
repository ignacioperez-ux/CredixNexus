"use client";

import { Icon } from "@/components/ui/icon";

import { useI18n } from "@/lib/i18n/provider";

// Render visual de informes IA: interpreta el texto (encabezados "Titulo:", vinetas
// "- ", **negritas**) y lo presenta con tipografia agradable en una superficie de marca.
// Reemplaza el "pre-wrap con caracteres" por un informe legible y consistente.

type Block =
  | { type: "heading"; text: string }
  | { type: "para"; text: string }
  | { type: "list"; items: string[] };

function parse(raw: string): Block[] {
  const lines = (raw ?? "").replace(/\r/g, "").split("\n");
  const blocks: Block[] = [];
  let list: string[] | null = null;
  const flush = () => { if (list && list.length) blocks.push({ type: "list", items: list }); list = null; };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const bullet = line.match(/^\s*[-•*]\s+(.*)$/) || line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (bullet) { (list ??= []).push(bullet[1]); continue; }
    flush();
    const t = line.trim();
    if (!t) continue;
    // Encabezado: linea corta que termina en ":" (p.ej. "Causa raiz probable:")
    if (t.length <= 52 && /:$/.test(t) && !t.slice(0, -1).includes(":")) {
      blocks.push({ type: "heading", text: t.replace(/:$/, "") });
    } else {
      blocks.push({ type: "para", text: t });
    }
  }
  flush();
  return blocks;
}

/** Interpreta **negritas** dentro de una linea. */
function inline(text: string): React.ReactNode {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return parts.map((p, i) => (i % 2 === 1 ? <strong key={i} style={{ color: "var(--text)", fontWeight: 700 }}>{p}</strong> : <span key={i}>{p}</span>));
}

export function AiReport({ text, framed = true }: { text: string; framed?: boolean }) {
  const { t } = useI18n();
  const blocks = parse(text);

  const body = (
    <div style={{ fontSize: 13, lineHeight: 1.65, color: "var(--text)", display: "flex", flexDirection: "column", gap: 9 }}>
      {blocks.map((b, i) => {
        if (b.type === "heading")
          return <div key={i} style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.7px", color: "var(--accent-2)", marginTop: i ? 4 : 0 }}>{b.text}</div>;
        if (b.type === "list")
          return (
            <ul key={i} style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
              {b.items.map((it, j) => (
                <li key={j} style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
                  <span style={{ color: "var(--accent)", flexShrink: 0, lineHeight: 1.5, fontSize: 15 }}>•</span>
                  <span style={{ flex: 1 }}>{inline(it)}</span>
                </li>
              ))}
            </ul>
          );
        return <p key={i} style={{ margin: 0 }}>{inline(b.text)}</p>;
      })}
    </div>
  );

  if (!framed) return body;

  return (
    <div style={{ background: "var(--paper)", border: "1px solid var(--line)", borderLeft: "3px solid var(--accent)", borderRadius: "var(--r-md)", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
      {body}
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10.5, color: "var(--muted)", borderTop: "1px solid var(--line-soft)", paddingTop: 8 }}>
        <Icon name="sparkle" size={13} color="var(--accent-bright)" style={{ verticalAlign: "-2px" }} /> {t("ai.footer")}
      </div>
    </div>
  );
}
