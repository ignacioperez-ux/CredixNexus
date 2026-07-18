# Runbook — Activación de SSO con Entra ID (día D)

> Estado hoy: **DORMIDO**. Todo el código está en el repo detrás del flag
> `NEXT_PUBLIC_SSO_ENABLED` (hoy `false`). Con el flag apagado la app es idéntica a hoy.
> Las migraciones de BD (0121 vinculación, 0122 RPC de solicitud) **ya están aplicadas** en el
> proyecto Supabase `CREDIXNEXUS`. Activar SSO el día D toma minutos: configurar el proveedor
> Azure en el dashboard + encender el flag.

Marcos: OIDC (Azure nativo de Supabase Auth), pre-aprovisionamiento estricto (sin JIT para
identidades federadas), login email/password intacto durante y después.

---

## 0. Datos del proyecto (referencia)

| Dato | Valor |
|---|---|
| Proyecto Supabase | `CREDIXNEXUS` · ref `dffbysjrvvlwgzgakhaa` · Postgres 17 · ca-central-1 |
| **Redirect URI canónica** (Azure → Supabase) | `https://dffbysjrvvlwgzgakhaa.supabase.co/auth/v1/callback` |
| Callback de la app (retorno post-login) | `<ORIGEN_APP>/auth/callback` (p.ej. Railway) |
| Flag de activación | `NEXT_PUBLIC_SSO_ENABLED` (frontend; hoy `false`) |
| Proveedor | `azure` (OIDC), **restringido al tenant de Credix** (NO `common`) |
| Estrategia | Pre-aprovisionamiento: solo emails ya existentes en `user_account` se vinculan |

**Ningún secreto va al repo ni al frontend.** Tenant ID, Client ID y Client Secret se cargan
EXCLUSIVAMENTE en el dashboard de Supabase (Authentication > Providers > Azure).

---

## 1. Insumos que entrega TI de Credix

Ver checklist detallado en `docs/sso/CHECKLIST_CREDIX_TI.md`. Mínimo imprescindible:

1. **Directory (tenant) ID** de Entra ID.
2. **Application (client) ID** de una App Registration en Entra ID.
3. **Client secret** (valor + fecha de vencimiento) — entregado por canal seguro, NO por correo/chat.
4. Confirmación de que registraron la **Redirect URI canónica** (fila de arriba) en la App Registration.
5. **Dominios de correo corporativos** (p.ej. `@credix.com`) y la **lista de usuarios iniciales**
   (email AD + rol) para pre-aprovisionar en `user_account`.

---

## 2. Configurar el proveedor Azure en Supabase (dashboard)

Dashboard de Supabase → **Authentication → Providers → Azure** → Enable:

- **Application (client) ID**: el que entregó TI.
- **Secret Value**: el client secret.
- **Azure Tenant URL** (restricción de tenant, clave para no permitir cuentas de otros directorios):
  `https://login.microsoftonline.com/<DIRECTORY_TENANT_ID>/v2.0`
  → usar el tenant ID de Credix. **NUNCA `common`, `organizations` ni `consumers`.**

Luego → **Authentication → URL Configuration**:

- **Site URL**: el origen de la app en producción (p.ej. la URL de Railway).
- **Redirect URLs (allowlist)**: agregar `<ORIGEN_APP>/auth/callback` (y las variantes de origen que
  uses). Sin esto, Supabase rechaza el retorno del login.

> La app pide scopes `openid email profile`. El claim **email** debe venir en el token (es la clave
> del match). El **oid/sub** se guarda en `user_account.external_subject`.

---

## 3. Migraciones de BD

Ya aplicadas en `CREDIXNEXUS` (no hay paso pendiente si se usa este mismo proyecto):

- **`sql/0121_federated_login_linking.sql`** — `handle_new_user()` provider-aware: para identidad
  `azure` solo **vincula-si-existe** un `user_account` activo por email (citext, case-insensitive),
  setea `identity_provider='azure'`, `external_subject`, `last_login_at`; conflict-safe; **no crea
  cuentas** ni asigna roles. Identidades password/email quedan intactas.
- **`sql/0122_access_request_rpc.sql`** — `request_access_federated()` (SECURITY DEFINER): registra
  la solicitud `SI_SOLICITUD_ACCESO` para un federado NO aprovisionado (email del token, anti-duplicado).

> Si algún día se levanta un proyecto Supabase NUEVO, aplicar ambas migraciones antes de encender el
> flag. Verificación rápida: el trigger `on_auth_user_created` sobre `auth.users` debe ser
> `AFTER INSERT OR UPDATE` y la función debe contener la rama `azure`.

---

## 4. Encender el flag

En el ambiente (Railway u otro): `NEXT_PUBLIC_SSO_ENABLED=true` → **redeploy** (es una variable
`NEXT_PUBLIC_`, se inlinea en build; requiere reconstruir, no solo reiniciar).

Efecto: aparece el botón **"Ingresar con cuenta Credix"** en `/login` y en la landing; se activan
las rutas `/auth/callback` y `/no-access`. El login email/password sigue igual.

---

## 5. Prueba con pilotos (2–3 usuarios)

Pre-requisito: los pilotos deben existir en `user_account` con su **email corporativo real** (ver §7).

Checklist por piloto:

- [ ] Click en "Ingresar con cuenta Credix" → redirige a Microsoft → autentica.
- [ ] Retorna a la app y cae en `/start` (no en `/no-access`).
- [ ] **Vínculo creado**: en BD, su `user_account` tiene `auth_user_id` seteado,
      `identity_provider='azure'`, `external_subject` con el oid, `last_login_at` reciente.
- [ ] **Roles intactos**: ve exactamente su sidebar de siempre (el trigger NO reasigna roles).
- [ ] **RLS funcionando**: solo ve datos de su tenant; nada cross-tenant.
- [ ] Un usuario SIN cuenta (email no aprovisionado) cae en `/no-access`, puede "Solicitar acceso"
      (crea un caso `SI_SOLICITUD_ACCESO`) y la sesión se cierra sola.

Consulta de verificación del vínculo (Supabase SQL):

```sql
select email, identity_provider, (auth_user_id is not null) as vinculado,
       external_subject is not null as con_oid, last_login_at
from public.user_account
where email in ('piloto1@credix.com','piloto2@credix.com');
```

---

## 6. Decisión por lotes: `password_auth_disabled`

Una vez validados los pilotos, se puede deshabilitar el login por contraseña de las cuentas ya
federadas (opcional, por usuario/lote — NO lo hace el trigger). Es una **decisión de negocio**:

```sql
-- Deshabilita password para cuentas YA vinculadas a azure (revisar la lista antes de ejecutar):
update public.user_account
set password_auth_disabled = true
where identity_provider = 'azure' and auth_user_id is not null
  and email in ( /* lista explícita de emails del lote */ );
```

> Recomendación: hacerlo por lotes chicos, después de confirmar que cada usuario ya entró por SSO.
> Dejar al menos una cuenta de administración con password como salvaguarda de acceso de emergencia.

---

## 7. Dependencia con el seed / carga de usuarios

El match de vinculación es por **email**. Para que un colaborador entre por SSO **automáticamente**,
su `user_account` debe existir de antemano con su **email corporativo verdadero** (el mismo que emite
Entra ID). Al cargar el seed / los usuarios reales:

- Usar el email corporativo real (no placeholders tipo `@example.com`).
- El email es `citext` → el match es case-insensitive (no importan mayúsculas).
- Pre-cargar el rol correcto (el trigger no asigna roles a federados).

La lista de usuarios iniciales sale del checklist de TI (`CHECKLIST_CREDIX_TI.md`).

---

## 8. Rotación del client secret

- Los secrets de Entra ID **vencen** (típicamente 6–24 meses). Anotar la fecha de vencimiento que
  entregó TI y agendar recordatorio ~30 días antes.
- Al rotar: TI genera un secret nuevo en la App Registration → se pega el nuevo **Secret Value** en
  Supabase (Authentication > Providers > Azure) → guardar. No requiere cambios de código ni redeploy.
- Un secret vencido rompe SSO (los usuarios federados no pueden entrar) pero **no** afecta el login
  password; mitigación inmediata: apagar el flag (§9) mientras se rota.

---

## 9. Plan de reversa (volver a hoy)

Reversa inmediata y total, sin tocar la BD:

1. `NEXT_PUBLIC_SSO_ENABLED=false` → redeploy. El botón SSO desaparece; `/auth/callback` y
   `/no-access` quedan inertes; la app es **idéntica a hoy**. Los usuarios ya vinculados siguen
   pudiendo entrar por password si lo tienen habilitado.

Reversa opcional de BD (solo si se quiere revertir la lógica de vinculación):

2. Ejecutar el bloque de ROLLBACK documentado al pie de `sql/0121_federated_login_linking.sql`
   (restaura `handle_new_user()` a la versión previa + trigger `AFTER INSERT`).
3. `drop function if exists public.request_access_federated(text);` (rollback de 0122).

> Nota: si ya se puso `password_auth_disabled=true` a cuentas federadas, revertir SSO puede dejarlas
> sin forma de entrar. Antes de una reversa amplia, reactivar password donde haga falta:
> `update public.user_account set password_auth_disabled=false where email in (...);`

---

## Anexo — Flujo técnico (resumen)

1. Usuario click "Ingresar con cuenta Credix" → `signInWithOAuth({ provider:'azure', scopes:'openid email profile', redirectTo:'/auth/callback' })`.
2. Autentica en Microsoft (tenant de Credix) → Supabase crea/actualiza `auth.users` → dispara
   `handle_new_user()` → vincula por email si existe cuenta pre-aprovisionada.
3. Retorno a `/auth/callback` → intercambia code por sesión → si hay `user_account` vinculado → `/start`;
   si no → `/no-access`.
4. En `/no-access`: "Solicitar acceso" → `request_access_federated()` (crea `SI_SOLICITUD_ACCESO`) →
   cierra sesión.
