# Backlog frontend (web, V1) — Sport Challenge

Tickets de développement de l'application **web** (React + Vite), rédigés comme des tickets Jira. Ils servent de feuille de route dans Claude Code : **un ticket = un commit**. Le mobile (Expo) viendra en V2 : aucun ticket mobile ici, et pas de monorepo avant ce moment-là.

Sources de vérité : `README.md` (règles et architecture), `CLAUDE.md` (conventions) et le README du backend pour les règles du produit. En cas de contradiction, signale-la à l'utilisateur.

## Les tickets vivent dans GitHub

`TASKS.md` est la **source d'import** et le document de référence (conventions, décisions, épopées, critères détaillés). Une fois importés, chaque ticket est une **issue GitHub** : c'est l'issue qui fait foi pour le statut, les cases à cocher et les dépendances. **Ne mets plus à jour les statuts de ce fichier.**

Mise en place, une seule fois, par toi, depuis la racine du dépôt :

1. `gh auth login`, puis `gh auth refresh -s project` (droit d'écrire dans les GitHub Projects).
2. `python3 .claude/scripts/tasks.py import --dry-run` : liste ce qui serait créé, sans rien créer.
3. `python3 .claude/scripts/tasks.py import --done 075` (remplace par les numéros des tickets déjà faits à la main) : crée les étiquettes, une issue par ticket et le GitHub Project « Sport Challenge », partagé avec l'autre dépôt (il est retrouvé par son titre). Sûr à relancer : un ticket déjà présent n'est jamais recréé.

Correspondance avec les anciens statuts :

| Ancien statut | Dans GitHub |
|---|---|
| À faire | issue ouverte (statut « Todo » du Project) |
| En cours | étiquette `en-cours` et statut « In Progress » |
| Fait | issue **fermée**, automatiquement à la fusion de la pull request qui contient `Closes #N` |
| Reporté (V1.1) | étiquette `v1.1` |
| Bloqué | étiquette `blocked` |
| À valider | étiquette `needs-decision` |

Épopée, type, phase et points sont des étiquettes (`E1`, `type:story`, `phase:1`, `points:3`). L'ordre de traitement est le numéro d'issue (l'ordre du fichier) ; les dépendances sont écrites dans l'issue (`Dépend de : #12 (SC-WEB-002)`).

## Comment travailler avec les tickets dans Claude Code

1. Lance le skill `/next-task` (ou « prends le ticket SC-WEB-0xx ») : `python3 .claude/scripts/tasks.py next` donne la première issue ouverte dont les dépendances sont fermées, hors reportées, bloquées et en cours.
2. Claude lit l'issue (`gh issue view`), relit les sections du README citées, la marque « en cours » (`tasks.py start`) et annonce un court plan.
   Si l'API du ticket n'est pas encore disponible (champ **Backend**), il travaille contre les **mocks MSW** (ticket 010) et le signale.
3. Implémentation, puis `pnpm check` (et les tests de bout en bout pour un parcours critique).
4. Revue par les agents indiqués.
5. Claude coche les critères dans l'issue (`tasks.py tick`), puis **propose** (sans l'exécuter) les fichiers et le message de commit, qui se termine par `Closes #N`. **Aucun commit ni push sans ton accord explicite.**
6. Tu relis, tu commits, tu ouvres la pull request ; l'issue se ferme à la fusion et le ticket suivant devient disponible.

## Conventions

- **Estimation** en points : 1, 2, 3, 5 (un ticket à 8 doit être découpé).
- **Statut** : voir le tableau de correspondance ci-dessus (issue ouverte, étiquettes `en-cours`, `v1.1`, `blocked`, `needs-decision`, issue fermée). La ligne `Statut` de chaque ticket ci-dessous ne sert qu'à l'import.
- **Commits** : Conventional Commits en anglais (`feat`, `fix`, `refactor`, `test`, `docs`, `chore`), scope = fonctionnalité, 72 caractères au plus, `Closes #N` (numéro de l'issue) puis `Refs: SC-WEB-0xx` en pied.
- **Routes web** : `/` accueil · `/challenges/new` · `/challenges/:id` (onglets classement, participants, activités) · `/activities/new` · `/me` · `/invite/:token` · `/onboarding` · `/callback`.
- **Définition de terminé** :
  - [ ] Critères d'acceptation remplis
  - [ ] `pnpm check` passe (typecheck, lint, tests)
  - [ ] Aucune chaîne en dur : clés FR **et** EN présentes
  - [ ] États gérés : chargement, erreur avec réessai, vide, connexion requise
  - [ ] Aucun appel HTTP dans un composant (hooks de `src/api` uniquement)
  - [ ] **Aucun code inutilisé** : chaque composant, fonction, schéma, clé de traduction, variable d'environnement ou dépendance ajouté est utilisé par ce ticket
  - [ ] Téléphone d'abord (360 px), zones tactiles d'au moins 44 px, thème clair et sombre, libellés accessibles
  - [ ] Aucune donnée personnelle ni jeton dans les logs ; aucun secret dans le bundle
  - [ ] Agents de revue lancés, points bloquants corrigés
  - [ ] README mis à jour **seulement** si l'utilisateur a validé un changement de règle

## Principe : pas de code d'avance

L'arborescence du README §4.1 est la **cible**. Un ticket ne crée un dossier, un composant, une fonction, un schéma, une clé de traduction, un gestionnaire de mock, une variable d'environnement ou une dépendance que si **ce ticket** l'utilise. Les composants d'interface, les formateurs, les schémas, les mocks et les clés `errors.<code>` arrivent donc **avec le premier écran qui en a besoin**. La liste « Tickets fusionnés » ci-dessous montre où chaque ancien ticket de préparation est passé. Si un besoin n'était pas prévu, ajoute-le dans le ticket en cours et signale-le.

## Traduction des erreurs de l'API

Une clé `errors.<code>` est ajoutée, en français **et** en anglais, par le ticket qui rencontre le code ; `errors.unknown` sert de repli. Catalogue prévu :

`unauthenticated`, `invalid_token`, `token_expired`, `forbidden`, `not_found`, `validation_failed`, `rate_limited`, `internal_error`, `profile_incomplete`, `account_deleted`, `challenge_not_found`, `field_not_editable`, `registration_closed`, `already_participant`, `participation_abandoned`, `challenge_ended`, `cannot_exclude_creator`, `not_active_participant`, `last_creator`, `activity_not_found`, `activity_overlap`, `week_locked`, `distance_not_allowed`, `distance_required`, `invitation_invalid`.

Il n'y a pas de code `activity_outside_window` : une activité hors de la fenêtre de tout challenge est enregistrée et ne compte nulle part pour l'instant ; elle comptera dans un challenge rejoint plus tard dont la fenêtre la contient (ADR 0001 de l'API).

## Tickets fusionnés (anciens tickets de préparation)

Ces numéros n'existent plus comme tickets : leur contenu est entré dans le ticket qui s'en sert en premier. Les autres numéros sont inchangés.

| Ancien ticket | Où il est passé |
|---|---|
| 002 Application web Vite | 001 (et plus de monorepo) |
| 004 Vitest, Testing Library, MSW | 001 (Vitest et Testing Library), 010 (MSW) |
| 006 Configuration d'environnement | 008 (`VITE_API_URL`), 016 (Auth0), 045 (Sentry) |
| 011 Domaine et formateurs | 018, 020, 021 à 023, 030, 034 (chacun crée ce qu'il utilise) |
| 013 Jetons de design et thèmes | 003 |
| 014 Composants réutilisables et états d'écran | 018, 020, 022, 025 (chacun crée ce qu'il utilise) |

Tickets déplacés : 015 (PWA) en fin de parcours, 012 (réduit à la mise en place de l'i18n). Nouveaux : 052 (Claude relecteur des pull requests), 053 (nom et prénom à l'onboarding, e-mail du jeton, affichés dans le profil).

## Décisions à confirmer

| # | Point | Proposition utilisée dans le backlog | Tickets |
|---|---|---|---|
| FD1 ✅ | Bibliothèque d'interface | **Tailwind CSS v4** et polices Fontsource, validés au ticket 003 ; composants de type shadcn/ui, ajoutés un par un à l'usage, encore à valider | 003 |
| FD2 | Hébergement du web | Firebase Hosting (CDN, réécriture pour une application monopage) ; sinon Cloud Storage avec CDN | 047 |
| FD3 ✅ | Structure du dépôt | **Une seule application Vite**, sans monorepo en V1 ; passage en monorepo pnpm en V2, à l'arrivée du mobile | 001 |
| FD4 ✅ | État local | Aucune bibliothèque d'état global : TanStack Query pour les données, contextes React pour la session, la langue et les messages ; validé au ticket 009 | 009, 016 |
| FD5 ✅ | Champs date et heure | **Champs HTML natifs** (`date`, `datetime-local`) ; fuseaux via `Intl` ; validé au ticket 022 | 022, 034 |
| FD6 ✅ | Génération du client d'API | **`openapi-typescript`** pour les types, validé au ticket 007 ; `openapi-fetch` et hooks TanStack Query écrits à la main, avec le premier écran qui appelle l'API | 007 |
| FD7 ✅ | Formulaires | `react-hook-form` avec schémas `zod` (`src/domain/schemas`), validé au ticket 018 | 018, 021 |

## Épopées

Total : **150 points** (47 tickets), dont **137 pour la V1** ; les 13 points de l'épopée F10 sont reportés en V1.1 (décision D10 : badges et upload d'avatar).

| Épopée | Contenu | Tickets |
|---|---|---|
| F0 | Fondations minimales et CI | 001, 003, 005, 052 |
| F1 | Contrat et client d'API | 007, 008, 009, 010 |
| F2 | Internationalisation | 012 |
| F3 | Authentification et coque | 016, 017, 018, 019 |
| F4 | Accueil et challenges | 020, 021, 022, 023, 024, 025, 026, 027, 028, 029 |
| F5 | Classement | 030, 031, 032, 033 |
| F6 | Activités | 034, 035, 036, 037 |
| F7 | Invitations | 038, 039 |
| F8 | Profil et compte | 040, 053, 041, 042 |
| F9 | Qualité et livraison | 043, 044, 045, 046, 015, 047, 048 |
| F10 | Reportés en V1.1 (avatar, badges) | 049, 050, 051 |

---

# F0 — Fondations minimales et CI

### SC-WEB-001 · Application Vite + React + TypeScript
`F0` · Task · Phase 0 · Estimation 3 · Dépend de : — · Backend : —

**Description** : une seule application, un seul `package.json`. Pas de monorepo en V1 : il sera créé en V2, quand l'application mobile arrivera (décision FD3). Les dossiers de `src/` naissent avec leur premier fichier utile.

**Critères d'acceptation**
- [ ] Projet Vite + React + TypeScript **strict**, gestionnaire `pnpm`, `.gitignore`, `README.md` et `CLAUDE.md` à la racine.
- [ ] Scripts : `dev`, `build`, `typecheck`, `lint`, `format`, `test`, `check` (typecheck + lint + test). Les scripts `api:*` et `e2e` seront ajoutés par les tickets 007 et 043.
- [ ] ESLint et Prettier configurés ; Vitest et Testing Library configurés.
- [ ] React Router avec la route `/` et une page 404 ; la page d'accueil est un simple titre pour l'instant.
- [ ] `.env.example` ne liste que les variables déjà lues par le code (aucune pour l'instant) ; chaque ticket ajoute les siennes.
- [ ] **Aucun** dossier ni fichier vide créé d'avance.
- [ ] `pnpm dev` affiche la page ; `pnpm build` produit un bundle.

**Tests** : un test de rendu de l'application (page d'accueil et page 404).
**Revue** : `ts-reviewer`.
**Commit** : `chore: scaffold Vite React TypeScript app`
**Statut** : À faire

### SC-WEB-003 · Tailwind CSS, jetons de design et thèmes
`F0` · Task · Phase 0 · Estimation 3 · Dépend de : 001 · Backend : —

**Description** : mise en place de la bibliothèque d'interface (FD1, à confirmer avant installation) et des jetons de design. Les composants (bouton, champ, carte, boîte de dialogue, onglets…) ne sont **pas** installés d'avance : chaque ticket ajoute ceux dont il a besoin, un par un.

**Critères d'acceptation**
- [ ] Tailwind configuré avec les jetons de design (couleurs, espacements, rayons) en variables CSS.
- [ ] Thèmes clair et sombre par variables CSS, suivant la préférence du système (le choix manuel viendra avec la coque, ticket 019).
- [ ] Mise en page conçue pour **360 px** d'abord, puis tablette et ordinateur ; zones tactiles d'au moins 44 px, contraste suffisant, focus visible.
- [ ] Aucune couleur en dur dans les composants.
- [ ] Justification de chaque dépendance ajoutée, soumise à l'utilisateur.

**Tests** : rendu de la page d'accueil dans les deux thèmes.
**Revue** : `ts-reviewer`, `ux-reviewer`.
**Commit** : `feat(web): add Tailwind CSS, design tokens and themes`
**Statut** : À faire

### SC-WEB-005 · CI GitHub Actions
`F0` · Task · Phase 0 · Estimation 2 · Dépend de : 001 · Backend : —

**Description** : mise en place tôt, pour que chaque pull request soit testée dès le début. L'étape des tests de bout en bout s'ajoutera au ticket 043.

**Critères d'acceptation**
- [ ] Workflow `.github/workflows/ci.yml` sur `push` et `pull_request` : installation avec cache pnpm, `typecheck`, `lint`, `test`, `build`.
- [ ] Permissions minimales du jeton de la CI (`contents: read`) ; aucun secret requis.
- [ ] Protection de `main` documentée : pull request obligatoire et CI verte avant fusion (réglage fait par l'utilisateur dans GitHub).

**Revue** : `security-reviewer`.
**Commit** : `chore(ci): add GitHub Actions pipeline`
**Statut** : À faire

### SC-WEB-052 · [Ops] Claude comme relecteur des pull requests
`F0` · Ops · Phase 0 · Estimation 1 · Dépend de : 001 · Backend : —

**Description** : tâche manuelle avec l'utilisateur, identique à SC-API-075 pour ce dépôt. Elle peut déjà avoir été faite : vérifier l'existant avant de refaire quoi que ce soit.

**Critères d'acceptation**
- [ ] Application GitHub de Claude installée sur le dépôt (`/install-github-app` dans Claude Code, ou installation manuelle).
- [ ] Secret du dépôt créé (jeton de l'abonnement ou clé d'API) ; aucun secret dans le dépôt.
- [ ] Workflow `.github/workflows/claude-review.yml` sur `pull_request`, qui relit le diff selon `CLAUDE.md` et le README.
- [ ] Vérifié sur une pull request de test ; Claude commente seulement, sans droit de fusion.

**Revue** : `security-reviewer`.
**Commit** : `ci: add Claude pull request review workflow`
**Statut** : À faire

---

# F1 — Contrat et client d'API

### SC-WEB-007 · Synchronisation du contrat et génération du client
`F1` · Task · Phase 1 · Estimation 3 · Dépend de : 001 · Backend : `api/openapi.yaml` (tickets API de chaque route)

**Critères d'acceptation**
- [ ] `pnpm api:sync` copie `openapi.yaml` depuis `../backend/api/openapi.yaml` s'il existe, sinon depuis l'adresse fournie ; la copie est versionnée dans `openapi/openapi.yaml`.
- [ ] `pnpm api:generate` produit les types dans `src/api/generated/` (jamais modifié à la main). Les scripts `api:sync` et `api:generate` sont ajoutés au `package.json` par ce ticket.
- [ ] Si le contrat du backend n'existe pas encore, un contrat **provisoire** est rédigé avec l'utilisateur et sert de base aux mocks.
- [ ] Un changement incompatible détecté dans le diff du contrat est signalé avant de continuer.

**Revue** : `ts-reviewer`.
**Commit** : `feat(api): add OpenAPI sync and type generation`
**Statut** : À faire

### SC-WEB-008 · Client HTTP : jeton, erreurs normalisées, 401
`F1` · Task · Phase 1 · Estimation 3 · Dépend de : 007 · Backend : format d'erreur (SC-API-018)

**Critères d'acceptation**
- [ ] `src/lib/config.ts` : lit `VITE_API_URL` (ajoutée à `.env.example`), échec clair au démarrage si elle manque ; les variables `VITE_*` sont **publiques**, aucun secret.
- [ ] `src/api/client.ts` : instance HTTP avec l'adresse de l'API, ajout du jeton d'accès (`Authorization: Bearer`).
- [ ] Toute erreur devient `{ code, status, params, requestId }` d'après `{ "error": { "code", "message", "params", "request_id" } }`.
- [ ] 401 : une tentative de renouvellement de session, puis déconnexion et vidage du cache.
- [ ] 429 : message `errors.rate_limited` avec le délai de réessai si fourni.
- [ ] Aucun jeton dans les logs.

**Tests** : variable manquante, erreurs 4xx et 5xx, 401 avec renouvellement, réponse sans corps.
**Revue** : `ts-reviewer`, `security-reviewer`.
**Commit** : `feat(api): add HTTP client with token injection and error normalization`
**Statut** : À faire

### SC-WEB-009 · TanStack Query : client, clés de requête, erreurs globales
`F1` · Task · Phase 1 · Estimation 2 · Dépend de : 008 · Backend : —

**Critères d'acceptation**
- [ ] `QueryClient` configuré (nouvelle tentative limitée, `staleTime` court pour le classement).
- [ ] Clés de requête **centralisées** dans `src/api/queryKeys.ts` et hiérarchiques (`['challenges', id, 'leaderboard', categoryId]`) ; le fichier grandit avec les hooks : chaque ticket y ajoute les siennes.
- [ ] Gestion globale des erreurs : une erreur d'authentification déclenche la déconnexion ; les autres s'affichent traduites.
- [ ] Limite d'erreur React (page d'erreur avec réessai).

**Tests** : clés, invalidation, erreur globale.
**Revue** : `ts-reviewer`.
**Commit** : `feat(api): configure TanStack Query and central query keys`
**Statut** : À faire

### SC-WEB-010 · MSW : serveur de test et mocks de développement
`F1` · Task · Phase 1 · Estimation 2 · Dépend de : 007 · Backend : —

**Description** : permet de développer et tester les écrans avant que le backend soit prêt. Les gestionnaires sont ajoutés **par chaque ticket pour les routes qu'il utilise** (pas d'inventaire complet d'avance).

**Critères d'acceptation**
- [ ] MSW installé : serveur de test réutilisable et utilitaire de rendu avec les fournisseurs (requêtes, langue, routeur) pour les tests de composants.
- [ ] Démarrage optionnel en développement (`VITE_MOCKS=true`, variable ajoutée à `.env.example`) ; jamais actif en production.
- [ ] Les mêmes gestionnaires servent au développement et aux tests ; la date est injectable (aucun test ne dépend de l'heure réelle).
- [ ] Un premier gestionnaire de démonstration pour valider le montage.

**Tests** : un test de composant et un test de hook utilisant MSW.
**Revue** : `ts-reviewer`.
**Commit** : `chore(test): add MSW test server and optional dev mocks`
**Statut** : À faire

---

# F2 — Internationalisation

### SC-WEB-012 · i18n : français et anglais
`F2` · Task · Phase 2 · Estimation 2 · Dépend de : 001 · Backend : —

**Description** : nécessaire dès le premier écran avec du texte. Les clés sont ajoutées **par les tickets qui les utilisent** (y compris les clés `errors.<code>`, une par code réellement rencontré).

**Critères d'acceptation**
- [ ] i18next avec `src/i18n/fr.json` et `src/i18n/en.json`, initialisé dans `main.tsx`.
- [ ] Langue de l'appareil par défaut, choix mémorisé dans le profil (ticket 040) ; langue de repli : **anglais** (✅ validé au ticket 012).
- [ ] Script de contrôle : mêmes clés dans les deux langues, intégré à `pnpm check`.
- [ ] Clé de repli `errors.unknown`.
- [ ] Pluriels et variables par i18next, jamais de concaténation de morceaux de phrase.
- [ ] La page 404 du ticket 001 passe par les traductions.

**Tests** : parité des clés, pluriels, erreur inconnue.
**Revue** : `ts-reviewer`, `ux-reviewer`.
**Commit** : `feat(i18n): add French and English setup with key parity check`
**Statut** : À faire

---

# F3 — Authentification et coque

### SC-WEB-016 · `AuthProvider` et Auth0
`F3` · Story · Phase 3 · Estimation 5 · Dépend de : 008, 012 · Backend : tenant Auth0 (SC-API-015), validation du jeton (SC-API-017, 018)

**Critères d'acceptation**
- [ ] Variables `VITE_AUTH0_DOMAIN`, `VITE_AUTH0_CLIENT_ID` et `VITE_AUTH0_AUDIENCE` ajoutées à `src/lib/config.ts` et à `.env.example`.
- [ ] Interface `AuthProvider` (connecté, utilisateur, connexion, déconnexion, jeton d'accès) avec un double de test ; implémentation `@auth0/auth0-react` (flux Authorization Code avec PKCE).
- [ ] L'application demande l'**access token de l'API** (audience `VITE_AUTH0_AUDIENCE`), pas seulement l'ID token.
- [ ] Connexion par la page de connexion Auth0 (Universal Login), avec les méthodes activées dans Auth0 : en V1, code à usage unique par e-mail seulement (✅ décision du backend, `docs/auth0-setup.md`) ; Google et Apple s'ajouteront dans Auth0 sans changement du frontend.
- [ ] Jetons gardés en mémoire (recommandation du SDK), jamais dans l'URL ni dans les logs.
- [ ] Route `/callback` qui termine la connexion et renvoie vers la page demandée.

**Tests** : connexion, déconnexion, renouvellement, double de test.
**Revue** : `ts-reviewer`, `security-reviewer`.
**Commit** : `feat(auth): add Auth0 authentication provider`
**Statut** : À faire

### SC-WEB-017 · Routes protégées et session
`F3` · Story · Phase 3 · Estimation 2 · Dépend de : 016 · Backend : SC-API-020

**Critères d'acceptation**
- [ ] Toute l'application est protégée (connexion obligatoire) ; `/callback` et la page d'invitation gèrent la redirection de connexion et le retour.
- [ ] Session expirée : reconnexion silencieuse puis redirection.
- [ ] La déconnexion efface le cache de requêtes et les données locales.
- [ ] Compte supprimé (`account_deleted`) : message dédié et déconnexion.

**Tests** : accès sans session, session expirée, déconnexion.
**Revue** : `ts-reviewer`, `security-reviewer`.
**Commit** : `feat(auth): add protected routes and session handling`
**Statut** : À faire

### SC-WEB-018 · Onboarding du profil
`F3` · Story · Phase 3 · Estimation 3 · Dépend de : 017, 012 · Backend : `GET` et `PATCH /me` (SC-API-021)

**Critères d'acceptation**
- [ ] Si `profile_complete` est faux, redirection vers `/onboarding` : pseudo (3 à 20 caractères, unique), langue.
- [ ] Validation en ligne avec le schéma de profil de `src/domain/schemas` (créé ici ; pseudo : 3 à 20 caractères parmi lettres, chiffres, `_`, `.`, `-`) ; conflit de pseudo affiché sous le champ.
- [ ] Composant avatar **à initiales** (créé ici) (l'upload viendra en V1.1).
- [ ] Création et participation bloquées tant que le profil est incomplet (`profile_incomplete`).

**Tests** : pseudo invalide, pseudo déjà pris, succès et redirection.
**Revue** : `ts-reviewer`, `ux-reviewer`.
**Commit** : `feat(profile): add profile onboarding`
**Statut** : À faire

### SC-WEB-019 · Coque de l'application
`F3` · Story · Phase 3 · Estimation 3 · Dépend de : 003, 017 · Backend : —

**Critères d'acceptation**
- [ ] Mise en page : barre de navigation basse sur téléphone, haute sur grand écran, avec les onglets de `docs/design/design.md` : **Défis, Activités, Profil** (✅ décision du propriétaire au ticket 019, à la place de « Accueil, Créer, Profil » ; créer un défi se fait depuis l'accueil). Icônes **Lucide** (`lucide-react`, ✅ validé au ticket 019). La page Activités reste une page d'attente jusqu'à son ticket.
- [ ] Sélecteur de langue et de thème (choix manuel du thème mémorisé), avec le bouton « Se déconnecter » (`useSignOut` de SC-WEB-017), dans l'onglet Profil (✅ décision du propriétaire au ticket 019).
- [ ] Pages 404 et d'erreur globale traduites.
- [ ] Titres de page et focus gérés à chaque navigation (accessibilité).

**Tests** : navigation, 404.
**Revue** : `ts-reviewer`, `ux-reviewer`.
**Commit** : `feat(web): add application shell and navigation`
**Statut** : À faire

---

# F4 — Accueil et challenges

### SC-WEB-020 · Accueil : challenges publics et les miens
`F4` · Story · Phase 4 · Estimation 5 · Dépend de : 009, 019 · Backend : `GET /challenges` (SC-API-030)

**Critères d'acceptation**
- [ ] Deux onglets : « Publics » et « Mes challenges » (`scope=public` et `scope=mine`).
- [ ] Filtre de statut : à venir, en cours, terminé (paramètre `status` du serveur).
- [ ] Pagination par curseur avec « Charger plus ».
- [ ] Carte : titre, visibilité, dates **dans le fuseau du challenge**, nombre de participants, mon statut (participant, abandonné, créateur).
- [ ] États : chargement, vide (avec bouton « Créer un challenge »), erreur avec réessai. Ce ticket crée les composants d'état réutilisables (squelette de chargement, erreur avec « Réessayer » et message traduit, état vide, « connexion requise »), la liste paginée avec « Charger plus » et la pastille de statut (texte et icône, jamais la couleur seule).
- [ ] Crée aussi les types du domaine nécessaires et le formateur de date et heure dans le **fuseau du challenge** (`Intl.DateTimeFormat` avec `timeZone`) dans `src/domain`.
- [ ] Connexion obligatoire : aucun contenu avant authentification.

**Tests** : onglets, filtres, pagination, états vide et erreur (MSW).
**Revue** : `ts-reviewer`, `ux-reviewer`, `spec-guardian`.
**Commit** : `feat(challenges): add home screen with public and own challenges`
**Statut** : À faire

### SC-WEB-021 · Création : étape « informations »
`F4` · Story · Phase 4 · Estimation 3 · Dépend de : 012, 019, 020 · Backend : `POST /challenges` (SC-API-029)

**Critères d'acceptation**
- [ ] Assistant en étapes sur `/challenges/new`, avec indicateur de progression et retour arrière sans perte de saisie.
- [ ] Étape 1 : titre (3 à 80 caractères), description (jusqu'à 2000), visibilité (public ou privé), « les participants invités peuvent inviter ».
- [ ] Validation en ligne avec le schéma de création de challenge de `src/domain/schemas` (`react-hook-form` et `zod`, FD7), créé ici et complété par les étapes suivantes.
- [ ] Avertissement si l'utilisateur quitte l'assistant avec une saisie non envoyée.

**Tests** : validation de chaque champ, navigation entre étapes.
**Revue** : `ts-reviewer`, `ux-reviewer`.
**Commit** : `feat(challenges): add creation wizard info step`
**Statut** : À faire

### SC-WEB-022 · Création : étape « durée et fuseau »
`F4` · Story · Phase 4 · Estimation 3 · Dépend de : 021 · Backend : SC-API-027

**Critères d'acceptation**
- [ ] Durée en **nombre de semaines** (2 à 52), jamais en dates libres ; date de début (champ natif, aujourd'hui ou plus tard, FD5).
- [ ] Sélecteur de fuseau (créé ici) : fuseau du lieu de lancement (liste IANA, valeur par défaut : ✅ Montréal, `America/Toronto`, quel que soit le fuseau de l'appareil ; décision du 2026-11-19).
- [ ] Aperçu clair : « Du lundi 5 octobre à 0 h au lundi 16 novembre à 0 h, heure de Montréal », calculé avec `Intl` dans le fuseau choisi, avec le nombre de semaines.
- [ ] Les changements d'heure pendant la période sont correctement affichés (test de novembre).

**Tests** : durée 1 et 53 (refusées), aperçu en deux fuseaux, passage à l'heure d'hiver.
**Revue** : `ts-reviewer`, `ux-reviewer`, `spec-guardian`.
**Commit** : `feat(challenges): add creation wizard duration and timezone step`
**Statut** : À faire

### SC-WEB-023 · Création : catégories, récapitulatif et envoi
`F4` · Story · Phase 4 · Estimation 5 · Dépend de : 022 · Backend : `POST /challenges` (SC-API-029)

**Critères d'acceptation**
- [ ] Étape 3 : les **3 catégories** sont affichées comme fixes (temps cumulé, distance cumulée, course avec élimination) avec une explication courte de chacune ; l'**incrément X** (en km, supérieur à 0, 100 au plus ; ✅ une décimale au plus : choix d'interface du porteur du projet le 2026-11-19, plus strict que le contrat en mètres entiers) de la catégorie 3 est saisi, ainsi que les coefficients de la catégorie 2 (voir ci-dessous), avec un exemple chiffré (« X = 2 : 5 km en semaine 1, au moins 7 km en semaine 2… »).
- [ ] Récapitulatif complet avec avertissement : « les catégories ne pourront plus être modifiées ».
- [ ] Envoi : bouton désactivé pendant la requête ; succès : redirection vers le challenge ; erreurs traduites par champ (`validation_failed`, `profile_incomplete`).
- [ ] Les coefficients de la catégorie 2 sont pré-remplis par les suggestions de l'API des sports et ✅ modifiables par le créateur (0,1 à 2, deux décimales ; course fixe à ×1) ; seuls ceux qu'il change sont envoyés (décision du 2026-11-19, alignée sur le README backend §2.4).

**Tests** : saisie de X invalide, envoi réussi, erreur serveur, double clic.
**Revue** : `ts-reviewer`, `ux-reviewer`, `spec-guardian`.
**Commit** : `feat(challenges): add creation wizard categories step and submission`
**Statut** : À faire

### SC-WEB-024 · Détail d'un challenge : en-tête, onglets et indicateurs serveur
`F4` · Story · Phase 4 · Estimation 5 · Dépend de : 009, 020 · Backend : `GET /challenges/{id}` (SC-API-031)

**Critères d'acceptation**
- [ ] En-tête : titre, description, visibilité, dates dans le fuseau du challenge, semaine courante et **échéance de la semaine** (`week_ends_at`), statut du challenge.
- [ ] Onglets : Classement, Participants, Activités (routes imbriquées de `/challenges/:id`).
- [ ] Les actions affichées dépendent **uniquement des champs du serveur** : `can_join`, `registration_deadline`, mon rôle et mon statut. Aucune règle recalculée côté client.
- [ ] Challenge privé inaccessible ou supprimé (404) : page « challenge introuvable » sans indiquer s'il existe.
- [ ] Les catégories sont affichées en lecture seule.

**Tests** : rôles (créateur, participant, abandonné, extérieur), 404, indicateurs serveur.
**Revue** : `ts-reviewer`, `ux-reviewer`, `spec-guardian`.
**Commit** : `feat(challenges): add challenge detail page with server-driven actions`
**Statut** : À faire

### SC-WEB-025 · Rejoindre un challenge
`F4` · Story · Phase 4 · Estimation 3 · Dépend de : 024 · Backend : `POST /challenges/{id}/join` (SC-API-033)

**Critères d'acceptation**
- [ ] Bouton « Rejoindre » visible seulement si `can_join` est vrai ; sinon explication claire (inscriptions closes depuis la fin de la semaine 1, déjà participant, abandon définitif).
- [ ] Boîte de confirmation (composant créé ici) qui indique que **les activités (date, sport, durée, distance) seront visibles par les autres participants**.
- [ ] Erreurs traduites : `registration_closed`, `already_participant`, `participation_abandoned`, `profile_incomplete`.
- [ ] Succès : mise à jour du challenge, du classement et de « mes challenges ».

**Tests** : confirmation, chaque erreur, succès.
**Revue** : `ts-reviewer`, `ux-reviewer`, `spec-guardian`.
**Commit** : `feat(challenges): add join flow with visibility notice`
**Statut** : À faire

### SC-WEB-026 · Abandonner un challenge
`F4` · Story · Phase 4 · Estimation 2 · Dépend de : 024 · Backend : `POST /challenges/{id}/abandon` (SC-API-034)

**Critères d'acceptation**
- [ ] Bouton « Abandonner » (jamais « Quitter ») pour un participant actif.
- [ ] Confirmation qui précise que c'est **définitif**, que la personne sera éliminée des 3 catégories et apparaîtra « a abandonné », hors podium.
- [ ] Après abandon : statut affiché partout, plus d'ajout d'activité pour ce challenge, les actions dépendantes disparaissent.
- [ ] Challenge terminé (`challenge_ended`) : message adapté.

**Tests** : confirmation, succès, répétition.
**Revue** : `ts-reviewer`, `ux-reviewer`, `spec-guardian`.
**Commit** : `feat(challenges): add abandon flow`
**Statut** : À faire

### SC-WEB-027 · Modifier le titre et la description
`F4` · Story · Phase 4 · Estimation 2 · Dépend de : 024 · Backend : `PATCH /challenges/{id}` (SC-API-032)

**Critères d'acceptation**
- [ ] Visible seulement pour les créateurs, à tout moment.
- [ ] Seuls titre et description sont éditables ; catégories, dates et visibilité en lecture seule avec explication.
- [ ] Validation en ligne ; erreur `field_not_editable` traduite si l'API la renvoie.

**Tests** : créateur, participant (action absente), validation.
**Revue** : `ts-reviewer`, `ux-reviewer`, `spec-guardian`.
**Commit** : `feat(challenges): allow creators to edit title and description`
**Statut** : À faire

### SC-WEB-028 · Actions des créateurs : supprimer, ajouter un créateur, exclure
`F4` · Story · Phase 4 · Estimation 5 · Dépend de : 029, 024 · Backend : SC-API-035, 036, 037

**Critères d'acceptation**
- [ ] « Supprimer le challenge » : possible à tout moment, avec une **confirmation renforcée** (variante du composant du ticket 025, avec saisie du titre) (saisie du titre) qui avertit que tout disparaît pour tous les participants ; succès : retour à l'accueil.
- [ ] « Ajouter un créateur » : choix parmi les participants actifs.
- [ ] « Exclure » sur un participant : confirmation ; l'exclu apparaît ensuite comme « a abandonné » ; un créateur ne peut pas être exclu (`cannot_exclude_creator` traduit).
- [ ] Ces actions n'apparaissent que pour les créateurs, d'après les champs du serveur.
- [ ] « Supprimer le challenge » reste proposé aux créateurs d'un challenge terminé (critère transféré de SC-WEB-033).

**Tests** : chaque action, confirmation renforcée, erreurs, suppression sur un challenge terminé.
**Revue** : `ts-reviewer`, `ux-reviewer`, `security-reviewer`, `spec-guardian`.
**Commit** : `feat(challenges): add creator actions to delete, add creator and exclude`
**Statut** : À faire

### SC-WEB-029 · Liste des participants
`F4` · Story · Phase 4 · Estimation 2 · Dépend de : 020, 024 · Backend : `GET /challenges/{id}/participants` (SC-API-038)

**Critères d'acceptation**
- [ ] Liste paginée : avatar à initiales, pseudo, statut (actif, « a abandonné »), date d'inscription.
- [ ] Compte supprimé : pseudo neutre traduit.
- [ ] Un clic mène aux activités du participant (ticket 037).

**Tests** : abandonné, compte supprimé, pagination.
**Revue** : `ts-reviewer`, `ux-reviewer`.
**Commit** : `feat(challenges): add participants list`
**Statut** : À faire

---

# F5 — Classement

### SC-WEB-030 · Classement par catégorie : podium et tableau
`F5` · Story · Phase 5 · Estimation 5 · Dépend de : 024, 020 · Backend : `GET /challenges/{id}/leaderboard` (SC-API-053)

**Critères d'acceptation**
- [ ] Un onglet par catégorie, chacune avec son **podium** (trois premiers rangs) et un tableau complet.
- [ ] **Ex aequo** : même rang affiché (1, 1, 3).
- [ ] Crée dans `src/domain` les formateurs purs de distance en km selon la langue, de durée (`h:mm`) et de rang (1er / 1st, ex aequo), avec leurs tests.
- [ ] Valeur formatée : durée pour la catégorie 1, km équivalents pour la catégorie 2, km pour la catégorie 3.
- [ ] La ligne de l'utilisateur est mise en évidence et reste visible.
- [ ] Participants abandonnés : « a abandonné », hors podium, sans rang.
- [ ] Un clic sur un participant ouvre ses activités (ticket 037).

**Tests** : ex aequo, abandonné, ligne de l'utilisateur, trois catégories (MSW).
**Revue** : `ts-reviewer`, `ux-reviewer`, `spec-guardian`.
**Commit** : `feat(leaderboard): add category leaderboards with podium and ties`
**Statut** : À faire

### SC-WEB-031 · Catégorie 3 : statuts, minimum et échéance
`F5` · Story · Phase 5 · Estimation 5 · Dépend de : 030 · Backend : SC-API-053

**Critères d'acceptation**
- [ ] Pour chaque personne non éliminée : statut (`reached` « objectif atteint », `in_progress` « en cours », `at_risk` « à risque »), minimum de la semaine, distance déjà courue, avec barre de progression et **échéance de la semaine** dans le fuseau du challenge.
- [ ] Semaine 1 : aucun minimum ni statut (texte d'aide : « pas d'élimination en semaine 1 »).
- [ ] Éliminé : « éliminé en semaine N », toujours classé dans les catégories 1 et 2.
- [ ] Le statut n'est jamais indiqué par la couleur seule (texte et icône).
- [ ] Texte d'aide : « le minimum de la semaine suivante = votre distance de cette semaine + X ; si vous courez plus, c'est votre nouvelle base ». **La formule n'est pas calculée côté client.**

**Tests** : chaque statut, semaine 1, éliminé, accessibilité (texte + icône).
**Revue** : `ts-reviewer`, `ux-reviewer`, `spec-guardian`.
**Commit** : `feat(leaderboard): show category 3 live statuses and weekly minimum`
**Statut** : À faire

### SC-WEB-032 · Rafraîchissement du classement
`F5` · Story · Phase 5 · Estimation 2 · Dépend de : 030 · Backend : —

**Critères d'acceptation**
- [ ] Rechargement à l'ouverture de l'onglet et au retour dans l'onglet ou l'application (visibilité de la page). Décision du 2026-11-20 : ni bouton « Actualiser » ni geste maison ; le tirer-pour-rafraîchir natif du téléphone et le rechargement de la page suffisent ; rafraîchissement automatique reporté au ticket SC-WEB-055 (issue #79, V1.1).
- [ ] Heure de dernière mise à jour affichée (`computed_at`).
- [ ] Pas de temps réel en V1.

**Tests** : rechargement au retour de visibilité, bouton, affichage de l'heure.
**Revue** : `ts-reviewer`, `ux-reviewer`.
**Commit** : `feat(leaderboard): refresh on focus and manual refresh`
**Statut** : À faire

### SC-WEB-033 · Challenge terminé : résultats figés
`F5` · Story · Phase 5 · Estimation 2 · Dépend de : 030 · Backend : SC-API-056, 058

**Critères d'acceptation**
- [ ] Un challenge terminé affiche ses résultats figés en lecture seule : podiums, classements, aucune action de saisie ni d'abandon.
- [ ] Mention « Résultats définitifs » avec la date de fin dans le fuseau du challenge.
- [ ] Les créateurs gardent « Supprimer le challenge » : transféré à SC-WEB-028, qui crée l'action (décision du 2026-11-20).

**Tests** : challenge terminé, actions absentes.
**Revue** : `ts-reviewer`, `ux-reviewer`, `spec-guardian`.
**Commit** : `feat(leaderboard): show frozen results for finished challenges`
**Statut** : À faire

---

# F6 — Activités

### SC-WEB-034 · Formulaire de saisie d'activité
`F6` · Story · Phase 6 · Estimation 5 · Dépend de : 012, 020 · Backend : `GET /sports` (SC-API-025), `POST /activities` (SC-API-044)

**Critères d'acceptation**
- [ ] Route `/activities/new` ; sport choisi dans le catalogue de l'API ; option « Autre (préciser) » avec un libellé libre de 2 à 40 caractères, affiché comme du texte.
- [ ] Schéma de saisie d'activité dans `src/domain/schemas` (créé ici).
- [ ] Date et heure de début (champs natifs, jamais dans le futur) ; durée (heures, minutes, secondes) toujours obligatoire.
- [ ] **Distance** : champ affiché et obligatoire seulement si le sport produit des km ; absent pour le yoga ; **facultatif** pour le sport « autre » (D9).
- [ ] **Jamais de champ vitesse ni allure** : l'interface affiche celle que l'API calcule.
- [ ] Clé d'idempotence générée à l'ouverture du formulaire et renvoyée à chaque tentative.
- [ ] Bouton désactivé pendant l'envoi ; erreurs traduites : `week_locked`, `activity_overlap`, `distance_required`, `distance_not_allowed`, `profile_incomplete`.

**Tests** : chaque règle de champ, sport « autre », double envoi, chaque erreur.
**Revue** : `ts-reviewer`, `ux-reviewer`, `spec-guardian`.
**Commit** : `feat(activities): add activity entry form`
**Statut** : À faire

### SC-WEB-035 · Retour après enregistrement et mise à jour du cache
`F6` · Story · Phase 6 · Estimation 2 · Dépend de : 034 · Backend : SC-API-044

**Critères d'acceptation**
- [ ] Message de succès : « Cette activité compte dans N challenge(s) », avec la liste (champ du serveur).
- [ ] Si `contributions` est vide (aucun challenge en cours ne contient l'activité), succès quand même : « Activité enregistrée ; elle ne compte encore dans aucun challenge » (elle comptera dans un challenge rejoint plus tard dont la fenêtre la contient). Jamais présenté comme une erreur.
- [ ] Invalidation des classements, des activités et des challenges concernés.
- [ ] Lien direct vers le classement du challenge concerné.

**Tests** : message avec un et plusieurs challenges, invalidation.
**Revue** : `ts-reviewer`, `ux-reviewer`.
**Commit** : `feat(activities): show affected challenges and refresh data after recording`
**Statut** : À faire

### SC-WEB-036 · Mes activités : liste, modification, suppression, verrouillage
`F6` · Story · Phase 6 · Estimation 5 · Dépend de : 034 · Backend : `GET /me/activities` (SC-API-046), `PATCH` et `DELETE /activities/{id}` (SC-API-045)

**Critères d'acceptation**
- [ ] Liste paginée : sport (ou libellé « autre »), date, durée, distance, vitesse calculée par l'API, mention « manuelle ».
- [ ] Modification et suppression avec confirmation, **seulement** si l'activité n'est pas verrouillée (champ `locked` du serveur).
- [ ] Activité verrouillée : lecture seule, avec explication (« la semaine est terminée dans un de vos challenges »), aucun bouton d'action.
- [ ] Erreur `week_locked` traduite si le serveur refuse malgré tout.

**Tests** : verrouillée ou non, modification, suppression, pagination.
**Revue** : `ts-reviewer`, `ux-reviewer`, `spec-guardian`.
**Commit** : `feat(activities): add own activities list with edit and delete`
**Statut** : À faire

### SC-WEB-037 · Activités d'un participant (lecture seule)
`F6` · Story · Phase 6 · Estimation 3 · Dépend de : 029, 036 · Backend : `GET /challenges/{id}/participants/{userId}/activities` (SC-API-046)

**Critères d'acceptation**
- [ ] Accessible depuis le classement et la liste des participants, réservé aux participants du challenge et aux créateurs.
- [ ] Liste en lecture seule des activités de la fenêtre du challenge, avec la mention « manuelle ».
- [ ] 404 : message sans révéler l'existence (non-participant d'un challenge public ou privé).

**Tests** : accès autorisé, 404, pagination.
**Revue** : `ts-reviewer`, `ux-reviewer`, `security-reviewer`, `spec-guardian`.
**Commit** : `feat(activities): add read-only participant activities view`
**Statut** : À faire

---

# F7 — Invitations

### SC-WEB-038 · Créer et partager un lien d'invitation
`F7` · Story · Phase 7 · Estimation 3 · Dépend de : 024 · Backend : `POST /challenges/{id}/invitations` (SC-API-066)

**Critères d'acceptation**
- [ ] Bouton « Inviter » visible pour les créateurs, et pour les participants seulement si `members_can_invite` est vrai (champ du serveur).
- [ ] Génération du lien, copie dans le presse-papiers et partage par le système (API de partage du navigateur quand elle existe).
- [ ] Mention de la date limite du lien (fin de la semaine 1).
- [ ] Le lien ne contient aucune donnée personnelle ; le jeton n'est jamais journalisé.

**Tests** : droits d'affichage, copie, partage indisponible (repli).
**Revue** : `ts-reviewer`, `ux-reviewer`, `security-reviewer`.
**Commit** : `feat(invitations): add invitation link creation and sharing`
**Statut** : À faire

### SC-WEB-039 · Page d'invitation et acceptation
`F7` · Story · Phase 7 · Estimation 5 · Dépend de : 017, 025, 038 · Backend : `GET /invitations/{token}` et `POST /invitations/{token}/accept` (SC-API-066)

**Critères d'acceptation**
- [ ] `/invite/:token` : si l'utilisateur n'est pas connecté, connexion puis **retour automatique** sur l'invitation.
- [ ] Aperçu : titre, dates dans le fuseau du challenge, nombre de participants, avertissement de visibilité des activités.
- [ ] « Accepter » rejoint le challenge privé ; erreurs traduites : `invitation_invalid` (inconnue, expirée, révoquée), `registration_closed`, `participation_abandoned`, `profile_incomplete` (puis onboarding et retour).
- [ ] Le jeton est validé (forme) avant tout appel ; aucune action sensible sans confirmation.

**Tests** : parcours connecté et non connecté, chaque erreur, retour après onboarding.
**Revue** : `ts-reviewer`, `ux-reviewer`, `security-reviewer`, `spec-guardian`.
**Commit** : `feat(invitations): add invitation page and acceptance flow`
**Statut** : À faire

---

# F8 — Profil et compte

### SC-WEB-040 · Page profil
`F8` · Story · Phase 8 · Estimation 3 · Dépend de : 018 · Backend : `GET` et `PATCH /me` (SC-API-021)

**Critères d'acceptation**
- [ ] Route `/me` : pseudo, langue, thème, avatar à initiales.
- [ ] Modification du pseudo (mêmes règles et mêmes erreurs que l'onboarding) et de la langue (appliquée tout de suite).
- [ ] Liens vers « Mes activités », la politique de confidentialité et les conditions d'utilisation.
- [ ] Déconnexion.

**Tests** : modification valide et invalide, changement de langue.
**Revue** : `ts-reviewer`, `ux-reviewer`.
**Commit** : `feat(profile): add profile page`
**Statut** : À faire

### SC-WEB-053 · Nom, prénom et e-mail : onboarding et profil
`F8` · Story · Phase 8 · Estimation 3 · Dépend de : 018, 040 · Backend : `GET` et `PATCH /me` : prénom, nom et e-mail (SC-API-116) ; pseudo facultatif, retiré par `pseudo: null` (SC-API-118)

**Origine des données**
- **E-mail** : vient du claim `email` du jeton Auth0 ; le backend le lit et le renvoie dans `GET /me`. Il n'est ni saisi ni modifiable dans l'app, et reste **privé** : seul son titulaire le voit.
- **Prénom et nom** : saisis par l'utilisateur à l'onboarding, modifiables ensuite sur `/me` ; **obligatoires**. Le serveur décide si le profil est complet (`profile_complete`) ; l'app ne recalcule pas cette règle.
- **Pseudo** : **facultatif** ; il peut être choisi, changé ou retiré (onboarding ou `/me`) ; retiré, il est envoyé à `null`. Nom affiché aux autres : le pseudo s'il est renseigné, sinon le prénom et le nom.

**Critères d'acceptation**
- [ ] Onboarding (`/onboarding`) : champs **Prénom** et **Nom** obligatoires, **Pseudo** facultatif (non envoyé s'il est vide), envoyés par `PATCH /me` ; validation en ligne avec un schéma de `src/domain/schemas` reprenant les règles du contrat (longueurs, caractères), messages traduits ; erreurs de l'API traduites par leur code.
- [ ] Un utilisateur déjà inscrit sans prénom ni nom repasse par l'onboarding si `profile_complete` est faux (garde existante `ProfileGate`), avec son pseudo pré-rempli.
- [ ] Page `/me` : prénom et nom modifiables (mêmes règles que l'onboarding, jamais retirés), e-mail en lecture seule, tels que `GET /me` les renvoie ; une valeur absente affiche une mention traduite (« non renseigné »), jamais un champ vide ni une valeur inventée.
- [ ] Page `/me` : pseudo modifiable (mêmes règles et mêmes erreurs que l'onboarding), facultatif ; le vider le retire.
- [ ] Nom affiché d'un utilisateur : le pseudo s'il existe, sinon le prénom et le nom (fonction pure de `src/domain`, initiales de l'avatar comprises) ; l'e-mail n'apparaît que sur la page `/me` de son titulaire.
- [ ] Ni le nom, ni le prénom, ni l'e-mail ne partent dans les journaux, les analytics ou Sentry.
- [ ] Contrat synchronisé (`pnpm api:sync`, `pnpm api:generate`).

**Tests** : onboarding (noms vides refusés, pseudo vide non envoyé, valeurs valides envoyées, erreur de l'API), utilisateur existant sans nom renvoyé à l'onboarding, profil (noms modifiés, refusés, e-mail présent et absent, pseudo modifié, pris, retiré), nom affiché (pseudo, sinon prénom et nom).
**Revue** : `ts-reviewer`, `ux-reviewer`, `security-reviewer`, `spec-guardian`.
**Commit** : `feat(profile): collect name at onboarding and show it with the email`
**Statut** : À faire

### SC-WEB-041 · Suppression de compte
`F8` · Story · Phase 8 · Estimation 3 · Dépend de : 040, 025 · Backend : `DELETE /me` (SC-API-039)

**Critères d'acceptation**
- [ ] Accessible depuis `/me`, avec une **confirmation renforcée** qui explique : abandon de tous les challenges, anonymisation, suppression chez Auth0, irréversibilité.
- [ ] Succès : déconnexion, vidage du cache et des données locales, page de confirmation.
- [ ] Une reconnexion avec le même identifiant n'est pas supposée possible : prévoir le message `account_deleted` si elle se produit.

**Tests** : confirmation, succès, échec réseau.
**Revue** : `ts-reviewer`, `ux-reviewer`, `security-reviewer`.
**Commit** : `feat(profile): add account deletion flow`
**Statut** : À faire

### SC-WEB-042 · Pages légales et consentement
`F8` · Task · Phase 8 · Estimation 2 · Dépend de : 019, 012 · Backend : —

**Critères d'acceptation**
- [ ] Pages « Politique de confidentialité » et « Conditions d'utilisation » (contenu fourni par l'utilisateur après validation juridique) en français et en anglais, accessibles sans connexion.
- [ ] Liens depuis l'inscription, le profil et le pied de page.
- [ ] Mécanisme de **consentement** prêt pour le suivi et l'analytique : rien n'est envoyé tant que le consentement n'est pas accordé.
- [ ] Le texte de la politique mentionne que les activités sont visibles par les autres participants d'un challenge.

**Tests** : consentement refusé ou accordé, pages accessibles sans session.
**Revue** : `ts-reviewer`, `ux-reviewer`, `security-reviewer`.
**Commit** : `feat(legal): add legal pages and consent mechanism`
**Statut** : À faire

---

# F9 — Qualité et livraison

### SC-WEB-043 · Tests de bout en bout (Playwright)
`F9` · Task · Phase 9 · Estimation 5 · Dépend de : 039, 036, 031 · Backend : API de staging ou mocks

**Critères d'acceptation**
- [ ] Parcours couverts, sur une taille d'écran de téléphone et de bureau : connexion et onboarding, création d'un challenge, rejoindre par invitation, saisie d'une activité, lecture du classement et des statuts, abandon, suppression de compte.
- [ ] Authentification de test sans passer par le vrai Auth0 (double ou jeton de test), jamais en production.
- [ ] Script `pnpm e2e` ajouté au `package.json`, exécutable en local ; l'étape correspondante est ajoutée à la CI (ticket 005).

**Revue** : `ts-reviewer`, `security-reviewer`.
**Commit** : `test(e2e): add Playwright critical journeys`
**Statut** : À faire

### SC-WEB-044 · Accessibilité
`F9` · Task · Phase 9 · Estimation 3 · Dépend de : 043 · Backend : —

**Critères d'acceptation**
- [ ] Audit automatique (axe) sur les écrans clés, sans violation grave.
- [ ] Parcours complet au clavier ; focus visible ; ordre logique.
- [ ] Texte agrandissable jusqu'à 200 % sans perte de contenu ; contraste conforme dans les deux thèmes.
- [ ] Statuts compréhensibles sans la couleur.

**Revue** : `ux-reviewer`.
**Commit** : `fix(a11y): fix accessibility issues found by audit`
**Statut** : À faire

### SC-WEB-045 · Suivi d'erreurs sans donnée personnelle
`F9` · Task · Phase 9 · Estimation 2 · Dépend de : 042 · Backend : —

**Critères d'acceptation**
- [ ] Variable `VITE_SENTRY_DSN` ajoutée à `src/lib/config.ts` et à `.env.example` (publique, non secrète).
- [ ] Sentry (ou équivalent) pour les erreurs de l'interface, après consentement.
- [ ] Nettoyage avant envoi : aucun nom, pseudo, e-mail, jeton ni corps de requête ; l'identifiant de requête est conservé.
- [ ] Désactivé en développement ; le DSN est public et non secret.

**Revue** : `security-reviewer`.
**Commit** : `feat(web): add error tracking with personal data scrubbing`
**Statut** : À faire

### SC-WEB-046 · Performance
`F9` · Task · Phase 9 · Estimation 3 · Dépend de : 043 · Backend : —

**Critères d'acceptation**
- [ ] Découpage du code par route.
- [ ] Budget de taille du bundle vérifié dans la CI.
- [ ] Listes longues (classement) rendues sans ralentissement visible.
- [ ] Score Lighthouse mobile acceptable (objectif à fixer avec l'utilisateur).

**Revue** : `ts-reviewer`.
**Commit** : `perf(web): split code by route and enforce bundle budget`
**Statut** : À faire

### SC-WEB-015 · Application installable (PWA)
`F9` · Task · Phase 9 · Estimation 2 · Dépend de : 003 · Backend : —

**Critères d'acceptation**
- [ ] Manifeste (nom, icônes, couleurs, affichage autonome) et icônes.
- [ ] Service worker minimal : met en cache l'enveloppe de l'application ; **aucune donnée d'API en cache** ; hors ligne, message « connexion requise ».
- [ ] Mise à jour de l'application sans bloquer l'utilisateur.

**Tests** : manuels (installation sur téléphone) et audit Lighthouse.
**Revue** : `ts-reviewer`, `security-reviewer`.
**Commit** : `feat(web): make the app installable as a PWA`
**Statut** : À faire

### SC-WEB-047 · Hébergement du web et déploiement staging
`F9` · Ops · Phase 9 · Estimation 3 · Dépend de : 005, 046 · Backend : API de staging

**Critères d'acceptation**
- [ ] Choix de l'hébergement confirmé (FD2) : Firebase Hosting proposé, avec réécriture vers `index.html` pour l'application monopage.
- [ ] En-têtes de sécurité (politique de contenu, `X-Content-Type-Options`, `Referrer-Policy`) ; cache long pour les fichiers versionnés, jamais pour `index.html`.
- [ ] Adresses de staging ajoutées dans Auth0 (rappel, déconnexion, origines) et dans la configuration CORS du backend.
- [ ] Déploiement de staging par la CI **sur demande explicite** ; aucune publication automatique.

**Revue** : `security-reviewer`.
**Commit** : `chore(deploy): add web hosting configuration and staging pipeline`
**Statut** : À faire

### SC-WEB-048 · Runbook et liste de contrôle de mise en production
`F9` · Task · Phase 9 · Estimation 2 · Dépend de : 047 · Backend : —

**Critères d'acceptation**
- [ ] `docs/runbook.md` : déploiement, retour arrière, variables d'environnement par environnement, adresses Auth0 à déclarer, invalidation des caches.
- [ ] Liste de contrôle avant ouverture : pages légales en place, consentement vérifié, suppression de compte testée, jeux de test e2e verts, aucune variable secrète dans le bundle, mocks MSW désactivés en production.

**Revue** : `security-reviewer`.
**Commit** : `docs: add frontend runbook and production readiness checklist`
**Statut** : À faire

---

# F10 — Reportés en V1.1 (avatar, badges)

### SC-WEB-049 · Avatar : upload et affichage
`F10` · Story · V1.1 · Estimation 5 · Dépend de : 040 · Backend : SC-API-023

**Critères d'acceptation**
- [ ] Choix d'une image (JPEG, PNG, WebP, 2 Mo au plus), recadrage et compression côté client.
- [ ] Demande d'URL signée à l'API, envoi direct au bucket, puis enregistrement de la clé dans le profil.
- [ ] Avatar affiché partout à la place des initiales ; repli sur les initiales en cas d'erreur de chargement.
- [ ] Suppression des métadonnées de localisation de l'image avant l'envoi.

**Revue** : `ts-reviewer`, `ux-reviewer`, `security-reviewer`.
**Commit** : `feat(profile): add avatar upload`
**Statut** : Reporté (V1.1)

### SC-WEB-050 · Badges : liste et affichage
`F10` · Story · V1.1 · Estimation 3 · Dépend de : 024 · Backend : SC-API-063

**Critères d'acceptation**
- [ ] Onglet ou section « Badges » du challenge : définitions avec leur condition en une phrase lisible, badges gagnés, progression si l'API la fournit.
- [ ] Badges obtenus visibles sur le profil.
- [ ] Message de félicitations au rechargement quand un nouveau badge est gagné (pas de temps réel).
- [ ] Jamais « attribué en fin de semaine » : les badges sont gagnés dès que la condition est atteinte.

**Revue** : `ts-reviewer`, `ux-reviewer`, `spec-guardian`.
**Commit** : `feat(badges): add badge list and earned badges display`
**Statut** : Reporté (V1.1)

### SC-WEB-051 · Badges : création par les créateurs
`F10` · Story · V1.1 · Estimation 5 · Dépend de : 050 · Backend : SC-API-061, 063

**Critères d'acceptation**
- [ ] Assistant de condition (jamais de saisie libre) : mesure (nombre d'activités, distance, temps) → portée (sur tout le challenge, une semaine, une seule sortie, plusieurs semaines de suite) → filtre de sport → seuil, avec aperçu en une phrase (« 10 km sur une seule course »).
- [ ] Création, modification et suppression réservées aux créateurs ; actions cachées si le badge a déjà été gagné (champ du serveur).
- [ ] Limite de 50 badges par challenge : message clair à l'atteinte (`badge_limit_reached`).
- [ ] Un badge créé en cours de challenge s'applique aussi aux activités passées : l'assistant l'indique.

**Revue** : `ts-reviewer`, `ux-reviewer`, `spec-guardian`.
**Commit** : `feat(badges): add badge creation wizard for creators`
**Statut** : Reporté (V1.1)
