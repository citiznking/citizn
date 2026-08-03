-- Atomic check-and-increment so concurrent requests from the same session
-- in the same window can't both read a stale count and both pass (a plain
-- select-then-upsert from the Edge Function would race).
create or replace function public.check_and_increment_rate_limit(
  p_session_hash text, p_scope text, p_window_start timestamptz, p_max_count integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_count integer;
begin
  insert into rate_limits (session_hash, scope, window_start, count)
  values (p_session_hash, p_scope, p_window_start, 1)
  on conflict (session_hash, scope, window_start)
  do update set count = rate_limits.count + 1
  returning count into current_count;

  return current_count <= p_max_count;
end;
$$;

revoke execute on function public.check_and_increment_rate_limit(text, text, timestamptz, integer) from public;
grant execute on function public.check_and_increment_rate_limit(text, text, timestamptz, integer) to service_role;
