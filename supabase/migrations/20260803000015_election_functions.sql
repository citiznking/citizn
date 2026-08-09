-- Election-day support functions. All service_role-only, called from
-- the election Edge Functions (never exposed to anon/authenticated).

-- Encapsulates the PU lookup + distance/radius comparison in one call so
-- the Edge Functions never need to parse a geography column themselves
-- (PostgREST's representation of geography via a plain select is
-- ambiguous/version-dependent — doing it all in SQL sidesteps that).
create or replace function public.election_geofence_check(
  p_pu_id uuid, p_lat double precision, p_lng double precision, p_accuracy_m numeric
)
returns table (within_fence boolean, distance_m double precision)
language sql
stable
set search_path = public
as $$
  select
    ST_Distance(pu.geom, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography)
      <= greatest(pu.geofence_radius_m, p_accuracy_m),
    ST_Distance(pu.geom, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography)
  from polling_units pu
  where pu.id = p_pu_id;
$$;

-- Presence-based corroboration for arrival check-ins: every independent
-- check-in at a PU corroborates every other one, so the count is just
-- how many exist.
create or replace function public.compute_checkin_corroboration(p_pu_id uuid)
returns void
language sql
set search_path = public
as $$
  update election_reports
  set corroboration_count = (
    select count(*) from election_reports er2 where er2.pu_id = p_pu_id and er2.type = 'inec_arrival'
  )
  where pu_id = p_pu_id and type = 'inec_arrival';
$$;

-- Agreement-based corroboration for results: only independent
-- submissions reporting the SAME vote tallies for the SAME race at the
-- SAME PU corroborate each other — matching the spec's "k-of-n matching
-- result figures" model, not mere presence (conflicting result sets for
-- one PU must stay visibly separate, never auto-merged).
create or replace function public.compute_result_corroboration(p_election_report_id uuid)
returns int
language plpgsql
set search_path = public
as $$
declare
  v_pu_id uuid;
  v_race race_type;
  v_signature text;
  v_count int;
begin
  select pu_id into v_pu_id from election_reports where id = p_election_report_id;

  select re.race_type into v_race from result_entries re
  where re.election_report_id = p_election_report_id limit 1;
  if v_race is null then return 0; end if;

  select string_agg(party_code || ':' || votes, ',' order by party_code)
    into v_signature
  from result_entries
  where election_report_id = p_election_report_id and race_type = v_race;

  with matching as (
    select er.id
    from election_reports er
    where er.pu_id = v_pu_id and er.type = 'result_upload'
      and (
        select string_agg(re.party_code || ':' || re.votes, ',' order by re.party_code)
        from result_entries re
        where re.election_report_id = er.id and re.race_type = v_race
      ) = v_signature
  )
  select count(*) into v_count from matching;

  update election_reports set corroboration_count = v_count where id in (select id from matching);

  return v_count;
end;
$$;

revoke execute on function public.election_geofence_check(uuid, double precision, double precision, numeric) from public, anon, authenticated;
grant execute on function public.election_geofence_check(uuid, double precision, double precision, numeric) to service_role;
revoke execute on function public.compute_checkin_corroboration(uuid) from public, anon, authenticated;
grant execute on function public.compute_checkin_corroboration(uuid) to service_role;
revoke execute on function public.compute_result_corroboration(uuid) from public, anon, authenticated;
grant execute on function public.compute_result_corroboration(uuid) to service_role;
