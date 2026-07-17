# snapshot_anon — dump anonimizado del seed-data

Snapshot **anonimizado** de los datos del tenant demo (CREDIX), seguro para versionar.
Generado desde el dump crudo `backup/pre_seed_*/` (gitignored: contiene posible PII) con
`sql/seed/anonymize_snapshot.py`.

## Qué se enmascaró (por tabla + columna, determinista)
- `user_account`: email, username, full_name, external_subject.
- `party`: legal_name, display_name, tax_id, email, phone, external_ref.
- `team_member`: name, email.
- `incident`: customer_name, transaction_reference, metadata (→ `{}`).
- `digital_experience_event`: customer_id, session_id.

El resto de columnas (IDs/UUID, estados, fechas, montos, FKs) y las tablas de catálogo
(cuyos `name` son etiquetas de negocio, no PII: service/product/business_unit/…) se copian
tal cual.

## Excluido
- `immutable_audit_event` (ledger): sus payloads `before/after` reflejan filas enteras con PII
  embebida → no confiable de limpiar. No se incluye.

## Regenerar
```
python sql/seed/anonymize_snapshot.py   # lee backup/pre_seed_*/ -> escribe aqui
```
Los emails masked usan dominio `@example.com`; los nombres, `Persona <hash>`. El mapeo es
determinista (mismo valor original → mismo valor anónimo).
