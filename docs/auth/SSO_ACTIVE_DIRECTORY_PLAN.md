# Plan y diseño — Integración con Active Directory de Credix (SSO)

> **Estado: IMPLEMENTADO (2026-07-31)** en la rama `feat/credix-design-system`. La capa de BD y la
> pantalla de administración están aplicadas y validadas. Falta solo la **config del "día D"**
> (Entra ID + provider Azure en Supabase + cargar dominios + encender el flag) — ver §8/§13.
> **Objetivo:** que los usuarios corporativos de Credix entren con su identidad de AD y registren
> sus casos "de manera natural", usando el perfil **`partner_user`** (portal de autoservicio).
>
> ### Lo aplicado (migraciones + UI)
> - `sql/0130_sso_allowed_domain.sql` — tabla maestra (RLS por tenant, soft delete, auditoría, FK rol, dominio único).
> - `sql/0131_handle_new_user_jit.sql` — JIT por dominio (crea `user_account` en CORE + `partner_user` + evento `user.provisioned_sso`); conflict-safe; rama email/password intacta.
> - `sql/0132_fix_user_role_audit.sql` — **fix de bug latente**: `trg_audit_user_role` usaba `audit_row_change()` (asume `tenant_id`/`id` inexistentes en `user_role`) → rompía toda asignación de rol; ahora `audit_user_role_change()` deriva el tenant desde `user_account`.
> - `sql/0133_harden_trigger_grants.sql` — revoca EXECUTE de las trigger functions (advisors limpios).
> - UI: `app/(app)/admin/sso-domains` + `components/admin/sso-domains-admin.tsx` + `lib/auth/sso-domains.ts` (CRUD admin) + nav `nav.sso_domains` + i18n `sso.admin.*` (ES/EN).
>
> **Validación:** pruebas transaccionales (revertidas) del trigger — JIT crea cuenta+rol+2 eventos de
> ledger; dominio no permitido → sin cuenta; email/password intacto (y ahora funcional). `build`/`tsc`/
> `lint` OK. Advisors de seguridad: objetos nuevos sin lints.

---

## 1. Estado actual (verificado en el repo, §2.6)

La app **ya tiene el andamiaje SSO completo pero dormido** (tras `NEXT_PUBLIC_SSO_ENABLED`):

| Pieza | Ubicación | Qué hace hoy |
|---|---|---|
| Botón + inicio OAuth | `lib/auth/sso.ts` → `signInWithAzure` | `signInWithOAuth({provider:'azure'})`, OIDC/PKCE, scopes `openid email profile`, retorno a `/auth/callback` |
| Callback | `app/auth/callback/route.ts` | Intercambia `code`→sesión; si hay `user_account` → `/start`, si no → `/no-access` |
| Trigger de vinculación | `sql/0121_federated_login_linking.sql` → `handle_new_user()` | **Provider-aware**: identidad `azure` **solo vincula-si-existe** por email (no crea cuenta, no asigna rol); email/password conserva el JIT actual |
| Solicitud de acceso | `sql/0122_access_request_rpc.sql` → `request_access_federated()` | Identidad federada sin cuenta → crea incidente `SI_SOLICITUD_ACCESO` (no falsificable, email del token) |
| Sesión/roles | `lib/auth/session.ts` | `user_account` (auth_user_id→tenant/party) + RPC `my_access()` (perms+roles) |
| Rol destino | `sql/0012_seed_inventory.sql`, `sql/0070_partner_user_perms.sql` | `partner_user` = `incident.create` + `knowledge.read` + `knowledge.feedback` (mínimo privilegio) |
| Columnas de identidad | `sql/0002_tenant_identity.sql` | `user_account.identity_provider`, `external_subject`, `password_auth_disabled` |

**Conclusión:** el "cómo se autentica" está resuelto. Lo que falta decidir e implementar es el
**modelo de aprovisionamiento** (cómo un empleado de Credix obtiene su `user_account` + rol
`partner_user` + tenant) y la **configuración de Entra ID + Supabase**.

---

## 2. Decisión central — modelo de aprovisionamiento

El diseño actual es **pre-aprovisionamiento estricto**: alguien debe crear el `user_account` (con el
email corporativo) *antes* de que el empleado entre. Eso **no** es "entrar de manera natural" para
toda una organización. Opciones:

| Opción | Cómo entra el usuario | Pro | Contra | Recomendación |
|---|---|---|---|---|
| **A. JIT por dominio verificado** | Primer login Azure con email `@credix.com` (dominio en allowlist) → se crea `user_account` en el tenant mapeado + rol `partner_user` automáticamente | "Natural", cero fricción, escala a toda la plantilla | Cualquiera del dominio entra (mitigable con Entra: solo usuarios asignados a la app) | **✅ Recomendada** para el objetivo |
| **B. JIT por grupo de AD** | Igual que A, pero además el rol sale de un **grupo de Entra ID** (claim `groups`/`roles`) → `partner_user` solo si pertenece al grupo `CredixNexus-Usuarios` | Control fino desde AD (gobierno TI), rol gestionado por el equipo de identidad | Requiere configurar app roles/claims en Entra y mapeo grupo→rol en BD | ✅ Ideal si TI quiere gobernar acceso desde AD |
| **C. Pre-aprovisionamiento estricto (actual)** | TI/mesa crea cada cuenta antes | Máximo control, nada implícito | No escala, no es "natural" | Solo para roles internos sensibles |

**Recomendación:** **A como base + B como refuerzo** (JIT por dominio, y si TI publica un grupo de
AD, el rol se deriva del grupo; sin grupo, cae a `partner_user` por defecto). Ambas mantienen el
pre-aprovisionamiento estricto para roles internos (agente, admin, evolución): esos siguen creándose
a mano; JIT solo otorga `partner_user`.

> **Restricción de seguridad recomendada (independiente de A/B):** en Entra ID, marcar la Enterprise
> App como **"User assignment required = Yes"**. Así, aunque el JIT admita el dominio, solo entran los
> usuarios/grupos que TI asigne explícitamente a la aplicación. Doble control (dominio + asignación).

---

## 3. Arquitectura de la solución

```
[Usuario Credix] --(1) click "Entrar con Credix"--> [CredixNexus /login]
      |                                                     |
      |  (2) signInWithOAuth(azure, PKCE)                   v
      +--------------------> [Microsoft Entra ID] --(3) login corporativo (MFA de AD)
                                    |
      (4) redirect con code --------+--> [/auth/callback]
                                            |
      (5) exchangeCodeForSession            v
      (6) trigger handle_new_user (azure):  [Supabase Auth  auth.users]
            - JIT: si email en dominio permitido y sin cuenta -> crea user_account + rol partner_user
                   (+ evento de ledger)   ------------------>  [public.user_account / user_role]
            - si no aplica -> /no-access (+ request_access_federated opcional)
                                            |
      (7) my_access() -> perms/roles        v
      (8) redirect -------------------> [/start -> /portal (registrar caso)]
```

Sin nueva infraestructura: **Entra ID (IdP OIDC)** ↔ **Supabase Auth (broker OAuth)** ↔ **CredixNexus**.
El AD de Credix se expone vía **Microsoft Entra ID** (Azure AD); Supabase ya soporta `provider: azure`.

---

## 4. Configuración de Entra ID (equipo de identidad de Credix)

1. **App registration** (o Enterprise App) "CredixNexus":
   - Tipo de cuenta: *Single tenant* (solo el directorio de Credix).
   - **Redirect URI (Web):** `https://<PROYECTO>.supabase.co/auth/v1/callback` (el callback de Supabase, no el de la app).
   - Genera **Client ID** + **Client secret** (secreto → va al dashboard de Supabase, nunca al repo).
2. **API permissions:** `openid`, `email`, `profile` (delegados, consentimiento de admin).
3. **Token claims:** asegurar `email` y `oid` (subject estable). Para opción B: agregar **App roles**
   o el claim **`groups`** y publicar el grupo `CredixNexus-Usuarios`.
4. **Enterprise App → Properties:** `User assignment required = Yes`; asignar el/los grupos que pueden entrar.
5. (Opcional) *Conditional Access* / MFA los gestiona Credix en Entra — CredixNexus lo hereda.

## 5. Configuración de Supabase (día D, dashboard — no en el repo)

1. **Authentication → Providers → Azure:** pegar Client ID + Secret + **Azure Tenant URL**
   (`https://login.microsoftonline.com/<TENANT_ID>`). Habilitar.
2. **URL configuration → Redirect URLs:** agregar `https://<app-credixnexus>/auth/callback` (+ local para pruebas).
3. Verificar que **email confirmations** no bloqueen el flujo federado.
4. Secretos SOLO en el dashboard/entorno seguro (CLAUDE.md §3.1 #6). En la app, `NEXT_PUBLIC_SSO_ENABLED=true` el día D.

---

## 6. Cambios propuestos (a implementar tras aprobación) — resumen

Todos **idempotentes, con rollback**, respetando RLS/audit. Ninguno se aplica en este plan.

### 6.1 Base de datos (nuevas migraciones `sql/013x_*`)
- **`sso_allowed_domain`** (nueva tabla, opción A): `tenant_id`, `domain` (citext, unique), `default_role`
  (fk `role`, default `partner_user`), `is_active`, auditoría + soft delete. **RLS on** + policy por
  `tenant_id`. Es un **dato maestro** → CRUD + pantalla en Datos Maestros (CLAUDE.md §10).
- **`handle_new_user()` v3 (rama azure):** extender la rama federada: si no hay `user_account` y el
  dominio del email está en `sso_allowed_domain` activo → **crear** `user_account` (tenant mapeado,
  `identity_provider='azure'`, `external_subject=oid`) + asignar `default_role` (o rol derivado del
  claim de grupo, opción B) + **registrar `immutable_audit_event`** de aprovisionamiento (audit-grade,
  CLAUDE.md §11). Mantener conflict-safe y el pre-aprovisionamiento estricto para roles internos.
- (Opción B) **`sso_group_role_map`**: `group_object_id` → `role`. El trigger lee el claim de grupos.

### 6.2 Frontend (mínimo — el grueso ya existe)
- Encender el botón SSO (ya montado tras `SSO_ENABLED`); ajustar copy "Entrar con Credix".
- `/no-access`: ya permite `requestFederatedAccess`; revisar mensajes i18n ES/EN.
- El resto del flujo (portal `partner_user` → registrar caso) **ya funciona**: JIT solo lo habilita.

### 6.3 Seguridad y auditoría
- Mínimo privilegio: JIT **solo** otorga `partner_user` (nunca roles internos).
- Email **siempre del token** (no del cliente). `oid` como `external_subject` estable.
- Todo aprovisionamiento JIT deja **evento de ledger** (quién/cuándo/proveedor/dominio).
- RLS intacto: el `user_account` creado lleva `tenant_id` → las policies existentes aplican sin cambios.
- `User assignment required` en Entra + allowlist de dominios = doble control.

---

## 7. Flujo de usuario final ("natural")

1. Va a CredixNexus → **"Entrar con Credix"**.
2. Login corporativo en Microsoft (SSO/MFA de AD) — sin contraseña nueva.
3. Primera vez: JIT crea su cuenta `partner_user` en el tenant correcto (transparente).
4. Cae en el **portal de autoservicio** → pestaña **Registrar** → crea su caso.
5. Reingresos: vinculación por `oid`, va directo a su portal y sus casos.

## 8. Runbook día D + rollback

- **Activación:** configurar Entra + Supabase (dashboard) → aplicar migraciones 6.1 → poblar
  `sso_allowed_domain` (ej. `credix.com`) → `NEXT_PUBLIC_SSO_ENABLED=true` → smoke.
- **Rollback:** `NEXT_PUBLIC_SSO_ENABLED=false` (la app vuelve a ser idéntica a hoy, botón no se
  monta, callback inerte) y, si hiciera falta, revertir `handle_new_user()` a la v2 (bloque de
  rollback ya presente en 0121). Sin pérdida de datos.

## 9. Plan de pruebas (E2E, foco `partner_user`)
- Login federado de dominio permitido → aterriza en portal y puede registrar caso.
- Login federado de dominio NO permitido → `/no-access` + puede solicitar acceso (sin crear cuenta).
- Reingreso vincula por `oid` (no duplica cuenta).
- Rol interno pre-aprovisionado (agente) sigue entrando por su flujo, sin degradación.
- Con `SSO_ENABLED=false` la app es indistinguible de hoy (regresión cero).

## 10. Fases de implementación (tras aprobar)
1. **DB:** migraciones 6.1 (+ tabla maestra `sso_allowed_domain` con su pantalla de Datos Maestros).
2. **Config:** Entra ID + Supabase (Credix TI + arquitecto; secretos fuera del repo).
3. **Frontend:** encender flag + copy i18n.
4. **Pruebas:** E2E federado (server del usuario + cuenta de prueba de AD).
5. **Go-live:** runbook §8 + monitoreo de `immutable_audit_event`.

---

## 11. Decisiones (CONFIRMADAS por el arquitecto — 2026-07-30)

1. **Modelo de provisión:** ✅ **Opción A — JIT por dominio + `User assignment required=Yes` en Entra**
   (doble control: dominio permitido + asignación explícita en la Enterprise App).
2. **Rol por defecto del JIT:** ✅ **`partner_user`** (mínimo privilegio: crear casos + knowledge).
3. **Tenant destino:** ✅ **`CORE`** (coincide con el andamiaje SSO existente).
4. **Gobierno del acceso:** ✅ `User assignment required` activo en Entra.

### Pendientes operativos (no bloquean el diseño; se definen en el "día D")
- **Dominio(s) corporativo(s)** exactos a cargar en `sso_allowed_domain` (ej. `credix.com`).
- **Dueño de la config de Entra ID** (equipo de identidad de Credix) y fecha del "día D".
- (Opcional futuro) refuerzo B (grupo de AD → rol) si TI quiere gobernar el rol desde el directorio.

## 12. Diseño cerrado — resumen de implementación (para aprobar la ejecución)

Con las decisiones fijadas, la implementación se reduce a:
1. **Migración `sql/013x_sso_allowed_domain.sql`** — tabla maestra (RLS on, soft delete, auditoría),
   seed vacío; + pantalla en Datos Maestros (CRUD, CLAUDE.md §10).
2. **Migración `sql/013x_handle_new_user_jit.sql`** — v3 de la rama azure: JIT por dominio en `CORE`,
   rol `partner_user`, `external_subject=oid`, **evento `immutable_audit_event`**; conflict-safe;
   con bloque de rollback a la v2. No toca RLS ni la rama email/password.
3. **Frontend:** encender flag + copy i18n ES/EN del botón "Entrar con Credix" y `/no-access`.
4. **Config (día D, fuera del repo):** Entra ID + Supabase provider azure (secretos en dashboard).
5. **E2E** federado (§9) con cuenta de prueba de AD.

> Aplicar migraciones a Supabase (BD prod) es paso de **Implementador** y requiere tu autorización
> explícita por fase (CLAUDE.md §2.4/§3.1). Este documento deja el diseño listo para esa ejecución.
