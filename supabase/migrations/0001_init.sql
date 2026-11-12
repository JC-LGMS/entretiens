-- Schéma partagé : un seul compte d'accès, des profils déclaratifs.
-- Tous les utilisateurs authentifiés voient et modifient toutes les données.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key,
  name text not null,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.entities (
  id uuid primary key,
  kind text not null check (kind in ('equipement', 'plante', 'administratif')),
  name text not null,
  notes text not null default '',
  photo_path text,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.actions (
  id uuid primary key,
  entity_id uuid not null references public.entities(id),
  label text not null,
  interval_value integer not null check (interval_value > 0),
  interval_unit text not null check (interval_unit in ('day', 'week', 'month', 'year')),
  last_done date,
  next_due date not null,
  active boolean not null default true,
  notified_for date,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.logs (
  id uuid primary key,
  action_id uuid not null references public.actions(id),
  done_on date not null,
  comment text not null default '',
  created_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.history (
  id uuid primary key,
  entity_id uuid not null references public.entities(id),
  action_id uuid references public.actions(id),
  profile_id uuid references public.profiles(id),
  kind text not null,
  summary text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.profile_mutes (
  profile_id uuid not null references public.profiles(id),
  entity_id uuid not null references public.entities(id),
  muted boolean not null default true,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (profile_id, entity_id)
);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

drop trigger if exists touch_profiles on public.profiles;
create trigger touch_profiles before insert or update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists touch_entities on public.entities;
create trigger touch_entities before insert or update on public.entities
for each row execute function public.set_updated_at();

drop trigger if exists touch_actions on public.actions;
create trigger touch_actions before insert or update on public.actions
for each row execute function public.set_updated_at();

drop trigger if exists touch_logs on public.logs;
create trigger touch_logs before insert or update on public.logs
for each row execute function public.set_updated_at();

drop trigger if exists touch_history on public.history;
create trigger touch_history before insert or update on public.history
for each row execute function public.set_updated_at();

drop trigger if exists touch_profile_mutes on public.profile_mutes;
create trigger touch_profile_mutes before insert or update on public.profile_mutes
for each row execute function public.set_updated_at();

create index if not exists actions_due_idx
  on public.actions (next_due)
  where deleted_at is null and active;
create index if not exists actions_entity_idx on public.actions (entity_id);
create index if not exists actions_updated_idx on public.actions (updated_at);
create index if not exists logs_action_idx on public.logs (action_id, done_on desc);
create index if not exists logs_updated_idx on public.logs (updated_at);
create index if not exists history_entity_idx on public.history (entity_id, created_at desc);
create index if not exists history_updated_idx on public.history (updated_at);
create index if not exists entities_updated_idx on public.entities (updated_at);
create index if not exists profiles_updated_idx on public.profiles (updated_at);
create index if not exists profile_mutes_updated_idx on public.profile_mutes (updated_at);

alter table public.profiles enable row level security;
alter table public.entities enable row level security;
alter table public.actions enable row level security;
alter table public.logs enable row level security;
alter table public.history enable row level security;
alter table public.profile_mutes enable row level security;
alter table public.push_subscriptions enable row level security;

drop policy if exists authenticated_all on public.profiles;
create policy authenticated_all on public.profiles
  for all to authenticated using (true) with check (true);

drop policy if exists authenticated_all on public.entities;
create policy authenticated_all on public.entities
  for all to authenticated using (true) with check (true);

drop policy if exists authenticated_all on public.actions;
create policy authenticated_all on public.actions
  for all to authenticated using (true) with check (true);

drop policy if exists authenticated_all on public.logs;
create policy authenticated_all on public.logs
  for all to authenticated using (true) with check (true);

drop policy if exists authenticated_all on public.history;
create policy authenticated_all on public.history
  for all to authenticated using (true) with check (true);

drop policy if exists authenticated_all on public.profile_mutes;
create policy authenticated_all on public.profile_mutes
  for all to authenticated using (true) with check (true);

drop policy if exists authenticated_all on public.push_subscriptions;
create policy authenticated_all on public.push_subscriptions
  for all to authenticated using (true) with check (true);

insert into storage.buckets (id, name, public)
values ('photos', 'photos', false)
on conflict (id) do nothing;

drop policy if exists photos_authenticated on storage.objects;
create policy photos_authenticated on storage.objects
  for all to authenticated
  using (bucket_id = 'photos')
  with check (bucket_id = 'photos');
