# MASTER DATA CATALOG — Credix Nexus

Fuente gobernada de datos maestros. Refleja el modelo cargado en Supabase (tenant `CORE`).
Regla: nada hardcodeado en frontend; todo select/combo consume estos catálogos (CLAUDE.md §10.3).

## Modelo de catálogos (invariantes)

- **Tenant** = modo operativo/de entrega (`operating_mode`: saas|bpo|enterprise|internal|marketplace).
  NO es producto ni rol de party.
- **Producto** = catálogo financiero de Credix (`product`). NO es aplicación ni tenant.
- **Unidad de Negocio** (`business_unit`) = Seguros, Préstamos, Cobranza, Medios de pago, Pagos,
  Casa de cambio, CDC.
- **Proceso** (`process`) = jerarquía de 3 niveles (`process_level`: macro|process|micro) con
  self-reference `parent_process_id` y FK opcional a `business_unit`.
- **Aplicación / Sistema** (`configuration_item`, CMDB) = 1 registro por activo. `ci_type`:
  `application` (productos digitales) | `system` (sistemas/infra/herramientas/externos).
  Las **incidencias y mejoras giran alrededor de estas aplicaciones** (eje de transformación).
- **Canal de comunicación** (`channel`) = touchpoint (phone, whatsapp, email, social, chat,
  kiosk, assisted, sms, web, mobile, api, portal_partner…). Distinto de Unidad de Negocio.
- **Servicio** (`service`) = catálogo de servicios ITSM.

## Conteos sembrados (tenant CORE)

| Catálogo | Tabla | # |
|---|---|---|
| Unidades de negocio | `business_unit` | 7 |
| Macroprocesos | `process` (macro) | 12 |
| Procesos | `process` (process) | 52 |
| Productos financieros | `product` | 32 |
| Servicios ITSM | `service` | 9 |
| Aplicaciones | `configuration_item` (application) | 19 |
| Sistemas | `configuration_item` (system) | 49 |
| Canales de comunicación | `channel` | 8 |
| Roles (globales) | `role` | 12 |
| Permisos | `permission` | 23 |

## Pendiente: enlaces de la matriz (requieren fuente estructurada)

Cargados los NODOS; los ENLACES no se fabricaron (no verificables del volcado inicial):
- `process.parent_process_id` (macro→proceso→micro) — NULL.
- `process.business_unit_id` — NULL.
- `product.business_unit_id` — NULL.
- `configuration_item.service_id` (app→servicio) — NULL.
- Matrices proceso↔sistema, producto↔canal — pendientes de tablas de relación.

Se vinculan cuando llegue la **Ficha de Proceso / matriz estructurada** (spec anexo §1-3,
escenario "modelo vivo y versionado"). Toda vinculación generará eventos en el ledger.

## Codes

Generados con `public.slug_code(name)` (sin acentos, UPPER, `_`). Son placeholders estables;
pueden renombrarse. Unicidad por `(tenant_id, code)` en cada catálogo.
