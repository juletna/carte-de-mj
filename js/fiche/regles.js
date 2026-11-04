/**
 * Règles de jeu partagées entre l'outil Fiche et le Donjon. Feuille sans dépendance.
 * La page de la Fiche (js/fiche/main.js) les importe d'ici (tests/fiche-contrat.test.js vérifie qu'elle n'en garde pas de copie).
 */

/** Les six caractéristiques, dans l'ordre d'affichage de la Fiche. */
export const STATS = ['FOR', 'DEX', 'CON', 'INT', 'SAG', 'CHA'];

/**
 * Ce qui change selon les règles choisies pour une fiche. Tout ce qui varie d'une édition à l'autre est ici : le reste du code lit cette table.
 *  - auto : la Fiche applique d'elle-même les états, l'épuisement, l'échec contre la mort et le jet de concentration (« libre » : non) ;
 *  - epuisement : « paliers » (effets par niveau), « lineaire » (−2 aux d20 et −1,5 m par niveau) ou null (aucun effet) ;
 *  - potion : ce que coûte une potion de soins (null : rien d'imposé) ;
 *  - concMax : plafond du DD de concentration ; dvMin : soin minimum d'un dé de vie ; dvLong : dés de vie rendus par un repos long.
 */
export const EDITIONS = {
  2014: { nom: 'D&D 2014', auto: true, epuisement: 'paliers', potion: 'action', concMax: Infinity, dvMin: 0, dvLong: 'moitie' },
  2024: { nom: 'D&D 2024', auto: true, epuisement: 'lineaire', potion: 'bonus', concMax: 30, dvMin: 1, dvLong: 'tous' },
  libre: { nom: 'Libre (rien d’automatique)', auto: false, epuisement: null, potion: null, concMax: Infinity, dvMin: 0, dvLong: 'tous' },
};
export const EDITION_PAR_DEFAUT = '2014';

/** Les règles d'une édition ; une édition absente ou inconnue (fiche ancienne) suit le défaut. */
export const reglesDe = (edition) => (Object.hasOwn(EDITIONS, String(edition)) ? EDITIONS[edition] : EDITIONS[EDITION_PAR_DEFAUT]);

/** PV maximum d'un personnage épuisé : divisés par deux à partir du niveau 4, seulement quand l'épuisement va par paliers. */
export const pvMaxEpuise = (pvMax, epuisement, edition) => (reglesDe(edition).epuisement === 'paliers' && epuisement >= 4 ? Math.max(1, Math.floor(pvMax / 2)) : pvMax);
