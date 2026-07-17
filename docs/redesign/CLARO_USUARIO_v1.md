# Rediseño visual "Modo Claro · Rol Usuario" — v1

Rediseño **100% visual** del portal del usuario final en tema **Claro**. Cero cambios de
funcionalidad, lógica, textos, endpoints o datos. Tema oscuro ("Nexus") **intacto**.

## 1. Alcance y decisiones (GATE 0)

| Tema | Decisión |
|---|---|
| Sidebar dedicado (menú/CTA/badge) | **Fuera de alcance** — es lógica (`navigation.ts`) + shell compartido. |
| Pantallas Inicio/Mis casos separadas | **Restilizar el hub actual** (`portal.tsx`), sin rutas nuevas. |
| Conocimiento / Catálogo (compartidas) | **Restilizadas en Claro** (afecta staff-en-Claro, aceptado). |
| Exclusión notas/esfuerzo/eval del detalle | **Ya cumplida** — `user-case-detail.tsx` no las renderiza. |

## 2. Sub-fases y commits

| Sub-fase | Commit | Archivos |
|---|---|---|
| 1 · Tokens/fuentes | `84226f0` | `app/globals.css`, `app/layout.tsx` |
| 2 · Componentes (botones) | `84c0e1d` | `app/globals.css` |
| 3A · Hub | `0f0c63f` | `app/globals.css`, `components/portal/portal.tsx` |
| 3B · Detalle + Evaluación | `71eef82` | `app/globals.css`, `components/portal/user-case-detail.tsx`, `case-csat.tsx` |
| 3C · Conocimiento + Catálogo | `5f13fbe` | `components/knowledge/user-knowledge.tsx`, `components/catalog/catalog-grid.tsx` |

Nota: el re-tinte base de la paleta Claro (canvas cálido, sombras, radios, verde-agua,
StatusPill semántico) provino de commits previos de la misma línea de trabajo.

## 3. Auditoría de scoping — Nexus intacto

**Técnica Nexus-safe:** los valores premium se aplican con `var(--token-claro, valor-actual)`.
Los tokens nuevos existen **solo** en el bloque `[data-theme="claro"]`; en Nexus no existen →
el `var()` cae al valor actual → **byte-idéntico**.

Evidencia (`app/globals.css`):
- Bloque Nexus: `:root,[data-theme="nexus"]` (L79–~132) — **sin modificar**; grep de tokens
  nuevos dentro del rango Nexus = **vacío**.
- Tokens nuevos (`--r-card`, `--fw-title`, `--tracking-title`, `--step-glow`, `--field-bg/border`,
  `--sand*`, alias `--shadow-*`): todos en L212–227, **dentro** del bloque Claro (inicia L150).
- Overrides con prefijo `[data-theme="claro"]`: elevación (L307), foco (L313), utilidades título
  (L321), pulido de botones (L362/366).
- Clases nuevas `.cx-btn-dark`/`.cx-btn-ghost`: globales pero **aditivas y sin uso** (inertes en Nexus).
- `app/layout.tsx`: solo se **añadió** el peso 800 a Inter y la fuente IBM Plex Mono; Nexus usa
  Plus Jakarta / JetBrains (sin cambios).

## 4. Contraste AA (WCAG, todos los pares de TEXTO)

| Par | Ratio | |
|---|---|---|
| Texto / tarjeta | 17.3 | AA |
| Texto / canvas | 14.91 | AA |
| Muted / canvas | 4.59 | AA |
| Ink-700 / tarjeta | 11.51 | AA |
| Blanco / botón rojo | 4.85 | AA |
| Link rojo / tarjeta | 6.37 | AA |
| Nuevo (azul) | 6.01 | AA |
| Asignado (indigo) | 5.55 | AA |
| En progreso (ámbar) | 4.93 | AA |
| Resuelto (verde-agua) | 5.18 | AA |
| Crítico (rojo) | 5.45 | AA |
| En espera (neutro) | 6.19 | AA |
| Teal texto (#2A7568) | 4.81 | AA |
| Sand-ink (#6E5A34) | 5.63 | AA |
| Botón dark | 18.48 | AA |
| Ghost hover | 5.45 | AA |
| Outline hover | 4.81 | AA |

**Peor par de texto: 4.59 (≥ 4.5 = todo AA).** Desviaciones para cumplir AA (el brief da hues
que fallan como texto): teal texto `#2A7568` (brief `#3F9D8E`), azul `#3D5C86` (brief `#5A7CA6`),
sand-ink `#6E5A34` (brief `#B08D57`). El hue del brief se usa en elementos **no-texto**
(dots, barras, anillo de foco, `--chart-bar`). La estrella de rating (gold `#F7CE4B`) es
**decorativa** (no texto; distingue por relleno + `aria-label`) → exenta de la regla AA de texto.

## 5. Checklist spec → código

**Tipografía**
- ✔ Inter en toda la UI (Claro) · IBM Plex Mono en cifras — `globals.css` `[data-theme="claro"]` + `layout.tsx`.
- ✔ `letter-spacing:-.02em` en títulos (`--tracking-title` / `.cx-title`) · tabular-nums (`.num`/`.mono`/`.cx-tnum`).
- ◑ Tamaños exactos (24-26/20/16): títulos con peso 800 aplicado; tamaños usan la escala `--fs-*` existente (no forzados).

**Tokens**
- ✔ Neutros cálidos · marca (rojo/gradiente/`--black`) · campos · sombras (sm/md/lg/red) · radios (10/16/22/pill).
- ✔ Acentos teal/blue/sand/amber/indigo (con ajuste AA en las variantes de texto).

**Shell**
- N-A Sidebar (menú/CTA/badge/footer) — fuera de alcance (lógica + shell compartido).
- N-A Header (título por vista, Ctrl-K, ES/EN, campana) — fuera de alcance (shell compartido).

**Componentes**
- ✔ Card (surface+línea+radio 22+sombra) · Botones (primary/outline + dark/ghost, pulido Claro) · Campos.
- ✔ StatusPill (mapa exacto por estado, `labels.ts`) · Stepper (+glow paso actual) · StarRating 3D (estrellas).
- ✔ Íconos stroke 1.8 (ya cumplía) · ◑ MetricCard/SlaRow/Badge token-driven (ya reflejan Claro); Toast no tocado.

**Pantallas**
- ◑ Inicio: hero saludo + indicadores restilados; ✘ banner "por evaluar" / "casos por tipo" (barras) / "actividad reciente" = estructura+texto nuevos.
- ✔ Autoservicio (hero + categorías) · ◑ Mis casos (lista restilada; buscador+chips de estado dedicados no existen en el hub).
- ◑ Detalle: cabecera/stepper/hilo/CSAT restilados; ✘ "Detalle del caso" (campos), Adjuntos/"+Subir evidencia", "Quién atiende/Escalar" = estructura nueva. ✔ Exclusión notas/esfuerzo/eval (ya cumplida).
- ◑ Registrar: intake + consultar IA + sugerencias restilados; ✘ "voz" y "evidencia opcional" = features nuevas.
- ✔ Evaluación 3D (estrellas) · ✔ Conocimiento (buscador + chips + tarjetas) · ✔ Catálogo (badge SLA + Solicitar).

**Microinteracciones**
- ✔ Hover tarjetas (`translateY(-2px)`, `.cx-lift`) · foco verde-agua + ring · ◑ barras verde-agua (`--chart-bar`/`--teal`) · sin animaciones estridentes.

Leyenda: ✔ hecho · ◑ parcial (visual hecho; el resto es estructura/texto = fuera de "solo visual") · ✘ no hecho · N-A fuera de alcance.

## 6. Calidad

- `npm run build` (typecheck + lint): **verde**.
- Pruebas: **276/282**. Los **6 fallos** son de `lib/nav/` (navigation/role-ux) — **pre-existentes**
  (último cambio de `lib/nav/` en commits `2f0a06c`/`6fa502d`, previos a este trabajo; ningún commit
  del rediseño tocó `lib/nav/`). Ajenos a la capa visual → pendiente del equipo.

## 7. Para validación visual de Ignacio

- Verificar a **1440px** y **~1024px** (headers/grids no se tocaron; el cambio es solo color/fuente/
  radio/sombra, así que no deberían romperse).
- Confirmar el look premium en las pantallas del rol usuario en **tema Claro**, y que **Nexus** se ve
  idéntico a antes.
- Ítems del brief que quedaron **fuera de "solo visual"** (requieren su propia tarea funcional):
  sidebar dedicado del usuario, header por-vista, banners/secciones nuevas del Inicio, "Detalle del
  caso"/Adjuntos/Escalar del detalle, voz y evidencia en Registrar.
