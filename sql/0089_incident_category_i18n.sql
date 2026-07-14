-- 0089_incident_category_i18n.sql
-- i18n del maestro incident_category (categorias del portal "Explora por categoria"): antes solo
-- tenia nombre en espanol. Se agrega name_en y se traducen las 16 categorias por code.

alter table public.incident_category add column if not exists name_en varchar(120);

update public.incident_category ic set name_en = v.en from (values
  ('ACCESS',              'Access / Identity'),
  ('APPLICATION',         'Applications'),
  ('DATA_QUALITY',        'Data Quality'),
  ('UNRECOGNIZED_CHARGE', 'Unrecognized charge'),
  ('RECONCILIATION',      'Reconciliation / Data'),
  ('DISPUTE',             'Dispute'),
  ('DUPLICATE_CHARGE',    'Duplicate charge'),
  ('OPERATIONAL_RISK',    'Operational risk event'),
  ('API_FAILURE',         'API / processor failure'),
  ('INFRASTRUCTURE',      'Infrastructure'),
  ('ONBOARDING',          'Onboarding / Origination'),
  ('PAYMENT_NOT_APPLIED', 'Payment not applied'),
  ('PAYMENTS',            'Payments'),
  ('CUSTOMER_COMPLAINT',  'Customer complaint'),
  ('SECURITY',            'Security'),
  ('FRAUD_SUSPICION',     'Suspected fraud')
) as v(code, en) where ic.code = v.code and ic.name_en is null;
