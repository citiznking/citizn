-- The report detail page needs to know whether a report has already
-- posted to X (to embed from there instead of serving media directly
-- off Supabase — see the cost discussion this was built for). Public
-- and harmless like the rest of a published report's columns.
grant select (x_tweet_id) on public.reports to anon, authenticated;
