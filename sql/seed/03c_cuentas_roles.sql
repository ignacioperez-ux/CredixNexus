-- FASE 3 · Grupo C — cuentas de usuario y roles (tenant CREDIX)
-- Rename de 5 cuentas ancla (ids/emails/usernames intactos) + 27 cuentas nuevas + user_role.
-- NOTA: user_role requiere DISABLE/ENABLE trg_audit_user_role (bug latente del ledger:
--       audit_row_change asume new.tenant_id, ausente en user_role). Ver tasks/lessons.md.
do $$
declare T uuid := 'c5d2f057-6262-4275-8ba9-16d9617ce128';
begin
update user_account set full_name='Andres Gonzalez' where email='operador@credix.local';
update user_account set full_name='Juan Pacheco'     where email='squads@credix.local';
update user_account set full_name='Tomas Alvarado'   where email='usuario@credix.local';
update user_account set full_name='Daniel Blohm'     where email='evolucion@credix.local';
update user_account set full_name='Giselle Arias'    where email='operaciones@credix.local';

insert into user_account (tenant_id, email, username, full_name, password_auth_disabled)
select T, v.email, v.email, v.fname, true from (values
 ('Fabiola Rodriguez','fabiola.rodriguez@credix.local'),('Julieth Hernandez','julieth.hernandez@credix.local'),
 ('Jonathan Cordero','jonathan.cordero@credix.local'),('Tatiana Hernandez','tatiana.hernandez@credix.local'),
 ('Keila Andrade','keila.andrade@credix.local'),('Beatriz Vargas','beatriz.vargas@credix.local'),
 ('Michael Venegas','michael.venegas@credix.local'),('Kevin Chacon','kevin.chacon@credix.local'),
 ('Stefano Quiros','stefano.quiros@credix.local'),('Miguel Cabrera','miguel.cabrera@credix.local'),
 ('Adriana Duran','adriana.duran@credix.local'),('Pedro Maestre','pedro.maestre@credix.local'),
 ('Jai Yu Wu','jai.wu@credix.local'),
 ('Elena Pacheco','elena.pacheco@credix.local'),('Oscar Fernandez','oscar.fernandez@credix.local'),
 ('Karol Castillo','karol.castillo@credix.local'),('Lerryns Perez','lerryns.perez@credix.local'),
 ('Melissa Rojas','melissa.rojas@credix.local'),('Pablo Calderon','pablo.calderon@credix.local'),
 ('Luis Armando Perez','luisarmando.perez@credix.local'),('Marco Vargas','marco.vargas@credix.local'),
 ('Sergio Tirado','sergio.tirado@credix.local'),('Oscar Rodriguez','oscar.rodriguez@credix.local'),
 ('Andrey Solano','andrey.solano@credix.local'),('Claudia Ordaz','claudia.ordaz@credix.local'),
 ('Lizeth Rodriguez','lizeth.rodriguez@credix.local'),('Alejandro Ramirez','alejandro.ramirez@credix.local')
) v(fname,email);

alter table public.user_role disable trigger trg_audit_user_role;

insert into user_role (user_id, role_id)
select ua.id, r.id from (values
 ('fabiola.rodriguez@credix.local','squad_member'),('julieth.hernandez@credix.local','squad_member'),
 ('jonathan.cordero@credix.local','squad_member'),('tatiana.hernandez@credix.local','squad_member'),
 ('keila.andrade@credix.local','squad_member'),('beatriz.vargas@credix.local','squad_member'),
 ('michael.venegas@credix.local','squad_member'),('kevin.chacon@credix.local','squad_member'),
 ('stefano.quiros@credix.local','squad_member'),('miguel.cabrera@credix.local','squad_member'),
 ('adriana.duran@credix.local','squad_member'),('pedro.maestre@credix.local','squad_member'),
 ('jai.wu@credix.local','squad_member'),
 ('elena.pacheco@credix.local','responsable_comercial'),('oscar.fernandez@credix.local','responsable_comercial'),
 ('karol.castillo@credix.local','responsable_comercial'),('lerryns.perez@credix.local','responsable_comercial'),
 ('melissa.rojas@credix.local','responsable_comercial'),('pablo.calderon@credix.local','responsable_comercial'),
 ('luisarmando.perez@credix.local','responsable_comercial'),('marco.vargas@credix.local','responsable_comercial'),
 ('sergio.tirado@credix.local','responsable_comercial'),('oscar.rodriguez@credix.local','responsable_comercial'),
 ('andrey.solano@credix.local','responsable_comercial'),('claudia.ordaz@credix.local','responsable_comercial'),
 ('lizeth.rodriguez@credix.local','responsable_comercial'),('alejandro.ramirez@credix.local','responsable_comercial')
) v(email,rolecode)
join user_account ua on ua.email=v.email
join role r on r.code=v.rolecode;

insert into user_role (user_id, role_id)
select ua.id, r.id from user_account ua, role r
where ua.email='operaciones@credix.local' and r.code='responsable_comercial'
  and not exists (select 1 from user_role ur where ur.user_id=ua.id and ur.role_id=r.id);

alter table public.user_role enable trigger trg_audit_user_role;

if (select count(*) from user_account) <> 33 then raise exception 'user_account != 33'; end if;
if (select count(*) from user_role) <> 35 then raise exception 'user_role != 35'; end if;
end $$;
