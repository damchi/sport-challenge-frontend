# Sport Challenge — App (web + mobile)

Frontend de l'application de challenges sportifs entre amis : **web (React + Vite) en V1** dans une seule application, mobile (React Native + Expo) en V2 (le dépôt deviendra alors un monorepo pnpm). Priorité : une V1 web prête le plus vite possible. Le backend (API Go) est un autre projet.

## Source de vérité

- `README.md` : spécification du frontend. **Lis le §2 (règles produit) et le §4 (architecture) avant toute tâche qui touche à un écran, à la structure ou à une règle d'affichage.**
- Légende du README : ✅ décidé · 🟡 proposition · ❓ question ouverte. Applique les ✅. Ne transforme jamais un 🟡 ou un ❓ en règle sans demander.
- **Règles du produit** : la source de vérité est le README du backend (§2). Si le dépôt est cloné à côté (`../sport-challenge-api`), tu peux le lire, mais **tu ne le modifies jamais depuis ce projet**.
- **Contrat d'API** : `openapi.yaml` du backend. Le client de `src/api` est généré ; si une route ou un champ manque, signale-le à l'utilisateur au lieu de contourner.
- **Backlog** : issues GitHub (importées depuis `TASKS.md`, qui reste le document de référence ; 97 tickets `SC-WEB-001` à `SC-WEB-103`, numérotation non consécutive : les anciens tickets de préparation ont été fusionnés dans les tickets fonctionnels ; un ticket = un commit). Utilise le skill `next-task` pour le traiter ; le statut vit dans l'issue, pas dans `TASKS.md`.
- Si le code et le README se contredisent, signale-le et demande, ne tranche pas seul.

## Stack

TypeScript strict · React + Vite (web, V1) · Expo + Expo Router (mobile, **V2 : ne rien créer pour le mobile en V1**) · React Router (web) · pnpm · TanStack Query · react-hook-form + schémas de validation partagés (🟡 zod) · i18next (français et anglais) · Vitest + Testing Library · Playwright (web) · Maestro (mobile) · ESLint + Prettier · SDK **Auth0** (`@auth0/auth0-react` pour le web, `react-native-auth0` pour le mobile, à confirmer à l'installation).

## Commandes

Scripts du `package.json`, ajoutés **au fur et à mesure** par les tickets qui s'en servent (voir `TASKS.md`) :

```
pnpm dev                 serveur de développement
pnpm build               build de tous les paquets et du web
pnpm bundle:check        budget de taille du build (après pnpm build)
pnpm hosting:config      écrit firebase.json (après pnpm build, utilisé par le déploiement)
pnpm typecheck           tsc --noEmit
pnpm lint                ESLint
pnpm format              Prettier (réécrit les fichiers)
pnpm format:check        Prettier sans écrire (échoue sur un fichier non formaté)
pnpm test                tests unitaires et composants (Vitest)
pnpm check               format:check + typecheck + lint + i18n:check + test
pnpm api:sync            copie openapi.yaml depuis le backend
pnpm api:generate        régénère src/api/generated
pnpm e2e                 Playwright
```

**Avant de dire qu'une tâche est terminée** : `pnpm check` passe. Lance aussi les tests de bout en bout concernés si tu as touché à un parcours critique (connexion, création de challenge, saisie d'activité, invitation).

## Architecture

Structure **cible** (une seule application ; chaque dossier naît avec le premier fichier utile) :

```
src/
  main.tsx, App.tsx
  routes/ pages/       pages fines : elles assemblent des features
  features/            un dossier par domaine (composants, hooks locaux, types)
  components/          interface réutilisable
  api/                 portable : generated/, client.ts, queryKeys.ts, hooks/
  domain/              portable : types, formats, schémas de validation
  i18n/                portable : fr.json, en.json
  lib/ styles/         configuration, auth, jetons de design
openapi/openapi.yaml   copie versionnée du contrat   e2e/   tests Playwright
```

Règles de structure :
- **Pas de code d'avance** : n'ajoute un dossier, un composant, une fonction, un schéma, une clé de traduction, un mock, une variable d'environnement, une dépendance ou un script que si le ticket en cours l'utilise. L'arborescence ci-dessus est la cible, pas un échafaudage à créer d'un coup. Un besoin imprévu s'ajoute au ticket en cours.
- Une **page** ne contient pas de logique : elle assemble des composants de `features/`.
- Une **feature** regroupe un domaine : composants, hooks locaux, types.
- `src/api`, `src/domain` et `src/i18n` sont **portables** : aucun import de `react-dom`, `react-native`, `expo-*` ni d'API du navigateur, pour que le mobile les réutilise en V2 (déplacement dans des paquets au moment du monorepo).
- **Aucun appel HTTP direct** dans un composant : tout passe par les hooks de `src/api`.
- Ne modifie jamais `src/api/generated/` à la main.

## V1 web d'abord

- **Badges et upload d'avatar sont reportés en V1.1** (décision D10) : en V1, avatars à initiales, pas d'écran de badges.
- Ne crée **aucun** fichier pour le mobile en V1 (ni `apps/`, ni Expo) ; ignore les parties mobiles des skills et des README (reportées à la V2).
- Interface **conçue pour le téléphone d'abord** (360 px), installable (PWA) ; zones tactiles d'au moins 44 px.
- Les liens d'invitation ouvrent une page web.

## Règles d'interface non négociables

- **Textes** : aucune chaîne en dur. Tout passe par i18next (français et anglais, clés présentes dans les deux langues).
- **Erreurs** : l'API renvoie un code stable ; l'interface le traduit (`errors.<code>`). Jamais le message brut du serveur.
- **Dates** : un challenge s'affiche dans **son** fuseau (ex. Montréal) ; indique-le quand le fuseau de l'utilisateur diffère. Utilise `Intl.DateTimeFormat` avec l'option `timeZone`.
- **Distances** : km uniquement, formatés selon la langue (12,5 km / 12.5 km).
- **Classement** : rangs et ex aequo selon le README §2 ; un participant parti (abandon ou exclusion) est affiché « a abandonné », hors podium (README du backend §2.2, `docs/design/design.md`) ; rafraîchissement selon le README §4.3 (en V1, ni bouton « Actualiser » ni geste maison, pas de temps réel). Détail écran par écran : skill `challenge-ui-rules`.
- **Le serveur décide, l'interface reflète** : ne recalcule pas côté client une règle que l'API peut fournir (peut-on rejoindre, objectif de la semaine, statut). Si le champ manque dans le contrat, demande-le au lieu de dupliquer la règle.
- **États** : chaque écran gère chargement, erreur (avec réessai), vide et « connexion requise ».
- **Accessibilité** : libellés sur les contrôles, contraste suffisant, zones tactiles d'au moins 44 pt, thème clair et sombre via les jetons de design.
- Voir le skill `challenge-ui-rules` pour le détail écran par écran.

## Conventions de code

- Langue : code, identifiants, commentaires et messages de commit en **anglais** ; README et documentation en **français** ; textes utilisateur uniquement dans les fichiers de traduction.
- TypeScript strict : pas de `any` (utilise `unknown` et affine), pas de `!` non justifié, pas de `@ts-ignore` sans commentaire expliquant pourquoi.
- Exports nommés ; export par défaut seulement pour les pages et routes qui l'exigent.
- État serveur : TanStack Query uniquement (clés de requête centralisées dans `src/api/queryKeys.ts`). État local minimal.
- Pas de logique métier dans les composants : elle va dans des hooks ou dans `src/domain` (fonctions pures testables).
- Formulaires : react-hook-form avec les schémas de `src/domain/schemas`.
- Les créations d'activité envoient une clé d'idempotence générée côté client.
- Tests à côté du code (`*.test.ts(x)`). Requêtes simulées avec MSW. Pas de test qui dépend de l'heure réelle : injecte la date.
- Pas de nouvelle dépendance sans la justifier (taille du bundle mobile, maintenance) : demande avant d'ajouter.

## Sécurité et données

- Mobile : jetons dans le Keychain / Keystore (`expo-secure-store`), jamais dans le stockage simple. Web : suis la recommandation du SDK d'authentification (jetons en mémoire de préférence).
- **Aucun secret dans le bundle** : les variables `VITE_*` et `EXPO_PUBLIC_*` sont publiques. Elles ne contiennent que des adresses et des identifiants publics.
- N'utilise jamais `dangerouslySetInnerHTML`. Les pseudos et textes d'autres utilisateurs sont affichés comme du texte.
- Valide les paramètres des liens profonds (jeton d'invitation, identifiants) avant usage.
- Analytics : aucune en V1 (si elles arrivent, rien n'est envoyé avant le consentement). Suivi d'erreurs sans consentement (app entre amis, pas de pages légales) : aucun nom, e-mail ni jeton dans les logs ni dans Sentry.
- Ne lis pas et n'affiche pas `.env*` ni les fichiers de signature (`*.jks`, `*.p8`, `*.p12`, `*.keystore`).

## Workflow attendu

1. Lis la partie du README concernée (et la règle du backend si besoin). S'il y a un ❓ ou un 🟡 qui bloque, pose la question.
2. Fais un court plan avant les changements importants (nouvel écran, nouvelle dépendance, changement de structure).
3. Implémente, puis lance `pnpm check`.
4. Fais relire par les agents adaptés (voir ci-dessous) avant de committer.
5. **Git** : une fois `pnpm check` (et les tests de bout en bout concernés) et les relectures passés, tu **commits et pushes sans demander l'accord** (en anglais, un changement cohérent par commit, sur la branche du ticket). Tu présentes ensuite les fichiers modifiés, le résumé du diff et les commits poussés.
   - Tu peux utiliser `git status`, `git diff`, `git log`, `git add`, `git commit` et `git push` (branche de travail) librement.
   - **Pull request** : une fois ouverte, et après chaque push, attends la fin de la CI (`Monitor` sur `gh pr checks`, sans sondage), vérifie qu'elle est entièrement verte, puis lis tous les commentaires (`gh pr view --comments`, commentaires en ligne). Applique les corrections fondées (commit et push sur la même branche) ou explique pourquoi tu ne les suis pas, et recommence jusqu'à une CI verte sans commentaire en suspens. Ne dis un ticket terminé qu'à ce moment-là ; un point qui touche une règle produit (🟡 ou ❓) ou le périmètre se demande à l'utilisateur.
   - Push vers `main`, suppression de branche distante, merge, rebase, tag, reset, `gh pr create/merge` : uniquement sur demande explicite de l'utilisateur, une action à la fois.
   - Push forcé, `git reset --hard`, `git clean`, `--no-verify` : interdits (bloqués par la configuration).

## Ne jamais

- Pousser sur `main`, fusionner une pull request, ou contourner une confirmation ou un refus de la configuration (autre commande git équivalente, script, `git -C`, etc.).
- Publier ou soumettre une application (`eas submit`, `eas update`, `firebase deploy`) : le déploiement passe par la CI/CD, sur demande explicite.
- Modifier le code généré de `src/api/generated`, ou le backend depuis ce projet.
- Écrire du code d'avance : composant, fonction, schéma, mock, clé de traduction, variable d'environnement, dépendance ou script que le ticket en cours n'utilise pas.
- Mettre une chaîne utilisateur en dur, un secret dans le bundle, ou un appel HTTP dans un composant.
- Inventer une règle produit absente des README.

## Design

- Toute interface suit `docs/design/design.md` (couleurs, typo, composants, rédaction, accessibilité). Le lire avant de créer ou modifier un écran ou un composant.
- Avant de construire un écran, regarder sa maquette dans `docs/design/maquettes/` s'il y en a une. Les noms et chiffres des maquettes sont des exemples, `design.md` fait foi.
- Les couleurs passent par les tokens qui y sont définis, jamais en dur.

## Agents et skills du projet

| Nom | Type | Quand l'utiliser |
|---|---|---|
| `next-task` | skill | Prendre la prochaine issue GitHub du backlog, l'implémenter, committer, pousser, relire les commentaires de la PR |
| `bootstrap` | skill | Aperçu des phases du projet (le détail est dans `TASKS.md`) |
| `new-screen` | skill | Créer un écran (page web + route mobile) avec sa feature |
| `api-client-sync` | skill | Synchroniser le contrat, régénérer le client, ajouter un hook de requête |
| `i18n-and-formats` | skill | Ajouter des textes FR/EN, formater dates, distances, durées, rangs |
| `challenge-ui-rules` | skill | Règles d'affichage des challenges, classements, statuts, saisie d'activité |
| `ts-reviewer` | agent | Relecture du code TypeScript et React après modification |
| `ux-reviewer` | agent | Relecture des textes, de l'accessibilité et des états d'écran |
| `spec-guardian` | agent | Vérifier que l'interface respecte les règles produit |
| `security-reviewer` | agent | Relecture sécurité : jetons, liens profonds, secrets, consentement |
