# Checklist para TI de Credix — Habilitar SSO (Entra ID) en Credix Nexus

Documento para solicitar a TI de Credix todo lo necesario para federar el login de Credix Nexus
con Entra ID (Azure AD). Credix Nexus usa **Supabase Auth con proveedor Azure (OIDC)**. La
integración es estándar (App Registration + OIDC); NO requiere que Credix exponga infraestructura.

> Dato que TI necesita de nuestro lado para registrar la app (Redirect URI canónica):
> **`https://dffbysjrvvlwgzgakhaa.supabase.co/auth/v1/callback`**

---

## A. Arquitectura de identidad

- [ ] **Modelo de Entra ID**: ¿cloud-only o híbrido con **Entra Connect** (sincronización desde un
      AD on-premise)? (Solo para entender el origen de las cuentas; no cambia la integración OIDC.)
- [ ] **Directory (tenant) ID** de Entra ID: `________________________________`
- [ ] Dominio(s) de correo corporativo que usarán los usuarios (p.ej. `@credix.com`):
      `________________________________`

## B. App Registration (Entra ID)

- [ ] Crear una **App Registration** para "Credix Nexus".
- [ ] **Application (client) ID**: `________________________________`
- [ ] Registrar la **Redirect URI** (tipo Web) EXACTAMENTE:
      `https://dffbysjrvvlwgzgakhaa.supabase.co/auth/v1/callback`
- [ ] Generar un **client secret** → entregar **Secret Value** + **fecha de vencimiento** por canal
      seguro (gestor de secretos / vault), NUNCA por correo o chat.
      - Valor: `________________________________`  ·  Vence: `____________`
- [ ] **Scopes / permisos**: OIDC `openid`, `email`, `profile`. Confirmar que el token incluye el
      claim **email** (es la clave de vinculación) y **oid**/**sub** (identificador estable).
- [ ] **Consentimiento**: otorgar admin consent si la política del tenant lo exige (para que los
      usuarios no vean prompt de consentimiento individual).
- [ ] **Restricción de tenant**: la app se configurará restringida al tenant de Credix (no `common`),
      de modo que solo cuentas del directorio de Credix puedan autenticarse. Confirmar que es lo deseado.

## C. Usuarios y roles (pre-aprovisionamiento)

> Credix Nexus usa **pre-aprovisionamiento estricto**: solo entra quien ya tiene cuenta creada con su
> email corporativo. No hay creación automática de cuentas para identidades federadas.

- [ ] **Lista de usuarios iniciales**: email corporativo (AD) + rol en Credix Nexus. Formato sugerido:

  | Email corporativo | Nombre | Rol en Credix Nexus |
  |---|---|---|
  | | | |

- [ ] Confirmar que el **email AD** de cada usuario es el que emitirá Entra ID en el token (para que
      el match sea automático).
- [ ] (Futuro) **Grupos de AD**: ¿se prevé mapear grupos de AD a roles más adelante? ¿Cuáles?

## D. Operación y seguridad

- [ ] **Política de rotación** del client secret (frecuencia) y responsable de rotarlo:
      `________________________________`
- [ ] **Pilotos**: 2–3 usuarios para la prueba inicial del día D (con acceso ya pre-aprovisionado):
      `________________________________`
- [ ] Contacto técnico de TI para la activación: `________________________________`

---

## Qué hará el equipo de Credix Nexus con estos datos (referencia)

1. Configurar el proveedor Azure en Supabase Auth restringido al tenant de Credix (usando tenant ID,
   client ID y client secret). Ver `docs/sso/RUNBOOK_ACTIVACION.md`.
2. Pre-cargar los `user_account` de la lista con el email corporativo real.
3. Encender el feature flag y probar con los pilotos.
4. Deshabilitar por lotes el login por contraseña de las cuentas federadas (decisión de negocio).

**Nada de lo entregado (tenant ID, client ID, secret) se guarda en el código de la app.** El secret
vive solo en la configuración del proveedor en Supabase.
