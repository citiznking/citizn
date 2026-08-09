-- Activates Ghana for reporting (reversing the original spec's "Ghana
-- launches later entirely" decision, per explicit instruction) and seeds
-- Kenya's 47 counties + Ghana's 16 regions — both stable, well-documented
-- lists (Kenya's unchanged since the 2010 constitution; Ghana's since the
-- 2019 six-region split), unlike Nigeria's LGAs/wards/PUs which the
-- original spec correctly refused to hand-seed due to volume/precision.
-- Neither country gets money/elections features — that stays Nigeria-only
-- per spec, this is reporting only.
update public.countries set active = true, features = '{"reporting": true, "money": false, "elections": false}'::jsonb
where iso3 = 'GHA';

insert into public.admin_level1 (country_id, name, code, label)
select c.id, s.name, s.code, 'County'
from public.countries c, (values
  ('Baringo','baringo'),('Bomet','bomet'),('Bungoma','bungoma'),('Busia','busia'),
  ('Elgeyo-Marakwet','elgeyo-marakwet'),('Embu','embu'),('Garissa','garissa'),('Homa Bay','homa-bay'),
  ('Isiolo','isiolo'),('Kajiado','kajiado'),('Kakamega','kakamega'),('Kericho','kericho'),
  ('Kiambu','kiambu'),('Kilifi','kilifi'),('Kirinyaga','kirinyaga'),('Kisii','kisii'),
  ('Kisumu','kisumu'),('Kitui','kitui'),('Kwale','kwale'),('Laikipia','laikipia'),
  ('Lamu','lamu'),('Machakos','machakos'),('Makueni','makueni'),('Mandera','mandera'),
  ('Marsabit','marsabit'),('Meru','meru'),('Migori','migori'),('Mombasa','mombasa'),
  ('Murang''a','muranga'),('Nairobi','nairobi'),('Nakuru','nakuru'),('Nandi','nandi'),
  ('Narok','narok'),('Nyamira','nyamira'),('Nyandarua','nyandarua'),('Nyeri','nyeri'),
  ('Samburu','samburu'),('Siaya','siaya'),('Taita-Taveta','taita-taveta'),('Tana River','tana-river'),
  ('Tharaka-Nithi','tharaka-nithi'),('Trans Nzoia','trans-nzoia'),('Turkana','turkana'),
  ('Uasin Gishu','uasin-gishu'),('Vihiga','vihiga'),('Wajir','wajir'),('West Pokot','west-pokot')
) as s(name, code)
where c.iso3 = 'KEN';

insert into public.admin_level1 (country_id, name, code, label)
select c.id, s.name, s.code, 'Region'
from public.countries c, (values
  ('Ahafo','ahafo'),('Ashanti','ashanti'),('Bono','bono'),('Bono East','bono-east'),
  ('Central','central'),('Eastern','eastern'),('Greater Accra','greater-accra'),
  ('North East','north-east'),('Northern','northern'),('Oti','oti'),('Savannah','savannah'),
  ('Upper East','upper-east'),('Upper West','upper-west'),('Volta','volta'),
  ('Western','western'),('Western North','western-north')
) as s(name, code)
where c.iso3 = 'GHA';
