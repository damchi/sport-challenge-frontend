# Runbook du web

Procédures d'exploitation du site en production. La mise en place unique de l'infrastructure (Firebase Hosting, fédération d'identité, Environment GitHub) et le détail du workflow sont dans `docs/deploiement.md` ; ce document ne les répète pas.

| | |
|---|---|
| Site | `https://sport-challenge-prod.web.app` (Firebase Hosting, projet GCP `sport-challenge-prod`) |
| Workflow | `.github/workflows/deploy.yml` (Actions > Deploy) |
| Versions publiées | console Firebase > Hosting > Historique des versions (message = SHA du commit) |
| Backend | `../sport-challenge-api/docs/deploiement.md` (API de production, CORS) |

## 1. Variables d'environnement

L'application lit uniquement des variables `VITE_*` (`src/lib/config.ts`). Elles sont **toutes publiques** : `src/lib/config.ts` lit l'objet `import.meta.env` entier, que Vite copie donc tel quel dans le bundle, avec toutes les variables `VITE_*` présentes au moment du build. Aucune valeur secrète ne doit jamais porter ce préfixe, ni être fournie au job `build` du déploiement.

| Variable | Local (`.env.local`, copié de `.env.example`) | Tests (`pnpm test`, `pnpm e2e`) | Production (variables du dépôt GitHub) |
|---|---|---|---|
| `VITE_API_URL` | API locale (`http://localhost:…` admis) | valeur factice (`vite.config.ts`, `playwright.config.ts`) | adresse **https** de l'API de production |
| `VITE_AUTH0_DOMAIN` | `sport-challenge-prod.ca.auth0.com` | faux domaine (`e2e/fakeAuth0.ts`) | `sport-challenge-prod.ca.auth0.com` (puis le domaine personnalisé) |
| `VITE_AUTH0_CLIENT_ID` | application web **locale** du tenant | factice | application web **de production** |
| `VITE_AUTH0_AUDIENCE` | API **locale** dans Auth0 | factice | API **de production** dans Auth0 |
| `VITE_SENTRY_DSN` | vide (pas de suivi d'erreurs) | absente | facultative : DSN du projet Sentry du web |
| `VITE_MOCKS` | `true` pour travailler contre les mocks MSW | `false` (Playwright), non définie (Vitest) | **absente** (sans effet hors du serveur de développement) |

Un seul tenant Auth0 sert au local et à la production : ce sont les **Applications** et les **APIs** qui diffèrent. Une connexion locale qui échoue vient souvent d'un identifiant de production dans `.env.local`.

Le job `production` lit en plus les variables de l'Environment `production` (`GCP_PROJECT_ID`, `GCP_WORKLOAD_IDENTITY_PROVIDER`, `GCP_WEB_DEPLOY_SERVICE_ACCOUNT`, `WEB_URL`) : voir `docs/deploiement.md` §5.

**Changer une valeur de production** : Settings > Secrets and variables > Actions > Variables, puis redéployer (§2, « à la main »). La politique de contenu est recalculée à partir des mêmes variables : rien d'autre à modifier.

## 2. Déployer

**Prérequis** : la variable du dépôt `DEPLOY_PRODUCTION` vaut `true` (`docs/deploiement.md` §5, étape 4). Sinon les deux jobs du workflow sont ignorés, à la fusion comme à la main : rien n'est publié et rien n'échoue.

**Cas normal** : fusionner la pull request dans `main`. Une fois la CI verte, le workflow Deploy construit et publie le site, sans approbation : fusionner, c'est mettre en production.

1. Attendre la fin du job `production` (Actions > Deploy > le run du commit) : son test de fumée vérifie que le site sert ce build, avec la politique de contenu, `X-Frame-Options: DENY`, `sw.js` en `no-cache` et un 404 pour un fichier absent.
2. Ouvrir le site, se connecter, ouvrir un challenge.

Un run qui démarre après une fusion plus récente (en attente derrière un autre déploiement, ou relancé) est sauté (avis dans le journal) : c'est le run de la fusion suivante qui publie.

**À la main** (variable changée, redéploiement de la tête de `main`) :

```
gh workflow run deploy.yml --ref main
```

Le run publie directement, sans approbation.

**En cas d'échec** :

- job `build` : erreur du build ou du budget de taille. Corriger par une pull request ; rien n'a été publié.
- `Check firebase.json` : le fichier généré contient une clé inattendue. Rien n'a été publié ; regarder la dernière modification de `scripts/hostingConfig.ts`.
- `Publish` : droits GCP ou fédération (`docs/deploiement.md` §2). Rien n'a été publié.
- `Smoke test` : **la version est déjà publiée**. Lire l'erreur ; si le site est cassé, revenir en arrière (§3), puis corriger.

## 3. Revenir en arrière

**Le plus rapide, sans rebuild** : console Firebase > Hosting > Historique des versions > version précédente > **Restaurer**. Le message de chaque version est le SHA de son commit. Effet immédiat sur le CDN. La version restaurée garde **ses** valeurs `VITE_*` et **sa** politique de contenu : si une variable a changé depuis (adresse de l'API, domaine Auth0), republier plutôt par le workflow, qui reconstruit avec les variables actuelles.

**Par le workflow** (republier un commit précis de `main`) :

```
gh workflow run deploy.yml --ref main -f ref=<SHA complet d'un commit de main>
```

Le run publie directement. Le SHA doit être complet (40 caractères) et appartenir à `main`, sinon le build s'arrête.

Dans les deux cas :

- **la fusion suivante republie la tête de `main`** : corriger (ou annuler par `git revert` dans une pull request) avant de fusionner autre chose ;
- le retour arrière ne touche que les fichiers du site : une version du web qui suppose un changement d'API déjà déployé côté backend ne se règle pas ainsi (voir le runbook du backend) ;
- les navigateurs prennent la version restaurée au prochain chargement de page (§5).

## 4. Adresses Auth0 à déclarer

Dans le tenant `sport-challenge-prod` (Applications > l'application concernée > Settings), sans `/` final ; « Allowed Origins (CORS) » reste vide (Auth0 reprend alors les origines des adresses de rappel) :

| Application | Allowed Callback URLs | Allowed Logout URLs | Allowed Web Origins |
|---|---|---|---|
| web **de production** | `https://sport-challenge-prod.web.app/callback` | `https://sport-challenge-prod.web.app` | `https://sport-challenge-prod.web.app` |
| web **locale** | `http://localhost:5173/callback` | `http://localhost:5173` | `http://localhost:5173` |

- L'application rappelle `<origine>/callback` et revient à `<origine>` à la déconnexion (`src/lib/auth/Auth0AuthProvider.tsx`) ; l'origine web sert à la connexion silencieuse (iframe) et au renouvellement des jetons.
- Les tests de bout en bout utilisent un faux Auth0 : rien à déclarer pour eux.
- Ne jamais ajouter une adresse `localhost` à l'application de production.

**Nouveau domaine du site** (domaine personnalisé) : ajouter la nouvelle adresse dans les trois champs de l'application de production, l'ajouter à `CORS_ALLOWED_ORIGINS` de l'API (dépôt du backend), changer `WEB_URL` dans l'Environment `production`, déployer, puis retirer l'ancienne adresse une fois la nouvelle vérifiée. **Domaine personnalisé Auth0** : l'émetteur (`iss`) des jetons change, et l'API le déduit de son propre `AUTH0_DOMAIN`. Changer d'abord le backend (`AUTH0_DOMAIN` de l'API et des jobs, `AUTH0_MGMT_DOMAIN` ; voir `docs/auth0-setup.md` du backend), puis aussitôt `VITE_AUTH0_DOMAIN` et redéployer le web (la politique de contenu suit) ; sinon tous les appels à l'API répondent 401. Mettre ensuite à jour le §1.

## 5. Caches et leur invalidation

| Couche | Ce qu'elle garde | Invalidation |
|---|---|---|
| CDN de Firebase | toutes les réponses, selon leur `Cache-Control` | **automatique** à chaque publication ou restauration : rien à faire |
| Cache HTTP du navigateur | `/assets/**` un an (`immutable`) ; `index.html`, pages et `sw.js` revalidés à chaque fois (`no-cache`) | inutile : les fichiers de `/assets/` changent de nom (empreinte) à chaque build |
| Service worker (`public/sw.js`) | la page d'accueil et les fichiers de l'application, pour l'usage hors ligne | la nouvelle version est prise au prochain chargement de page ; « réseau d'abord » pour la page |

Conséquences :

- après une publication, une personne qui a l'app ouverte garde l'ancienne version jusqu'au prochain chargement (ouverture de l'app, rechargement) ;
- ne jamais servir `index.html` ou `sw.js` avec un cache long : ces règles sont dans `scripts/hostingConfig.ts`, vérifiées par ses tests et par le test de fumée ;
- un fichier d'une ancienne version demandé après publication répond 404, jamais `index.html`.

**Une personne voit encore une ancienne version** : recharger la page ; sinon, dans le navigateur, effacer les données du site (Réglages du site > Effacer les données) ou, sur ordinateur, outils de développement > Application > Service workers > Unregister.

**Le service worker lui-même pose problème** (pages blanches, version bloquée pour tout le monde) : publier le `sw.js` d'urgence de `docs/deploiement.md` (« Urgence : retirer le service worker ») par une pull request, puis déployer. Le rétablir ensuite par une nouvelle pull request.

## 6. Liste de contrôle avant ouverture

À dérouler avant d'envoyer les premières invitations, puis avant chaque version importante. Pas de pages légales ni de consentement à vérifier : l'app est réservée à un cercle d'amis (décision du 2026-11-20, SC-WEB-042 abandonné, README §6) ; à rouvrir si elle s'ouvre au-delà.

- [ ] **Jeux de test de bout en bout verts** : le job `end-to-end (Playwright)` de la CI est vert sur le commit déployé (Actions > CI > run de `main`). Ils couvrent connexion et onboarding, création de challenge, invitation, activité, classement, suppression de compte, clavier et accessibilité, en taille téléphone et bureau.
- [ ] **Suppression de compte testée** : couverte par `e2e/accountDeletion.spec.ts` (mocks) ; à faire aussi **une fois en production** avec un compte de test qui n'est le dernier créateur d'aucun challenge à venir ou en cours (sinon l'API refuse) : profil (`/me`) > « Supprimer mon compte », cocher la confirmation, écran « Compte supprimé », « Terminer » ramène à la connexion Auth0. Vérifier ensuite que l'utilisateur a disparu du tenant Auth0 (le backend le supprime, et rejoue l'appel en cas d'échec) et que le compte n'apparaît plus dans les challenges qu'il avait rejoints.
- [ ] **Aucune variable secrète dans le bundle** :
  - `grep -nE 'secrets *[.:[]|\( *secrets' .github/workflows/deploy.yml` ne renvoie rien (ni `secrets.X`, ni `secrets: inherit`, ni `toJSON(secrets)`) : le build ne reçoit que des variables du dépôt ;
  - `git ls-files '.env*'` ne liste que `.env.example` : un `.env` ou un `.env.production` versionné serait lu par le build de la CI ;
  - les variables `VITE_*` du dépôt sont exactement celles du §1, avec des valeurs publiques (adresses, identifiants publics, DSN Sentry) ;
  - sur l'**artefact réellement publié** (pas un build local, qui lit les `.env*` du poste) : `gh run download <run du Deploy> -n site -D <dossier vide>`, puis `grep -ohE '\{BASE_URL:[^}]*\}' <dossier>/dist/assets/*.js` donne **exactement une** correspondance, qui ne contient que `BASE_URL`, `DEV`, `MODE`, `PROD`, `SSR` et les variables du §1. Aucune correspondance invalide le contrôle (la lecture de `import.meta.env` dans `src/lib/config.ts` a changé) : l'adapter avant de conclure.
- [ ] **Mocks MSW désactivés en production** : sur le même artefact, `grep -rlIE 'mockServiceWorker|setupWorker|\[MSW\]' <dossier>/dist` ne renvoie rien et `dist/mockServiceWorker.js` n'existe pas. Garanti par le code (le démarrage des mocks est gardé par `import.meta.env.DEV` dans `src/main.tsx`, le worker n'est servi que par le serveur de développement dans `vite.config.ts`) ; à revérifier si l'un de ces deux fichiers change.
- [ ] Le test de fumée du dernier déploiement est vert et le site répond avec ses en-têtes (`curl -sI https://sport-challenge-prod.web.app/`).
- [ ] Adresses Auth0 (§4) et origine CORS du backend déclarées pour l'adresse réelle du site ; une connexion de bout en bout réussit en production, sur téléphone.
- [ ] Si `VITE_SENTRY_DSN` est renseignée : une erreur de test arrive dans Sentry sans nom, e-mail, jeton (d'accès ou d'invitation : l'adresse `/invite#…` arrive sans son fragment) ni adresse IP (option « Prevent Storing of IP Addresses » active sur le projet).
- [ ] La règle de `main` exige une pull request et la CI verte, interdit le push forcé et la suppression, sans contournement ; l'Environment `production` est limité à `main`, sans reviewer (déploiement automatique), sans contournement par les administrateurs, et la variable du dépôt `DEPLOY_PRODUCTION` vaut `true` (`docs/deploiement.md` §5).
