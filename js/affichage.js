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
 * (`validerAffichage`) ; et des tailles de dessin : case qui tient un plan dans un cadre, limites de canvas. Le stockage, le moteur, la régie, la fenêtre table et le téléphone s'y réfèrent.
 */
import { MARGE } from './rendu/geometrie.js';

export const MODES_TABLE = ['remplir', 'reel'];
export const TAILLE_PAR_DEFAUT = 48;   // px par case
export const TAILLE_MIN = 16;          // plus petite case réglable ou affichée (une grande salle défile alors)
export const TAILLE_MAX = 160;         // plus grande case réglable dans les réglages (curseur du Donjon et de la régie)
export const TAILLE_MAX_REMPLIR = 300; // plus grande case atteinte en « remplir », et par le zoom du Donjon
export const ECHELLE_PAR_DEFAUT = 1.5; // mètres par case, pour lire « une salle de 9 mètres »
export const ROTATIONS_TABLE = [0, 90, 180, 270]; // degrés, dans le sens des aiguilles d'une montre
export const CASE_MM_PAR_DEFAUT = 25;  // taille réelle visée d'une case (figurines de 25 mm) ; 25,4 mm = 1 pouce
export const CASE_MM_MIN = 10;
export const CASE_MM_MAX = 50;
const CARTE_BANCAIRE_MM = { largeur: 85.6, hauteur: 53.98 };

/** Cette taille de case est-elle dans les bornes du réglage ? (Un nombre : le contrôle du type reste à l'appelant.) */
export const tailleReglable = (t) => t >= TAILLE_MIN && t <= TAILLE_MAX;
/** Cette taille réelle de case, en millimètres, est-elle acceptée ? */
export const caseMmValide = (mm) => Number.isFinite(mm) && mm >= CASE_MM_MIN && mm <= CASE_MM_MAX;
/** La taille de case après un pas de réglage (au dixième de pixel, dans les bornes). */
export const ajusterTaille = (t, pas) => Math.max(TAILLE_MIN, Math.min(TAILLE_MAX, Math.round((t + pas) * 10) / 10));
/** Dimensions en pixels d'une carte bancaire quand une case de `taille` px doit mesurer `caseMm` mm. */
export const carteDeCalibrage = (taille, caseMm = CASE_MM_PAR_DEFAUT) => ({
  largeur: (taille * CARTE_BANCAIRE_MM.largeur) / caseMm, hauteur: (taille * CARTE_BANCAIRE_MM.hauteur) / caseMm,
});

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

/**
 * L'affichage de la table tel que le décrivent des réglages enregistrés : { taille, grille, reperes, mode }, plus `rotation`,
 * `miroir` et `caseMm` seulement s'ils diffèrent du défaut. `calibrage` n'est jamais enregistré : la régie l'ajoute le temps du réglage.
 */
export const affichageDeReglages = (reglages) => ({
  taille: reglages.taille, grille: reglages.grille, reperes: reglages.reperes !== false, mode: modeTable(reglages),
  ...(reglages.rotationTable ? { rotation: reglages.rotationTable } : {}),
  ...(reglages.miroirTable === true ? { miroir: true } : {}),
  ...(reglages.caseMm ? { caseMm: reglages.caseMm } : {}),
});

/** Relit un affichage reçu (message de la régie) : chaque champ invalide reprend la valeur de `defaut`. */
export const validerAffichage = (a, defaut) => ({
  mode: MODES_TABLE.includes(a?.mode) ? a.mode : defaut.mode,
  taille: Number.isFinite(a?.taille) && tailleReglable(a.taille) ? a.taille : defaut.taille,
  grille: typeof a?.grille === 'boolean' ? a.grille : defaut.grille,
  reperes: typeof a?.reperes === 'boolean' ? a.reperes : defaut.reperes,
  // Absents ou invalides : la valeur neutre, car la régie ne les envoie pas quand ils valent leur défaut.
  ...(ROTATIONS_TABLE.includes(a?.rotation) && a.rotation ? { rotation: a.rotation } : {}),
  ...(a?.miroir === true ? { miroir: true } : {}),
  ...(caseMmValide(a?.caseMm) ? { caseMm: a.caseMm } : {}),
  ...(a?.calibrage === true ? { calibrage: true } : {}),
});

/** La transformation CSS de l'écran de table ; vide sans rotation ni miroir, pour ne rien changer au dessin. */
export function transformOrientation({ rotation = 0, miroir = false } = {}) {
  return [rotation ? `rotate(${rotation}deg)` : '', miroir ? 'scaleX(-1)' : ''].filter(Boolean).join(' ');
}

/**
 * Ramène un écart vu à l'écran dans le repère de la carte avant `transformOrientation` : position d'un pointeur par rapport
 * au centre de la carte, ou sens d'un défilement.
 * @returns {[number, number]}
 */
export function versCarte(dx, dy, { rotation = 0, miroir = false } = {}) {
  const [x, y] = { 90: [dy, -dx], 180: [-dx, -dy], 270: [-dy, dx] }[rotation] ?? [dx, dy];
  return [(miroir ? -x : x) + 0, y + 0]; // + 0 : pas de -0
}

/** Côté de case pour qu'un plan tienne dans un cadre, sans jamais grossir au-delà de `plafond` px (miniatures). */
export function tailleQuiTientPlan(disposition, largeurMax, hauteurMax, plafond = 16) {
  return Math.max(1, Math.min(largeurMax / disposition.largeur, hauteurMax / disposition.longueur, plafond));
}

// Limites d'un canvas (navigateurs et iOS) : côté et surface en pixels PHYSIQUES. Au-delà, le dessin disparaîtrait.
export const CANVAS_COTE_MAX = 8192;
export const CANVAS_SURFACE_MAX = 16_000_000;

/**
 * Case et densité de pixels d'un canvas de `casesL` × `casesH` cases pour qu'il reste dans les limites du navigateur.
 * D'abord moins de pixels physiques (la netteté), puis, si ça ne suffit pas, une case plus petite (jamais sous 1 px).
 * @param {number} taille  côté de case voulu, en pixels CSS
 * @param {number} ratio   densité de pixels de l'écran (window.devicePixelRatio)
 * @returns {{t:number, dpr:number}}
 */
export function tailleCanvasBornee(casesL, casesH, taille, ratio) {
  let dpr = ratio;
  let t = Math.max(1, taille);
  const trop = () => casesL * t * dpr > CANVAS_COTE_MAX || casesH * t * dpr > CANVAS_COTE_MAX || casesL * t * casesH * t * dpr * dpr > CANVAS_SURFACE_MAX;
  while (trop() && dpr > 1) dpr = Math.max(1, dpr - 0.5);
  if (trop()) {
    t = Math.min(CANVAS_COTE_MAX / (Math.max(casesL, casesH) * dpr), Math.sqrt(CANVAS_SURFACE_MAX / (casesL * casesH)) / dpr);
    t = Math.max(1, Math.floor(t * 100) / 100);
  }
  return { t, dpr };
}
