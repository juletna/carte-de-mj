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
| F1 – bibliothèque de cartes (catalogue, choix, import) | B | `js/bibliotheque/`, `css/bibliotheque.css`, `tests/bibliotheque*.test.js`, `outils/demo-bibliotheque.mjs` |
| F3 – univers et navigation imbriquée | C | `js/univers*.js`, `js/mj/univers-ui.js`, `js/regie-univers.js`, `css/univers.css`, `tests/univers*.test.js` |
| F4 – calage de grille sur une carte image | après C | à fixer au lancement |

Fichiers **partagés** (chacun n'y ajoute que ses lignes, au plus court, et rebase avant de pousser) : `README.md`, `tests/node.mjs`,
`tests.html`, `.gitignore`, `donjon.html`, `presentation.html`, `js/main-mj.js`, `js/regie.js`, `js/stockage.js`.

## 1. Les images : où elles vivent (prototype)

Deux origines, deux rangements, une seule façon de les désigner.

### Bibliothèque locale (images générées par le skill)

Un dossier à la racine du projet, **ignoré par git** : `bibliotheque/`.

```
bibliotheque/
  catalogue.json
  cartes/foret-ruines-01.webp
  cartes/port-01.webp
```

- Le serveur local (`python3 outils/serveur.py`) le sert comme le reste : l'appli lit `bibliotheque/catalogue.json` par `fetch`.
  Absent ou illisible : la bibliothèque est simplement vide, avec un message qui dit comment la remplir (le skill).
- Le skill (session A) est **le seul à écrire** dans ce dossier. L'appli ne fait que lire.
- Sur le site publié (GitHub Pages), le dossier n'existe pas : la bibliothèque est vide, l'import d'images reste possible.
- **Aucune image n'est versionnée**, ni carte ni image de référence : chacun a les siennes, de bonne qualité, sur son disque.
  Les tests fabriquent leurs images (petits SVG ou canvas écrits dans le test). Pour essayer l'appli sans clé d'API,
  `node outils/demo-bibliotheque.mjs` (session B) remplit `bibliotheque/` de quelques cartes de démonstration dessinées en SVG,
  sans écraser ce qui y est déjà.
- `fichier` accepte `.webp`, `.png`, `.jpg`, `.jpeg` et `.svg`.

### Images importées par le MJ (dans le navigateur)

IndexedDB, base `carte-de-mj`, magasin `images` : `{ id, nom, type (MIME), blob, largeur, hauteur, ajoute (ISO) }`.
`localStorage` n'est pas utilisé pour les images (trop petit). Une image importée accepte les mêmes métadonnées qu'une carte
du catalogue (titre, niveau, milieux, tags), rangées à côté du blob.

### Référence d'image (le contrat entre B et C)

Partout où une carte image est désignée (univers, partie), on écrit :

```json
{ "source": "bibliotheque", "id": "foret-ruines-01" }
{ "source": "navigateur",   "id": "img-k3j9x2" }
```

Jamais une URL ni un `blob:` : ils ne survivent pas à un rechargement.

## 2. Format du catalogue (`bibliotheque/catalogue.json`)

```json
{
  "format": "carte-de-mj-bibliotheque", "version": 1,
  "cartes": [
    {
      "id": "foret-ruines-01",
      "titre": "Clairière aux ruines",
      "fichier": "cartes/foret-ruines-01.webp",
      "largeur": 1400, "hauteur": 2100,
      "niveau": "zone",
      "milieux": ["foret", "ruines"],
      "tags": ["chemin", "colonnes", "sanctuaire", "fleurs", "jour"],
      "description": "Clairière traversée par un chemin, colonnes brisées, petit sanctuaire circulaire à l'est.",
      "grille": { "case": 70, "dx": 0, "dy": 0 },
      "origine": { "type": "generee", "outil": "gpt-image-1", "style": "peint-v1", "le": "2026-11-06" },
      "licence": "libre",
      "credit": ""
    }
  ]
}
```

- `id` : minuscules, chiffres, tirets, au plus 64 caractères, unique. Le nom du fichier en dérive.
- `niveau` (une valeur, pour les poupées russes) : `monde`, `region`, `zone` (lieu extérieur à l'échelle des figurines),
  `localite` (village, ville, port), `batiment` (intérieur), `souterrain`.
- `milieux` (plusieurs) : `foret`, `plaine`, `montagne`, `desert`, `eau`, `cote`, `marais`, `neige`, `ville`, `ruines`, `souterrain`.
  Les listes vivent dans un module pur unique (`js/bibliotheque/vocabulaire.js`, session B) que le skill recopie dans son prompt.
- `tags` : mots libres, en français, sans accents obligatoires (la recherche ignore accents et casse, voir `sansAccents` de `js/format.js`).
- `grille` (facultatif) : taille d'une case en pixels de l'image et décalage de la grille. Absent : carte d'ambiance, sans grille.
  Le skill écrit la grille **demandée** ; le calage (F4) la corrigera.
- `origine.type` : `generee`, `importee` ou `externe`. `licence` et `credit` : à afficher avec la carte quand `credit` n'est pas vide.
- La validation (`validerCatalogue`) écarte une entrée invalide en le disant, sans refuser tout le catalogue. Un champ inconnu est ignoré.

Recherche et filtres (session B) : filtre par `niveau`, par `milieux` (cumulables), recherche texte sur `titre`, `tags`,
`description` et les noms des milieux.

## 3. Le skill de génération (F2, session A)

Rangé **dans le dépôt** (`.claude/skills/generer-carte/`) pour servir à tous : le projet est ouvert.

- `SKILL.md` : le déroulé (demande du MJ → prompt → génération → validation par le MJ → tags → ajout au catalogue).
- `style/peint-v1.md` : le bloc de style fixe et les règles d'échelle (taille d'image, nombre de cases, repères : une porte = 1 case,
  une table = 1 × 2 cases, un arbre adulte = 2 à 3 cases). Une nouvelle version de style = un nouveau fichier, jamais une réécriture.
- Les images de référence **validées par le MJ** (avec leur prompt) vont dans `bibliotheque/references/<style>/`, donc **hors de git** :
  chacun constitue les siennes, en bonne qualité. Le skill les donne au générateur comme point de départ du style et sait démarrer
  sans aucune référence (premier usage). Seules des images générées par nous y entrent, jamais celles d'un autre créateur.
- `outils/cartes/` : le script qui appelle l'API d'images et le script qui ajoute une entrée valide au catalogue (même validation que l'appli,
  en important le module pur de la session B, ou en recopiant ses règles s'il n'existe pas encore).
- Générateur par défaut : `gpt-image-1` d'OpenAI (accepte des images de référence). La clé est lue dans la variable
  d'environnement `OPENAI_API_KEY` : **jamais écrite dans le dépôt**, chacun apporte la sienne. Le fournisseur est isolé dans un seul
  fichier pour pouvoir en changer.
- Sortie : WebP, portrait 2:3 par défaut, dans `bibliotheque/cartes/`, entrée ajoutée à `bibliotheque/catalogue.json`.

## 4. Le modèle d'un univers (F3, session C)

Nouvelle clé `carte-de-mj:univers-v1` : `{ actif, univers: { <id>: univers } }`. Les donjons restent dans leur clé et sont désignés
par leur identifiant : un univers ne copie pas ses donjons.

```json
{
  "format": "carte-de-mj-univers", "version": 1,
  "id": "u-a1b2c3", "nom": "Les Marches du Nord", "racine": "l-monde1",
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

- Un **lieu** est une carte image (`type: "carte"`). Un donjon n'est pas un lieu recopié : un point mène à un donjon par `vers.donjon`
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
/** Ouvre le choix d'une carte (catalogue + images du navigateur + import). Résout la référence choisie, ou null si annulé. */
export async function choisirCarte(options = { niveau: undefined }) {}
/** URL affichable d'une référence d'image (fichier du catalogue ou objectURL d'IndexedDB), ou null si elle n'existe plus. */
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
