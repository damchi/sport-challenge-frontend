---
name: new-screen
description: Crée un écran web du frontend Sport Challenge (page + route), avec sa feature, ses états, ses traductions et ses tests. À utiliser quand on dit « ajoute un écran », « nouvelle page », « crée l'écran X ».
---

# Créer un écran web

> **V1 = web uniquement.** Ignore tout ce qui concerne le mobile, Expo, EAS, Maestro et les liens profonds : c'est reporté à la V2.

Avant de commencer : vérifie dans le `README.md` (§4.1 et le tableau « Écrans et fichiers ») que l'écran existe dans la spécification ; sinon, demande avant de l'ajouter. Relis `challenge-ui-rules` si l'écran affiche des challenges, des classements ou des activités.

## Étapes

1. **Données** : liste les requêtes et mutations nécessaires. Elles doivent exister dans `src/api/hooks`. Sinon, utilise le skill `api-client-sync` ; si la route manque dans le contrat, signale-le à l'utilisateur au lieu de la contourner.
2. **Feature** : crée ou complète `features/<domaine>/` (composants, hooks locaux, types), dans `src/features`. La logique pure va dans `src/domain`. Ne crée que les fichiers et composants dont l'écran a besoin maintenant.
3. **Web** : `pages/<Nom>Page.tsx` (fine : elle assemble des composants), route dans `routes/` avec la garde « connecté » si nécessaire.
5. **États obligatoires** : chargement (squelette), erreur traduite avec réessai, vide avec explication, « connexion requise ».
6. **Textes** : skill `i18n-and-formats`, clés françaises et anglaises, aucune chaîne en dur.
7. **Accessibilité et thèmes** : libellés, zones tactiles d'au moins 44 pt, jetons de design, thème clair et sombre.
8. **Rafraîchissement** : en V1, rechargement à l'ouverture, au retour dans l'app et par tirer-pour-rafraîchir (pas de temps réel).
9. **Tests** : composants avec Testing Library, hooks avec MSW ; un test de bout en bout si l'écran fait partie d'un parcours critique (connexion, création de challenge, saisie d'activité, invitation).
10. **Revue** : agents `ts-reviewer`, `ux-reviewer`, et `spec-guardian` si l'écran porte une règle produit.

## Règles

- Un écran ne contient pas de logique et ne fait aucun appel HTTP direct.
- Le serveur décide : n'affiche « Rejoindre », une échéance ou un statut que d'après les champs de l'API.
- Un lien profond (invitation) valide ses paramètres avant toute action.

## Fin

`pnpm check`, puis propose le commit (fichiers + message) sans l'exécuter.
