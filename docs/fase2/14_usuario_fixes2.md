# Fase 2 · Ajustes rol Usuario (línea Claro, CTA, landing)

## 1. Línea de Claro demasiado oscura → más suave
`--line` de Claro: `#3A3A3A` (casi negro, muy fuerte) → **`#B0B0B0`** (gris medio, visible pero
suave). `--line-soft`: `#C4C4C4` → `#DADADA`.

## 2. Quitar el botón "Reportar caso" del header para el Usuario
- `role-ux.ts`: se elimina `primaryAction` del `partner_user` → **sin CTA en el header** (el intake
  ya vive en `/portal`). El fallback `newTicket` ahora exige `incident.read` (espeja el guard de su
  ruta `/incidents/new`), que el usuario no tiene → `resolvePrimaryAction` devuelve `null`.
- Tests de `role-ux` actualizados.

## 3. Al ingresar "a veces aparece el dashboard total" → nunca para el Usuario
El guard de ruta del layout depende de `x-pathname` (lo setea el proxy/middleware `proxy.ts`). Para
que el usuario final **nunca** vea el dashboard, se agregó **defensa en profundidad**:
- `app/(app)/dashboard/page.tsx`: si no es admin y no tiene `incident.read`, **redirige a `/start`**
  (que resuelve el home por rol → `/portal`). El dashboard es staff-only.
- `components/app-shell/unauthorized.tsx`: el botón "home" iba **hardcodeado a `/dashboard`** (bucle
  para el usuario) → ahora a **`/start`** (home por rol).

*(Si apareciera la misma fuga en otras páginas de agente, se extiende el guard de página o se revisa
la propagación de `x-pathname`; el dashboard —lo reportado— queda cubierto de forma definitiva.)*

**Verificación:** `lint` 0/0 ✅ · `build` ✅ · `vitest` **250/250** ✅.
