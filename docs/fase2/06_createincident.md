# Fase 2 · Endurecer `createIncident` (acción sin gate de permiso)

**Causa raíz (§2.2):** `createIncident` solo verificaba `ctx?.tenantId` → cualquier usuario
autenticado con tenant podía crear un caso (dependía solo de RLS). Sin defense-in-depth.

**Fix:** gate de permiso en la acción. Set **inclusivo** para no degradar roles actuales (R1):
`anyPerm(["incident.create", "incident.update", "incident.resolve", "triage.manage"])`.
- Portal / `partner_user` (tiene `incident.create`) → pasa.
- Agentes y leads que trabajan casos (create/update/resolve/triage) → pasan.
- Usuario autenticado **sin** permisos de caso (p.ej. rol ajeno a operaciones) → **bloqueado**.

**Deuda relacionada (anotada, no incluida):** en el mismo archivo, `updateIncident`,
`softDeleteIncident` y `addComment` (agente) también carecen de gate explícito (solo `tenantId`).
Se recomienda endurecerlas con el mismo patrón, evaluando el permiso adecuado por acción
(`incident.update` para editar/cancelar) para no regresar a roles que hoy editan.

**Verificación:** `npm run build` ✅ · `vitest` **250/250** ✅.
