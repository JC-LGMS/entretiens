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

## Architecture

- Svelte 5 avec runes (`$state`, `$derived`, `$effect`) ; l'état global est dans `src/lib/state.svelte.ts`.
- Routage par hash maison dans `src/lib/router.svelte.ts`.
- Dexie est la source de vérité locale (`src/lib/db.ts`), Supabase est le backend.
- `src/lib/sync.ts` pousse l'outbox puis tire les changements par curseur `updated_at`.
- `src/sw.ts` gère le push et le silence par profil.

## Règles à ne pas casser

- Toute écriture synchronisée passe par `saveLocal` ou `saveMute`, jamais par un `put` Dexie direct : sinon la ligne n'est pas poussée.
- Les suppressions sont logiques (`deleted_at`). Ne jamais supprimer une ligne en base.
- `updated_at` est posé par le trigger Postgres. La valeur envoyée par le client est écrasée.
- `profile_mutes` a une clé composite `(profile_id, entity_id)` et pas d'`id` ; son `onConflict` est `profile_id,entity_id`.
- L'ordre de push compte : profils → entités → actions → journaux → historique → silences.
- Le service worker lit le profil courant dans IndexedDB : `localStorage` est inaccessible dans un SW.
- Les chemins de photos sont versionnés ; ne pas revenir à `<entity-id>.jpg`.
- Le cron tourne à 07:00 UTC et ne notifie que le jour J.
- L'accès est un compte partagé, avec inscriptions Supabase désactivées. Les profils ne sont pas authentifiés.
- `npm run dev` n'enregistre pas le service worker : ne pas en conclure que le push est cassé.

## Ajouter une table synchronisée

Mettre à jour, dans cet ordre : le type et l'interface dans `src/lib/types.ts`, le schéma Dexie, `dexieNames`, `CONFLICT_TARGET`, `TABLES`, la migration SQL avec RLS et trigger `updated_at`, et l'ordre de push si des clés étrangères l'exigent.

## Tests

Les tests couvrent les échéances (fins de mois, années bissextiles), l'urgence, le filtre de notification, les résumés d'historique et la fusion de l'outbox (`fake-indexeddb/auto`). Toute nouvelle logique de date ou de fusion mérite un test.

## Variables

`.env.local` : `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_WORKSPACE_EMAIL`, `VITE_VAPID_PUBLIC_KEY`. Sans elles, l'écran de configuration s'affiche.
