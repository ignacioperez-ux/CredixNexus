# Fase 2 · Endurecer `createIncident` (acción sin gate de permiso)

**Causa raíz (§2.2):** `createIncident` solo verificaba `ctx?.tenantId` → cualquier usuario
autenticado con tenant podía crear un caso (dependía solo de RLS). Sin defense-in-depth.

**Fix:** gate de permiso en la acción. Set **inclusivo** para no degradar roles actuales (R1):
`anyPerm(["incident.create", "incident.update", "incident.resolve", "triage.manage"])`.
- Portal / `partner_user` (tiene `incident.create`) → pasa.
- Agentes y leads que trabajan casos (create/update/resolve/triage) → pasan.
- Usuario autenticado **sin** permisos de caso (p.ej. rol ajeno a operaciones) → **bloqueado**.

**Mutaciones hermanas — ENDURECIDAS (cierre de deuda):** en el mismo archivo se agregaron gates:
- `updateIncident` y `softDeleteIncident`: `anyPerm(["incident.update","incident.resolve","triage.manage"])`.
- `addComment` (agente, incluye visibilidad **interna**): `anyPerm(["incident.update","incident.resolve","triage.manage","incident.assign"])`.
  Cerraba un hueco real: antes cualquier autenticado podía inyectar comentarios internos en cualquier
  caso del tenant. El usuario final comenta por la RPC owner-checked `add_my_case_comment`, no por aquí.

**Verificación:** `npm run build` ✅ · `vitest` **250/250** ✅.
