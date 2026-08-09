-- Seeds centroid coordinates (regional-capital approximations, same
-- approach as the Nigerian state capitals in 20260803000017) for Kenya's
-- 47 counties and Ghana's 16 regions, so nearest_admin_level1() can
-- auto-detect a reporter's county/region the same way it already does
-- for Nigerian states. Without this, Ghana/Kenya reporters fall back to
-- the alphabetically-first admin_level1 row regardless of where they are.
update public.admin_level1 a
set centroid = ST_SetSRID(ST_MakePoint(s.lng, s.lat), 4326)::geography
from public.countries c, (values
  ('baringo', 35.7422, 0.4936), ('bomet', 35.3411, -0.7813), ('bungoma', 34.5606, 0.5635),
  ('busia', 34.1115, 0.4608), ('elgeyo-marakwet', 35.5081, 0.6733), ('embu', 37.4500, -0.5310),
  ('garissa', 39.6583, -0.4569), ('homa-bay', 34.4571, -0.5273), ('isiolo', 37.5822, 0.3546),
  ('kajiado', 36.7820, -1.8517), ('kakamega', 34.7519, 0.2827), ('kericho', 35.2831, -0.3677),
  ('kiambu', 36.8356, -1.1714), ('kilifi', 39.8499, -3.6305), ('kirinyaga', 37.2833, -0.5000),
  ('kisii', 34.7680, -0.6817), ('kisumu', 34.7680, -0.0917), ('kitui', 38.0106, -1.3667),
  ('kwale', 39.4522, -4.1747), ('laikipia', 37.0667, 0.0167), ('lamu', 40.9020, -2.2717),
  ('machakos', 37.2634, -1.5177), ('makueni', 37.6333, -1.7833), ('mandera', 41.8670, 3.9366),
  ('marsabit', 37.9899, 2.3284), ('meru', 37.6500, 0.0500), ('migori', 34.4731, -1.0634),
  ('mombasa', 39.6682, -4.0435), ('muranga', 37.1500, -0.7833), ('nairobi', 36.8219, -1.2921),
  ('nakuru', 36.0800, -0.3031), ('nandi', 35.1050, 0.2033), ('narok', 35.8667, -1.0833),
  ('nyamira', 34.9358, -0.5633), ('nyandarua', 36.3833, -0.2667), ('nyeri', 36.9500, -0.4200),
  ('samburu', 36.7000, 1.1000), ('siaya', 34.2881, 0.0607), ('taita-taveta', 38.5560, -3.3960),
  ('tana-river', 40.0333, -1.5000), ('tharaka-nithi', 37.6333, -0.3333), ('trans-nzoia', 35.0062, 1.0157),
  ('turkana', 35.6000, 3.1167), ('uasin-gishu', 35.2698, 0.5143), ('vihiga', 34.7167, 0.0833),
  ('wajir', 40.0667, 1.7500), ('west-pokot', 35.1119, 1.2394)
) as s(code, lng, lat)
where c.iso3 = 'KEN' and a.country_id = c.id and a.code = s.code;

update public.admin_level1 a
set centroid = ST_SetSRID(ST_MakePoint(s.lng, s.lat), 4326)::geography
from public.countries c, (values
  ('ahafo', -2.5178, 6.8022), ('ashanti', -1.6244, 6.6885), ('bono', -2.3268, 7.3399),
  ('bono-east', -1.9394, 7.5911), ('central', -1.2466, 5.1053), ('eastern', -0.2591, 6.0940),
  ('greater-accra', -0.1870, 5.6037), ('north-east', -0.3708, 10.5270), ('northern', -0.8393, 9.4008),
  ('oti', 0.1833, 8.0667), ('savannah', -1.8167, 9.0833), ('upper-east', -0.8514, 10.7856),
  ('upper-west', -2.5099, 10.0601), ('volta', 0.4708, 6.6111), ('western', -1.7554, 4.9346),
  ('western-north', -2.4864, 6.2069)
) as s(code, lng, lat)
where c.iso3 = 'GHA' and a.country_id = c.id and a.code = s.code;
