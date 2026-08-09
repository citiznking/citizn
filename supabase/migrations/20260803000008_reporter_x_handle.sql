-- Optional self-disclosure: a reporter can attach their X handle so a
-- future auto-post-to-X feature can @-mention them, driving organic
-- reach via reposts. Unlike everything else in this schema, this is
-- meant to be public — the point is visibility, not anonymity.
--
-- violence/police_issue are excluded (defense in depth, mirrors
-- enforce_reports_moderation_gate): those categories exist specifically
-- to let someone flag police misconduct or insecurity without being
-- personally identifiable, and a public @-mention on that exact report
-- is the retaliation risk the anonymity model is built to prevent.
alter table public.reports add column reporter_x_handle text;

alter table public.reports add constraint reporter_x_handle_format
  check (reporter_x_handle is null or reporter_x_handle ~ '^[A-Za-z0-9_]{1,15}$');

create or replace function public.enforce_reports_moderation_gate()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.category in ('violence', 'police_issue') then
    new.requires_human_mod := true;
    new.reporter_x_handle := null;
    if new.status = 'published' then
      raise exception 'violence/police_issue reports must be inserted as pending and go through moderation';
    end if;
  end if;
  return new;
end;
$$;

grant select (reporter_x_handle) on public.reports to anon, authenticated;

drop function if exists public.published_reports(text);
create function public.published_reports(p_country_slug text)
returns table (
  id uuid, category report_category, severity report_severity, description text,
  lng double precision, lat double precision, accuracy_m numeric,
  level1_id uuid, level2_id uuid, ward_id uuid, campaign_id uuid, reporter_x_handle text,
  status publication_status, lifecycle report_lifecycle, created_at timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  select r.id, r.category, r.severity, r.description,
    ST_X(r.geom::geometry) as lng, ST_Y(r.geom::geometry) as lat, r.accuracy_m,
    r.level1_id, r.level2_id, r.ward_id, r.campaign_id, r.reporter_x_handle,
    r.status, r.lifecycle, r.created_at
  from reports r
  join countries c on c.id = r.country_id
  where c.url_slug = p_country_slug and r.status = 'published'
  order by r.created_at desc;
$$;

grant execute on function public.published_reports(text) to anon, authenticated;
