# Sub-Fase 1.1 — RBAC y gobierno de la derivación · Gerente de Evolución

> **Modo:** Implementador (decisiones PE-1…PE-3 aprobadas). **Fecha:** 2026-07-14.
> **Verificación:** `build` ✅ · `lint` 0/0 ✅ · `vitest` **250/250** ✅ · QA en sesión `product_owner` real.

## Cambios (migración `0091` aplicada + código de navegación)
1. **Nuevos permisos granulares** (desacoplan de `incident.read`): `ai.read`, `analytics.read`.
2. **Gates de ruta any-of** (`lib/nav/access.ts` + `navigation.ts`): `/ai-center` = `[incident.read, ai.read]`;
   `/analytics` = `[incident.read, analytics.read]`. Los demás roles conservan acceso por `incident.read`;
   el Gerente de Evolución accede por los permisos nuevos.
3. **Mandato otorgado a `product_owner`** (PE-3): `ai.read`, `analytics.read`, `knowledge.read`,
   `talent.read`, `talent.manage`, `squad.manage`, `change.approve`, `project.deploy`, `vendor.manage`.
4. **Revocado a `product_owner`** (segregación): `incident.read` (ya no ve dashboard/workspace/incidents/
   customers — el sidebar los oculta y el guard redirige) y `problem.manage` (edición de problemas
   queda en Operaciones; el rol solo lee/vincula).
5. **Gobierno de la derivación (PE-2)** — `sendToEvolution` (`lib/incidents/actions.ts`): gate
   `["incident.update","incident.resolve","triage.manage"]` (Operaciones). Antes incluía
   `problem.manage`/`project.manage` → permitía **auto-derivación** de Evolución. Ahora el rol no
   puede derivar (ni ve el detalle donde vive el botón).
6. **Home del rol** (`role-ux.ts`): `/dashboard` → `/projects` (portafolio); `/dashboard` ya lo
   bloquea el guard de página añadido antes (redirect a `/start` → `/projects`).

## QA en sesión `product_owner` real ("Gerente de Tecnologia - Evolucion")
| Permiso | Resultado | Esperado |
|---|---|---|
| `incident.read` | **false** | false (segregado) |
| `problem.manage` | **false** | false |
| `knowledge.read` / `talent.read` | **true** | true (mandato) |
| `ai.read` / `analytics.read` | **true** | true (conserva AI Center / Analítica) |
| `squad.manage` / `change.approve` / `project.deploy` | **true** | true (mandato) |

## Efecto neto (HECHO)
- **Desaparecen del rol:** Dashboard operativo, Mi trabajo (workspace), Bandeja cruda de Casos,
  Clientes — el sidebar los oculta (canSeeNav filtra por `incident.read`) y el guard redirige.
- **Gana:** Conocimiento, Talento, y conserva AI Center + Analítica por permisos propios.
- **No puede** editar problemas ni auto-derivar casos.
- **Nada se elimina del sistema** (R1): esas superficies siguen en Operaciones/Admin.

## Pendiente para sub-fases siguientes
- **1.2 Navegación:** reorganizar el menú del rol en 3 bloques (Evolución · Gobierno · Consulta) +
  mover Catálogo/Autoservicio a "Ayuda".
- **1.3+:** Panel de Evolución (home), Bandeja de Evolución (derivados/candidatos), Portafolio,
  Squads & Talento, restricciones de solo-lectura, Analítica pestaña Evolución, scorecard proveedores.
- Refinamiento: la derivación hoy la puede hacer cualquier rol con `incident.update` (agentes
  incluidos); acotarla a la Gerente de Operaciones (permiso dedicado) es un ajuste posterior.

**STOP — ESPERANDO APROBACIÓN** para la Sub-Fase 1.2 (navegación del rol).
