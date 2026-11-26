---
name: challenge-ui-rules
description: Règles d'affichage et de saisie des challenges du frontend Sport Challenge (catégories à la carte, sport de référence, classements, statuts, participation, activités, fuseaux, résultats figés). À utiliser pour tout écran qui crée un challenge, affiche un classement, permet de rejoindre ou de quitter, ou saisit une activité.
---

# Règles d'interface des challenges

> **V1 = web uniquement.** Ignore tout ce qui concerne le mobile, Expo, EAS, Maestro et les liens profonds : c'est reporté à la V2.

Les règles produit ne sont **pas** recopiées ici. Lis celles de l'écran avant de le construire :

- `README.md` §2 : résumé des règles côté interface et décisions propres à l'interface (mention « manuelle », visibilité des activités entre participants…) ;
- `README.md` §4 : écrans (§4.2), rafraîchissement (§4.3 : ni bouton « Actualiser » ni geste maison en V1), invitations et liens invalides ou expirés (§4.4), dates et unités (§4.6) ;
- `docs/design/design.md` : libellés (« Abandonner », pas « Quitter »), statuts (« A abandonné »), confirmations des actions définitives ;
- README du backend §2, qui fait foi : §2.1 challenges, §2.2 participation (un exclu apparaît comme un abandon), §2.3 catégories, §2.4 coefficients, §2.5 activités, §2.6 classement, §2.7 badges, §2.12 administration.

Ce skill dit **comment** les afficher.

## Le serveur décide, l'interface reflète

- Une action, une échéance ou un statut ne s'affiche que d'après les champs de l'API : `can_join`, `locked`, `week_ends_at`, statut de l'élimination (`reached`, `at_risk`, `in_progress`, `eliminated`), minimum de la semaine. Jamais de formule recopiée côté client.
- Champ manquant : skill `api-client-sync`, section « Si le contrat ne suffit pas ».

## Catégories et classement

- Affiche les catégories que le serveur renvoie, **dans son ordre**, sans supposer leur nombre : un onglet par catégorie, chacune avec son podium. Les noms viennent des clés de traduction, jamais des identifiants techniques.
- Podium des 3 premiers rangs ; ex aequo au même rang ; la ligne de l'utilisateur est mise en évidence et reste visible ; heure de dernière mise à jour affichée.
- Un participant parti (abandon, exclusion) apparaît comme le README le décrit, hors podium.
- Challenge terminé : résultats en lecture seule.

## Statuts et échéances

- Jamais la couleur seule : un texte ou une icône accompagne chaque statut.
- L'échéance de la semaine s'affiche dans le fuseau du challenge, près de l'avancement.
- Une personne éliminée voit la semaine de son élimination ; elle reste classée dans les autres catégories.

## Formulaires

- **Création** : assistant par étapes, validé par les schémas de `src/domain/schemas` ; récapitulatif avant l'envoi avec les dates dans le fuseau choisi et ce qui ne sera plus modifiable ensuite.
- **Édition** : seuls les champs que le README déclare modifiables ; le reste en lecture seule.
- **Saisie d'activité** : champs selon le sport, d'après le catalogue de l'API (distance seulement si le sport en produit) ; la vitesse n'est jamais saisie, elle s'affiche telle que l'API la calcule ; dates et boutons modifier / supprimer limités par `locked` et les bornes fournies par l'API ; clé d'idempotence, bouton désactivé pendant l'envoi ; après l'envoi, indique dans combien de challenges l'activité compte.
- **Actions irréversibles** (abandonner, exclure, supprimer le challenge) : confirmation qui dit les conséquences décrites par le README, en termes clairs.

## Badges (V1.1, reportés après la V1 : ne rien développer en V1)

- **Créateur** : formulaire de création avec un **assistant de condition** (jamais de saisie libre) : mesure (distance, durée, nombre d'activités) → portée (une seule sortie, une semaine, tout le challenge, plusieurs semaines de suite) → filtre de sport (tous, course seule, un sport) → seuil. Aperçu en une phrase lisible (« 10 km sur une seule course »). Un badge déjà gagné par quelqu'un n'est plus modifiable ni supprimable (cacher ces actions, d'après les champs de l'API).
- **Participant** : liste des badges du challenge avec leur condition, ceux déjà gagnés et la progression si l'API la fournit. Nouveau badge repéré au rechargement (V1) : message de félicitations, sans attendre un temps réel.
- Limite de 50 badges par challenge : message clair quand elle est atteinte.
- Les badges sont gagnés dès que la condition est atteinte : ne jamais afficher « à la fin de la semaine ».

Ces décisions d'interface des badges ne sont écrites qu'ici : garde-les tant qu'elles ne sont pas dans le README.

## Formats et conformité

- Dates, distances, durées et rangs : skill `i18n-and-formats`.
- Contenu d'autres utilisateurs (pseudos) affiché comme du texte ; suppression de compte accessible depuis le profil.
