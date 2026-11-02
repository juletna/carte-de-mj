# Carte de MJ

Décrivez une pièce au clavier ou à la voix, en français :

> « grande pièce de 4 m par 12, quatre piliers, deux coffres au fond de la salle, une statue devant une porte »

La carte s'affiche aussitôt sur une grille, vue du dessus, prête pour les figurines.
Le site est 100 % statique, sans IA et sans serveur. Il marche hors ligne au clavier.

> État : le Donjon gère plusieurs salles reliées par leurs portes (étape 2) ; la Présentation ouvre un donjon prêt, le montre à la table (étape 3) et permet de l'improviser en jouant (étape 4).

## Trois outils indépendants

Chaque outil est complet seul : il a ses propres données (dans le navigateur) et sa propre adresse. Aucun ne dépend d'un autre, il n'y a ni compte ni réseau. La page d'accueil `index.html` ne fait que les présenter.

| Outil | Adresse | Pour qui |
|---|---|---|
| Fiche (`fiche.html`) | <http://localhost:8765/fiche.html> | un joueur, sur son téléphone : jets, PV, sac, journal. Plusieurs personnages par navigateur (changer ou créer depuis le nom, en haut), suppression annulable quelques secondes, export et import en JSON. Le bonus de maîtrise suit le niveau tant qu'il n'a pas été saisi à la main |
| Donjon (`donjon.html`) | <http://localhost:8765/donjon.html> | le MJ, qui prépare ses salles et les relie (voir la section Donjon) |
| Présentation (`presentation.html`) | <http://localhost:8765/presentation.html> | le MJ à la table : ouvre un donjon déjà prêt, régie pour lui, carte en grand pour les joueurs (voir la section Présentation) |

## Navigation et feuille commune

Chaque page commence par le même en-tête, écrit en HTML statique (aucun script) : « Carte de MJ » (accueil), Fiche, Donjon, Présentation, Imprimer, la page courante portant `aria-current="page"`. Il vient de `css/base.css`, qui porte aussi les jetons partagés des pages sombres (couleurs, rayons, espacements, focus, `--cible` : 44 px sous 760 px, aucune exigence au-dessus). Il n'apparaît ni sur la vue table (`?vue=table`), ni à l'impression. La Fiche garde sa palette : elle ne réutilise de `base.css` que l'en-tête, recoloré avec ses variables.

## Lancer en local

Les modules JavaScript ne se chargent pas en ouvrant `donjon.html` d'un double-clic (protocole `file://`).
Il faut un petit serveur local. Celui du projet désactive le cache, pour voir tout de suite chaque modification :

```bash
python3 outils/serveur.py
```

Ouvrez ensuite <http://localhost:8765> (accueil). Les tests du parseur sont sur <http://localhost:8765/tests.html>,
ou en ligne de commande avec `node tests/node.mjs`.

## Ce que comprend le parseur

- **Dimensions** : « 4 m par 12 », « 6 cases sur 6 », « carrée de 9 m », « 7,5 m de large et 15 m de long »,
  « petite pièce », « couloir ». Échelle par défaut : 1 case = 1,5 m, arrondi à la case la plus proche.
- **Quantités** : en chiffres ou en lettres (« dix-sept », « une paire de », « des torches »).
- **Objets** : pilier, colonne, coffre, statue, table, chaise, autel, trône, tonneau, caisse, escalier, fosse, lit,
  bibliothèque, torche, débris, puits, fontaine, sarcophage, ainsi que les portes, herses et arches.
  Pour en ajouter un, éditez la table de `js/parseur/lexique.js`.
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

## Donjon : plusieurs salles

Un **donjon** est un ensemble de salles, de liaisons entre leurs portes et d'un carnet de notes par salle.
Dans chaque salle, la description reste la seule référence (texte → plan → carte et JSON).

- **Salles** : liste dans le panneau (nom modifiable, salle affichée en évidence, « + Salle isolée », suppression
  en deux clics). Supprimer un donjon se fait aussi en deux clics : un message donne son nom et son nombre de salles, le bouton
  garde sa largeur, et « Présenter » / « Imprimer » sont sur une autre ligne. Sa partie en cours reste dans la Présentation
  (« Autres parties en cours »). Supprimer une salle retire ses liaisons ; supprimer la dernière en recrée une vide.
- **Mini-carte** : schéma sans échelle des salles et de leurs liaisons. Une porte au nord place la salle voisine au-dessus,
  etc. ; les salles non reliées sont à part, en dessous. Un clic, ou Tab puis Entrée, affiche la salle. Chaque case a une zone
  cliquable d'au moins 44 px à l'écran.
- **Première utilisation** : tant qu'aucun donjon n'a plus d'une salle, les exemples sont dépliés au démarrage et le sous-titre
  dit « Décris une porte, puis clique dessus pour créer la salle suivante » ; il reprend son texte dès qu'une deuxième salle existe.
  Une salle sans porte l'indique dans la note de « Salles ».
- **Changer de salle** : le panneau revient en haut ; une salle qui vient d'être créée donne le focus à sa description
  (pas au doigt, ni quand le focus est sur la mini-carte).
- **Relier** : un clic (sans glisser) sur une porte la sélectionne. Non reliée, elle propose « Nouvelle salle derrière cette
  porte » (6 × 6 cases, porte de retour sur le mur opposé, écrite dans sa description) ou « Relier à une salle existante »
  (une porte est ajoutée sur le mur opposé de cette salle : même position si elle est libre, sinon la première libre).
  Reliée, elle propose « Aller à la salle… » et « Délier ». Une porte reliée porte une pastille bleue sur la carte.
  Au clic, la zone « Sélection » est amenée en vue (défilement doux, au plus court ; pas sous 760 px) et la porte est cerclée d'or avec un liseré sombre.
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
- **Exporter / importer** : « Exporter le donjon » écrit tout (salles, notes, liaisons, éléments cachés). « Importer un donjon »
  ajoute un donjon sans rien écraser ; il accepte le format ci-dessous, l'ancien format `jdr-carte` (une salle) et un plan seul,
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
    la rouvre telle quelle, sans rien écrire ni relancer ; « ← Liste des donjons » ramène à l'écran de départ et l'oublie.
- **Une copie, jamais l'original** : démarrer copie le donjon. Tout ce qui se passe en jeu (pions déplacés, éléments révélés, salles
  découvertes, salle courante) est enregistré dans `carte-de-mj:presentations-v1`, séparément. Le donjon préparé n'est jamais modifié et
  aucun texte n'est réécrit : un pion déplacé ne change que son x et son y. Une salle retrouve donc son état quand on y revient.
- **Régie (vue MJ)** : la carte complète de la salle consultée, éléments cachés visibles (translucides, en pointillés), notes en lecture
  seule, mini-carte avec salles découvertes (trait plein) et non découvertes (pointillés).
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
  - *Table ou consultation* : cliquer une salle de la mini-carte la **consulte** sans la montrer ni la marquer découverte. Un bandeau
    permanent dit si la salle regardée est « À LA TABLE » (vert) ou en « CONSULTATION » (jaune, cadre en pointillés) et rappelle laquelle
    est à la table ; « Afficher à la table » la rend courante et découverte.
- **Vue table** : uniquement la carte, sans interface. Deux façons :
  - « Ouvrir la fenêtre table » (`presentation.html?vue=table`) : à glisser sur l'écran de la table ; un bouton « Plein écran » discret
    apparaît quelques secondes après un mouvement de **souris** (inactif sinon : `pointer-events: none`, et un toucher ne le réveille pas). Synchronisée par BroadcastChannel (canal `carte-de-mj-presentation`, même navigateur). Ouverte seule ou rechargée, elle
    demande l'état à la régie, et affiche un message d'attente si aucune régie ne répond.
  - « Plein écran ici » : pour un seul écran ; Échap pour revenir, ou « Retour à la régie », qui demande **deux appuis**
    (le premier arme le bouton, le second confirme dans les 4 secondes).
  - *Taille de la carte* (choix de la régie, mémorisé dans les réglages, `modeTable`) :
    **« Remplir l'écran »** calcule la case pour que la salle et sa marge de roche occupent la fenêtre table (entière, entre 16 et 300 px ;
    recalculée au redimensionnement, au changement de salle et de mode ; repères agrandis avec la case) ;
    **« Échelle réelle (figurines) »** garde exactement la taille calibrée, sans aucune adaptation (une salle trop grande défile).
    Sans choix explicite, le défaut est l'échelle réelle si la taille a été calibrée (indicateur `calibre` posé par le Donjon quand
    on règle la taille avec la case « Calibrer avec une carte bancaire », ou à défaut une taille différente de 48 px), sinon « Remplir ».
    Le mode est un simple mot joint aux réglages d'affichage envoyés à la table : il ne passe pas par `vueTable()` et ne contient aucun secret.
- **Sécurité** : ce que reçoit la table est le résultat de `vueTable()` (`js/presentation.js`), construit par liste blanche : salle courante
  uniquement, sans notes, sans nom ni description, sans notes (ni de préparation, ni de partie), sans élément caché non révélé (portes comprises), sans `cache`,
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
  "notesPartie": { "s-x1y2z3": "Les joueurs ont forcé la serrure." } }
```

Rangé dans `carte-de-mj:presentations-v1` sous la forme `{ "presentations": { "<idDonjon>": <partie> } }`. Les identifiants d'éléments
(`o1`, `c1`, `p1`) y sont stables, car rien ne relit le texte.

Étape 4 : le format reste en version 1, avec deux ajouts facultatifs. `notesPartie` (texte par salle) et `etat` sur une créature du plan
(`"blesse"` ou `"mort"`, absent = normal). Une partie enregistrée avant l'étape 4 se charge donc telle quelle ; à l'import, `notesPartie` est
nettoyé (salles inconnues, valeurs qui ne sont pas du texte, longueur bornée) et un `etat` inconnu est écarté, sans refuser la partie.

## Imprimer un donjon

Le bouton **Imprimer ce donjon** du Donjon ouvre `impression.html` (<http://localhost:8765/impression.html>) sur le donjon actif ; un sélecteur permet d'en prendre un autre. Pour jouer sur papier avec de vraies figurines, sans l'application. Ce n'est pas un quatrième outil : la page lit les donjons du navigateur (`carte-de-mj:donjons-v1`) **sans jamais rien écrire**, ni dans cette clé ni ailleurs.

- **Réglages** : salles à imprimer (toutes cochées par défaut), version MJ ou joueurs, pions inclus ou non, échelle. L'aperçu à l'écran reproduit les pages A4 (marge de 10 mm, `@page { size: A4; margin: 10mm }`) ; « Imprimer » appelle `window.print()`.
- **Version joueurs** (par défaut) : mêmes règles de secret que la table, par liste blanche de champs (`planPublic()` de `js/presentation.js`, aussi utilisée par `vueTable()`). Ni élément caché, ni porte secrète, ni notes, ni liaisons, ni nom de salle, ni nom de donjon, ni état blessé / mort. Les pions de **monstres et de PNJ sont exclus par défaut** (un plan imprimé d'avance ne doit pas les dévoiler) ; une case à cocher les inclut. Les pions de personnages restent. Les salles sont désignées par « Plan N » (rang dans le donjon).
- **Version MJ** : tout, secrets compris (contour en pointillés et pastille « S »), portes reliées marquées « → N », et une **feuille du MJ** en tête (noms, liaisons porte → salle, liste des secrets, notes de préparation). Chaque page porte « VERSION MJ · SECRÈTE ».
- **Échelle** : 25 mm par case par défaut, exacte sur papier (tailles CSS en millimètres). « Tenir sur une page » réduit l'échelle (au dixième de mm, 25 mm au plus) et l'écrit en en-tête de chaque page, avec la mention que les figurines ne tiendront plus forcément.
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
tests.html          tests du parseur, du donjon, de la présentation et de l'impression dans le navigateur
css/base.css        socle commun : jetons (couleurs du thème sombre, rayons, espacements, focus, taille de cible tactile) et en-tête de navigation
css/style.css
css/presentation.css  écran de départ, régie et vue table
css/impression.css  pages A4 et réglages de l'impression
js/main-mj.js       branchement de l'interface (donjons, salles, sélection)
js/affichage.js     taille de la carte à la table : modes « remplir » / « échelle réelle », mode par défaut (pur, sans DOM)
js/presentation.js  partie en cours, portes, révélations, improvisation, vueTable (pur, sans DOM)
js/main-presentation.js  régie et vue table (DOM, stockage, BroadcastChannel)
js/impression.js    découpage en pages A4, échelle, versions MJ / joueurs (pur, sans DOM)
js/main-impression.js  page d'impression (DOM, aperçu, règle de contrôle)
js/donjon.js        modèle du donjon : salles, liaisons, orphelines, validation (pur, sans DOM)
js/minicarte.js     mini-carte SVG des salles et de leurs liaisons
js/schema.js        schéma du plan d'une salle et validation
js/stockage.js      localStorage (donjons, réglages, migration), export/import JSON
js/voix.js          dictée (Web Speech API)
js/deplacement.js   glisser-déposer et clic sur la carte
js/parseur/         normalisation, nombres, lexique, dimensions, positions, placement, decrire (plan → texte),
                    commandes (« ajoute trois gobelins » en cours de partie : pur, sans DOM)
js/rendu/           moteur Canvas, thème vectoriel et thème papier (impression)
tests/              phrases de test, tests du donjon, des commandes, de la présentation et de l'impression, mini-outil d'assertions
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
