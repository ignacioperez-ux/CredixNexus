-- 0125_incident_recurrence.sql
-- Reincidencia: el usuario marca en el alta que el caso corresponde a uno previo cuya correccion
-- no funciono o derivo en otros problemas. Alimenta deteccion de problema/transformacion (#4) y
-- la analitica de efectividad de los ajustes (Gerencia de Operaciones). incident ya tiene RLS +
-- trigger de auditoria. Idempotente.

alter table incident
  add column if not exists is_recurrence boolean not null default false,
  add column if not exists recurrence_of_incident_id uuid references incident(id);

create index if not exists ix_incident_recurrence_of
  on incident(recurrence_of_incident_id) where recurrence_of_incident_id is not null;

comment on column incident.is_recurrence is 'El usuario indico que reincide: caso previo resuelto que reaparecio o derivo en otros problemas.';
comment on column incident.recurrence_of_incident_id is 'Caso previo (opcional) al que reincide, para trazar efectividad del fix.';
