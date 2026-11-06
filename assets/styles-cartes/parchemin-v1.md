# Style « parchemin-v1 » : vieille carte sur parchemin

Bloc de style des cartes à l'allure de carte ancienne, ajouté le 6 novembre 2026. Ne pas le réécrire pour un cas particulier :
une évolution est un nouveau fichier (`parchemin-v2.md`), à déclarer dans `STYLES` de `js/bibliotheque/prompt.js`.
Mêmes sections et mêmes règles que `peint-v2.md` (titres, `{scene}`, `{cases}`, format choisi à part). Seuls le bloc de style
et les teintes des gabarits changent. Pas de texte non plus : un nom calligraphié se rajoute dans l'appli s'il le faut.
Le 7 novembre 2026, le style ne dit plus rien de la vue (autrefois « strictement de dessus, sans angle isométrique, sans horizon ») :
la vue est imposée par le zoom et écrite dans `VUES` de `js/bibliotheque/prompt.js`. Les gabarits passent de six niveaux à cinq :
`monde`, `lieu`, `plateau-exterieur`, `plateau-interieur`, `plateau-souterrain`. L'échelle (cases de 1,5 m) ne s'applique qu'au plateau.

## Bloc de style

Fantasy map for a tabletop role-playing game drawn as an old explorer's map on aged parchment: warm cream and tan paper with soft stains,
sepia and dark brown ink linework, fine hatching for relief and coastlines, light faded watercolor washes (pale green, pale blue, ochre).
Charming and readable, never dark or gloomy, never torn or burnt.
The parchment fills the whole canvas, edge to edge: no frame, no decorative border, no torn edges, no table or background around it.
No text of any kind: no letters, no labels, no titles, no banners, no cartouche, no scrolls with names, no signature, no logo, no watermark,
no legend, no compass rose, no scale bar.
No characters, no people, no creatures, no sea monsters, no figurines, no tokens.
Clear readable shapes, good contrast between walkable ground and obstacles.

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

Map of a whole fantasy world, continent, country or archipelago, as an antique atlas page: inked coastlines with
ripple lines in the sea, mountain ranges as small hatched peaks, forests as clusters of little inked trees, rivers, plains, deserts.
Towns are small inked symbols. No grid, no scale in squares. Scene: {scene}

## Gabarit : lieu

Map of a place to explore (a desert, a forest, a valley, an island, a village seen as a whole), a few hours to a few days of travel across, as an old surveyor's map:
inked forests, hatched hills, rivers, dotted roads, buildings as small inked roofs, ruins and landmarks as small recognizable symbols, each important place large enough to be clearly recognized.
No grid, no scale in squares. Scene: {scene}

## Gabarit : plateau-exterieur

Battle map of an outdoor place at figurine scale, {cases} (each square is 1.5 m), inked on parchment:
individual trees, bushes, rocks, paths 2 squares wide, water, statues, walls and ruins drawn at true size. Walkable ground clearly distinct from obstacles. Scene: {scene}

## Gabarit : plateau-interieur

Interior battle map of a building at figurine scale, {cases} (each square is 1.5 m), with the roof removed,
as an architect's old plan with light washes: walls with thickness, doors 1 square wide, floors with visible material, furniture at true size. Scene: {scene}

## Gabarit : plateau-souterrain

Dungeon, cave or crypt battle map at figurine scale, {cases} (each square is 1.5 m), as an old adventurer's plan:
thick inked walls with hatching outside, corridors 2 squares wide, rooms of 6 to 10 squares, doors 1 square wide, stairs, pillars, rubble, water. Scene: {scene}

## Rappel final

Place names in the scene only tell you what is where: never write them on the picture.
Final check before drawing: absolutely no text, no letters, no labels, no banners, no cartouche anywhere.
