-- 0077_business_areas_seed.sql
-- Definicion de AREAS DE NEGOCIO (dominios operativos) y enlace de la jerarquia
-- area -> proceso -> sistema -> squad, con datos maestros REALES ya existentes.
--
-- Contexto (verificado contra el esquema real, cero invencion):
--  - business_unit ya tenia 7 filas (lineas de producto). Se AGREGAN los dominios
--    operativos del mapa consolidado que faltaban; se REUSAN Cobranza y Pagos (sin duplicar).
--  - process (64) no tenia business_unit_id; se enlaza cada proceso claro a su area.
--  - process_system estaba VACIO (0 filas); se siembra procesos<->sistemas (CIs reales).
--  - squad (5) se reasocia a su area operativa.
--
-- Idempotente:
--  - business_unit: ON CONFLICT (tenant_id, code) DO NOTHING  [uq_bu_code]
--  - process.business_unit_id: solo se setea cuando esta NULL (no pisa asignaciones manuales)
--  - process_system: ON CONFLICT (process_id, ci_id) DO NOTHING  [uq_process_system]
--  - squad.business_unit_id: set determinista por codigo
--
-- Auditoria: todas estas tablas tienen trigger trg_audit_* -> immutable_audit_event (audit-grade).
-- RLS: tenant_id explicito en cada insert. Tenant resuelto desde los datos existentes.

do $$
declare
  v_tenant uuid;
begin
  -- Tenant objetivo = el que posee el catalogo de procesos/sistemas (unico con datos).
  select tenant_id into v_tenant
  from public.configuration_item
  group by tenant_id
  order by count(*) desc
  limit 1;

  if v_tenant is null then
    raise notice '0077: sin tenant con configuration_item; nada que sembrar.';
    return;
  end if;

  -- 1) AREAS DE NEGOCIO (dominios operativos). Reusa COBRANZA/PAGOS existentes.
  insert into public.business_unit (tenant_id, code, name, status, metadata)
  select v_tenant, x.code, x.name, 'active',
         jsonb_build_object('kind','operational_domain','source','mapa_consolidado')
  from (values
    ('CANALES',        'Canales y Experiencia de Cliente'),
    ('CONTACT_CENTER', 'Contact Center y Televenta'),
    ('CREDITO',        'Credito, Originacion y Onboarding'),
    ('CORE_BACKOFFICE','Core, Cuenta Corriente y Backoffice'),
    ('COMERCIOS',      'Comercios Afiliados y Adquirencia'),
    ('GROWTH',         'Gestion Comercial, Productos y Growth'),
    ('FINANZAS',       'Finanzas, Tesoreria y Contabilidad'),
    ('RIESGO',         'Riesgo, Cumplimiento y Fraude'),
    ('DATOS',          'Datos, BI, Analitica e IA'),
    ('TECNOLOGIA',     'Tecnologia, Plataformas e Integracion'),
    ('PERSONAS',       'Gestion de Personas'),
    ('CONTRALORIA',    'Contraloria, Auditoria y Control Interno')
  ) x(code, name)
  on conflict (tenant_id, code) do nothing;

  -- 2) PROCESO -> AREA (solo procesos con mapeo claro; los ambiguos quedan sin area).
  with pm(pcode, acode) as (values
    ('ORIGINACION','CREDITO'),
    ('RECEPCION_DE_LA_SOLICITUD','CREDITO'),
    ('REGISTRO_DE_LA_SOLICITUD','CREDITO'),
    ('TOMA_DE_DATOS','CREDITO'),
    ('ACTIVACION','CREDITO'),
    ('FORMALIZACION','CREDITO'),
    ('ENTREGA','CREDITO'),
    ('CAPTACION_E_INTEGRACION','CREDITO'),
    ('SCORE','RIESGO'),
    ('RIESGO','RIESGO'),
    ('CUMPLIMIENTO','RIESGO'),
    ('SEGURIDAD_DE_LA_INFORMACION','RIESGO'),
    ('GESTION_DE_PAGOS','PAGOS'),
    ('LIQUIDACION_LOCAL','PAGOS'),
    ('LIQUIDACION_VISA','PAGOS'),
    ('DISPUTAS','PAGOS'),
    ('TRASIEGO','CORE_BACKOFFICE'),
    ('GESTION_DE_CUENTAS','CORE_BACKOFFICE'),
    ('CIERRE_DE_CUENTAS','CORE_BACKOFFICE'),
    ('COBRANZA','COBRANZA'),
    ('ANALISIS_DE_CARTERA','COBRANZA'),
    ('COBRO_JUDICIAL','COBRANZA'),
    ('AFILIACION_DE_COMERCIO','COMERCIOS'),
    ('ATENCION_AL_COMERCIO','COMERCIOS'),
    ('GESTION_DE_COMERCIO','COMERCIOS'),
    ('PROSPECTACION_Y_AFILIACION','COMERCIOS'),
    ('ATENCION_AL_CLIENTE','CONTACT_CENTER'),
    ('RESOLUCION_DE_TICKETS','CONTACT_CENTER'),
    ('RETENCION_Y_DESVINCULACION','CANALES'),
    ('MERCADEO','GROWTH'),
    ('INVESTIGACION_Y_SEGMENTACION_DE_MERCADO','GROWTH'),
    ('ESTRATEGIA_DE_PROMOCION_Y_MEDICION','GROWTH'),
    ('ESTRATEGIA_DE_PRECIOS','GROWTH'),
    ('VENTA_DE_PRODUCTOS','GROWTH'),
    ('ADQUISICION_DE_CLIENTES','GROWTH'),
    ('INNOVACION','GROWTH'),
    ('INNOVACION_Y_DESARROLLO_DE_PRODUCTOS_Y_SERVICIOS','GROWTH'),
    ('FINANZAS','FINANZAS'),
    ('CONTABILIDAD_GENERAL','FINANZAS'),
    ('GESTION_FISCAL','FINANZAS'),
    ('CASH_MANAGEMENT','FINANZAS'),
    ('ADMINISTRACION_DE_ACTIVOS_FIJOS','FINANZAS'),
    ('GESTION_DE_DEUDA_Y_ESTRATEGIAS_DE_FINANCIAMIENTO','FINANZAS'),
    ('GESTION_DE_INVERSIONES_Y_ESTRATEGIAS_DE_COBERTURA_FINANCIERA','FINANZAS'),
    ('GESTION_DE_RIESGO_CAMBIARIO_Y_FINANCIERO','FINANZAS'),
    ('TI','TECNOLOGIA'),
    ('ARQUITECTURA_DE_TI','TECNOLOGIA'),
    ('DESARROLLO','TECNOLOGIA'),
    ('SISTEMAS_DE_INFORMACION_DESARROLLO','TECNOLOGIA'),
    ('ADMINISTRACION_DE_LA_INFRAESTRUCTURA','TECNOLOGIA'),
    ('ADMINISTRACION_DE_LAS_BASES_DE_DATOS','TECNOLOGIA'),
    ('ADMINISTRACION_DE_PROYECTOS','TECNOLOGIA'),
    ('GESTION_DEL_TALENTO','PERSONAS'),
    ('COMPENSACION_Y_BENEFICIOS','PERSONAS'),
    ('PROVISION_DE_EQUIPOS_MATERIALES_Y_CAPACITACION','PERSONAS'),
    ('SEGURIDAD_E_HIGIENE_OCUPACIONAL','PERSONAS'),
    ('CONTRALORIA_INTERNA','CONTRALORIA'),
    ('AUDITORIA_INTERNA','CONTRALORIA'),
    ('CONTROL_INTERNO','CONTRALORIA'),
    ('ADMINISTRACION_DE_PROCESOS','CONTRALORIA')
  )
  update public.process p
     set business_unit_id = b.id, updated_at = now()
  from pm
  join public.business_unit b on b.tenant_id = v_tenant and b.code = pm.acode
  where p.tenant_id = v_tenant and p.code = pm.pcode and p.business_unit_id is null;

  -- 3) SQUAD -> AREA operativa (determinista por codigo).
  with sm(scode, acode) as (values
    ('SQUAD_COBRANZA','COBRANZA'),
    ('SQUAD_CONCILIACION','FINANZAS'),
    ('SQUAD_DATOS','DATOS'),
    ('SQUAD_ONBOARDING','CREDITO'),
    ('SQUAD_PAGOS','PAGOS')
  )
  update public.squad s
     set business_unit_id = b.id, updated_at = now()
  from sm
  join public.business_unit b on b.tenant_id = v_tenant and b.code = sm.acode
  where s.tenant_id = v_tenant and s.code = sm.scode;

  -- 4) PROCESS_SYSTEM: procesos <-> sistemas (CIs reales). Estructura antes vacia.
  insert into public.process_system (tenant_id, process_id, ci_id, role, criticality)
  select v_tenant, p.id, c.id, l.role, l.crit::impact_level
  from (values
    -- Originacion / Credito
    ('RECEPCION_DE_LA_SOLICITUD','MICREDIX_APP','primary','high'),
    ('RECEPCION_DE_LA_SOLICITUD','MICREDIX_WEB','primary','high'),
    ('RECEPCION_DE_LA_SOLICITUD','CREDIXWEB','secondary','medium'),
    ('RECEPCION_DE_LA_SOLICITUD','WHATSAPP_SMS_NOTIFICACIONES','integration','medium'),
    ('REGISTRO_DE_LA_SOLICITUD','SAC_APP','primary','high'),
    ('REGISTRO_DE_LA_SOLICITUD','CREDIXWEB','secondary','medium'),
    ('TOMA_DE_DATOS','ID_CHECK','primary','high'),
    ('TOMA_DE_DATOS','METAMAP','primary','high'),
    ('TOMA_DE_DATOS','SISTEMA_BIOMETRICO_DE_ACCESO','secondary','medium'),
    ('TOMA_DE_DATOS','CREDID_CREDISERVER_BUROS','integration','high'),
    ('SCORE','CALIFICADOR','primary','critical'),
    ('SCORE','CREDID_CREDISERVER_BUROS','integration','high'),
    ('ACTIVACION','SAC_APP','primary','high'),
    ('ACTIVACION','PRISMA','secondary','high'),
    ('FORMALIZACION','SAC_APP','primary','high'),
    ('FORMALIZACION','LASERFICHE','secondary','medium'),
    ('FORMALIZACION','FACTURA_ELECTRONICA_GTI','integration','medium'),
    ('ENTREGA','SAC_APP','primary','medium'),
    -- Tarjetas / Pagos / Procesador
    ('GESTION_DE_PAGOS','PRISMA','primary','critical'),
    ('GESTION_DE_PAGOS','PASARELA_DE_PAGO','primary','critical'),
    ('GESTION_DE_PAGOS','CGP','integration','high'),
    ('GESTION_DE_PAGOS','BANCO_NACIONAL_CONECTIVIDAD','integration','high'),
    ('GESTION_DE_PAGOS','CREDIXPAY','secondary','high'),
    ('LIQUIDACION_LOCAL','PRISMA','primary','high'),
    ('LIQUIDACION_LOCAL','VPART_PRISMANET','secondary','high'),
    ('LIQUIDACION_LOCAL','CGP','integration','high'),
    ('LIQUIDACION_VISA','PRISMA','primary','high'),
    ('LIQUIDACION_VISA','VPART_PRISMANET','secondary','high'),
    ('DISPUTAS','PRISMA','primary','high'),
    ('DISPUTAS','SAC_APP','secondary','medium'),
    ('DISPUTAS','VPART_PRISMANET','integration','medium'),
    -- Core / Backoffice
    ('TRASIEGO','TRASCIEGO','primary','high'),
    ('TRASIEGO','SAC_APP','secondary','medium'),
    ('GESTION_DE_CUENTAS','SAC_APP','primary','high'),
    ('GESTION_DE_CUENTAS','AUTOCARTERA','secondary','high'),
    ('CIERRE_DE_CUENTAS','SAC_APP','primary','high'),
    -- Cobranza
    ('COBRANZA','RECOVERY_COBROS','primary','high'),
    ('COBRANZA','AUTOCARTERA','secondary','high'),
    ('ANALISIS_DE_CARTERA','AUTOCARTERA','primary','high'),
    ('ANALISIS_DE_CARTERA','POWER_BI','secondary','medium'),
    ('ANALISIS_DE_CARTERA','DATAWAREHOUSE_CUBOS','integration','medium'),
    ('COBRO_JUDICIAL','RECOVERY_COBROS','primary','high'),
    ('COBRO_JUDICIAL','LASERFICHE','secondary','medium'),
    -- Comercios / Adquirencia
    ('AFILIACION_DE_COMERCIO','MICOMERCIO','primary','high'),
    ('AFILIACION_DE_COMERCIO','CREDIXLINK','secondary','medium'),
    ('ATENCION_AL_COMERCIO','MICOMERCIO','primary','high'),
    ('ATENCION_AL_COMERCIO','INFOBIP','integration','medium'),
    ('GESTION_DE_COMERCIO','MICOMERCIO','primary','high'),
    ('GESTION_DE_COMERCIO','SMARTPOS','secondary','high'),
    ('GESTION_DE_COMERCIO','VPOS','secondary','high'),
    ('PROSPECTACION_Y_AFILIACION','MICOMERCIO','primary','medium'),
    ('PROSPECTACION_Y_AFILIACION','CREDIXLINK','secondary','medium'),
    -- Contact Center / Atencion
    ('ATENCION_AL_CLIENTE','SAC_APP','primary','high'),
    ('ATENCION_AL_CLIENTE','INCONCERT','primary','high'),
    ('ATENCION_AL_CLIENTE','INFOBIP','primary','high'),
    ('ATENCION_AL_CLIENTE','WHATSAPP_SMS_NOTIFICACIONES','secondary','medium'),
    ('ATENCION_AL_CLIENTE','GLPI_MESA_DE_AYUDA','secondary','medium'),
    ('RESOLUCION_DE_TICKETS','GLPI_MESA_DE_AYUDA','primary','high'),
    ('RESOLUCION_DE_TICKETS','OS_TICKET','secondary','medium'),
    ('RESOLUCION_DE_TICKETS','SAC_APP','integration','medium'),
    -- Growth / Comercial
    ('VENTA_DE_PRODUCTOS','MICREDIX_APP','primary','medium'),
    ('VENTA_DE_PRODUCTOS','INCONCERT','secondary','medium'),
    ('ADQUISICION_DE_CLIENTES','MICREDIX_APP','primary','medium'),
    ('ADQUISICION_DE_CLIENTES','INFOBIP','secondary','medium'),
    ('MERCADEO','INFOBIP','secondary','medium'),
    ('MERCADEO','POWER_BI','secondary','medium'),
    ('INVESTIGACION_Y_SEGMENTACION_DE_MERCADO','POWER_BI','primary','medium'),
    ('INVESTIGACION_Y_SEGMENTACION_DE_MERCADO','DATAWAREHOUSE_CUBOS','secondary','medium'),
    ('INVESTIGACION_Y_SEGMENTACION_DE_MERCADO','SPSS','integration','medium'),
    ('ESTRATEGIA_DE_PROMOCION_Y_MEDICION','POWER_BI','secondary','medium'),
    ('ESTRATEGIA_DE_PROMOCION_Y_MEDICION','INFOBIP','secondary','medium'),
    -- Finanzas / Tesoreria
    ('FINANZAS','EXACTUS','primary','high'),
    ('CONTABILIDAD_GENERAL','EXACTUS','primary','critical'),
    ('CONTABILIDAD_GENERAL','RPA','secondary','medium'),
    ('GESTION_FISCAL','EXACTUS','primary','high'),
    ('GESTION_FISCAL','FACTURA_ELECTRONICA_GTI','secondary','high'),
    ('CASH_MANAGEMENT','EXACTUS','primary','high'),
    ('CASH_MANAGEMENT','BANCO_NACIONAL_CONECTIVIDAD','integration','medium'),
    ('ADMINISTRACION_DE_ACTIVOS_FIJOS','EXACTUS','primary','medium'),
    ('GESTION_DE_DEUDA_Y_ESTRATEGIAS_DE_FINANCIAMIENTO','EXACTUS','primary','medium'),
    ('GESTION_DE_INVERSIONES_Y_ESTRATEGIAS_DE_COBERTURA_FINANCIERA','EXACTUS','primary','medium'),
    ('GESTION_DE_RIESGO_CAMBIARIO_Y_FINANCIERO','EXACTUS','primary','medium'),
    ('GESTION_DE_RIESGO_CAMBIARIO_Y_FINANCIERO','POWER_BI','secondary','medium'),
    -- Riesgo / Cumplimiento / Fraude
    ('RIESGO','SENTINEL','primary','high'),
    ('RIESGO','CALIFICADOR','secondary','high'),
    ('CUMPLIMIENTO','SENTINEL','primary','high'),
    ('CUMPLIMIENTO','SICVECA','secondary','high'),
    ('SEGURIDAD_DE_LA_INFORMACION','SIEM','primary','high'),
    ('SEGURIDAD_DE_LA_INFORMACION','ESET','secondary','high'),
    ('SEGURIDAD_DE_LA_INFORMACION','ACTIVE_DIRECTORY_DNS_DHCP','integration','medium'),
    -- Contraloria / Auditoria
    ('CONTRALORIA_INTERNA','POWER_BI','primary','medium'),
    ('CONTRALORIA_INTERNA','EXACTUS','secondary','medium'),
    ('AUDITORIA_INTERNA','POWER_BI','primary','medium'),
    ('AUDITORIA_INTERNA','LASERFICHE','secondary','medium'),
    ('CONTROL_INTERNO','SENTINEL','secondary','medium'),
    ('CONTROL_INTERNO','POWER_BI','secondary','medium'),
    -- Tecnologia / Plataformas
    ('TI','AWS_RDS_LAMBDA_VPC_SECURITY_GROUPS','primary','high'),
    ('TI','GLPI_MESA_DE_AYUDA','secondary','medium'),
    ('ADMINISTRACION_DE_LA_INFRAESTRUCTURA','AWS_RDS_LAMBDA_VPC_SECURITY_GROUPS','primary','high'),
    ('ADMINISTRACION_DE_LA_INFRAESTRUCTURA','ACTIVE_DIRECTORY_DNS_DHCP','secondary','high'),
    ('ADMINISTRACION_DE_LAS_BASES_DE_DATOS','SSMS_MYSQL_WORKBENCH_SQL_AGENT','primary','high'),
    ('ADMINISTRACION_DE_LAS_BASES_DE_DATOS','AWS_RDS_LAMBDA_VPC_SECURITY_GROUPS','secondary','high'),
    ('ARQUITECTURA_DE_TI','AWS_RDS_LAMBDA_VPC_SECURITY_GROUPS','secondary','medium'),
    ('DESARROLLO','ASANA','secondary','medium'),
    ('DESARROLLO','SSMS_MYSQL_WORKBENCH_SQL_AGENT','secondary','medium'),
    ('SISTEMAS_DE_INFORMACION_DESARROLLO','ASANA','secondary','medium'),
    ('ADMINISTRACION_DE_PROYECTOS','ASANA','primary','medium'),
    ('ADMINISTRACION_DE_PROYECTOS','MS_PROJECT_PROJECT','secondary','medium'),
    -- Personas
    ('GESTION_DEL_TALENTO','SISTEMA_CAPITAL_HUMANO_SOFTLAND','primary','high'),
    ('GESTION_DEL_TALENTO','EXACTUS','secondary','medium'),
    ('COMPENSACION_Y_BENEFICIOS','SISTEMA_CAPITAL_HUMANO_SOFTLAND','primary','high'),
    ('COMPENSACION_Y_BENEFICIOS','EXACTUS','secondary','medium'),
    ('PROVISION_DE_EQUIPOS_MATERIALES_Y_CAPACITACION','SISTEMA_CAPITAL_HUMANO_SOFTLAND','secondary','medium'),
    ('SEGURIDAD_E_HIGIENE_OCUPACIONAL','SISTEMA_CAPITAL_HUMANO_SOFTLAND','secondary','low')
  ) l(pcode, cicode, role, crit)
  join public.process p on p.tenant_id = v_tenant and p.code = l.pcode
  join public.configuration_item c on c.tenant_id = v_tenant and c.code = l.cicode
  on conflict (process_id, ci_id) do nothing;

  raise notice '0077: seed de areas de negocio aplicado para tenant %', v_tenant;
end $$;
