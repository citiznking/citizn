create table moderators (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'moderator' check (role in ('moderator', 'admin')),
  created_at timestamptz not null default now()
);

create table moderation_actions (
  id uuid primary key default gen_random_uuid(),
  moderator_id uuid not null references moderators(user_id),
  target_table text not null check (target_table in ('reports', 'election_reports')),
  target_id uuid not null,
  action text not null check (action in ('approve', 'reject', 'flag', 'remove')),
  reason text,
  created_at timestamptz not null default now()
);

create index moderation_actions_target_idx on moderation_actions (target_table, target_id);

create table rate_limits (
  session_hash text not null,
  scope text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (session_hash, scope, window_start)
);

-- Helper used throughout RLS policies to gate staff-only reads.
create or replace function public.is_moderator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from moderators where user_id = auth.uid()
  );
$$;
