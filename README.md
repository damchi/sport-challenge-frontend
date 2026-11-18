# Sport Challenge — App (web d'abord, mobile en V2)

Projet **frontend** de l'application de challenges sportifs entre amis : **application web (React)** en V1 ; **application mobile (React Native avec Expo)** en V2, dans un second temps (le dépôt deviendra alors un monorepo). Objectif : une V1 utilisable le plus vite possible, sans les synchronisations des marques sportives (saisie manuelle).

Le **backend** (API Go) est un projet séparé, avec son propre README. Il reste la **source de vérité** des règles du produit et du contrat d'API (`openapi.yaml`).

> **Légende** : ✅ décidé · 🟡 proposition par défaut, à confirmer · ❓ question ouverte

---

## 1. Contexte

Une personne crée des challenges sportifs entre amis, choisit une durée, la visibilité (privé ou public) et si les invités peuvent inviter à leur tour. Chaque challenge a plusieurs catégories, chacune avec son podium. Les activités sont saisies à la main en V1, puis synchronisées depuis Strava, Garmin, Polar et Coros dans une version ultérieure.

---

## 2. Règles produit à connaître côté interface

Résumé des règles décidées. Le détail complet est dans le README du backend.

**Challenges**
- ✅ Public (listé sur l'accueil) ou privé (sur invitation d'un créateur ou d'un participant).
- ✅ Plusieurs créateurs possibles.
- ✅ La durée se choisit en **nombre entier de semaines, de 2 à 52**. Tout challenge a **toujours les 3 catégories** ; le créateur règle seulement l'incrément X (en km) de la catégorie 3.
- ✅ Début et fin selon le **fuseau du lieu de lancement** (ex. Montréal) : l'interface affiche les dates dans ce fuseau.
- ✅ Après le début : titre et description modifiables, **catégories non modifiables**.

**Participation**
- ✅ On peut rejoindre jusqu'à la fin de la **première semaine**.
- ✅ Un participant est classé dans **toutes** les catégories.
- ✅ Les activités détaillées (date, sport, durée, distance) de chaque participant sont visibles par les autres participants du challenge ; l'app l'indique clairement **avant** de rejoindre.
- ✅ « Quitter » = **abandon** : éliminé de toutes les catégories, définitivement (affiché « a abandonné »). Un compte supprimé est traité de la même façon. Les créateurs peuvent supprimer le challenge, ajouter un créateur et exclure un participant.

**Catégories** (3, un podium chacune)
- **1. Temps cumulé** : toutes les activités, tous sports confondus ; plus de temps cumulé.
- **2. Distance cumulée** : activités avec km, ramenées à une distance de course si le sport est plus rapide ; plus de distance équivalente.
- **3. Course avec élimination** : course seule, en distance ; la distance d'une semaine doit être **au minimum** celle de la semaine précédente plus X km (incrément choisi à la création) ; si la personne court plus que le minimum, sa distance réelle devient la nouvelle base (X = 2 : 5 km, puis minimum 7 km ; 10 km courus, puis minimum 12 km). Éliminé de cette catégorie seulement ; pas d'élimination en semaine 1. Pendant la semaine, statut « objectif atteint », « en cours » ou « à risque ».

**Activités**
- ✅ V1 : saisie manuelle uniquement.
- ✅ La durée est toujours demandée ; la distance seulement pour les sports qui produisent des km (pas pour le yoga).
- ✅ Une activité est saisie **une seule fois** et compte dans tous les challenges de l'utilisateur dont la fenêtre la contient (l'interface l'indique après l'enregistrement). Elle devient non modifiable dès que sa semaine est terminée dans l'un d'eux.
- ✅ Si le sport n'est pas proposé, l'utilisateur choisit « Autre » et écrit un libellé libre (2 à 40 caractères). ✅ Ce sport compte pour le temps ; la distance est facultative et, si elle est saisie, il compte aussi pour la distance (🟡 coefficient ×1).
- ✅ Impossible d'ajouter une activité après la fin du challenge.
- ✅ Une semaine terminée est verrouillée : l'interface affiche l'échéance de la semaine (dans le fuseau du challenge), refuse une activité datée d'une semaine passée et ne permet plus de modifier ni de supprimer les activités de cette semaine.
- ✅ Pendant la semaine en cours, un participant peut modifier ou supprimer ses propres activités.
- ✅ La vitesse (ou l'allure) n'est **jamais saisie** : l'interface affiche celle que l'API calcule à partir de la durée et de la distance.
- 🟡 Les activités manuelles sont marquées « manuelle ».
- ✅ Coefficients de distance : vélo ×0,3 ; aviron, roller, ski de fond ×0,5 ; tous les autres sports à km ×1. Ils viennent du catalogue de sports de l'API.

**Classement**
- ✅ Mis à jour **au rafraîchissement** en V1 (pas de temps réel).
- ✅ Égalités en ex aequo (1, 1, 3).
- ✅ Résultats figés à la fin du challenge, sans délai de grâce.

**Profil et divers**
- ✅ Pseudo (unique sans tenir compte de la casse, 3 à 20 caractères : lettres, chiffres, `_`, `.`, `-`) et avatar ; français et anglais ; distances en km uniquement.
- ✅ **Badges (V1.1, reportés après la V1)** : le créateur d'un challenge en crée autant qu'il veut, chacun avec une condition (mesure, portée, filtre de sport, seuil) ; un participant le gagne dès qu'il l'atteint. 🟡 Un badge gagné est conservé ; 50 badges maximum par challenge.
- ✅ Application gratuite ; pas de contestation d'activité pour l'instant.

---

## 3. Stack technique

- ✅ **Web** : React avec Vite, application monopage (pas de besoin de référencement : les challenges publics sont découverts depuis l'app).
- ✅ **Mobile (V2)** : React Native avec Expo, ajouté en V2 ; pas de code mobile en V1.
- ✅ **Pas de monorepo en V1** : une seule application Vite, gérée avec pnpm. Monorepo pnpm à la V2.
- 🟡 **Données serveur** : TanStack Query. **Formulaires** : react-hook-form avec schémas de validation partagés.
- 🟡 **Navigation** : React Router (web) ; Expo Router (mobile, V2).
- ✅ **Langues** : i18next, français et anglais.
- ✅ **Authentification** : **Auth0**, flux Authorization Code avec PKCE ; en V1 le SDK `@auth0/auth0-react` ; le SDK mobile (`react-native-auth0`, builds de développement Expo) viendra en V2. La connexion est obligatoire pour toute l'application. Sign in with Apple devient obligatoire seulement avec l'application iOS (V2) si une autre connexion sociale y est proposée.
- 🟡 **Tests** : Vitest et Testing Library (composants), Playwright (web), Maestro (parcours mobile).
- **Suivi d'erreurs** sur web et mobile (ex. Sentry) ; analytics produit plus tard, avec consentement.

---

## 4. Architecture frontend

### 4.1 Vue d'ensemble

- ✅ **Web** : React (Vite), application monopage. Pas de besoin de référencement, puisque les challenges publics sont découverts depuis l'app.
- ✅ **Mobile (V2)** : React Native avec Expo, ajouté en V2 ; pas de code mobile en V1.
- ✅ **Une seule application en V1** (pas de monorepo) : un seul `package.json`, géré avec pnpm. Le **monorepo pnpm** (`apps/web`, `apps/mobile`, `packages/…`) sera créé en V2, à l'arrivée du mobile, en déplaçant `src/api`, `src/domain` et `src/i18n` dans des paquets partagés.

Structure **cible** (chaque dossier et chaque fichier naît avec le premier ticket qui l'utilise, voir `TASKS.md`) :

```
frontend/
├── index.html
├── package.json, tsconfig.json, vite.config.ts, configuration ESLint et Prettier
├── .env.example                     adresses publiques seulement (VITE_*)
├── openapi/
│   └── openapi.yaml                 copie versionnée du contrat du backend
├── public/                          manifeste PWA, icônes
├── e2e/                             tests Playwright
├── .github/workflows/               ci.yml, déploiement web
└── src/
    ├── main.tsx                     point d'entrée, fournisseurs (requêtes, auth, langue)
    ├── App.tsx
    ├── routes/                      définition des routes, gardes (utilisateur connecté)
    ├── pages/                       une page par écran, fines : elles assemblent des features
    │   ├── HomePage.tsx             challenges publics + mes challenges
    │   ├── ChallengePage.tsx        classement, participants, activités, infos
    │   ├── ChallengeCreatePage.tsx  assistant de création
    │   ├── ActivityNewPage.tsx
    │   ├── ProfilePage.tsx          profil, compte (badges en V1.1)
    │   ├── InvitePage.tsx           ouverture d'un lien d'invitation
    │   ├── AuthCallbackPage.tsx
    │   └── NotFoundPage.tsx
    ├── features/                    logique et composants par domaine
    │   ├── challenges/              liste, carte, formulaire en étapes, édition titre/description
    │   ├── leaderboard/             tableau par catégorie, podium, statut « à risque »
    │   ├── activities/              formulaire de saisie, liste des activités
    │   ├── invitations/             partage de lien, acceptation
    │   ├── profile/                 pseudo, langue (avatar en V1.1)
    │   └── badges/                  V1.1
    ├── components/                  interface réutilisable (boutons, champs, mise en page, modales)
    ├── api/                         portable : aucun import de react-dom ni du navigateur
    │   ├── generated/               types générés depuis openapi.yaml (ne pas modifier)
    │   ├── client.ts                instance HTTP, jeton d'accès, renouvellement, erreurs
    │   ├── queryKeys.ts             clés de requête centralisées
    │   └── hooks/                   useChallenges, useLeaderboard, useCreateActivity, useMe, …
    ├── domain/                      portable : types (catégories, statuts), formats de distance,
    │                                durée, rang et fuseaux, schémas de validation (zod)
    ├── i18n/                        portable : fr.json, en.json, codes d'erreur traduits
    ├── lib/                         configuration (config.ts), auth, outils
    └── styles/                      jetons de design (couleurs, espacements), thème clair et sombre
```

**Règles de structure**

- Une **page** ne contient pas de logique : elle assemble des composants de `features/`.
- Une **feature** regroupe tout ce qui concerne un domaine : composants, hooks locaux, types.
- `src/api`, `src/domain` et `src/i18n` restent **portables** (aucun import de `react-dom` ni d'API du navigateur) pour que le mobile les réutilise tels quels en V2. Les composants d'interface sont propres à la plateforme.
- Aucun appel HTTP direct dans les composants : tout passe par les hooks de `src/api`.
- Les types de l'API sont **générés** depuis `openapi.yaml`, jamais écrits à la main.
- Les tests sont à côté du code (`*.test.tsx`) ; les tests de bout en bout sont dans `e2e/`.

**Écrans et fichiers (web, V1)**

| Écran | Fichier |
|---|---|
| Accueil et mes challenges | `pages/HomePage.tsx` |
| Détail et classement | `pages/ChallengePage.tsx` |
| Création | `pages/ChallengeCreatePage.tsx` |
| Saisie d'activité | `pages/ActivityNewPage.tsx` |
| Profil | `pages/ProfilePage.tsx` |
| Invitation | `pages/InvitePage.tsx` |
| Connexion (retour Auth0) | `pages/AuthCallbackPage.tsx` |

- En V2, l'interface mobile sera écrite séparément (composants natifs) ; la logique, les types et le client d'API sont partagés.

### 4.2 Écrans

| Zone | Écrans |
|---|---|
| Entrée | Connexion / inscription, choix du pseudo et de l'avatar, langue |
| Accueil | Challenges publics ouverts, mes challenges (en cours, à venir, terminés) |
| Création | Assistant en étapes : infos → durée et fuseau → catégories → visibilité et invitations |
| Challenge | Classement par catégorie (onglets), statut live (« objectif atteint », « à risque »), participants, activités, badges du challenge, infos, invitations |
| Activité | Saisie : sport, date, durée, distance si le sport en produit |
| Profil | Pseudo, avatar, langue, badges obtenus, supprimer le compte (traité comme un abandon) |
| Badges (créateur) | Création et gestion des badges d'un challenge : nom, description, assistant de condition |
| V2 | Connexion aux marques sportives (Strava, Polar, Garmin, Coros) |

### 4.3 Données et état

- 🟡 **Données serveur** : TanStack Query (cache, rafraîchissement).
- ✅ **V1 : classement mis à jour au rafraîchissement** : rechargement à l'ouverture de l'écran, au retour dans l'app et par tirer-pour-rafraîchir.
- 🟡 **État local** : minimal (contexte React ou Zustand), pour la session et les préférences.
- 🟡 **Formulaires** : react-hook-form avec schémas de validation partagés avec le backend.
- Plus tard : mise à jour instantanée via flux serveur (SSE) sans changer les écrans.

### 4.4 Navigation et invitations

- Web : React Router. Mobile : Expo Router.
- **Liens profonds** (universal links et app links) pour les invitations : un lien d'invitation ouvre l'app au bon challenge, ou la page web si l'app n'est pas installée.

### 4.5 Authentification côté client

- SDK Auth0, flux Authorization Code avec PKCE ; l'app demande un **access token** pour l'API du backend (audience), pas seulement l'ID token.
- Mobile : jetons dans le Keychain / Keystore (`expo-secure-store`).
- Un intercepteur du client API ajoute le jeton et renouvelle la session au besoin.

### 4.6 Langues, dates et unités

- ✅ Français et anglais, avec la langue de l'appareil par défaut (i18next).
- ✅ Distances en **km** uniquement.
- Les dates d'un challenge s'affichent dans **son** fuseau (ex. Montréal), avec une indication claire si l'utilisateur est dans un autre fuseau.
- Les erreurs de l'API sont traduites à partir de leurs codes stables.

### 4.7 Images

- Avatar : l'app demande une URL signée à l'API, envoie le fichier directement au bucket, puis confirme à l'API.
- Compression et recadrage côté client avant l'envoi.

### 4.8 Hors-ligne et notifications

- ✅ V1 : connexion requise, y compris pour la saisie d'activité.
- 🟡 Plus tard : file d'attente locale pour la saisie hors ligne (avec clé d'idempotence côté API).
- V3 : notifications push (rappel d'objectif, dépassement, fin de challenge).

### 4.9 Qualité, build et distribution

- 🟡 Tests : Vitest et Testing Library (composants), Playwright (web), Maestro (parcours mobile).
- Suivi d'erreurs sur web et mobile (ex. Sentry) ; analytics produit plus tard, avec consentement.
- ✅ CI GitHub Actions (`.github/workflows/ci.yml`) sur chaque pull request et sur `main` : `typecheck`, `lint`, `test`, `build`. Claude relit chaque pull request (`.github/workflows/claude-review.yml`) et commente seulement, sans droit de pousser ni de fusionner ; il lui faut le secret de dépôt `CLAUDE_CODE_OAUTH_TOKEN`.
- ✅ Protection de `main` (réglée à la main dans GitHub, Settings > Rules) : pull request obligatoire, vérification « typecheck, lint, test, build » verte avant fusion, pas de push forcé ni de suppression.
- Web : hébergement statique (Firebase Hosting ou Cloud Storage avec CDN), déployé par la CI.
- Mobile : builds avec EAS Build, diffusion de test par TestFlight (iOS) et pistes de test internes (Android), puis publication sur les deux stores.
- Les stores exigent une étiquette de confidentialité, et une option de signalement ou de blocage si du contenu public est visible.

### 4.10 Web d'abord, mobile en V2

- ✅ **V1 = web uniquement**, en une seule application Vite. Le monorepo pnpm (`apps/web`, `apps/mobile`, `packages/…`) sera créé en V2 ; d'ici là, le code partageable reste isolé dans `src/api`, `src/domain` et `src/i18n`.
- 🟡 **Web conçu pour le téléphone d'abord** (écrans de 360 px, zones tactiles d'au moins 44 px), puisque la saisie d'une sortie se fait souvent juste après l'effort, depuis un téléphone. Application web **installable** (PWA : manifeste et icônes) comme passerelle jusqu'à la V2.
- ✅ **Les dossiers partageables restent indépendants de la plateforme** (`src/api`, `src/domain`, `src/i18n` : aucun import du navigateur, de `react-dom` ni de `react-native`) pour que le mobile les réutilise tels quels en V2 : client d'API, schémas, domaine, traductions.
- Les liens d'invitation ouvrent une **page web** (ils fonctionnent partout) ; les liens profonds vers l'application viendront avec le mobile.
- Les formalités des stores (comptes développeur, étiquettes de confidentialité, signalement, builds) sont reportées à la V2.
- ✅ Styles : **Tailwind CSS v4**, avec les jetons de `docs/design/design.md` en variables CSS (`src/styles/tokens.css`) ; polices Inter et Space Grotesk servies par l'application (Fontsource). Décision FD1, validée au ticket SC-WEB-003.
- 🟡 Composants du type shadcn/ui, ajoutés un par un à l'usage : à valider avec le premier composant qui en a besoin.

---

## 5. Contrat avec le backend

- Source de vérité : `openapi.yaml` du dépôt backend. Le client TypeScript de `src/api` est **généré** depuis ce fichier ; on ne l'écrit jamais à la main.
- API versionnée sous `/api/v1`.
- Les erreurs arrivent avec un **code stable** ; l'interface les traduit en français ou en anglais à partir de `src/i18n`.
- Les listes utilisent une **pagination par curseur**.
- Les créations d'activité envoient une **clé d'idempotence** (utile pour le hors-ligne et les envois répétés).
- Les adresses de l'API et la configuration d'authentification (domaine, audience) viennent de variables d'environnement, une par environnement (développement, staging, production).
- Toute évolution de l'API passe d'abord par le backend ; le frontend régénère son client.

---

## 6. Conformité côté client

> Je ne suis pas juriste : ces points sont à faire valider avant le lancement public.

- Lien vers la **politique de confidentialité** et les conditions d'utilisation, en français et en anglais, depuis l'inscription et le profil.
- **Consentement** explicite avant tout suivi d'analytics (aucun suivi tant qu'il n'est pas accordé).
- **Suppression de compte depuis l'app** : à ma connaissance, Apple l'exige pour toute app qui permet de créer un compte. Le backend anonymise et traite cela comme un départ des challenges.
- **Étiquettes de confidentialité** des stores et justification de chaque permission demandée (photos pour l'avatar, notifications, plus tard Apple Health ou Health Connect).
- Les stores demandent un moyen de **signaler ou bloquer** un utilisateur ou un contenu quand du contenu public est visible (pseudos et avatars des challenges publics) : à prévoir même sans système de litige pour les activités.
- Afficher la marque et les mentions exigées par chaque fournisseur sportif quand les synchronisations arriveront (V2 et suivantes).

---

## 7. Feuille de route

1. **V1 (web uniquement)** : connexion, accueil (challenges publics et les miens), création de challenge en étapes, détail avec classement par catégorie, saisie d'activité, invitations par lien, profil, français et anglais, web adapté au téléphone et installable. Les badges et l'upload d'avatar sont **reportés en V1.1** (avatars à initiales en V1).
2. **V2** : application mobile (Expo) qui réutilise les paquets partagés ; écrans de connexion aux marques sportives (Strava, puis Polar) sur le web et le mobile ; liens profonds.
3. **V3** : notifications push, classement en temps réel, saisie hors ligne, Garmin et Coros.

---

## 8. Questions ouvertes

- ❓ V2 : l'application mobile arrive-t-elle avec les synchronisations Strava et Polar, ou avant ?
- ❓ Hébergement du web : Firebase Hosting ou Cloud Storage avec CDN.
- ✅ Structure du dépôt : une seule application Vite en V1 ; monorepo pnpm (avec ou sans Turborepo, à décider alors) à l'arrivée du mobile en V2.
- ❓ État local : contexte React ou Zustand.
- ❓ Confirmer les points marqués 🟡.
