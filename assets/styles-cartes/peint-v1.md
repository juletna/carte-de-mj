# Style « peint-v1 » : aquarelle peinte

Premier style des cartes générées (style par défaut jusqu'au 6 novembre 2026, remplacé par `peint-v2.md`, toujours proposé).
Ne pas le réécrire pour un cas particulier : une évolution du style est un nouveau fichier.
`js/bibliotheque/prompt.js` en extrait les sections par leurs titres (`## Bloc de style`, `## Échelle`, `## Gabarit : <monde|lieu|plateau-sous-type>`) ;
garder ces titres tels quels. Dans un gabarit, `{scene}` reçoit la scène et `{cases}` la taille en cases.
Le 6 novembre 2026, le format (autrefois une section `## Format` ici, portrait 1024 × 1536) est sorti du style : il se choisit
à part (`FORMATS` dans `js/bibliotheque/prompt.js`), et les gabarits ont reçu `{cases}` au lieu d'un nombre de cases écrit en dur.
Le 7 novembre 2026, le style ne dit plus rien de la vue (autrefois « strictement de dessus, sans angle isométrique, sans horizon ») :
la vue est imposée par le zoom et écrite dans `VUES` de `js/bibliotheque/prompt.js`. Les gabarits passent de six niveaux à cinq :
`monde`, `lieu`, `plateau-exterieur`, `plateau-interieur`, `plateau-souterrain`. L'échelle (cases de 1,5 m) ne s'applique qu'au plateau.

## Bloc de style

Hand-painted fantasy map for a tabletop role-playing game, in watercolor and gouache with fine ink linework,
rich natural colors, soft paper texture, gentle painted shadows.
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
Do NOT draw any grid lines, numbers or coordinates in the picture: the grid is added later.

## Gabarit : monde

Map of a whole fantasy world, continent, country or archipelago, as an illustrated atlas: coastlines, oceans, mountain ranges,
forests, rivers, plains, deserts. Mountains and forests are drawn as small painted landforms. No grid, no scale in squares.
No city names, no text. Scene: {scene}

## Gabarit : lieu

Painted map of a place to explore (a desert, a forest, a valley, an island, a village seen as a whole), a few hours to a few days of travel across:
forests, hills, rivers, roads, buildings, ruins and landmarks as small recognizable painted illustrations, each important place large enough to be clearly recognized.
No grid, no scale in squares. Scene: {scene}

## Gabarit : plateau-exterieur

Battle map of an outdoor place at figurine scale, {cases} (each square is 1.5 m):
individual trees, bushes, rocks, paths 2 squares wide, water, statues, walls and ruins drawn at true size. Walkable ground clearly distinct from obstacles. Scene: {scene}

## Gabarit : plateau-interieur

Interior battle map of a building at figurine scale, {cases} (each square is 1.5 m), with the roof removed:
walls with thickness, doors 1 square wide, floors with visible material (planks, tiles, flagstones), furniture at true size. Scene: {scene}

## Gabarit : plateau-souterrain

Dungeon, cave or crypt battle map at figurine scale, {cases} (each square is 1.5 m):
thick stone walls, corridors 2 squares wide, rooms of 6 to 10 squares, doors 1 square wide, stairs, pillars, rubble, water, with the
rock outside the rooms painted dark. Scene: {scene}
