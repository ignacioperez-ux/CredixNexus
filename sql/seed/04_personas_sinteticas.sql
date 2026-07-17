-- FASE 4 — Personas sinteticas (semilla determinista setseed(0.42)). Tenant CREDIX.
-- 4.1 party(40)+party_role(40)+usuarios finales(15) · 4.2 operadores(8) · 4.3 perfiles squad(22)+Juan · 4.4 asset_assignment(20)
-- Correos sinteticos: @credix.local (personal), @correo-demo.cr / @comercio-demo.cr (clientes).

-- ===== 4.1 party + party_role + partner_user =====
do $$
declare T uuid := 'c5d2f057-6262-4275-8ba9-16d9617ce128';
  fnames text[] := array['Maria','Jose','Luis','Ana','Carlos','Laura','Andres','Sofia','Diego','Valeria','Marco','Gabriela','Fernando','Daniela','Ricardo','Adriana'];
  lnames text[] := array['Rojas','Mora','Vargas','Jimenez','Solano','Chaves','Herrera','Castro','Alvarado','Ramirez','Fernandez','Cordero','Quesada','Villalobos','Montero','Salas'];
  risks text[] := array['low','low','low','medium','medium','high'];
begin
  perform setseed(0.42);
  insert into party (tenant_id, party_type, display_name, legal_name, tax_id, email, phone, segment, vip_flag, risk_level)
  select T, 'person', fnames[1+(g*3)%16]||' '||lnames[1+(g*5)%16], fnames[1+(g*3)%16]||' '||lnames[1+(g*5)%16],
    '1-'||lpad((1000+g)::text,4,'0')||'-'||lpad((2000+g)::text,4,'0'),
    lower(fnames[1+(g*3)%16])||'.'||lower(lnames[1+(g*5)%16])||g||'@correo-demo.cr',
    '8'||lpad(((g*1370977)%90000000)::text,8,'0'),
    case when g%3=0 then 'Premium' else 'Estandar' end, (g%9=0), risks[1+floor(random()*6)::int]::impact_level
  from generate_series(1,30) g;
  insert into party (tenant_id, party_type, display_name, legal_name, tax_id, email, phone, segment, risk_level)
  select T, 'organization', v.nm, v.nm||' S.A.', '3-101-'||lpad((100000+g)::text,6,'0'),
    'info'||g||'@comercio-demo.cr', '2'||lpad(((g*7318043)%90000000)::text,8,'0'),
    case when g%2=0 then 'Premium' else 'Estandar' end, (array['low','medium','medium'])[1+(g%3)]::impact_level
  from (values (1,'Comercial La Uruca'),(2,'Abastecedor El Roble'),(3,'Ferreteria San Jose'),(4,'Farmacia Central CR'),
   (5,'Panaderia La Espiga'),(6,'Tecno Store CR'),(7,'Muebles del Valle'),(8,'Super Mercado Tico'),
   (9,'Distribuidora Pacifico'),(10,'Boutique Escazu')) v(g,nm);
  insert into party_role (tenant_id, party_id, role_type, valid_from)
  select T, p.id, case when p.party_type='organization' then 'merchant' else 'customer' end, date '2026-01-15'
  from party p where p.tenant_id=T;
  insert into user_account (tenant_id, party_id, email, username, full_name, password_auth_disabled)
  select T, p.id, p.email, p.email, p.display_name, true
  from (select id, email, display_name from party where tenant_id=T and party_type='person' order by email limit 15) p;
  alter table public.user_role disable trigger trg_audit_user_role;
  insert into user_role (user_id, role_id)
  select ua.id, r.id from user_account ua join party p on p.id=ua.party_id cross join role r where r.code='partner_user' and p.tenant_id=T;
  alter table public.user_role enable trigger trg_audit_user_role;
end $$;

-- ===== 4.2 operadores de gestion TI (support_agent) =====
do $$
declare T uuid := 'c5d2f057-6262-4275-8ba9-16d9617ce128'; giss uuid;
begin
  perform setseed(0.42);
  select id into giss from user_account where email='operaciones@credix.local';
  insert into user_account (tenant_id, email, username, full_name, password_auth_disabled)
  select T, v.email, v.email, v.fname, true from (values
   ('Kattia Segura','kattia.segura@credix.local'),('Randall Mena','randall.mena@credix.local'),
   ('Yendry Campos','yendry.campos@credix.local'),('Josue Brenes','josue.brenes@credix.local'),
   ('Natalia Ugalde','natalia.ugalde@credix.local'),('Bryan Arce','bryan.arce@credix.local'),
   ('Melany Fallas','melany.fallas@credix.local')) v(fname,email);
  alter table public.user_role disable trigger trg_audit_user_role;
  insert into user_role (user_id, role_id)
  select ua.id, r.id from user_account ua cross join role r where r.code='support_agent' and ua.email in
   ('kattia.segura@credix.local','randall.mena@credix.local','yendry.campos@credix.local','josue.brenes@credix.local',
    'natalia.ugalde@credix.local','bryan.arce@credix.local','melany.fallas@credix.local');
  alter table public.user_role enable trigger trg_audit_user_role;
  insert into team_member (tenant_id, name, user_id, delivery_area_id, discipline, seniority)
  select T, v.name, (select id from user_account u where u.email=v.acct),
         (select id from delivery_area d where d.code='operations' and d.tenant_id=T), 'Soporte', v.sr
  from (values ('Andres Gonzalez','operador@credix.local','mid'),
   ('Kattia Segura','kattia.segura@credix.local','mid'),('Randall Mena','randall.mena@credix.local','junior'),
   ('Yendry Campos','yendry.campos@credix.local','mid'),('Josue Brenes','josue.brenes@credix.local','junior'),
   ('Natalia Ugalde','natalia.ugalde@credix.local','senior'),('Bryan Arce','bryan.arce@credix.local','mid'),
   ('Melany Fallas','melany.fallas@credix.local','mid')) v(name,acct,sr);
  insert into member_skill (tenant_id, member_id, skill_id, level)
  select T, m.id, s.id, 1+floor(random()*5)::int from team_member m
  cross join lateral (select id from skill where tenant_id=T and code in
    ('SOPORTE','PAGOS','CONCILIACION','CICLO_TARJETA','SEGURIDAD','NORMATIVA_8968_PCI','MEDIOS_PAGO_ISO8583','ONBOARDING')
    order by md5(m.id::text||id::text) limit (3+floor(random()*3)::int)) s
  where m.tenant_id=T and m.discipline='Soporte';
  insert into member_evaluation (tenant_id, member_id, period, performance_score, empathy_score, eval_type, strengths, development_areas, evaluator_user_id)
  select T, m.id, p.period, round((3.2+random()*1.6)::numeric,1), round((3.2+random()*1.6)::numeric,1), 'general',
    (array['Alta empatia con el cliente','Buen manejo de SLA','Dominio de herramientas de soporte','Comunicacion clara'])[1+floor(random()*4)::int],
    (array['Profundizar en conciliacion','Mejorar documentacion en KB','Delegacion de casos complejos','Gestion del tiempo'])[1+floor(random()*4)::int], giss
  from team_member m cross join (values ('2026-Q1'),('2026-Q2')) p(period) where m.tenant_id=T and m.discipline='Soporte';
end $$;

-- ===== 4.3 perfiles de squad (22) + Juan Pacheco + skills/expertise/evaluacion =====
do $$
declare T uuid := 'c5d2f057-6262-4275-8ba9-16d9617ce128';
begin
  insert into user_account (tenant_id, email, username, full_name, password_auth_disabled)
  select T, v.email, v.email, v.fname, true from (values
   ('Marcela Solis','marcela.solis@credix.local'),('Esteban Rojas','esteban.rojas@credix.local'),('Paola Vega','paola.vega@credix.local'),
   ('Andrea Lopez','andrea.lopez@credix.local'),('Kevin Soto','kevin.soto@credix.local'),('Tamara Ruiz','tamara.ruiz@credix.local'),
   ('Rodrigo Mena','rodrigo.mena@credix.local'),('Silvia Pineda','silvia.pineda@credix.local'),
   ('Oscar Vindas','oscar.vindas@credix.local'),('Lucia Barrantes','lucia.barrantes@credix.local'),('Diego Ramirez','diego.ramirez2@credix.local'),
   ('Alonso Cascante','alonso.cascante@credix.local'),('Karen Mata','karen.mata@credix.local'),('Bryan Nunez','bryan.nunez@credix.local'),
   ('Fiorella Sancho','fiorella.sancho@credix.local'),('Marvin Elizondo','marvin.elizondo@credix.local'),('Priscilla Aguilar','priscilla.aguilar@credix.local'),
   ('Gerardo Leon','gerardo.leon@credix.local'),('Wendy Corrales','wendy.corrales@credix.local'),('Hazel Zuniga','hazel.zuniga@credix.local'),
   ('Alexander Rojas','alexander.rojas@credix.local'),('Maureen Castro','maureen.castro@credix.local')) v(fname,email);
  alter table public.user_role disable trigger trg_audit_user_role;
  insert into user_role (user_id, role_id)
  select ua.id, r.id from user_account ua cross join role r
  where r.code='squad_member' and ua.email in ('marcela.solis@credix.local','esteban.rojas@credix.local','paola.vega@credix.local','andrea.lopez@credix.local',
   'kevin.soto@credix.local','tamara.ruiz@credix.local','rodrigo.mena@credix.local','silvia.pineda@credix.local','oscar.vindas@credix.local',
   'lucia.barrantes@credix.local','diego.ramirez2@credix.local','alonso.cascante@credix.local','karen.mata@credix.local','bryan.nunez@credix.local',
   'fiorella.sancho@credix.local','marvin.elizondo@credix.local','priscilla.aguilar@credix.local','gerardo.leon@credix.local','wendy.corrales@credix.local',
   'hazel.zuniga@credix.local','alexander.rojas@credix.local','maureen.castro@credix.local');
  alter table public.user_role enable trigger trg_audit_user_role;
  insert into team_member (tenant_id, name, user_id, delivery_area_id, discipline, seniority)
  select T, v.name, (select id from user_account u where u.email=v.email),
         (select id from delivery_area d where d.code='evolution' and d.tenant_id=T), v.disc, v.sr
  from (values
   ('Marcela Solis','marcela.solis@credix.local','Producto','senior'),('Esteban Rojas','esteban.rojas@credix.local','Producto','senior'),
   ('Paola Vega','paola.vega@credix.local','Producto','mid'),('Andrea Lopez','andrea.lopez@credix.local','UX','mid'),
   ('Kevin Soto','kevin.soto@credix.local','UX','mid'),('Tamara Ruiz','tamara.ruiz@credix.local','UX','junior'),
   ('Rodrigo Mena','rodrigo.mena@credix.local','Arquitectura','senior'),('Silvia Pineda','silvia.pineda@credix.local','Arquitectura','senior'),
   ('Oscar Vindas','oscar.vindas@credix.local','QA','mid'),('Lucia Barrantes','lucia.barrantes@credix.local','QA','mid'),
   ('Diego Ramirez','diego.ramirez2@credix.local','QA','junior'),('Alonso Cascante','alonso.cascante@credix.local','Backend','mid'),
   ('Karen Mata','karen.mata@credix.local','Frontend','mid'),('Bryan Nunez','bryan.nunez@credix.local','Backend','mid'),
   ('Fiorella Sancho','fiorella.sancho@credix.local','Frontend','junior'),('Marvin Elizondo','marvin.elizondo@credix.local','Backend','senior'),
   ('Priscilla Aguilar','priscilla.aguilar@credix.local','Backend','mid'),('Gerardo Leon','gerardo.leon@credix.local','Backend','mid'),
   ('Wendy Corrales','wendy.corrales@credix.local','Frontend','mid'),('Hazel Zuniga','hazel.zuniga@credix.local','Backend','junior'),
   ('Alexander Rojas','alexander.rojas@credix.local','Backend','mid'),('Maureen Castro','maureen.castro@credix.local','Frontend','mid'),
   ('Juan Pacheco','squads@credix.local','Backend','mid')) v(name,email,disc,sr);
  update squad set po_user_id=(select id from user_account where email='marcela.solis@credix.local') where code='SQ-03' and tenant_id=T;
  insert into squad_member (tenant_id, squad_id, member_id, squad_role, allocation_pct)
  select T, s.id, tm.id, v.srole, 100 from (values
   ('marcela.solis@credix.local','product_owner','SQ-03'),('esteban.rojas@credix.local','product_owner','EQ-PLAT'),('paola.vega@credix.local','product_owner','CEL-01'),
   ('andrea.lopez@credix.local','analyst','CEL-01'),('kevin.soto@credix.local','analyst','SQ-02'),('tamara.ruiz@credix.local','analyst','SQ-04'),
   ('rodrigo.mena@credix.local','tech_lead','EQ-PLAT'),('silvia.pineda@credix.local','tech_lead','EQ-PLAT'),
   ('oscar.vindas@credix.local','qa','CEL-01'),('lucia.barrantes@credix.local','qa','EQ-PLAT'),('diego.ramirez2@credix.local','qa','SQ-03'),
   ('alonso.cascante@credix.local','developer','CEL-01'),('karen.mata@credix.local','developer','CEL-01'),('bryan.nunez@credix.local','developer','SQ-01'),
   ('fiorella.sancho@credix.local','developer','SQ-01'),('marvin.elizondo@credix.local','developer','SQ-02'),('priscilla.aguilar@credix.local','developer','SQ-02'),
   ('gerardo.leon@credix.local','developer','SQ-04'),('wendy.corrales@credix.local','developer','SQ-04'),('hazel.zuniga@credix.local','developer','SQ-05'),
   ('alexander.rojas@credix.local','developer','SQ-05'),('maureen.castro@credix.local','developer','SQ-05')) v(email,srole,scode)
  join user_account ua on ua.email=v.email join team_member tm on tm.user_id=ua.id join squad s on s.code=v.scode and s.tenant_id=T;
  insert into squad_member (tenant_id, squad_id, member_id, squad_role, allocation_pct)
  select T, s.id, tm.id, 'developer', v.pct from (values ('SQ-01',60),('SQ-05',40)) v(scode,pct)
  join squad s on s.code=v.scode and s.tenant_id=T join user_account ua on ua.email='squads@credix.local' join team_member tm on tm.user_id=ua.id;
end $$;

do $$
declare T uuid := 'c5d2f057-6262-4275-8ba9-16d9617ce128'; fab uuid;
begin
  perform setseed(0.42);
  select id into fab from user_account where email='fabiola.rodriguez@credix.local';
  insert into member_skill (tenant_id, member_id, skill_id, level)
  select T, m.id, s.id, 1+floor(random()*5)::int from team_member m
  cross join lateral (select id from skill where tenant_id=T order by md5(m.id::text||id::text) limit (3+floor(random()*3)::int)) s
  where m.tenant_id=T and not exists (select 1 from member_skill ms where ms.member_id=m.id);
  insert into member_evaluation (tenant_id, member_id, period, performance_score, empathy_score, eval_type, strengths, development_areas, evaluator_user_id)
  select T, m.id, p.period, round((3.2+random()*1.6)::numeric,1), round((3.2+random()*1.6)::numeric,1), 'general',
    (array['Fuerte dominio tecnico','Colaboracion y mentoria','Entrega consistente','Orientacion a calidad','Pensamiento de arquitectura'])[1+floor(random()*5)::int],
    (array['Profundizar en observabilidad','Mejorar estimacion de backlog','Documentacion tecnica','Comunicacion con negocio','Automatizacion de pruebas'])[1+floor(random()*5)::int], fab
  from team_member m cross join (values ('2026-Q1'),('2026-Q2')) p(period)
  where m.tenant_id=T and not exists (select 1 from member_evaluation me where me.member_id=m.id);
  insert into member_expertise (tenant_id, member_id, entity_type, entity_id, level)
  select T, m.id, 'configuration_item', ci.id, 1+floor(random()*5)::int from team_member m
  cross join lateral (select id from configuration_item where tenant_id=T order by md5(m.id::text||id::text||'e') limit (1+floor(random()*2)::int)) ci
  where m.tenant_id=T and m.discipline in ('Backend','Frontend','Arquitectura','QA','Datos','Producto','UX')
    and not exists (select 1 from member_expertise mx where mx.member_id=m.id);
end $$;

-- ===== 4.4 asset_assignment (20 CIs principales) =====
do $$
declare T uuid := 'c5d2f057-6262-4275-8ba9-16d9617ce128';
begin
  insert into asset_assignment (tenant_id, entity_type, entity_id, po_member_id, ux_member_id, dev_member_id, weight)
  select T, 'configuration_item', ci.id,
    (select tm.id from squad_member sm join team_member tm on tm.id=sm.member_id where sm.squad_role='product_owner' order by md5(ci.id::text||tm.id::text) limit 1),
    (select tm.id from squad_member sm join team_member tm on tm.id=sm.member_id where sm.squad_role='analyst' order by md5(ci.id::text||tm.id::text) limit 1),
    (select tm.id from squad_member sm join team_member tm on tm.id=sm.member_id where sm.squad_role='developer' order by md5(ci.id::text||tm.id::text) limit 1), 1
  from configuration_item ci where ci.tenant_id=T and ci.code in
   ('CI-SAC','CI-CALIFICADOR','CI-MOTOR-DECISIONES','CI-SOCKET-PRISMA','CI-PASARELA-PAGO','CI-MICREDIX-APP','CI-MICREDIX-WEB',
    'CI-AUTOCARTERA','CI-TRASIEGO','CI-ORIGINACION','CI-METAMAP','CI-GRAVITEE','CI-AWS','CI-FLIP-APP','CI-CDC',
    'CI-MICOMERCIO','CI-INCONCERT','CI-DWH','CI-VPOS','CI-CREDIXPAY');
end $$;
