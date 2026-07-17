-- FASE 3 · Grupo E — organizacion de talento: tribe(2) + squad(7) + team_member(44) + squad_member(44)
-- squad.type_locked=true para preservar squad_type frente al trigger squad_reclassify_by_membership.
-- Vacante PO SQ-03 se cubre en Fase 4 (04_personas_sinteticas.sql).
do $$
declare T uuid := 'c5d2f057-6262-4275-8ba9-16d9617ce128';
begin
insert into tribe (tenant_id, code, name, mission, tribe_lead_user_id, status)
select T, v.code, v.name, v.mission, (select id from user_account u where u.email=nullif(v.lead,'')), 'draft'
from (values
 ('TR-01','Cliente y Canales','Agrupa los flujos de valor de cara al cliente (SQ-01, SQ-02, SQ-03)',''),
 ('TR-02','Core y Plataformas','Core operativo, ecosistema y plataforma (SQ-04, SQ-05, EQ-PLAT)','evolucion@credix.local')
) v(code,name,mission,lead);

insert into squad (tenant_id, code, name, business_unit_id, po_user_id, tech_lead_user_id, tribe_id, squad_type, is_transversal, type_locked, mission)
select T, v.code, v.name,
       (select id from business_unit b where b.code=v.bu and b.tenant_id=T),
       (select id from user_account u where u.email=nullif(v.po,'')),
       (select id from user_account u where u.email=nullif(v.tl,'')),
       (select id from tribe tr where tr.code=nullif(v.tribe,'') and tr.tenant_id=T),
       v.stype, v.transv, true, v.mission
from (values
 ('SQ-01','MiCredix y Canales de Atencion','SERVICIO_CLIENTE','michael.venegas@credix.local','stefano.quiros@credix.local','TR-01','domain',false,'MiCredix y canales de atencion al cliente'),
 ('SQ-02','Visa y Prisma - Pagos y Comercios','MEDIOS_DE_PAGO','beatriz.vargas@credix.local','kevin.chacon@credix.local','TR-01','domain',false,'Pagos, Visa/Prisma y comercios'),
 ('SQ-03','Originacion y Decision','CREDITO','','miguel.cabrera@credix.local','TR-01','domain',false,'Originacion y decision de credito'),
 ('SQ-04','Admins y Core Operativo (SAC)','TECNOLOGIA','keila.andrade@credix.local','adriana.duran@credix.local','TR-02','domain',false,'Core operativo SAC y desacoplamiento'),
 ('SQ-05','Flip e Innovacion','CASA_DE_CAMBIO','keila.andrade@credix.local','pedro.maestre@credix.local','TR-02','domain',false,'Flip e innovacion (BNPL, FX, tesoreria)'),
 ('EQ-PLAT','Arquitectura, Datos y Plataforma','TECNOLOGIA','jonathan.cordero@credix.local','','TR-02','enabler',true,'Arquitectura, datos y plataforma transversal'),
 ('CEL-01','Quick Wins y Automatizacion','TECNOLOGIA','jai.wu@credix.local','','','transient',true,'Quick wins y automatizacion (celula temporal)')
) v(code,name,bu,po,tl,tribe,stype,transv,mission);

insert into team_member (tenant_id, name, user_id, delivery_area_id, discipline, seniority)
select T, v.name, (select id from user_account u where u.email=nullif(v.acct,'')),
       (select id from delivery_area d where d.code=v.area and d.tenant_id=T), v.disc, v.sr
from (values
 ('Daniel Blohm','evolucion@credix.local','Direccion','lead','evolution'),
 ('Fabiola Rodriguez','fabiola.rodriguez@credix.local','Desarrollo','lead','evolution'),
 ('Julieth Hernandez','julieth.hernandez@credix.local','Agilidad','senior','evolution'),
 ('Jonathan Cordero','jonathan.cordero@credix.local','Arquitectura','lead','evolution'),
 ('Marco Murillo','','Datos','senior','evolution'),('Christian Quintero','','Datos','junior','evolution'),
 ('Gabriel Doe','','Backend','mid','evolution'),('Jai Yu Wu','jai.wu@credix.local','Backend','mid','evolution'),
 ('Keila Andrade','keila.andrade@credix.local','Producto','senior','evolution'),
 ('Beatriz Vargas','beatriz.vargas@credix.local','Producto','senior','evolution'),
 ('Michael Venegas','michael.venegas@credix.local','Producto','senior','evolution'),
 ('David Solano','','UX','senior','evolution'),('Lucia Navarro','','UX','mid','evolution'),
 ('Cleinys','','QA','mid','evolution'),('Stephanie Chacon','','QA','mid','evolution'),
 ('Viviana Perez','','QA','senior','evolution'),
 ('Kevin Chacon','kevin.chacon@credix.local','Desarrollo','senior','evolution'),
 ('Stefano Quiros','stefano.quiros@credix.local','Desarrollo','senior','evolution'),
 ('Miguel Cabrera','miguel.cabrera@credix.local','Desarrollo','senior','evolution'),
 ('Adriana Duran','adriana.duran@credix.local','Desarrollo','senior','evolution'),
 ('Pedro Maestre','pedro.maestre@credix.local','Desarrollo','senior','evolution'),
 ('Giselle Arias','operaciones@credix.local','Operaciones','lead','operations'),
 ('Tatiana Hernandez','tatiana.hernandez@credix.local','Datos','senior','evolution'),
 ('Luis P','','Desarrollo','mid','evolution'),('Maria R','','Desarrollo','mid','evolution'),
 ('Yoel M','','Desarrollo','mid','evolution'),('Whady M','','Desarrollo','mid','evolution'),
 ('Jesus M','','Desarrollo','mid','evolution'),('Gianluca D','','Desarrollo','mid','evolution'),
 ('Gianfranco C','','Desarrollo','mid','evolution'),('Jose Q','','Desarrollo','mid','evolution'),
 ('Jaime B','','Desarrollo','mid','evolution'),('Karla T','','Desarrollo','mid','evolution'),
 ('Jorge M','','Desarrollo','mid','evolution'),('Andry P','','Desarrollo','mid','evolution'),
 ('Alejandro C','','Desarrollo','mid','evolution'),('Gisella A','','Desarrollo','mid','evolution'),
 ('Julio G','','Desarrollo','mid','evolution'),('Jennire V','','Desarrollo','mid','evolution'),
 ('Dilan M','','Desarrollo','mid','evolution'),('Jhonaiquel R','','Desarrollo','mid','evolution'),
 ('Marcel G','','Desarrollo','mid','evolution'),('Juan A','','Desarrollo','mid','evolution'),
 ('Jeancar S','','Desarrollo','mid','evolution')
) v(name,acct,disc,sr,area);

insert into squad_member (tenant_id, squad_id, member_id, squad_role, allocation_pct)
select T, s.id, tm.id, v.role, v.pct
from (values
 ('Michael Venegas','SQ-01','product_owner',100),('Stefano Quiros','SQ-01','tech_lead',100),
 ('David Solano','SQ-01','analyst',60),('Stephanie Chacon','SQ-01','qa',60),
 ('Beatriz Vargas','SQ-02','product_owner',100),('Kevin Chacon','SQ-02','tech_lead',100),
 ('Lucia Navarro','SQ-02','analyst',40),('Cleinys','SQ-02','qa',60),
 ('Miguel Cabrera','SQ-03','tech_lead',100),('Lucia Navarro','SQ-03','analyst',60),('Viviana Perez','SQ-03','qa',50),
 ('Keila Andrade','SQ-04','product_owner',70),('Adriana Duran','SQ-04','tech_lead',100),('Cleinys','SQ-04','qa',40),
 ('Keila Andrade','SQ-05','product_owner',30),('Pedro Maestre','SQ-05','tech_lead',100),
 ('David Solano','SQ-05','analyst',40),('Stephanie Chacon','SQ-05','qa',40),
 ('Jonathan Cordero','EQ-PLAT','tech_lead',50),('Marco Murillo','EQ-PLAT','developer',100),
 ('Christian Quintero','EQ-PLAT','developer',100),('Gabriel Doe','EQ-PLAT','developer',100),
 ('Jai Yu Wu','CEL-01','developer',100),
 ('Luis P','SQ-01','developer',100),('Maria R','SQ-01','developer',100),('Yoel M','SQ-01','developer',100),
 ('Whady M','SQ-01','developer',100),('Jesus M','SQ-01','developer',100),
 ('Gianluca D','SQ-02','developer',100),('Gianfranco C','SQ-02','developer',100),('Jose Q','SQ-02','developer',100),('Jaime B','SQ-02','developer',100),
 ('Karla T','SQ-03','developer',100),('Jorge M','SQ-03','developer',100),('Andry P','SQ-03','developer',100),('Alejandro C','SQ-03','developer',100),
 ('Gisella A','SQ-04','developer',100),('Julio G','SQ-04','developer',100),('Jennire V','SQ-04','developer',100),('Dilan M','SQ-04','developer',100),
 ('Jhonaiquel R','SQ-05','developer',100),('Marcel G','SQ-05','developer',100),('Juan A','SQ-05','developer',100),('Jeancar S','SQ-05','developer',100)
) v(mname,scode,role,pct)
join team_member tm on tm.name=v.mname and tm.tenant_id=T
join squad s on s.code=v.scode and s.tenant_id=T;

if (select count(*) from tribe) <> 2 then raise exception 'tribe != 2'; end if;
if (select count(*) from squad) <> 7 then raise exception 'squad != 7'; end if;
if (select count(*) from team_member) <> 44 then raise exception 'team_member != 44'; end if;
if (select count(*) from squad_member) <> 44 then raise exception 'squad_member != 44'; end if;
end $$;
