---
name: next-task
description: Prend la prochaine issue GitHub du backlog du frontend web Sport Challenge, l'implémente et prépare le commit. À utiliser quand on dit « prochain ticket », « next task », « prends le ticket SC-WEB-0xx », « on continue le backlog » ou « quelle est la suite ».
---

# Traiter un ticket du backlog frontend

> **V1 = web uniquement.** Le backlog est dans les **issues GitHub** (tickets `SC-WEB-001` à `SC-WEB-052`, numérotation non consécutive : les tickets listés dans « Tickets fusionnés » de `TASKS.md` n'existent plus). **Un ticket = un commit.** Ne traite jamais deux tickets d'affilée sans que l'utilisateur ait validé le commit du premier.

## 1. Choisir le ticket

Les tickets sont des **issues GitHub** (importées depuis `TASKS.md`). Le statut vit dans l'issue, jamais dans `TASKS.md`.

- Si l'utilisateur donne un identifiant, prends celui-ci : `gh issue view <numéro ou identifiant>` (le numéro d'issue est dans le titre de `python3 .claude/scripts/tasks.py next` ; sinon `gh issue list --search "SC-WEB-0xx in:title" --state all`).
- Sinon, lance `python3 .claude/scripts/tasks.py next` : il renvoie la première issue **ouverte** dont **toutes** les dépendances sont **fermées**, hors étiquettes `v1.1` (reporté), `blocked`, `needs-decision` et `en-cours`.
- Si la commande affiche une ligne `EN COURS`, propose de reprendre ce ticket avant d'en ouvrir un autre.
- Si aucun ticket n'est disponible, explique pourquoi (dépendances encore ouvertes, décisions attendues) ; ne contourne jamais une dépendance sans demande explicite.
- Un ticket `blocked` ou `needs-decision` n'est jamais pris : explique ce qui manque et demande la décision.
- Lis l'issue en entier avec `gh issue view <numéro>` : description, critères d'acceptation, tests, revue, message de commit.

## 2. Se préparer

- Relis les sections du `README.md` citées par le ticket et les règles de `CLAUDE.md`.
- Regarde le champ **Backend** : si l'API du ticket n'existe pas encore, travaille contre les **mocks MSW** et signale-le à l'utilisateur. Ne modifie jamais le backend.
- Si un critère s'appuie sur un 🟡 ou un ❓ non tranché, ou si le ticket contredit le README : **demande avant d'écrire**.
- **Branche** (une par ticket, créée automatiquement) :
  1. `git status` : si l'arbre de travail n'est pas propre, **arrête-toi** et demande quoi faire (le travail non committé n'est jamais écrasé).
  2. Si l'utilisateur est déjà sur une branche de ce ticket (`sc-web-0xx-…`), reprends-la.
  3. Sinon : `git switch main`, `git pull --ff-only`, puis `git switch -c <identifiant en minuscules>-<résumé court du titre>` (ex. `sc-web-001-vite-react-app`) : minuscules, tirets, 40 caractères au plus pour le résumé.
  4. Ne pars jamais d'une autre branche de ticket non fusionnée sans l'accord de l'utilisateur.
- Marque le ticket en cours : `python3 .claude/scripts/tasks.py start <numéro>` (étiquette `en-cours`, assigné à l'utilisateur, statut « In Progress » du Project).
- Annonce un court plan.

## 3. Implémenter

- Suis les critères d'acceptation et suis leur avancement pendant le travail.
- Données : uniquement par les hooks de `src/api`. Si une route ou un champ manque dans le contrat, utilise le skill `api-client-sync` et signale-le ; ne contourne pas.
- Textes : skill `i18n-and-formats` (clés FR **et** EN, aucune chaîne en dur). Règles d'affichage : skill `challenge-ui-rules`. Nouvel écran : skill `new-screen`.
- **Le serveur décide** : n'affiche une action ou un statut que d'après les champs de l'API (`can_join`, `week_ends_at`, `locked`, statuts de la catégorie 3).
- Téléphone d'abord (360 px), états chargement / erreur / vide / connexion requise, accessibilité.
- Ne sors pas du périmètre du ticket : note tout travail nécessaire hors périmètre comme ticket proposé.
- **Pas de code d'avance** : crée seulement ce que le ticket utilise (dossier, composant, fonction, schéma, mock, clé de traduction, variable d'environnement, dépendance, script). Un besoin imprévu s'ajoute au ticket en cours et se signale.
- Ne crée **rien** pour le mobile (V2).

## 4. Vérifier

- `pnpm check` (typecheck, lint, tests). Pour un parcours critique, lance aussi les tests de bout en bout concernés.
- Lance les agents indiqués dans le champ **Revue** et corrige les points bloquants.

## 5. Clôturer, sans committer

- Si **tous** les critères d'acceptation sont remplis : `python3 .claude/scripts/tasks.py tick <numéro>` coche les cases dans l'issue. S'il en reste un non rempli, ne lance pas `tick` : dis lequel et pourquoi.
- Ne ferme pas l'issue et ne change pas son statut : elle se ferme toute seule à la fusion de la pull request qui contient `Closes #<numéro>`.
- Présente : fichiers modifiés, résumé du diff, résultat des vérifications, points ouverts, et le **message de commit** du ticket, terminé par `Closes #<numéro>` puis `Refs: SC-WEB-0xx` en pied.
- **N'exécute ni `git commit`, ni `git push`, ni `gh pr create` (seule la création de branche du §2 est automatique).** Attends l'accord explicite de l'utilisateur. `git add`, `git status` et `git diff` sont permis. Propose le titre et la description de la pull request (avec `Closes #<numéro>`).
- Indique que le ticket suivant sera disponible une fois cette pull request fusionnée, et ses décisions éventuellement en attente (FD1 à FD7 dans `TASKS.md`). L'utilisateur peut aussi demander explicitement un autre ticket.
