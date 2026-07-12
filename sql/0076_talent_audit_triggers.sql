-- 0076_talent_audit_triggers.sql
-- Audit-grade (§11): toda mutacion de profesionales y sus competencias/experiencia queda
-- en el ledger inmutable. member_evaluation ya tenia trigger; se agregan las 3 faltantes.
-- audit_row_change() usa id + tenant_id (ambos presentes) y maneja INSERT/UPDATE/DELETE.

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_audit_team_member') then
    create trigger trg_audit_team_member after insert or update or delete on public.team_member
      for each row execute function public.audit_row_change();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'trg_audit_member_skill') then
    create trigger trg_audit_member_skill after insert or update or delete on public.member_skill
      for each row execute function public.audit_row_change();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'trg_audit_member_expertise') then
    create trigger trg_audit_member_expertise after insert or update or delete on public.member_expertise
      for each row execute function public.audit_row_change();
  end if;
end $$;
