-- Modèles d'actions partagés par tous les profils et tous les appareils.
-- À exécuter après 0001 à 0005.

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

drop trigger if exists touch_action_templates on public.action_templates;
create trigger touch_action_templates before insert or update on public.action_templates
for each row execute function public.set_updated_at();

create index if not exists action_templates_sort_idx on public.action_templates (sort_order);
create index if not exists action_templates_updated_idx on public.action_templates (updated_at);

alter table public.action_templates enable row level security;

drop policy if exists authenticated_all on public.action_templates;
create policy authenticated_all on public.action_templates
  for all to authenticated using (true) with check (true);

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
