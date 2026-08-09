-- Multi-submission qualification + first-N-vs-raffle reward mode +
-- network-provider selection at redemption.
--
-- A claim used to belong to exactly one report. Now a campaign can
-- require N qualifying submissions before anyone is eligible at all, so
-- a claim belongs to a (campaign, session) pair instead — session_hash
-- is the same one-way hash already used for rate limiting, never
-- reversible to a real identity, so this doesn't weaken the anonymity
-- model, it reuses its existing trust boundary.

alter table public.campaigns
  add column min_submissions int not null default 1,
  add column reward_mode text not null default 'raffle' check (reward_mode in ('raffle', 'first_n'));

-- report_id was "the one report this claim is for"; now it's just "the
-- report that happened to trigger qualification", kept for audit only —
-- deleting that one report (of possibly several contributing ones)
-- should never take the claim down with it.
alter table public.campaign_claims drop constraint if exists campaign_claims_report_id_key;
alter table public.campaign_claims alter column report_id drop not null;
alter table public.campaign_claims
  drop constraint if exists campaign_claims_report_id_fkey,
  add constraint campaign_claims_report_id_fkey foreign key (report_id) references public.reports(id) on delete set null;
alter table public.campaign_claims add column session_hash text;

create table public.campaign_progress (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  session_hash text not null,
  submission_count int not null default 0,
  claim_id uuid references public.campaign_claims(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, session_hash)
);
alter table public.campaign_progress enable row level security;
revoke all on public.campaign_progress from anon, authenticated;

-- Network providers vary by country (Nigeria: MTN/Airtel/Glo/9mobile;
-- other countries get their own list later) — nothing sensitive here,
-- public read like campaigns.
create table public.network_providers (
  id uuid primary key default gen_random_uuid(),
  country_id uuid not null references public.countries(id) on delete cascade,
  name text not null,
  code text not null,
  created_at timestamptz not null default now(),
  unique (country_id, code)
);
alter table public.network_providers enable row level security;
create policy "public read network providers" on public.network_providers for select using (true);
grant select on public.network_providers to anon, authenticated;

insert into public.network_providers (country_id, name, code)
select id, v.name, v.code
from public.countries, (values
  ('MTN', 'mtn'), ('Airtel', 'airtel'), ('Glo', 'glo'), ('9mobile', '9mobile')
) as v(name, code)
where countries.url_slug = 'Nig';

-- reward_codes get loaded by ops per network (e.g. a batch of MTN pins,
-- a batch of Glo pins) — nullable because not every redemption_method
-- is network-specific (e.g. a future crypto_payout code isn't).
alter table public.reward_codes add column network_provider_id uuid references public.network_providers(id);

-- perform_campaign_draw no longer pre-assigns a specific code — it can't
-- know which network a winner wants before they redeem. It now only
-- marks claims 'won'; code assignment (network-matched) happens at
-- redemption in campaign-claim.
drop function if exists public.perform_campaign_draw(uuid);
create function public.perform_campaign_draw(p_campaign_id uuid)
returns table (out_claim_id uuid, out_report_id uuid)
language plpgsql
set search_path = public
as $$
declare
  v_campaign campaigns%rowtype;
  v_target int;
  v_claim_ids uuid[];
  v_report_ids uuid[];
begin
  select * into v_campaign from campaigns where id = p_campaign_id for update;
  if not found then
    raise exception 'campaign not found';
  end if;
  if v_campaign.status <> 'active' then
    raise exception 'campaign is not active';
  end if;

  select array_agg(claim_id), array_agg(rid) into v_claim_ids, v_report_ids
  from (
    select cc.id as claim_id, cc.report_id as rid
    from campaign_claims cc
    where cc.campaign_id = p_campaign_id and cc.status = 'active'
    order by random()
    limit v_campaign.reward_count
  ) s;

  v_target := coalesce(array_length(v_claim_ids, 1), 0);

  update campaign_claims set status = 'won', won_at = now()
  where id = any(v_claim_ids);

  update campaigns set status = 'closed' where id = p_campaign_id;

  return query
  select v_claim_ids[gs], v_report_ids[gs]
  from generate_series(1, v_target) gs;
end;
$$;

-- Atomic "claim a slot right now if one's open" for reward_mode =
-- first_n — called the moment a claim is minted (i.e. the moment
-- someone crosses min_submissions). Locking the campaign row serializes
-- concurrent qualifiers so two people can never win the same last slot.
-- Unlike the raffle path, this only marks 'won' too — no code
-- assignment yet, same reasoning (network unknown until redemption).
create or replace function public.claim_first_n_slot(p_campaign_id uuid, p_claim_id uuid)
returns boolean
language plpgsql
set search_path = public
as $$
declare
  v_campaign campaigns%rowtype;
  v_won_count int;
begin
  select * into v_campaign from campaigns where id = p_campaign_id for update;
  if not found or v_campaign.status <> 'active' or v_campaign.reward_mode <> 'first_n' then
    return false;
  end if;

  select count(*) into v_won_count
  from campaign_claims
  where campaign_id = p_campaign_id and status in ('won', 'redeemed');

  if v_won_count >= v_campaign.reward_count then
    return false;
  end if;

  update campaign_claims set status = 'won', won_at = now() where id = p_claim_id;
  return true;
end;
$$;

revoke all on function public.perform_campaign_draw(uuid) from public, anon, authenticated;
grant execute on function public.perform_campaign_draw(uuid) to service_role;
revoke all on function public.claim_first_n_slot(uuid, uuid) from public, anon, authenticated;
grant execute on function public.claim_first_n_slot(uuid, uuid) to service_role;
