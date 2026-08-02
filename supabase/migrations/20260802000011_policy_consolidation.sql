-- Postgres grants EXECUTE to the PUBLIC pseudo-role by default, which
-- anon inherits regardless of an explicit per-role REVOKE. Revoke from
-- PUBLIC directly, then re-grant only to the role that actually needs it.
revoke execute on function public.is_moderator() from public;
grant execute on function public.is_moderator() to authenticated;

-- Consolidate the two permissive SELECT policies on each table into one:
-- Postgres evaluates every permissive policy on a query, so two policies
-- that are only ever OR'd together is pure overhead over one.
drop policy "moderators read all" on reports;
drop policy "public read published" on reports;
create policy "read published or moderator" on reports
  for select using (status = 'published' or is_moderator());

drop policy "moderators read all" on election_reports;
drop policy "public read published" on election_reports;
create policy "read published or moderator" on election_reports
  for select using (status = 'published' or is_moderator());

drop policy "moderators read all" on report_media;
drop policy "public read published parent" on report_media;
create policy "read published or moderator" on report_media
  for select using (
    is_moderator() or exists (
      select 1 from reports r where r.id = report_media.report_id and r.status = 'published'
    )
  );

drop policy "moderators read all" on lifecycle_events;
drop policy "public read published parent" on lifecycle_events;
create policy "read published or moderator" on lifecycle_events
  for select using (
    is_moderator() or exists (
      select 1 from reports r where r.id = lifecycle_events.report_id and r.status = 'published'
    )
  );

drop policy "moderators read all" on result_entries;
drop policy "public read published parent" on result_entries;
create policy "read published or moderator" on result_entries
  for select using (
    is_moderator() or exists (
      select 1 from election_reports er where er.id = result_entries.election_report_id and er.status = 'published'
    )
  );

drop policy "moderators read all" on incident_details;
drop policy "public read published parent" on incident_details;
create policy "read published or moderator" on incident_details
  for select using (
    is_moderator() or exists (
      select 1 from election_reports er where er.id = incident_details.election_report_id and er.status = 'published'
    )
  );
