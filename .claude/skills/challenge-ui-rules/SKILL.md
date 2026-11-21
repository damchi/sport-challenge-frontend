---
name: challenge-ui-rules
description: Règles d'affichage et de saisie des challenges du frontend Sport Challenge (catégories à la carte, sport de référence, classements, statuts, participation, activités, fuseaux, résultats figés). À utiliser pour tout écran qui crée un challenge, affiche un classement, permet de rejoindre ou de quitter, ou saisit une activité.
---

# Règles d'interface des challenges

> **V1 = web uniquement.** Ignore tout ce qui concerne le mobile, Expo, EAS, Maestro et les liens profonds : c'est reporté à la V2.

Source de vérité : le `README.md` du backend (§2) et le §2 du README du frontend. Principe : **le serveur décide, l'interface reflète**. Si un champ manque dans le contrat, demande-le (skill `api-client-sync`) au lieu de recalculer la règle.

## Les catégories (1 à 3, décision du 2026-11-20)

| # | Catégorie | Présence | Classement affiché |
|---|---|---|---|
| 1 | Temps cumulé (tous sports) | toujours | durée totale |
| 2 | Distance cumulée (ramenée au sport de référence si le sport est plus rapide) | au choix | km équivalents (« 12,5 km éq. vélo ») |
| 3 | Élimination, nommée d'après le sport de référence (« Course avec élimination », « Vélo avec élimination ») | au choix | survivants par km cumulés, puis éliminés |

- Le **sport de référence** (`reference_sport`) est choisi à la création parmi les sports à distance obligatoire, **course par défaut** ; il vaut toujours ×1.
- Affiche les catégories que le serveur renvoie, dans leur ordre, sans supposer qu'il y en a 3 : un onglet par catégorie, chacune avec son podium.
- Un participant apparaît dans toutes les catégories du challenge.
- La catégorie Points viendra avec SC-WEB-058 et SC-WEB-059.

## Création et édition

- Assistant en 4 étapes : infos (titre, description, visibilité publique ou privée, « les participants peuvent inviter ») → durée et **fuseau** (Montréal par défaut) → sport de référence et catégories (temps cumulé toujours inclus ; distance cumulée et élimination activables séparément ; incrément X en km seulement si l'élimination est choisie, ex. 2 km ; coefficients seulement avec la distance cumulée, pré-remplis par `min(1, facteur du sport / facteur de la référence)`, arrondi à deux décimales et jamais sous 0,1 (README backend §2.4), et modifiables, la référence restant ×1 ; SC-WEB-057) → récapitulatif et envoi.
- Durée en **nombre de semaines** (2 à 52), jamais en dates libres ; le temps cumulé est toujours présent (non décochable).
- Récapitulatif avant validation : dates affichées dans le fuseau choisi, sport de référence et catégories choisies, avertissement que les catégories ne seront plus modifiables.
- À tout moment (avant comme après le début), seuls le titre et la description sont éditables ; les catégories sont affichées en lecture seule.

## Participation

- « Rejoindre » n'apparaît que si l'API indique qu'on peut (jusqu'à la fin de la première semaine). Sinon, explique pourquoi.
- Bouton « Abandonner » (et non « Quitter ») : confirmation qui précise que c'est **définitif**, que la personne sera éliminée de toutes les catégories et apparaîtra « a abandonné », hors podium. Un participant exclu par un créateur apparaît lui aussi « a abandonné » (aucune mention « exclu »).
- Créateurs : « Supprimer le challenge », possible à tout moment, avec une confirmation très claire (tout disparaît pour tous les participants) ; « Ajouter un créateur » ; « Exclure » sur un participant.
- Avant de rejoindre : message clair indiquant que les activités (date, sport, durée, distance) seront visibles par les autres participants ; l'inscription demande une confirmation.
- Écran d'un participant : liste de ses activités en lecture seule (mention « manuelle » comprise), accessible aux seuls participants du challenge.
- Challenge privé : accès par invitation ; un lien invalide ou expiré affiche un message clair.

## Classement

- Podium des 3 premiers rangs ; ex aequo avec le même rang (1, 1, 3) ; la ligne de l'utilisateur est mise en évidence et reste visible.
- Heure de dernière mise à jour affichée. En V1 : rechargement à l'ouverture et au retour dans l'app ; ni bouton « Actualiser » ni geste maison, le tirer-pour-rafraîchir natif du navigateur recharge la page (décision du 2026-11-20 ; pas de temps réel, rafraîchissement automatique reporté à SC-WEB-055).
- Challenge terminé : résultats **figés**, lecture seule (badges obtenus en V1.1).

## Élimination : statuts

- Pendant la semaine : « objectif atteint », « en cours » ou « à risque » avec le minimum à atteindre et l'avancement (km). Jamais la couleur seule : ajoute un texte ou une icône.
- Éliminé : mention « éliminé en semaine N » ; le participant reste classé dans les autres catégories du challenge.
- Les valeurs (minimum de la semaine, statut) viennent de l'API ; n'écris pas la formule côté client. Règle à connaître pour les textes d'aide : le minimum de la semaine s+1 est la distance réellement faite dans le sport de référence en semaine s plus X (si la personne fait plus que le minimum, sa distance réelle devient la nouvelle base). Pas de minimum ni d'élimination en semaine 1. Il n'y a pas de délai de grâce : le minimum est définitif dès la fin de la semaine, et l'élimination est immédiate. Affiche l'échéance de la semaine (dans le fuseau du challenge) près de l'avancement.

## Saisie d'activité

- Choix du sport dans le catalogue de l'API ; option « Autre (préciser) » avec un libellé libre (2 à 40 caractères, affiché comme du texte). Un sport « autre » a une distance facultative (✅) : saisie, elle compte aussi pour la distance cumulée (coefficient suggéré ×1, modifiable par le créateur).
- Après l'enregistrement, indique dans combien de challenges l'activité compte (une seule saisie pour tous).
- Statuts de l'élimination : n'écris pas la règle côté client ; l'API fournit le statut (`reached`, `at_risk`, `in_progress`, `eliminated`), le minimum et la fin de semaine. La **durée** est toujours demandée ; la **distance** seulement si le sport produit des km (pas pour le yoga).
- La date doit être dans la fenêtre du challenge (bornes dans le fuseau du challenge) ; après la fin, le bouton d'ajout disparaît avec une explication.
- ✅ Une semaine terminée est verrouillée : le sélecteur de date n'accepte que la semaine en cours (début de semaine dans le fuseau du challenge), et les activités d'une semaine terminée n'ont plus de bouton « modifier » ni « supprimer » (affichage en lecture seule). Affiche l'échéance de la semaine (par exemple « fin de la semaine : lundi 12 octobre à 0 h, heure de Montréal »). ✅ Pendant la semaine en cours, modification et suppression de ses propres activités autorisées, d'après le champ `locked` du serveur.
- Ne demande jamais la vitesse ni l'allure : affiche celle que l'API calcule à partir de la durée et de la distance.
- ✅ Les activités saisies à la main portent la mention « manuelle ».
- Création avec clé d'idempotence ; bouton désactivé pendant l'envoi.
- Distance cumulée : montrer, si le contrat le fournit, la distance réelle et la distance équivalente au sport de référence.

## Badges (V1.1, reportés après la V1 : ne rien développer en V1)

- **Créateur** : formulaire de création avec un **assistant de condition** (jamais de saisie libre) : mesure (distance, durée, nombre d'activités) → portée (une seule sortie, une semaine, tout le challenge, plusieurs semaines de suite) → filtre de sport (tous, course seule, un sport) → seuil. Aperçu en une phrase lisible (« 10 km sur une seule course »). Un badge déjà gagné par quelqu'un n'est plus modifiable ni supprimable (cacher ces actions, d'après les champs de l'API).
- **Participant** : liste des badges du challenge avec leur condition, ceux déjà gagnés et la progression si l'API la fournit. Nouveau badge repéré au rechargement (V1) : message de félicitations, sans attendre un temps réel.
- Limite de 50 badges par challenge : message clair quand elle est atteinte.
- Les badges sont gagnés dès que la condition est atteinte : ne jamais afficher « à la fin de la semaine ».

## Formats

Dates dans le fuseau du challenge, distances en km, durées en `h:mm` : voir le skill `i18n-and-formats`.

## Conformité

Contenu public (pseudos, avatars) : prévoir signaler et bloquer. Suppression de compte accessible depuis le profil.
