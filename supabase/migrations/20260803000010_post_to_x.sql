-- Auto-post to X when a report is published, per the "on moderator
-- approval" trigger point (matches the same status the platform itself
-- treats as safe to show publicly — no separate, weaker gate for public
-- broadcast). Fires on both direct-publish (non-sensitive categories)
-- and a future moderator action that flips pending -> published, since
-- both are just an UPDATE/INSERT on reports.status.
create extension if not exists pg_net;

alter table public.reports add column posted_to_x_at timestamptz;
alter table public.reports add column x_tweet_id text;

-- The shared secret the trigger sends and the post-to-x Edge Function
-- checks lives in Vault, not in this file — see the accompanying ops
-- note for the one-off `vault.create_secret` call. Never hardcode a
-- secret value in a migration; migration files are committed to git.
create or replace function public.notify_report_published()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_secret text;
begin
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    select decrypted_secret into v_secret
    from vault.decrypted_secrets where name = 'post_to_x_secret';

    if v_secret is not null then
      perform net.http_post(
        url := 'https://nafziuempbvrexpmehet.supabase.co/functions/v1/post-to-x',
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-post-secret', v_secret),
        body := jsonb_build_object('report_id', new.id)
      );
    end if;
  end if;
  return new;
end;
$$;

create trigger reports_notify_published
after insert or update on public.reports
for each row execute function public.notify_report_published();
