-- Bug found while testing: the WITH ... SELECT and the subsequent UPDATE
-- were two separate plpgsql statements, so the "matching" CTE from the
-- first didn't exist for the second (CTEs don't persist across
-- statement boundaries) — corroboration_count silently stayed 0 for
-- everyone. Fixed by collecting matching ids into an array first.
create or replace function public.compute_result_corroboration(p_election_report_id uuid)
returns int
language plpgsql
set search_path = public
as $$
declare
  v_pu_id uuid;
  v_race race_type;
  v_signature text;
  v_matching_ids uuid[];
  v_count int;
begin
  select pu_id into v_pu_id from election_reports where id = p_election_report_id;

  select re.race_type into v_race from result_entries re
  where re.election_report_id = p_election_report_id limit 1;
  if v_race is null then return 0; end if;

  select string_agg(party_code || ':' || votes, ',' order by party_code)
    into v_signature
  from result_entries
  where election_report_id = p_election_report_id and race_type = v_race;

  select array_agg(er.id) into v_matching_ids
  from election_reports er
  where er.pu_id = v_pu_id and er.type = 'result_upload'
    and (
      select string_agg(re.party_code || ':' || re.votes, ',' order by re.party_code)
      from result_entries re
      where re.election_report_id = er.id and re.race_type = v_race
    ) = v_signature;

  v_count := coalesce(array_length(v_matching_ids, 1), 0);

  update election_reports set corroboration_count = v_count where id = any(v_matching_ids);

  return v_count;
end;
$$;
