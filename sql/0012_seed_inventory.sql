-- ============================================================================
-- Credix Nexus — 0012 — Seed del inventario real (idempotente)
-- Roles/permisos + Unidades de Negocio + Macroprocesos/Procesos + Productos +
-- Servicios + Aplicaciones (CI) + Sistemas (CI) + Canales de comunicacion.
-- Nodos cargados; enlaces jerarquicos (proceso->macro/unidad, app->servicio) se
-- vinculan luego con la matriz estructurada (Ficha de Proceso). Codigos via slug_code.
-- ============================================================================

-- =============================== Roles globales + permisos =====================
insert into public.role (tenant_id, code, name, description, is_system)
select null, v.code, v.name, v.descr, true from (values
  ('system_admin','Administrador del sistema','Admin tecnico global'),
  ('tenant_admin','Administrador de tenant','Admin por tenant'),
  ('support_agent','Agente de soporte','Gestion de incidentes'),
  ('support_lead','Lider de soporte','Escalamiento, cierre, RCA'),
  ('product_owner','Product Owner','Priorizacion y proyectos'),
  ('business_owner','Business Owner','Decisiones de negocio'),
  ('change_manager','Change Manager','Cambios y releases'),
  ('grc_officer','GRC Officer','Riesgo, cumplimiento, controles'),
  ('auditor','Auditor','Solo lectura + exportaciones'),
  ('partner_user','Usuario partner','Portal externo restringido'),
  ('partner_admin','Admin partner','Usuarios del partner'),
  ('ai_agent','Agente IA','Identidad tecnica de agente')
) as v(code,name,descr) on conflict do nothing;

insert into public.permission (code, resource, action, description)
select v.code, v.res, v.act, v.descr from (values
  ('incident.read','incident','read','Ver incidentes'),
  ('incident.create','incident','create','Crear incidentes'),
  ('incident.update','incident','update','Actualizar incidentes'),
  ('incident.assign','incident','assign','Asignar incidentes'),
  ('incident.resolve','incident','resolve','Resolver/cerrar incidentes'),
  ('problem.manage','problem','manage','Gestionar problemas'),
  ('change.manage','change','manage','Gestionar cambios'),
  ('change.approve','change','approve','Aprobar cambios'),
  ('project.read','project','read','Ver proyectos'),
  ('project.manage','project','manage','Gestionar proyectos'),
  ('rule.read','rule','read','Ver reglas'),
  ('rule.manage','rule','manage','Editar reglas'),
  ('rule.approve','rule','approve','Aprobar/publicar reglas'),
  ('audit.read','audit','read','Consultar ledger'),
  ('audit.export','audit','export','Exportar evidencia'),
  ('cmdb.read','cmdb','read','Ver CMDB'),
  ('cmdb.manage','cmdb','manage','Gestionar CMDB'),
  ('knowledge.read','knowledge','read','Ver conocimiento'),
  ('knowledge.manage','knowledge','manage','Gestionar conocimiento'),
  ('tenant.manage','tenant','manage','Administrar tenants'),
  ('user.manage','user','manage','Administrar usuarios'),
  ('grc.manage','grc','manage','Gestionar GRC'),
  ('agent.execute','agent','execute','Ejecutar acciones de agente IA')
) as v(code,res,act,descr) on conflict (code) do nothing;

insert into public.role_permission (role_id, permission_id)
select r.id, p.id from (values
  ('support_agent','incident.read'),('support_agent','incident.create'),
  ('support_agent','incident.update'),('support_agent','incident.assign'),
  ('support_agent','cmdb.read'),('support_agent','knowledge.read'),
  ('support_lead','incident.read'),('support_lead','incident.resolve'),
  ('support_lead','problem.manage'),('support_lead','knowledge.manage'),
  ('product_owner','project.read'),('product_owner','project.manage'),('product_owner','rule.read'),
  ('change_manager','change.manage'),('change_manager','change.approve'),
  ('grc_officer','grc.manage'),('grc_officer','rule.approve'),('grc_officer','audit.read'),
  ('auditor','audit.read'),('auditor','audit.export'),('auditor','incident.read'),
  ('tenant_admin','user.manage'),('tenant_admin','cmdb.manage'),('tenant_admin','tenant.manage'),
  ('ai_agent','agent.execute'),('ai_agent','incident.read'),('ai_agent','knowledge.read')
) as m(rc,pc)
join public.role r on r.code = m.rc and r.tenant_id is null
join public.permission p on p.code = m.pc on conflict do nothing;

-- =============================== Unidades de Negocio ===========================
insert into public.business_unit (tenant_id, code, name)
select t.id, public.slug_code(n), n
from public.tenant t, unnest(array[
  'Seguros','Prestamos','Cobranza','Medios de pago','Pagos','Casa de cambio','CDC'
]) as n where t.code='CORE' on conflict (tenant_id, code) do nothing;

-- =============================== Macroprocesos =================================
insert into public.process (tenant_id, code, name, process_level)
select t.id, public.slug_code(n), n, 'macro'
from public.tenant t, unnest(array[
  'Planificacion','Innovacion','Mercadeo','Originacion','Cobranza','Atencion al cliente',
  'Afiliacion de comercio','Gestion de comercio','Gestion del talento','Finanzas','TI',
  'Contraloria Interna'
]) as n where t.code='CORE' on conflict (tenant_id, code) do nothing;

-- =============================== Procesos =====================================
insert into public.process (tenant_id, code, name, process_level)
select t.id, public.slug_code(n), n, 'process'
from public.tenant t, unnest(array[
  'Planificacion Estrategica','Planificacion Operativa',
  'Innovacion y desarrollo de productos y servicios','Estrategia de promocion y medicion',
  'Investigacion y Segmentacion de Mercado','Estrategia de Precios','Adquisicion de clientes',
  'Score','Toma de datos','Formalizacion','Entrega','Activacion','Trasiego',
  'Recepcion de la solicitud','Registro de la Solicitud','Disputas','Venta de productos',
  'Resolucion de Tickets','Prospectacion y afiliacion',
  'Provision de equipos, materiales y capacitacion','Diseno de estrategia','Atencion al comercio',
  'Liquidacion Visa','Liquidacion Local','Analisis de Cartera','Cierre de Cuentas','Cobro Judicial',
  'Gestion de Cuentas','Desarrollo','Compensacion y beneficios','Captacion e integracion',
  'Seguridad e Higiene ocupacional','Retencion y desvinculacion','Contabilidad General',
  'Gestion de Inversiones y Estrategias de Cobertura Financiera','Gestion de Pagos',
  'Gestion de deuda y estrategias de financiamiento','Cash Management',
  'Gestion de Riesgo Cambiario y Financiero','Administracion de Activos Fijos','Gestion Fiscal',
  'Control interno','Administracion de Procesos','Administracion de la Infraestructura',
  'Seguridad de la Informacion','Administracion de Proyectos','Arquitectura de TI',
  'Administracion de las Bases de Datos','Sistemas de Informacion (Desarrollo)',
  'Auditoria Interna','Cumplimiento','Riesgo'
]) as n where t.code='CORE' on conflict (tenant_id, code) do nothing;

-- =============================== Productos financieros ========================
insert into public.product (tenant_id, code, name)
select t.id, public.slug_code(n), n
from public.tenant t, unnest(array[
  'Tarjeta Segura 360','Saldo Deudor','Multiasistencia Salud Plus Familiar',
  'Multiasistencia Salud Plus Individual','Multiasistencia Plus','Asistencia Marchamito',
  'Credito Personal','Plan Liquidez','Plan Solidario','Plan Apoyo','Arreglos de pago',
  'Pago de Servicios','Marchamo','QuickPass','Cancelacion Anticipada','Servicio al cliente',
  'Compra sin tarjeta','Tarjeta adicional','Ampliar Plazo','Cuotas Cero Interes','Cuoticas',
  'Tarjeta de Credito','Tarjeta de Credito - Co-Deudor','Tarjeta de Credito - Limite Bajo',
  'P2P','Remesas','Transferencias internacionales','Personas','Corporativo','Factoring',
  'Cambio','Tesoreria corporativa'
]) as n where t.code='CORE' on conflict (tenant_id, code) do nothing;

-- =============================== Servicios (catalogo ITSM) ====================
insert into public.service (tenant_id, code, name, service_type, business_domain, criticality)
select t.id, v.code, v.name, v.stype, v.domain, v.crit::impact_level
from public.tenant t join (values
  ('ORIGINACION','Originacion de credito','business','credito','critical'),
  ('SCORING','Scoring y decisioning','business','riesgo','critical'),
  ('CUENTA_CORRIENTE','Cuenta corriente','business','core_financiero','critical'),
  ('PAGOS','Pagos','business','pagos','critical'),
  ('CONCILIACION','Conciliacion','business','conciliacion','high'),
  ('COBRANZA','Cobranza','business','cobranza','high'),
  ('MARKETPLACE','Marketplace','business','marketplace','high'),
  ('ONBOARDING','Onboarding de partners','business','onboarding','high'),
  ('ANALITICA','Analitica y datos','technical','datos','medium')
) as v(code,name,stype,domain,crit) on true
where t.code='CORE' on conflict (tenant_id, code) do nothing;

-- =============================== Aplicaciones (CI application) =================
insert into public.configuration_item (tenant_id, code, name, ci_type, criticality, data_classification)
select t.id, public.slug_code(n), n, 'application', 'high', 'confidential'
from public.tenant t, unnest(array[
  'MiCredix App','MiCredix Web','Codigo MiCredix','Credix.com','Flipcr.com','CDC.com',
  'Flip App','Flip Admin','MiComercio','SmartPOS','CredixPay','CredixLink','VPOS','SAC App',
  'Autocartera','Calificador','Marchamos','Credix Admin','CredixWeb'
]) as n where t.code='CORE' on conflict (tenant_id, code) do nothing;

-- =============================== Sistemas (CI system) =========================
insert into public.configuration_item (tenant_id, code, name, ci_type, criticality, data_classification)
select t.id, public.slug_code(n), n, 'system', 'medium', 'internal'
from public.tenant t, unnest(array[
  'Active Directory / DNS / DHCP','Asana','Autentika','AWS RDS / Lambda / VPC / Security Groups',
  'DataWarehouse / Cubos','ESET','GLPI / Mesa de Ayuda','Gmail / Correo','Google Calendar',
  'Google Chat','Google Drive / Unidades Compartidas','Google Forms / Apps Script / Link',
  'SSMS / MySQL Workbench / SQL Agent','ID Check','Microsoft 365 / Google Workspace Admin',
  'MS Project / Project','OS Ticket','Power BI','Prisma','Proveedores / Portales externos','R',
  'RPA','SICVECA','SIEM','Sistema biometrico de acceso','Sistema Capital Humano (Softland)','SPSS',
  'Tableau Server','TSE','VID','Viprint / Vprint','VPart / Prismanet','VSPS',
  'WhatsApp / SMS / Notificaciones','Word / PowerPoint','CGP','Banco Nacional Conectividad',
  'CardWizard','Credid / CrediServer / Buros','Exactus','Factura Electronica (GTI)','inConcert',
  'Infobip','LaserFiche','Metamap','Pasarela de Pago','Recovery (Cobros)','Sentinel','Trasciego'
]) as n where t.code='CORE' on conflict (tenant_id, code) do nothing;

-- =============================== Canales de comunicacion ======================
insert into public.channel (tenant_id, code, name, channel_type)
select t.id, public.slug_code(v.name), v.name, v.ctype
from public.tenant t join (values
  ('Llamada','phone'),('WhatsApp','whatsapp'),('Correo','email'),
  ('Facebook Messenger','social'),('LiveChat web','chat'),('Kiosko Autoconsultas','kiosk'),
  ('Gestor','assisted'),('SMS','sms')
) as v(name,ctype) on true
where t.code='CORE' on conflict (tenant_id, code) do nothing;
