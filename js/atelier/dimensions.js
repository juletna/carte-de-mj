/**
 * Les tailles que disent les résumés de l'inspecteur : « 8 × 6 cases · 12 × 9 m ». Fonctions pures (testées sous Node).
 * L'échelle est le réglage `echelle` du Donjon : des mètres par case (1,5 par défaut). Les mètres s'écrivent à la virgule française,
 * arrondis au dixième.
 */
import { virgule } from '../format.js';

/** « 12 × 9 m » : une taille en cases passée en mètres. Chaîne vide si l'une des données est invalide. */
export function tailleEnMetres(largeur, hauteur, echelle) {
  if (![largeur, hauteur, echelle].every((v) => Number.isFinite(v) && v > 0)) return '';
  return `${virgule(largeur * echelle)} × ${virgule(hauteur * echelle)} m`;
}

/** « 8 × 6 cases · 12 × 9 m » (sans la partie en mètres si l'échelle manque). */
export function resumeTaille(largeur, hauteur, echelle) {
  if (!(largeur > 0 && hauteur > 0)) return '';
  const metres = tailleEnMetres(largeur, hauteur, echelle);
  return `${largeur} × ${hauteur} cases${metres ? ` · ${metres}` : ''}`;
}

/**
 * La taille d'une carte de lieu en cases, d'après sa grille ({ case } en pixels de l'image) et ses dimensions en pixels.
 * Vide sans grille ou sans dimensions : un lieu sans grille ne dit rien.
 */
export function resumeTailleLieu(grille, largeurPx, hauteurPx, echelle) {
  const c = grille?.case;
  if (!(c > 0) || !(largeurPx > 0) || !(hauteurPx > 0)) return '';
  return resumeTaille(Math.round(largeurPx / c), Math.round(hauteurPx / c), echelle);
}
