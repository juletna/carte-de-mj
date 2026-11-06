# Style « peint-v1 »

Bloc de style fixe des cartes générées. Ne pas le réécrire : une évolution du style est un nouveau fichier (`peint-v2.md`).
`outils/cartes/generer.mjs` lit ce fichier : il en extrait les sections par leurs titres (`## Bloc de style`, `## Échelle`,
`## Format`, `## Gabarit : <niveau>`). Garder ces titres tels quels.

## Bloc de style

Hand-painted fantasy map for a tabletop role-playing game, in watercolor and gouache with fine ink linework,
rich natural colors, soft paper texture, gentle painted shadows.
Strictly top-down orthographic view, looking straight down: no perspective, no tilt, no isometric angle, no horizon, no sky.
The whole canvas is map, edge to edge, with no frame, no border, no margin, no parchment edge.
No text of any kind: no letters, no labels, no titles, no signature, no logo, no watermark, no legend, no compass rose, no scale bar.
No characters, no people, no creatures, no figurines, no tokens.
Clear readable shapes, good contrast between walkable ground and obstacles, lit evenly from the upper left.

## Échelle

Use a consistent real-world scale so that a figurine on a 1-inch square fits. One grid square is 1.5 meters (5 feet).
Concrete size references to respect inside the picture:
- a door or a gate opening: 1 square wide;
- a human-sized chair or a barrel: a third of a square to one square;
- a table: 1 by 2 squares; a bed: 1 by 2 squares; a large table or a counter: 1 by 3 squares;
- a wagon: 2 by 4 squares; a small boat: 2 by 5 squares;
- an adult tree: 2 to 3 squares across its canopy; a bush: 1 square; a boulder: 1 to 2 squares;
- a road or path: 2 squares wide; a small house: 6 by 8 squares; a tavern or a manor: 10 by 14 squares;
- a corridor: 2 squares wide; a standard room: 6 to 10 squares on a side.
When the level has a grid, do NOT draw any grid lines, numbers or coordinates in the picture: the grid is added later.

## Format

Image de 1024 × 1536 pixels (portrait 2:3), le plus grand format que `gpt-image-1` accepte en portrait.
Les cartes `monde` et `region` n'ont pas de grille : pas de nombre de cases.
Pour les autres niveaux, le nombre de cases visibles sur la largeur × la hauteur donne la grille demandée
(`grille.case` = 1024 divisé par le nombre de cases en largeur).

| Niveau | Grille demandée | Case en pixels |
|---|---|---|
| monde | aucune | |
| region | aucune | |
| zone | 20 × 30 cases | 51,2 |
| localite | 24 × 36 cases | 42,67 |
| batiment | 16 × 24 cases | 64 |
| souterrain | 20 × 30 cases | 51,2 |

## Gabarit : monde

Map of a whole fantasy world or continent seen from very high above, as an illustrated atlas: coastlines, oceans, mountain ranges,
forests, rivers, plains, deserts. No grid, no scale in squares. Mountains and forests are drawn as small painted symbols.
No cities names, no text. Scene: {scene}

## Gabarit : region

Map of a region (a few days of travel across), seen from high above: forests, hills, rivers, roads, a few villages as small clusters
of roofs, ruins and landmarks as small recognizable painted symbols. No grid, no scale in squares. Scene: {scene}

## Gabarit : zone

Battle map of an outdoor place at figurine scale, about 20 squares wide and 30 squares tall (each square is 1.5 m), seen from directly above:
individual trees, rocks, paths, water, walls and ruins drawn at true size. Walkable ground clearly distinct from obstacles. Scene: {scene}

## Gabarit : localite

Map of a village, town or port at street scale, about 24 squares wide and 36 squares tall (each square is 1.5 m), seen from directly above:
roofs of buildings with their real footprint, streets 2 squares wide, squares, wells, fences, gardens, quays. Scene: {scene}

## Gabarit : batiment

Interior floor plan of a building at figurine scale, about 16 squares wide and 24 squares tall (each square is 1.5 m), seen from directly above
with the roof removed: walls with thickness, doors 1 square wide, floors with visible material (planks, tiles, flagstones), furniture at true size. Scene: {scene}

## Gabarit : souterrain

Dungeon, cave or crypt map at figurine scale, about 20 squares wide and 30 squares tall (each square is 1.5 m), seen from directly above:
thick stone walls, corridors 2 squares wide, rooms of 6 to 10 squares, doors 1 square wide, stairs, pillars, rubble, water, with the
rock outside the rooms painted dark. Scene: {scene}
