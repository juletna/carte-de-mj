# Refonte « atelier » (lot 3) : conception

Brief commun aux agents du lot 3. Il fixe les **contrats** (sélection, inspecteur, arbre, adresses) et le **partage des fichiers**.
Un agent qui doit changer un contrat le dit dans son compte rendu au lieu de le changer seul. Même esprit que `docs/conception-univers.md`.

## But et décisions prises avec Julien

- **PRÉPARER** (`donjon.html`, entrée Préparer de la barre) : un seul atelier à trois colonnes. Gauche : **arbre** (monde, lieux,
  donjons, salles). Centre : **scène** (carte de lieu, salle, ou vue d'ensemble du donjon) sous une **barre d'outils**. Droite : **inspecteur**
  qui ne montre que la sélection, actions destructives dans un « ⋯ ».
- **JOUER** (`presentation.html`) : même arbre en lecture (pastilles découvert / à la table), carte de régie au centre avec **un seul bandeau
  d'état**, **commande rapide en barre fixe** au-dessus de la carte, à droite trois **onglets** : Salle · Joueurs · Table.
- Sous **760 px** (`js/telephone.js`) : arbre en tiroir, inspecteur en panneau bas, onglets en bas.
- Un donjon est un nœud de l'arbre du monde ; un donjon sans monde va dans le groupe « Donjons hors monde ».

## Contraintes qui ne bougent pas

- Statique, hors ligne, JS pur, logique testée sous Node (`node tests/node.mjs`, et `tests.html`). Tout en français.
- **Formats de stockage inchangés** (`stockage.js`, `univers.js`, `partie.js`, `univers-partie.js`) : aucune migration prévue. Si un lot en
  découvre le besoin, il la fait avec mise de côté (`js/mise-de-cote.js`) et le dit.
- **Hors lot, ne pas toucher** : `js/parseur/`, `js/rendu/` (une autre session y travaille en continu), `js/catalogue.js`, thèmes d'objets,
  `js/palette.js` pour son contenu. On appelle le rendu, on ne le modifie pas.
- Aucune fonction du README ne disparaît : à chaque lot, parcourir les sections Donjon, Monde, Présentation du README et cocher.
- Système visuel de `css/base.css` et `js/icones.js` : boutons `.btn`, un seul doré par écran, destructif en `.btn-danger`, cibles 44 px.
- Pas de CI : tests en local, commits finissant par ` [skip ci]`.

## 1. Inventaire de l'existant et destination

### Donjon (`donjon.html`, `js/main-mj.js` = `ctx` partagé par des fabriques `creerX(ctx)`)

| Zone actuelle | Produite par | Destination dans l'atelier |
|---|---|---|
| Rail d'outils (Salle, Portes, Mobilier, Créatures, Personnages, Notes, Salles, Réglages) | `js/rail.js` (`OUTILS`, `creerRail`), `js/regie-panneau.js` (replis) | Plus de rail. **Barre d'outils de scène** : Portes, Mobilier, Créatures (pose, catalogue `js/palette.js`). Salle, Personnages, Notes, Salles, Réglages deviennent des **inspecteurs** (voir ci-dessous). `rail.js` garde `OUTILS` pour la barre. |
| Panneau Salle (description, Forme, Sol/Ambiance/État/Éclairage, Compris, Exemples) | `donjon.html` `[data-pour=salle]`, `js/mj/salle-forme.js`, `main-mj.js` | **Inspecteur « salle »** (description et « Compris » restent en tête : c'est l'entrée principale du MJ). |
| Panneau Personnages (fiches du donjon, Au hasard) | `js/mj/personnages-ui.js`, `js/fiche-hasard.js` | **Inspecteur « donjon »**, section Personnages. |
| Panneau Notes | `#notes` dans `donjon.html`, `main-mj.js` | **Inspecteur « salle »**, section Notes. |
| Panneau Salles (mini-plan, liste, orphelines, vue d'ensemble) | `js/mj/salles-liste.js`, `js/miniplan.js`, `js/mj/vue-plan.js` | Liste → **arbre** (nœuds salle). Mini-plan et orphelines → **inspecteur « donjon »**. Vue d'ensemble = scène du nœud donjon (`vue-plan.js`, `plan-donjon.js`). |
| Panneau Réglages (échelle, thème, détails, grille, relief, pénombre, flammes, plein écran) | `js/reglages-rendu.js` (`lierReglagesRendu`) | **Inspecteur « donjon »**, section Affichage (mêmes `etat.reglages`). |
| Bulle d'actions (porte, objet, pion) | `js/mj/bulle.js` (`#selection`) | **Inspecteur** (porte, objet, creature). Plus de bulle flottante sur ordinateur ; sur mobile le bandeau bas actuel devient l'inspecteur. |
| Onglets Texte / Carte mobile | `js/telephone.js` (`activerOnglets`), `#barre` | Remplacés par tiroir de l'arbre et panneau bas. La description reste dans l'inspecteur « salle ». |
| Menu du donjon (changer, renommer, nouveau, hasard, modèle, exporter, importer, imprimer, copier, coller, copies mises de côté) | `js/mj/menu-donjon.js` | **Inspecteur « donjon »** (renommer, exporter, imprimer, copier) et **« ⋯ » de l'en-tête de l'arbre** (nouveau, hasard, modèle, importer, coller, copies de côté). Le `<select>` « changer de donjon » disparaît : l'arbre le remplace. |
| Zoom, pastille de pose, « Ajouter », message de carte | `js/mj/zoom.js`, `js/pose.js`, `main-mj.js` | Restent dans la scène (zoom sous la carte, pastille de pose dans la barre d'outils). |
| Carte de salle (canvas, bords N/S/E/O) | `js/mj/vue-carte.js`, `js/rendu/*` | Scène « salle », **code inchangé**. |

### Monde (`#univers` dans `donjon.html`, `js/mj/univers-ui.js`, 655 lignes)

| Zone actuelle | Produite par | Destination |
|---|---|---|
| Barre du monde (choix, nom, crayon, Jouer, menu ⋯) | `univers-ui.js`, `js/mj/univers-menu.js` | Choix du monde = racine de l'arbre ; renommer et Jouer = inspecteur « monde ». |
| Arbre des lieux | `js/mj/univers-arbre.js` (`creerArbre`), `js/univers-vue.js` (`arbreLieux`, `filtrerArbre`) | **Colonne arbre unique** (arbre unifié, §2). `creerArbre` est généralisé, pas dupliqué. |
| Carte de lieu, points, glisser | `js/univers-carte.js`, `univers-ui.js` | Scène « lieu » + barre d'outils Sélection / Point / Grille. |
| Bulle d'un point (destination, liste à vignettes, retirer) | `univers-ui.js`, `js/mj/univers-liste.js` | **Inspecteur « point »**. |
| Calage de grille | `js/mj/univers-calage.js`, `js/univers-grille.js` | Outil Grille de la barre ; réglages dans l'inspecteur « lieu ». |
| Fil d'Ariane, notifications, annuler un retrait | `univers-ui.js`, `univers-menu.js` | Fil au-dessus de la scène ; notifications conservées. |
| Images (bibliothèque, import) | `js/univers-images.js`, `js/bibliotheque/` | Inspecteur « lieu » (changer d'image) ; ajout d'un lieu via « ⋯ » de l'arbre. |

### Présentation (`presentation.html`, `js/regie.js`, 684 lignes)

| Zone actuelle | Produite par | Destination |
|---|---|---|
| Écran de départ (parties, mondes, bibliothèque, fichier) | `js/regie-depart.js` | Inchangé ; ouvre l'atelier de jeu. |
| En-tête (nom, fil d'univers, alertes, « Liste des parties ») | `regie.js`, `js/regie-univers.js` (`majFil`) | Bandeau unique au-dessus de la carte (salle, alerte de retrait, reprise de la main). |
| Commande rapide + exemples | `js/commande-table.js`, `regie.js` `majCommande` | **Barre fixe** au-dessus de la carte. |
| Cette salle (révéler, portes, éléments) | `regie.js` `majSalle`, `js/regie-selection.js` | Onglet **Salle**. |
| Personnages (PV, déplacer, ajout) | `regie.js` `majPersonnages`, `reglagePV` | Onglet **Joueurs**. |
| Salles (mini-plan) | `js/miniplan.js` | **Arbre de lecture** à gauche (pastilles). |
| Notes de la salle (+ notes de partie) | `regie.js` | Onglet **Salle**. |
| Table (fenêtre, plein ici, mode, mini-carte, défilement, calibrage) et Réglages | `regie.js`, `js/regie-reglages.js`, `js/ecran-table.js` | Onglet **Table**. |
| Régie de monde (carte, points révélés, entrer/sortir) | `js/regie-univers.js`, `univers-partie.js` | Scène de jeu d'un lieu, mêmes onglets (Salle masqué, Table identique). |

## 2. Architecture cible

Nouveau dossier `js/atelier/` (DOM) et trois modules purs à la racine de `js/` (testables sous Node, aucun `document`).

### Modules purs (lot A)

- `js/atelier-arbre.js` : `arbreAtelier({ univers, donjons, actif })` renvoie `{ mondes: [...], horsMonde: {...} }`. Nœuds
  `{ cle, type: 'monde'|'lieu'|'donjon'|'salle', id, nom, enfants, contexte }`. Il **réutilise** `arbreLieux` (lieux et feuilles donjon, inchangé) et
  ajoute sous chaque donjon ses salles (`donjon.salles`, ordre de `salles-liste.js`). Un donjon référencé par un point passe sous ce lieu ; un donjon
  non référencé va dans `horsMonde` (« Donjons hors monde »). Un donjon référencé par plusieurs points n'apparaît qu'une fois (`aussiDepuis`, comme
  aujourd'hui). `filtrerArbre` est généralisé aux quatre types. Mode jeu : `etatJeu(noeud, partie)` donne la pastille
  (`'decouvert' | 'table' | 'cache'`), pure aussi.
- `js/atelier-selection.js` : le modèle de sélection (ci-dessous).
- `js/atelier-route.js` : `lireRoute(hash)` / `ecrireRoute(route)` (adresses, ci-dessous).

### Sélection commune

```js
{ type: 'monde'|'lieu'|'point'|'donjon'|'salle'|'porte'|'objet'|'creature'|'pion',
  id,        // identifiant stable ; pour porte/objet/creature le DESCRIPTEUR de donjon.js (jamais un id de plan : ils changent à chaque relecture)
  contexte } // { monde?, lieu?, donjon?, salle? } : le chemin qui permet de retrouver l'objet
```

Fonctions pures : `selectionValide(sel, etat)` (l'objet existe-t-il encore ?), `meme(a, b)`, `parent(sel)` (porte, salle, donjon, lieu, monde),
`retrouver(sel, etat)`. L'état courant est tenu par `js/atelier/coquille.js` (`selectionner(sel)`, `selection()`), jamais en double dans
`main-mj.js` : `etat.selection` actuel (descripteur de `donjon.js`) est **alimenté par** la sélection commune pour porte/objet/creature, pour que
`vue-carte.js` et la logique de `bulle.js` continuent de marcher sans réécriture.

### Contrat de l'inspecteur

```js
coquille.inspecteur.enregistrer(type, {
  titre(sel, ctx) → string,
  rendre(conteneur, sel, ctx),                              // remplit le conteneur ; rappelée à chaque changement de sélection ou de données
  actions?(sel, ctx) → [{ libelle, icone, executer }],      // actions courantes, visibles
  destructives?(sel, ctx) → [{ libelle, executer }]         // rangées dans « ⋯ », rendues en .btn-danger
});
```

Règles : un seul lot enregistre un type (§3) ; `rendre` ne garde aucun état entre deux appels (tout vient de `ctx` et du stockage) ; une
suppression passe par l'annulation existante (`historique`, retrait annulable du monde), rien n'est supprimé en silence. Sans sélection,
l'inspecteur montre le nœud actif de l'arbre (monde, lieu ou donjon), jamais un panneau vide.

Ajouts du lot B au contrat (rétrocompatibles) : une action accepte `titre` (infobulle) et `confirmation` (libellé du second clic : le premier arme le bouton, le
second, dans les 4 secondes, exécute ; le « ⋯ » reste ouvert) ; `inspecteur.surEffacement(f)` appelle `f` juste avant que le corps soit vidé (un lot qui y a posé des
nœuds vivants, comme les blocs de formulaire de `donjon.html`, les reprend pour qu'ils restent dans la page) ; ouvert, le « ⋯ » se déplie dans le flux sous l'en-tête
(un menu flottant serait rogné par le défilement de l'inspecteur). Un donjon choisi dans l'arbre montre ses salles (déplié) et sa scène est la vue d'ensemble.

### Coquille (`js/atelier/coquille.js`, lot A)

`creerCoquille({ racine, mode: 'preparer'|'jouer' })` construit la colonne arbre (`.atelier-arbre`), le centre (`.atelier-barre` + `.atelier-scene`) et
la colonne inspecteur (`.atelier-inspecteur`, avec onglets en mode jouer). Elle expose `arbre`, `scene`, `barreOutils`, `inspecteur` (`enregistrer`,
`afficher`), `selectionner`, `selection`, `naviguer(route)`, `ouvrirTiroir()`, `fermerTiroir()`. Mise en page : grille CSS (`css/atelier.css`, nouveau),
colonnes repliables (mémorisées comme `regie-panneau.js`). **Sous 760 px** (`telephone()`) : arbre = tiroir gauche (bouton « Arbre » dans la barre,
refermé en choisissant un nœud), inspecteur = panneau bas (reprend le comportement actuel de `#selection` sur téléphone : repliable, ne couvre
jamais toute la carte), onglets du mode jouer = barre du bas. L'arbre est un `role="tree"` (flèches, Entrée) ; `Échap` ferme tiroir et panneau et
rend le focus au déclencheur.

### Routage par URL

- `donjon.html#monde` · `#monde=<id>` · `#monde=<id>&lieu=<id>` · `#donjon=<id>` · `#donjon=<id>&salle=<id>`.
- Rétrocompatibilité : `analyserHash` et `hashMonde` (`js/univers-vue.js`) et `pageCourante` (`js/navigation-donnees.js`, qui marque Préparer
  dans la barre) gardent leurs sorties ; `lireRoute` les complète. `donjon.html` marque Préparer quel que soit le hash.
- Barre commune : une seule entrée, Préparer (`hrefPreparer`, `js/navigation-donnees.js`). Elle mène au dernier élément ouvert (la coquille garde
  son hash dans `carte-de-mj:atelier-derniere-route`) ; sans historique, au premier monde (le monde actif), sinon à `donjon.html` (donjon actif).
- La coquille écrit la route par `history.replaceState` à chaque navigation (comme `univers-ui.js` aujourd'hui), la lit au chargement et sur
  `hashchange` ; une route périmée (donjon ou salle disparus) retombe sur l'actif sans erreur. F5 retrouve donc le même nœud.

## 3. Lots de travail

Ordre : **A** (socle) puis **B, C, D en parallèle**. A se livre en deux jalons : **A1** (modules purs, `inspecteur.js` et tests, petit, poussé
seul en premier) et **A2** (coquille, CSS, câblage de la page).

### Lot A : socle (coquille, sélection, arbre, route)

Possède : `js/atelier-arbre.js`, `js/atelier-selection.js`, `js/atelier-route.js`, `js/atelier/coquille.js`, `js/atelier/arbre-vue.js` (rendu DOM de
l'arbre, éditable et en lecture), `js/atelier/inspecteur.js`, `css/atelier.css`, `tests/atelier-arbre.test.js`, `tests/atelier-selection.test.js`,
`tests/atelier-route.test.js`, `js/navigation-donnees.js` et `js/navigation.js`, et **`donjon.html`, `js/main-mj.js`, `css/donjon.css`**.
Livre : les contrats du §2 ; `donjon.html` réduit à la barre et à `#atelier`, avec les anciens blocs conservés en gabarits `<template>` que B et C
reprennent chacun dans leur zone ; `main-mj.js` qui crée la coquille et appelle `inscrireDonjon` et `inscrireMonde` (deux fichiers à signature que A
crée vides : `js/atelier/inscrire-donjon.js` et `js/atelier/inscrire-monde.js`). Tant que B et C n'ont pas rendu, l'ancien rail reste branché derrière
la nouvelle coquille : aucune fonction n'est perdue en route.
Fini : tests purs verts (arbre : monde avec lieux imbriqués, donjon relié deux fois, donjon hors monde, lieu non relié, salles dans l'ordre, filtre
sur les quatre types, donjon vide ; sélection : meme, parent, retrouver, objet disparu ; route : aller-retour, hash invalide, rétrocompatibilité de
`#monde`). Au navigateur, 1280 et 375 px : trois colonnes, repli, tiroir et panneau bas, F5 sur chaque route, entrées Monde et Donjons de la barre,
clavier de l'arbre.

### Lot B : Préparer, côté Donjon

Possède : `js/atelier/inscrire-donjon.js`, `js/atelier/inspecteurs-donjon.js` (types salle, porte, objet, creature, pion, donjon),
`js/atelier/barre-salle.js` (Portes/Mobilier/Créatures, pose, annuler, zoom) ; **modifie** (sorties DOM seulement, logique intacte)
`js/mj/bulle.js`, `js/mj/salles-liste.js`, `js/mj/menu-donjon.js`, `js/mj/personnages-ui.js`, `js/mj/salle-forme.js`, `js/rail.js`,
`js/reglages-rendu.js`, `tests/rail.test.js`, et les `<template>` de `donjon.html` de ces zones (B n'écrit que dans les siens, jamais dans la
coquille). Ne touche ni `vue-carte.js`, ni `vue-plan.js`, ni le contenu de `js/palette.js`, ni `js/rendu/`.
Livre : tout l'inventaire « Donjon » du §1 ; l'arbre montre donjons et salles (clic = `naviguer` + sélection) ; suppression d'une salle, d'un donjon
et d'un élément dans « ⋯ » avec l'annulation existante ; tiroir et panneau bas sur mobile.
Fini : `node tests/node.mjs` vert ; chaque fonction du README vérifiée au navigateur à 1280 et 375 px (créer, relier, supprimer une salle ;
portes et escaliers ; pose ; annuler et rétablir ; dictée ; import, export, copier, coller ; modèles ; hasard ; copies de côté ; personnages ;
impression) ; captures avant et après dans le compte rendu.

### Lot C : Préparer, côté Monde

Possède : `js/atelier/inscrire-monde.js`, `js/atelier/inspecteurs-monde.js` (types monde, lieu, point), `js/atelier/barre-lieu.js`
(Sélection/Point/Grille) ; **modifie** `js/mj/univers-ui.js` (à découper : il ne garde que la logique de carte et de données), `js/mj/univers-arbre.js`
(généralisé ou supprimé au profit de `arbre-vue.js`, accord avec A), `js/mj/univers-menu.js`, `js/mj/univers-liste.js`, `js/mj/univers-calage.js`,
`js/univers-carte.js` (sorties DOM seulement), `css/univers.css`, `tests/univers*.test.js`, et les `<template>` de la zone monde.
Livre : tout l'inventaire « Monde » du §1 ; la scène « lieu » dans la coquille ; l'arbre complet avec donjons reliés ; création d'un lieu et d'un
point, retrait annulable, calage, import d'image ; l'overlay `#univers` disparaît.
Fini : critères de B pour les fonctions « Monde » du README, plus : `#monde=<id>&lieu=<id>` rouvre le bon lieu après F5 ; un point vers un
donjon sélectionne ce donjon dans l'arbre.

### Lot D : Jouer

Possède : `presentation.html`, `js/regie.js`, `js/regie-depart.js` (seulement pour ouvrir l'atelier), `js/regie-selection.js`, `js/regie-univers.js`,
`js/regie-reglages.js`, `js/regie-panneau.js`, `js/regie-icones.js`, `js/commande-table.js` (sortie DOM), `js/miniplan.js` (si repris),
`css/presentation.css`, `js/atelier/jouer.js` (onglets Salle · Joueurs · Table), `tests/regie.test.js`, `tests/commande-table.test.js`.
Utilise la coquille et l'arbre de A (`mode: 'jouer'`, `etatJeu`) sans les modifier : une lacune se signale à A. **Ne touche pas** `js/ecran-table.js`,
`js/vue-table.js`, `js/protocole-table.js` (la vue des joueurs ne change pas).
Livre : arbre de lecture à pastilles, bandeau d'état unique, barre de commande fixe, trois onglets, « Reprendre la main » et alertes conservés ;
régie de monde dans la même mise en page ; mobile : arbre en tiroir, onglets en bas, commande toujours atteignable.
Fini : tests verts ; parcours complet au navigateur à 1280 et 375 px (ouvrir une partie, révéler, déplacer un pion, PV, fenêtre de table, plein
écran, calibrage, défilement, entrer dans un donjon depuis un monde et en sortir, reprise après F5) ; la vue table (`?vue=table`) strictement
identique.

### Règles communes de « fini »

Tests ajoutés à `tests/tous.js` (donc `tests/node.mjs`) et `tests.html` ; aucune erreur dans la console du navigateur ; aucun `innerHTML` sur du
texte venu d'un fichier ; focus visible et clavier ; cibles 44 px ; README mis à jour dans la section du lot seulement (lignes ajoutées, rebase avant
de pousser) ; commit en français, ` [skip ci]`, push sur `main` quand c'est fini et vérifié.

## 4. Risques et parades

| Risque | Parade |
|---|---|
| Conflits sur `donjon.html`, `main-mj.js`, `css/donjon.css` | A en est **seul propriétaire** ; B et C n'écrivent que dans leurs `<template>` et leurs fichiers `inscrire-*.js`. `README.md`, `tests/tous.js`, `tests.html` : lignes ajoutées seulement, rebase avant chaque push. |
| B, C, D attendent A | A1 (modules purs et `inspecteur.js`) tient en une courte session et se pousse seul ; les autres écrivent leurs inspecteurs contre le contrat du §2. |
| Régressions silencieuses | Liste de contrôle du README par lot ; l'ancien rail reste branché tant que B n'a pas fini ; chaque lot retire ses anciens blocs dans le **même commit** que leur remplaçant. |
| `main-mj.js` et `univers-ui.js` s'appellent (`ctx.univers.ouvrir`, `activerSalle`) | Remplacés par `coquille.naviguer(route)` ; aucune fabrique `creerX` n'en importe une autre (règle actuelle conservée). |
| Sélection : ids de plan instables | Garder les **descripteurs** de `donjon.js` ; `selectionValide` à chaque rendu ; test d'un objet déplacé puis supprimé. |
| Donjon supprimé laissant des points orphelins | Comportement actuel gardé (points signalés, jamais retirés en silence), visible dans l'inspecteur « point ». |
| Mobile (écran étroit, clavier virtuel, panneau bas qui couvre la carte) | Vérifier à 375 px à chaque lot ; inspecteur à 45 vh au plus, repliable ; tiroir avec fond cliquable ; rien ne dépend du survol. |
| Collision avec la session rendu et objets | Seules les API publiques de `js/rendu/moteur.js` sont appelées ; `git diff --stat` d'un lot ne montre aucun fichier de `js/rendu/`, `js/parseur/`, `js/catalogue.js`. Un test de rendu cassé après rebase n'est pas à réparer par ce lot. |
| Perte de données au changement d'adresse | Les anciennes adresses (`#monde`, `#monde=<id>`, `presentation.html?univers=`, `impression.html?donjon=`) restent valides ; test dans `atelier-route.test.js`. |
| Performance de l'arbre (gros donjon généré) | Salles d'un donjon replié rendues à l'ouverture seulement ; pas de redessin complet à chaque frappe de la description. |
