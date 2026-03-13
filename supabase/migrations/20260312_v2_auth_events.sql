create extension if not exists pgcrypto;

-- Pre-auth prototype rows cannot satisfy auth.users foreign keys.
-- Clean them up before enforcing authenticated ownership.
delete from public.activity_history
where profile_id in (
  select id from public.family_profiles where user_id is null
);

delete from public.saved_items
where profile_id in (
  select id from public.family_profiles where user_id is null
);

delete from public.daily_digest_logs
where profile_id in (
  select id from public.family_profiles where user_id is null
);

delete from public.family_profiles
where user_id is null;

alter table public.family_profiles
  alter column user_id set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'family_profiles_user_id_key'
      and conrelid = 'public.family_profiles'::regclass
  ) then
    alter table public.family_profiles
      add constraint family_profiles_user_id_key unique (user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'family_profiles_user_id_fkey'
      and conrelid = 'public.family_profiles'::regclass
  ) then
    alter table public.family_profiles
      add constraint family_profiles_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade;
  end if;
end $$;

alter table public.family_profiles
  add column if not exists timezone text not null default 'America/Los_Angeles',
  add column if not exists schedule_prefs jsonb not null default '{}'::jsonb,
  add column if not exists activity_prefs jsonb not null default '{}'::jsonb,
  add column if not exists email_prefs jsonb not null default '{"daily_digest": true, "event_reminders": true}'::jsonb;

alter table public.family_profiles enable row level security;
alter table public.activity_history enable row level security;
alter table public.saved_items enable row level security;
alter table public.daily_digest_logs enable row level security;

drop policy if exists "Users manage own profile" on public.family_profiles;
create policy "Users manage own profile" on public.family_profiles
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users manage own history" on public.activity_history;
create policy "Users manage own history" on public.activity_history
  for all
  using (
    profile_id in (
      select id from public.family_profiles where user_id = auth.uid()
    )
  )
  with check (
    profile_id in (
      select id from public.family_profiles where user_id = auth.uid()
    )
  );

drop policy if exists "Users manage own saved items" on public.saved_items;
create policy "Users manage own saved items" on public.saved_items
  for all
  using (
    profile_id in (
      select id from public.family_profiles where user_id = auth.uid()
    )
  )
  with check (
    profile_id in (
      select id from public.family_profiles where user_id = auth.uid()
    )
  );

drop policy if exists "Users see own digest logs" on public.daily_digest_logs;
create policy "Users see own digest logs" on public.daily_digest_logs
  for select
  using (
    profile_id in (
      select id from public.family_profiles where user_id = auth.uid()
    )
  );
