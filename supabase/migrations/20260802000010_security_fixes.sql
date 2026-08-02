-- Corrects issues found by `supabase db advisors` against migrations
-- 000002-000009. The v_* views ran with the view-owner's privileges
-- (Postgres treats plain views as implicitly SECURITY DEFINER for
-- permission checks), which bypasses the base tables' RLS entirely and
-- was flagged ERROR by the linter. Postgres RLS is row-level only, so
-- hiding session_hash and election_reports' precise coordinates from
-- anon/authenticated requires column-level GRANTs, not a view.

drop view if exists public.v_reports;
drop view if exists public.v_report_media;
drop view if exists public.v_lifecycle_events;
drop view if exists public.v_election_reports;
drop view if exists public.v_result_entries;
drop view if exists public.v_incident_details;

-- reports: published rows are public, but session_hash never is, for any
-- role reachable via PostgREST (anon or authenticated). Moderation reads
-- that need session_hash (e.g. velocity checks) go through Edge Functions
-- using the service_role key, which bypasses grants and RLS entirely.
create policy "public read published" on reports
  for select using (status = 'published');

revoke select on reports from anon, authenticated;
grant select (
  id, country_id, category, severity, description,
  geom, accuracy_m, level1_id, level2_id, ward_id,
  status, lifecycle, created_at
) on reports to anon, authenticated;

create policy "public read published parent" on report_media
  for select using (exists (
    select 1 from reports r where r.id = report_media.report_id and r.status = 'published'
  ));

create policy "public read published parent" on lifecycle_events
  for select using (exists (
    select 1 from reports r where r.id = lifecycle_events.report_id and r.status = 'published'
  ));

-- election_reports: same pattern, plus geom/accuracy_m are excluded even
-- for published rows. That is the coarsening the threat model requires —
-- public location context comes from pu_id (-> ward -> LGA), never the
-- precise capture-time fix.
create policy "public read published" on election_reports
  for select using (status = 'published');

revoke select on election_reports from anon, authenticated;
grant select (
  id, election_id, type, pu_id, captured_at, submitted_at, status, corroboration_count
) on election_reports to anon, authenticated;

create policy "public read published parent" on result_entries
  for select using (exists (
    select 1 from election_reports er where er.id = result_entries.election_report_id and er.status = 'published'
  ));

create policy "public read published parent" on incident_details
  for select using (exists (
    select 1 from election_reports er where er.id = incident_details.election_report_id and er.status = 'published'
  ));

-- Function search_path hardening (was flagged mutable).
create or replace function public.enforce_reports_moderation_gate()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.category in ('violence', 'police_issue') then
    new.requires_human_mod := true;
    if new.status = 'published' then
      raise exception 'violence/police_issue reports must be inserted as pending and go through moderation';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.enforce_election_reports_moderation_gate()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.type = 'incident' and new.status = 'published' then
    raise exception 'incident reports must be inserted as pending and go through moderation';
  end if;
  return new;
end;
$$;

-- Note: public.spatial_ref_sys (PostGIS system table, static SRID
-- reference data, zero application data) is flagged by the linter for
-- missing RLS, but it's owned by the postgis extension/superuser — this
-- project role can't ALTER it. Known, accepted, unfixable-by-us finding
-- for any Supabase+PostGIS project; leaving as-is.

-- is_moderator() returning false to anon leaks nothing, but there's no
-- reason for anon to call it either.
revoke execute on function public.is_moderator() from anon;

-- Perf: avoid re-evaluating auth.uid() per row.
drop policy "self read" on moderators;
create policy "self read" on moderators
  for select using (user_id = (select auth.uid()));
