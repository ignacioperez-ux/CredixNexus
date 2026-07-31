# Integración del Design System oficial de Credix

> Estado: **Piloto entregado** (foundation + tokens + shell + componentes base + portal Usuario vía retint).
> Rama: `feat/credix-design-system`. Regenerable y documentado. Ver §17 (cobertura) y §18 (pendientes).

Este documento describe cómo el Design System (DS) oficial de Credix, exportado desde Figma, se
integró en **CredixNexus** sin modificar lógica de negocio, rutas, permisos, RLS ni datos.

---

## 1. Archivos fuente recibidos

Ubicados en `design-system/source/` (extraídos de `DS CREDIX.zip` y `JSON DS Credix.zip`):

| Ruta | Origen | Contenido |
|---|---|---|
| `source/primitives/Mode 1.tokens.json` | `1. Primitives Credix.zip` | Primitivos: paletas por tono, `shape`, `elevation`, `font` |
| `source/semantic/Baseline.tokens.json` | `2. Semantic Credix.zip` | **Fuente de verdad**: `scheme` (surface/primary/error/…), `typescale`, `state layers` |
| `source/components/Mode 1.tokens.json` | `3. Component Credix.zip` | Tokens por componente (Buttons, Cards, Text fields, Tabs, Navigation rail, …) |
| `source/figma/DS CREDIX.zip` | `DS CREDIX.zip` | Archivo `.fig` (referencia visual; ver §10) |

Los dos JSON llamados `Mode 1.tokens.json` se extrajeron en carpetas independientes (`primitives/`
y `components/`) para no sobrescribirse.

---

## 2. Estructura de tokens

```
design-system/
├── source/            # JSON originales del export Figma (no se editan)
│   ├── primitives/  semantic/  components/  figma/
└── generated/         # AUTOGENERADO (no editar a mano)
    ├── primitives.ts        # 213 tokens tipados
    ├── semantic.ts          # 253 tokens tipados
    ├── components.ts        # 2427 tokens tipados
    ├── credix-tokens.css    # capa CRUDA + capa CURADA (custom properties)
    ├── tokens.json          # volcado normalizado (trazabilidad)
    └── screenshots/         # capturas responsive del smoke E2E
```

## 3. Proceso de generación

Script único y reproducible: **`scripts/generate-credix-tokens.mjs`**.

```bash
node scripts/generate-credix-tokens.mjs
```

El generador:
1. recorre recursivamente los 3 JSON y reconoce nodos con `$value`;
2. conserva `$type` y `$description`;
3. resuelve colores (hex + alpha → `rgba()` cuando `alpha < 1`);
4. **excluye tokens de prueba** (grupo `prueba`, `Color prueba`, `surface prueba`, etc.);
5. genera nombres estables `--credix-<ruta>` sin colisiones (dedupe last-wins con aviso);
6. no agrega `px` a números que no lo requieren (pesos, opacidades);
7. **valida la identidad** de marca y **aborta** si falta algún valor (ver §4-§6);
8. emite TS tipado + CSS + JSON.

---

## 4. Paleta utilizada (esquema Baseline / claro)

Capa curada (API pública de tokens): `--credix-color-*` en `credix-tokens.css`.

| Token curado | Valor | Rol |
|---|---|---|
| `--credix-color-primary` | `#E42313` | **Rojo Credix oficial** (acción/marca) |
| `--credix-color-on-primary` | `#FFFFFF` | Texto sobre primary |
| `--credix-color-secondary` | `#5B5F61` | Secundario / focus ring |
| `--credix-color-surface` | `#F7FAFC` | Canvas de la app |
| `--credix-color-surface-lowest` | `#FFFFFF` | Superficie de tarjeta |
| `--credix-color-surface-low` | `#F1F4F6` | Alt / inputs / cabeceras |
| `--credix-color-surface-container` | `#EBEEF0` | Fondo de navegación / hover fila |
| `--credix-color-surface-high` | `#E5E9EB` | Pistas / separadores |
| `--credix-color-surface-highest` | `#E0E3E5` | Hover nav |
| `--credix-color-on-surface` | `#181C1E` | Texto principal |
| `--credix-color-on-surface-variant` | `#434749` | Texto secundario (AA) |
| `--credix-color-outline` | `#74787A` | Borde de campos |
| `--credix-color-outline-variant` | `#C3C7C9` | Bordes/divisores 1px |
| `--credix-color-error` | `#FF4965` | Error |
| `--credix-color-on-error-container` | `#920029` | Texto sobre contenedor error |
| `--credix-color-warning-container` | `#FFDC49` | Advertencia |
| `--credix-color-success-container` | `#19D27E` | Éxito |
| `--credix-color-information-container` | `#5BC0DE` | Información |
| `--credix-color-link` | `#239DF7` | Enlaces |

## 5. Escala tipográfica

Fuente oficial: **Heebo** (pesos 400 / 500 / 700). Cargada self-hosted por `next/font/google`
(`--font-heebo`, sin llamada remota en runtime). Fallback: `Heebo, Arial, Helvetica, sans-serif`.

Roles del DS (`typescale`): Display 57/45/36 · Headline 32/28/24 · Title 22/16/14 ·
Label 14/12/11 · Body 16/14/12. En la app: títulos vía `var(--font-display)` (Heebo),
UI/cuerpo vía `var(--font-ui)` (Heebo). **Las cifras siguen en mono** (JetBrains/IBM Plex)
por la regla de datos numéricos tabulares (DESIGN §).

## 6. Radios y elevaciones

Radios (`shape`): 0 · 4 · 8 · 12 · 16 · 20 · 28 · 32 · 48 · 1000 (full).
Curados: `--credix-radius-{none,xs,sm,md,lg,xl,2xl,full}`.
Elevaciones (`elevation`): 0 · 1 · 3 · 6 · 8 · 12.
Estados interactivos (state layers): hover 8% · focus/pressed 10% · dragged 16%.

---

## 7. Componentes migrados / creados

**Componentes base nuevos** en `components/ui/` (consumen tokens, funcionan en ambos temas):

- `Button` / `IconButton` — variantes primary/tonal/outlined/text/destructive/dark; alturas 32/40/56; focus ring DS.
- `Card` / `SectionHeader` — superficie outlined/elevated.
- `PageHeader` — título Heebo + subtítulo + acciones.
- `Badge` / `StatusBadge` — estado nunca solo por color (texto + punto/icono).
- `TextField` / `SelectField` / `TextArea` — campos outlined, label asociado, `aria-invalid`/`aria-describedby`.
- `EmptyState` — estado vacío ilustrado.
- Barrel: `import { Button, Card, … } from "@/components/ui"`.

**App shell** (`components/app-shell/*`, `components/landing/*`): ya consumían `var(--token)`, por lo
que el retint de tokens los alinea automáticamente (sidebar `#EBEEF0`, contenido `#F7FAFC`, item
activo con barra roja `#E42313`). Rojos hardcodeados del landing/login/wordmark → `#E42313`.

## 8. Decisiones de adaptación

1. **Stack real ≠ prompt.** El prompt asumía Vite/SPA; el repo es **Next.js 16 + Tailwind v4 +
   Supabase**. La integración se hizo por **Tailwind v4 + `app/globals.css`** (no Vite, no `src/`).
2. **Rojo de marca.** El DS manda `#E42313`; el repo usaba `#E4002B`/`#E30613`. Se adoptó
   **`#E42313` en ambos temas** (decisión del arquitecto) y se actualizó CLAUDE.md §11.
3. **Temas.** El DS define solo un esquema claro (**Baseline**). Se **retintó el tema Claro** a
   Baseline y se **conservó Nexus** (oscuro) intacto (regla #13: no degradar dark mode).
4. **Tokens, no hardcode.** La UI ya referenciaba `var(--token)`; re-tintar tokens propaga el DS a
   toda la app sin tocar componentes. Los `--*` de la app apuntan a `--credix-*` curados.

## 9. Tokens excluidos

Grupo `prueba` y afines: `Color prueba`, `Color prueba 2`, `surface prueba`, `Title medium prueba`,
`gris prueba`, `blanco prueba`. Excluidos por el generador (patrón `prueba` en la ruta).

## 10. Limitaciones del archivo `.fig`

`DS CREDIX.fig` contiene ejemplos educativos de Material Design (morados, fotografías, marcas de
terceros). **No** representan la identidad Credix y **no** se usaron. No se extrajeron vectores
automáticamente del `.fig` (requeriría herramientas no disponibles). Se conserva como referencia.

## 11. Tratamiento del logo

Se conserva el **wordmark actual** (`components/app-shell/wordmark.tsx`), ajustado al rojo oficial.
El `.fig` no expone un SVG/PNG de logo utilizable directamente. **Activo faltante:** logotipo Credix
oficial en SVG/PNG (registrado como pendiente; no bloquea la migración).

## 12. Accesibilidad

- Focus visible: campos (halo rojo de marca) y botones base (`outline` secondary 3px, offset 2).
- Estado nunca solo por color (Badge incluye texto + punto/icono).
- Labels asociados + `aria-invalid`/`aria-describedby` en campos.
- Texto secundario usa `on-surface-variant` `#434749` (contraste AA sobre surfaces claras).
- Se respeta `prefers-reduced-motion` (regla global existente conservada).

## 13. Regenerar tokens

```bash
node scripts/generate-credix-tokens.mjs      # relee source/ y reescribe generated/
```
`app/globals.css` importa `../design-system/generated/credix-tokens.css`. Tras regenerar, `npm run build`.

## 14. Crear un componente nuevo

1. Ponerlo en `components/ui/` y exportarlo en `components/ui/index.ts`.
2. Consumir **solo** `var(--token)` (curados `--credix-*` o alias de app `--accent/--text/--card/…`).
3. Nunca hex/rgb literales si existe token equivalente (regla §9 del prompt / CLAUDE.md §11).
4. Focus visible + labels/aria. Estado con texto, no solo color.

## 15. Cómo evitar hardcodes

- Colores → tokens curados `--credix-color-*` o alias de tema (`--accent`, `--text`, `--card`, `--line`).
- Radios → `--credix-radius-*` / `--r-*`. Tipografía → `--font-display` / `--font-ui` / `--font-mono`.
- Verificación rápida: `git grep -niE "#[0-9a-f]{6}" components/tu-modulo` no debe traer marca/superficies.

## 16. Cómo validar futuras modificaciones

```bash
npx tsc --noEmit            # tipos
npm run lint                # lint (base preexistente: ver §build)
npm run build               # build de producción
# Smoke del DS (sin credenciales) contra un server ya arriba en E2E_PORT:
E2E_PORT=3100 npx playwright test --project=ds-smoke
```
El smoke (`e2e/credix-ds.smoke.spec.ts`) valida Heebo, rojo `#E42313`, ausencia de rojo viejo y de
morado, y resuelve los tokens del tema Claro a los valores Baseline. Genera screenshots responsive.

## 17. Tabla de cobertura

| Pantalla / Área | Layout Credix | Componentes Credix | Responsive | Pruebas | Estado |
|---|---:|---:|---:|---:|---|
| Landing / Login (SSO entry) | ✅ | parcial | ✅ | ✅ smoke | Migrado |
| App shell (sidebar/header) | ✅ (tokens) | vía tokens | ✅ | — | Migrado (retint) |
| Portal Usuario (partner_user) | ✅ (tokens) | disponible | heredado | pendiente E2E auth | Migrado (retint) |
| Resto de módulos (~50) | ✅ color/tipografía (tokens) | disponible | heredado | pendiente | Re-skin por token; adopción de componentes incremental |

> El retint de tokens re-piel **toda** la app en modo Claro (color/superficies/tipografía). La
> adopción de los componentes base (`components/ui/*`) es **incremental** y no requiere reescrituras
> masivas de pantallas ya tokenizadas.

## 18. Pantallas pendientes / limitaciones

- **E2E autenticado**: no ejecutado por el asistente (requiere server dev del usuario + credenciales
  por ENV `E2E_*`, que son secretas). El smoke sin credenciales sí corre. Ejecutar los proyectos
  `portal/operador/…` con el server del usuario arriba (`reuseExistingServer`).
- **Logo oficial SVG/PNG**: activo faltante (se conserva el wordmark actual).
- **Adopción de componentes base** en los ~50 módulos: incremental, fuera del alcance del piloto.

---

## Evidencia de NO modificación (backend/negocio)

No se tocó: Supabase, base de datos, RLS, `sql/`, migraciones, autenticación, rutas, navegación,
permisos, roles, RPC, Edge Functions, workflows, formularios funcionales ni validaciones de negocio.
Cambios acotados a: tokens (`design-system/`), `app/globals.css`, `app/layout.tsx` (carga de fuente),
componentes de presentación (`components/ui/*`), y swaps de color de marca en landing/login/wordmark.
