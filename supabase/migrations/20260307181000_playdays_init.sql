create extension if not exists pgcrypto;

create table if not exists public.family_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  parent_name text not null,
  email text,
  zip_code text,
  city text,
  profile jsonb not null,
  digest_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.activity_history (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.family_profiles(id) on delete cascade,
  activity_id text not null,
  action text not null check (action in ('done', 'skip', 'saved')),
  slot text not null,
  title text not null,
  payload jsonb not null default '{}'::jsonb,
  happened_at timestamptz not null default now()
);

create table if not exists public.saved_items (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.family_profiles(id) on delete cascade,
  item_type text not null check (item_type in ('activity', 'place')),
  item_id text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.daily_digest_logs (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.family_profiles(id) on delete cascade,
  recipient_email text not null,
  sent_at timestamptz not null default now(),
  status text not null,
  payload jsonb not null default '{}'::jsonb
);
