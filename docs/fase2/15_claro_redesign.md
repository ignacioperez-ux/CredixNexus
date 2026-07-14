# Fase 2 · Rediseño visual del tema Claro (portal Usuario)

**Objetivo:** modo claro premium, cálido y colorido pero sobrio, conservando la identidad Credix.
**Reglas:** solo capa visual (tokens/estilos); sin cambios de funcionalidad/rutas/textos/lógica;
**Nexus intacto**; AA en texto sobre fondos tintados.

## Núcleo — tokens del tema Claro (`app/globals.css`, bloque `[data-theme="claro"]`)
- **Neutrales cálidos:** canvas `--bg #F5F4F7` (adiós blanco plano), surface `#FFFFFF`, surface-2
  `#FBFAFC`, línea cálida `#ECE9F0`, ink `#1B1622` / `#8E8898`.
- **Marca:** rojo `#E4002B` + `red-hover #C10025` + `red-soft #FDECEF` + `red-border #F5D3DA`.
- **Sombras** (cajas que flotan): `--sh-card`/`--sh-e1` (capa 1px + 14px difusa), `--sh-red`, `--sh-sm`.
- **Radios** más generosos (solo Claro): `--r-xl 18`, `--r-lg 14`, `--r-md 12`, `--r-2xl 20`.
- **Sidebar con vida:** `--sb-bg` = gradiente cálido; item activo = tarjeta blanca (`--sb-hover`) +
  barra roja 3px (ya existente).
- **Gradientes:** `--hero-grad` (mesa de ayuda/conocimiento), `--cta-grad` (botón primario rojo).
- **Estado (pills/dots/donut)** coordinado: info=blue, eval=indigo, low/verified=emerald,
  high/medium=amber, critical=rose (AA sobre bg tintado).
- **Paleta de familias** `--acc-{blue,indigo,emerald,amber,rose,violet,teal,cyan,slate}-{bg,ink,border}`
  para tinte de categorías/KPIs (en Nexus se usa **fallback**, por eso Nexus no cambia).

## Cableado mínimo de estilo (aditivo; con fallback → Nexus intacto)
- **Botón primario** (`.cx-btn-primary`): `var(--cta-grad, …)` + `box-shadow: var(--sh-red, none)`.
- **Tarjetas** (portal, catálogo, conocimiento, artículo, detalle de caso, CSAT): `box-shadow:
  var(--sh-e1, none)` — **elevación solo en Claro** (regla "prohibido cajas sin sombra").
- **Hero** (autoservicio + conocimiento): `var(--hero-grad)`; avatar del hero en gradiente rojo +
  `--sh-red`.
- **"Explora por categoría"** y **folders de Conocimiento**: tarjetas tintadas por **familia**
  (acceso/seguridad→indigo, datos→cyan/blue, pagos/onboarding→emerald, apps/duplicidad→amber,
  disputa/reclamo→violet, fraude/riesgo/cargo→rose, API→teal, infra→slate). Título en gris oscuro.
- **KPIs** del hub tintados por métrica: En curso=blue, Resueltos=emerald, Requieren seguimiento=slate,
  Por evaluar=amber (estrella).
- **Header responsivo:** envuelve a ~920px (título línea 1, controles línea 2).

## Cómo se preserva Nexus
Cada token nuevo se define en Claro; en Nexus **no existe** → los componentes lo usan con fallback
(`var(--acc-x, …)`, `var(--sh-e1, none)`, `var(--cta-grad, …)`) y `--hero-grad` se definió idéntico
al look previo en Nexus. Resultado: el modo oscuro queda igual.

## Pendiente menor (follow-up si se quiere pixel-perfect)
- KPIs de "Mis solicitudes" del catálogo con bg tintado exacto (Abiertas=blue/Cumplidas=emerald/
  Vencidas=rose) — hoy recolorean vía `--st-*` (amber/emerald/rose).
- Badges de tipo de artículo (GUÍA=violet/RUNBOOK=amber) — usan su propio color.
- Tipografía IBM Plex (hoy Jakarta/Inter/JetBrains vía next/font) — cambio de fuentes aparte.

**Verificación:** `build` ✅ · `lint` 0/0 ✅ · `vitest` **250/250** ✅. *(QA visual real pendiente:
no hay dev server en esta sesión; revisar a 920px y 1440px en el deploy.)*
