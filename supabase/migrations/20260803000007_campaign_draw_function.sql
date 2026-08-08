-- Atomic random draw: locks the campaign row, picks min(reward_count,
-- eligible published reports) winners at random, refuses to run at all
-- if fewer reward codes are loaded than winners needed (no silent
-- partial draw), pairs winners to codes via arrays for guaranteed 1:1
-- positional correctness, and closes the campaign. service_role only —
-- called from the campaign-draw Edge Function, gated there by an admin
-- secret since there's no staff-auth/moderation console yet.
create or replace function public.perform_campaign_draw(p_campaign_id uuid)
returns table (out_claim_id uuid, out_report_id uuid, out_reward_code text, out_value_amount numeric, out_currency text)
language plpgsql
set search_path = public
as $$
declare
  v_campaign campaigns%rowtype;
  v_eligible int;
  v_available int;
  v_target int;
  v_claim_ids uuid[];
  v_report_ids uuid[];
  v_code_ids uuid[];
  i int;
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
    join reports r on r.id = cc.report_id
    where cc.campaign_id = p_campaign_id and cc.status = 'active' and r.status = 'published'
    order by random()
    limit v_campaign.reward_count
  ) s;

  v_eligible := coalesce(array_length(v_claim_ids, 1), 0);

  select array_agg(id) into v_code_ids
  from (
    select id from reward_codes
    where campaign_id = p_campaign_id and status = 'available'
    order by random()
    limit v_eligible
  ) s;

  v_available := coalesce(array_length(v_code_ids, 1), 0);

  if v_available < v_eligible then
    raise exception 'not enough reward codes loaded: need %, have %', v_eligible, v_available;
  end if;

  v_target := v_eligible;

  for i in 1..v_target loop
    update reward_codes set status = 'assigned', assigned_claim_id = v_claim_ids[i]
    where id = v_code_ids[i];
    update campaign_claims set status = 'won', won_at = now()
    where id = v_claim_ids[i];
  end loop;

  update campaigns set status = 'closed' where id = p_campaign_id;

  return query
  select v_claim_ids[gs], v_report_ids[gs], rc.code, rc.value_amount, rc.currency
  from generate_series(1, v_target) gs
  join reward_codes rc on rc.id = v_code_ids[gs];
end;
$$;

revoke all on function public.perform_campaign_draw(uuid) from public, anon, authenticated;
grant execute on function public.perform_campaign_draw(uuid) to service_role;
