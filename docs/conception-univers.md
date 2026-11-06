# Univers de cartes imbriquées : conception

Document de référence (vague 0) commun aux sessions qui construisent cette fonctionnalité. Il fixe les **contrats** :
format d'une carte de la bibliothèque, modèle d'un univers, rangement des images, partage des fichiers entre sessions.
Une session qui a besoin de changer un contrat le dit dans son compte rendu au lieu de le changer seule.

## But

Le MJ compose un univers en « poupées russes » : une carte du monde mène à une région (forêt), qui mène à un village,
qui mène à un donjon custom, et ainsi de suite. Chaque point d'une carte mène à une destination : une autre carte ou un
donjon existant. À la table, la Présentation permet d'entrer dans un lieu et d'en ressortir.

## Contraintes qui ne bougent pas

- Le site reste **100 % statique, sans IA ni serveur, utilisable hors ligne**. Aucune IA n'est appelée par l'appli : la génération
  d'images est un outil de préparation (le skill), qui produit des fichiers ordinaires.
- Les donjons restent en **rendu procédural** (moteur actuel). Les cartes image servent au monde, aux régions et aux villages.
- Modules purs testables sous Node pour la logique (modèle, validation, navigation), comme `js/donjon.js` et `js/partie.js`.
  Tests ajoutés à la liste de `tests/node.mjs` et de `tests.html`.
- Rien de ce qui vient d'un fichier n'est interprété comme du HTML. Rien ne se perd en silence (mise de côté, voir `js/mise-de-cote.js`).

## Hors du plan pour l'instant

- **F5 – Habiller le donjon par IA** (plan procédural → image peinte) : fonctionnalité à part, plus tard.
- **F6 – Sources externes** (Dyson Logos, imports Azgaar ou Watabou) : plus tard.

## Les features et les sessions

| Feature | Session | Possède (seule à écrire dedans) |
|---|---|---|
| F2 – skill de génération de cartes | A | `.claude/skills/generer-carte/`, `outils/cartes/` |
| F1 – bibliothèque de cartes (liste, choix, import) | B | `js/bibliotheque/`, `css/bibliotheque.css`, `tests/bibliotheque*.test.js`, `outils/demo-bibliotheque.mjs` |
| F3 – univers et navigation imbriquée | C | `js/univers*.js`, `js/mj/univers-ui.js`, `js/regie-univers.js`, `css/univers.css`, `tests/univers*.test.js` |
| F4 – calage de grille sur une carte image | après C | à fixer au lancement |

Fichiers **partagés** (chacun n'y ajoute que ses lignes, au plus court, et rebase avant de pousser) : `README.md`, `tests/node.mjs`,
`tests.html`, `.gitignore`, `donjon.html`, `presentation.html`, `js/main-mj.js`, `js/regie.js`, `js/stockage.js`.

## 1. Les images : où elles vivent

Une seule liste de cartes : les images gardées par le navigateur (IndexedDB, base `carte-de-mj`, magasin `images`), que la sauvegarde
recopie dans le **dossier de travail** choisi par le MJ, sous `images/` + `images/index.json` (voir le README, « Dossier de travail »).

```
<dossier de travail>/
  images/index.json              la liste (format : section 2)
  images/foret-ruines-01.png     un fichier par carte, nommé <id>.<ext>
  generees/                      brouillons du skill, hors de la liste
  references/<style>/            images de référence de style, hors de la liste
```

- **Magasin `images`** : `{ id, nom, type (MIME), blob, largeur, hauteur, ajoute (ISO) }` plus les métadonnées de la section 2
  (titre, niveau, milieux, tags…). `localStorage` n'est pas utilisé pour les images (trop petit).
- **Une entrée ajoutée hors de l'appli** (par le skill, ou à la main dans `images/`) est importée dans IndexedDB : au démarrage,
  au retour sur l'onglet et avant chaque réécriture de `images/index.json`, l'appli relit l'index. Une entrée ajoutée hors appli n'est jamais retirée de
  l'index ; seule une suppression faite par le MJ dans l'appli en retire une.
- Le skill écrit `images/<id>.<ext>` et `images/index.json`. Il ne touche jamais à `dossier-carte-de-mj.json` ni à `donnees/`.
- **Sans dossier de travail**, la liste est celle du navigateur. Sur le site publié, rien d'autre n'existe : l'import d'images reste possible.
- **Aucune image n'est versionnée**, ni carte ni image de référence : chacun a les siennes. Les tests fabriquent leurs images
  (petits SVG ou canvas). Pour essayer l'appli sans clé d'API : `CARTE_DE_MJ_DOSSIER=… node outils/demo-bibliotheque.mjs`
  ajoute sept cartes SVG à la liste du dossier, sans écraser ce qui y est déjà.
- Extensions : `.webp`, `.png`, `.jpg` et `.svg` (`image/webp`, `image/png`, `image/jpeg`, `image/svg+xml`).
- **Ancien catalogue** : un dossier de travail qui contient encore `bibliotheque/catalogue.json` voit ses cartes importées dans la liste
  au démarrage (même `id`). Les ids migrés sont notés dans `bibliotheque/catalogue-migre.json`. Le dossier `bibliotheque/` reste ignoré par git.

### Référence d'image (le contrat entre B et C)

Partout où une carte image est désignée (univers, partie), on écrit :

```json
{ "source": "navigateur", "id": "foret-ruines-01" }
```

Jamais une URL ni un `blob:` : ils ne survivent pas à un rechargement. `{ "source": "bibliotheque", "id": … }` est **l'ancien format** :
il reste valable dans les mondes existants (lu d'abord dans les images avec le même `id`, puis dans l'ancien catalogue en secours),
mais plus aucune référence nouvelle ne l'utilise.

## 2. Format de la liste (`images/index.json`)

Un tableau JSON, écrit par l'appli avec `JSON.stringify(index, null, 1)` :

```json
[
  {
    "id": "foret-ruines-01",
    "nom": "foret-ruines-01.png", "type": "image/png",
    "largeur": 1536, "hauteur": 864,
    "ajoute": "2026-11-06T10:00:00.000Z",
    "titre": "Clairière aux ruines",
    "niveau": "zone",
    "milieux": ["foret", "ruines"],
    "tags": ["chemin", "colonnes", "sanctuaire", "fleurs", "jour"],
    "description": "Clairière traversée par un chemin, colonnes brisées, petit sanctuaire circulaire à l'est.",
    "licence": "libre",
    "credit": "",
    "grille": { "case": 48, "dx": 0, "dy": 0 },
    "origine": { "type": "generee", "outil": "gpt-image-1", "style": "peint-v2", "le": "2026-11-06" },
    "fichier": "images/foret-ruines-01.png"
  }
]
```

- `id` : minuscules, chiffres, tirets, au plus 64 caractères, unique. Le nom du fichier en dérive.
- `fichier` : `images/<id>.<ext>` (`webp`, `png`, `jpg` ou `svg`), le nom que l'appli donne elle-même à la copie. `type` : le MIME qui va avec.
- `niveau` (une valeur, pour les poupées russes) : `monde`, `region`, `zone` (lieu extérieur à l'échelle des figurines),
  `localite` (village, ville, port), `batiment` (intérieur), `souterrain`.
- `milieux` (plusieurs) : `foret`, `plaine`, `montagne`, `desert`, `eau`, `cote`, `marais`, `neige`, `ville`, `ruines`, `souterrain`.
  Les listes vivent dans un module pur unique (`js/bibliotheque/vocabulaire.js`, session B) que le skill recopie dans son prompt.
- `tags` : mots libres, en français, sans accents obligatoires (la recherche ignore accents et casse, voir `sansAccents` de `js/format.js`).
- `grille` (facultatif) : taille d'une case en pixels de l'image et décalage de la grille. Absent : carte d'ambiance, sans grille.
  Le skill écrit la grille **demandée** ; le calage (F4) la corrigera.
- `origine.type` : `generee`, `importee` ou `externe`. `licence` et `credit` : à afficher avec la carte quand `credit` n'est pas vide.
- La validation des champs descriptifs est `validerCarte` (`js/bibliotheque/catalogue.js`), la même pour l'appli et pour les scripts du skill. Un champ inconnu est ignoré.

Recherche et filtres (session B) : filtre par `niveau`, par `milieux` (cumulables), recherche texte sur `titre`, `tags`,
`description` et les noms des milieux.

## 3. Le skill de génération (F2, session A)

Rangé **dans le dépôt** (`.claude/skills/generer-carte/`) pour servir à tous : le projet est ouvert.

- `SKILL.md` : le déroulé (demande du MJ → prompt → génération → brouillon dans `generees/` → validation par le MJ → tags → ajout à `images/index.json`).
- `assets/styles-cartes/<style>.md` (sortis du skill le 6 novembre 2026 pour que la page Bibliothèque les lise aussi, panneau « Générer une carte ») :
  un fichier par style (`peint-v2` dessin animé coloré, par défaut ; `parchemin-v1` vieille carte ; `peint-v1` aquarelle), avec le bloc de style,
  les règles d'échelle (repères : une porte = 1 case, une table = 1 × 2 cases, un arbre adulte = 2 à 3 cases), un gabarit par niveau et un rappel final.
  Une nouvelle version de style = un nouveau fichier, jamais une réécriture.
- `js/bibliotheque/prompt.js` : **le seul composeur de prompt**, partagé par le skill et la page. Il déclare les styles (`STYLES`) et les formats
  (`FORMATS` : paysage 16:9 par défaut, portrait 2:3, carré, avec leurs grilles). Le format n'est plus dans le style depuis le 6 novembre 2026 :
  les deux se choisissent indépendamment. Le paysage est demandé en 3:2 et recadré au centre en 16:9 (script : `outils/cartes/png.js` ; page : à l'import).
- Les images de référence **validées par le MJ** (avec leur prompt) vont dans `references/<style>/` du dossier de travail, donc **hors de git** :
  chacun constitue les siennes, en bonne qualité. Le skill les donne au générateur comme point de départ du style et sait démarrer
  sans aucune référence (premier usage). Seules des images générées par nous y entrent, jamais celles d'un autre créateur.
- `outils/cartes/` : `generer.mjs` appelle l'API d'images et écrit un brouillon dans `generees/` ; `ajouter.mjs` copie le brouillon validé vers
  `images/<id>.<ext>` et ajoute l'entrée à `images/index.json` (logique pure dans `entree.js`, qui réutilise `validerCarte`) ; `dossier.js` lit la
  variable `CARTE_DE_MJ_DOSSIER` (chemin absolu de la racine du dossier de travail). Aucun écrasement, écriture de l'index atomique
  (relecture, fichier `.tmp`, `rename`).
- Générateur par défaut : `gpt-image-1` d'OpenAI (accepte des images de référence). La clé est lue dans la variable
  d'environnement `OPENAI_API_KEY` : **jamais écrite dans le dépôt**, chacun apporte la sienne. Le fournisseur est isolé dans un seul
  fichier pour pouvoir en changer.
- Sortie : paysage 16:9 en PNG (1536 × 864) par défaut, WebP pour les formats non recadrés, brouillon dans `generees/`, puis copie dans `images/` et entrée ajoutée à `images/index.json` à la validation du MJ.

## 4. Le modèle d'un univers (F3, session C)

Nouvelle clé `carte-de-mj:univers-v1` : `{ actif, univers: { <id>: univers } }`. Les donjons restent dans leur clé et sont désignés
par leur identifiant : un univers ne copie pas ses donjons.

```json
{
  "format": "carte-de-mj-univers", "version": 1,
  "id": "u-a1b2c3", "nom": "Les Marches du Nord", "racine": "l-monde1", "depart": "l-foret1",
  "lieux": {
    "l-monde1": {
      "id": "l-monde1", "nom": "Le continent", "type": "carte",
      "image": { "source": "bibliotheque", "id": "monde-01" },
      "notes": "",
      "points": [
        { "id": "pt-x1", "nom": "Forêt de Brume", "x": 0.42, "y": 0.31, "vers": { "lieu": "l-foret1" } },
        { "id": "pt-x2", "nom": "Crypte oubliée", "x": 0.70, "y": 0.55, "vers": { "donjon": "donjon-ab12cd", "salle": "s-x1y2z3" }, "cache": true }
      ]
    }
  }
}
```

- `racine` est **la carte du monde** : le haut de l'arbre (le premier lieu ajouté). Dans l'atelier, le monde et sa carte tiennent sur une seule
  ligne de l'arbre ; un monde sans lieu n'a pas encore de carte. `depart` (facultatif) est le **lieu où la partie commence** : sans lui, ou s'il
  désigne un lieu disparu, le départ est la racine (`lieuDeDepart(u)` dans `js/univers.js` ; les mondes d'avant ce champ se comportent donc comme
  avant). Supprimer le lieu de départ retire `depart` ; l'annuler le rétablit. La validation ignore un `depart` sans lieu, avec un avertissement.
  Renommer le monde renomme aussi sa carte tant qu'elle porte le même nom que lui.
- Un **lieu** est une carte image (`type: "carte"`). L'`image` est **facultative** : un lieu sans image (clé absente ou `null` à la relecture) est « à illustrer ».
  On conçoit d'abord le plan (lieux, points, liens, notes), et les images se posent plus tard (`definirImageLieu`, ou « Choisir une image »). Ses points
  gardent leurs fractions : l'image qui arrive les trouve à la même place relative. Sans image, pas de grille (un `grille` donné est ignoré, et retirer
  l'image l'oublie) : l'outil Calage est masqué. La scène, la régie et la table montrent un fond neutre en paysage 16:9 (parchemin doux, nom du lieu au
  centre, `js/univers-fond.js`) ; le message de la table n'a alors pas d'`image`. Une image donnée mais mal formée reste une erreur (le lieu est écarté). Un donjon n'est pas un lieu recopié : un point mène à un donjon par `vers.donjon`
  (et une salle d'arrivée facultative).
- `x`, `y` d'un point : **fractions de 0 à 1** de la largeur et de la hauteur de l'image, indépendantes de sa résolution.
- `vers` : `{ "lieu": id }` ou `{ "donjon": id, "salle"?: id }`. Une destination absente (lieu supprimé, donjon supprimé) est signalée
  comme **orpheline**, jamais retirée en silence (même règle que les liaisons orphelines du Donjon).
- `cache: true` : le point n'est pas montré aux joueurs tant que le MJ ne l'a pas révélé.
- Plusieurs points peuvent mener au même lieu. Un lieu peut n'être relié à rien (en préparation).
- Module pur `js/univers.js` (création, ajout et retrait de lieux et de points, orphelins) et `js/univers-validation.js`
  (relecture d'un fichier, bornes : 200 lieux, 100 points par lieu, noms de 80 caractères, notes de 20 000).
- Export / import d'un univers en JSON, comme un donjon. L'export ne contient pas les images : il cite leur référence.

### Préparation (page Donjon)

Un mode **Univers** dans le Donjon, à côté des donjons : choisir ou créer un univers, ajouter un lieu (image choisie par le sélecteur
de la bibliothèque, session B), poser un point d'un clic sur l'image, lui donner un nom et une destination (« Nouveau lieu »,
« Lieu existant », « Donjon existant »), entrer dans la destination, remonter par un fil d'Ariane.

### À la table (page Présentation)

- L'écran de départ propose aussi les univers. Une **partie d'univers** est rangée dans `carte-de-mj:univers-parties-v1` :
  `{ lieuCourant, chemin: [idLieu], decouverts: [idLieu], reveles: { idLieu: [idPoint] } }`.
- Sur une carte, la régie voit tous les points ; la table ne voit que les points visibles ou révélés, sans leur nom si le MJ le veut.
- Entrer dans un point qui mène à un donjon ouvre (ou reprend) la **partie de ce donjon** telle qu'elle existe aujourd'hui,
  avec le fil d'Ariane de l'univers au-dessus et un bouton « Remonter » qui revient à la carte d'où l'on vient.
  Les parties de donjon ne changent pas de format.
- La vue table (`?vue=table`) montre la carte image en grand ; le message de la table porte la référence d'image, pas l'image.

## 5. Interface entre B et C

La session B fournit, dans `js/bibliotheque/index.js` :

```js
/** Ouvre le choix d'une carte (une seule liste + import). Résout la référence choisie, ou null si annulé. */
export async function choisirCarte(options = { niveau: undefined }) {}
/** URL affichable d'une référence d'image (objectURL d'IndexedDB), ou null si elle n'existe plus. */
export async function urlImage(ref) {}
/** Les métadonnées d'une référence (titre, niveau, milieux, largeur, hauteur, grille, crédit), ou null. */
export async function infosImage(ref) {}
```

La session C n'importe que ces trois fonctions. Tant que B n'a pas poussé, C commence par ce qui n'en dépend pas (modèle, validation,
stockage, navigation) puis branche le sélecteur après rebase.

## 6. Calage de grille (F4, après C)

Sur une carte image, le MJ superpose la grille et l'ajuste (taille de case, décalage) sur une porte ou un pilier. Le résultat est
enregistré sur le lieu de l'univers (`grille` du lieu, qui prime sur celle du catalogue). Il permettra ensuite de poser des pions
sur une carte image.

Réalisé (F4) : `lieu.grille = { case, dx, dy }` en pixels de l'image ; `null` = « pas de grille » même si le catalogue en propose une ; clé absente =
grille du catalogue, sinon carte d'ambiance. Le message de la table porte la grille effective (trois nombres). À la table, en échelle réelle,
une case de la carte mesure la case calibrée ; sinon la carte tient dans l'écran. Code : `js/univers-grille.js` (pur), `js/mj/univers-calage.js`.
