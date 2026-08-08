-- Thematic reporting campaigns (e.g. "Vandals") that cut across the
-- existing report categories, plus an anonymity-preserving reward
-- mechanism: a random draw among published reports, with winners proven
-- by a claim token the reporter alone holds — never by anything the
-- server can use to re-identify who submitted what.

create type campaign_status as enum ('active', 'closed');
create type campaign_redemption_method as enum ('voucher_code', 'crypto_payout');
create type campaign_claim_status as enum ('active', 'won', 'redeemed', 'expired');
create type reward_code_status as enum ('available', 'assigned', 'redeemed');

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  country_id uuid not null references public.countries(id) on delete cascade,
  slug text not null,
  name text not null,
  description text,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  status campaign_status not null default 'active',
  reward_count int not null default 0,
  reward_value_amount numeric,
  reward_currency text,
  redemption_method campaign_redemption_method not null default 'voucher_code',
  created_at timestamptz not null default now(),
  unique (country_id, slug)
);

alter table public.reports add column campaign_id uuid references public.campaigns(id);
create index reports_campaign_id_idx on public.reports (campaign_id);

-- Claim tokens are generated server-side from 256 bits of randomness
-- (not derived from anything the reporter typed), so unlike session_hash
-- they don't need a secret salt to resist offline guessing — the token
-- itself already has enough entropy. Only the hash is ever stored; the
-- raw token is returned once, at submission time, and the reporter is
-- responsible for keeping it. There is deliberately no way to look up a
-- claim by report_id, session_hash, or anything else the server holds —
-- that's what keeps a gift from becoming a deanonymization vector.
create table public.campaign_claims (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  report_id uuid not null references public.reports(id) on delete cascade unique,
  token_hash text not null unique,
  status campaign_claim_status not null default 'active',
  created_at timestamptz not null default now(),
  won_at timestamptz,
  redeemed_at timestamptz
);
create index campaign_claims_campaign_id_idx on public.campaign_claims (campaign_id);
create index campaign_claims_status_idx on public.campaign_claims (status);

-- Reward codes are loaded by ops ahead of a draw (e.g. bulk-purchased
-- airtime/voucher PINs) and assigned 1:1 to a winning claim. Redemption
-- method is on the campaign row so a future 'crypto_payout' campaign can
-- reuse the same claim/draw machinery without a redesign.
create table public.reward_codes (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  code text not null unique,
  value_amount numeric,
  currency text,
  status reward_code_status not null default 'available',
  assigned_claim_id uuid references public.campaign_claims(id),
  created_at timestamptz not null default now(),
  redeemed_at timestamptz
);
create index reward_codes_campaign_id_idx on public.reward_codes (campaign_id);
create index reward_codes_status_idx on public.reward_codes (status);

-- campaigns: fully public, nothing sensitive in it.
alter table public.campaigns enable row level security;
create policy "public read campaigns" on public.campaigns for select using (true);
grant select on public.campaigns to anon, authenticated;

-- campaign_id joins a report to a campaign; safe to expose like the rest
-- of a published report's columns (see 000010 for why reports uses an
-- explicit column grant instead of a blanket one).
grant select (campaign_id) on public.reports to anon, authenticated;

-- campaign_claims and reward_codes are never reachable via PostgREST —
-- RLS is on with no policies (default deny), and there's no grant at
-- all, so even a future permissive policy alone wouldn't expose them.
-- All access is through Edge Functions on the service_role key, which
-- bypasses RLS/grants entirely, same pattern as session_hash reads.
alter table public.campaign_claims enable row level security;
revoke all on public.campaign_claims from anon, authenticated;

alter table public.reward_codes enable row level security;
revoke all on public.reward_codes from anon, authenticated;

-- Extend the anon-facing read RPC with campaign_id so the frontend can
-- filter a campaign page down to that campaign's published reports.
create or replace function public.published_reports(p_country_slug text)
returns table (
  id uuid, category report_category, severity report_severity, description text,
  lng double precision, lat double precision, accuracy_m numeric,
  level1_id uuid, level2_id uuid, ward_id uuid, campaign_id uuid,
  status publication_status, lifecycle report_lifecycle, created_at timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  select r.id, r.category, r.severity, r.description,
    ST_X(r.geom::geometry) as lng, ST_Y(r.geom::geometry) as lat, r.accuracy_m,
    r.level1_id, r.level2_id, r.ward_id, r.campaign_id, r.status, r.lifecycle, r.created_at
  from reports r
  join countries c on c.id = r.country_id
  where c.url_slug = p_country_slug and r.status = 'published'
  order by r.created_at desc;
$$;

grant execute on function public.published_reports(text) to anon, authenticated;

-- Example campaign so the frontend has something real to point at.
insert into public.campaigns (country_id, slug, name, description, reward_count, redemption_method)
select id, 'vandals', 'Vandals',
  'Report vandalized public infrastructure — road signs, power lines, school property, transformers, and more.',
  10, 'voucher_code'
from public.countries where url_slug = 'Nig';
