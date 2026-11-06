# Design des panneaux

Règles de composition des panneaux latéraux : l'arbre (gauche), l'inspecteur (droite) dans Monde et Donjons, les onglets de la régie dans Jouer, et le panneau bas du téléphone. **Tout panneau créé ou modifié suit ce document.** Les boutons, icônes et aides suivent le SYSTÈME VISUEL en tête de `css/base.css`, que ce document complète.

Maquettes avant/après et diagnostic détaillé : [`docs/maquettes/panneaux.html`](maquettes/panneaux.html) (ouvrir dans le navigateur).

Proposé le 6 novembre 2026. **État : en cours de migration** (voir « Migration » en bas). Les jetons `--p-*` sont dans `css/base.css` ; la typographie des panneaux est le dernier bloc de `css/atelier.css`.

## Pourquoi

Avant ces règles, les panneaux étaient difficiles à lire : trois rôles (type de l'objet, titre de section, groupe de l'arbre) avaient le même style « petit gris en majuscules » ; les étiquettes de champ (15px gras clair) criaient plus fort que les titres de section (12px gris) ; les sections n'étaient séparées que par du vide ; un seul gris servait à sept usages ; les listes étaient des boutons en vrac ; quatre bords gauches dans un même panneau ; sept tailles de texte en 330px ; quatre manières de replier.

## Les huit règles

1. **Les majuscules ne servent qu'au type de l'objet** (en or, dans l'en-tête) et aux groupes de l'arbre. Les titres de section sont en casse normale, clairs et gras.
2. **Une étiquette est toujours plus discrète que ce qu'elle nomme** : étiquette en T3, valeur en T1.
3. **Un titre de section est plus fort que tout ce qu'il contient**, sauf les noms d'éléments, au même niveau de couleur mais en graisse moyenne.
4. **Un seul bord gauche** : tout le corps s'aligne à 16px (texte, champs, boutons, icônes). Pas de bouton centré, pas de marge interne de `.btn-discret` qui décale.
5. **Une liste est une liste** : des rangées de même hauteur, en creux, nom à gauche, position à droite, détail dessous et tronqué. Jamais de boutons en vrac ni de texte qui passe à la ligne sous un bouton.
6. **Un seul geste pour replier** : le bandeau de section. L'aide est un « ? » dans le bandeau, jamais une ligne « ▸ Comment… ? » dans le corps.
7. **Un seul primaire doré par panneau**, et la sélection a le même aspect dans l'arbre et dans les listes (`--p-choisi`, texte or).
8. **Le rare d'abord replié** (JSON, exemples, réglages d'écran). Une section repliée montre son compteur.

## Jetons

Dans `:root` de `css/base.css`. Les jetons existants (`--panneau`, `--bord`, `--champ`, `--accent`, `--esp-1` à `--esp-4`…) restent.

| Jeton | Valeur | Rôle | Contraste sur le panneau |
|---|---|---|---|
| `--p-texte-1` | `#ece8e0` | nom, titres de section, noms d'éléments, valeurs saisies | 13,5 |
| `--p-texte-2` | `#c3beb4` | texte courant, éléments secondaires, section repliée | 8,9 |
| `--p-texte-3` | `#97928a` | étiquettes, notes, méta, destinations | 5,4 (4,9 en liste) |
| `--p-texte-4` | `#67635d` | placeholders, groupes de l'arbre, chevrons. Jamais seul porteur d'une information | 2,8 |
| `--p-surface-0` | `#1f1e24` | fond du panneau (= `--panneau`) | |
| `--p-surface-1` | `#26252c` | listes en creux, pastilles, compteurs | |
| `--p-surface-survol` | `#2d2c34` | survol d'une rangée | |
| `--p-filet` | `#2f2d35` | séparateur entre sections | |
| `--p-filet-fort` | `#3d3a44` | sous l'en-tête, sous les onglets, contour des boutons de section | |
| `--p-choisi` | `rgba(217, 169, 41, 0.13)` | fond de l'élément choisi (arbre, listes) | |

Ne pas réintroduire `--texte-doux` dans un panneau : c'est T3 (ou T2 si le texte doit se lire).

## Typographie

Quatre tailles dans le corps d'un panneau, plus le nom de l'en-tête. Pas d'autre taille.

| Rôle | Taille / graisse | Couleur | Exemple |
|---|---|---|---|
| Nom (en-tête) | 18px / 650 | T1 | Ruines oubliées dans la forêt |
| Titre de section | 13px / 650, casse normale | T1 | Points |
| Nom d'élément | 14px / 500 | T1 | Entrée du Repère de gobelins |
| Corps, valeurs | 14px / 400 | T2 (valeur saisie : T1) | |
| Étiquette, note, méta | 12,5px / 400–500 | T3 | Notes du MJ · vers Repaire gobelin |
| Type de l'objet | 11px / 600, MAJUSCULES, interlettrage .09em | `--accent` | LIEU |
| Groupe de l'arbre | 11px / 600, MAJUSCULES | T4 | DONJONS HORS MONDE |
| Compteur, position | 11,5–12px, chiffres tabulaires | T3 / T4 | 2 · D4 |

Un élément sans nom (« Point sans nom ») est en italique T3 : c'est une absence, pas un nom.

## Espacements

- Marge horizontale du panneau : 16px (`--esp-4`).
- Entre éléments d'une section : 12px (`--esp-3`).
- Étiquette → champ : 5px.
- Bandeau de section : 40px de haut minimum (44px sous 760px, `--cible`).
- Un filet `--p-filet` sur toute la largeur entre deux sections ; pas de gap seul.

## Composants

### En-tête

Collé en haut (`.atelier-inspecteur-tete`, déjà en place). Dans l'ordre : type (icône + mot, or, majuscules), nom (modifiable sur place), une ligne de méta en T3 (taille, nombre d'éléments, état). À droite, le seul bouton « ⋯ ». Filet `--p-filet-fort` dessous. Rien d'autre dans l'en-tête.

### Section

Remplace `.insp-section`, `.bloc-inspecteur`, `.retour`, `.cette-salle`, `.bloc-notes`, `details.reglages`, `.aide-bloc`.

```
[chevron] Titre de section  (compteur)        [?] [+]
  corps, en retrait de 16px, éléments espacés de 12px
──────────────────────────────────────────────── filet
```

- Le bandeau entier ouvre et ferme (un `<details>`/`<summary>` ou un bouton `aria-expanded`). Repliée, seule la ligne reste, titre en T2.
- L'état replié est gardé en session, par type de panneau et par section (comme les plis de l'arbre).
- Compteur : pastille `--p-surface-1`, T3. Aide : bouton icône `aide` qui déplie un `.aide-texte` sous le bandeau. Action : au plus une, en bouton icône (`plus`), avec `aria-label`.
- Une section sans titre n'existe pas : si un contenu n'a pas de nom, il va dans la section voisine.

### Champ

Étiquette T3 12,5px au-dessus, champ `--champ` dessous, valeur en T1 14px. Remplace `.champ-inspecteur`, `.outil-etiquette` et les `<label>` en 15px gras. Une note d'aide sur le champ va **en dessous**, en T3, une ou deux lignes.

### Propriétés

Plusieurs réglages courts (Sol, Ambiance, État, Éclairage, Rotation…) : grille à deux colonnes, étiquette 92px en T3 à gauche, menu à droite, tous de la même largeur. Remplace `label.ligne`. Un choix parmi beaucoup (les 12 formes de salle) devient un menu, pas une rangée de boutons.

### Liste

Points d'un lieu, éléments d'une salle, personnages : un bloc `--p-surface-1` arrondi (8px, marge interne 4px) contenant des rangées.

- Rangée : grille `icône 18px · nom · position`, marge interne 7px 8px. Sous-ligne facultative en T3 12,5px, tronquée par une ellipse (jamais de retour à la ligne).
- Nom en T1 14px/500 ; position (case D4) en T4 police à chasse fixe, à droite.
- Survol `--p-surface-survol` ; choisie `--p-choisi` avec nom et icône en or.
- Les objets identiques se regroupent : « pilier × 4 », positions à la suite.
- Variante compacte (marge 5px, nom en T2/400) pour les longues listes de jeu.

### Interrupteur

Oui/non : interrupteur (`role="switch"`) puis le libellé en T1, aligné sur le bord du corps. Remplace les cases à cocher nues.

### Boutons dans un panneau

- Rangée de boutons alignée à gauche, espacée de 8px. Boutons à filet `--p-filet-fort`, 32px de haut (44px sous 760px).
- Un seul `.btn-primaire` par panneau.
- Une action secondaire dans un texte (Effacer, Copier pour signaler) : lien d'action en T3, **sans marge interne**, pour rester sur le bord gauche.
- Un bouton désactivé qui n'a jamais de raison de s'activer dans ce contexte (« Révéler toute la salle » quand rien n'est caché) disparaît ; l'état est dit dans la méta de l'en-tête.

### Onglets (Jouer)

Texte 13,5px/600 en T3, l'onglet actif en T1 souligné de 2px d'or. Pas de fond doré : l'or est réservé à la sélection et au bouton principal. Chaque onglet a ensuite un en-tête et des sections comme un inspecteur.

### Arbre

- Groupes (« Mondes », « Donjons hors monde ») : intertitres T4 en majuscules, sans chevron ni icône.
- Monde et donjon (parents) : 14px/600 T1. Lieux et salles : 14px/400 T2. Icône en T3.
- Retrait de 20px par niveau, chevron T4.
- Sélection : fond `--p-choisi`, texte et icône en or, pas de contour.
- La pastille « à la table » reste à droite.

### Textes d'aide

Une aide qui concerne la scène (« Clique une porte sur la carte pour créer la salle suivante ») ne va pas dans le panneau : barre d'outils de la scène ou « ? » de la section. Une note dans le corps tient en deux lignes au plus.

## Téléphone (sous 760 px)

Même grammaire dans le panneau bas. Replié, il ne montre que l'en-tête. Cibles de 44px : bandeaux de section, rangées de liste, boutons.

## Migration

À faire dans l'ordre ; cocher ici à chaque étape livrée.

- [x] **1. Jetons et typographie** : ajouter les `--p-*` dans `css/base.css`, réécrire la typographie de `.atelier-inspecteur` et `.atelier-arbre` dans `css/atelier.css` (règles 1, 2, 4). CSS seul.
- [ ] **2. Composant section** : `creerSection({ cle, titre, compte, aide, action, repliee, enfants })` dans `js/atelier/section.js` (fait, testé : `tests/section.test.js`), état replié en session. Adoptée par les inspecteurs Monde, Lieu, Point, Donjon, Salle.
- [ ] **3. Listes** : composant rangée pour les points, les éléments de Jouer et les personnages.
- [ ] **4. Jouer** : les onglets de la régie au même modèle (en-tête, sections), onglets soulignés.
- [ ] **5. Téléphone** : vérifier le panneau bas avec la nouvelle grammaire.

| Panneau | Code | Suit ce document |
|---|---|---|
| Arbre | `js/atelier/arbre-vue.js` | oui (CSS) |
| Inspecteur Monde, Lieu, Point | `js/atelier/inspecteurs-monde.js` | typographie, sections (listes : non) |
| Inspecteur Calage | univers (calage) | non |
| Inspecteur Donjon, Salle | `js/atelier/inspecteurs-donjon.js`, `js/mj/salle-forme.js` | non |
| Porte, Objet, Créature | `js/mj/bulle.js` | non |
| Jouer · Salle, Joueurs, Table | régie (`js/main-presentation.js` et voisins) | non |
