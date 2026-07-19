-- 0126_incident_recurrence_review.sql
-- Gobierno de edicion del flag de reincidencia: solo el reportante o la Gerencia de Operaciones
-- pueden cambiarlo. Cuando lo cambia la Gerencia (no el reportante) DEBE documentar el motivo,
-- que queda como evidencia para discusiones posteriores (ademas del ledger via audit_row_change).
-- Idempotente.

alter table incident
  add column if not exists recurrence_review_note   text,
  add column if not exists recurrence_reviewed_by    uuid references user_account(id),
  add column if not exists recurrence_reviewed_at     timestamptz;

comment on column incident.recurrence_review_note is 'Justificacion documentada al cambiar el flag de reincidencia (evidencia para gerencia/areas).';
comment on column incident.recurrence_reviewed_by is 'Quien reviso/cambio el flag de reincidencia.';
comment on column incident.recurrence_reviewed_at is 'Cuando se reviso/cambio el flag de reincidencia.';
