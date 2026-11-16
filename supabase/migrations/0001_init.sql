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
  warranty_until date,
  warranty_notified_on date,
  archived boolean not null default false,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.actions (
  id uuid primary key,
  entity_id uuid not null references public.entities(id),
  label text not null,
  description text not null default '',
  assigned_profile_id uuid references public.profiles(id),
  interval_value integer not null check (interval_value > 0),
  interval_unit text not null check (interval_unit in ('day', 'week', 'month', 'year')),
  last_done date,
  next_due date not null,
  active boolean not null default true,
  archived boolean not null default false,
  annual_dates jsonb not null default '[]'::jsonb,
  notify_lead_days integer not null default 0,
  overdue_repeat_days integer not null default 0,
  last_notified_on date,
  checklist jsonb not null default '[]'::jsonb,
  notified_for date,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.logs (
  id uuid primary key,
  action_id uuid not null references public.actions(id),
  done_on date not null,
  comment text not null default '',
  cost numeric(10, 2),
  checklist_done jsonb not null default '[]'::jsonb,
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
  label text not null default '',
  last_seen timestamptz not null default now(),
  created_at timestamptz not null default now()
);

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

create table if not exists public.action_templates (
  id uuid primary key,
  label text not null,
  description text not null default '',
  interval_value integer not null default 1 check (interval_value > 0),
  interval_unit text not null default 'year' check (interval_unit in ('day', 'week', 'month', 'year')),
  checklist jsonb not null default '[]'::jsonb,
  sort_order integer not null default 0,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
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

drop trigger if exists touch_action_mutes on public.action_mutes;
create trigger touch_action_mutes before insert or update on public.action_mutes
for each row execute function public.set_updated_at();

drop trigger if exists touch_attachments on public.attachments;
create trigger touch_attachments before insert or update on public.attachments
for each row execute function public.set_updated_at();

drop trigger if exists touch_action_templates on public.action_templates;
create trigger touch_action_templates before insert or update on public.action_templates
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
create index if not exists action_mutes_updated_idx on public.action_mutes (updated_at);
create index if not exists actions_assigned_idx on public.actions (assigned_profile_id);
create index if not exists attachments_owner_idx on public.attachments (owner_type, owner_id);
create index if not exists attachments_updated_idx on public.attachments (updated_at);
create index if not exists action_templates_sort_idx on public.action_templates (sort_order);
create index if not exists action_templates_updated_idx on public.action_templates (updated_at);

alter table public.profiles enable row level security;
alter table public.entities enable row level security;
alter table public.actions enable row level security;
alter table public.logs enable row level security;
alter table public.history enable row level security;
alter table public.profile_mutes enable row level security;
alter table public.action_mutes enable row level security;
alter table public.attachments enable row level security;
alter table public.action_templates enable row level security;
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

drop policy if exists authenticated_all on public.action_mutes;
create policy authenticated_all on public.action_mutes
  for all to authenticated using (true) with check (true);

drop policy if exists authenticated_all on public.attachments;
create policy authenticated_all on public.attachments
  for all to authenticated using (true) with check (true);

drop policy if exists authenticated_all on public.action_templates;
create policy authenticated_all on public.action_templates
  for all to authenticated using (true) with check (true);

drop policy if exists authenticated_all on public.push_subscriptions;
create policy authenticated_all on public.push_subscriptions
  for all to authenticated using (true) with check (true);

insert into storage.buckets (id, name, public)
values ('photos', 'photos', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false)
on conflict (id) do nothing;

drop policy if exists photos_authenticated on storage.objects;
create policy photos_authenticated on storage.objects
  for all to authenticated
  using (bucket_id = 'photos')
  with check (bucket_id = 'photos');

drop policy if exists attachments_authenticated on storage.objects;
create policy attachments_authenticated on storage.objects
  for all to authenticated
  using (bucket_id = 'attachments')
  with check (bucket_id = 'attachments');

insert into public.action_templates (id, label, description, interval_value, interval_unit, checklist, sort_order)
values
  ('a1b2c3d4-0001-4a2b-8c3d-000000000001', 'Vidange', 'Vidange et remplacement des consommables.', 1, 'year', '["Huile","Filtre","Niveaux"]'::jsonb, 10),
  ('a1b2c3d4-0002-4a2b-8c3d-000000000002', 'Taille annuelle', 'Taille d’entretien de la plante.', 1, 'year', '[]'::jsonb, 20),
  ('a1b2c3d4-0003-4a2b-8c3d-000000000003', 'Assurance', 'Renouvellement du contrat.', 1, 'year', '[]'::jsonb, 30),
  ('a1b2c3d4-0004-4a2b-8c3d-000000000004', 'Contrôle technique', 'Contrôle périodique du véhicule.', 2, 'year', '[]'::jsonb, 40),
  ('a1b2c3d4-0005-4a2b-8c3d-000000000005', 'Entretien poêle à granulés', 'Entretien annuel du poêle et de son conduit.', 1, 'year', '["Nettoyer le foyer et le cendrier","Brosser l’échangeur de chaleur","Vérifier le conduit et les joints","Nettoyer le ventilateur","Tester la combustion"]'::jsonb, 50),
  ('a1b2c3d4-0006-4a2b-8c3d-000000000006', 'Entretien pompe à chaleur', 'Entretien périodique de la pompe à chaleur.', 2, 'year', '["Nettoyer ou remplacer les filtres","Contrôler le circuit frigorifique","Vérifier les pressions","Nettoyer l’unité extérieure","Contrôler les connexions électriques"]'::jsonb, 60),
  ('a1b2c3d4-0007-4a2b-8c3d-000000000007', 'Déclaration BIC', 'Déclaration annuelle des bénéfices industriels et commerciaux.', 1, 'year', '["Rassembler les justificatifs","Calculer le bénéfice","Vérifier les charges déductibles","Déclarer en ligne","Archiver la confirmation"]'::jsonb, 70),
  ('a1b2c3d4-0008-4a2b-8c3d-000000000008', 'Déclaration de revenus', 'Déclaration annuelle des revenus.', 1, 'year', '["Rassembler les justificatifs","Vérifier les cases préremplies","Déclarer les revenus et charges","Payer le solde","Archiver l’avis d’imposition"]'::jsonb, 80)
on conflict (id) do nothing;
