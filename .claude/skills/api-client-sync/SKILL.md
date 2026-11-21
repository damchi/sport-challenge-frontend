---
name: api-client-sync
description: Synchronise le contrat OpenAPI du backend, régénère le client TypeScript de src/api et ajoute ou modifie un hook de requête TanStack Query. À utiliser quand on dit « le backend a changé », « régénère le client », « ajoute un hook pour la route X », « l'API ne renvoie pas le champ Y ».
---

# Contrat d'API et client

Le backend est la source de vérité du contrat (`openapi.yaml`). Le frontend ne définit jamais de route ni de champ de son côté.

## Synchroniser et générer

1. `pnpm api:sync` : copie `openapi.yaml` depuis `../sport-challenge-api/api/openapi.yaml` (ou `../backend/api/openapi.yaml`) si le dépôt backend est cloné à côté, sinon depuis l'adresse ou le tag fournis par l'utilisateur. La copie est **versionnée** dans `openapi/openapi.yaml` pour que la CI soit autonome.
2. Regarde le diff du contrat. S'il contient un changement incompatible (champ retiré ou renommé, route supprimée), liste les écrans touchés et préviens l'utilisateur avant de continuer.
3. `pnpm api:generate` : régénère `src/api/generated/`. **Ne modifie jamais ce dossier à la main.**
4. Outil de génération : 🟡 `openapi-typescript` (types) avec `openapi-fetch` (appels), hooks TanStack Query écrits à la main dans `hooks/`. Confirme avec l'utilisateur avant d'installer un autre outil.

## Ajouter un hook de requête

- Fichier par ressource dans `src/api/hooks/`, créé par le premier ticket qui l'utilise : `useChallenges`, `useChallenge`, `useLeaderboard`, `useCreateActivity`, `useMe`…
- Clés de requête **centralisées** (`queryKeys.ts`), hiérarchiques (`['challenges', id, 'leaderboard', categoryId]`).
- Mutations : invalide les clés concernées (création d'activité → classement et activités ; départ d'un challenge → challenge, participants, classement).
- Listes : pagination par curseur (`useInfiniteQuery`).
- Création d'activité : clé d'idempotence générée côté client et envoyée à chaque tentative.
- Classement : `staleTime` court, rechargement à l'ouverture et au retour dans l'app (le tirer-pour-rafraîchir natif du navigateur recharge la page) ; pas de bouton, de geste maison ni de temps réel en V1.

## Erreurs

- `client.ts` normalise toute erreur en `{ code, status }` à partir du format `{ "error": { "code", "message" } }` du backend.
- Un nouveau code d'erreur → clé `errors.<code>` dans `src/i18n` (français et anglais), via le skill `i18n-and-formats`.
- 401 : renouvelle la session une fois, puis déconnecte et vide le cache.

## Tests

Gestionnaires MSW alignés sur le contrat ; un test par hook (succès, erreur traduisible, invalidation après mutation).

## Si le contrat ne suffit pas

Il manque un champ (par exemple « peut rejoindre », objectif de la semaine, statut) : **ne recalcule pas la règle côté client**. Décris précisément le besoin à l'utilisateur (route, champ, exemple de réponse) pour qu'il le demande au projet backend.

## Fin

`pnpm check`, agent `ts-reviewer`, puis propose le commit sans l'exécuter.
