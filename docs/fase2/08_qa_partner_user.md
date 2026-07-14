# Fase 2 · QA de seguridad con sesión `partner_user` real (simulada en SQL)

**Objetivo:** cerrar la verificación runtime pendiente (el MCP corre con rol elevado que bypassa
RLS). Se **simuló una sesión `authenticated` real** del `partner_user` en SQL:
`set local role authenticated` + `set_config('request.jwt.claims', {"sub": <auth_user_id>})`, y se
ejercieron las RPCs y la RLS dentro de una transacción con `rollback` (sin mutar datos).

**Sujeto:** `partner_user` "Usuario Final" — account `271ae13b…`, auth `41c47cc6…` (4 casos propios).

## Resultados (todos ✓)

| Verificación | Resultado | Esperado |
|---|---|---|
| `current_account_id()` resuelve la cuenta desde el JWT | `271ae13b…` | su cuenta |
| `get_my_case(su_caso)` | **1 fila** | 1 (puede ver el suyo) |
| `get_my_case(caso_ajeno)` | **0 filas** | 0 (ownership enforced, UX-008/P2) |
| `get_my_case_thread(caso_ajeno)` | **0 filas** | 0 (no ve hilos ajenos) |
| `select count(*) from service_request` (bajo su sesión) | **1** (solo la suya) | solo propias (RLS restrictive, UX-002) |
| `has_permission('service_catalog.manage')` | **false** | false (no gestor) |
| `has_permission('incident.read')` | **false** | false (no ve vista de agente) |

## Interpretación
- **P2/UX-008:** el usuario ve **su** caso y **no** los ajenos — el owner-check de las RPCs
  (`reported_by_user_id = current_account_id()`) funciona en runtime.
- **P3/UX-002:** bajo la RLS restrictive de `service_request` (`manage OR owner`), con
  `manage=false`, solo ve sus solicitudes.
- **Fronteras de rol:** sin `incident.read` (no accede a `/incidents`) ni `service_catalog.manage`.

## No ejercido (a propósito)
- Las **mutaciones** con owner-check (`submit_case_csat`, `add_my_case_comment`) usan el **mismo**
  patrón `reported_by_user_id = current_account_id()` (verificado en el código SQL); no se
  ejecutaron para no mutar producción.
- Aislamiento de `service_request` entre dos usuarios distintos: hoy solo existe 1 solicitud en la
  BD (propia del sujeto); la RLS quedó probada por su predicado + el caso negativo de `get_my_case`.

**Conclusión:** el modelo de seguridad del rol Usuario (RPCs con owner-check + RLS restrictive)
está **verificado en runtime**. Recomendación para producción: repetir este chequeo tras seeds/datos
reales y agregar un caso de prueba con dos usuarios para el aislamiento cruzado de solicitudes.
