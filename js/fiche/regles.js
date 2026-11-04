/**
 * Règles de jeu partagées entre l'outil Fiche et le Donjon. Feuille sans dépendance.
 * La page de la Fiche (js/fiche/main.js) les importe d'ici (tests/fiche-contrat.test.js vérifie qu'elle n'en garde pas de copie).
 */

/** Les six caractéristiques, dans l'ordre d'affichage de la Fiche. */
export const STATS = ['FOR', 'DEX', 'CON', 'INT', 'SAG', 'CHA'];

/** PV maximum d'un personnage épuisé : divisés par deux à partir du niveau 4 d'épuisement (règles de 2014). */
export const pvMaxEpuise = (pvMax, epuisement) => (epuisement >= 4 ? Math.max(1, Math.floor(pvMax / 2)) : pvMax);
