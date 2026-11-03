/**
 * Taille de la carte à la table : logique PURE (aucun DOM, aucun stockage), testable sous Node.
 *
 * Deux modes, choisis dans la régie et mémorisés dans les réglages (`modeTable`) :
 *  - « remplir » : la case est calculée pour que la salle (avec sa marge de roche) occupe la fenêtre table ;
 *  - « reel »    : échelle réelle pour les figurines : la case garde exactement la taille calibrée (`taille`).
 *
 * Le mode ne contient aucun secret : c'est un mot, joint aux réglages d'affichage envoyés à la table.
 *
 * Source unique des réglages d'affichage : tailles par défaut et bornes, échelle par défaut, modes, passage des
 * réglages enregistrés à l'affichage de la table (`affichageDeReglages`) et validation de ce que la table reçoit
 * (`validerAffichage`). Le stockage, le moteur, la régie, la fenêtre table et le téléphone s'y réfèrent.
 */
import { MARGE } from './rendu/geometrie.js';

export const MODES_TABLE = ['remplir', 'reel'];
export const TAILLE_PAR_DEFAUT = 48;   // px par case
export const TAILLE_MIN = 16;          // plus petite case réglable ou affichée (une grande salle défile alors)
export const TAILLE_MAX = 160;         // plus grande case réglable dans les réglages (curseur du Donjon et de la régie)
export const TAILLE_MAX_REMPLIR = 300; // plus grande case atteinte en « remplir », et par le zoom du Donjon
export const ECHELLE_PAR_DEFAUT = 1.5; // mètres par case, pour lire « une salle de 9 mètres »

/** Cette taille de case est-elle dans les bornes du réglage ? (Un nombre : le contrôle du type reste à l'appelant.) */
export const tailleReglable = (t) => t >= TAILLE_MIN && t <= TAILLE_MAX;

/** Affichage de la table quand personne n'a rien envoyé : la taille par défaut, grille et repères, la salle qui remplit la fenêtre. */
export const AFFICHAGE_PAR_DEFAUT = { taille: TAILLE_PAR_DEFAUT, grille: true, reperes: true, mode: 'remplir' };

/**
 * Mode choisi quand personne n'a rien réglé : « reel » si la taille a été calibrée (indicateur `calibre` posé par
 * le Donjon, ou à défaut une taille différente de la valeur par défaut), sinon « remplir ».
 */
export function modeTableDefaut(reglages = {}) {
  const calibre = reglages.calibre === true || (Number.isFinite(reglages.taille) && reglages.taille !== TAILLE_PAR_DEFAUT);
  return calibre ? 'reel' : 'remplir';
}

/** Mode à appliquer : celui des réglages s'il est valide, sinon le défaut. */
export const modeTable = (reglages = {}) => (MODES_TABLE.includes(reglages.modeTable) ? reglages.modeTable : modeTableDefaut(reglages));

/**
 * Côté de case (px CSS, entier) pour que la salle et sa marge tiennent dans `largeur` × `hauteur` px.
 * Jamais sous TAILLE_MIN (une salle trop grande défile alors), jamais au-dessus de TAILLE_MAX_REMPLIR.
 * @returns {number|null} null si la fenêtre n'a pas (encore) de taille
 */
export function tailleRemplir(plan, largeur, hauteur) {
  if (!(largeur > 0) || !(hauteur > 0) || !plan) return null;
  const t = Math.floor(Math.min(largeur / (plan.largeur + 2 * MARGE), hauteur / (plan.longueur + 2 * MARGE)));
  return Math.max(TAILLE_MIN, Math.min(TAILLE_MAX_REMPLIR, t));
}

/**
 * Case à utiliser à la table. En « reel », toujours `taille`, sans la moindre adaptation (échelle exacte).
 * En « remplir », le calcul ci-dessus ; `taille` sert de repli tant que la fenêtre n'a pas de dimensions.
 */
export function tailleTable({ mode, plan, vue, taille }) {
  if (mode !== 'remplir') return taille;
  return tailleRemplir(plan, vue?.largeur, vue?.hauteur) ?? taille;
}

/** L'affichage de la table tel que le décrivent des réglages enregistrés : { taille, grille, reperes, mode }. */
export const affichageDeReglages = (reglages) => ({
  taille: reglages.taille, grille: reglages.grille, reperes: reglages.reperes !== false, mode: modeTable(reglages),
});

/** Relit un affichage reçu (message de la régie) : chaque champ invalide reprend la valeur de `defaut`. */
export const validerAffichage = (a, defaut) => ({
  mode: MODES_TABLE.includes(a?.mode) ? a.mode : defaut.mode,
  taille: Number.isFinite(a?.taille) && tailleReglable(a.taille) ? a.taille : defaut.taille,
  grille: typeof a?.grille === 'boolean' ? a.grille : defaut.grille,
  reperes: typeof a?.reperes === 'boolean' ? a.reperes : defaut.reperes,
});
