# Carte de MJ

Décrivez une pièce au clavier ou à la voix, en français :

> « grande pièce de 4 m par 12, quatre piliers, deux coffres au fond de la salle, une statue devant une porte »

La carte s'affiche aussitôt sur une grille, vue du dessus, prête pour les figurines.
Le site est 100 % statique, sans IA et sans serveur. Il marche hors ligne au clavier.

> État : le Donjon gère plusieurs salles reliées par leurs portes (étape 2) ; la Présentation ouvre un donjon prêt, le montre à la table (étape 3) et permet de l'improviser en jouant (étape 4).

## Trois outils indépendants

Chaque outil est complet seul : il a ses propres données (dans le navigateur) et sa propre adresse, et il n'y a ni compte ni réseau. Aucun n'a besoin d'un autre pour marcher. Seule liaison, facultative : le Donjon peut proposer les personnages de l'outil Fiche enregistrés dans le même navigateur (lecture seule, voir « Fiches de personnage du donjon »). La page d'accueil `index.html` ne fait que les présenter.

| Outil | Adresse | Pour qui |
|---|---|---|
| Fiche (`fiche.html`) | <http://localhost:8765/fiche.html> | un joueur, sur son téléphone : jets, PV, sac, journal. Plusieurs personnages par navigateur (changer ou créer depuis le nom, en haut), suppression annulable quelques secondes, export et import en JSON. Le bonus de maîtrise suit le niveau tant qu'il n'a pas été saisi à la main |
| Donjon (`donjon.html`) | <http://localhost:8765/donjon.html> | le MJ, qui prépare ses salles et les relie (voir la section Donjon) |
| Présentation (`presentation.html`) | <http://localhost:8765/presentation.html> | le MJ à la table : ouvre un donjon déjà prêt, régie pour lui, carte en grand pour les joueurs (voir la section Présentation) |

## Navigation et feuille commune

Chaque page commence par le même en-tête, écrit en HTML statique (aucun script) : « Carte de MJ » (accueil), Fiche, Donjon, Présentation, la page courante portant `aria-current="page"`. Il vient de `css/base.css`, qui porte aussi les jetons partagés des pages sombres (couleurs, rayons, espacements, focus, `--cible` : 44 px sous 760 px, aucune exigence au-dessus). Il n'apparaît ni sur la vue table (`?vue=table`), ni à l'impression. La Fiche garde sa palette : elle ne réutilise de `base.css` que l'en-tête, recoloré avec ses variables.

## Sur téléphone (sous 760 px)

Au-dessus de 760 px, ni la mise en page ni la carte ne changent. En dessous, le **Donjon** et la **régie** de la Présentation affichent **une zone à la fois**, choisie par des onglets collants en haut (`js/telephone.js`, règles sous la media query de `css/style.css` et `css/presentation.css` ; sans script, tout reste empilé comme avant) :

- **Donjon** : « Texte » (le panneau : donjons, description, salles, réglages, fichiers) et « Carte ». On tape dans Texte, un geste sur « Carte » montre le résultat (le « Compris » sous la description donne déjà le retour en texte). « ↩ Annuler » est aussi dans la barre quand un déplacement peut être annulé.
- **Régie** : « Carte » (par défaut : le bandeau « À LA TABLE / CONSULTATION » et la carte de la salle) et « Actions » (table, commande rapide, cette salle, mini-carte, notes, réglages).
- **Sélection** : un bandeau fixé en bas de l'écran, dont la hauteur est **réservée sous la carte** (`--reserve-selection`, entre 150 et 260 px selon l'écran) : toucher une porte, un pion ou un objet montre ses actions sans défilement et sans que la carte bouge, et la carte n'est jamais recouverte. Le bandeau a un bouton « ✕ Fermer » ; vide, la zone dit quoi toucher. Téléphone couché (moins de 500 px de haut) : pas de bande réservée, le bandeau se pose par-dessus (60 % de la hauteur au plus).
- **Taille de la carte** : réduite **par la taille de case** (jamais par `transform`) pour que la salle entière tienne dans la zone, entre 16 px et le réglage. Le réglage enregistré (`reglages.taille`, `calibre`, `modeTable`) n'est jamais modifié ; dans le Donjon, tant que « Calibrer avec une carte bancaire » est coché, c'est la taille réglée qui s'applique. La géométrie du pointeur suit la même taille.
- **Toucher** : le glisser sur la carte déplace un pion (`touch-action: none`) tant que la carte tient dans sa zone. Si elle dépasse (grande salle à 16 px la case), la classe `defile` rend le défilement au doigt à la zone ; on peut toujours toucher un élément pour le sélectionner, mais plus glisser un pion (passe en paysage, ou réduis la salle).

## Lancer en local

Les modules JavaScript ne se chargent pas en ouvrant `donjon.html` d'un double-clic (protocole `file://`).
Il faut un petit serveur local. Celui du projet désactive le cache, pour voir tout de suite chaque modification :

```bash
python3 outils/serveur.py
```

Ouvrez ensuite <http://localhost:8765> (accueil). Les tests sont sur <http://localhost:8765/tests.html>,
ou en ligne de commande avec `node tests/node.mjs` (c'est aussi ce que lance GitHub Actions à chaque push et chaque pull request).

Au-delà des tests de comportement, `tests/references.js` garde l'empreinte du dessin des moteurs de rendu et de la disposition du plan du donjon,
pour prouver qu'une refactorisation ne les change pas. Après un changement voulu de l'un ou de l'autre, relire le diff puis lancer
`node tests/regenerer-references.mjs`.

## Ce que comprend le parseur

- **Dimensions** : « 4 m par 12 », « 6 cases sur 6 », « carrée de 9 m », « 7,5 m de large et 15 m de long »,
  « petite pièce », « couloir ». Échelle par défaut : 1 case = 1,5 m, arrondi à la case la plus proche.
- **Quantités** : en chiffres ou en lettres (« dix-sept », « une paire de », « des torches »).
- **Objets** : pilier, colonne, coffre, statue, table, chaise, autel, trône, tonneau, caisse, escalier, fosse, lit,
  bibliothèque, torche, débris, puits, fontaine, sarcophage, ainsi que les portes, herses et arches.
  Pour en ajouter un, ajoutez son entrée dans `js/catalogue.js` (mots, taille, nom, genre…), puis son dessin dans chacun des deux
  thèmes (`js/rendu/themes/vectoriel.js` et `papier.js`) : un test vérifie qu'aucun n'en manque.
- **Créatures** (pions numérotés) : les personnages / joueurs / aventuriers (bleu), les peuples et PNJ
  (or : humain, elfe, nain, halfelin, gnome, garde, mage, roi…) et les monstres (rouge : gobelin, orque, kobold,
  squelette, zombie, goule, ogre, troll, minotaure, géant, dragon…). La taille du pion suit la catégorie
  (un dragon fait 3 × 3 cases) et s'ajuste avec « jeune », « ancien » ou « géant ». La couleur (« un dragon rouge »)
  et le camp (« un nain hostile », « des elfes alliés ») sont reconnus. Seules des créatures génériques de fantasy
  sont listées, aucune propre à une gamme commerciale.
- **Positions** : au fond, à l'entrée, au centre, contre le mur nord/sud/est/ouest, à gauche/droite,
  au fond à gauche, dans les coins, dans le coin sud-est, de chaque côté, le long des murs, en cercle, en ligne,
  devant / derrière / à côté de / de chaque côté de / autour de / en face de X.
  « Devant la porte est » (ou « du mur est », « de l'ouest », « nord », « sud ») désigne la porte de ce mur, et « Compris »
  nomme le mur retenu. Sans porte sur ce mur, le repère est signalé (⚠) et pris sur la première porte ; sans aucune porte,
  la porte citée est créée sur ce mur. « est » nu ne compte comme un mur qu'en fin de proposition : « la porte est au nord »
  reste une phrase avec un verbe.
- **Cases exactes** : « un coffre en C4 », « deux tonneaux en A1 H1 », « un lit de A2 à B2 tourné vers l'est »,
  « une porte au mur sud en D », « une herse au mur est en 4 ». Les lettres et numéros sont affichés autour de la carte.
- **Éléments cachés** : l'adjectif caché / cachée / cachés / cachées / secret / secrète / secrets / secrètes rend un
  objet, une créature ou une porte secret : « un coffre caché », « deux gobelins cachés », « une porte secrète au mur nord ».
  Le plan reçoit `cache: true`. Dans le Donjon (vue MJ) ces éléments restent visibles, dessinés en translucide avec un
  contour en pointillés. Un élément caché n'est jamais regroupé avec un visible dans la description réécrite.
- **Conventions** : le nord est en haut. L'entrée est le mur de la première porte (sud par défaut).
  « Le fond » est le mur opposé à l'entrée.

Les mots non reconnus sont listés sous « Mots non compris » au lieu d'être devinés.
Pour les cas que le parseur ne sait pas traiter, le plan JSON se modifie à la main dans le panneau.

## Fiches de personnage du donjon

Dans le Donjon, l'outil « Personnages » associe des fiches au donjon : celles de l'outil Fiche de ce navigateur, ou le fichier exporté par un joueur (`js/personnages.js`). Le donjon en garde une copie résumée (identité, PV, CA, caractéristiques, attaques, sac ; ni journal ni jets), qui part avec lui à l'export. « Actualiser » recopie les fiches encore présentes dans ce navigateur. Il n'y a pas de synchronisation avec le téléphone d'un joueur : il réexporte, tu ajoutes le fichier.

En régie, le bloc « Personnages » montre les mêmes fiches, et « Poser dans cette salle » crée le pion du personnage. Les fiches ne partent jamais à la table.

**PV en jeu :** chaque fiche de la régie a un champ avec « Dégâts » et « Soins », aux mêmes règles que la Fiche : les PV temporaires partent d'abord, jamais sous 0 ni au-dessus du max. Ces PV sont gardés dans la partie, à part des fiches, qui sont recopiées du donjon à chaque ouverture. Ni le donjon préparé ni le téléphone du joueur ne sont modifiés ; « PV de la fiche » y revient. Un joueur sans fiche n'a pas de PV, et les PV ne partent jamais à la table.

**Au hasard :** « 🎲 Au hasard » tire une fiche complète (`js/fiche-hasard.js`, pur), sur le modèle du donjon au hasard : classe, race et niveau choisis ou tirés, numéro de tirage (le même numéro et les mêmes paramètres redonnent la même fiche), et un nouveau tirage remplace le précédent. Le bouton est à deux endroits. Dans le Donjon, outil « Personnages », on peut tirer plusieurs fiches d'un coup (les classes ne se répètent qu'une fois toutes tirées), le donjon en garde le résumé comme pour un fichier ajouté, et « Garder » fixe un tirage. Rien n'est écrit dans les fiches du navigateur. Dans la Fiche, depuis le nom en haut ou l'onglet Fiche, le personnage est enregistré dans ce navigateur, et le retoucher le garde. Il est alors proposé dans le Donjon comme les autres fiches.

**Jouer sans fiche :** quand une partie commence (« Présenter », « Recommencer »), la Présentation demande qui joue. Soit on coche des fiches du donjon, soit on indique un nombre de joueurs, puis le nom, la race et la classe de chacun (rien n'est obligatoire), soit on ne pose aucun pion. Les pions sont posés dans la première salle, numérotés P1, P2… dans l'ordre de saisie. Ces joueurs appartiennent à la partie et pas au donjon préparé, et aucune fiche n'est créée. En régie, ils sont dans le bloc « Personnages » et le pion sélectionné porte leur nom ; à la table, le pion reste « P1 », et ni le nom, ni la race, ni la classe n'y partent.

**Montrer une case aux joueurs :** en régie, un clic sur une case vide la met en surbrillance, ici et à la table ; un second clic ou Échap l'enlève, et elle s'efface quand un pion s'y pose. Glisser un pion le déplace, ceux des joueurs compris. À la souris, les mêmes gestes marchent sur l'écran de table (fenêtre table ou plein écran) : c'est la régie qui décide, et un doigt de joueur sur la carte ne déclenche rien.

## Formes de salle

Une salle reste un rectangle (largeur × longueur) auquel on retire des cases : croix, octogone, L, T, U, 8, E, F, H, O ou S (`js/formes.js`). Dans l'onglet Salle : un bouton par forme, l'épaisseur des bras, leur position, et le nombre de cases de sol. Le sol se choisit juste en dessous (pierre, bois, terre, sable, herbe, marbre, glace), et s'écrit « sol en bois ». Les mêmes réglages s'écrivent en texte : « Salle en croix de 12 par 13 cases, bras de 2 cases, bras en haut », « en U ouverte au sud », « en L angle au nord-ouest », « en T barre au nord », « octogonale, pans de 2 cases », « en O de 9 par 9 cases » (le O et le 8 ont une cour fermée, vide).

- Les cases retirées se recalculent toujours : agrandir une salle agrandit sa forme, et rien n'est stocké en plus.
- Une porte garde son écriture (mur + position) : elle se pose sur le premier mur rencontré de ce côté, au fond de l'entaille si le coin est retiré.
- Changer de forme pousse ce qui tomberait dans le vide vers la case libre la plus proche ; s'il n'y a plus de place, le changement est refusé.

## Nouveau donjon : vide, au hasard ou modèle

« + Nouveau donjon », dans le menu du donjon, laisse le choix : partir d'un donjon vide, au hasard, ou d'un modèle.

**Modèles** (`js/modeles.js`) : quelques départs fournis par l'outil (église en croix, petite crypte, cloître, repaire gobelin), et ceux que tu gardes toi-même avec « Garder le donjon affiché comme modèle » : une copie dans ce navigateur (`carte-de-mj:modeles-v1`), notes et éléments cachés compris. Partir d'un modèle crée un donjon neuf, le modèle ne change jamais. Les modèles gardés ne partent pas avec « Exporter », qui ne concerne que le donjon affiché.

**Au hasard** : nombre de salles, de monstres, de coffres, de pièges cachés, de portes secrètes, de chemins en plus, types de monstres, boss, formes de salles (`js/generateur.js`, pur).

- Chaque salle est décrite par un texte relu par le parseur : tout se retouche ensuite comme un donjon écrit à la main.
- Les nombres demandés sont tenus exactement : une salle trop petite est agrandie jusqu'à ce que tout y tienne.
- Les salles poussent sur une grille invisible et une liaison ne relie que deux voisines : le plan reste lisible, boucles comprises.
- L'entrée n'a ni monstre, ni coffre, ni piège ; le boss attend dans la salle la plus éloignée, et il compte dans le total des monstres.
- Une porte secrète ne coupe jamais le chemin vers le reste du donjon : elle ferme une boucle, sinon une salle au bout d'un chemin.
- Le numéro de tirage redonne le même donjon, à paramètres égaux. Un nouveau tirage remplace le précédent tant qu'il n'a pas été retouché.

## Donjon : plusieurs salles

Un **donjon** est un ensemble de salles, de liaisons entre leurs portes et d'un carnet de notes par salle.
Dans chaque salle, la description reste la seule référence (texte → plan → carte et JSON).

- **Salles** : liste dans le panneau (nom modifiable, salle affichée en évidence, « + Salle isolée », suppression
  en deux clics). Supprimer un donjon se fait aussi en deux clics : un message donne son nom et son nombre de salles, le bouton
  garde sa largeur, et « Présenter » est sur une autre ligne. Sa partie en cours reste dans la Présentation
  (« Autres parties en cours »). Supprimer une salle retire ses liaisons ; supprimer la dernière en recrée une vide.
- **Miniature du plan** : le plan complet, le même dessin, réduit pour tenir dans le panneau (`js/miniplan.js`). Il n'y a qu'une façon de dessiner un plan (`dessinerPlanDonjon`) : plan complet, miniature, encart de la table. Un clic, ou Tab puis Entrée, affiche la salle ; son nom s'affiche au survol.
- **Première utilisation** : tant qu'aucun donjon n'a plus d'une salle, les exemples sont dépliés au démarrage et le sous-titre
  dit « Décris une porte, puis clique dessus pour créer la salle suivante » ; il reprend son texte dès qu'une deuxième salle existe.
  Une salle sans porte l'indique dans la note de « Salles ».
- **Changer de salle** : le panneau revient en haut ; une salle qui vient d'être créée donne le focus à sa description
  (pas au doigt, ni quand le focus est sur la miniature).
- **Relier** : un clic (sans glisser) sur une porte la sélectionne. Non reliée, elle propose « Nouvelle salle derrière cette
  porte » (6 × 6 cases, porte de retour sur le mur opposé, écrite dans sa description) ou « Relier à une salle existante »
  (une porte est ajoutée sur le mur opposé de cette salle : même position si elle est libre, sinon la première libre).
  Reliée, elle propose « Aller à la salle… » et « Délier ». Une porte reliée porte une pastille bleue sur la carte.
  Au clic, la zone « Sélection » est amenée en vue (défilement doux, au plus court) et la porte est cerclée d'or avec un liseré sombre. Sous 760 px, pas de défilement : la sélection est un bandeau fixe sous la carte (voir « Sur téléphone »).
- **Liaisons et textes** : une liaison désigne une porte par salle + mur + position, jamais par son identifiant (les `p1`, `p2`…
  sont recalculés à chaque lecture du texte). Déplacer la porte au glisser fait suivre la liaison. Si vous retouchez le texte
  et que la porte disparaît, la liaison n'est pas supprimée : elle est signalée comme **orpheline**, avec un bouton pour la
  retirer ; rétablir la porte dans le texte la répare.
- **Caché / visible** : cliquez un élément (porte, objet ou pion) puis « Marquer comme caché » / « Rendre visible ».
- **Notes** : un bloc de notes par salle, enregistré, jamais réécrit par la description.
- **Annuler** : chaque salle a sa propre pile « Annuler le déplacement », gardée en mémoire le temps de la session
  (elle n'efface jamais un texte : elle ne remet qu'une description que la salle a eue). Annuler le déplacement d'une porte
  reliée ramène aussi sa liaison. La pile d'une salle est vidée quand vous retapez son texte.
- **Plusieurs donjons** : changer, créer, renommer, supprimer (deux clics). Tout est enregistré dans le navigateur :
  `carte-de-mj:donjons-v1` (les donjons) et `carte-de-mj:reglages-v1` (échelle, taille des cases, grille). L'ancienne clé
  `jdr-carte:v1` est migrée en un donjon d'une salle au premier lancement, et n'est jamais supprimée.
  Un donjon (ou un modèle) enregistré qui ne se relit pas, par exemple écrit par une version plus récente de l'outil, n'est jamais
  écrasé en silence : il est copié tel quel dans `carte-de-mj:mis-de-cote-v1` avant que le reste soit réécrit (une seule fois, même
  si la page est rechargée), et l'outil le dit. Si cette copie échoue (stockage plein), les donjons ne sont plus enregistrés de la session.
- **Exporter / importer** : « Exporter le donjon » écrit tout (salles, notes, liaisons, éléments cachés). « Importer un donjon »
  ajoute un donjon sans rien écraser (il garde l'identifiant de son fichier, sauf si un de vos donjons l'a déjà : importer deux fois le même fichier donne deux donjons) ; il accepte le format ci-dessous, l'ancien format `jdr-carte` (une salle) et un plan seul,
  et refuse proprement un fichier invalide ou d'une version plus récente. Rien de ce qui vient d'un fichier n'est interprété
  comme du HTML.

### Format du fichier (version 1)

```json
{
  "format": "carte-de-mj-donjon", "version": 1,
  "id": "donjon-ab12cd", "nom": "La crypte", "salleActive": "s-x1y2z3",
  "salles": {
    "s-x1y2z3": { "id": "s-x1y2z3", "nom": "Entrée", "texte": "Salle de 6 par 6 cases, …", "plan": { "…": "voir js/schema.js" }, "notes": "" }
  },
  "liaisons": [
    { "id": "l-q9w8e7", "a": { "salle": "s-x1y2z3", "mur": "est", "position": 2 }, "b": { "salle": "s-k4j5h6", "mur": "ouest", "position": 2 } }
  ]
}
```

Les identifiants de salles et de liaisons sont stables et uniques. Les éléments secrets sont marqués `cache: true` dans les
plans. Ces précautions préparent un éventuel jeu en ligne, qui n'est pas construit.

## Présentation : montrer le donjon à la table

Usage typique : un écran posé sur la table avec des figurines, joueurs sur fiches papier, aucune connexion. La Présentation ne dépend
ni de la Fiche ni d'un réseau, et n'exige de décrire quoi que ce soit : elle ouvre un donjon déjà préparé.

- **Ouvrir** : l'écran de départ liste les donjons enregistrés dans ce navigateur, ou accepte un fichier exporté (validé comme à l'import
  du Donjon, mais **non ajouté** à sa bibliothèque). Si une partie est en cours pour ce donjon : « Reprendre », ou « Recommencer »
  (confirmation en deux clics). Un fichier de donjon garde son identifiant, ce qui permet de retrouver sa partie.
  - *Commencer par* : un choix de salle au lancement (et pour « Recommencer »). Présélection : la **première salle du donjon**, pas
    la dernière modifiée dans le Donjon (le modèle ne marque pas de salle « entrée »). Elle devient la salle à la table et la première découverte.
  - *Reprise* : la régie mémorise la partie ouverte (`carte-de-mj:partie-ouverte-v1`, seulement l'identifiant du donjon). Un rechargement
    la rouvre telle quelle, sans rien écrire ni relancer ; « ← Liste des donjons » ramène à l'écran de départ et l'oublie. Le bouton « Présenter » du Donjon ouvre toujours le donjon affiché : sa partie en cours s'il en a une, sinon une nouvelle.
- **Une copie, jamais l'original** : démarrer copie le donjon. Tout ce qui se passe en jeu (pions déplacés, éléments révélés, salles
  découvertes, salle courante) est enregistré dans `carte-de-mj:presentations-v1`, séparément. Le donjon préparé n'est jamais modifié et
  aucun texte n'est réécrit : un pion déplacé ne change que son x et son y. Une salle retrouve donc son état quand on y revient.
- **Régie (vue MJ)** : la carte complète de la salle consultée, éléments cachés visibles (translucides, en pointillés), notes en lecture
  seule, miniature du plan : salles non découvertes assombries, salle à la table en vert, salle regardée en doré.
  - *Pions* : se déplacent à la souris ou au doigt. Objets et portes ne bougent pas (option `deplacables` de `deplacement.js` ; le
    Donjon ne l'utilise pas et garde son comportement).
  - *Porte et pion voisins* (option `portesLarges`, régie seule) : la zone de clic d'une porte s'étend d'une demi-case vers l'intérieur
    de la salle. Règle unique dans cette bande : un **clic** est toujours pour la porte, même si un pion s'y trouve ; un **glissement**
    commencé sur le pion déplace le pion. Le reste de la case du pion répond au pion. Le Donjon n'active pas l'option.
  - *Sélection* : un panneau superposé en bas à droite de la fenêtre (jamais dans le flux de la colonne : il reste visible quelle que soit
    sa position de défilement et ne décale pas la commande rapide). « ✕ Fermer » ou Échap le ferme (Échap sert déjà à quitter le plein
    écran et dans un champ de saisie : il ne désélectionne pas alors). Les éléments se choisissent aussi au clavier dans le bloc
    « Cette salle » : « Portes de la salle » et « Éléments de la salle » (pions, objets, éléments cachés repérés ; repliable), qui
    portent `aria-pressed` ; le focus passe au panneau, et revient à la liste quand on ferme.
  - *Retour d'action* : le bandeau « À LA TABLE / CONSULTATION » a une **hauteur fixe** ; les messages (passage de porte, révélation,
    état d'un pion…) s'affichent dans un toast transitoire posé sur la carte, annoncé aux lecteurs d'écran (`aria-live`), qu'un clic ferme.
    L'alerte « impossible d'enregistrer » reste, elle, affichée en haut de la régie.
  - *Portes* : un clic sur une porte reliée propose « Passer dans la salle X » ; la salle devient courante et découverte. « Le groupe suit »
    (coché par défaut) emmène les pions de camp `pj` de la salle, placés au plus près de la porte d'arrivée, sans superposition ni sortie de
    la pièce (dans une salle pleine, un pion monte sur un objet, jamais sur un autre pion ; sans aucune place il reste en arrière, avec un message).
    Une porte non reliée propose de créer la salle d'à côté (voir Improvisation). Les portes sont aussi listées dans le panneau, au clavier.
  - *Révéler* : un clic sur un élément caché propose « Révéler » / « Recacher » ; « Révéler toute la salle » révèle tout.
  - *Table ou consultation* : cliquer une salle de la miniature la **consulte** sans la montrer ni la marquer découverte. Un bandeau
    permanent dit si la salle regardée est « À LA TABLE » (vert) ou en « CONSULTATION » (jaune, cadre en pointillés) et rappelle laquelle
    est à la table ; « Afficher à la table » la rend courante et découverte.
  - *Monstres et objets à la table* : pour jouer sur une carte projetée sur une vraie table. Sous le bandeau, deux boutons montrent ou masquent, séparément et à tout moment, les monstres et les objets de la salle regardée : le MJ les montre pour poser ses vrais pions et coffres aux bons endroits, puis les masque. « Monstres » veut dire tous les pions qui ne sont pas des joueurs (PNJ compris) ; les pions des joueurs et les portes restent. Une salle s'affiche d'abord entière. Le choix est gardé **par salle** et enregistré avec la partie, comme les positions : en revenant dans une salle, on la retrouve telle qu'on l'a laissée. Sur une salle en consultation, le choix s'appliquera quand elle sera à la table. Seule la table est concernée (carte et mini-carte) : la régie montre toujours tout.
- **Vue table** : uniquement la carte, sans interface. Deux façons :
  - « Ouvrir la fenêtre table » (`presentation.html?vue=table`) : à glisser sur l'écran de la table ; un bouton « Plein écran » discret
    apparaît quelques secondes après un mouvement de **souris** (inactif sinon : `pointer-events: none`, et un toucher ne le réveille pas). Synchronisée par BroadcastChannel (canal `carte-de-mj-presentation`, même navigateur). Ouverte seule ou rechargée, elle
    demande l'état à la régie, et affiche un message d'attente si aucune régie ne répond.
  - *Plusieurs régies ouvertes* : une seule commande la table, la dernière qui a ouvert une partie (`js/commande-table.js`). Les autres passent **en retrait** : elles ne diffusent plus, ne répondent plus à la table, ignorent ses gestes, le disent en permanence (bandeau et panneau) et proposent « Reprendre la main », qui renvoie aussitôt leur état. Une régie sans la main ne vide jamais la table. Recharger la régie active lui rend la main ; recharger une régie en retrait la laisse en retrait. Si la régie active est fermée, rien n'est repris tout seul : la table attend qu'on clique sur « Reprendre la main ». Chaque régie n'enregistre que sa partie, et une régie en retrait n'écrase pas une version plus récente de la même partie.
  - « Plein écran ici » : pour un seul écran ; Échap pour revenir, ou « Retour à la régie », qui demande **deux appuis**
    (le premier arme le bouton, le second confirme dans les 4 secondes).
  - *Taille de la carte* (choix de la régie, mémorisé dans les réglages, `modeTable`) :
    **« Remplir l'écran »** calcule la case pour que la salle et sa marge de roche occupent la fenêtre table (entière, entre 16 et 300 px ;
    recalculée au redimensionnement, au changement de salle et de mode ; repères agrandis avec la case) ;
    **« Échelle réelle (figurines) »** garde exactement la taille calibrée, sans aucune adaptation (une salle trop grande défile).
    Sans choix explicite, le défaut est l'échelle réelle si la taille a été calibrée (indicateur `calibre` posé par le Donjon quand
    on règle la taille avec la case « Calibrer avec une carte bancaire », ou à défaut une taille différente de 48 px), sinon « Remplir ».
    Le mode est un simple mot joint aux réglages d'affichage envoyés à la table : il ne passe pas par `vueTable()` et ne contient aucun secret.
- **Sécurité** : ce que reçoit la table est le résultat de `vueTable()` (`js/vue-publique.js`), construit par liste blanche : salle courante
  uniquement, sans notes, sans nom ni description, sans notes (ni de préparation, ni de partie), sans élément caché non révélé (portes comprises), sans élément masqué, sans `cache`,
  sans liaisons ni autres salles. Seul ajout propre au jeu : l'état blessé / mort des pions. Les secrets ne quittent donc jamais la régie, ils ne sont pas seulement masqués à l'affichage. La fenêtre table ne lit jamais les
  présentations du localStorage (elle ne lit que les réglages d'affichage) et relit ce qu'elle reçoit (`recevoirVueTable`).
- **Improvisation** : le MJ fait évoluer le donjon pendant la partie, toujours dans la copie (le donjon préparé n'est jamais modifié).
  - *Créer une salle en franchissant une porte non reliée* : un clic sur la porte propose un champ « Décrire la nouvelle salle »
    (même langage que dans le Donjon, nom facultatif). Vide : salle de 6 × 6 cases. La salle est créée, reliée à cette porte, et le
    groupe y passe (« Le groupe suit » comme pour un passage normal). Une porte de retour est ajoutée sur le mur opposé si la
    description n'en place pas (une porte secrète du texte n'est jamais prise pour porte de retour). Les mots non compris sont
    signalés. Les liaisons et les portes des autres salles ne bougent pas.
  - *Commande rapide* (champ de la régie, clavier ou dictée 🎙️ puis « Exécuter ») : elle s'applique à la salle regardée.
    Syntaxes reconnues (accents, majuscules et nombres en lettres acceptés) :
    - ajouter (aussi : rajoute, place, pose, mets, crée) : « ajoute trois gobelins », « ajoute un coffre en C4 »,
      « ajoute un gobelin caché », « ajoute deux gobelins à gauche », « ajoute un gobelin devant la porte », « ajoute un tonneau et deux torches » ;
      toutes les positions du parseur sont permises (au fond, au centre, devant / à côté de X, en cercle…) ;
    - supprimer (aussi : enlève, retire, efface) : « supprime le coffre », « supprime le gobelin 2 », « supprime le coffre en C4 »,
      « supprime le gobelin caché », « supprime tous les gobelins » (le pluriel vaut « tous ») ;
    - déplacer (aussi : bouge, décale) : « déplace la statue à gauche », « déplace le gobelin 2 en C4 », « déplace le gobelin 1 devant la statue »,
      « déplace le coffre de C4 à D5 ».
    Un pion se désigne par son numéro (« gobelin 2 ») ; un objet par son rang de lecture (de haut en bas, puis de gauche à droite : « coffre 2 »)
    ou par sa case. Une commande ambiguë (deux coffres pour « supprime le coffre ») ou incompréhensible **ne change rien** : un message
    en français, affiché sous le champ, dit quoi préciser. Les portes ne se gèrent pas par commande. Le placement suit les règles
    habituelles : dans la pièce, jamais sur un autre pion ni sur un objet bloquant (un pion peut monter sur un objet), cases devant les
    portes évitées ; une case exacte déjà occupée ou hors de la salle est refusée. Un élément ajouté « caché » reste invisible à la
    table jusqu'à sa révélation ; supprimer un élément retire aussi sa révélation.
  - *Notes de partie* : bloc « Notes de la salle », un champ par salle, enregistré avec la partie, **jamais envoyé à la table**. Les notes
    de préparation de la salle restent affichées au-dessus, en lecture seule, et ne sont jamais écrasées.
  - *État des pions* : cliquer un pion ouvre son panneau : « Normal », « Blessé », « Mort ». Un pion blessé porte un **anneau en tirets** (clair sur fond sombre) et
    une grosse pastille blanche à croix rouge, proportionnels au pion (boutons Normal / Blessé / Mort : inactifs en contour, actif plein et
    coché, `aria-pressed`) ; un pion mort est grisé et barré d'une grande croix : lisible aussi en noir et blanc. L'état est une information de jeu :
    la table le voit (sauf pour un pion caché non révélé). Il suit le pion quand le groupe change de salle.
  - *Cohérence* : en partie, c'est le **plan** de la salle qui fait référence. Une commande ou un état le modifient directement, sans
    relire de texte : les identifiants (pions, objets, portes), les numéros, les états et les liaisons (salle + mur + position) restent
    intacts. Le `texte` des salles de la copie est la description de préparation, figée au démarrage et non utilisée en partie (déplacer un
    pion ne le réécrit pas non plus) ; seule une salle créée en jeu reçoit un texte, écrit par `decrire(plan)`.
- **Réglages** (`carte-de-mj:reglages-v1`, partagés avec le Donjon ; clés facultatives `reperes`, `calibre`, `modeTable`) : taille d'une case
  (le calibrage à la carte bancaire se fait dans le Donjon), grille, repères, mode de taille de la table. « Adapter la carte de la régie à la fenêtre » ne change que la régie.
- **Carte plus grande que l'écran de la table** : la table défile à la molette ou au doigt, et la régie propose des flèches
  (« Faire défiler la vue table ») ; on peut aussi réduire la taille d'une case.

### Format de la partie (version 1)

```json
{ "format": "carte-de-mj-presentation", "version": 1,
  "donjon": { "…": "copie du donjon, même format que ci-dessus" },
  "salleCourante": "s-x1y2z3", "decouvertes": ["s-x1y2z3"], "reveles": { "s-x1y2z3": ["o1", "p1"] },
  "notesPartie": { "s-x1y2z3": "Les joueurs ont forcé la serrure." },
  "masques": { "s-x1y2z3": ["monstres", "objets"] },
  "joueurs": [{ "id": "joueur-1", "nom": "Mira", "race": "Elfe", "classe": "Barde" }],
  "pvEnJeu": { "pj-a1b2c3": { "pv": 13, "pvTemp": 0 } } }
```

Rangé dans `carte-de-mj:presentations-v1` sous la forme `{ "presentations": { "<idDonjon>": <partie> } }`. Les identifiants d'éléments
(`o1`, `c1`, `p1`) y sont stables, car rien ne relit le texte.

Étape 4 : le format reste en version 1, avec deux ajouts facultatifs. `notesPartie` (texte par salle) et `etat` sur une créature du plan
(`"blesse"` ou `"mort"`, absent = normal). Une partie enregistrée avant l'étape 4 se charge donc telle quelle ; à l'import, `notesPartie` est
nettoyé (salles inconnues, valeurs qui ne sont pas du texte, longueur bornée) et un `etat` inconnu est écarté, sans refuser la partie.

`masques` est un autre ajout facultatif : absent, tout est visible. Une salle inconnue ou une catégorie autre que `monstres` et `objets` est écartée à la relecture.

`joueurs` aussi : absent, la partie n'a aucun joueur sans fiche. Leurs pions portent leur identifiant dans le champ `fiche`, comme ceux des fiches du donjon.

`pvEnJeu` aussi : absent, chaque personnage a les PV de sa fiche. Un personnage inconnu du donjon ou une valeur négative est écarté à la relecture.

## Imprimer un donjon

L'impression ne s'ouvre que depuis un donjon : le bouton **Imprimer ce donjon**, dans le menu du donjon, ouvre `impression.html` (<http://localhost:8765/impression.html>) sur le donjon actif ; un sélecteur permet d'en prendre un autre. Pour jouer sur papier avec de vraies figurines, sans l'application. Ce n'est pas un quatrième outil : la page lit les donjons du navigateur (`carte-de-mj:donjons-v1`) **sans jamais rien écrire**, ni dans cette clé ni ailleurs.

- **Réglages** : salles à imprimer (toutes cochées par défaut), version MJ ou joueurs, pions inclus ou non, échelle. L'aperçu à l'écran reproduit les pages A4 (marge de 10 mm, `@page { size: A4; margin: 10mm }`) ; « Imprimer » appelle `window.print()`.
- **Version joueurs** (par défaut) : mêmes règles de secret que la table, par liste blanche de champs (`planPublic()` de `js/vue-publique.js`, aussi utilisée par `vueTable()`). Ni élément caché, ni porte secrète, ni notes, ni liaisons, ni nom de salle, ni nom de donjon, ni état blessé / mort. Les pions de **monstres et de PNJ sont exclus par défaut** (un plan imprimé d'avance ne doit pas les dévoiler) ; une case à cocher les inclut. Les pions de personnages restent. Les salles sont désignées par « Plan N » (rang dans le donjon).
- **Version MJ** : tout, secrets compris (contour en pointillés et pastille « S »), portes reliées marquées « → N », et une **feuille du MJ** en tête (noms, liaisons porte → salle, liste des secrets, notes de préparation). Chaque page porte « VERSION MJ · SECRÈTE ».
- **Échelle** : 25 mm par case par défaut, exacte sur papier (tailles CSS en millimètres). « Tenir sur une page » réduit l'échelle (au dixième de mm, 25 mm au plus) et l'écrit en en-tête de chaque page, avec la mention que les figurines ne tiendront plus forcément.
- **Salle qui dépasse de peu** : à l'échelle réelle, une salle qui prendrait plusieurs pages mais tiendrait sur une seule avec au moins 80 % de l'échelle (par exemple 8 × 8 cases : 2 pages à 25 mm, 1 page à 21,2 mm) est signalée sous le choix de l'échelle : « Cette salle dépasse de 2 cases : 2 pages à 25 mm », avec le détail (échelle qui suffit, rappel pour les figurines) et un bouton « Tenir sur une page ». **Rien ne change sans ce clic** : le défaut reste l'échelle réelle, et le calcul n'est pas modifié (`proposerReduction()` de `js/impression.js`, pur, ne fait que lire ; le résultat de `preparerImpression()` porte la liste `propositions`, sans nom ni note). Le message ne cite que « Plan N » et des nombres. Au-delà de 20 % de réduction : pas de proposition, les figurines n'y tiendraient plus.
- **Barre collante** : le nombre de pages (et la progression de la préparation) et le bouton « Imprimer » sont dans une barre fixée en bas de l'écran (`position: sticky`, placée après l'aperçu : elle ne recouvre jamais la fin de page). Quand une proposition de réduction existe, un lien de la barre y renvoie. La barre est masquée à l'impression (aucune page ajoutée).
- **Grande salle** : découpée par **cases entières** sur des pages A4, portrait ou paysage selon ce qui donne le moins de pages (choix par salle). Deux pages voisines **partagent une rangée de cases** : une imprimante ne couvre pas le bord du papier, donc sans cela il resterait une bande blanche entre les pages. On découpe la marge de la page de droite (ou du bas) le long du trait pointillé et on pose sa première rangée sur la dernière de la page voisine. Chaque page indique « page 2/6 », sa colonne et sa ligne dans l'assemblage, ses pages voisines, et ses repères A1… pour la partie imprimée.
- **Contrôle** : chaque page porte une règle de 5 cm et le rappel « imprimez à 100 %, sans Ajuster à la page » (rappelé aussi à l'écran avant d'imprimer).
- **Rendu** : fond blanc, noir et blanc, sobre en encre (thème `js/rendu/themes/papier.js` : fosse hachurée, pas d'aplat sombre). Chaque page est dessinée sur un canvas d'environ 254 ppp puis exportée en image PNG de taille CSS en mm ; repères, titres et règle sont du texte et du SVG. Les noms et notes ne sont insérés qu'avec `textContent`.
- **Limites** : un objet ou un pion qui chevauche une limite de page est coupé avec ses cases (la case, elle, ne l'est jamais) ; l'orientation par page (`@page paysage`) demande un navigateur récent (Chrome, Edge ; non vérifié dans Firefox ni Safari).

## Arborescence

```
index.html          accueil (présente les trois outils)
donjon.html         outil Donjon (vue MJ)
impression.html     impression des plans d'un donjon (A4, version MJ ou joueurs)
presentation.html   outil Présentation (régie, ou vue table avec ?vue=table)
fiche.html          outil Fiche (palette et polices propres, en ligne ; seul l'en-tête vient de css/base.css)
tests.html          tous les tests dans le navigateur (la même liste que node tests/node.mjs)
.github/workflows/tests.yml  lance node tests/node.mjs à chaque push et chaque pull request
css/base.css        socle commun : jetons (couleurs du thème sombre, rayons, espacements, focus, taille de cible tactile) et en-tête de navigation
css/style.css       styles communs au Donjon, à la Présentation et à l'Impression : panneau, champs, boutons, scène, onglets du téléphone, fiches de personnage
css/donjon.css      mise en page du Donjon : barre, rail d'outils, panneau, bande des salles, bulle d'actions, zoom
css/presentation.css  écran de départ, régie et vue table
css/impression.css  pages A4 et réglages de l'impression (mesures reprises de js/impression.js par des variables CSS ; `@page` écrit en dur, comparé par un test)
js/dom.js           outils DOM communs aux pages : `$`, `h`, bouton, confirmation en deux temps, choix d'un fichier à importer
js/format.js        pluriel, virgule française, sans accents, objet JSON, libellés communs « Fermer » et micro (pur, sans DOM)
js/main-mj.js       branchement de l'interface du Donjon (donjons, salles, sélection)
js/historique.js     historique d'annulation du Donjon : une pile par salle (pur, sans DOM)
js/mise-en-page.js  calculs de mise en page du Donjon : position de la bulle, pas de zoom, taille du plan complet (pur, sans DOM)
js/palette.js       palette du Donjon : vignettes de portes, de mobilier et de créatures, pose au clic ou au glisser
js/vignettes.js     une vignette (petit canvas) par élément de la palette, dessinée avec le thème vectoriel
js/rail.js          rail d'outils du Donjon et panneau contextuel
js/pose.js          règle unique de « où poser un élément » (et élément qui gêne), chevauchement : ajouter, retirer, redimensionner, changer de forme (pur, sans DOM)
js/plan-donjon.js   plan du donjon : salles posées à leur vraie taille, reliées par des couloirs (pur, sans DOM)
js/rapport.js       rapport texte à copier pour signaler une erreur de lecture
js/affichage.js     réglages d'affichage : taille par défaut et bornes, échelle par défaut, taille de la carte à la table (modes « remplir » / « échelle réelle »), validation de ce que reçoit la table, case qui tient un plan, limites de canvas (pur, sans DOM)
js/presentation.js  façade : réexporte partie.js, passage.js et vue-publique.js (point d'entrée des écrans et des tests)
js/partie.js        partie en cours : création, validation, révélations, masquage, case montrée, résumé d'une partie, états des pions, notes, PV, improvisation (pur, sans DOM)
js/passage.js       passage d'une porte (le groupe suit), salle créée derrière une porte, pose des pions (pur, sans DOM)
js/vue-publique.js  ce que voit la table : règle de visibilité (`visibleATable`), `vueTable()`, `planPublic()`, encart du plan et leur relecture côté table (pur, sans parseur)
js/main-presentation.js  régie et vue table (DOM, stockage, BroadcastChannel)
js/commande-table.js  quelle régie commande la table quand plusieurs sont ouvertes (pur, sans DOM)
js/impression.js    découpage en pages A4, mesures de la feuille (aussi données au CSS), échelle, proposition de réduction et phrases de la page (pages voisines, proposition, feuille du MJ), versions MJ / joueurs (pur, sans DOM)
js/main-impression.js  page d'impression (DOM, aperçu, règle de contrôle, proposition de réduction, barre collante)
js/telephone.js     sous 760 px : onglets Texte / Carte et Actions / Carte, taille de case qui tient dans la zone, défilement au doigt d'une grande carte
js/donjon.js        modèle du donjon : salles, liaisons, orphelines, validation, MJ débutant (pur, sans DOM)
js/miniplan.js      miniature cliquable du plan (sidebar, régie) : même dessin que le plan complet
js/murs.js          les quatre murs : opposés, regards, vecteurs, longueur d'un mur, portes du mur d'entrée d'abord (pur, sans dépendance)
js/schema.js        schéma du plan d'une salle et validation, taille maximale d'une salle
js/modeles.js       modèles de donjon de l'outil, copie d'un donjon (pur, sans DOM)
js/generateur.js    donjon au hasard : paramètres et numéro de tirage → un donjon complet (pur, sans DOM)
js/fiche-hasard.js  fiche au hasard : paramètres et numéro de tirage → des fiches complètes au format de l'outil Fiche (pur, sans DOM)
js/alea.js          tirages reproductibles, communs aux deux générateurs (pur, sans DOM)
js/personnages.js   fiches associées au donjon : résumé, ajout, validation (pur, sans DOM)
js/fiche/           ce que la Fiche et le Donjon ont en commun, sans dépendance : `format.js` (clé du navigateur, format du fichier exporté, `estFiche`), `regles.js` (les six caractéristiques) ; `fiche.html` en garde une copie, comparée par un test
js/carte-personnage.js  une fiche à l'écran, la même dans le Donjon et la régie
js/formes.js        formes de salle : table des formes (libellés, mots, positions, pans de l'octogone), cases retirées, portes en retrait, murs découpés (calcul pur)
js/stockage.js      localStorage (donjons, réglages, migration de l'ancien format, mise de côté de ce qui ne se relit pas), export/import JSON
js/voix.js          dictée (Web Speech API)
js/deplacement.js   glisser-déposer et clic sur la carte
js/catalogue.js     les types d'objets, de créatures et d'ouvertures : mots, taille, nom, genre, couche de dessin (données pures : on y ajoute un objet)
js/coordonnees.js   coordonnées de cases façon échecs (A1…), repère d'une porte sur son mur, libellé d'une sélection (pur, sans DOM)
js/parseur/         index (chaîne d'analyse), normalisation, nombres, lexique (vocabulaire et index des mots), dimensions, positions, placement,
                    decrire (plan → texte), commandes (« ajoute trois gobelins » en cours de partie : pur, sans DOM)
js/rendu/           moteur Canvas, géométrie (marge, épaisseur des murs, rectangle d'un élément, ancrage d'une porte : pur), trace.js (tracé Canvas du sol et des murs découpés), portraits de monstres, thème vectoriel et thème papier (impression) avec leurs primitives communes (themes/commun.js)
tests/              un fichier de test par module (*.test.js), tous.js (la liste unique des suites, lue par node.mjs et tests.html),
                    mini-test.js (assertions et harnais communs), phrases.js (phrases du parseur), references.js (empreintes de rendu
                    et de disposition, générées par regenerer-references.mjs)
assets/polices/     polices embarquées de la Fiche (licences OFL)
outils/serveur.py   serveur local sans cache
```

## Pendant la partie

- **Sélectionner** : un simple clic (sans glisser) sur un pion, un objet ou une porte le sélectionne ; le panneau propose
  alors de le cacher et, pour une porte, de la relier à une autre salle.
- **Déplacer un élément** : attrapez un pion, un objet ou une porte à la souris ou au doigt, il se cale sur la grille
  au lâcher. Il revient à sa place s'il finit hors de la pièce ou sur un élément qui le gêne. Un pion peut monter sur
  un objet. Une porte glisse le long des murs et peut changer de mur.
- **Tout reste synchronisé** : la description est le seul point de vérité. Un déplacement la réécrit avec des positions
  exactes (« deux coffres en A1 C1 », « une porte au mur sud en D »), ce qui remplace vos tournures d'origine ;
  « ↩ Annuler le déplacement » les rétablit (pile propre à chaque salle). Modifier le JSON de la salle réécrit aussi sa description.
- **Signaler un résultat bizarre** : « 📋 Copier pour signaler une erreur de lecture » copie la description, ce qui a été compris,
  les mots ignorés et la carte en caractères, pour la salle affichée.

## Bon à savoir

- **Dictée vocale** : disponible dans Chrome, Edge et Safari, pas dans Firefox. Dans Chrome et Edge,
  la reconnaissance passe par les serveurs de Google : elle demande une connexion et votre voix quitte la machine.
- **Calibrage** : cochez « Calibrer avec une carte bancaire », posez une carte sur l'écran et ajustez la taille
  des cases jusqu'à ce que le rectangle corresponde. Une case fait alors 2,5 cm.

## Licence

MIT. Voir `LICENSE`.

Les polices de la Fiche (Atkinson Hyperlegible, Grenze Gotisch) sont embarquées dans `assets/polices/`, sous licence SIL Open Font License : voir les fichiers `OFL-*.txt` du même dossier.

Outil non officiel, sans lien avec un éditeur de jeu.
