# Piste : les histoires (non décidée)

Note de réflexion du 2026-11-06, issue d'une discussion avec Julien. **Rien n'est décidé ni commencé** : Julien n'est pas sûr de vouloir le faire pour l'instant.
Ce document garde la proposition pour qu'on puisse la reprendre sans tout refaire.

## Le besoin

L'appli sait préparer des **lieux** (le Monde, cartes imbriquées), des **salles** (les Donjons) et **jouer** (la régie). Il manque le fil qui les relie :
où se passent les scènes, qui on rencontre, ce que les joueurs doivent apprendre. Partir d'un scénario écrit et en tirer les bonnes cartes et les bons donjons,
puis remplir les images au fur et à mesure.

Exemple de scénario qui a servi de cas concret : « Les Lanternes de Pré-Doré » (fin de la note).

## Les décisions de principe

1. **Une seule skill côté MJ, un seul outil d'image.** Une skill `histoire` transforme un scénario en fichier « aventure » et sait générer les cartes manquantes,
   en réutilisant `outils/cartes/generer.mjs` et `style/peint-v1.md` (pas de copie : le style ne doit exister qu'une fois). Générer une carte seule reste possible
   (`generer-carte` gardée ou ramenée à une section de la skill). Chaque image se valide à l'œil, une par une : elle coûte de l'argent.
2. **Le Monde reste la racine ; une histoire est un calque.** Le monde possède lieux, points et donjons. Une histoire ne possède rien : elle renvoie à des lieux et
   à des donjons et peut en ajouter. Un monde peut porter plusieurs histoires ; deux histoires peuvent partager un lieu. Dans l'arbre : une branche « Histoires »
   sous le monde ; choisir une histoire met en évidence ses lieux et ses salles et estompe le reste.
3. **Pas d'ordre imposé entre les scènes.** Une scène est attachée à un lieu ou à une salle, pas à un numéro. Les **indices** relient les scènes
   (« les traces griffues mènent au Moulin »). On prévoit plusieurs indices vers chaque lieu important ; l'appli signale un lieu atteint par un seul indice.
   Seuls l'accroche et le ou les dénouements sont fixés. **Événements datés** facultatifs (« le soir de la fête, le Marquis agit »).
4. **Les donjons sont écrits par la skill, en français.** Pas de XML : l'import JSON existe, et une salle donnée seulement par son `texte` voit son plan calculé
   à l'import (`js/donjon-validation.js`). La skill peut lancer le parseur sous Node pour vérifier chaque description avant de livrer.
5. **Un fichier « aventure » importe tout d'un bloc** : histoire (scènes, indices, PNJ, événements), lieux et points, donjons complets. Seules les images manquent,
   avec leur prompt prêt. Il faut pour cela un **lieu « image à venir »** : aujourd'hui un lieu exige une image valide (`imageValide`, `js/univers-validation.js`).

## Ce qui persiste d'une histoire à l'autre : cinq couches

Un objet déplacé dans l'histoire 1 doit rester déplacé quand on revient dans ce lieu pendant l'histoire 2. Critère pour classer une donnée :
*resterait-elle vraie si un autre groupe passait le lendemain ?* Si oui, c'est le monde vivant ; si elle dépend de ce que les joueurs ont vu, c'est le groupe ;
si elle n'a de sens que pour cette intrigue, c'est l'histoire.

| Couche | Contenu | Durée de vie |
|---|---|---|
| **Monde (préparation)** | lieux, images, points, donjons, salles, objets et créatures installés | permanente, modifiée en préparation |
| **Monde vivant** | ce qui s'est physiquement passé : objets déplacés ou pris, portes forcées, créatures mortes ou parties, position et état des créatures | permanente, commune à toutes les histoires |
| **Histoire (calque)** | scènes, indices, PNJ et leurs rôles, événements, contenus apportés au monde | le temps de l'histoire |
| **Groupe** | ce que les joueurs savent : salles découvertes, points révélés, indices trouvés, notes de partie | suit le groupe d'une histoire à l'autre |
| **Séance** | pions des PJ, ce qui est montré à la table, tour de combat, PV en plein combat | jetable |

- **Monde vivant = journal de changements** posé sur la préparation intacte (« objet X déplacé en (4, 7) », « créature Y morte »), chacun daté et rattaché
  à son histoire. Avantages : on continue à préparer sans écraser le jeu ; chaque changement s'annule ; un changement dont l'élément a été supprimé en préparation
  devient orphelin et est signalé (jamais effacé en silence) ; « remettre le monde à neuf » ou dupliquer le monde pour un autre groupe.
- **Ce qu'une histoire apporte** (des kobolds, un manoir) est versé dans le monde quand l'histoire commence ; ses morts restent morts. À la **clôture**,
  une feuille demande ce que le monde garde (survivants, lieux qui restent accessibles).
- **Plusieurs groupes dans un même monde** : rare ; on duplique le monde plutôt que de compliquer le modèle.
- **Changement profond** : aujourd'hui une partie **copie** le donjon (`js/partie.js`, « une copie, jamais l'original »). Il faudrait qu'elle lise
  préparation + monde vivant + calque et écrive chaque changement dans sa couche. Migration des parties en cours (format v1) : révélations vers le groupe,
  objets déplacés et créatures mortes vers le monde vivant. **À concevoir avant tout le reste.**

## Où ça se place dans l'appli

Aucune nouvelle page : les entrées de la barre du haut restent les mêmes.

- **Hors appli (Claude Code)** : scénario → skill `histoire` → fichier aventure (+ images générées).
- **Monde · Donjons (atelier)** : « Importer une aventure » ; branche « Histoires » dans l'arbre ; sélecteur de calque ; épingles de scènes sur la carte ;
  lieux « image à venir » en pointillés avec une zone « Déposer l'image » (ou Bibliothèque, ou « Copier la commande » de génération) ; inspecteur d'une scène
  (texte à lire, indices trouvés ici, indices qui y mènent, PNJ, pastilles d'avancement : image, grille, donjon) ; vue **toile d'indices** (scènes reliées par
  les indices, alerte sur un lieu à un seul indice, événements datés).
- **Bibliothèque** : inchangée ; elle sert à remplir les emplacements.
- **Jouer (régie)** : un onglet **Histoire** à côté de Salle, Joueurs, Table : scène du lieu courant (choisie toute seule), texte à lire, indices à cocher,
  ce que le groupe sait déjà, événements à venir, documents à montrer à la table (portrait de PNJ, objet). Une vue **Monde vivant** : journal des changements
  (origine, annuler) et feuille de clôture d'une histoire.
- **Fiche joueur** : inchangée.

Une maquette jetable (widget dans la conversation, non conservé) a montré ces quatre écrans : préparer sur la carte, toile d'indices, jouer, monde vivant.

## Ordre proposé si on s'y met

0. Concevoir les couches et le journal du monde vivant (transformer ce document en `docs/conception-histoire.md` : contrats et format du fichier aventure).
1. Préparer : lieu « image à venir », import d'une aventure, branche Histoires, scènes et indices dans l'atelier, skill `histoire`.
2. Jouer : onglet Histoire de la régie, monde vivant branché sur la partie.
3. Enrichir : documents à montrer, journal et résumé de séance (« Précédemment… »).

## Annexe : le cas concret « Les Lanternes de Pré-Doré »

Niveaux 1 à 3, règles 2014, 3 ou 4 séances, ambiance colorée de conte. Le cœur de la Grande Lanterne (cristal Cœur-d'Été) disparaît trois jours avant la fête ;
sans lui, les lucioles-esprits ne reviennent pas polliniser les vergers. Coupables visibles : des kobolds bricoleurs (cheffe Mèche-Brûlée), poussés par le
Marquis des Brumes, noble féerique qui veut un crépuscule d'automne éternel et leur a promis de sauver leurs champignonnières.

| Lieu | Niveau de carte | id suggéré |
|---|---|---|
| Le Val des Vergers | `region` | `val-vergers-01` |
| Pré-Doré en fête (accroche) | `localite` | `pre-dore-fete-01` |
| Le Bois-Chapeau (champignons géants, cercle féerique) | `zone` | `bois-chapeau-01` |
| Le Moulin noyé (entrée des caves) | `zone` | `moulin-noye-01` |
| Les Ateliers de Cliquetis | donjon | `ateliers-kobolds-01` |
| Le Pavillon des Brumes (affrontement final) | `batiment` | `pavillon-brumes-01` |

- **Caves du Moulin (5 salles)** : cellier inondé, réserve de grain (rats géants), salle des engrenages (piège de la roue), passage kobold, escalier vers les Ateliers.
- **Ateliers de Cliquetis (7 à 8 salles)** : poste de garde à clochettes, champignonnière violette qui dépérit (indice du Marquis), forge à vapeur, dortoir,
  salle des inventions, salle du trône de Mèche-Brûlée, porte féerique vers le Pavillon.
- **Fins** : négociation (alliance avec les kobolds contre le Marquis) ou force ; épilogue, la lanterne se rallume et les lucioles traversent le village.
