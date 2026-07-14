# Fase 2 · UX-009 — Persona del Usuario y portal de partner externo (cierre)

## Resolución de la ambigüedad de persona (UX-009)
**HECHO:** la cuenta `partner_user` real ("Usuario Final") **no tiene party** → es un
**colaborador interno de autoservicio**, no un partner externo. El copy de `/portal` ("mesa de
ayuda interna", "colaborador") es coherente con esto.

**Decisión formalizada:**
- **`/portal` es el hub canónico del Usuario** (interno / autoservicio): registrar y consultar sus
  casos, con detalle propio, hilo y CSAT.
- **`/partner`** (portal por **organización/party**) es una superficie para **partners externos**,
  no para este rol. Ya salió de la navegación cotidiana (UX-007) y su fallback demo se eliminó
  (UX-019); con estado honesto "sin organización vinculada".

## Portal de partner externo — DIFERIDO (fase dedicada)
Reintroducir el portal de partner externo es una **pieza de producto propia**, no una limpieza:
- Requiere identificar cuentas **externas** (p.ej. `user_account.party_id` no nulo, o un rol/
  permiso dedicado de partner externo) y **gatear `nav.partner`** por esa condición (hoy la
  navegación se gatea por permiso, no por dato → hace falta un mecanismo nuevo).
- Requiere definir el alcance externo (branding por party, tickets por `affected_party_id`,
  aislamiento reforzado) y su seguridad (RLS por party, no solo por tenant).

**Recomendación:** abordarlo como fase propia cuando exista el caso de negocio de partners externos
con cuentas reales (party asignada). La base ya está: la ruta `/partner`, la vista con estado
honesto y la query por `affected_party_id`.

## Estado de UX-009
**Cerrado como decisión de producto:** persona = colaborador interno; `/portal` canónico; portal
externo diferido con ruta de implementación documentada. Sin cambio de código adicional en esta fase.
