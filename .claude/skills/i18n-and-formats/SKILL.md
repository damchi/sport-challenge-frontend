---
name: i18n-and-formats
description: Ajoute des textes français et anglais et formate dates, fuseaux, distances, durées et rangs dans le frontend Sport Challenge. À utiliser quand on dit « ajoute un texte », « traduis », « affiche la date / la distance / la durée / le rang », ou quand un code d'erreur de l'API doit être traduit.
---

# Traductions et formats

Les fichiers vivent dans `src/i18n` (`fr.json`, `en.json`), portables pour être réutilisés par le mobile en V2. N'ajoute une clé que si le ticket en cours l'utilise.

## Ajouter un texte

1. Ajoute la clé dans **les deux** fichiers, dans le même commit.
2. Clés en anglais, hiérarchiques : `challenge.create.title`, `leaderboard.status.atRisk`, `errors.challenge_not_found`.
3. Pluriels et variables via i18next (`{{count}}`), jamais de concaténation de morceaux de phrase.
4. Aucune chaîne utilisateur en dur dans un composant. En français, espace insécable (U+00A0) avant les unités et la ponctuation double (`30 s`, `:`, `?`, `!`).
5. Vérifie que les deux langues ont exactement les mêmes clés : `pnpm i18n:check` (inclus dans `pnpm check`).

## Erreurs de l'API

Chaque code stable du backend a une clé `errors.<code>` (par exemple `errors.challenge_not_found`) et une clé de repli `errors.unknown`. Jamais le message brut du serveur.

## Langue

Langue de l'appareil par défaut, choix possible dans le profil. ✅ Langue de repli : anglais (`FALLBACK_LANGUAGE` dans `src/i18n/index.ts`).

## Dates et fuseaux

- Un challenge s'affiche dans **son** fuseau : `Intl.DateTimeFormat(locale, { timeZone: challenge.timezone, ... })`.
- Quand le fuseau de l'utilisateur diffère, ajoute une mention claire (« heure de Montréal »).
- Les semaines se découpent dans le fuseau du challenge. N'additionne jamais `7 × 24 h` côté client pour trouver une échéance : utilise la date fournie par l'API.
- Les composants reçoivent la date en paramètre (pas de `new Date()` caché) pour rester testables.

## Distances, durées, rangs

- **Distances** : km uniquement, selon la langue (`Intl.NumberFormat`) : 12,5 km en français, 12.5 km en anglais ; une décimale pour les courtes distances, zéro au-delà de 100 km.
- **Durées** : `h:mm` (ou « 1 h 05 »), jamais de secondes brutes.
- **Rangs** : ordinaux selon la langue (1er / 1st) ; ex aequo avec le même rang (1, 1, 3).
- **Catégories** : noms affichés issus des clés de traduction, jamais des identifiants techniques.

## Tests

Teste les formateurs de `src/domain` avec des cas fixes (changement d'heure, fuseaux différents, grandes et petites distances, durées de plusieurs jours).

## Fin

`pnpm check`, agent `ux-reviewer`, puis commit et push selon le workflow du dépôt (`CLAUDE.md`, skill `next-task`).
