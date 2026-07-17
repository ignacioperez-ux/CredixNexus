# Rediseño "Modo Claro · Rol Usuario" — v2 (reporte final)

Rediseño **visual + layout** del portal del usuario final (`partner_user`) en tema **Claro**.
Cero cambios de lógica, endpoints, rutas, nombres de campos o datos. Tema oscuro ("Nexus")
**intacto**. Complementa el v1 (`CLARO_USUARIO_v1.md`) con paleta exacta, tipografía, hub con
pestañas y recomposición de las 7 pantallas.

## 1. Alcance y decisiones (aprobadas antes de tocar código)

| Decisión | Resultado |
|---|---|
| Paleta v2 | Adoptada exacta (con variante AA donde el hue falla como texto). |
| Header (shell compartido) | Variante scoped al portal (buscador→Conocimiento, sin toggle de tema). |
| Pantallas | Recompuestas al layout exacto. |
| "No cambies rutas" vs 5 pantallas | **Hub con pestañas** (`/portal?tab=`) — una sola ruta, sin rutas nuevas. |

## 2. Fases y commits

**Base funcional (Fases A/B/C — previas):** sidebar dedicado, banner por-evaluar, casos por tipo,
detalle con "Detalle del caso"/adjuntos/quién atiende/escalar, voz, actividad reciente.
`95befb3 · c89b636 · 0a328ce · aa40e01 · a48fe42 · 707ff4c`.

**Rediseño v2:**

| Fase | Commit | Entregado |
|---|---|---|
| (a) Tokens + tipografía | `541d139` | Paleta exacta, estados remapeados, sombras/radios/tracking, `--fs-greeting/--fs-page-title`. |
| (b1) Sidebar portal | `97e4922` | 5 destinos + chips de ícono neutros + badge azul (casos activos) + CTA. Tab-aware. |
| (b2) Header portal | `3bcf0e6` | Título 25/800, buscador→Conocimiento, sin toggle de tema. |
| (d1) Hub + Inicio | `1bf8570` | `/portal?tab=` (inicio/autoservicio/miscasos/registrar). Inicio: hero 36px + 4 MetricCards (reales) + por-tipo + actividad. |
| (d2-d4) | `8675515` | Autoservicio (hero + tiles + accesos) · Mis casos (buscador + chips que filtran + filete) · Registrar (dropzone evidencia → se sube al crear). |
| (d5) Detalle | `7d70783` | 2 columnas: izq seguimiento/evaluación/detalle/comunicación · der SLA/quién atiende/adjuntos. |
| (d6-d7) | `ebd1f30` | Conocimiento (hero verde-agua + 2-col) · Catálogo (3-col + badge SLA ámbar). |

## 3. Auditoría de scoping — Nexus intacto

Técnica `var(--token-claro, valor-actual)` + variantes por rol (sidebar/header `isPortalNav`).
Todo token nuevo vive en `[data-theme="claro"]`; el bloque Nexus (`:root,[data-theme="nexus"]`)
no recibió ninguno (grep del rango = vacío). `app/layout.tsx` solo **añade** el peso 800 de Inter
e IBM Plex Mono (inerte para Nexus). El sidebar/header cambian solo cuando el rol es portal.

## 4. Contraste AA (paleta v2, pares de texto)

| Estado / acento | Ratio | |
|---|---|---|
| Nuevo (azul `#1D69D6`) | 4.60 | AA |
| Admitido (verde-agua `#2A7568`) | 4.81 | AA |
| Asignado (indigo `#4F46E5`) | 5.55 | AA |
| En progreso (ámbar `#8A5A08`) | 5.29 | AA |
| En espera (slate `#4A5568`) | 6.60 | AA |
| Resuelto (verde `#0B7A4A`) | 4.82 | AA |
| Crítico (rojo `#C10025`) | 5.59 | AA |
| Rosa (`#C63066`) | 4.56 | AA |
| Muted / canvas (`#6A6474`) | 4.91 | AA |

Todos ≥ 4.5. Los hues del brief que fallan como texto (verde `#0E8C55`, ámbar `#B4740A`,
verde-agua `#3F9D8E`) usan variante AA en texto/dot; el hue exacto queda en no-texto
(barras `--chart-bar`, anillo de foco).

## 5. Checklist spec → código

**Tipografía:** ✔ Inter (todo) + IBM Plex Mono (cifras) · ✔ saludo 36/800 (`--fs-greeting`),
título pantalla 25/800 (`--fs-page-title`), tracking -.01em, tabular-nums.

**Layout global:** ✔ Sidebar 264px (5 destinos, chips, badge, CTA, activo tab-aware) ·
✔ Header portal (título/subtítulo por vista, buscador→Conocimiento, ES/EN, campana).

**Pantallas:**
- ✔ Inicio (hero saludo, banner por-evaluar con filete ámbar, 4 MetricCards, por-tipo, actividad + Ver todo).
- ✔ Autoservicio (hero + 16 tiles por categoría + 2 accesos).
- ✔ Mis casos (banner IA + buscador + chips de estado que filtran + filas con filete).
- ✔ Detalle (2-col; stepper, evaluación, detalle, comunicación, SLA, quién atiende, escalar, adjuntos; exclusión de notas internas/esfuerzo/eval del responsable).
- ✔ Registrar (2-col: textarea + voz + selects + dropzone evidencia | panel IA de sugerencias).
- ✔ Conocimiento (hero verde-agua + buscador + "Más consultados" 2-col).
- ✔ Catálogo (3-col + badge SLA ámbar + Solicitar).

**Estados:** ✔ Nuevo=azul, Admitido=verde-agua, Asignado=indigo, En progreso=ámbar,
En espera=slate, Resuelto=verde (tokens semánticos; `labels.ts` sin cambios).

## 6. Desviaciones honestas (documentadas)

- **`tailwind.config` no existe** (Tailwind v4 CSS-first) → tokens en `app/globals.css`.
- **Cero mock (§11):** los valores del brief ("Tomás Alvarado", "5 casos activos", los 16 códigos
  con conteos, SLAs de servicios) son mockup. Se implementó el **layout** con **datos reales** de la BD.
- **MetricCard #4** = "Requieren atención" (dato real) en vez de "Satisfacción" (no hay CSAT-avg por usuario).
- **Panel IA de Registrar** mantiene las sugerencias reales de `portalAssist`, sin los tags
  GUÍA/ERROR-CONOCIDO/FAQ ni "% coincidencia" (no vienen en los datos; no se inventaron).
- **Stepper del detalle:** horizontal (no vertical) — funcional; conversión estética diferida.

## 7. Calidad

- `npm run build` (typecheck + lint): **verde** en cada sub-fase.
- Migraciones aplicadas para la base funcional: `0116/0117/0118` (RPCs owner-checked del portal).
- Pruebas: **276/282**. Los **6 fallos** son de `lib/nav/` (navigation/role-ux), **pre-existentes**
  (último cambio de `lib/nav/` en `2f0a06c`/`6fa502d`, previos a esta línea de trabajo). Sin regresiones nuevas.

## 8. Pendiente de validación visual (Ignacio)

- Recorrer como `partner_user` en Claro: sidebar (5 ítems + badge + CTA) → Inicio → pestañas
  Autoservicio / Mis casos (filtros) / Registrar (voz + evidencia) → un caso (2-col, SLA, escalar,
  adjuntos, estrellas) → Conocimiento → Catálogo.
- Verificar **1440px** y **~1024px** (grids con `auto-fill`/`auto-fit` envuelven; sin cambios de
  layout global, solo tokens/estructura de pantalla).
- Confirmar que **Nexus** se ve idéntico a antes.

## 9. Nota de repo (working tree)

Al cierre quedan cambios **pre-existentes** en el working tree que **no** son de este trabajo
(estaban desde el inicio de la sesión): `M .gitignore`, `M sql/0097_team_member_email_unique.sql`,
y sin trackear `backup/`, `docs/auditoria_db_credixnexus_v1.md`, `docs/seed/`, `sql/seed/`, `tasks/`.
No se commitearon (no fueron autorizados ni creados aquí). Requieren decisión del arquitecto.
