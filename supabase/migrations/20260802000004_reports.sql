create type report_category as enum (
  'road', 'hospital', 'school', 'traffic', 'power', 'water', 'sanitation',
  'environmental', 'violence', 'police_issue'
);
create type report_severity as enum ('low', 'medium', 'high', 'critical');
create type publication_status as enum ('pending', 'published', 'flagged', 'removed');
create type report_lifecycle as enum ('reported', 'acknowledged', 'in_progress', 'fixed');
create type lifecycle_actor as enum ('citizen_confirmation', 'moderator');

create table reports (
  id uuid primary key default gen_random_uuid(),
  country_id uuid not null references countries(id) on delete cascade,
  category report_category not null,
  severity report_severity not null,
  description text,
  geom geography(point, 4326) not null,
  accuracy_m numeric,
  level1_id uuid not null references admin_level1(id),
  level2_id uuid not null references admin_level2(id),
  ward_id uuid references wards(id),
  status publication_status not null default 'pending',
  lifecycle report_lifecycle not null default 'reported',
  requires_human_mod boolean not null default false,
  session_hash text not null,
  created_at timestamptz not null default now()
);

create index reports_level2_id_idx on reports (level2_id);
create index reports_status_idx on reports (status);
create index reports_geom_idx on reports using gist (geom);

-- Defense in depth: violence/police_issue reports can never enter the table
-- already published, regardless of what an Edge Function does upstream.
create or replace function public.enforce_reports_moderation_gate()
returns trigger
language plpgsql
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

create trigger reports_moderation_gate
before insert on reports
for each row execute function public.enforce_reports_moderation_gate();

create table report_media (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references reports(id) on delete cascade,
  storage_path text not null,
  sha256 text not null,
  phash text,
  exif_clean boolean not null default false,
  watermarked boolean not null default false,
  safety_score numeric,
  created_at timestamptz not null default now()
);

create index report_media_report_id_idx on report_media (report_id);

create table lifecycle_events (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references reports(id) on delete cascade,
  from_status report_lifecycle,
  to_status report_lifecycle not null,
  evidence_media_id uuid references report_media(id),
  actor lifecycle_actor not null,
  created_at timestamptz not null default now()
);

create index lifecycle_events_report_id_idx on lifecycle_events (report_id);
