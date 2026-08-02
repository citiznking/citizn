create type election_report_type as enum ('inec_arrival', 'result_upload', 'incident');
create type incident_category as enum ('violence', 'vote_buying', 'intimidation', 'materials_missing', 'other');

create table election_reports (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references elections(id) on delete cascade,
  type election_report_type not null,
  pu_id uuid not null references polling_units(id),
  geom geography(point, 4326) not null,
  accuracy_m numeric,
  captured_at timestamptz not null,
  submitted_at timestamptz not null default now(),
  status publication_status not null default 'pending',
  corroboration_count integer not null default 0,
  session_hash text not null
);

create index election_reports_pu_id_idx on election_reports (pu_id);
create index election_reports_election_type_status_idx on election_reports (election_id, type, status);

-- Defense in depth: incident reports can never enter the table already
-- published; arrival check-ins and result uploads may auto-publish.
create or replace function public.enforce_election_reports_moderation_gate()
returns trigger
language plpgsql
as $$
begin
  if new.type = 'incident' and new.status = 'published' then
    raise exception 'incident reports must be inserted as pending and go through moderation';
  end if;
  return new;
end;
$$;

create trigger election_reports_moderation_gate
before insert on election_reports
for each row execute function public.enforce_election_reports_moderation_gate();

create table result_entries (
  id uuid primary key default gen_random_uuid(),
  election_report_id uuid not null references election_reports(id) on delete cascade,
  race_type race_type not null,
  party_code text not null,
  votes integer not null check (votes >= 0),
  registered_voters integer,
  accredited integer,
  foreign key (party_code, race_type) references parties(code, race_type)
);

create index result_entries_election_report_id_idx on result_entries (election_report_id);

create table incident_details (
  election_report_id uuid primary key references election_reports(id) on delete cascade,
  category incident_category not null,
  note varchar(280)
);
