/**
 * Les thèmes de la carte à l'écran, par nom (le nom est celui du réglage « Thème », voir affichage.js : THEMES_RENDU).
 * Le papier (impression) n'en fait pas partie : main-impression.js l'importe directement.
 */
import * as peint from './peint.js';
import * as vectoriel from './vectoriel.js';
import { THEME_PAR_DEFAUT } from '../../affichage.js';

export const THEMES = { peint, vectoriel };

/** Le thème de ce nom ; le thème par défaut (peint) si le nom est inconnu. */
export const themeParNom = (nom) => THEMES[nom] || THEMES[THEME_PAR_DEFAUT];
