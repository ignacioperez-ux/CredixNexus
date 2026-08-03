-- ============================================================================
-- Credix Nexus — 0139 — Estado de incidente "received" ("Recibido") [Operaciones Fase C]
-- ----------------------------------------------------------------------------
-- Admision sin asignacion: cuando el Gerente de Operaciones presiona "Aceptar" sin elegir
-- responsable, el caso queda en estado 'received' ("Recibido") y sin asignar (assigned_user_id
-- NULL -> "Sin asignar" en el listado). Nuevo valor del enum incident_status, ubicado despues
-- de 'new' y antes de 'triaged' (que se conserva para casos historicos). Idempotente.
-- El camino "Aceptar sin asignar" lo produce lib/triage/actions.ts (status='received').
-- ============================================================================

alter type public.incident_status add value if not exists 'received' before 'triaged';
