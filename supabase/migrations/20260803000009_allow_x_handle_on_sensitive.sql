-- Reverses the reporter_x_handle stripping added in 000008 for
-- violence/police_issue. Whether to self-identify (or tag a
-- pseudonymous X account) on a sensitive report is the reporter's
-- informed choice, not this system's to make for them — the frontend
-- now requires an explicit risk acknowledgment before sending a handle
-- on those categories instead.
create or replace function public.enforce_reports_moderation_gate()
returns trigger
language plpgsql
set search_path = public
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
