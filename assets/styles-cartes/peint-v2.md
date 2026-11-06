# Style « peint-v2 » : dessin animé coloré

Bloc de style des cartes générées, style par défaut depuis le 6 novembre 2026. Ne pas le réécrire pour un cas particulier : une évolution
du style est un nouveau fichier (`peint-v3.md`), à déclarer dans `STYLES` de `js/bibliotheque/prompt.js`.
`js/bibliotheque/prompt.js` en extrait les sections par leurs titres (`## Bloc de style`, `## Échelle`, `## Gabarit : <niveau>`,
`## Rappel final`) ; garder ces titres tels quels. Dans un gabarit, `{scene}` reçoit la scène et `{cases}` la taille en cases.
Le format de l'image (paysage 16:9, portrait, carré) et la grille ne sont pas ici : ils sont choisis à part (`FORMATS`).

Par rapport à peint-v1 : couleurs franches de dessin animé au lieu de l'aquarelle aux tons naturels, et un rappel final qui répète
les interdits (texte, vue de biais) en fin de prompt, là où un générateur les respecte le mieux.

## Bloc de style

Hand-painted fantasy map for a tabletop role-playing game, in a bright and cheerful animated-film illustration style:
clean ink outlines, clear saturated colors, flat cel shading in two or three tones, lots of small crisp details.
Never realistic, never dark or gloomy, no photographic texture.
Strictly top-down orthographic view, looking straight down: no perspective, no tilt, no isometric angle, no horizon, no sky, no clouds framing the picture.
The whole canvas is map, edge to edge, with no frame, no border, no margin, no parchment edge.
No text of any kind: no letters, no labels, no titles, no banners, no scrolls with names, no signature, no logo, no watermark, no legend, no compass rose, no scale bar.
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

## Gabarit : monde

Map of a whole fantasy world, continent or archipelago seen from very high above, as an illustrated atlas: coastlines, oceans, mountain ranges,
forests, rivers, plains, deserts. No grid, no scale in squares. Mountains, forests and towns are drawn as small painted symbols. Scene: {scene}

## Gabarit : region

Map of a region (a few days of travel across), seen from high above: forests, hills, rivers, roads, a few villages as small clusters
of roofs, ruins and landmarks as small recognizable painted symbols. No grid, no scale in squares. Scene: {scene}

## Gabarit : zone

Battle map of an outdoor place at figurine scale, {cases} (each square is 1.5 m), seen from directly above:
individual trees, rocks, paths, water, walls and ruins drawn at true size. Walkable ground clearly distinct from obstacles. Scene: {scene}

## Gabarit : localite

Map of a village, town or port at street scale, {cases} (each square is 1.5 m), seen from directly above:
roofs of buildings with their real footprint, streets 2 squares wide, squares, wells, fences, gardens, quays. Scene: {scene}

## Gabarit : batiment

Interior floor plan of a building at figurine scale, {cases} (each square is 1.5 m), seen from directly above
with the roof removed: walls with thickness, doors 1 square wide, floors with visible material (planks, tiles, flagstones), furniture at true size. Scene: {scene}

## Gabarit : souterrain

Dungeon, cave or crypt map at figurine scale, {cases} (each square is 1.5 m), seen from directly above:
thick stone walls, corridors 2 squares wide, rooms of 6 to 10 squares, doors 1 square wide, stairs, pillars, rubble, water, with the
rock outside the rooms painted in a light warm tone. Scene: {scene}

## Rappel final

Place names in the scene only tell you what is where: never write them on the picture.
Final check before drawing: absolutely no text, no letters, no labels, no banners anywhere; seen straight from above, never at an angle.
