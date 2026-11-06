/**
 * Dimensions communes des tuiles de sol du thème peint (sols.js et les sols dessinés de peint/dessin/) : module PUR, sans dépendance, pour que
 * ces modules partagent la période sans s'importer les uns les autres.
 */
export const CASES_PAR_TUILE = 8;
export const VIRTUEL = 48; // pixels virtuels par case : les constantes des sols ont été réglées à cette échelle
export const PERIODE = CASES_PAR_TUILE * VIRTUEL;
