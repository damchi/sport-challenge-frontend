# Design de l'interface

Référence visuelle du frontend. Toute nouvelle page ou tout nouveau composant
suit ce document. En cas de conflit avec une décision déjà prise dans ce dépôt
(bibliothèque de composants, outil CSS), la décision du dépôt l'emporte : on
applique alors ces règles avec l'outil choisi, sans en ajouter un autre.

Les maquettes d'origine (accueil, page d'un défi, classement) sont sur un
canevas Claude privé du propriétaire du projet ; ce fichier en est la
traduction et fait foi pour le code.

## Principes

- **Mobile d'abord.** Les écrans fonctionnent dès **360 px** de large (règle
  de `CLAUDE.md`) ; les maquettes sont dessinées à 390 px. Sur grand écran, le
  contenu reste dans une colonne centrée de 480 px maximum (pages de
  l'application) ; seules les pages publiques peuvent s'élargir.
- **Périmètre V1** : badges, photo d'avatar (V1.1, décision D10) et
  notifications (V3) apparaissent dans les maquettes mais ne sont pas
  construits en V1. Les maquettes montrent aussi une activité « synchronisée
  depuis Garmin » : aucune synchronisation n'est prévue, c'est un exemple.
- **Répondre en une seconde à « où j'en suis cette semaine ? ».** Le chiffre
  de la semaine, l'objectif et le temps avant la clôture sont toujours visibles
  en premier.
- **Clair et sportif pour les chiffres, chaleureux pour le social** : gros
  chiffres, cartes nettes, une seule couleur d'accent ; avatars ronds et
  badges pour le côté « entre amis ».
- **Pas de décoration gratuite** : pas de dégradé de fond, pas de carte à
  bordure gauche colorée, pas d'emoji dans l'interface, pas d'ombre forte
  (sauf le bouton d'action flottant).

## Couleurs

À définir une seule fois comme variables CSS (ou tokens du thème Tailwind),
jamais en dur dans les composants.

| Token | Clair | Sombre | Usage |
|---|---|---|---|
| `--color-bg` | `#F5F4F0` | `#111316` | fond des pages |
| `--color-surface` | `#FFFFFF` | `#1C1E23` | cartes, lignes, barre de navigation |
| `--color-ink` | `#16181D` | `#ECEDEF` | texte principal, barres du classement |
| `--color-muted` | `#5B5F68` | `#A1A5AE` | texte secondaire, rangs, libellés |
| `--color-hero` | `#16181D` | `#262930` | fond des blocs sombres (bandeau de clôture, « Ta semaine ») |
| `--color-on-hero` | `#FFFFFF` | `#FFFFFF` | texte sur `--color-hero` |
| `--color-on-dark-muted` | `#C9CCD2` | `#C9CCD2` | texte secondaire sur `--color-hero` |
| `--color-border` | `#E2E0DA` | `#2E3138` | bordures de cartes et de lignes |
| `--color-border-dashed` | `#C9C6BE` | `#4A4E57` | bordure pointillée (éliminé, à venir) |
| `--color-track` | `#EDEBE6` | `#2E3138` | fond des barres de progression |
| `--color-track-on-dark` | `#33363D` | `#3A3E46` | fond des barres de progression sur `--color-hero` |
| `--color-segment` | `#EAE8E2` | `#24272D` | fond du sélecteur à onglets |
| `--color-accent` | `#C2410C` | `#FB923C` | couleur d'accent : bouton principal, onglet actif, ma ligne, liens d'action |
| `--color-on-accent` | `#FFFFFF` | `#16181D` | texte sur `--color-accent` |
| `--color-accent-soft` | `#FFF4EB` | `#2A1D14` | fond de « ma ligne » dans un classement |
| `--color-risk-bg` | `#FFEDD5` | `#3A2210` | fond du badge « À risque » |
| `--color-risk-fg` | `#9A3412` | `#FDBA74` | texte et icône du badge « À risque » |
| `--color-risk-bar` | `#FB923C` | `#FB923C` | barre de progression d'un participant à risque |
| `--color-risk-border` | `#FDBA74` | `#9A3412` | bord d'une carte à risque |
| `--color-ok-bg` | `#DCFCE7` | `#12301E` | fond du badge « Objectif atteint » |
| `--color-ok-fg` | `#166534` | `#86EFAC` | texte du badge « Objectif atteint », semaine réussie |
| `--color-ok-bar` | `#16A34A` | `#22C55E` | barre de progression complète |
| `--color-out-bg` | `#E5E7EB` | `#2E3138` | avatar d'un éliminé |
| `--color-out-fg` | `#4B5563` | `#A1A5AE` | initiales d'un éliminé |

Palette des avatars (fond / texte), attribuée de façon stable par utilisateur
(par exemple un hachage de son identifiant), jamais au hasard à chaque rendu.
Chaque couple est un token (`--color-avatar-N-bg` / `--color-avatar-N-fg`) ;
le thème sombre inverse fond et texte :

| N | Fond | Texte |
|---|---|---|
| 1 | `#DBEAFE` | `#1E3A8A` |
| 2 | `#EDE9FE` | `#4C1D95` |
| 3 | `#DCFCE7` | `#14532D` |
| 4 | `#FCE7F3` | `#831843` |
| 5 | `#FFEDD5` | `#7C2D12` |
| 6 | `#E0F2FE` | `#0C4A6E` |

Contrastes : tous les couples texte/fond dépassent 4,5:1 dans les deux thèmes
(vérifié par `src/styles/tokens.test.ts`). Toute nouvelle couleur de texte doit
aussi passer 4,5:1 (3:1 au-delà de 24 px).

L'accent est un seul token : changer de couleur de marque ne doit demander
qu'une modification.

**Thème sombre** : suit la préférence du système (`prefers-color-scheme:
dark`) en redéfinissant les mêmes tokens (`src/styles/tokens.css`) ; le choix
manuel viendra avec la coque de l'application (ticket SC-WEB-019). Aucun
composant ne teste le thème lui-même. 🟡 Valeurs sombres proposées au ticket
SC-WEB-003, sans maquette : à revoir quand le thème sera dessiné.

## Typographie

Polices **Space Grotesk** (titres et grands chiffres) et **Inter** (tout le
reste), **auto-hébergées** : servies par l'application, jamais chargées depuis
les serveurs de Google, qui recevraient l'adresse IP de l'utilisateur avant
tout consentement : paquets Fontsource (`@fontsource-variable/inter` et
`@fontsource-variable/space-grotesk`), empaquetés par Vite. Chiffres tabulaires (`font-variant-numeric: tabular-nums`)
dans les classements et les compteurs.

| Rôle | Police | Taille / graisse | Divers |
|---|---|---|---|
| Titre de page (h1) | Space Grotesk | 28–30 px / 700 | `letter-spacing: -0.5px` |
| Grand chiffre (carte) | Space Grotesk | 34 px / 700 | `letter-spacing: -1px` |
| Grand chiffre (bloc « Ta semaine ») | Space Grotesk | 48 px / 700 | `letter-spacing: -1.5px`, `line-height: 1` |
| Titre de carte ou de section (h2) | Space Grotesk | 17–18 px / 700 | |
| Texte courant | Inter | 14–15 px / 400–600 | |
| Méta, aide | Inter | 12–13 px / 400 | `--color-muted` |
| Libellé de section | Inter | 12–13 px / 600–700 | majuscules, `letter-spacing: 0.6px` |
| Barre de navigation | Inter | 11 px / 600 (700 si actif) | |

## Espacements, formes, ombres

- Échelle de 4 px. Marges latérales des pages : **20 px**. Espace entre
  cartes : 12–14 px. Rembourrage des cartes : 16–18 px.
- Rayons : badges et pastilles `999px` ; boutons d'onglet 10 px ; lignes de
  liste 12–14 px ; cartes 18–20 px ; boutons ronds 22 px (44 × 44).
- Ombres : aucune sur les cartes (bordure `--color-border` à la place) ;
  `0 1px 3px rgba(22,24,29,.12)` sur l'onglet actif ;
  `0 6px 16px rgba(22,24,29,.18)` sur le bouton d'action flottant seulement.
- Toute zone cliquable fait au moins **44 × 44 px**.

## Icônes

Icônes au trait, épaisseur 2, 20–22 px (14–16 px dans un badge), couleur
`currentColor`. 🟡 Bibliothèque proposée : **Lucide** (`lucide-react`) ; c'est
une nouvelle dépendance, à valider avant de l'installer, au premier ticket qui
affiche une icône (elle est réservée au web ; le mobile en V2 aura son
équivalent). Correspondances : défis `trophy`, activités `activity`,
badges `award`, profil `user`, notifications `bell`, à risque `triangle-alert`,
atteint `check`, retour `chevron-left`, suite `chevron-right`, inviter
`user-plus`, compte à rebours `timer`, ajouter `plus`.

Une icône décorative porte `aria-hidden="true"` ; un bouton qui n'a qu'une
icône porte un `aria-label`.

## Composants

### Statuts d'un participant
La couleur ne porte jamais seule l'information : chaque statut a aussi une
icône ou un libellé.

| Statut | Rendu |
|---|---|
| À risque (sous l'objectif à l'approche de la clôture) | badge `--color-risk-bg` / `--color-risk-fg` avec icône `triangle-alert` et le texte « À risque » ; carte entourée d'un bord 2 px `--color-risk-border` ; barre `--color-risk-bar` |
| Objectif atteint | badge `--color-ok-bg` / `--color-ok-fg` avec icône `check` et « Objectif atteint » ; barre `--color-ok-bar` |
| Éliminé | carte ou ligne en bordure pointillée `--color-border-dashed`, fond transparent, texte `--color-muted`, avatar gris, mention « Éliminé en semaine N » ; regroupés en fin de liste sous le libellé « Éliminés » |
| A abandonné (a quitté le défi, ou compte supprimé) | même rendu qu'« Éliminé », avec la mention « A abandonné » à la place de la semaine ; hors podium, dans la section « Éliminés » |

Tous les statuts viennent de l'API, y compris le seuil « à risque »
(`AT_RISK_THRESHOLD` côté backend) : le frontend ne les déduit jamais des
chiffres.

### Barre de progression
Piste `--color-track`, hauteur 10 px (cartes) ou 6 px (lignes de
classement), rayon égal à la moitié de la hauteur. Remplissage selon le
statut (accent, à risque, atteint, ou `--color-ink` pour les autres dans un
classement). Toujours accompagnée du chiffre en texte ; la barre seule a un
`role="img"` et un `aria-label` du type « 72 % de l'objectif de la semaine »,
ou `aria-hidden` si le chiffre est juste à côté.

### Carte de défi (accueil)
Lien vers la page du défi, fond `--color-surface`, rayon 18 px. Ordre : titre + badge de
statut → grand chiffre « 18 » suivi de « / 25 km cette semaine » → barre →
ligne méta (ce qui manque avant la clôture, ou les sports) et rang « 5e sur
8 » à droite.

### Bandeau de clôture
Fond `--color-hero`, texte `--color-on-hero`, rayon 14 px, icône `timer` : « Semaine 3 ·
clôture dans 2 j 14 h » puis « Dimanche 23 h 59, heure de Montréal ». L'heure
est toujours donnée dans **le fuseau du défi** (fourni par l'API), pas celui
de l'appareil ; la mention du fuseau (« heure de Montréal ») n'apparaît que
si le fuseau de l'utilisateur est différent.

### Bloc « Ta semaine » (page d'un défi)
Fond `--color-hero`, rayon 20 px : libellé en majuscules, badge de statut,
grand chiffre 48 px, barre (piste `--color-track-on-dark`), phrase explicite sur ce qui se
passe à la clôture.

### Ligne de classement
Rang (22 px de large, `--color-muted`), avatar, nom, valeur à droite, barre
de 6 px sous le nom (classement complet), badge « À risque » si besoin. Ma
ligne : contour 2 px `--color-accent` et fond `--color-accent-soft` ; mon nom
s'affiche « Toi ». Utiliser `<ol>` pour un classement, avec le rang écrit en
texte (pas la numérotation automatique de la liste) : les ex aequo ont le
même rang (1, 1, 3), tel que fourni par l'API. Le classement se met à jour au
rafraîchissement (retour dans l'app, tirer pour rafraîchir), pas en temps
réel.

### Avatar
Cercle de 32 px (lignes) avec initiales en 12 px / 700. En V1, initiales
seulement ; la photo arrive avec l'upload d'avatar (V1.1). Le nom est toujours affiché à côté : l'avatar est
`aria-hidden`.

### Tuiles de semaines
Grille de 4 colonnes égales, gap 8 px : « Sem. N », valeur, statut
(« Réussie » en vert, « En cours » en accent avec bord 2 px accent, « À
venir » en pointillés).

### Boutons
- Principal : fond `--color-accent`, texte `--color-on-accent` 15 px / 700, hauteur 52 px,
  rayon 26 px. Une seule action principale par écran (« Ajouter une
  activité » en bouton flottant en bas à droite sur l'accueil).
- Secondaire : fond `--color-surface`, bordure `--color-border`, hauteur 40–44 px.
- Icône seule : 44 × 44, rond.
- Toujours de vrais `<button>` ou `<a href>`, jamais un `div` cliquable.

### Sélecteur à onglets (« Semaine 3 » / « Général »)
Conteneur `--color-segment`, rayon 14 px, padding 4 px, deux colonnes égales.
Onglet actif : fond `--color-surface`, ombre légère, texte `--color-ink` ; inactif :
transparent, texte `--color-muted`. `aria-pressed` sur chaque bouton.

### Barre de navigation
En bas, 72 px, fond `--color-surface`, bordure haute : **Défis**, **Activités**,
**Profil** en V1 (**Badges** s'ajoute en V1.1, entre Activités et Profil),
icône au-dessus du libellé. Onglet actif en
`--color-accent` avec `aria-current="page"`. Dans un `<nav
aria-label="Navigation principale">`.

## Écrans de référence

1. **Accueil « Mes défis »** : salutation + titre (bouton notifications en
   V3) ; bandeau de clôture ; cartes de défi (à risque en premier, puis en
   cours, puis éliminés) ; dernière activité (« Course · 8,2 km », date,
   contribution « +8,2 km » en accent) ; bouton flottant ; barre de
   navigation.
2. **Page d'un défi** : retour, bouton « Inviter » ; titre et méta
   (participants, sports, « Semaine 3 sur 4 ») ; bloc « Ta semaine » ;
   classement de la semaine (top 5, ma ligne visible même si je suis plus bas,
   lien « Tout voir ») ; tuiles « Tes semaines ».
3. **Classement** : retour, titre et nom du défi ; sélecteur « Semaine N » /
   « Général » ; phrase de contexte (objectif, clôture et fuseau) ; liste
   classée ; section « Éliminés ».

À dessiner plus tard dans le même style : création d'un défi (assistant en 3
ou 4 étapes, lien d'invitation à partager), activités, profil, et en V1.1
les badges (obtenus en couleur, à obtenir en silhouette avec leur condition).

## États des écrans

Chaque écran gère quatre états en plus du contenu (`CLAUDE.md`). 🟡 Rendu
proposé, à affiner avec le premier écran qui les construit :

- **Chargement** : squelettes aux dimensions des cartes et des lignes (fond
  `--color-track`), sans texte factice ; pas d'animation si
  `prefers-reduced-motion`.
- **Erreur** : message traduit depuis le code d'erreur de l'API
  (`errors.<code>`, jamais le message brut du serveur) et bouton secondaire
  « Réessayer ».
- **Vide** : une phrase qui dit quoi faire et l'action principale de l'écran
  (par exemple « Créer un défi » sur l'accueil).
- **Connexion requise** : une phrase et le bouton principal « Se connecter ».

## Rédaction

- Français et anglais : chaque texte existe dans les deux langues, via
  i18next (aucune chaîne en dur). En français, tutoiement ; dans les deux
  langues, phrases courtes. Le texte dit ce qui va se passer (« Encore 7 km
  avant la clôture, sinon tu es éliminé »).
- Nombres et dates formatés selon la langue active, avec `Intl.NumberFormat`
  et `Intl.DateTimeFormat` (option `timeZone` du défi). En français :
  `8,2 km`, `23 h 59`, `5e sur 8`, `dimanche`, espace insécable avant les
  unités et `:` ; en anglais (`en-CA`) : `8.2 km`, `Sunday 11:59 p.m.`, `5th of 8`.
  🟡 Locales proposées : `fr-CA` et `en-CA`, à confirmer à la mise en place
  de l'i18n.
- Pas de texte factice dans le code livré : tout chiffre vient de l'API.

## Accessibilité (obligatoire)

- Contraste 4,5:1 pour tout texte, y compris les petits libellés gris.
- Statuts jamais portés par la couleur seule (icône ou texte).
- Éléments natifs : `<button>`, `<a href>`, `<input>` avec `<label>`,
  listes `<ol>`/`<ul>`, titres hiérarchisés.
- Cibles tactiles de 44 px minimum ; focus visible (contour 2 px
  `--color-accent`, décalé de 2 px).
- Respecter `prefers-reduced-motion` pour toute animation (célébration d'un
  badge, apparition d'une carte).
