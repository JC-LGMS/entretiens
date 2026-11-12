# Entretiens

PWA de suivi et de rappel des entretiens, tailles, plantations et démarches administratives. Les données sont partagées entre tous les profils, avec une synchronisation locale d'abord et des rappels push le jour J.

## Stack

- Svelte 5 + Vite + TypeScript
- Dexie (IndexedDB) pour le stockage local et la file de synchronisation
- Supabase (Postgres, Auth, Storage, Edge Function) comme backend managé
- `vite-plugin-pwa` avec service worker personnalisé pour le push
- date-fns, Vitest

## Démarrage rapide

```bash
npm install
Copy-Item .env.example .env.local   # puis renseigner les valeurs
npm run dev
```

Sans variables d'environnement, l'application affiche un écran « Configuration requise ».

## Installation Supabase

1. **Créer un projet** sur [supabase.com](https://supabase.com).
2. **Appliquer le schéma** :
   ```bash
   npx supabase link --project-ref <PROJECT_REF>
   npx supabase db push
   ```
   Ou coller `supabase/migrations/0001_init.sql` dans le SQL Editor.
3. **Créer l'accès partagé** : Authentication > Users > Add user.
   - Email : celui qui servira de `VITE_WORKSPACE_EMAIL`.
   - Mot de passe : le « code de la maison ».
   - Cocher « Auto Confirm User ».
4. **Désactiver les inscriptions** : Authentication > Providers > Email > désactiver « Allow new users to sign up ». Désactiver aussi les connexions anonymes dans Authentication > Settings. Sans cela, n'importe qui peut créer un compte et voir toutes les données.
5. **Générer les clés VAPID** :
   ```bash
   npx --yes web-push@3.6.7 generate-vapid-keys
   ```
6. **Déployer la fonction et ses secrets** :
   ```bash
   npx supabase functions deploy send-reminders --project-ref <PROJECT_REF>
   npx supabase secrets set --project-ref <PROJECT_REF> CRON_SECRET=<secret-long> VAPID_SUBJECT=mailto:<email> VAPID_PUBLIC_KEY=<clé-publique> VAPID_PRIVATE_KEY=<clé-privée>
   ```
   `supabase/config.toml` désactive la vérification JWT de la fonction. Si votre CLI l'ignore, ajoutez `--no-verify-jwt`.
7. **Planifier le cron** : activer les extensions `pg_cron` et `pg_net`, puis exécuter `supabase/cron.sql.example` en remplaçant `PROJECT_REF` et `CRON_SECRET`. Le rappel part à 07:00 UTC ; la date de référence du « jour J » est donc en UTC.
8. **Configurer le front** dans `.env.local` :
   ```dotenv
   VITE_SUPABASE_URL=https://<ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=<anon key>
   VITE_WORKSPACE_EMAIL=<email du compte partagé>
   VITE_VAPID_PUBLIC_KEY=<clé publique VAPID>
   ```

## Commandes

```bash
npm run dev       # serveur de développement
npm run build     # build de production + service worker
npm run preview   # sert le build (nécessaire pour tester le SW et le push)
npm run check     # svelte-check + TypeScript
npm test          # Vitest
npx vitest run src/lib/dates.test.ts   # un seul fichier de test
```

Le service worker est désactivé en `npm run dev`. Pour tester l'installation, le hors ligne complet et le push : `npm run build && npm run preview`, en HTTPS ou sur `localhost`.

## Fonctionnement

- **Profils déclaratifs** : un seul compte d'accès, plusieurs profils. Le profil courant est stocké dans IndexedDB et sert à signer les journaux et les préférences de notification.
- **Entités** : équipement, plante ou administratif, avec photo (compressée et stockée dans Supabase Storage).
- **Actions** : libellé, intervalle (jours/semaines/mois/années), prochaine échéance.
- **Réalisation** : crée un journal, met à jour `last_done` et recalcule `next_due`.
- **Planning** : en retard, aujourd'hui, ≤ 7 jours, plus tard. Le silence par profil masque le rappel push mais laisse l'échéance visible.
- **Historique** : fusion des réalisations et des modifications, avec le profil auteur.
- **Hors ligne** : toutes les écritures vont dans IndexedDB puis dans une file `outbox`. Le service worker et la synchronisation sont décrits ci-dessous.

## Synchronisation

Fichiers clés : `src/lib/db.ts`, `src/lib/sync.ts`, `src/lib/photos.ts`.

- Chaque écriture passe par `saveLocal` / `saveMute`, qui met à jour IndexedDB et la file `outbox` dans la même transaction.
- La file est poussée par ordre de dépendance : `profiles` → `entities` → `actions` → `logs` → `history` → `profile_mutes`.
- Les modifications en attente sont fusionnées par ligne (`table + row_id`).
- Le serveur pose `updated_at` via trigger ; la synchronisation tire les lignes avec `updated_at >= curseur`.
- Les suppressions sont logiques (`deleted_at`) : aucun hard delete.
- Conflit : le dernier push reçu gagne, sauf si une écriture locale est encore en attente (elle gagne).
- Les photos sont versionnées (`<entity-id>-<timestamp>.jpg`) pour invalider le cache des autres appareils.

## Rappels push

- `src/lib/push.ts` abonne l'appareil et enregistre l'abonnement dans `push_subscriptions`.
- `supabase/functions/send-reminders/index.ts` sélectionne les actions dont `next_due = aujourd'hui`, envoie à tous les abonnements, puis marque `notified_for`.
- Le service worker (`src/sw.ts`) lit le profil courant et `profile_mutes` dans IndexedDB ; si l'entité est coupée pour ce profil, il n'affiche rien.
- iPhone : iOS 16.4+ et PWA installée sur l'écran d'accueil obligatoires.
- Un échec du cron un jour donné ne rattrape pas le rappel manqué ; l'échéance reste visible dans le planning.

## Hébergement (hors de votre PC)

`npm run dev` ne sert qu'au développement. Pour utiliser l'application depuis le PC, Android et iPhone, le build `dist/` doit être publié sur un hébergement statique accessible en HTTPS. Le PC ne sert qu'à construire : une fois publié, il peut être éteint.

Deux options sans serveur à administrer :

1. **Netlify Drop** (le plus simple, sans Git) :
   ```bash
   npm run build
   ```
   Glisser le dossier `dist/` sur https://app.netlify.com/drop. Les variables `VITE_*` doivent être dans `.env.local` au moment du build.
2. **Cloudflare Pages** : Workers & Pages > Create > Pages > Upload assets, ou connecter un dépôt Git. Commande de build `npm run build`, dossier de sortie `dist`. Renseigner les variables `VITE_*` dans les réglages du projet.

Supabase reste le backend managé. Aucun port à ouvrir, aucune IP publique, aucun PC allumé. HTTPS est obligatoire pour la PWA et les notifications, et il est fourni par ces hébergeurs. Après publication, ouvrir l'URL sur iPhone (Safari > Partager > Sur l'écran d'accueil) et Android (Chrome > Installer l'application).

Le routage par hash ne nécessite aucune règle de réécriture.

## Limites connues

- Le code partagé est le seul rempart d'accès ; les profils sont déclaratifs et non vérifiés. Changer le mot de passe dans Supabase n'invalide pas les sessions déjà ouvertes : révoquez-les depuis le dashboard si un appareil est perdu.
- Les données restent en cache local (IndexedDB) après déconnexion sur un appareil.
- Le filtrage des notifications par profil se fait côté service worker : l'appareil est réveillé même si rien ne s'affiche.
- Les photos remplacées peuvent laisser d'anciens objets dans Storage.
- La fonction Edge utilise `npm:web-push` sous Deno ; ce point doit être validé sur votre projet Supabase.
- Un projet Supabase gratuit peut être mis en pause après une longue inactivité.
- Safari peut évincer IndexedDB ; une PWA installée et `navigator.storage.persist()` réduisent le risque sans l'éliminer.
