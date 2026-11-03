/**
 * Règles de jeu partagées entre l'outil Fiche et le Donjon. Feuille sans dépendance.
 * La page de la Fiche (js/fiche/main.js) les importe d'ici (tests/fiche-contrat.test.js vérifie qu'elle n'en garde pas de copie).
 */

/** Les six caractéristiques, dans l'ordre d'affichage de la Fiche. */
export const STATS = ['FOR', 'DEX', 'CON', 'INT', 'SAG', 'CHA'];
