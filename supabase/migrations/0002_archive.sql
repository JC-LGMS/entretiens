-- Archivage des entités et des actions.
-- À exécuter sur une base existante après 0001_init.sql.

alter table public.entities
  add column if not exists archived boolean not null default false;

alter table public.actions
  add column if not exists archived boolean not null default false;
