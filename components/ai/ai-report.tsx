"use client";

import { Icon } from "@/components/ui/icon";

import { useI18n } from "@/lib/i18n/provider";

// Render visual de contenido (informes IA y articulos de conocimiento). Interpreta Markdown de
// forma acotada: encabezados (# .. #### o "Titulo:"), vinetas y listas numeradas, **negritas**,
// `codigo`, [enlaces](url), bloques de codigo (```) y tablas GFM. Aditivo: el texto simple
// sigue renderizando igual que antes (no rompe a los consumidores existentes).

type Block =
  | { type: "heading"; text: string }
  | { type: "para"; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "code"; text: string }
  | { type: "table"; header: string[]; rows: string[][] };

function splitRow(line: string): string[] {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
}

function parse(raw: string): Block[] {
  const lines = (raw ?? "").replace(/\r/g, "").split("\n");
  const blocks: Block[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const flush = () => { if (list && list.items.length) blocks.push({ type: "list", ordered: list.ordered, items: list.items }); list = null; };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].replace(/\s+$/, "");

    // Bloque de codigo cercado (```)
    if (line.trim().startsWith("```")) {
      flush();
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) { buf.push(lines[i]); i++; }
      blocks.push({ type: "code", text: buf.join("\n") });
      continue;
    }

    // Listas (vineta u ordenada)
    const ul = line.match(/^\s*[-•*]\s+(.*)$/);
    const ol = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (ul || ol) {
      const ordered = !ul && !!ol;
      if (list && list.ordered !== ordered) flush();
      (list ??= { ordered, items: [] }).items.push(ul ? ul[1] : ol![1]);
      continue;
    }
    flush();

    const t = line.trim();
    if (!t) continue;

    // Encabezado ATX (# .. ####)
    const atx = t.match(/^(#{1,4})\s+(.*)$/);
    if (atx) { blocks.push({ type: "heading", text: atx[2].replace(/\s*#+\s*$/, "") }); continue; }

    // Tabla GFM: linea con | seguida de una fila separadora (---|---)
    const next = i + 1 < lines.length ? lines[i + 1] : "";
    if (t.includes("|") && /-/.test(next) && /^\s*\|?[\s:|-]+\|[\s:|-]*\|?\s*$/.test(next)) {
      const header = splitRow(t);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i].includes("|") && lines[i].trim() !== "") { rows.push(splitRow(lines[i])); i++; }
      i--;
      blocks.push({ type: "table", header, rows });
      continue;
    }

    // Heuristica previa: linea corta terminada en ":" = encabezado
    if (t.length <= 52 && /:$/.test(t) && !t.slice(0, -1).includes(":")) {
      blocks.push({ type: "heading", text: t.replace(/:$/, "") });
    } else {
      blocks.push({ type: "para", text: t });
    }
  }
  flush();
  return blocks;
}

/** Interpreta **negritas**, `codigo` y [enlaces](url) dentro de una linea (preserva el resto). */
function inline(text: string): React.ReactNode {
  const re = /(\*\*(.+?)\*\*)|(`([^`]+?)`)|(\[([^\]]+)\]\((https?:\/\/[^\s)]+)\))/g;
  const out: React.ReactNode[] = [];
  let last = 0; let k = 0; let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(<span key={k++}>{text.slice(last, m.index)}</span>);
    if (m[2] != null) out.push(<strong key={k++} style={{ color: "var(--text)", fontWeight: 700 }}>{m[2]}</strong>);
    else if (m[4] != null) out.push(<code key={k++} style={{ fontFamily: "var(--font-mono)", fontSize: "0.92em", background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 4, padding: "1px 5px" }}>{m[4]}</code>);
    else if (m[6] != null) out.push(<a key={k++} href={m[7]} target="_blank" rel="noreferrer" style={{ color: "var(--accent-2)", textDecoration: "underline" }}>{m[6]}</a>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(<span key={k++}>{text.slice(last)}</span>);
  return out.length ? out : text;
}

export function AiReport({ text, framed = true }: { text: string; framed?: boolean }) {
  const { t } = useI18n();
  const blocks = parse(text);

  const body = (
    <div style={{ fontSize: 13, lineHeight: 1.65, color: "var(--text)", display: "flex", flexDirection: "column", gap: 9 }}>
      {blocks.map((b, i) => {
        if (b.type === "heading")
          return <div key={i} style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.7px", color: "var(--accent-2)", marginTop: i ? 4 : 0 }}>{b.text}</div>;
        if (b.type === "code")
          return <pre key={i} style={{ margin: 0, overflowX: "auto", background: "var(--paper)", border: "1px solid var(--line)", borderRadius: "var(--r-sm)", padding: "10px 12px", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text)", lineHeight: 1.5 }}>{b.text}</pre>;
        if (b.type === "table")
          return (
            <div key={i} style={{ overflowX: "auto" }}>
              <table style={{ borderCollapse: "collapse", fontSize: 12.5, width: "100%" }}>
                <thead><tr>{b.header.map((h, j) => <th key={j} style={{ textAlign: "left", padding: "7px 10px", borderBottom: "2px solid var(--line)", color: "var(--muted)", fontWeight: 700, whiteSpace: "nowrap" }}>{inline(h)}</th>)}</tr></thead>
                <tbody>{b.rows.map((r, ri) => <tr key={ri}>{r.map((c, ci) => <td key={ci} style={{ padding: "7px 10px", borderBottom: "1px solid var(--line-soft)", color: "var(--text)" }}>{inline(c)}</td>)}</tr>)}</tbody>
              </table>
            </div>
          );
        if (b.type === "list")
          return (
            <ul key={i} style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
              {b.items.map((it, j) => (
                <li key={j} style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
                  <span style={{ color: "var(--accent)", flexShrink: 0, lineHeight: 1.5, fontSize: b.ordered ? 12.5 : 15, fontFamily: b.ordered ? "var(--font-mono)" : undefined, fontWeight: b.ordered ? 600 : undefined, minWidth: b.ordered ? 16 : undefined }}>{b.ordered ? `${j + 1}.` : "•"}</span>
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
