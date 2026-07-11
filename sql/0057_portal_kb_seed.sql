-- 0057_portal_kb_seed.sql
-- Enriquece la base de conocimiento publicada para dar deflection real al Portal de
-- autoservicio interno (/portal). Solo AGREGA articulos demo (aditivo, idempotente por
-- titulo). No modifica ni borra datos existentes. Auditado por trigger (audit_row_change).

do $$
declare
  v_tenant uuid;
  v_article uuid;
  r record;
begin
  for v_tenant in select id from public.tenant loop
    for r in select * from (values
      ('Acceso a VPN y sistemas internos', 'access',
        E'# Acceso a VPN\n\n1. Instala el cliente VPN corporativo.\n2. Ingresa con tu usuario de red y el segundo factor (OTP).\n3. Si el OTP no llega, verifica cobertura y reintenta en 60s.\n4. Si persiste, abre un caso indicando el sistema al que no puedes entrar.',
        'Como conectarte a la VPN y resolver fallas comunes de acceso.',
        array['acceso','vpn','otp','ingreso']),
      ('Pago o transaccion rechazada', 'payments',
        E'# Pago rechazado\n\n1. Confirma el mensaje de error y el codigo devuelto.\n2. Revisa saldo/limite y datos del medio de pago.\n3. Si el codigo es de procesador externo, reintenta en unos minutos.\n4. Si el rechazo se repite, abre un caso con la referencia de la transaccion.',
        'Pasos ante un pago o transaccion rechazada y cuando escalar.',
        array['pago','transaccion','rechazo','procesador']),
      ('Diferencias en conciliacion', 'operations',
        E'# Conciliacion\n\n1. Descarga el reporte del dia y el corte del procesador.\n2. Compara totales por lote y por medio de pago.\n3. Marca las diferencias y su posible causa (timeout, reverso, duplicado).\n4. Abre un caso adjuntando el detalle si la diferencia no cuadra.',
        'Como revisar diferencias de conciliacion antes de escalar.',
        array['conciliacion','cuadre','reporte','diferencia']),
      ('App movil: errores y actualizacion', 'mobile',
        E'# App movil\n\n1. Verifica que tengas la ultima version instalada.\n2. Cierra sesion y vuelve a ingresar.\n3. Limpia cache de la app si el error persiste.\n4. Si el error continua, abre un caso indicando version y modelo del dispositivo.',
        'Solucion de errores frecuentes de la app movil y como reportarlos.',
        array['app','movil','android','ios','version'])
    ) as t(title, category, content, summary, tags)
    loop
      if not exists (
        select 1 from public.knowledge_article
        where tenant_id = v_tenant and title = r.title
      ) then
        insert into public.knowledge_article (tenant_id, title, category, status)
        values (v_tenant, r.title, r.category, 'active')
        returning id into v_article;

        insert into public.knowledge_article_version (tenant_id, article_id, version_number, content_markdown, summary, tags)
        values (v_tenant, v_article, 1, r.content, r.summary, r.tags);
      end if;
    end loop;
  end loop;
end $$;
