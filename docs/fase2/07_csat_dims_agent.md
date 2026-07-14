# Fase 2 · Dimensiones CSAT en el panel de agente

**Contexto:** el usuario final califica su caso en 3 dimensiones (Resolución/Rapidez/Atención) +
comentario (Bloque C, P4). El panel del agente (`/incidents/[id]` → `CsatPanel`) mostraba **solo el
puntaje general** (`score`).

**Cambio:** el panel del agente ahora muestra también las **3 dimensiones en solo-lectura** cuando
existen (calificación hecha por el usuario final). Si la encuesta se calificó con puntaje único
(sin dimensiones), se muestra solo el general — degradación honesta.

- `lib/csat/queries.ts`: `getCsatForIncident` / `CsatSurvey` incluyen `q_resolution/q_speed/q_attention`.
- `components/csat/csat-panel.tsx`: en el estado "enviada", renderiza cada dimensión con estrellas
  (reutiliza `Stars`) y las etiquetas i18n existentes (`case.csat.q.*`).

**Sin cambio en la captura del agente:** su envío de puntaje único (`submitCsat`) se conserva.

**Verificación:** `npm run build` ✅ · `vitest` **250/250** ✅.
