-- Auto-selects the reporter's state from their device location instead
-- of defaulting to alphabetically-first ("Abia") regardless of where
-- they actually are — a real bug, not a style choice.
--
-- Uses each state capital's coordinates as a "nearest state" proxy, not
-- true geometric centroids or actual boundaries — deliberately, for two
-- reasons: (1) capital coordinates are well-established and verifiable,
-- unlike precise administrative boundaries, which is exactly why LGA/PU
-- boundary data was NOT hand-seeded in 000012; nearest-state-by-point is
-- a much lower-stakes approximation that only picks a helpful default
-- the reporter can still override from the dropdown, not something that
-- gates eligibility. (2) Doing this as a local nearest-match keeps the
-- reporter's coordinates inside Supabase rather than sending them to a
-- third-party reverse-geocoding API, consistent with the existing "no
-- third-party beacons on reporting pages" posture.
alter table public.admin_level1 add column centroid geography(point, 4326);

update public.admin_level1 set centroid = v.pt::geography from (values
  ('abia', 'SRID=4326;POINT(7.4864 5.5265)'), ('adamawa', 'SRID=4326;POINT(12.4954 9.2035)'),
  ('akwa-ibom', 'SRID=4326;POINT(7.9128 5.0377)'), ('anambra', 'SRID=4326;POINT(7.0690 6.2120)'),
  ('bauchi', 'SRID=4326;POINT(9.8437 10.3103)'), ('bayelsa', 'SRID=4326;POINT(6.2676 4.9267)'),
  ('benue', 'SRID=4326;POINT(8.5391 7.7322)'), ('borno', 'SRID=4326;POINT(13.1500 11.8333)'),
  ('cross-river', 'SRID=4326;POINT(8.3417 4.9757)'), ('delta', 'SRID=4326;POINT(6.7346 6.1987)'),
  ('ebonyi', 'SRID=4326;POINT(8.1137 6.3248)'), ('edo', 'SRID=4326;POINT(5.6037 6.3350)'),
  ('ekiti', 'SRID=4326;POINT(5.2214 7.6211)'), ('enugu', 'SRID=4326;POINT(7.5086 6.5244)'),
  ('gombe', 'SRID=4326;POINT(11.1673 10.2897)'), ('imo', 'SRID=4326;POINT(7.0351 5.4840)'),
  ('jigawa', 'SRID=4326;POINT(9.3389 11.7563)'), ('kaduna', 'SRID=4326;POINT(7.4383 10.5222)'),
  ('kano', 'SRID=4326;POINT(8.5920 12.0022)'), ('katsina', 'SRID=4326;POINT(7.6018 12.9908)'),
  ('kebbi', 'SRID=4326;POINT(4.1975 12.4539)'), ('kogi', 'SRID=4326;POINT(6.7333 7.8023)'),
  ('kwara', 'SRID=4326;POINT(4.5426 8.4966)'), ('lagos', 'SRID=4326;POINT(3.3515 6.6018)'),
  ('nasarawa', 'SRID=4326;POINT(8.5168 8.4939)'), ('niger', 'SRID=4326;POINT(6.5569 9.6139)'),
  ('ogun', 'SRID=4326;POINT(3.3619 7.1475)'), ('ondo', 'SRID=4326;POINT(5.2058 7.2571)'),
  ('osun', 'SRID=4326;POINT(4.5567 7.7719)'), ('oyo', 'SRID=4326;POINT(3.9470 7.3775)'),
  ('plateau', 'SRID=4326;POINT(8.8583 9.8965)'), ('rivers', 'SRID=4326;POINT(7.0498 4.8156)'),
  ('sokoto', 'SRID=4326;POINT(5.2476 13.0059)'), ('taraba', 'SRID=4326;POINT(11.3667 8.8833)'),
  ('yobe', 'SRID=4326;POINT(11.9608 11.7469)'), ('zamfara', 'SRID=4326;POINT(6.6641 12.1704)'),
  ('fct', 'SRID=4326;POINT(7.3986 9.0765)')
) as v(code, pt)
where admin_level1.code = v.code;

create or replace function public.nearest_admin_level1(p_country_slug text, p_lat double precision, p_lng double precision)
returns table (id uuid, name text)
language sql
stable
set search_path = public
as $$
  select l.id, l.name
  from admin_level1 l
  join countries c on c.id = l.country_id
  where c.url_slug = p_country_slug and l.centroid is not null
  order by l.centroid <-> ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
  limit 1;
$$;

grant execute on function public.nearest_admin_level1(text, double precision, double precision) to anon, authenticated;
