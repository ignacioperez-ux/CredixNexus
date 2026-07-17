-- FASE 3 · Grupo A — catalogos base (tenant CREDIX). Bloque atomico + verificacion.
-- delivery_area leads resueltos por email (portable; sin ids hardcodeados).
do $$
declare T uuid := 'c5d2f057-6262-4275-8ba9-16d9617ce128';
begin
insert into delivery_area (tenant_id, code, name, description, lead_name, lead_user_id)
select T, v.code, v.name, v.descr, v.lead, (select id from user_account u where u.email=v.email)
from (values
 ('operations','Operaciones (RUN)','Duena del RUN; entrega/activacion, gestion de comercio, liquidaciones, procesos e infraestructura TI','Giselle Arias','operaciones@credix.local'),
 ('evolution','Evolucion (CHANGE)','Squad de Evolucion / Transformacion; recibe iniciativas de cambio estructural','Daniel Blohm','evolucion@credix.local')
) v(code,name,descr,lead,email);

insert into skill (tenant_id, code, name, category) values
 (T,'PHP_LEGADO','PHP Legado','tecnica'),(T,'JAVA_SPRING','Java / Spring','tecnica'),(T,'ANGULAR','Angular','tecnica'),
 (T,'FLUTTER','Flutter','tecnica'),(T,'SQL_SERVER','SQL Server','tecnica'),(T,'APIS_GRAVITEE','APIs / Gravitee','tecnica'),
 (T,'CONTENEDORES','Contenedores','tecnica'),(T,'RPA_UIPATH','RPA / UiPath','tecnica'),(T,'BACKEND','Backend','tecnica'),
 (T,'FRONTEND','Frontend','tecnica'),(T,'DATOS','Datos','tecnica'),(T,'QA','QA','tecnica'),(T,'SEGURIDAD','Seguridad','tecnica'),
 (T,'SOPORTE','Soporte','tecnica'),(T,'UX','UX','tecnica'),(T,'INTEGRACIONES_API','Integraciones API','tecnica'),
 (T,'MEDIOS_PAGO_ISO8583','Medios de Pago / ISO 8583','dominio'),(T,'CONCILIACION','Conciliacion','dominio'),
 (T,'CICLO_TARJETA','Ciclo de Tarjeta','dominio'),(T,'SCORING','Scoring','dominio'),(T,'ORIGINACION','Originacion','dominio'),
 (T,'ONBOARDING','Onboarding','dominio'),(T,'PAGOS','Pagos','dominio'),(T,'NORMATIVA_8968_PCI','Normativa 8968 / PCI','dominio'),
 (T,'AUTOMATIZACION_PRUEBAS','Automatizacion de Pruebas','practica'),(T,'CICD','CI/CD','practica'),(T,'OBSERVABILIDAD','Observabilidad','practica'),
 (T,'DDD','DDD','practica'),(T,'STRANGLER_FIG','Strangler Fig','practica'),(T,'GESTION_BACKLOG','Gestion de Backlog','practica'),
 (T,'DISCOVERY','Discovery','practica'),(T,'FACILITACION','Facilitacion','blanda'),(T,'NEGOCIACION','Negociacion','blanda'),
 (T,'COMUNICACION_NEGOCIO','Comunicacion con Negocio','blanda');

insert into sla_policy (tenant_id, priority, response_minutes, resolution_minutes) values
 (T,'p1_critical',15,240),(T,'p2_high',30,480),(T,'p3_medium',240,1440),(T,'p4_low',480,4320);
insert into ola_policy (tenant_id, priority, response_minutes, resolution_minutes) values
 (T,'p1_critical',10,180),(T,'p2_high',20,360),(T,'p3_medium',180,1080),(T,'p4_low',360,3240);

insert into escalation_rule (tenant_id, code, name, sla_type, threshold_pct, action, notify_role) values
 (T,'ESC-RESP-75','Escalamiento respuesta 75%','response',75,'notify','support_lead'),
 (T,'ESC-RESP-90','Escalamiento respuesta 90%','response',90,'notify','support_lead'),
 (T,'ESC-RESP-100','Escalamiento respuesta 100%','response',100,'raise_priority',null),
 (T,'ESC-RESO-75','Escalamiento resolucion 75%','resolution',75,'notify','support_lead'),
 (T,'ESC-RESO-90','Escalamiento resolucion 90%','resolution',90,'notify','support_lead'),
 (T,'ESC-RESO-100','Escalamiento resolucion 100%','resolution',100,'raise_priority',null);

insert into macro (tenant_id, code, name, body, category) values
 (T,'ACK','Acuse de recibo','Hemos recibido su caso y ya esta siendo atendido por nuestro equipo. Le mantendremos informado de cada avance.','respuesta'),
 (T,'INFO','Solicitud de informacion','Para continuar con la atencion de su caso necesitamos que nos confirme la siguiente informacion adicional. Quedamos atentos a su respuesta.','respuesta'),
 (T,'WIP','En progreso','Su caso se encuentra en progreso. Nuestro equipo esta trabajando en la solucion y le notificaremos apenas tengamos una actualizacion.','respuesta'),
 (T,'RESOLVED','Resuelto','Su caso ha sido resuelto. Si el inconveniente persiste o tiene alguna consulta adicional, puede reabrirlo respondiendo a este mensaje.','respuesta'),
 (T,'ESCALATED','Escalado','Su caso ha sido escalado a un nivel especializado para asegurar una resolucion adecuada. Continuaremos dando seguimiento de extremo a extremo.','respuesta'),
 (T,'PEND_CLIENTE','Pendiente del cliente','Su caso quedo a la espera de su respuesta. En cuanto recibamos la informacion solicitada retomaremos la gestion de inmediato.','respuesta');

insert into governance_item (tenant_id, item_type, code, name, description) values
 (T,'policy','POL_TRANSFORM','Politica de Transformacion','Ningun incidente critico que revele oportunidad estructural queda como simple ticket; se evalua para evolucion.'),
 (T,'control','CTL_BUSINESS_DECISION','Control de Decision de Negocio','Toda decision de negocio sensible (scoring, credito, GRC) queda registrada y auditada.'),
 (T,'procedure','PRC_EVOLUTION_INTAKE','Procedimiento de Admision a Evolucion','Flujo formal de admision de una incidencia al squad de Evolucion conservando el tracking con el cliente.'),
 (T,'norm','NRM_AUDIT_GRADE','Norma Audit-Grade','Ninguna mutacion relevante de negocio existe sin su evento inmutable de auditoria.');

insert into document_sequence (tenant_id, doc_type, period, current_value) values
 (T,'incident','2026',0),(T,'change','2026',0),(T,'problem','2026',0),(T,'major_incident','2026',0),
 (T,'project','2026',0),(T,'dispute','2026',0),(T,'fraud','2026',0),(T,'risk','2026',0),
 (T,'knowledge','2026',0),(T,'workflow','2026',0),(T,'service_request','2026',0),(T,'vendor','2026',0);

insert into case_type (tenant_id, code, name, domain) values
 (T,'Incident','Incidente','business'),(T,'TechnologyIncident','Incidente tecnologico','technology'),
 (T,'MajorIncident','Incidente mayor','technology'),(T,'Problem','Problema','technology'),
 (T,'ChangeRequest','Solicitud de cambio','technology'),(T,'ServiceRequest','Solicitud de servicio','service'),
 (T,'AccessRequest','Solicitud de acceso','service'),(T,'DataRequest','Solicitud de datos','service'),
 (T,'PaymentIssue','Problema de pago','business'),(T,'CardIssue','Problema de tarjeta','business'),
 (T,'Chargeback','Contracargo','business'),(T,'Dispute','Disputa','business'),
 (T,'FraudSuspicion','Sospecha de fraude','business'),(T,'Complaint','Reclamo','business'),
 (T,'OperationalRisk','Evento de riesgo operativo','business'),(T,'VendorIssue','Problema con proveedor','technology');

insert into service_category (tenant_id, code, name_es, name_en, sort_order, status) values
 (T,'acceso','Acceso','Access',1,'active'),(T,'datos','Datos','Data',2,'active'),(T,'general','General','General',3,'active');

insert into business_unit (tenant_id, code, name) values
 (T,'SEGUROS','Seguros'),(T,'PRESTAMOS','Prestamos'),(T,'MEDIOS_DE_PAGO','Medios de Pago (Tarjeta)'),
 (T,'PAGOS','Pagos (P2P/remesas/transferencias)'),(T,'COBRANZA','Cobranza'),(T,'CASA_DE_CAMBIO','Casa de Cambio (Flip)'),
 (T,'CDC','CDC (factoring/cambio/tesoreria)'),(T,'COMERCIOS','Comercios (afiliacion y gestion)'),
 (T,'SERVICIO_CLIENTE','Servicio al Cliente'),(T,'CREDITO','Credito / Originacion'),(T,'MERCADEO','Mercadeo y Growth'),
 (T,'FINANZAS','Finanzas'),(T,'TALENTO','Gestion del Talento'),(T,'TECNOLOGIA','Tecnologia de Informacion'),
 (T,'DATOS','Datos y Analitica'),(T,'CONTRALORIA','Contraloria Interna'),(T,'OPERACIONES','Operaciones'),(T,'PLANIFICACION','Planificacion');

insert into channel (tenant_id, code, name, channel_type, metadata) values
 (T,'MICREDIX_APP','MiCredix App','mobile','{"grupo":"digital_cliente"}'),
 (T,'MICREDIX_WEB','MiCredix Web','web','{"grupo":"digital_cliente"}'),
 (T,'CODIGO_MICREDIX','Codigo MiCredix','web','{"grupo":"digital_cliente"}'),
 (T,'FLIP_APP','Flip App','mobile','{"grupo":"digital_cliente"}'),
 (T,'FLIP_ADMIN','Flip Administrativo','portal_partner','{"grupo":"digital_cliente","alias":"Flip Admin"}'),
 (T,'MICOMERCIO','MiComercio','portal_partner','{"grupo":"digital_comercio"}'),
 (T,'SMARTPOS','SmartPOS','portal_partner','{"grupo":"digital_comercio"}'),
 (T,'VPOS','VPOS','portal_partner','{"grupo":"digital_comercio"}'),
 (T,'CREDIXPAY','CredixPay','portal_partner','{"grupo":"digital_comercio"}'),
 (T,'CREDIXLINK','CredixLink','portal_partner','{"grupo":"digital_comercio"}'),
 (T,'LLAMADA','Llamada','phone','{"grupo":"atencion"}'),(T,'WHATSAPP','WhatsApp','whatsapp','{"grupo":"atencion"}'),
 (T,'CORREO','Correo','email','{"grupo":"atencion"}'),(T,'FACEBOOK_MESSENGER','Facebook Messenger','social','{"grupo":"atencion"}'),
 (T,'LIVECHAT_WEB','LiveChat Web','chat','{"grupo":"atencion"}'),(T,'GESTOR','Gestor','assisted','{"grupo":"atencion"}'),
 (T,'SMS','SMS','sms','{"grupo":"atencion"}'),(T,'SUCURSALES','Sucursales','branch','{"grupo":"presencial"}'),
 (T,'KIOSKO_AUTOCONSULTAS','Kiosko Autoconsultas','kiosk','{"grupo":"autoservicio"}'),
 (T,'CREDIX_COM','Credix.com','web','{"grupo":"web_informativa"}'),(T,'FLIPCR_COM','Flipcr.com','web','{"grupo":"web_informativa"}'),
 (T,'CDC_COM','CDC.com','web','{"grupo":"web_informativa"}'),
 (T,'ORIGINACION_TC','Originacion de Tarjeta de Credito','assisted','{"grupo":"originacion"}'),
 (T,'ORIGINACION_PROMOTORES','Originacion de Promotores','assisted','{"grupo":"originacion"}'),
 (T,'ORIGINACION_COMERCIOS','Originacion de Comercios Afiliados','assisted','{"grupo":"originacion"}');

if (select count(*) from delivery_area) <> 2 then raise exception 'delivery_area != 2'; end if;
if (select count(*) from skill) <> 34 then raise exception 'skill != 34'; end if;
if (select count(*) from sla_policy) <> 4 then raise exception 'sla_policy != 4'; end if;
if (select count(*) from ola_policy) <> 4 then raise exception 'ola_policy != 4'; end if;
if (select count(*) from escalation_rule) <> 6 then raise exception 'escalation_rule != 6'; end if;
if (select count(*) from macro) <> 6 then raise exception 'macro != 6'; end if;
if (select count(*) from governance_item) <> 4 then raise exception 'governance_item != 4'; end if;
if (select count(*) from document_sequence) <> 12 then raise exception 'document_sequence != 12'; end if;
if (select count(*) from case_type) <> 16 then raise exception 'case_type != 16'; end if;
if (select count(*) from service_category) <> 3 then raise exception 'service_category != 3'; end if;
if (select count(*) from business_unit) <> 18 then raise exception 'business_unit != 18'; end if;
if (select count(*) from channel) <> 25 then raise exception 'channel != 25'; end if;
end $$;
