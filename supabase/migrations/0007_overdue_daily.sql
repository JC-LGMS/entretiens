-- Une action en retard est relancée tous les jours quand les notifications sont activées.
-- La relance reste configurable, mais ne peut plus être désactivée (minimum 1 jour).

alter table public.actions alter column overdue_repeat_days set default 1;

update public.actions set overdue_repeat_days = 1 where overdue_repeat_days < 1;
