-- Single source of truth for geofence distance math, shared by every
-- write path that needs it (broken-systems reports now, election reports
-- later) rather than duplicated per Edge Function.
create or replace function public.geofence_distance_m(
  lng1 double precision, lat1 double precision,
  lng2 double precision, lat2 double precision
)
returns double precision
language sql
immutable
as $$
  select ST_Distance(
    ST_SetSRID(ST_MakePoint(lng1, lat1), 4326)::geography,
    ST_SetSRID(ST_MakePoint(lng2, lat2), 4326)::geography
  );
$$;
