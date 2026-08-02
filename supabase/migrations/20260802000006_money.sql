create type budget_source_method as enum ('scrape', 'manual', 'api');

create table budget_sources (
  id uuid primary key default gen_random_uuid(),
  platform text not null,
  url text,
  retrieved_at timestamptz not null,
  method budget_source_method not null
);

create table lga_allocations (
  id uuid primary key default gen_random_uuid(),
  level2_id uuid not null references admin_level2(id) on delete cascade,
  month date not null,
  gross_amount numeric not null,
  net_amount numeric not null,
  source_id uuid not null references budget_sources(id),
  unique (level2_id, month, source_id)
);

create index lga_allocations_level2_month_idx on lga_allocations (level2_id, month);

create table state_budget_lines (
  id uuid primary key default gen_random_uuid(),
  level1_id uuid not null references admin_level1(id) on delete cascade,
  fiscal_year integer not null,
  sector report_category not null,
  line_item text not null,
  approved_amount numeric not null,
  source_id uuid not null references budget_sources(id)
);

create index state_budget_lines_level1_year_idx on state_budget_lines (level1_id, fiscal_year);
