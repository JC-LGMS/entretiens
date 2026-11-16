# Entretiens

PWA de suivi et de rappel des entretiens, tailles, plantations et démarches administratives. Les données sont partagées entre tous les profils, avec une synchronisation locale d'abord et des rappels push le jour J.

## Stack

- Svelte 5 + Vite + TypeScript
- Dexie (IndexedDB) pour le stockage local et la file de synchronisation
- Supabase (Postgres, Auth, Storage, Edge Function) comme backend managé
- `vite-plugin-pwa` avec service worker personnalisé pour le push
- date-fns, Vitest

## 1. Prérequis

- Node.js 20 ou plus récent.
- Un compte Supabase.
- Un compte Cloudflare (ou Netlify) pour l'hébergement.
- Un dépôt GitHub si vous voulez le déploiement automatique.

L'application ne doit pas être hébergée sur votre PC. Le PC sert uniquement à construire et à tester ; une fois publiée, l'application tourne chez l'hébergeur et Supabase.

## 2. Installation locale

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

Ouvrir `http://localhost:5173`. Tant que `.env.local` est vide, l'application affiche « Configuration requise ».

Après toute modification de `.env.local`, arrêter et relancer `npm run dev`.

## 3. Créer le backend Supabase

1. Créer un projet sur https://supabase.com/dashboard.
2. **Project Settings** (roue dentée) > **API** :
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public** (ou « publishable ») → `VITE_SUPABASE_ANON_KEY`
3. **Authentication** > **Users** > **Add user** :
   - email : celui que vous voulez, par exemple `maison@example.com`
   - mot de passe : votre code d'accès
   - cocher **Auto Confirm User**
   - cet email est `VITE_WORKSPACE_EMAIL`
4. **Authentication** > **Providers** > **Email** : désactiver « Allow new users to sign up ».
5. **Authentication** > **Settings** : désactiver les connexions anonymes.
6. **SQL Editor** > **New query** : exécuter les fichiers de `supabase/migrations/` dans l’ordre (`0001` à `0005`), ou lancer `npx supabase db push`. Sur une base déjà créée, exécuter les migrations manquantes.

La migration crée les tables, les règles RLS, les index et les buckets privés `photos` (photos d'entité) et `attachments` (photos d'action et documents).

## 4. Générer les clés VAPID

Dans un terminal, à la racine du projet :

```powershell
npx --yes web-push@3.6.7 generate-vapid-keys
```

Le résultat contient deux clés :

- **Public Key** → `VITE_VAPID_PUBLIC_KEY` et secret Supabase `VAPID_PUBLIC_KEY`.
- **Private Key** → uniquement le secret Supabase `VAPID_PRIVATE_KEY`.

La clé privée ne doit jamais aller dans `.env.local`, dans Cloudflare ni dans Git. Gardez-la dans un gestionnaire de mots de passe.

## 5. Remplir `.env.local`

```dotenv
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_WORKSPACE_EMAIL=maison@example.com
VITE_VAPID_PUBLIC_KEY=BEx...
```

Sans guillemets et sans espace autour du `=`. Ces quatre valeurs sont publiques : elles finissent dans le bundle JavaScript. Le mot de passe du compte partagé n'est jamais stocké dans un fichier.

Relancer `npm run dev`. Le premier écran demande le **code d'accès** : c'est le mot de passe du compte Supabase créé à l'étape 3, pas l'email, pas la clé `anon`. Ensuite, l'application demande de choisir ou créer un **profil** (le nom affiché dans l'historique).

## 6. Déployer la fonction et le cron Supabase

```bash
npx supabase functions deploy send-reminders --remote=<PROJECT_REF> --use-api --no-verify-jwt
npx supabase secrets set --remote=<PROJECT_REF> CRON_SECRET=<secret-long> VAPID_SUBJECT=mailto:<email> VAPID_PUBLIC_KEY=<clé-publique> VAPID_PRIVATE_KEY=<clé-privée>
```

`--use-api` évite de dépendre de Docker. `supabase/config.toml` désactive déjà la vérification JWT de la fonction ; `--no-verify-jwt` le rend explicite.

Activer les extensions `pg_cron` et `pg_net`, puis exécuter `supabase/cron.sql.example` dans le SQL Editor en remplaçant `PROJECT_REF` et `CRON_SECRET`. Le rappel part à **07:00 UTC** ; la date de référence du « jour J » est donc en UTC.

## 7. Héberger le front (hors de votre PC)

`npm run dev` ne sert qu'au développement. Le build `dist/` doit être publié sur un hébergement statique accessible en HTTPS.

### Cloudflare Workers (interface actuelle)

1. **Workers & Pages** > votre projet > **Settings** > **Build**.
2. Vérifier :
   - Build command : `npm run build`
   - Deploy command : `npx wrangler deploy`
3. Dans **Build variables and secrets**, ajouter en type **Text** :
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_WORKSPACE_EMAIL`
   - `VITE_VAPID_PUBLIC_KEY`
4. **Save**, puis **Deployments** > **Retry deployment** (ou pousser un commit).

Ne pas utiliser **Settings > Variables & Secrets** : cette section sert aux variables d'exécution d'un Worker. Un Worker qui ne sert que des fichiers statiques n'exécute aucun code, donc Cloudflare refuse ces variables avec le message :

> Variables cannot be added to a Worker that only has static assets.

Les variables `VITE_*` sont des variables de **build**, pas d'exécution. Elles doivent être disponibles quand `npm run build` tourne.

Si le déploiement échoue parce que Cloudflare ne trouve pas les fichiers statiques, ajouter un `wrangler.jsonc` à la racine :

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "entretiens",
  "compatibility_date": "2026-11-12",
  "assets": {
    "directory": "./dist",
    "not_found_handling": "single-page-application"
  }
}
```

Adapter `name` si votre Worker porte un autre nom.

### Cloudflare Pages

Si vous utilisez un projet Pages, les variables vont dans **Settings** > **Builds & deployments** > **Environment variables** (Production et Preview), pas dans les variables d'exécution.

### Sans build Cloudflare

Construire sur le PC avec `.env.local` rempli, puis envoyer le dossier `dist` :

```powershell
npm run build
npx wrangler pages deploy dist --project-name entretiens
```

Dans ce cas, les valeurs sont déjà intégrées au build : aucune variable Cloudflare n'est nécessaire. Netlify Drop fonctionne de la même façon : glisser `dist/` sur https://app.netlify.com/drop.

Après publication, ouvrir l'URL sur iPhone (Safari > Partager > « Sur l'écran d'accueil ») et Android (Chrome > « Installer l'application »).

## 8. Vérifier que tout fonctionne

- Connexion avec le code d'accès Supabase.
- Création d'un profil.
- La page d'accueil affiche le planning avec le bouton d'ajout (FAB sur mobile, bouton en haut sur PC).
- Création d'une entité et d'une action.
- Le sélecteur d'action affiche les photos et permet de créer une nouvelle entité.
- La modale d'action indique l'entité concernée et propose une description.
- Clic sur la photo d'une entité : elle s'affiche en grand.
- « C'est fait » : le journal et l'historique se mettent à jour, sans erreur IndexedDB.
- Le planning affiche la photo de l'entité, un liseré complet selon l'urgence, la recherche d'actions, et la date + le nombre de jours à droite.
- Le planning propose les vues liste, semaine, 2 semaines et mois, ainsi que le filtre « Mes actions ».
- Dans les vues semaine, 2 semaines et mois, les flèches permettent d'avancer ou de reculer, et « Aujourd'hui » revient à la période courante.
- La vue et la période du planning sont conservées sur l'appareil : après l'ouverture d'une action, le retour affiche la même période.
- « C'est fait » est disponible directement depuis le planning, avec coût et checklist.
- La date du jour et le nombre d'actions sont à droite du titre Planning.
- Un clic sur une action ouvre la fiche de l'entité, met l'action en avant et recentre la vue ; le retour pointe vers Planning.
- Le titre de l'application et le logo ramènent au planning ; le logo reprend l'icône de l'application.
- Un conflit de synchronisation affiche une bannière d'alerte qui ouvre directement le dialogue de résolution.
- Une action peut être récurrente par intervalle (unité par défaut : an) ou par dates fixes (deux dates préremplies).
- Chaque action peut être assignée à un profil, avoir un délai de rappel et une relance des retards (1 jour par défaut).
- Les modèles proposent notamment poêle à granulés, pompe à chaleur, déclaration BIC et déclaration de revenus ; un clic ouvre le formulaire prérempli avec la checklist du modèle.
- Réglages > Modèles d'actions : les modèles sont repliés par défaut et un clic affiche tous les champs. Modifier les noms, descriptions, fréquences et checklists, ajouter ou supprimer un modèle et rétablir les valeurs par défaut. Les modèles sont partagés par tous les profils et synchronisés entre les appareils.
- Archiver une action ou une entité : disparition du planning, historique conservé, restauration possible.
- Le bouton de silence masque le rappel pour le profil courant, par entité ou par action.
- Réglages > Comptes et historiques : renommer, fusionner, supprimer les profils sans activité.
- Fiche entité : actions colorées et liseré complet, titre cliquable et crayon adjacent, réalisations et modifications séparées, modification/suppression/annulation d'une réalisation par icônes, documents et photos avec titre, coût total par action, garantie et checklist.
- Les photos d'action s'ajoutent en modifiant l'action ; elles s'ouvrent en modale et affichent leur titre sous la photo.
- Les documents d'entité s'ajoutent à la création ou à la modification de l'entité et restent visibles dans le bloc de l'entité.
- Corbeille : restaurer une entité, une action ou une réalisation supprimée.
- Sauvegarde utilisateur : export/import ZIP (JSON + photos + documents).
- Indicateur de synchronisation cliquable : file d'attente, erreur, conflits et résolution.
- Gestion des appareils push et mise à jour PWA avec bouton.
- Thème clair/sombre via l'icône de l'en-tête, conservé sur l'appareil, y compris sur mobile.
- Réglages > Version : numéro au format 0.x et changelog complet.
- Après un rechargement, les données sont toujours là.
- En coupant le réseau, une création reste visible ; au retour du réseau, elle se synchronise.

Le service worker est désactivé en `npm run dev`. Pour tester l'installation, le hors ligne complet et le push :

```powershell
npm run build
npm run preview
```

HTTPS est obligatoire pour le push et l'installation sur iPhone.

## 9. Dépannage

### « Configuration requise »

Les variables `VITE_*` ne sont pas disponibles au moment du build. En local : remplir `.env.local` et relancer `npm run dev`. Sur Cloudflare : les ajouter dans **Build variables and secrets**, puis relancer un déploiement.

### « Code incorrect ou accès impossible »

- L'email dans `VITE_WORKSPACE_EMAIL` doit être exactement celui de l'utilisateur Supabase.
- L'utilisateur doit être confirmé (« Auto Confirm User »).
- Le code saisi est le mot de passe Supabase, pas l'email ni la clé `anon`.
- Modifier le mot de passe dans **Authentication > Users**, puis relancer `npm run dev` si `.env.local` a changé.

### « Variables cannot be added to a Worker that only has static assets »

Utiliser **Settings > Build > Build variables and secrets**, pas **Settings > Variables & Secrets**. Vite a besoin de variables de build.

### Le push n'arrive pas

- PWA installée sur l'écran d'accueil pour iPhone (iOS 16.4+).
- Permission de notification accordée dans l'application.
- Secrets VAPID présents dans Supabase.
- Fonction `send-reminders` déployée et cron `pg_cron` planifié.
- L'action est bien due le jour même à 07:00 UTC et n'est pas coupée pour le profil courant.

### Le build Cloudflare réussit mais l'application affiche l'écran de configuration

Les variables ont été ajoutées après le build, ou dans la mauvaise section. Vérifier **Build variables and secrets** et relancer le déploiement.

## 10. Commandes

```bash
npm run dev       # serveur de développement
npm run build     # build de production + service worker
npm run preview   # sert le build (nécessaire pour tester le SW et le push)
npm run check     # svelte-check + TypeScript
npm test          # Vitest
npx vitest run src/lib/dates.test.ts   # un seul fichier de test
npm run version:bump -- "description"  # incrémente la version de 0.1 et ajoute le changelog
```

## Version et changelog

La version affichée dans Réglages vient de `package.json` et est raccourcie au format **0.x** (`0.5.0` → `0.5`). `npm run version:bump -- "description"` reste dans la série 0.x, met à jour `package.json`, `package-lock.json` et ajoute une entrée dans `src/lib/changelog.json`.

Un hook Git `pre-commit` est installé par `npm install` (script `prepare`). Il incrémente automatiquement la version quand un commit contient des changements dans `src/`, avec le message `Mise à jour de l'application` ou la valeur de `VERSION_MESSAGE`. Pour le désactiver, supprimer `.git/hooks/pre-commit`.

## 11. Fonctionnement

- **Profils déclaratifs** : un seul compte d'accès, plusieurs profils. Le profil courant est stocké dans IndexedDB et sert à signer les journaux et les préférences de notification.
- **Entités** : équipement, plante ou administratif, avec photo, documents joints, garantie et coût total. Une entité peut être archivée pour la retirer du planning sans perdre son historique. Les documents s'ajoutent depuis le formulaire d'entité et restent consultables dans le bloc de l'entité.
- **Actions** : libellé, description libre, assignation à un profil, récurrence par intervalle ou dates fixes, délai de rappel, relance des retards (1 jour par défaut), checklist et photos avec titre. Une action peut être archivée ou désactivée. Le titre et le crayon ouvrent la modification ; les photos s'ajoutent depuis ce formulaire.
- **Modèles** : poêle à granulés, pompe à chaleur, déclarations BIC et de revenus, etc. Un modèle ouvre le formulaire prérempli avec sa checklist. Les modèles sont éditables dans Réglages > Modèles d'actions ; ils sont partagés par tous les profils et synchronisés entre les appareils.
- **Réalisation** : crée un journal, met à jour `last_done` et recalcule `next_due` (intervalle ou prochaine date fixe). Le coût saisi alimente le coût total de l'action.
- **Planning** : page d'accueil. Photo de l'entité, liseré complet pour les retards et les échéances à moins de 7 jours, barre latérale colorée sinon, recherche, filtre « Mes actions », vues liste/semaine/2 semaines/mois avec navigation de périodes, date du jour et nombre d'actions à droite du titre. La vue et la période sont conservées par appareil. « C'est fait » depuis le planning. Un clic sur une action ouvre la fiche et met l'action en avant. Le silence par profil masque le rappel push mais laisse l'échéance visible.
- **Historique** : réalisations et modifications séparées ; modification, suppression et annulation d'une réalisation par icônes. Le titre Modifications est cliquable ; les commentaires sont mis en évidence.
- **Photos et documents** : photo d'entité agrandissable ; photos d'action avec titre et ouverture en modale ; documents PDF/image ajoutés via le formulaire d'entité.
- **Corbeille** : restaurer entité, action ou réalisation.
- **Thème** : icône clair/sombre dans l'en-tête, ou Système/Clair/Sombre dans Réglages, enregistré par appareil. Le thème applique explicitement `data-theme` et `color-scheme` pour éviter les incohérences de barre d'état sur mobile.
- **Version** : numéro affiché dans Réglages, changelog de toutes les versions au clic.
- **Hors ligne** : toutes les écritures vont dans IndexedDB puis dans une file `outbox`.

## 12. Synchronisation

Fichiers clés : `src/lib/db.ts`, `src/lib/sync.ts`, `src/lib/photos.ts`, `src/lib/attachments.ts`.

- Chaque écriture passe par `saveLocal` / `saveMute` / `saveActionMute`, qui met à jour IndexedDB et la file `outbox` dans la même transaction.
- La file est poussée par ordre de dépendance : `profiles` → `entities` → `actions` → `action_mutes` → `logs` → `history` → `attachments` → `profile_mutes`.
- Les modifications en attente sont fusionnées par ligne (`table + row_id`) ; `base_updated_at` conserve la version serveur d'origine.
- Le serveur pose `updated_at` via trigger ; la synchronisation tire les lignes avec `updated_at >= curseur`.
- Les suppressions sont logiques (`deleted_at`) : aucun hard delete.
- Si la ligne serveur a changé depuis `base_updated_at` et diffère de la version locale, un conflit est enregistré dans `conflicts` et rien n'est poussé pour cette ligne. Le dialogue de synchronisation (indicateur cliquable) permet de garder la version locale ou la version distante.
- Les photos sont versionnées (`<entity-id>-<timestamp>.jpg`) pour invalider le cache des autres appareils.

## 13. Rappels push

- `src/lib/push.ts` abonne l'appareil et enregistre l'abonnement (libellé d'appareil, dernière activité) dans `push_subscriptions`.
- `supabase/functions/send-reminders/index.ts` notifie à J-`notify_lead_days`, relance les retards selon `overdue_repeat_days`, prévient 30 jours avant et le jour de la fin de garantie, puis marque `last_notified_on` / `warranty_notified_on`.
- Le service worker (`src/sw.ts`) lit le profil courant, `profile_mutes` et `action_mutes` dans IndexedDB ; si l'entité ou l'action est coupée pour ce profil, il n'affiche rien.
- Un échec du cron un jour donné ne rattrape pas le rappel manqué ; l'échéance reste visible dans le planning.

## Sauvegarde

Une sauvegarde logique hebdomadaire est produite par GitHub Actions (`.github/workflows/backup.yml`), le dimanche à 03:00 UTC, avec lancement manuel possible.

- Dump du schéma `public` (tables, données, RLS, triggers).
- Copie des buckets `photos` et `attachments` via `scripts/backup-photos.mjs`.
- Archive chiffrée avec `age`, publiée en artefact GitHub pendant **90 jours** (maximum autorisé sur ce dépôt).

Secrets/variables à configurer : `SUPABASE_DB_URL` (Session pooler), `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PROJECT_REF`, `AGE_PUBLIC_KEY`. La clé privée `age` doit être conservée dans le gestionnaire de mots de passe ; sans elle, les archives sont illisibles.

Le mot de passe contenu dans `SUPABASE_DB_URL` doit être **encodé URL** (`%` → `%25`, `@` → `%40`, etc.) ; sinon `pg_dump` échoue avec `invalid percent-encoded token`. La procédure PowerShell est dans [`docs/backup-restore.md`](docs/backup-restore.md).

`SUPABASE_ACCESS_TOKEN` n’est plus utilisé par la sauvegarde : il peut être supprimé des secrets GitHub ou conservé pour d’autres usages CLI.

La procédure de restauration complète est dans [`docs/backup-restore.md`](docs/backup-restore.md).

## 14. Limites connues

- Le code partagé est le seul rempart d'accès ; les profils sont déclaratifs et non vérifiés. Changer le mot de passe dans Supabase n'invalide pas les sessions déjà ouvertes : révoquez-les depuis le dashboard si un appareil est perdu.
- Les données restent en cache local (IndexedDB) après déconnexion sur un appareil.
- Le filtrage des notifications par profil se fait côté service worker : l'appareil est réveillé même si rien ne s'affiche.
- Les photos remplacées peuvent laisser d'anciens objets dans Storage.
- La fonction Edge utilise `npm:web-push` sous Deno (déployée et testée sur ce projet).
- La résolution de conflit est manuelle, ligne par ligne : un conflit non traité bloque la synchronisation de cette ligne jusqu'au choix local/distant.
- Les pièces jointes volumineuses sont compressées pour les images mais les PDF ne le sont pas.
- Un projet Supabase gratuit peut être mis en pause après une longue inactivité.
- Safari peut évincer IndexedDB ; une PWA installée et `navigator.storage.persist()` réduisent le risque sans l'éliminer.
