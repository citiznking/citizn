create type race_type as enum ('pres', 'nass', 'gov', 'shoa');

create table elections (
  id uuid primary key default gen_random_uuid(),
  country_id uuid not null references countries(id) on delete cascade,
  slug text not null,
  name text not null,
  dates jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (country_id, slug)
);

create table polling_units (
  id uuid primary key default gen_random_uuid(),
  country_id uuid not null references countries(id) on delete cascade,
  ward_id uuid not null references wards(id) on delete cascade,
  official_pu_code text not null,
  name text not null,
  geom geography(point, 4326),
  geom_source text,
  geofence_radius_m integer not null default 50,
  low_confidence_location boolean not null default false,
  created_at timestamptz not null default now(),
  unique (country_id, official_pu_code)
);

create index polling_units_ward_id_idx on polling_units (ward_id);
create index polling_units_geom_idx on polling_units using gist (geom);

create table parties (
  code text not null,
  race_type race_type not null,
  name text not null,
  active boolean not null default true,
  primary key (code, race_type)
);
