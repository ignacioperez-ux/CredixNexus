# Validación Integral de CredixNexus (gstack)

## Control documental

| Campo | Valor |
|---|---|
| Documento | Validación integral de CredixNexus (diagnóstico, no remediación) |
| Método | Skill suite **gstack** (lentes: /plan-eng-review, /review, /cso, /health, /design-review) + inspección estática + lecturas MCP de Supabase |
| Fecha | 2026-08-01 |
| Rama analizada | `feat/portal-intake-simplify` |
| Commit | `ca1bc66` |
| Proyecto Supabase (solo lectura) | **CREDIXNEXUS · ref `dffbysjrvvlwgzgakhaa`** (Postgres 17, ca-central-1) |
| Modo | **Solo lectura** — no se modificó código, configuración ni datos. Ninguna remediación aplicada. |
| Alcance | Todo el repo (`app/`, `components/`, `lib/`, `sql/`, `supabase/`, `design-system/`, `e2e/`, configs) + esquema real de Supabase |
| Clasificación de hallazgos | **HECHO** (evidencia directa) / **INTERPRETACIÓN** (deducción sobre hechos) / **HIPÓTESIS** (a validar) |
| Severidad | CRÍTICO / ALTO / MEDIO / BAJO |
| Responsable | Ignacio Perez Rubio (Arquitecto) y el grupo de SQUADS a cargo |

---

## 1. Resumen ejecutivo

CredixNexus es un **monolito modular** Next.js 16 (App Router) + React 19 + TypeScript + Tailwind v4 sobre Supabase (Postgres 17), audit-grade y multi-tenant. La validación cubrió arquitectura, RBAC, RLS/seguridad, calidad de código, consistencia UX/UI y riesgos del fork (enterprise vs cliente simplificado).

**Estado general: base sólida con un hallazgo CRÍTICO de aislamiento de datos.**

- **Fortalezas (HECHO):** arquitectura por capas limpia (RSC + Server Actions + `lib/<dominio>`); RBAC de aplicación robusto (doble guard + regla de oro backend); **RLS habilitado en 88/88 tablas**; **0 uso de `service_role` en el cliente**; **typecheck estricto limpio**; **i18n paritario ES/EN al 100%** (2729 = 2729 claves); **~99% de la UI tokenizada** (identidad Credix y temas por token).
- **Riesgo dominante (CRÍTICO):** la RLS aísla **por tenant, no por fila/dueño**. Las tablas con PII y datos de caso (`incident`, `party`, `user_account`, `incident_comment`, `case_attachment`, `case_survey`, `case_work_log`, `fraud_case`, `dispute_case`) tienen una única política `cmd=ALL` para `authenticated` con `USING`/`WITH CHECK = tenant_id`. Cualquier autenticado del tenant — **incluidos los usuarios externos `partner_user`** — puede **leer y escribir todas las filas del tenant** vía la anon key pública, saltándose la app.
- **Riesgos ALTOS:** ruta `/partner` sin control de permiso; **4 vulnerabilidades HIGH** de dependencias (Next.js Server Functions, postcss, sharp); ausencia de gating por modo/feature-flags para el fork.
- **Recomendación de fork:** el camino de menor deuda **no es un fork de código** sino **un solo codebase multi-modo** (activar `operating_mode` + flags, reusando el RBAC existente), con la **remediación de la RLS como prerrequisito** para servir clientes/usuarios externos.

**Conteo de hallazgos por severidad:** CRÍTICO 1 · ALTO 4 · MEDIO 8 · BAJO 8 (+ fortalezas).

---

## 2. Hallazgos por dimensión

### 2.1 Arquitectura y estructura (Fase 1)

Stack verificado: Next.js `^16.2.10`, React `^19`, TS `strict`, Tailwind v4, `@supabase/ssr ^0.7` (`package.json`; `tsconfig.json:11,15`). Monolito modular: 84 páginas, 185 componentes, 49 dominios `lib/`, 114 migraciones `sql/`. Patrón RSC + **Server Actions** (40 archivos `"use server"`), 3 clientes Supabase, middleware único `proxy.ts:4-6`.

| ID | Hallazgo | Tipo | Evidencia | Sev. |
|---|---|---|---|---|
| A1 | **0 uso de `service_role` en la app** — opera bajo RLS con el JWT del usuario | HECHO (fortaleza) | `git grep service_role` app/lib/components = 0 | — |
| A2 | `lib/i18n/dictionaries.ts` = **5541 LOC** en un solo archivo | HECHO | `wc -l` | MEDIO |
| A3 | Diccionario i18n monolítico → conflictos de merge y difícil de podar para el fork | INTERPRETACIÓN | deriva de A2 | MEDIO |
| A4 | `portal.tsx` 636 LOC; 5 componentes 345–501 LOC (operations-tower, incident-table/detail/form, projects/actions) | HECHO | `wc -l` top-10 | BAJO |
| A5 | Componentes grandes = deuda de modularización | INTERPRETACIÓN | deriva de A4 | BAJO |
| A6 | Separación por bounded context limpia (`lib/<dominio>/{queries,actions,validation}`) | HECHO (fortaleza) | 49 dominios | — |

### 2.2 RBAC de la aplicación (Fase 2)

| ID | Hallazgo | Tipo | Evidencia | Sev. |
|---|---|---|---|---|
| R1 | Doble guard de ruta: permiso + **denylist por persona** | HECHO (fortaleza) | `app/(app)/layout.tsx:33-40`; `lib/nav/access.ts:58-112` | — |
| R2 | Regla de oro backend para mutar casos (gestor amplio o responsable asignado) | HECHO (fortaleza) | `lib/auth/incident-authz.ts:16-35` | — |
| R3 | `hasPermission` con bypass admin centralizado | HECHO | `lib/auth/context.ts` (`my_access`) | — |
| **R4** | **`/partner` sin control de permiso**: ruta existente, ausente de `ROUTE_PERMISSIONS`, y `partner_user` fuera de toda denylist → cualquier autenticado (incl. partner externo) la abre por URL | HECHO | `app/(app)/partner/page.tsx`; `"/partner"` ausente en `access.ts`; `ROLE_ROUTE_DENY` (`access.ts:71-87`) sin `partner_user` | **ALTO** |
| R5 | `/notificaciones` sin entrada de permiso (datos propios, RLS por recipient) | HECHO | scan de rutas | BAJO |
| R6 | Algunas actions de proyecto validan solo `tenantId` (apoyo en RLS, sin check de rol) | INTERPRETACIÓN | `lib/projects/actions.ts:65,93,117,126` vs `:161,172,183` | MEDIO |
| R7 | La segregación por persona no cubre partner_user ni grc_officer/change_manager/auditor | HIPÓTESIS | `INTERNAL_PERSONA_ROLES` (`access.ts:94`) | (ver §2.6) |

### 2.3 RLS y seguridad en Supabase (Fase 3)

RLS en **88/88 tablas**. Único sin política: `document_sequence` (deny-by-default, intencional).

| ID | Hallazgo | Tipo | Evidencia | Sev. |
|---|---|---|---|---|
| **S1** | **Aislamiento por fila ausente en datos de usuario/PII.** `incident`, `party`, `user_account`, `incident_comment`, `case_attachment`, `case_survey`, `case_work_log`, `fraud_case`, `dispute_case`: única política `cmd=ALL`, `roles={authenticated}`, `USING` y `WITH CHECK = (tenant_id = current_tenant_id())` — **sin owner-scoping**. Cualquier autenticado del tenant (incl. `partner_user` externo) **lee y escribe TODAS las filas del tenant** (PII, montos, cuentas) con la anon key pública, saltándose la app. | HECHO (políticas) + INTERPRETACIÓN (explotabilidad) | `pg_policies` (incident/party/user_account: `using`+`with_check`=tenant_id, `cmd=ALL`); anon key `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **CRÍTICO** |
| S2 | Refuerza R4: `/partner` sin permiso **no** tiene backstop en RLS (tenant-wide) | INTERPRETACIÓN | S1 + R4 | ALTO |
| S3 | **21 funciones SECURITY DEFINER ejecutables por `anon`** (+30 por authenticated) | HECHO | `get_advisors(security)`: `anon_security_definer_function_executable`×21 | MEDIO |
| S4 | **7 funciones con `search_path` mutable** | HECHO | advisor `function_search_path_mutable`×7 (ej. `derive_priority`, `set_incident_number`) | MEDIO |
| S5 | **Protección de contraseñas filtradas (HIBP) desactivada** en Auth | HECHO | advisor `auth_leaked_password_protection` | MEDIO |
| S6 | Extensión instalada en el schema `public` | HECHO | advisor `extension_in_public`×1 | BAJO |
| S7 | `document_sequence`: RLS ON sin política (deny-by-default) | HECHO | advisor `rls_enabled_no_policy` (INFO) | BAJO |
| S8 | `permission.permission_read` con `USING=true` (catálogo, baja sensibilidad) | HECHO | `pg_policies` | BAJO |

> **Matiz:** parte de S1 es "por diseño" si todo autenticado fuese staff interno; deja de serlo cuando existen usuarios externos `partner_user` (que el propio SSO/JIT aprovisiona).

### 2.4 Calidad de código (Fase 4)

| ID | Hallazgo | Tipo | Evidencia | Sev. |
|---|---|---|---|---|
| Q1 | Typecheck limpio en modo `strict` | HECHO (fortaleza) | `tsc --noEmit` → 0 errores | — |
| Q2 | Lint: 0 errores, 4 warnings triviales (variables sin usar) | HECHO | `npm run lint` | BAJO |
| **Q3** | **4 vulnerabilidades HIGH**: Next.js *GHSA-955p-x3mx-jcvp* (divulgación no autenticada de endpoints de Server Functions), postcss (XSS/path-traversal), sharp (CVEs libvips) | HECHO | `npm audit` → `{high:4}` | **ALTO** |
| Q4 | El fix del CVE de Next.js es solo un patch: `16.2.10 → 16.2.12` | HECHO | `npm outdated` | (bajo esfuerzo) |
| Q5 | `@supabase/ssr` 5 minors atrás (0.7.0 → 0.12.4) — lib crítica de auth | HECHO | `npm outdated` | MEDIO |
| Q6 | Mayores atrasados no urgentes: TypeScript 5.9→7.0, ESLint 9→10, @types/node 22→26, jsdom 29→30 | HECHO | `npm outdated` | BAJO |

### 2.5 Consistencia UX/UI (Fase 5)

| ID | Hallazgo | Tipo | Evidencia | Sev. |
|---|---|---|---|---|
| U1 | **Paridad i18n perfecta**: 2729 ES = 2729 EN, 0 faltantes | HECHO (fortaleza) | parseo `dictionaries.ts` | — |
| U2 | **~99% tokenizado**: 6184 `var(--…)` vs 54 hex hardcodeados en componentes | HECHO (fortaleza) | `git grep` | — |
| U3 | **Gris off-paleta `#8A948A` repetido en ~20 módulos** (+ `#F7CE4B`, `#8A9098`, `#B9BEC4` puntuales) en lugar de tokens | HECHO | `git grep -c "#8A948A"` | MEDIO |
| U4 | Dos abstracciones de botón coexisten: `.cx-btn-*` (42 usos) vs `components/ui/Button` (4 usos) | INTERPRETACIÓN | `git grep` | BAJO |
| U5 | Temas Nexus/Claro consistentes vía tokens semánticos | HECHO (fortaleza) | U2 + `app/globals.css` | — |

### 2.6 Deuda técnica y riesgos del fork (Fase 6)

| ID | Hallazgo | Tipo | Evidencia | Sev. |
|---|---|---|---|---|
| **F1** | **No existe gating por modo ni feature-flags.** `operating_mode`/`tenant_mode` declarado pero **muerto** (0 usos en código); único flag `NEXT_PUBLIC_SSO_ENABLED`. Un cliente simplificado hoy exige **fork de código duro** | HECHO + HIPÓTESIS | grep `operating_mode` en lib/app/components = 0 | **ALTO** |
| **F2** | Cliente simplificado con usuarios externos en infra compartida → **S1 es bloqueante** (un cliente vería/escribiría datos de otro). Remediar RLS antes de multi-cliente | INTERPRETACIÓN | hereda S1 | **CRÍTICO** |
| F3 | Acoplamiento a un solo esquema de 88 tablas / 49 dominios; el cliente simple necesita un subconjunto | INTERPRETACIÓN | Fases 1,3 | MEDIO |
| F4 | Dos forks duplican costo y conflictos (i18n monolítico, componentes grandes) | INTERPRETACIÓN | A2-A5 | MEDIO |
| F5 | Facilitadores del fork: capas limpias, ~99% tokenizado, i18n paritario, 0 service_role, typecheck estricto | HECHO (fortaleza) | Fases 1,4,5 | — |
| F6 | Vulnerabilidades de deps heredadas por ambos forks, más peligrosas en deploy cliente-facing | HECHO | Q3 | ALTO |
| F7 | `/partner` sin permiso heredado por ambos forks | HECHO | R4 | ALTO |

---

## 3. Plan de remediación priorizado

> No aplicado en esta sesión (diagnóstico). Orden por severidad y dependencia.

### P0 — CRÍTICO (bloquea multi-cliente / usuarios externos)
1. **Aislar RLS por dueño/fila en tablas con datos de usuario** (S1/F2). Opciones: (a) políticas de SELECT/UPDATE/DELETE que exijan pertenencia (`reported_by_user_id = current_account_id()` u owner equivalente) para roles no-gestores, y exponer al `partner_user` solo lo suyo vía RPCs SECURITY DEFINER owner-checked; (b) separar `cmd=ALL` en políticas por operación con `WITH CHECK` estricto; (c) si el modelo asume solo staff interno, **remover el rol externo del path autenticado directo**. Decisión de arquitectura. *Prerrequisito de cualquier fork multi-cliente.*

### P1 — ALTO
2. **`/partner`** (R4/S2/F7): agregar entrada en `ROUTE_PERMISSIONS` (p.ej. `partner.read`) o retirar la ruta hasta re-gating por `party`.
3. **Patch de dependencias** (Q3/F6): `npm audit fix` → Next.js `16.2.12` (cierra la divulgación de Server Functions) + postcss/sharp. Verificar con `build`.
4. **Estrategia de fork** (F1): decidir **config/modo vs fork de código**. Recomendado: activar `operating_mode` + feature-flags de módulo sobre un solo codebase (reusa el RBAC/nav), tras P0.

### P2 — MEDIO
5. Habilitar **HIBP** en Auth (S5, ajuste de dashboard).
6. Fijar `search_path` en las **7 funciones** restantes (S4) y **revocar EXECUTE de `anon`** en funciones SECURITY DEFINER que no deban ser públicas (S3).
7. Auditar que **toda action de dato compartido chequee rol**, no solo `tenantId` (R6).
8. Actualizar **`@supabase/ssr`** con pruebas de auth (Q5).
9. Plan de partición de esquema/i18n si se opta por fork de código (F3/F4/A2).

### P3 — BAJO
10. Reemplazar el gris off-paleta `#8A948A` (~20 archivos) por un token (`--muted`/`--outline`) (U3).
11. Consolidar la abstracción de botón (adoptar `ui/Button` o estandarizar en `.cx-btn-*`) (U4).
12. Mover la extensión de `public` a `extensions` (S6); política explícita en `document_sequence` (S7); limpiar warnings de lint (Q2).

---

## 4. Limitaciones del diagnóstico

- **Modo solo lectura**: no se ejecutó la app (sin `npm run dev`), por lo que las dimensiones que requieren servidor (QA funcional en vivo, auditoría DX en vivo, regresión visual, benchmarks de performance) **no se cubrieron**; se reemplazaron por análisis estático.
- La **explotabilidad de S1** se sustenta en que la anon key es pública (`NEXT_PUBLIC_*`) y que existen usuarios externos `partner_user`; no se ejecutó un PoC (sería una acción de escritura/prueba fuera del alcance solo-lectura).
- Supabase: solo el proyecto **CREDIXNEXUS** (`dffbysjrvvlwgzgakhaa`), solo lecturas (`pg_policies`, `get_advisors`, `information_schema`).
- Los conteos de dependencias reflejan el estado del `node_modules`/registro al 2026-08-01.

---

*Diagnóstico generado con la suite gstack. Ninguna remediación fue aplicada. Desarrollado por Ignacio Perez Rubio (Arquitecto) y el grupo de SQUADS a cargo.*
