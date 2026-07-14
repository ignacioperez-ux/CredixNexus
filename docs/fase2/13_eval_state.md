# Fase 2 · Estado de evaluación del caso (pendiente de evaluación / evaluado)

**Pedido:** en los casos resueltos/cerrados, mostrar si están **pendientes de evaluación** o
**evaluados**; el estado **cambia al momento en que el usuario evalúa**.

**Diseño — estado DERIVADO (no un enum nuevo en BD):**
`evalState(incident.status, case_survey.status)`:
- `case_survey.status === 'submitted'` → **evaluated** ("Evaluado").
- `incident.status ∈ {resolved, closed}` y no enviada → **pending_eval** ("Pendiente de evaluación").
- resto → `null` (no aplica).

Como se deriva de `case_survey.status`, la transición pendiente→evaluado es **automática** al
enviar la evaluación: `submit_case_csat` marca la encuesta `submitted` y `revalidatePath('/portal')`
+ el detalle refrescan el estado. Sin lógica extra.

**Cambios:**
- `lib/portal/queries.ts`: `getMyReportedCases` trae `survey_status` (join `case_survey`);
  `MyCase.survey_status`; helper `evalState` + tipo `EvalState`.
- `components/portal/portal.tsx`: **badge** por caso en "Mis casos" (Pendiente de evaluación /
  Evaluado) + **stat tile "Por evaluar"** (conteo de pendientes).
- `components/portal/user-case-detail.tsx`: se puede **evaluar también un caso cerrado sin evaluar**
  (p.ej. cerrado por el agente), no solo resuelto; si ya se envió, solo-lectura.
- i18n ES/EN: `portal.summary.toeval`, `case.eval.pending`, `case.eval.done`.

**Verificación:** `lint` 0/0 ✅ · `build` ✅ · `vitest` **250/250** ✅. Datos vivos: un caso resuelto
con encuesta *pending* rinde "pending_eval"; al enviar pasará a "evaluated".
