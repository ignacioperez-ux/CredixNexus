-- FASE 3 · Grupo D — CMDB: configuration_item(60) + ci_channel(12) + process_system(47)
-- vendor/service resueltos por code ("Credix" interno => vendor null).
do $$
declare T uuid := 'c5d2f057-6262-4275-8ba9-16d9617ce128';
begin
insert into configuration_item (tenant_id, code, name, ci_type, criticality, vendor_id, service_id)
select T, v.code, v.name, v.ci_type, v.crit::impact_level,
       (select id from vendor ve where ve.code=v.vend and ve.tenant_id=T),
       (select id from service se where se.code=v.svc and se.tenant_id=T)
from (values
 ('CI-SAC','SAC','core','critical',null,'CUENTA_CORRIENTE'),
 ('CI-SAC-20','SAC 2.0','core','critical',null,'CUENTA_CORRIENTE'),
 ('CI-AUTOCARTERA','Autocartera','core','critical',null,'COBRANZA'),
 ('CI-TRASIEGO','Trasiego','core','high',null,'CUENTA_CORRIENTE'),
 ('CI-CREDIX-ADMIN','Credix Admin','core','high',null,null),
 ('CI-MARCHAMOS','Marchamos','core','high',null,null),
 ('CI-CARD-WIZARD','Card Wizard','core','medium',null,null),
 ('CI-EXACTUS','Exactus','corporativo','high','VND-EXACTUS',null),
 ('CI-CALIFICADOR','Calificador','core','critical',null,'SCORING'),
 ('CI-MOTOR-DECISIONES','Motor de Decisiones','core','critical',null,'SCORING'),
 ('CI-ORIGINACION','Originacion TC / Promotores / Comercios','canal','high','VND-INCONCERT','ORIGINACION'),
 ('CI-SENTINEL','Sentinel','integracion','high','VND-SENTINEL','SCORING'),
 ('CI-METAMAP','Metamap','integracion','high','VND-METAMAP','ONBOARDING'),
 ('CI-ID-CHECK','ID Check','integracion','high',null,'ONBOARDING'),
 ('CI-VID','VID','integracion','medium',null,'ONBOARDING'),
 ('CI-BUROS','Credid / CrediServer / Buros','integracion','high','VND-BUROS','SCORING'),
 ('CI-TSE','TSE (conectividad)','integracion','medium','VND-TSE','ONBOARDING'),
 ('CI-SOCKET-PRISMA','Socket Prisma','integracion','critical','VND-PRISMA','PAGOS'),
 ('CI-PASARELA-PAGO','Pasarela de Pago','core','critical','VND-VISA','PAGOS'),
 ('CI-VPOS','VPOS','canal','high',null,'PAGOS'),
 ('CI-SMARTPOS','SmartPOS','canal','high',null,'PAGOS'),
 ('CI-CREDIXPAY','CredixPay','canal','high',null,'PAGOS'),
 ('CI-CREDIXLINK','CredixLink','canal','medium',null,'PAGOS'),
 ('CI-MICOMERCIO','MiComercio','canal','high',null,'AFILIACION_COMERCIOS'),
 ('CI-VPART','VPart / Prismanet','integracion','medium','VND-PRISMA','PAGOS'),
 ('CI-VSPS','VSPS','integracion','medium','VND-PRISMA','PAGOS'),
 ('CI-BN','Banco Nacional (conectividad)','integracion','high','VND-BN','CONCILIACION'),
 ('CI-MICREDIX-APP','MiCredix App','canal','critical',null,'ATENCION_CLIENTE'),
 ('CI-MICREDIX-WEB','MiCredix Web','canal','critical',null,'ATENCION_CLIENTE'),
 ('CI-CODIGO-MICREDIX','Codigo MiCredix','canal','low',null,'ATENCION_CLIENTE'),
 ('CI-KIOSKO','Kiosko Autoconsultas','canal','low',null,'ATENCION_CLIENTE'),
 ('CI-INCONCERT','inConcert','integracion','high','VND-INCONCERT','ATENCION_CLIENTE'),
 ('CI-INFOBIP','Infobip','integracion','high','VND-INFOBIP','ATENCION_CLIENTE'),
 ('CI-NOTIFICACIONES','WhatsApp / SMS / Notificaciones','canal','high',null,'ATENCION_CLIENTE'),
 ('CI-FLIP-APP','Flip App','canal','high',null,'CASA_DE_CAMBIO'),
 ('CI-FLIP-ADMIN','Flip Administrativo','canal','high',null,'CASA_DE_CAMBIO'),
 ('CI-WEBS','Flipcr.com / CDC.com / Credix.com / Landings','web','low',null,null),
 ('CI-CDC','CDC - factoring / cambio / tesoreria','core','high',null,'CASA_DE_CAMBIO'),
 ('CI-CGP','CGP','corporativo','medium',null,null),
 ('CI-GRAVITEE','Gravitee (API Gateway)','plataforma','critical','VND-GRAVITEE',null),
 ('CI-CICD','CI/CD y ambientes','plataforma','high',null,null),
 ('CI-OBSERVABILIDAD','Observabilidad','plataforma','high',null,null),
 ('CI-DWH','DataWarehouse / Cubos','analitica','high','VND-POWERBI','ANALITICA'),
 ('CI-CATALOGO-DATOS','Catalogo / linaje de datos','analitica','medium',null,'ANALITICA'),
 ('CI-TABLEAU','Tableau / Power BI / SPSS / R','analitica','medium','VND-TABLEAU','ANALITICA'),
 ('CI-SOFTLAND','Softland (Capital Humano)','corporativo','medium','VND-SOFTLAND',null),
 ('CI-RECOVERY','Recovery (Cobros)','corporativo','high',null,'COBRANZA'),
 ('CI-FACTURA-GTI','Factura Electronica (GTI)','corporativo','high','VND-GTI',null),
 ('CI-SICVECA','SICVECA','regulatorio','high','VND-SUGEF',null),
 ('CI-AUTENTIKA','Autentika','integracion','medium','VND-AUTENTIKA','ONBOARDING'),
 ('CI-AD-DNS','Active Directory / DNS / DHCP','infraestructura','critical','VND-MICROSOFT',null),
 ('CI-AWS','AWS (RDS/Lambda/VPC)','infraestructura','critical','VND-AWS',null),
 ('CI-ESET','ESET','infraestructura','high','VND-ESET',null),
 ('CI-SIEM','SIEM','infraestructura','high',null,null),
 ('CI-M365-GWS','Microsoft 365 / Google Workspace','infraestructura','high','VND-MICROSOFT',null),
 ('CI-GLPI','GLPI / Mesa de Ayuda','itsm','medium',null,null),
 ('CI-OSTICKET','OS Ticket','itsm','medium',null,null),
 ('CI-ASANA','Asana / MS Project','gestion','low','VND-ASANA',null),
 ('CI-UIPATH','UiPath / RPA','automatizacion','medium','VND-UIPATH',null),
 ('CI-LASERFICHE','LaserFiche','corporativo','low','VND-LASERFICHE',null)
) v(code,name,ci_type,crit,vend,svc);

insert into ci_channel (tenant_id, ci_id, channel_id)
select T, ci.id, ch.id from (values
 ('CI-MICREDIX-APP','MICREDIX_APP'),('CI-MICREDIX-WEB','MICREDIX_WEB'),('CI-CODIGO-MICREDIX','CODIGO_MICREDIX'),
 ('CI-KIOSKO','KIOSKO_AUTOCONSULTAS'),('CI-VPOS','VPOS'),('CI-SMARTPOS','SMARTPOS'),
 ('CI-CREDIXPAY','CREDIXPAY'),('CI-CREDIXLINK','CREDIXLINK'),('CI-MICOMERCIO','MICOMERCIO'),
 ('CI-FLIP-APP','FLIP_APP'),('CI-FLIP-ADMIN','FLIP_ADMIN'),('CI-NOTIFICACIONES','WHATSAPP')
) v(ci,ch)
join configuration_item ci on ci.code=v.ci and ci.tenant_id=T
join channel ch on ch.code=v.ch and ch.tenant_id=T;

insert into process_system (tenant_id, process_id, ci_id, role, criticality)
select T, p.id, ci.id, v.role, (case when v.role='primary' then 'high' else 'medium' end)::impact_level
from (values
 ('CI-SAC','MAC-04','primary'),('CI-SAC','MAC-05','primary'),('CI-SAC','MAC-06','secondary'),
 ('CI-SAC-20','MAC-04','primary'),('CI-SAC-20','MAC-05','secondary'),
 ('CI-AUTOCARTERA','MAC-05','primary'),('CI-AUTOCARTERA','MAC-05.04','primary'),
 ('CI-TRASIEGO','MAC-04.07','primary'),('CI-TRASIEGO','MAC-04','secondary'),
 ('CI-CALIFICADOR','MAC-04.02','primary'),('CI-CALIFICADOR','MAC-04','secondary'),
 ('CI-MOTOR-DECISIONES','MAC-04.02','primary'),('CI-MOTOR-DECISIONES','MAC-04.01','secondary'),
 ('CI-ORIGINACION','MAC-04.01','primary'),('CI-ORIGINACION','MAC-04.03','primary'),('CI-ORIGINACION','MAC-04.04','secondary'),
 ('CI-METAMAP','MAC-04.03','integration'),('CI-METAMAP','MAC-06.02','integration'),
 ('CI-SENTINEL','MAC-04.02','integration'),('CI-SENTINEL','MAC-12.03','secondary'),
 ('CI-BUROS','MAC-04.02','integration'),
 ('CI-SOCKET-PRISMA','MAC-06.03','integration'),('CI-SOCKET-PRISMA','MAC-08.02','primary'),
 ('CI-PASARELA-PAGO','MAC-08.02','primary'),('CI-PASARELA-PAGO','MAC-06.03','secondary'),
 ('CI-VPOS','MAC-08.01','primary'),('CI-SMARTPOS','MAC-08.01','primary'),
 ('CI-MICOMERCIO','MAC-07.04','primary'),('CI-MICOMERCIO','MAC-08.01','secondary'),
 ('CI-MICREDIX-APP','MAC-06.01','primary'),('CI-MICREDIX-APP','MAC-06.02','primary'),
 ('CI-MICREDIX-WEB','MAC-06.01','primary'),
 ('CI-INCONCERT','MAC-06.01','integration'),('CI-INFOBIP','MAC-06.02','integration'),
 ('CI-FLIP-APP','MAC-06.01','secondary'),('CI-CDC','MAC-10.01','primary'),
 ('CI-EXACTUS','MAC-10.06','integration'),('CI-EXACTUS','MAC-10.04','integration'),
 ('CI-RECOVERY','MAC-05.02','primary'),('CI-DWH','MAC-03.01','secondary'),
 ('CI-GRAVITEE','MAC-11.06','primary'),('CI-AD-DNS','MAC-11.05','primary'),
 ('CI-AWS','MAC-11.05','primary'),('CI-AWS','MAC-11.07','primary'),
 ('CI-SICVECA','MAC-12.03','integration'),('CI-FACTURA-GTI','MAC-10.08','integration'),
 ('CI-UIPATH','MAC-11.01','primary')
) v(ci,proc,role)
join configuration_item ci on ci.code=v.ci and ci.tenant_id=T
join process p on p.code=v.proc and p.tenant_id=T;

if (select count(*) from configuration_item) <> 60 then raise exception 'configuration_item != 60'; end if;
if (select count(*) from ci_channel) <> 12 then raise exception 'ci_channel != 12'; end if;
if (select count(*) from process_system) <> 47 then raise exception 'process_system != 47'; end if;
end $$;
