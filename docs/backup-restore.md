# Sauvegarde et restauration

La sauvegarde est un workflow GitHub Actions hebdomadaire qui produit une archive chiffrée contenant :

- `backup/public.sql` : schéma et données du schéma `public` (tables, données, RLS, triggers) ;
- `backup/photos/` : tous les objets du bucket `photos` ;
- `backup/attachments/` : photos d’action et documents du bucket `attachments` ;
- une empreinte SHA-256 de l’archive chiffrée.

Les artefacts sont conservés **90 jours** dans GitHub (maximum autorisé sur ce dépôt). Ils sont chiffrés avec une clé `age` avant l'envoi.

## Mise en place

### 1. Créer la clé age

```bash
age-keygen -o age-key.txt
```

Le fichier contient la clé privée et la clé publique (`age1...`). Garde la clé privée dans ton gestionnaire de mots de passe et une copie hors ligne. **Sans elle, les sauvegardes sont illisibles.**

Sur Windows : `winget install FiloSottile.age`, ou utiliser WSL.

### 2. Créer les secrets GitHub

Dans **Settings > Secrets and variables > Actions** :

| Nom | Type | Valeur |
|---|---|---|
| `SUPABASE_DB_URL` | Secret | chaîne **Session pooler** du projet (avec le mot de passe de la base) |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret | clé `service_role` du projet, utilisée pour lire le bucket privé |
| `SUPABASE_PROJECT_REF` | Variable | `wfugwlrbiojmubbaxlsy` |
| `AGE_PUBLIC_KEY` | Variable | clé publique `age1...` |

La chaîne Session pooler se trouve dans **Connect** > **Session pooler** sur le tableau de bord Supabase. Elle ressemble à :

```text
postgresql://postgres.<ref>:<mot-de-passe>@aws-0-<region>.pooler.supabase.com:5432/postgres
```

Le mot de passe de la base est un secret : ne pas le coller dans une conversation. Le token `SUPABASE_ACCESS_TOKEN` n’est plus nécessaire pour cette sauvegarde.

### Encoder le mot de passe dans l’URL

Si le mot de passe contient `%`, `@`, `:`, `/`, `#` ou `?`, il doit être encodé URL. Sinon `pg_dump` échoue avec :

```text
pg_dump: error: invalid percent-encoded token
```

Sous PowerShell, construis l’URL sans exposer le mot de passe dans l’historique :

```powershell
$password = Read-Host -AsSecureString "Mot de passe base"
$plain = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
  [Runtime.InteropServices.Marshal]::SecureStringToBSTR($password)
)
$encoded = [uri]::EscapeDataString($plain)
$url = "postgresql://postgres.wfugwlrbiojmubbaxlsy:$encoded@aws-0-eu-west-1.pooler.supabase.com:5432/postgres"
$url | gh secret set SUPABASE_DB_URL
```

Adapte l’hôte si ton Session pooler n’est pas en `eu-west-1`.

### 3. Vérifier le workflow

Le workflow se trouve dans `.github/workflows/backup.yml`. Il se lance :

- automatiquement le dimanche à **03:00 UTC** ;
- manuellement via **Actions > Sauvegarde chiffrée > Run workflow**.

Il échoue volontairement si un secret manque, si le dump est vide, ou si l’artefact n’est pas trouvé.

## Télécharger et déchiffrer

1. GitHub > **Actions** > **Sauvegarde chiffrée** > choisir un run.
2. Télécharger l’artefact `entretiens-backup-...`.
3. Vérifier l’empreinte :
   ```bash
   sha256sum -c checksums.txt
   ```
4. Déchiffrer et extraire :
   ```bash
   age --decrypt -i age-key.txt -o backup.tar.gz entretiens-backup-AAAA-MM-JJ.tar.gz.age
   tar -xzf backup.tar.gz
   ```

## Restaurer sur un nouveau projet Supabase

Ne pas restaurer dans le projet de production existant : créer un projet neuf.

1. Créer un projet Supabase dans la même région si possible (`eu-west-1`).
2. Récupérer la chaîne **Session pooler** du nouveau projet (Connect).
3. Restaurer le dump `public` :
   ```bash
   psql "$NEW_DATABASE_URL" -v ON_ERROR_STOP=1 -f public.sql
   ```
   Si le dump contient `CREATE SCHEMA public` et que le schéma existe déjà, retirer ces lignes ou exécuter :
   ```bash
   sed '/^CREATE SCHEMA public;$/d; /^ALTER SCHEMA public OWNER TO /d' public.sql > public.restore.sql
   psql "$NEW_DATABASE_URL" -v ON_ERROR_STOP=1 -f public.restore.sql
   ```
4. Vérifier les droits du schéma :
   ```sql
   grant usage on schema public to anon, authenticated, service_role;
   grant all on all tables in schema public to anon, authenticated, service_role;
   grant all on all sequences in schema public to anon, authenticated, service_role;
   grant all on all functions in schema public to anon, authenticated, service_role;
   ```
5. Relancer les migrations pour recréer le bucket `photos`, ses policies et les extensions :
   ```bash
   npx supabase db push --remote=<NOUVEAU_REF>
   ```
6. Remettre les photos et documents aux mêmes chemins :
   ```bash
   npx supabase storage cp -r ./photos ss:///photos --remote=<NOUVEAU_REF> --experimental
   npx supabase storage cp -r ./attachments ss:///attachments --remote=<NOUVEAU_REF> --experimental
   ```
7. Recréer le compte partagé dans **Authentication > Users** :
   - même email et même mot de passe ;
   - **Auto Confirm User** ;
   - désactiver les inscriptions et les connexions anonymes.
8. Remettre les secrets Edge Function :
   ```bash
   npx supabase secrets set --remote=<NOUVEAU_REF> \
     CRON_SECRET=<secret> \
     VAPID_SUBJECT=mailto:<email> \
     VAPID_PUBLIC_KEY=<clé-publique> \
     VAPID_PRIVATE_KEY=<clé-privée>
   ```
   Puis redéployer `send-reminders` et recréer le cron.
9. Mettre à jour `.env.local` et Cloudflare avec l’URL et la clé publishable du nouveau projet. Si la clé VAPID a changé, mettre à jour `VITE_VAPID_PUBLIC_KEY` et réactiver les notifications sur les appareils.

## Vérifications après restauration

- Connexion avec le compte partagé.
- Nombre d’entités, d’actions, de journaux et d’historiques identique à la sauvegarde.
- Photos visibles et aux bons chemins.
- Création d’une action, « C’est fait », synchronisation.
- Notification push reçue (ou au moins abonnement créé).
- RLS : deux comptes ne doivent pas voir les données d’un autre workspace (ici un seul workspace partagé).

## Ce qui n’est pas dans l’archive

- Le compte `auth.users` (à recréer).
- Les secrets VAPID, `CRON_SECRET` et la configuration Edge Function.
- Le bucket et ses policies (recréés par les migrations).
- La configuration Cloudflare et les variables d’environnement.
- L’historique des migrations Supabase.

## Dépannage

- **Docker** : le dump utilise l’image `postgres:17` via Docker. Le runner GitHub fournit Docker ; en local, démarrer Docker Desktop.
- **Connexion base refusée** : vérifier la chaîne Session pooler et le mot de passe dans `SUPABASE_DB_URL`.
- **`Network is unreachable` / hôte `db.<ref>.supabase.co`** : c’est la connexion directe, IPv6 uniquement, inaccessible depuis GitHub Actions. Utiliser l’hôte **Session pooler** (`aws-0-<region>.pooler.supabase.com`), pas la connexion directe.
- **`invalid percent-encoded token`** : le mot de passe contient un caractère spécial non encodé. Utiliser `[uri]::EscapeDataString` comme ci-dessus.
- **Dump sans données** : le workflow vérifie la présence de `COPY`/`INSERT` ; s’il échoue, vérifier que `pg_dump` s’est bien exécuté et que la base contient des lignes.
- **Clé service_role régénérée** : mettre à jour `SUPABASE_SERVICE_ROLE_KEY` dans GitHub après toute rotation du JWT secret.
- **Artefact absent** : vérifier que le workflow a bien exécuté l’étape d’upload et que `AGE_PUBLIC_KEY` est une clé publique `age1...` valide.
- **Photos non restaurées** : vérifier que les chemins locaux correspondent exactement aux `photo_path` de la base, et que `attachments/` a bien été remis dans le bucket `attachments`.

## Bonnes pratiques

- Tester une restauration complète **une fois par trimestre** sur un projet temporaire.
- Ne jamais committer un dump, une photo ou la clé `age`.
- Supprimer l’archive déchiffrée après la restauration.
- Surveiller le quota d’artefacts GitHub ; avec beaucoup de photos, passer à Cloudflare R2.
- Si la clé `service_role` ou le token fuient, les révoquer immédiatement.
- Conserver la clé privée `age` hors ligne : elle est l’unique moyen de déchiffrer les archives.
