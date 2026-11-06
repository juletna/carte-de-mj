# Versions des fichiers (anti-cache)

## Le problème

GitHub Pages sert chaque fichier avec `Cache-Control: max-age=600`. Après un déploiement, un navigateur peut donc garder pendant dix minutes un ancien `js/icones.js` à côté d'un nouveau `js/atelier/champ-multi.js` : un mélange de versions qui casse l'interface (par exemple `icone('nom inconnu')` lève une erreur).

## Le principe

Chaque fichier JS et CSS est demandé sous une adresse qui change quand son contenu change : `js/icones.js?v=371257ed` (8 caractères de SHA-1 du contenu du fichier, et de lui seul). Sans bundler :

- chaque page racine (`index.html`, `donjon.html`, `presentation.html`, `bibliotheque.html`, `fiche.html`, `impression.html`) porte dans son `<head>` un bloc `<!-- versions:debut … --> … <!-- versions:fin -->` : une **import map** qui remappe chaque module atteignable depuis ses scripts (`"./js/x.js": "./js/x.js?v=HASH"`), une entrée par ligne, triées ;
- les adresses d'entrée de la page (`<script type="module" src>`, `<link rel="stylesheet" href>`) portent le même `?v=HASH`, pour qu'un module ne soit jamais chargé sous deux adresses ;
- les modules s'importent entre eux sans `?v=` : c'est l'import map, hors des fichiers, qui ajoute la version. Changer une dépendance change donc son adresse sans changer celle de ceux qui l'importent.

`tests.html` (outil de développement) n'est pas versionnée.

## La commande

```bash
node outils/versions.mjs             # écrit les 6 pages
node outils/versions.mjs --verifier  # n'écrit rien, sort en erreur si une page n'est pas à jour
```

**À lancer après toute modification d'un fichier de `js/` ou `css/`, avant de commiter.** L'outil est idempotent : relancé sans changement, il ne modifie rien. Il suit les `import … from`, `export … from`, `import '…'` et `import('…')` à argument littéral ; si un `import()` a un argument non littéral dans le graphe d'une page, il met tous les `js/**/*.js` dans l'import map de cette page.

## Ce que fait le test

`tests/versions.test.js` (lancé par `node tests/node.mjs`) échoue avec « Fichiers modifiés sans mise à jour des versions : lance `node outils/versions.mjs` » quand une page n'est pas à jour. Il vérifie aussi que chaque adresse de l'import map pointe un fichier existant, que les adresses d'entrée portent le même hash que l'import map, et que deux calculs successifs donnent le même texte. Dans `tests.html` (pas de système de fichiers), la suite se réduit à une ligne.

## Limites

- Les pages HTML elles-mêmes restent en cache dix minutes : pendant ce temps, un navigateur peut servir l'ancienne page, avec les anciennes adresses (cohérentes entre elles, donc sans mélange).
- Un navigateur sans import map l'ignore et se comporte comme avant (adresses sans version, cache de dix minutes).
- `js/dossier-travail.js` charge `css/dossier.css` par `new URL(…, import.meta.url)` : cette feuille n'est pas versionnée.
- **Conflits git** : deux sessions qui modifient des fichiers en parallèle touchent le même bloc. Après un rebase ou une fusion en conflit sur un bloc `versions:debut … versions:fin` (ou sur un `?v=`), prendre n'importe quel côté puis relancer `node outils/versions.mjs` : il réécrit tout le bloc.
