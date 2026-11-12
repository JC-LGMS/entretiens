-- Description libre d'une action.
-- À exécuter sur une base existante après 0001_init.sql, 0002_archive.sql et 0003_annual_dates.sql.

alter table public.actions
  add column if not exists description text not null default '';
