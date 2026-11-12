-- Dates fixes dans l'année (par exemple 1er mars et 15 octobre).
-- À exécuter sur une base existante après 0001_init.sql et 0002_archive.sql.

alter table public.actions
  add column if not exists annual_dates jsonb not null default '[]'::jsonb;
