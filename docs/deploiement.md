# Déploiement du web

Il n'y a qu'un environnement déployé : la **production**, comme pour le backend (`../sport-challenge-api/docs/deploiement.md`). Le site est servi par **Firebase Hosting**, dans le projet GCP `sport-challenge-prod`. Il n'y a pas de staging : il pourra être recréé avec celui du backend.

L'infrastructure est **configurée à la main** ; ce document la décrit. Le workflow ne fait que construire et publier le site.

## Ce qui est déployé

| Élément | Où |
|---|---|
| Site | Firebase Hosting, site par défaut du projet (`sport-challenge-prod.web.app`) ; domaine personnalisé possible ensuite |
| Contenu | le build de production (`dist/`) : fichiers statiques, aucune donnée personnelle |
| Configuration | `firebase.json`, **généré** après le build par `pnpm hosting:config` (`scripts/hostingConfig.ts`), non versionné |
| Workflow | `.github/workflows/deploy.yml` |
| CLI Firebase | `ci/firebase/` : `firebase-tools` épinglé avec son propre lockfile, outil de la CI seulement (pas une dépendance de l'application) |

Les fichiers statiques sont servis par le CDN mondial de Firebase. Ils ne contiennent aucune donnée d'utilisateur : la cible « données à Montréal » du backend ne les concerne pas.

## Configuration de l'hébergement

Toutes les règles sont dans `scripts/hostingConfig.ts`, testé par la CI :

- **Réécriture** vers `index.html` pour les adresses de l'application (sans point). Un fichier absent (fichier d'une ancienne version, `sw.js`, manifeste, icône) renvoie **404**, jamais `index.html` : le service worker ne garde ainsi jamais une page HTML à la place d'un script.
- **Cache** : `no-cache` pour les pages, `index.html` et `sw.js` (une nouvelle version se voit tout de suite, correctif d'urgence compris) ; `public, max-age=31536000, immutable` pour `/assets/**` (les noms portent une empreinte).
- `manifest.webmanifest` servi en `application/manifest+json`.
- **En-têtes de sécurité** sur toutes les réponses : `Content-Security-Policy`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`.
- **Politique de contenu**, calculée à partir des mêmes variables `VITE_*` que le build : scripts du site et empreinte du script de thème de `index.html` ; connexions vers le site, l'API, Auth0 et l'hôte de Sentry ; iframe d'Auth0 (restauration de session) ; workers du site et `blob:` (le SDK Auth0 garde le jeton de rafraîchissement dans un worker créé depuis un blob) ; `frame-ancestors 'none'` contre le clickjacking (PR #95).

Une adresse qui change (API, Auth0, Sentry) se change donc seulement dans les variables `VITE_*` du dépôt.

## Workflow

| Événement | Production |
|---|---|
| Fusion dans `main`, CI verte | part **automatiquement**, sans approbation |
| `workflow_dispatch` sans `ref` | redéploie la tête de `main` |
| `workflow_dispatch` avec `ref` (retour arrière) | redéploie ce commit de `main` |

**Aucune validation humaine** avant la production (décision du 2026-11-21, SC-WEB-066) : un déploiement part dès qu'une personne ayant le droit d'écriture sur le dépôt fusionne une pull request dans `main` ou lance le workflow à la main, y compris vers un ancien commit de `main` (retour arrière). Ce risque est accepté parce que le dépôt n'a qu'un mainteneur ; le droit d'écriture est donc la vraie barrière, à réserver à des personnes de confiance. Pour remettre une validation, rétablir les **Required reviewers** de l'Environment (§5).

L'Environment `production` reste : limité à `main`, il porte les variables du job de publication et c'est lui que la fédération d'identité autorise (`environment:production`).

Deux jobs, pour que le code de l'application et de ses dépendances ne s'exécute jamais avec des droits GCP :

1. **`build`**, sans aucun droit ni Environment :
   - vérifie que `ref` est un SHA complet et que le commit appartient à `main`, avant d'exécuter le moindre code du commit ;
   - `pnpm build` avec les variables `VITE_*` du dépôt, `pnpm bundle:check`, puis `pnpm hosting:config` ;
   - garde `dist/` et `firebase.json` comme artefact.
2. **`production`**, dans l'Environment `production` ; seul job à pouvoir obtenir le jeton OIDC (`id-token: write`) :
   - si le job démarre après une fusion plus récente (en attente derrière un autre déploiement, ou relancé), ce déploiement est sauté : celui de la fusion suivante le remplace (jamais une version plus ancienne après une plus récente). Un retour arrière n'est pas concerné ;
   - installe la CLI Firebase depuis `ci/firebase/` (`--frozen-lockfile --ignore-scripts`, sans cache de dépendances), puis récupère l'artefact dans un dossier à part (`site/`) : l'artefact ne peut écraser ni la CLI ni le fichier d'identifiants ;
   - vérifie `firebase.json` **avant** l'authentification : seules les clés que `scripts/hostingConfig.ts` écrit sont acceptées, `public` vaut `dist`, les réécritures mènent à un fichier. Un build compromis ne peut ainsi ni faire exécuter une commande (`predeploy`) avec les droits GCP, ni publier autre chose que `dist/` ;
   - authentification à GCP par **Workload Identity Federation** : le jeton OIDC du job est échangé contre les droits du compte `sc-web-deploy`. Aucune clé JSON, aucun secret ;
   - publication ; le message de la version Firebase est le SHA du commit ;
   - **test de fumée** : le site sert bien ce build (script d'entrée de `index.html`), avec la politique de contenu (`frame-ancestors 'none'`) et `X-Frame-Options: DENY` ; `sw.js` est en `no-cache` ; un fichier absent répond 404.

Un seul déploiement à la fois, jamais annulé en cours. Permissions minimales : `contents: read`, et `id-token: write` seulement dans le job `production`. Actions épinglées par SHA.

Mettre à jour la CLI Firebase : changer la version dans `ci/firebase/package.json`, puis `pnpm install --dir ci/firebase --ignore-workspace --lockfile-only`, et committer le lockfile.

Retour arrière rapide sans rebuild : la console Firebase (Hosting > Historique des versions > Restaurer). Le workflow suivant republie la tête de `main`.

Procédures d'exploitation (déploiement, retour arrière, caches, liste de contrôle avant ouverture) : `docs/runbook.md`.

## Mise en place (à la main, une seule fois)

### 1. Firebase Hosting

1. Console Firebase > **Ajouter un projet** > choisir le projet GCP existant `sport-challenge-prod` (sans Google Analytics).
2. **Hosting** > Commencer : le site par défaut `sport-challenge-prod` est créé. Rien à déployer depuis un poste : le premier déploiement vient du workflow.

### 2. Compte de déploiement et fédération

```
P=sport-challenge-prod; PN=<numéro du projet>
POOL=projects/$PN/locations/global/workloadIdentityPools/github-prod
SA=sc-web-deploy@$P.iam.gserviceaccount.com

gcloud iam service-accounts create sc-web-deploy --project=$P \
  --display-name="Déploiement du web (GitHub Actions)"
gcloud projects add-iam-policy-binding $P --member=serviceAccount:$SA \
  --role=roles/firebasehosting.admin --condition=None
# La CLI vérifie que l'API Firebase Hosting est activée avant de déployer
# (sinon : 403 « Permission denied to get service [firebasehosting.googleapis.com] »)
gcloud projects add-iam-policy-binding $P --member=serviceAccount:$SA \
  --role=roles/serviceusage.serviceUsageConsumer --condition=None

# Fournisseur du dépôt web, dans le pool du backend : le seul job de
# l'Environment production, sur main, de ce dépôt (identifiant numérique compris),
# dans le workflow de déploiement (aucun autre workflow de main)
gcloud iam workload-identity-pools providers create-oidc github-web-provider \
  --workload-identity-pool=github-prod --location=global --project=$P \
  --issuer-uri=https://token.actions.githubusercontent.com \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --attribute-condition="assertion.repository_id == '1438466700' && \
assertion.repository == 'damchi/sport-challenge-frontend' && assertion.ref == 'refs/heads/main' && \
assertion.environment == 'production' && \
assertion.job_workflow_ref == 'damchi/sport-challenge-frontend/.github/workflows/deploy.yml@refs/heads/main'"
gcloud iam service-accounts add-iam-policy-binding $SA --project=$P \
  --role=roles/iam.workloadIdentityUser \
  --member="principal://iam.googleapis.com/$POOL/subject/repo:damchi@38217786/sport-challenge-frontend@1438466700:environment:production"
```

Le dépôt utilise les sujets OIDC **immuables** de GitHub (`gh api repos/damchi/sport-challenge-frontend/actions/oidc/customization/sub`) : le sujet de la liaison doit être exactement celui-là.

### 3. Auth0 (application web de production)

Dans l'application web **de production** du tenant (pas celle du local), avec l'adresse du site (`https://sport-challenge-prod.web.app`, puis le domaine personnalisé) :

- **Allowed Callback URLs** : `<site>/callback`
- **Allowed Logout URLs** : `<site>`
- **Allowed Web Origins** : `<site>`

### 4. Backend

Ajouter l'origine du site à `CORS_ALLOWED_ORIGINS` de l'API de production (`../sport-challenge-api/docs/deploiement.md`). C'est un changement du backend, fait dans son propre dépôt.

### 5. GitHub

Toutes ces valeurs sont des **variables**, pas des secrets : elles sont publiques et finissent dans le bundle, dans la politique de contenu ou dans les journaux.

1. **Environment** `production` (Settings > Environments), avec les variables du job de publication :

   | Variable | Valeur |
   |---|---|
   | `GCP_PROJECT_ID` | `sport-challenge-prod` |
   | `GCP_WORKLOAD_IDENTITY_PROVIDER` | `projects/<numéro du projet>/locations/global/workloadIdentityPools/github-prod/providers/github-web-provider` |
   | `GCP_WEB_DEPLOY_SERVICE_ACCOUNT` | `sc-web-deploy@sport-challenge-prod.iam.gserviceaccount.com` |
   | `WEB_URL` | `https://sport-challenge-prod.web.app` (sans `/` final) |

   **Deployment branches = Selected branches, `main` seulement**, sans **Required reviewers** (déploiement automatique, SC-WEB-066). L'Environment ne contrôle donc plus que la branche : il ne demande aucune validation, et **Allow administrators to bypass configured protection rules** (décoché) ne protège plus que cette restriction à `main`.
2. **Variables du dépôt** (Settings > Secrets and variables > Actions > Variables), lues par le job `build`, qui n'a pas d'Environment :

   | Variable | Valeur |
   |---|---|
   | `VITE_API_URL` | adresse de l'API de production |
   | `VITE_AUTH0_DOMAIN` | `sport-challenge-prod.ca.auth0.com` (puis le domaine personnalisé) |
   | `VITE_AUTH0_CLIENT_ID` | identifiant de l'application web de production |
   | `VITE_AUTH0_AUDIENCE` | identifiant de l'API de production dans Auth0 |
   | `VITE_SENTRY_DSN` | facultatif : DSN du projet Sentry du web |

3. **Règle de la branche `main`** (Settings > Rules > Rulesets, `main: pull request required`) : pull request obligatoire, sans liste de contournement. Aucun push direct ne part ainsi en production sans pull request ni CI. Aucune approbation n'est exigée : le dépôt n'a qu'un mainteneur, qui doit pouvoir fusionner ses propres pull requests.
4. **Variable du dépôt** `DEPLOY_PRODUCTION=true`, une fois l'Environment et la fédération d'identité en place. Tant qu'elle ne vaut pas `true`, les deux jobs sont ignorés :
   ```
   gh variable set DEPLOY_PRODUCTION --body true
   ```

## Urgence : retirer le service worker

Si une version du service worker pose problème, publier à sa place un `public/sw.js` qui vide les caches et se désinscrit, puis le déployer comme une version normale. Grâce à `no-cache`, les navigateurs le prennent au prochain chargement :

```js
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.map((name) => caches.delete(name))))
      .then(() => self.registration.unregister())
      .then(() => self.clients.matchAll())
      .then((clients) => clients.forEach((client) => client.navigate(client.url))),
  );
});
```
