-- Fonctionnalités 0.6 : affectation, rappels avancés, pièces jointes, coûts, garanties, corbeille.
-- À exécuter après 0001 à 0004.

alter table public.actions
  add column if not exists assigned_profile_id uuid references public.profiles(id),
  add column if not exists notify_lead_days integer not null default 0,
  add column if not exists overdue_repeat_days integer not null default 0,
  add column if not exists last_notified_on date,
  add column if not exists checklist jsonb not null default '[]'::jsonb;

alter table public.entities
  add column if not exists warranty_until date,
  add column if not exists warranty_notified_on date;

alter table public.logs
  add column if not exists cost numeric(10, 2),
  add column if not exists checklist_done jsonb not null default '[]'::jsonb;

create table if not exists public.action_mutes (
  profile_id uuid not null references public.profiles(id),
  action_id uuid not null references public.actions(id),
  muted boolean not null default true,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (profile_id, action_id)
);

create table if not exists public.attachments (
  id uuid primary key,
  owner_type text not null check (owner_type in ('entity', 'action', 'log')),
  owner_id uuid not null,
  title text not null default '',
  storage_path text not null,
  mime_type text not null default '',
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.push_subscriptions
  add column if not exists label text not null default '',
  add column if not exists last_seen timestamptz not null default now();

drop trigger if exists touch_action_mutes on public.action_mutes;
create trigger touch_action_mutes before insert or update on public.action_mutes
for each row execute function public.set_updated_at();

drop trigger if exists touch_attachments on public.attachments;
create trigger touch_attachments before insert or update on public.attachments
for each row execute function public.set_updated_at();

create index if not exists action_mutes_updated_idx on public.action_mutes (updated_at);
create index if not exists attachments_owner_idx on public.attachments (owner_type, owner_id);
create index if not exists attachments_updated_idx on public.attachments (updated_at);
create index if not exists actions_assigned_idx on public.actions (assigned_profile_id);

alter table public.action_mutes enable row level security;
alter table public.attachments enable row level security;

drop policy if exists authenticated_all on public.action_mutes;
create policy authenticated_all on public.action_mutes
  for all to authenticated using (true) with check (true);

drop policy if exists authenticated_all on public.attachments;
create policy authenticated_all on public.attachments
  for all to authenticated using (true) with check (true);

insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false)
on conflict (id) do nothing;

drop policy if exists attachments_authenticated on storage.objects;
create policy attachments_authenticated on storage.objects
  for all to authenticated
  using (bucket_id = 'attachments')
  with check (bucket_id = 'attachments');
