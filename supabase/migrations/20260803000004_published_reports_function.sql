-- PostgREST serializes `geography` columns as raw WKB hex by default,
-- which isn't useful to a browser client. This unpacks lng/lat as plain
-- doubles instead. Deliberately SECURITY INVOKER (the default for a plain
-- function, stated explicitly here) — unlike the public-views mistake
-- earlier, this must NOT bypass RLS: it runs as the calling role, so
-- anon's existing "published or moderator" policy and column grants on
-- reports still apply exactly as they do for a direct table select.
create or replace function public.published_reports(p_country_slug text)
returns table (
  id uuid, category report_category, severity report_severity, description text,
  lng double precision, lat double precision, accuracy_m numeric,
  level1_id uuid, level2_id uuid, ward_id uuid,
  status publication_status, lifecycle report_lifecycle, created_at timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  select r.id, r.category, r.severity, r.description,
    ST_X(r.geom::geometry) as lng, ST_Y(r.geom::geometry) as lat, r.accuracy_m,
    r.level1_id, r.level2_id, r.ward_id, r.status, r.lifecycle, r.created_at
  from reports r
  join countries c on c.id = r.country_id
  where c.url_slug = p_country_slug and r.status = 'published'
  order by r.created_at desc;
$$;

grant execute on function public.published_reports(text) to anon, authenticated;
