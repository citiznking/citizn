-- Edge Functions on this project require the publishable apikey header
-- (see reports/campaign-claim/campaign-draw, all called with it) —
-- pg_net's http_post needs to send it too, alongside the post-secret.
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
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'apikey', 'sb_publishable_fTl2he1Bo2zuPtTMbF5_ew_Osu9oZQe',
          'x-post-secret', v_secret
        ),
        body := jsonb_build_object('report_id', new.id)
      );
    end if;
  end if;
  return new;
end;
$$;
