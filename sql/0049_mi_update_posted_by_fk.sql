-- 0049_mi_update_posted_by_fk.sql
-- Fix: el detalle del incidente mayor embebe poster:posted_by(full_name), pero
-- major_incident_update.posted_by no tenia FK a user_account, por lo que PostgREST
-- no podia resolver la relacion (Runtime Error "Could not find a relationship...").
-- Agregamos la FK (posted_by contiene ids de user_account).

update public.major_incident_update u
   set posted_by = null
 where posted_by is not null
   and not exists (select 1 from public.user_account ua where ua.id = u.posted_by);

alter table public.major_incident_update
  add constraint major_incident_update_posted_by_fkey
  foreign key (posted_by) references public.user_account(id) on delete set null;
