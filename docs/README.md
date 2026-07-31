# Documentación de CredixNexus

Esta carpeta contiene la documentación formal de **CredixNexus** (plataforma ITSM + Motor de Transformación, audit-grade).

## Documentos principales

- **[Documentación Funcional](./CREDIXNEXUS_DOCUMENTACION_FUNCIONAL.md)** — para negocio, líderes, testers y administradores: módulos, pantallas, roles, flujos, entidades, reglas de negocio y brechas funcionales.
- **[Documentación Técnica](./CREDIXNEXUS_DOCUMENTACION_TECNICA.md)** — para desarrolladores, arquitectos, DevOps, seguridad y soporte: arquitectura, stack, routing, capa de datos, modelo de datos (88 tablas / RLS / RPC / triggers), auth/SSO, integraciones, pruebas, despliegue y deuda técnica.

## Otros documentos relacionados

- `docs/auth/SSO_ACTIVE_DIRECTORY_PLAN.md` — plan/diseño e implementación del SSO con Active Directory (Entra ID).
- `docs/ui/CREDIX_DESIGN_SYSTEM_INTEGRATION.md` — integración del Design System oficial de Credix.

## Control de versión

| Campo | Valor |
|---|---|
| Fecha | 2026-07-31 |
| Commit analizado | `a1826a2` |
| Rama | `docs/credixnexus-functional-technical-documentation` |
| Fuente de verdad | Código del repositorio + esquema real de Supabase (`dffbysjrvvlwgzgakhaa`, PostgreSQL 17) |
| Responsable | Ignacio Perez Rubio (Arquitecto) y el grupo de SQUADS a cargo |

## Cómo mantener esta documentación actualizada

1. Regenerar/revisar tras cambios estructurales (nuevas rutas, tablas, RPC, roles o integraciones).
2. Verificar contra la **fuente de verdad**: código (`app/`, `components/`, `lib/`), migraciones (`sql/`) y esquema real de Supabase — no basarse en nombres de carpeta.
3. Actualizar el **commit analizado** y la **fecha** en las portadas y en este índice.
4. Marcar explícitamente el estado de cada funcionalidad (Implementado / Parcial / Mock / No verificado) y no documentar supuestos como hechos.
5. Nunca incluir secretos ni valores de variables de ambiente (solo nombres).
6. Mantener consistencia de nombres de entidades entre el documento funcional y el técnico.

> Este README describe únicamente la carpeta `docs/`. No sustituye al `README.md` principal del proyecto.
