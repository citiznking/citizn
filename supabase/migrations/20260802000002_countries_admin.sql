create table countries (
  id uuid primary key default gen_random_uuid(),
  iso3 text not null unique,
  name text not null,
  url_slug text not null unique,
  active boolean not null default false,
  features jsonb not null default '{"reporting": false, "money": false, "elections": false}'::jsonb,
  created_at timestamptz not null default now()
);

create table admin_level1 (
  id uuid primary key default gen_random_uuid(),
  country_id uuid not null references countries(id) on delete cascade,
  name text not null,
  code text,
  label text not null default 'State',
  created_at timestamptz not null default now(),
  unique (country_id, name)
);

create table admin_level2 (
  id uuid primary key default gen_random_uuid(),
  level1_id uuid not null references admin_level1(id) on delete cascade,
  name text not null,
  code text,
  label text not null default 'LGA',
  created_at timestamptz not null default now(),
  unique (level1_id, name)
);

create table wards (
  id uuid primary key default gen_random_uuid(),
  level2_id uuid not null references admin_level2(id) on delete cascade,
  name text not null,
  code text,
  created_at timestamptz not null default now(),
  unique (level2_id, name)
);

create index admin_level1_country_id_idx on admin_level1 (country_id);
create index admin_level2_level1_id_idx on admin_level2 (level1_id);
create index wards_level2_id_idx on wards (level2_id);
