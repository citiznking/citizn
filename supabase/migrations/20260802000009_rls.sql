-- Reference/public data: open to everyone. Nothing reporter-adjacent lives here.
alter table countries enable row level security;
create policy "public read" on countries for select using (true);

alter table admin_level1 enable row level security;
create policy "public read" on admin_level1 for select using (true);

alter table admin_level2 enable row level security;
create policy "public read" on admin_level2 for select using (true);

alter table wards enable row level security;
create policy "public read" on wards for select using (true);

alter table elections enable row level security;
create policy "public read" on elections for select using (true);

alter table polling_units enable row level security;
create policy "public read" on polling_units for select using (true);

alter table parties enable row level security;
create policy "public read" on parties for select using (true);

alter table budget_sources enable row level security;
create policy "public read" on budget_sources for select using (true);

alter table lga_allocations enable row level security;
create policy "public read" on lga_allocations for select using (true);

alter table state_budget_lines enable row level security;
create policy "public read" on state_budget_lines for select using (true);

-- Reporter-adjacent tables: no anon/public policy at all. The public reads
-- these exclusively through the v_* views (public_views migration), which
-- already filter to published rows and drop sensitive columns. Direct
-- table access is staff-only (moderation queue needs pending rows too).
alter table reports enable row level security;
create policy "moderators read all" on reports for select using (is_moderator());

alter table report_media enable row level security;
create policy "moderators read all" on report_media for select using (is_moderator());

alter table lifecycle_events enable row level security;
create policy "moderators read all" on lifecycle_events for select using (is_moderator());

alter table election_reports enable row level security;
create policy "moderators read all" on election_reports for select using (is_moderator());

alter table result_entries enable row level security;
create policy "moderators read all" on result_entries for select using (is_moderator());

alter table incident_details enable row level security;
create policy "moderators read all" on incident_details for select using (is_moderator());

-- Ops tables: no public policy. rate_limits has no policy at all (service
-- role only, via Edge Functions). Moderators may see their own row.
alter table moderators enable row level security;
create policy "self read" on moderators for select using (user_id = auth.uid());

alter table moderation_actions enable row level security;
create policy "moderators read all" on moderation_actions for select using (is_moderator());

alter table rate_limits enable row level security;

-- No INSERT/UPDATE/DELETE policies exist anywhere in this migration set.
-- All writes go through Edge Functions using the service_role key, which
-- bypasses RLS entirely — this is intentional, not an oversight.
