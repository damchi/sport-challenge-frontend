---
name: bootstrap
description: Démarre le projet frontend Sport Challenge (application web, mobile en V2) ou indique la prochaine étape. À utiliser quand on dit « démarre le projet », « initialise le projet », « on commence par quoi », « quelle est la prochaine étape » ou quand le dépôt est vide ou incomplet.
---

# Démarrage du frontend, phase par phase

> **V1 = web uniquement.** Ignore tout ce qui concerne le mobile, Expo, EAS, Maestro et les liens profonds : c'est reporté à la V2 (phase 11).

**Pas de code d'avance** : une phase ne crée que ce que ses tickets utilisent.

Avance **une phase à la fois**. À la fin de chaque phase : `pnpm check` passe, puis **propose** (sans l'exécuter) la liste des fichiers et un message de commit, et attends la validation de l'utilisateur avant de commiter et de passer à la suivante. Ne commit et ne push jamais de toi-même. Avant de commencer, lis le `README.md` (§2 et §4) et `CLAUDE.md`, et regarde l'état du dépôt pour trouver la première phase non terminée.

Le backend est développé en premier : tant que son `openapi.yaml` n'est pas disponible, travaille contre des **mocks MSW** basés sur un contrat provisoire que tu fais valider par l'utilisateur.

## Phase 0 — Fondations minimales et CI

- Une **seule application** Vite + React + TypeScript strict (un seul `package.json`, pnpm), ESLint, Prettier, Vitest et Testing Library, `.gitignore`, `.env.example` (seulement les variables déjà lues par le code). Pas de monorepo en V1.
- Jetons de design (Tailwind), thèmes clair et sombre, web conçu pour le téléphone d'abord.
- CI GitHub Actions dès le début, et relecture des pull requests par Claude.
- Aucun dossier ni fichier vide créé d'avance.

**Terminé quand** : `pnpm install && pnpm check` passent, `pnpm dev` affiche une page et la CI est verte.

## Phase 1 — Contrat et client d'API

Skill `api-client-sync`. Synchronisation de `openapi.yaml` (copie dans `openapi/`), génération dans `src/api/generated/`, `src/api/client.ts` (jeton, erreurs normalisées, adresse de l'API), configuration de TanStack Query, MSW (serveur de test et mocks de développement). Les hooks, les clés de requête et les gestionnaires de mocks sont ajoutés par les tickets qui les utilisent.

## Phase 2 — Internationalisation

i18next, `src/i18n/fr.json` et `en.json`, contrôle de parité des clés (skill `i18n-and-formats`). Les formateurs, les schémas de validation et les composants réutilisables sont créés par les premiers écrans qui en ont besoin, pas avant.

## Phase 3 — Authentification et coque

SDK **Auth0** (isole-le derrière une interface `AuthProvider` avec un double de test ; demande l'access token de l'API avec la bonne audience). Web : routes et garde « connecté ». Écran de connexion, choix du pseudo et de l'avatar.

## Phase 4 — Accueil

Challenges publics et « mes challenges » (en cours, à venir, terminés). Skill `new-screen`.

## Phase 5 — Création de challenge

Assistant en étapes : infos → durée et fuseau → paramètres des 3 catégories (dont l'incrément X en km de la catégorie 3) → visibilité et invitations. Validation avec les schémas partagés. Lis `challenge-ui-rules`.

## Phase 6 — Détail et classement

Un onglet par catégorie, podium, statuts de la catégorie 3, ex aequo, « a abandonné », rafraîchissement au retour dans l'app et par tirer-pour-rafraîchir, rejoindre et abandonner. Lis `challenge-ui-rules`.

## Phase 7 — Saisie d'activité

Catalogue de sports, durée obligatoire, distance seulement si le sport produit des km, date dans la fenêtre du challenge, clé d'idempotence.

## Phase 8 — Profil et compte

Pseudo, langue, avatar **à initiales** (l'upload d'avatar et les badges sont reportés en V1.1, décision D10), supprimer le compte depuis l'app (traité comme un abandon).

## Phase 9 — Invitations

Partage de lien, acceptation sur une page web (les liens profonds vers l'application viendront avec le mobile).

## Phase 10 — Qualité et livraison

Playwright (web), suivi d'erreurs après consentement, application installable (PWA), performance, hébergement web (❓), déploiement staging **sur demande explicite**. **Ne lance jamais de déploiement sans demande explicite.**

## Fin de chaque phase

Lance les agents `ts-reviewer` (toujours), `ux-reviewer` (si écran ou texte), `spec-guardian` (si données métier) et `security-reviewer` (si authentification, liens profonds, stockage ou dépendance), puis résume les points à décider.

## Phase 11 — Application mobile (V2)

Créer le monorepo pnpm : déplacer l'application web dans `apps/web`, extraire `src/api`, `src/domain` et `src/i18n` dans `packages/`, puis créer `apps/mobile` (Expo, Expo Router) qui les réutilise. SDK `react-native-auth0` (builds de développement), jetons dans `expo-secure-store`, layouts `(auth)` et `(tabs)`, liens profonds d'invitation, EAS Build, TestFlight et pistes internes Android, conformité des stores. **Ne lance jamais `eas submit` ni `eas update` sans demande explicite.**
