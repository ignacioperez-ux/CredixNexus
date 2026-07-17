-- FASE 3 · Grupo B — maestros de dominio (tenant CREDIX = c5d2f057-...)
-- incident_category(16, related_skill+priority) + vendor(25) + service(12) + product(32) + process(64)
-- FKs resueltas por code. Transaccion atomica con verificacion.
do $$
declare T uuid := 'c5d2f057-6262-4275-8ba9-16d9617ce128';
begin
insert into incident_category (tenant_id, code, name, name_en, related_skill_id, default_priority, requires_rca)
select T, v.code, v.name, v.name_en, (select id from skill s where s.code=v.skl and s.tenant_id=T), v.prio::priority_level, v.rca
from (values
 ('PAYMENTS','Pagos','Payments','PAGOS','p2_high',false),
 ('API_FAILURE','Falla de API / procesador','API / Processor Failure','INTEGRACIONES_API','p1_critical',true),
 ('DUPLICATE_CHARGE','Duplicidad de cobro','Duplicate Charge','CONCILIACION','p3_medium',false),
 ('UNRECOGNIZED_CHARGE','Cargo no reconocido','Unrecognized Charge','CICLO_TARJETA','p3_medium',false),
 ('PAYMENT_NOT_APPLIED','Pago no aplicado','Payment Not Applied','PAGOS','p3_medium',false),
 ('FRAUD_SUSPICION','Sospecha de fraude','Fraud Suspicion','SEGURIDAD','p2_high',true),
 ('DISPUTE','Disputa','Dispute','CONCILIACION','p3_medium',false),
 ('RECONCILIATION','Conciliacion / Datos','Reconciliation','CONCILIACION','p3_medium',false),
 ('ONBOARDING','Onboarding / Originacion','Onboarding','ONBOARDING','p3_medium',false),
 ('ACCESS','Acceso / Identidad','Access / Identity','SEGURIDAD','p3_medium',false),
 ('APPLICATION','Aplicaciones','Applications','BACKEND','p3_medium',false),
 ('INFRASTRUCTURE','Infraestructura','Infrastructure','CONTENEDORES','p2_high',true),
 ('SECURITY','Seguridad','Security','SEGURIDAD','p1_critical',true),
 ('DATA_QUALITY','Calidad de Datos','Data Quality','DATOS','p3_medium',false),
 ('CUSTOMER_COMPLAINT','Reclamo de cliente','Customer Complaint','SOPORTE','p3_medium',false),
 ('OPERATIONAL_RISK','Evento de riesgo operativo','Operational Risk','NORMATIVA_8968_PCI','p2_high',true)
) v(code,name,name_en,skl,prio,rca);

insert into vendor (tenant_id, code, name, category, criticality) values
 (T,'VND-EXACTUS','Exactus','saas','high'),(T,'VND-INCONCERT','inConcert','saas','high'),
 (T,'VND-SENTINEL','Sentinel','security','high'),(T,'VND-METAMAP','MetaMap','data_provider','high'),
 (T,'VND-BUROS','Buros de Credito','data_provider','high'),(T,'VND-TSE','TSE','data_provider','medium'),
 (T,'VND-PRISMA','Prisma','payment_processor','critical'),(T,'VND-VISA','Visa','payment_processor','critical'),
 (T,'VND-BN','Banco Nacional','core_banking','high'),(T,'VND-INFOBIP','Infobip','saas','high'),
 (T,'VND-GRAVITEE','Gravitee','infrastructure','critical'),(T,'VND-POWERBI','Power BI','saas','medium'),
 (T,'VND-TABLEAU','Tableau','saas','medium'),(T,'VND-SOFTLAND','Softland','saas','medium'),
 (T,'VND-GTI','GTI','saas','high'),(T,'VND-SUGEF','SUGEF','other','high'),
 (T,'VND-AUTENTIKA','Autentika','security','medium'),(T,'VND-MICROSOFT','Microsoft','infrastructure','critical'),
 (T,'VND-ESET','ESET','security','high'),(T,'VND-AWS','Amazon Web Services','infrastructure','critical'),
 (T,'VND-GOOGLE','Google Workspace','saas','high'),(T,'VND-LASERFICHE','LaserFiche','saas','low'),
 (T,'VND-ASANA','Asana','saas','low'),(T,'VND-UIPATH','UiPath','saas','medium'),
 (T,'VND-INTELIX','Intelix','consulting','medium');

insert into service (tenant_id, code, name, service_type, business_domain, criticality) values
 (T,'ORIGINACION','Originacion de credito','business','credito','critical'),
 (T,'SCORING','Scoring y decisioning','business','riesgo','critical'),
 (T,'PAGOS','Pagos','business','pagos','critical'),
 (T,'CUENTA_CORRIENTE','Cuenta corriente','business','core_financiero','critical'),
 (T,'COBRANZA','Cobranza','business','cobranza','high'),
 (T,'CONCILIACION','Conciliacion','business','conciliacion','high'),
 (T,'ONBOARDING','Onboarding de partners','business','onboarding','high'),
 (T,'ATENCION_CLIENTE','Atencion al cliente','business','servicio_cliente','high'),
 (T,'AFILIACION_COMERCIOS','Afiliacion de comercios','business','comercios','medium'),
 (T,'CASA_DE_CAMBIO','Casa de cambio','business','fx','high'),
 (T,'ANALITICA','Analitica y datos','technical','datos','medium'),
 (T,'MARKETPLACE','Marketplace','business','marketplace','low');

insert into product (tenant_id, code, name, business_unit_id)
select T, v.code, v.name, (select id from business_unit b where b.code=v.bu and b.tenant_id=T)
from (values
 ('SEG_TS360','Tarjeta Segura 360','SEGUROS'),('SEG_SALDO_DEUDOR','Saldo Deudor','SEGUROS'),
 ('SEG_MULTI_FAM','Multiasistencia Salud Plus Familiar','SEGUROS'),('SEG_MULTI_IND','Multiasistencia Salud Plus Individual','SEGUROS'),
 ('SEG_MULTI_PLUS','Multiasistencia Plus','SEGUROS'),('SEG_MARCHAMITO','Asistencia Marchamito','SEGUROS'),
 ('PRE_CREDITO_PERSONAL','Credito Personal','PRESTAMOS'),('PRE_PLAN_LIQUIDEZ','Plan Liquidez','PRESTAMOS'),
 ('COB_PLAN_SOLIDARIO','Plan Solidario','COBRANZA'),('COB_PLAN_APOYO','Plan Apoyo','COBRANZA'),
 ('COB_ARREGLOS_PAGO','Arreglos de Pago','COBRANZA'),('MDP_PAGO_SERVICIOS','Pago de Servicios','MEDIOS_DE_PAGO'),
 ('MDP_MARCHAMO','Marchamo','MEDIOS_DE_PAGO'),('MDP_QUICKPASS','QuickPass','MEDIOS_DE_PAGO'),
 ('MDP_CANCEL_ANTICIPADA','Cancelacion Anticipada','MEDIOS_DE_PAGO'),('MDP_SERVICIO_CLIENTE','Servicio al Cliente','MEDIOS_DE_PAGO'),
 ('MDP_COMPRA_SIN_TARJETA','Compra sin Tarjeta','MEDIOS_DE_PAGO'),('MDP_TARJETA_ADICIONAL','Tarjeta Adicional','MEDIOS_DE_PAGO'),
 ('MDP_AMPLIAR_PLAZO','Ampliar Plazo','MEDIOS_DE_PAGO'),('MDP_CUOTAS_CERO','Cuotas Cero Interes','MEDIOS_DE_PAGO'),
 ('MDP_CUOTICAS','Cuoticas','MEDIOS_DE_PAGO'),('MDP_TARJETA_CREDITO','Tarjeta de Credito','MEDIOS_DE_PAGO'),
 ('MDP_TC_CODEUDOR','Tarjeta de Credito - Co-Deudor','MEDIOS_DE_PAGO'),('MDP_TC_LIMITE_BAJO','Tarjeta de Credito - Limite Bajo','MEDIOS_DE_PAGO'),
 ('PAG_P2P','P2P','PAGOS'),('PAG_REMESAS','Remesas','PAGOS'),('PAG_TRANSF_INTL','Transferencias Internacionales','PAGOS'),
 ('CDX_PERSONAS','Casa de Cambio - Personas','CASA_DE_CAMBIO'),('CDX_CORPORATIVO','Casa de Cambio - Corporativo','CASA_DE_CAMBIO'),
 ('CDC_FACTORING','Factoring','CDC'),('CDC_CAMBIO','Cambio','CDC'),('CDC_TESORERIA','Tesoreria Corporativa','CDC')
) v(code,name,bu);

insert into process (tenant_id, code, name, process_level, business_unit_id, metadata)
select T, v.code, v.name, v.lvl::process_level,
       (select id from business_unit b where b.code=v.bu and b.tenant_id=T),
       jsonb_build_object('rc', v.rc)
from (values
 ('MAC-01','Planificacion','macro','PLANIFICACION','Lerryns Perez'),
 ('MAC-01.01','Planificacion Estrategica','micro','PLANIFICACION','Lerryns Perez'),
 ('MAC-01.02','Planificacion Operativa','micro','PLANIFICACION','Lerryns Perez'),
 ('MAC-02','Innovacion','macro','MERCADEO','Karol Castillo'),
 ('MAC-02.01','Innovacion y desarrollo de productos y servicios','micro','MERCADEO','Karol Castillo'),
 ('MAC-03','Mercadeo','macro','MERCADEO','Karol Castillo'),
 ('MAC-03.01','Segmentacion e investigacion de mercado','micro','MERCADEO','Tatiana Hernandez'),
 ('MAC-03.02','Estrategia de precios','micro','MERCADEO','Tatiana Hernandez'),
 ('MAC-03.03','Estrategia de promocion y medicion','micro','MERCADEO','Monica Ortiz'),
 ('MAC-04','Originacion','macro','CREDITO','Giselle Arias'),
 ('MAC-04.01','Adquisicion de clientes','micro','CREDITO','Karol Castillo'),
 ('MAC-04.02','Score','micro','CREDITO','Lizeth Rodriguez'),
 ('MAC-04.03','Toma de datos','micro','CREDITO','Elena Pacheco'),
 ('MAC-04.04','Formalizacion','micro','CREDITO','Elena Pacheco'),
 ('MAC-04.05','Entrega','micro','CREDITO','Giselle Arias'),
 ('MAC-04.06','Activacion','micro','CREDITO','Giselle Arias'),
 ('MAC-04.07','Trasiego','micro','CREDITO','Giselle Arias'),
 ('MAC-05','Cobranza','macro','COBRANZA','Oscar Fernandez'),
 ('MAC-05.01','Gestion de cuentas','micro','COBRANZA','Oscar Fernandez'),
 ('MAC-05.02','Cobro judicial','micro','COBRANZA','Oscar Fernandez'),
 ('MAC-05.03','Cierre de cuentas','micro','COBRANZA','Oscar Fernandez'),
 ('MAC-05.04','Analisis de cartera','micro','COBRANZA','Oscar Fernandez'),
 ('MAC-06','Atencion al Cliente','macro','SERVICIO_CLIENTE','Elena Pacheco'),
 ('MAC-06.01','Recepcion de la solicitud','micro','SERVICIO_CLIENTE','Elena Pacheco'),
 ('MAC-06.02','Registro de la solicitud','micro','SERVICIO_CLIENTE','Elena Pacheco'),
 ('MAC-06.03','Resolucion de tickets','micro','SERVICIO_CLIENTE','Giselle Arias'),
 ('MAC-06.04','Disputas','micro','SERVICIO_CLIENTE','Giselle Arias'),
 ('MAC-06.05','Venta de productos','micro','SERVICIO_CLIENTE','Karol Castillo'),
 ('MAC-07','Afiliacion de Comercios','macro','COMERCIOS','Karol Castillo'),
 ('MAC-07.01','Prospectacion y afiliacion','micro','COMERCIOS','Alejandro Ramirez'),
 ('MAC-07.02','Provision de equipos, materiales y capacitacion','micro','COMERCIOS','Alejandro Ramirez'),
 ('MAC-07.03','Diseno de estrategia','micro','COMERCIOS','Alejandro Ramirez'),
 ('MAC-07.04','Atencion al comercio','micro','COMERCIOS','Alejandro Ramirez'),
 ('MAC-08','Gestion del Comercio','macro','COMERCIOS','Giselle Arias'),
 ('MAC-08.01','Liquidacion Local (comercios)','micro','COMERCIOS','Giselle Arias'),
 ('MAC-08.02','Liquidacion VISA','micro','COMERCIOS','Giselle Arias'),
 ('MAC-09','Gestion del Talento','macro','TALENTO','Lizeth Rodriguez'),
 ('MAC-09.01','Captacion e integracion','micro','TALENTO','Lizeth Rodriguez'),
 ('MAC-09.02','Desarrollo','micro','TALENTO','Lizeth Rodriguez'),
 ('MAC-09.03','Compensacion y beneficios','micro','TALENTO','Lizeth Rodriguez'),
 ('MAC-09.04','Retencion y desvinculacion','micro','TALENTO','Lizeth Rodriguez'),
 ('MAC-09.05','Seguridad e higiene ocupacional','micro','TALENTO','Lizeth Rodriguez'),
 ('MAC-10','Finanzas','macro','FINANZAS','Claudia Ordaz'),
 ('MAC-10.01','Cash management (liquidez y flujo de caja)','micro','FINANZAS','Luis Armando Perez'),
 ('MAC-10.02','Gestion de inversiones y coberturas','micro','FINANZAS','Luis Armando Perez'),
 ('MAC-10.03','Gestion de deuda y financiamiento','micro','FINANZAS','Luis Armando Perez'),
 ('MAC-10.04','Gestion de pagos','micro','FINANZAS','Luis Armando Perez'),
 ('MAC-10.05','Gestion de riesgo cambiario y financiero','micro','FINANZAS','Luis Armando Perez'),
 ('MAC-10.06','Contabilidad general','micro','FINANZAS','Jose Saborio'),
 ('MAC-10.07','Administracion de activos fijos','micro','FINANZAS','Jose Saborio'),
 ('MAC-10.08','Gestion fiscal','micro','FINANZAS','Jose Saborio'),
 ('MAC-10.09','Control interno','micro','FINANZAS','Jose Saborio'),
 ('MAC-11','Gestion de TI','macro','TECNOLOGIA','Daniel Blohm'),
 ('MAC-11.01','Administracion de procesos','micro','TECNOLOGIA','Lizeth Gonzalez'),
 ('MAC-11.02','Administracion de proyectos','micro','TECNOLOGIA','Carlos Badilla'),
 ('MAC-11.03','Sistemas de informacion','micro','TECNOLOGIA','Fabiola Rodriguez'),
 ('MAC-11.04','Seguridad de la informacion','micro','TECNOLOGIA','Giselle Arias'),
 ('MAC-11.05','Administracion de la infraestructura','micro','TECNOLOGIA','Giselle Arias'),
 ('MAC-11.06','Arquitectura de TI','micro','TECNOLOGIA','Jonathan Cordero'),
 ('MAC-11.07','Administracion de bases de datos','micro','TECNOLOGIA','Jonathan Cordero'),
 ('MAC-12','Contraloria Interna','macro','CONTRALORIA','Andrey Solano'),
 ('MAC-12.01','Auditoria','micro','CONTRALORIA','Andrey Solano'),
 ('MAC-12.02','Riesgo','micro','CONTRALORIA','Andrey Solano'),
 ('MAC-12.03','Cumplimiento','micro','CONTRALORIA','Andrey Solano')
) v(code,name,lvl,bu,rc);

update process c set parent_process_id = p.id
from process p
where c.process_level='micro' and c.tenant_id=p.tenant_id
  and p.code = substring(c.code from '^[A-Z]+-[0-9]+');

if (select count(*) from incident_category) <> 16 then raise exception 'incident_category != 16'; end if;
if (select count(*) from vendor) <> 25 then raise exception 'vendor != 25'; end if;
if (select count(*) from service) <> 12 then raise exception 'service != 12'; end if;
if (select count(*) from product) <> 32 then raise exception 'product != 32'; end if;
if (select count(*) from process) <> 64 then raise exception 'process != 64'; end if;
if (select count(*) from process where process_level='micro' and parent_process_id is null) <> 0 then raise exception 'micros sin parent'; end if;
end $$;
