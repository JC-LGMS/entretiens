# AGENTS.md

## État

Application complète, prête à configurer. Le détail d'installation est dans `README.md`.

## Commandes

- `npm install`
- `npm run dev` — service worker désactivé.
- `npm run build && npm run preview` — obligatoire pour tester la PWA, le hors ligne et le push.
- `npm run check` — Svelte + TypeScript, doit rester à 0 erreur.
- `npm test` — Vitest en environnement node.
- Un seul test : `npx vitest run src/lib/dates.test.ts`.
- `npm run version:bump -- "description"` — incrémente la version de 0.1 et ajoute une entrée au changelog. Le hook `pre-commit` installé par `prepare` le fait automatiquement quand le commit touche `src/` (message via `VERSION_MESSAGE` ou valeur par défaut).

## Architecture

- Svelte 5 avec runes (`$state`, `$derived`, `$effect`) ; l'état global est dans `src/lib/state.svelte.ts`.
- Routage par hash maison dans `src/lib/router.svelte.ts` : `#/` = planning (accueil), `#/entities`, `#/entity/<id>?action=<id>`, `#/profiles`, `#/profile/<id>`, `#/settings`.
- Dexie est la source de vérité locale (`src/lib/db.ts`), Supabase est le backend.
- `src/lib/sync.ts` pousse l'outbox puis tire les changements par curseur `updated_at`.
- `src/sw.ts` gère le push et le silence par profil ; `src/lib/theme.ts` gère le thème par appareil.
- Le thème est toujours appliqué explicitement (`data-theme` = `light` ou `dark`, `color-scheme: only light|dark`) ; le mode « système » résout la préférence et écoute les changements.
- `src/lib/version.ts` expose la version (format 0.x) et le changelog ; `src/components/Icon.svelte` contient les icônes SVG de navigation.
- Les actions ont deux modes : intervalle (`interval_value` / `interval_unit`) ou dates fixes annuelles (`annual_dates`, tableau de `MM-DD`). `next_due` reste la source de vérité pour le planning et le cron.
- `saveLocal` / `saveMute` passent les lignes par `toPlain` (clone JSON) avant Dexie : les proxys réactifs de Svelte ne sont pas clonables par IndexedDB.
- `EntityPhoto` pousse un état d'historique à l'ouverture d'une image : le bouton retour ferme la visionneuse avant de quitter l'entité.

## Règles à ne pas casser

- Toute écriture synchronisée passe par `saveLocal` ou `saveMute`, jamais par un `put` Dexie direct : sinon la ligne n'est pas poussée.
- Les suppressions sont logiques (`deleted_at`). Ne jamais supprimer une ligne en base.
- L'archivage est distinct de la suppression : `archived` sur les entités et les actions. Le planning exclut les entités/actions archivées et les actions inactives. L'historique est conservé.
- Le thème est un choix d'appareil stocké dans `localStorage` (`theme`), pas dans Dexie et pas synchronisé.
- Pour une action à dates fixes, `annual_dates` contient des `MM-DD` triés et `next_due` est recalculé par `nextAnnualDue` ; ne pas stocker l'année dans les dates.
- Toute écriture Dexie passe par `saveLocal` / `saveMute` qui clonent la ligne en JSON ; ne jamais faire un `put` direct avec un objet réactif.
- Toute modification fonctionnelle de `src/` doit passer par `npm run version:bump -- "..."` (ou le hook Git) pour garder `package.json` et `changelog.json` alignés. Le script reste dans la série 0.x ; l'affichage retire le patch (`.0`).
- `updated_at` est posé par le trigger Postgres. La valeur envoyée par le client est écrasée.
- `profile_mutes` a une clé composite `(profile_id, entity_id)` et pas d'`id` ; son `onConflict` est `profile_id,entity_id`.
- L'ordre de push compte : profils → entités → actions → journaux → historique → silences.
- Le service worker lit le profil courant dans IndexedDB : `localStorage` est inaccessible dans un SW.
- Les chemins de photos sont versionnés ; ne pas revenir à `<entity-id>.jpg`.
- Les noms de profils sont uniques, sans tenir compte de la casse ni des espaces : passer par `createProfile` / `normalizeProfileName`, ne pas créer un profil avec un `saveLocal` direct.
- Le cron tourne à 07:00 UTC et ne notifie que le jour J.
- L'accès est un compte partagé, avec inscriptions Supabase désactivées. Les profils ne sont pas authentifiés.
- `npm run dev` n'enregistre pas le service worker : ne pas en conclure que le push est cassé.

## Ajouter une table synchronisée

Mettre à jour, dans cet ordre : le type et l'interface dans `src/lib/types.ts`, le schéma Dexie, `dexieNames`, `CONFLICT_TARGET`, `TABLES`, la migration SQL avec RLS et trigger `updated_at`, et l'ordre de push si des clés étrangères l'exigent.

Pour ajouter une colonne à une table existante, créer une nouvelle migration (`0003_...sql`) et l'ajouter aussi à `0001_init.sql` pour les installations neuves.

## Tests

Les tests couvrent les échéances (fins de mois, années bissextiles), les dates fixes annuelles, l'urgence, le filtre de notification, les résumés d'historique, la fusion de l'outbox (`fake-indexeddb/auto`) et la cohérence version/changelog. Toute nouvelle logique de date ou de fusion mérite un test.

## Variables

`.env.local` : `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_WORKSPACE_EMAIL`, `VITE_VAPID_PUBLIC_KEY`. Sans elles, l'écran de configuration s'affiche.
