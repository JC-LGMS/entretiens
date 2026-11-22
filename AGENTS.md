# AGENTS.md

## État

Application complète et configurée (Supabase, Cloudflare, sauvegarde). Le détail d'installation est dans `README.md`.

## Commandes

- `npm install`
- `npm run dev` — service worker désactivé.
- `npm run build && npm run preview` — obligatoire pour tester la PWA, le hors ligne et le push.
- `npm run check` — Svelte + TypeScript, doit rester à 0 erreur.
- `npm test` — Vitest en environnement node.
- Un seul test : `npx vitest run src/lib/dates.test.ts`.
- `npm run version:bump -- "description"` — incrémente la version de 0,1 (0.5 → 0.6) et ajoute une entrée au changelog. Le hook `pre-commit` installé par `prepare` le fait automatiquement quand le commit touche `src/` (message via `VERSION_MESSAGE` ou valeur par défaut).

## Architecture

- Svelte 5 avec runes (`$state`, `$derived`, `$effect`) ; l'état global est dans `src/lib/state.svelte.ts`.
- Routage par hash maison dans `src/lib/router.svelte.ts` : `#/` = planning (accueil), `#/entities`, `#/entity/<id>?action=<id>`, `#/profiles`, `#/profile/<id>`, `#/settings`, `#/trash`.
- Dexie est la source de vérité locale (`src/lib/db.ts`, schéma v3), Supabase est le backend.
- `src/lib/sync.ts` détecte les conflits avant le pull, puis pousse l'outbox et tire les changements par curseur `updated_at`. Les conflits sont stockés dans `conflicts` et résolus depuis `SyncDialog` ; `App.svelte` affiche une bannière d'alerte qui ouvre directement ce dialogue.
- `src/sw.ts` gère le push et le silence par profil ; `src/lib/theme.ts` gère le thème par appareil ; `src/lib/pwa.ts` gère la mise à jour PWA (prompt + bouton).
- Le thème est toujours appliqué explicitement (`data-theme` = `light` ou `dark`, `color-scheme: only light|dark`) ; le mode « système » résout la préférence et écoute les changements.
- `src/lib/version.ts` expose la version (format 0.x) et le changelog ; `src/components/Icon.svelte` contient les icônes SVG de navigation et les icônes `edit` / `trash`.
- Les actions ont deux modes : intervalle (`interval_value` / `interval_unit`) ou dates fixes annuelles (`annual_dates`, tableau de `MM-DD`). `next_due` reste la source de vérité pour le planning et le cron. Elles ont aussi une `description` libre, une assignation (`assigned_profile_id`), un délai de rappel (`notify_lead_days`), une relance des retards (`overdue_repeat_days`, minimum 1 jour, donc quotidienne par défaut) et une `checklist`.
- Les modèles de `src/lib/templates.ts` ne créent plus l'action : `TemplatePicker` transmet le modèle à `ActionForm` (`template`), qui préremplit libellé, intervalle, échéance et checklist avant enregistrement. Les modèles sont partagés : table synchronisée `action_templates`, lue et écrite par `src/lib/templateStore.ts` (`loadActionTemplates`, `saveActionTemplates`). `TemplateEditor` les affiche repliés (`<details>`) et les enregistre avec `saveActionTemplates`. Les identifiants par défaut sont des UUID stables, insérés par `0006_action_templates.sql`. L'ancien stockage local (`localStorage`, clé `action.templates`) est repris une seule fois par `templateStore.ts` puis supprimé.
- Les pièces jointes vivent dans `attachments` (métadonnées synchronisées) et `attachmentBlobs` (octets locaux) ; les photos d'entité restent dans le bucket `photos`, les pièces jointes dans le bucket `attachments`. Les photos d'action s'ajoutent uniquement depuis `ActionForm` et s'affichent en lecture seule sur la fiche ; les documents d'entité s'ajoutent depuis `EntityForm` et s'affichent dans le bloc entité.
- Le planning conserve la vue (`planning.view`) et la date d'ancrage (`planning.anchor`) dans `localStorage` par appareil ; `PlanningCalendar` reçoit `anchor` en `$bindable` et gère précédent/suivant/aujourd'hui.
- `src/lib/actions.ts` recalcule `next_due` après modification ou suppression d'une réalisation ; `src/lib/backup.ts` produit et restaure l'archive ZIP utilisateur (JSON + photos + documents), mémorise la date du dernier export dans `localStorage` (`backup.lastExport`, choix d'appareil) et expose le seuil de rappel de 3 mois (`BACKUP_REMINDER_DAYS`), affiché en bandeau dans `App.svelte`.
- `saveLocal` / `saveMute` / `saveActionMute` passent les lignes par `toPlain` (clone JSON) avant Dexie : les proxys réactifs de Svelte ne sont pas clonables par IndexedDB.
- `EntityPhoto` pousse un état d'historique à l'ouverture d'une image : le bouton retour ferme la visionneuse avant de quitter l'entité.
- Sauvegarde : `.github/workflows/backup.yml` (hebdomadaire), `scripts/backup-photos.mjs`, procédure `docs/backup-restore.md`. Secrets GitHub : `SUPABASE_DB_URL`, `SUPABASE_SERVICE_ROLE_KEY`, variables `SUPABASE_PROJECT_REF`, `AGE_PUBLIC_KEY`.
- Le dump de sauvegarde utilise `pg_dump` (Docker `postgres:17`), pas `supabase db dump` seul : il doit contenir structure **et** données. Le workflow échoue si `public.sql` ne contient aucun `COPY`/`INSERT`.
- `SUPABASE_DB_URL` doit être la chaîne **Session pooler** (`postgres.<ref>@aws-0-<region>.pooler.supabase.com:5432`) avec le mot de passe de la base **encodé URL**. La connexion directe `db.<ref>.supabase.co` est IPv6 et échoue dans GitHub Actions.

## Règles à ne pas casser

- Toute écriture synchronisée passe par `saveLocal` / `saveMute`, jamais par un `put` Dexie direct : sinon la ligne n'est pas poussée. Ils clonent la ligne en JSON pour éviter les proxys réactifs de Svelte, non clonables par IndexedDB.
- Les suppressions sont logiques (`deleted_at`). Ne jamais supprimer une ligne en base.
- L'archivage est distinct de la suppression : `archived` sur les entités et les actions. Le planning exclut les entités/actions archivées et les actions inactives. L'historique est conservé.
- Le thème (`theme`) et la vue/période du planning (`planning.view`, `planning.anchor`) sont des choix d'appareil stockés dans `localStorage`, pas dans Dexie et pas synchronisés.
- Pour une action à dates fixes, `annual_dates` contient des `MM-DD` triés et `next_due` est recalculé par `nextAnnualDue` ; ne pas stocker l'année dans les dates.
- Ne jamais committer un dump, une photo de sauvegarde ou la clé privée `age`. La clé `service_role` utilisée par le script photos est un secret GitHub, jamais dans le dépôt. `SUPABASE_ACCESS_TOKEN` n'est plus utilisé par la sauvegarde.
- Toute modification fonctionnelle de `src/` doit passer par `npm run version:bump -- "..."` (ou le hook Git) pour garder `package.json`, `package-lock.json` et `changelog.json` alignés. Le script reste dans la série 0.x ; l'affichage retire le patch (`.0`).
- `updated_at` est posé par le trigger Postgres. La valeur envoyée par le client est écrasée.
- `profile_mutes` a une clé composite `(profile_id, entity_id)` et pas d'`id` ; son `onConflict` est `profile_id,entity_id`. `action_mutes` suit le même modèle avec `(profile_id, action_id)`.
- L'ordre de push compte : profils → entités → actions → modèles d'action → silences d'action → journaux → historique → pièces jointes → silences d'entité.
- Ne pas créer une pièce jointe avec un `put` direct : passer par `saveAttachment` / `deleteAttachment` (`src/lib/attachments.ts`) pour remplir `attachmentBlobs` et l'outbox.
- Une écriture locale ne doit jamais écraser silencieusement une modification distante : `outbox.base_updated_at` sert à détecter le conflit, à conserver dans `conflicts` et à résoudre manuellement.
- Le service worker lit le profil courant dans IndexedDB : `localStorage` est inaccessible dans un SW.
- Les chemins de photos sont versionnés ; ne pas revenir à `<entity-id>.jpg`.
- Les noms de profils sont uniques, sans tenir compte de la casse ni des espaces : passer par `createProfile` / `normalizeProfileName`, ne pas créer un profil avec un `saveLocal` direct.
- Le cron tourne à 07:00 UTC, envoie le rappel à J-`notify_lead_days` (0 = jour J), relance les retards tous les `overdue_repeat_days` jours (au moins 1, donc tous les jours par défaut) et prévient 30 jours avant et le jour de la fin de garantie. Le job `pg_cron` passe `timeout_milliseconds := 20000` à `net.http_post` : l'envoi à plusieurs appareils dépasse les 5 s par défaut.
- L'accès est un compte partagé, avec inscriptions Supabase désactivées. Les profils ne sont pas authentifiés.
- `npm run dev` n'enregistre pas le service worker : ne pas en conclure que le push est cassé.

## Ajouter une table synchronisée

Mettre à jour, dans cet ordre : le type et l'interface dans `src/lib/types.ts`, le schéma Dexie, `dexieNames`, `CONFLICT_TARGET`, `TABLES`, la migration SQL avec RLS et trigger `updated_at`, et l'ordre de push si des clés étrangères l'exigent.

Pour ajouter une colonne à une table existante, créer une nouvelle migration (`0005_...sql` par exemple) et l'ajouter aussi à `0001_init.sql` pour les installations neuves.

## Tests

Les tests couvrent les échéances (fins de mois, années bissextiles), les dates fixes annuelles, l'urgence, le filtre de notification, les résumés d'historique, la fusion de l'outbox (`fake-indexeddb/auto`) et la cohérence version/changelog. Toute nouvelle logique de date ou de fusion mérite un test.

## Variables

`.env.local` : `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_WORKSPACE_EMAIL`, `VITE_VAPID_PUBLIC_KEY`. Sans elles, l'écran de configuration s'affiche.
