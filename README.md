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
6. **SQL Editor** > **New query** : exécuter les fichiers de `supabase/migrations/` dans l'ordre (`0001_init.sql`, `0002_archive.sql`, `0003_annual_dates.sql`, `0004_action_description.sql`), ou lancer `npx supabase db push`. Sur une base déjà créée, exécuter les migrations manquantes.

La migration crée les tables, les règles RLS, les index et le bucket privé `photos`.

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
- Le planning affiche la photo de l'entité, un liseré complet rouge ou jaune selon l'urgence, la recherche d'actions, et la date + le nombre de jours à droite.
- La date du jour et le nombre d'actions sont à droite du titre Planning.
- Un clic sur une action ouvre la fiche de l'entité, met l'action en avant et recentre la vue ; le retour pointe vers Planning.
- Une action peut être récurrente par intervalle (unité par défaut : an) ou par dates fixes (deux dates préremplies).
- Archiver une action ou une entité : disparition du planning, historique conservé, restauration possible.
- Le bouton de silence masque le rappel pour le profil courant.
- Réglages > Comptes et historiques : activité de chaque profil, suppression des profils sans activité.
- Fiche entité : réalisations et modifications séparées ; le titre Modifications est cliquable ; date et titre des réalisations sur la même ligne, commentaires mis en évidence.
- Sur mobile, le retour ferme l'image agrandie sans quitter l'entité.
- Le nom du profil n'apparaît plus sous « Entretiens ».
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

La version affichée dans Réglages vient de `package.json` et est raccourcie au format **0.x** (`0.4.0` → `0.4`). `npm run version:bump -- "description"` reste dans la série 0.x et ajoute une entrée dans `src/lib/changelog.json`.

Un hook Git `pre-commit` est installé par `npm install` (script `prepare`). Il incrémente automatiquement la version quand un commit contient des changements dans `src/`, avec le message `Mise à jour de l'application` ou la valeur de `VERSION_MESSAGE`. Pour le désactiver, supprimer `.git/hooks/pre-commit`.

## 11. Fonctionnement

- **Profils déclaratifs** : un seul compte d'accès, plusieurs profils. Le profil courant est stocké dans IndexedDB et sert à signer les journaux et les préférences de notification.
- **Entités** : équipement, plante ou administratif, avec photo (compressée et stockée dans Supabase Storage). Une entité peut être archivée pour la retirer du planning sans perdre son historique.
- **Actions** : libellé, description libre, récurrence par intervalle (jours/semaines/mois/années, unité par défaut : an) ou par dates fixes dans l'année (1er mars, 15 octobre…), prochaine échéance. Une action peut être archivée ou désactivée.
- **Réalisation** : crée un journal, met à jour `last_done` et recalcule `next_due` (intervalle ou prochaine date fixe).
- **Planning** : page d'accueil. Photo de l'entité, liseré complet rouge ou jaune selon l'urgence, recherche d'actions, date du jour et nombre d'actions à droite du titre. En retard, aujourd'hui, ≤ 7 jours, plus tard. La date et le nombre de jours sont regroupés à droite. Un clic sur une action ouvre la fiche et met l'action en avant. Le silence par profil masque le rappel push mais laisse l'échéance visible.
- **Historique** : les réalisations (« C'est fait ») sont séparées des modifications moins importantes ; le titre Modifications est cliquable. Les réalisations affichent date et titre sur la même ligne, avec un commentaire mis en évidence.
- **Photos** : un clic sur la photo d'une entité l'ouvre en grand ; les photos apparaissent dans le sélecteur d'action.
- **Thème** : icône clair/sombre dans l'en-tête, ou Système/Clair/Sombre dans Réglages, enregistré par appareil. Le thème applique explicitement `data-theme` et `color-scheme` pour éviter les incohérences de barre d'état sur mobile.
- **Version** : numéro affiché dans Réglages, changelog de toutes les versions au clic.
- **Hors ligne** : toutes les écritures vont dans IndexedDB puis dans une file `outbox`.

## 12. Synchronisation

Fichiers clés : `src/lib/db.ts`, `src/lib/sync.ts`, `src/lib/photos.ts`.

- Chaque écriture passe par `saveLocal` / `saveMute`, qui met à jour IndexedDB et la file `outbox` dans la même transaction.
- La file est poussée par ordre de dépendance : `profiles` → `entities` → `actions` → `logs` → `history` → `profile_mutes`.
- Les modifications en attente sont fusionnées par ligne (`table + row_id`).
- Le serveur pose `updated_at` via trigger ; la synchronisation tire les lignes avec `updated_at >= curseur`.
- Les suppressions sont logiques (`deleted_at`) : aucun hard delete.
- Conflit : le dernier push reçu gagne, sauf si une écriture locale est encore en attente (elle gagne).
- Les photos sont versionnées (`<entity-id>-<timestamp>.jpg`) pour invalider le cache des autres appareils.

## 13. Rappels push

- `src/lib/push.ts` abonne l'appareil et enregistre l'abonnement dans `push_subscriptions`.
- `supabase/functions/send-reminders/index.ts` sélectionne les actions dont `next_due = aujourd'hui`, envoie à tous les abonnements, puis marque `notified_for`.
- Le service worker (`src/sw.ts`) lit le profil courant et `profile_mutes` dans IndexedDB ; si l'entité est coupée pour ce profil, il n'affiche rien.
- Un échec du cron un jour donné ne rattrape pas le rappel manqué ; l'échéance reste visible dans le planning.

## 14. Limites connues

- Le code partagé est le seul rempart d'accès ; les profils sont déclaratifs et non vérifiés. Changer le mot de passe dans Supabase n'invalide pas les sessions déjà ouvertes : révoquez-les depuis le dashboard si un appareil est perdu.
- Les données restent en cache local (IndexedDB) après déconnexion sur un appareil.
- Le filtrage des notifications par profil se fait côté service worker : l'appareil est réveillé même si rien ne s'affiche.
- Les photos remplacées peuvent laisser d'anciens objets dans Storage.
- La fonction Edge utilise `npm:web-push` sous Deno ; ce point doit être validé sur votre projet Supabase.
- Un projet Supabase gratuit peut être mis en pause après une longue inactivité.
- Safari peut évincer IndexedDB ; une PWA installée et `navigator.storage.persist()` réduisent le risque sans l'éliminer.
