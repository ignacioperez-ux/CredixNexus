-- ============================================================================
-- Credix Nexus — 0015 — Seed de incidentes demo (idempotente)
-- Incidentes que giran alrededor de aplicaciones reales. Guardado: solo si el
-- tenant CORE no tiene incidentes aun (evita duplicados por numeracion automatica).
-- ============================================================================

insert into public.incident (
  tenant_id, title, description, category, subcategory,
  affected_ci_id, affected_service_id,
  impact, urgency, priority,
  financial_impact_estimate, affected_transaction_count, partner_impact,
  data_quality_suspected, transformation_score, transformation_candidate, status
)
select t.id, v.title, v.descr, v.category, v.subcat,
       ci.id, s.id,
       v.impact::impact_level, v.urgency::urgency_level,
       public.derive_priority(v.impact::impact_level, v.urgency::urgency_level),
       v.financial, v.txn, v.partner, v.dq, v.score, v.score >= 70, v.status::incident_status
from public.tenant t
join (values
  ('Error recurrente de conciliacion Prisma-SAC','Diferencias repetidas en la conciliacion diaria entre Prisma y SAC. 12 incidentes en 30 dias.',
   'reconciliation','prisma','PRISMA','CONCILIACION','high','high', 1500000.00, 320, true, true, 87.0, 'triaged'),
  ('Originador no puede completar onboarding en MiCredix','El flujo de alta de originador falla al cargar documentos en MiCredix App.',
   'onboarding','originador','MICREDIX_APP','ONBOARDING','medium','high', 0.00, 0, true, false, 72.0, 'new'),
  ('Timeout intermitente en pagos VPOS','Transacciones VPOS con timeout intermitente en horas pico afectando comercios.',
   'payments','vpos','VPOS','PAGOS','high','critical', 800000.00, 145, true, false, 65.0, 'in_progress'),
  ('Restablecimiento de contrasena de usuario interno','Solicitud de reseteo de contrasena de un colaborador.',
   'access','password', null, null,'low','low', 0.00, 0, false, false, 8.0, 'resolved')
) as v(title,descr,category,subcat,ci_code,svc_code,impact,urgency,financial,txn,partner,dq,score,status) on true
left join public.configuration_item ci on ci.tenant_id = t.id and ci.code = v.ci_code
left join public.service s on s.tenant_id = t.id and s.code = v.svc_code
where t.code = 'CORE'
  and not exists (select 1 from public.incident i2 where i2.tenant_id = t.id);
