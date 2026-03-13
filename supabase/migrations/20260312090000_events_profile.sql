create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  url text,
  image_url text,
  location_name text,
  location_address text,
  city text not null,
  lat numeric,
  lng numeric,
  start_date date,
  end_date date,
  start_time time,
  end_time time,
  recurring text,
  age_min int default 0,
  age_max int default 18,
  cost_type text default 'unknown' check (cost_type in ('free', 'paid', 'unknown')),
  cost_amount numeric,
  tags text[] default '{}',
  source text default 'ai' check (source in ('ai', 'manual', 'user')),
  confidence text default 'low' check (confidence in ('high', 'medium', 'low')),
  is_verified boolean default false,
  discovery_area text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

create index if not exists idx_events_city on public.events(city);
create index if not exists idx_events_start_date on public.events(start_date);
create index if not exists idx_events_discovery_area on public.events(discovery_area);
create index if not exists idx_events_tags on public.events using gin(tags);

create unique index if not exists idx_events_dedup
  on public.events(title, start_date, city)
  where start_date is not null;

alter table public.events enable row level security;

drop policy if exists "Anyone can read events" on public.events;
create policy "Anyone can read events" on public.events
  for select using (true);

create table if not exists public.saved_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id uuid references public.events(id) on delete set null,
  custom_event jsonb,
  list_name text default 'saved' check (list_name in ('saved', 'want_to_try', 'done')),
  notes text,
  created_at timestamptz not null default now(),
  constraint saved_events_has_ref check (event_id is not null or custom_event is not null)
);

create index if not exists idx_saved_events_user_id on public.saved_events(user_id);
create index if not exists idx_saved_events_list_name on public.saved_events(list_name);

alter table public.saved_events enable row level security;

drop policy if exists "Users manage own saved events" on public.saved_events;
create policy "Users manage own saved events" on public.saved_events
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.custom_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  location_name text,
  location_address text,
  day_of_week text,
  start_time time,
  end_time time,
  recurrence_text text,
  notes text,
  is_active boolean default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_custom_sources_user_id on public.custom_sources(user_id);
create index if not exists idx_custom_sources_active on public.custom_sources(is_active);

alter table public.custom_sources enable row level security;

drop policy if exists "Users manage own sources" on public.custom_sources;
create policy "Users manage own sources" on public.custom_sources
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.event_discovery_runs (
  id uuid primary key default gen_random_uuid(),
  area text not null,
  ran_at timestamptz not null default now(),
  events_found int default 0,
  events_new int default 0,
  status text default 'ok',
  error_message text
);

create index if not exists idx_event_discovery_runs_area on public.event_discovery_runs(area);
create index if not exists idx_event_discovery_runs_ran_at on public.event_discovery_runs(ran_at desc);
