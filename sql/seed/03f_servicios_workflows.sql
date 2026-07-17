-- FASE 3 · Grupo F — workflows(3+20 nodos+17 aristas) + service_item(8) + BU.rc_user_id + product_channel(101)
do $$
declare T uuid := 'c5d2f057-6262-4275-8ba9-16d9617ce128';
begin
insert into workflow_definition (tenant_id, code, name, entity_type, status) values
 (T,'WF-CHANGE-CAB','Gestion de Cambios (CAB)','change','active'),
 (T,'WF-EVOLUTION','Intake y Evolucion','project','active'),
 (T,'WF-SERVICE-REQUEST','Solicitud de Servicio','request','active');

insert into workflow_node (tenant_id, definition_id, code, name, node_type, sort_order)
select T, d.id, v.code, v.name, v.ntype, v.ord
from (values
 ('WF-CHANGE-CAB','START','Inicio','start',0),('WF-CHANGE-CAB','DRAFT','Borrador','task',1),
 ('WF-CHANGE-CAB','PENDING_CAB','Pendiente CAB','approval',2),('WF-CHANGE-CAB','APPROVED','Aprobado','task',3),
 ('WF-CHANGE-CAB','IMPLEMENTED','Implementado','end',4),('WF-CHANGE-CAB','REJECTED','Rechazado','end',5),
 ('WF-CHANGE-CAB','ROLLBACK','Rollback','end',6),
 ('WF-EVOLUTION','START','Inicio','start',0),('WF-EVOLUTION','INTAKE','Admision','task',1),
 ('WF-EVOLUTION','EVALUACION','Evaluacion','task',2),('WF-EVOLUTION','RECOMENDACION','Recomendacion','approval',3),
 ('WF-EVOLUTION','APROBACION','Aprobacion','approval',4),('WF-EVOLUTION','EJECUCION','Ejecucion','task',5),
 ('WF-EVOLUTION','CIERRE','Cierre','end',6),
 ('WF-SERVICE-REQUEST','START','Inicio','start',0),('WF-SERVICE-REQUEST','REGISTRO','Registro','task',1),
 ('WF-SERVICE-REQUEST','APROBACION','Aprobacion','approval',2),('WF-SERVICE-REQUEST','EJECUCION','Ejecucion','task',3),
 ('WF-SERVICE-REQUEST','CUMPLIDA','Cumplida','end',4),('WF-SERVICE-REQUEST','RECHAZADA','Rechazada','end',5)
) v(wf,code,name,ntype,ord)
join workflow_definition d on d.code=v.wf and d.tenant_id=T;

insert into workflow_edge (tenant_id, definition_id, from_node_id, to_node_id, label, sort_order)
select T, d.id, nf.id, nt.id, v.label, v.ord
from (values
 ('WF-CHANGE-CAB','START','DRAFT','',0),('WF-CHANGE-CAB','DRAFT','PENDING_CAB','enviar a CAB',1),
 ('WF-CHANGE-CAB','PENDING_CAB','APPROVED','aprobar',2),('WF-CHANGE-CAB','PENDING_CAB','REJECTED','rechazar',3),
 ('WF-CHANGE-CAB','APPROVED','IMPLEMENTED','implementar',4),('WF-CHANGE-CAB','APPROVED','ROLLBACK','revertir',5),
 ('WF-EVOLUTION','START','INTAKE','',0),('WF-EVOLUTION','INTAKE','EVALUACION','evaluar',1),
 ('WF-EVOLUTION','EVALUACION','RECOMENDACION','recomendar',2),('WF-EVOLUTION','RECOMENDACION','APROBACION','elevar',3),
 ('WF-EVOLUTION','APROBACION','EJECUCION','aprobar',4),('WF-EVOLUTION','EJECUCION','CIERRE','cerrar',5),
 ('WF-SERVICE-REQUEST','START','REGISTRO','',0),('WF-SERVICE-REQUEST','REGISTRO','APROBACION','solicitar',1),
 ('WF-SERVICE-REQUEST','APROBACION','EJECUCION','aprobar',2),('WF-SERVICE-REQUEST','APROBACION','RECHAZADA','rechazar',3),
 ('WF-SERVICE-REQUEST','EJECUCION','CUMPLIDA','cumplir',4)
) v(wf,fromc,toc,label,ord)
join workflow_definition d on d.code=v.wf and d.tenant_id=T
join workflow_node nf on nf.definition_id=d.id and nf.code=v.fromc
join workflow_node nt on nt.definition_id=d.id and nt.code=v.toc;

insert into service_item (tenant_id, code, name, category, category_id, service_id, delivery_area_id, workflow_definition_id, sla_hours, default_impact, default_urgency, form_schema)
select T, v.code, v.name, v.cat,
       (select id from service_category sc where sc.code=v.cat and sc.tenant_id=T),
       (select id from service se where se.code=nullif(v.svc,'') and se.tenant_id=T),
       (select id from delivery_area da where da.code='operations' and da.tenant_id=T),
       (select id from workflow_definition wd where wd.code='WF-SERVICE-REQUEST' and wd.tenant_id=T),
       v.sla, v.imp::impact_level, v.urg::urgency_level, v.form::jsonb
from (values
 ('SI_API_DOWN','Reportar caida de API de pagos','general','PAGOS',4,'critical','critical','[{"name":"api","label":"API afectada","type":"text","required":true},{"name":"detalle","label":"Detalle","type":"textarea","required":true}]'),
 ('SI_CARGO_DUPLICADO','Reportar duplicidad de cobro','general','PAGOS',48,'medium','high','[{"name":"referencia","label":"Referencia de transaccion","type":"text","required":true},{"name":"monto","label":"Monto","type":"number","required":true}]'),
 ('SI_SOSPECHA_FRAUDE','Reportar sospecha de fraude','general','PAGOS',8,'high','critical','[{"name":"tarjeta","label":"Ultimos 4 digitos","type":"text","required":true},{"name":"detalle","label":"Detalle","type":"textarea","required":true}]'),
 ('SI_RIESGO_OPERATIVO','Registrar evento de riesgo operativo','general','CUENTA_CORRIENTE',24,'high','medium','[{"name":"descripcion","label":"Descripcion del evento","type":"textarea","required":true},{"name":"perdida","label":"Perdida estimada","type":"number","required":false}]'),
 ('SI_PAGO_NO_APLICADO','Reportar pago no aplicado','general','PAGOS',24,'medium','high','[{"name":"referencia","label":"Referencia","type":"text","required":true},{"name":"fecha","label":"Fecha de pago","type":"date","required":true}]'),
 ('SI_CARGO_NO_RECONOCIDO','Reportar cargo no reconocido','general','PAGOS',48,'medium','medium','[{"name":"referencia","label":"Referencia","type":"text","required":true},{"name":"monto","label":"Monto","type":"number","required":true}]'),
 ('SI_SOLICITUD_ACCESO','Solicitud de acceso','acceso','',24,'low','medium','[{"name":"sistema","label":"Sistema","type":"text","required":true},{"name":"perfil","label":"Perfil solicitado","type":"text","required":true}]'),
 ('SI_SOLICITUD_DATOS','Solicitud de datos / reporte','datos','ANALITICA',72,'low','low','[{"name":"reporte","label":"Reporte solicitado","type":"text","required":true},{"name":"periodo","label":"Periodo","type":"text","required":false}]')
) v(code,name,cat,svc,sla,imp,urg,form);

update business_unit b set rc_user_id = u.id
from (values
 ('SEGUROS','karol.castillo@credix.local'),('PRESTAMOS','karol.castillo@credix.local'),
 ('MEDIOS_DE_PAGO','karol.castillo@credix.local'),('PAGOS','lerryns.perez@credix.local'),
 ('COBRANZA','oscar.fernandez@credix.local'),('CASA_DE_CAMBIO','pablo.calderon@credix.local'),
 ('CDC','luisarmando.perez@credix.local'),('COMERCIOS','alejandro.ramirez@credix.local'),
 ('SERVICIO_CLIENTE','elena.pacheco@credix.local'),('CREDITO','oscar.fernandez@credix.local'),
 ('MERCADEO','karol.castillo@credix.local'),('FINANZAS','claudia.ordaz@credix.local'),
 ('TALENTO','lizeth.rodriguez@credix.local'),('TECNOLOGIA','evolucion@credix.local'),
 ('DATOS','tatiana.hernandez@credix.local'),('CONTRALORIA','andrey.solano@credix.local'),
 ('OPERACIONES','operaciones@credix.local'),('PLANIFICACION','lerryns.perez@credix.local')
) v(bu,email)
join user_account u on u.email=v.email
where b.code=v.bu and b.tenant_id=T;

-- product_channel (101): resolucion por nombre normalizado (lower + strip acentos) + alias Flip Admin
insert into product_channel (tenant_id, product_id, channel_id)
select T, p.id, c.id
from (values
 ('Correo','Ampliar Plazo'),('Correo','Arreglos de Pago'),('Correo','Asistencia Marchamito'),
 ('Correo','Cancelacion Anticipada'),('Correo','Credito Personal'),('Correo','Marchamo'),
 ('Correo','Multiasistencia Plus'),('Correo','Multiasistencia Salud Plus Familiar'),('Correo','Multiasistencia Salud Plus Individual'),
 ('Correo','Plan Apoyo'),('Correo','Plan Liquidez'),('Correo','Plan Solidario'),('Correo','Saldo Deudor'),
 ('Correo','Servicio al Cliente'),('Correo','Tarjeta Segura 360'),
 ('CredixLink','Cuotas Cero Interes'),('CredixLink','Cuoticas'),
 ('CredixPay','Cuotas Cero Interes'),('CredixPay','Cuoticas'),('CredixPay','Tarjeta de Credito'),
 ('Facebook Messenger','Ampliar Plazo'),('Facebook Messenger','Cancelacion Anticipada'),('Facebook Messenger','Credito Personal'),
 ('Facebook Messenger','Servicio al Cliente'),('Facebook Messenger','Tarjeta Adicional'),('Facebook Messenger','Tarjeta de Credito'),
 ('Flip Admin','Casa de Cambio - Corporativo'),('Flip App','Casa de Cambio - Personas'),
 ('LiveChat web','Ampliar Plazo'),('LiveChat web','Asistencia Marchamito'),('LiveChat web','Cancelacion Anticipada'),
 ('LiveChat web','Credito Personal'),('LiveChat web','Marchamo'),('LiveChat web','Multiasistencia Plus'),
 ('LiveChat web','Multiasistencia Salud Plus Familiar'),('LiveChat web','Multiasistencia Salud Plus Individual'),
 ('LiveChat web','Plan Liquidez'),('LiveChat web','QuickPass'),('LiveChat web','Saldo Deudor'),
 ('LiveChat web','Servicio al Cliente'),('LiveChat web','Tarjeta Segura 360'),('LiveChat web','Tarjeta Adicional'),('LiveChat web','Tarjeta de Credito'),
 ('Llamada','Ampliar Plazo'),('Llamada','Arreglos de Pago'),('Llamada','Asistencia Marchamito'),
 ('Llamada','Cancelacion Anticipada'),('Llamada','Credito Personal'),('Llamada','Marchamo'),
 ('Llamada','Multiasistencia Plus'),('Llamada','Multiasistencia Salud Plus Familiar'),('Llamada','Multiasistencia Salud Plus Individual'),
 ('Llamada','Plan Apoyo'),('Llamada','Plan Liquidez'),('Llamada','Plan Solidario'),('Llamada','Saldo Deudor'),
 ('Llamada','Servicio al Cliente'),('Llamada','Tarjeta Segura 360'),('Llamada','Tarjeta Adicional'),('Llamada','Tarjeta de Credito'),
 ('MiComercio','Cuotas Cero Interes'),('MiComercio','Cuoticas'),
 ('MiCredix App','Ampliar Plazo'),('MiCredix App','Cancelacion Anticipada'),('MiCredix App','Compra sin Tarjeta'),
 ('MiCredix App','Credito Personal'),('MiCredix App','Marchamo'),('MiCredix App','Pago de Servicios'),
 ('MiCredix App','Plan Liquidez'),('MiCredix App','Servicio al Cliente'),('MiCredix App','Tarjeta Adicional'),
 ('MiCredix Web','Ampliar Plazo'),('MiCredix Web','Cancelacion Anticipada'),('MiCredix Web','Compra sin Tarjeta'),
 ('MiCredix Web','Credito Personal'),('MiCredix Web','Marchamo'),('MiCredix Web','Pago de Servicios'),
 ('MiCredix Web','Plan Liquidez'),('MiCredix Web','Servicio al Cliente'),('MiCredix Web','Tarjeta Adicional'),
 ('Originacion de Tarjeta de Credito','Tarjeta de Credito'),
 ('SmartPOS','Cuotas Cero Interes'),('SmartPOS','Cuoticas'),
 ('VPOS','Cuotas Cero Interes'),('VPOS','Cuoticas'),
 ('WhatsApp','Ampliar Plazo'),('WhatsApp','Arreglos de Pago'),('WhatsApp','Asistencia Marchamito'),
 ('WhatsApp','Cancelacion Anticipada'),('WhatsApp','Credito Personal'),('WhatsApp','Marchamo'),
 ('WhatsApp','Multiasistencia Plus'),('WhatsApp','Multiasistencia Salud Plus Familiar'),('WhatsApp','Multiasistencia Salud Plus Individual'),
 ('WhatsApp','Plan Apoyo'),('WhatsApp','Plan Liquidez'),('WhatsApp','Plan Solidario'),('WhatsApp','Saldo Deudor'),
 ('WhatsApp','Servicio al Cliente'),('WhatsApp','Tarjeta Segura 360'),('WhatsApp','Tarjeta de Credito')
) v(canal,prod)
join channel c on c.tenant_id=T and lower(trim(c.name)) = lower(trim(case when v.canal='Flip Admin' then 'Flip Administrativo' else v.canal end))
join product p on p.tenant_id=T and lower(trim(p.name)) = lower(trim(v.prod));

if (select count(*) from workflow_definition) <> 3 then raise exception 'wf_def != 3'; end if;
if (select count(*) from workflow_node) <> 20 then raise exception 'wf_node != 20'; end if;
if (select count(*) from workflow_edge) <> 17 then raise exception 'wf_edge != 17'; end if;
if (select count(*) from service_item) <> 8 then raise exception 'service_item != 8'; end if;
if (select count(*) from business_unit where rc_user_id is null) <> 0 then raise exception 'BU sin rc'; end if;
if (select count(*) from product_channel) <> 101 then raise exception 'product_channel != 101'; end if;
end $$;
