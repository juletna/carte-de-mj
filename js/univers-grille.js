/**
 * Calage de grille sur une carte image (F4) : fonctions PURES, sans DOM ni stockage. Voir docs/conception-univers.md §6.
 *
 * Une grille est `{ case, dx, dy }`, en PIXELS DE L'IMAGE : `case` est le côté d'une case, `dx` et `dy` le décalage de la première
 * ligne (toujours dans [0, case)). Les cartes générées par IA n'ont pas d'échelle exacte : c'est le calage fait par le MJ qui
 * fait foi. La grille du lieu (`lieu.grille`) prime sur celle du catalogue (`infosImage(ref).grille`) ; `lieu.grille === null`
 * veut dire « pas de grille », même si le catalogue en propose une ; sans aucune des deux, la carte est d'ambiance.
 */
export const CASE_MIN = 8;      // plus petite case (px de l'image) : en dessous, la grille n'est qu'un grésillement
export const CASE_MAX = 2000;
export const NB_CASES_MAX = 200; // le plus grand nombre de cases qu'on peut annoncer entre deux clics
const arrondi = (v) => Math.round(v * 10) / 10;
const mod = (v, m) => ((v % m) + m) % m;

/** La plus grande case acceptée pour une image de ces dimensions (la moitié de son petit côté, sans jamais descendre sous CASE_MIN). */
export const caseMax = (dims) => (dims && dims.largeur > 0 && dims.hauteur > 0
  ? Math.max(CASE_MIN, Math.min(CASE_MAX, Math.floor(Math.min(dims.largeur, dims.hauteur) / 2))) : CASE_MAX);

/**
 * Ramène une grille dans les bornes : case entre CASE_MIN et caseMax, au dixième de pixel, décalages dans [0, case).
 * @returns {{case:number,dx:number,dy:number}|null} null si la grille n'est pas exploitable (pas un objet, case non numérique)
 */
export function normaliserGrille(g, dims) {
  if (!g || typeof g !== 'object' || Array.isArray(g) || !Number.isFinite(g.case) || g.case <= 0) return null;
  const c = arrondi(Math.min(caseMax(dims), Math.max(CASE_MIN, g.case)));
  const dec = (v) => (Number.isFinite(v) ? arrondi(mod(v, c)) % c : 0);
  return { case: c, dx: dec(g.dx), dy: dec(g.dy) };
}
export const grilleValide = (g) => normaliserGrille(g) !== null;
export const memeGrille = (a, b) => (a === b) || (!!a && !!b && a.case === b.case && a.dx === b.dx && a.dy === b.dy);

/**
 * La grille à utiliser pour un lieu.
 * @param {{grille?:object|null}} lieu
 * @param {{grille?:object}|null} infos  les métadonnées de l'image (catalogue), ou null
 * @returns {{grille:{case:number,dx:number,dy:number}|null, origine:'lieu'|'catalogue'|'aucune'|'ambiance'}}
 *   `aucune` : le MJ a choisi « pas de grille » ; `ambiance` : ni lieu ni catalogue.
 */
export function grilleEffective(lieu, infos) {
  if (lieu?.grille === null) return { grille: null, origine: 'aucune' };
  const duLieu = normaliserGrille(lieu?.grille);
  if (duLieu) return { grille: duLieu, origine: 'lieu' };
  const duCatalogue = normaliserGrille(infos?.grille);
  if (duCatalogue) return { grille: duCatalogue, origine: 'catalogue' };
  return { grille: null, origine: 'ambiance' };
}

/** Décale la grille de (ddx, ddy) pixels de l'image. */
export const decalerGrille = (g, ddx, ddy) => normaliserGrille({ case: g.case, dx: g.dx + ddx, dy: g.dy + ddy });

/**
 * Change la taille de case en gardant en place la ligne la plus proche du point `ancre` (px de l'image) : on règle la taille
 * sans que la grille « glisse » sous ce qu'on regarde.
 */
export function changerCase(g, nouvelle, ancre = { x: 0, y: 0 }, dims) {
  const c = normaliserGrille({ case: nouvelle, dx: 0, dy: 0 }, dims).case;
  const recale = (d, a) => { const k = Math.round((a - d) / g.case); return d + k * g.case - k * c; };
  return normaliserGrille({ case: c, dx: recale(g.dx, ancre.x), dy: recale(g.dy, ancre.y) }, dims);
}

/**
 * Deux clics qui encadrent `n` cases : la case et le décalage. Le trajet le plus long des deux axes donne la taille de case ;
 * le premier clic est supposé sur une ligne de la grille, ce qui cale l'axe mesuré. L'autre axe garde son décalage (`precedente`).
 * @param {{x:number,y:number}} a  premier clic, en px de l'image
 * @param {{x:number,y:number}} b  second clic
 * @returns {{case:number,dx:number,dy:number}|null} null si les clics sont trop proches ou si n n'est pas un entier de 1 à NB_CASES_MAX
 */
export function grilleDeuxClics(a, b, n, precedente = null, dims) {
  if (!a || !b || !Number.isInteger(n) || n < 1 || n > NB_CASES_MAX) return null;
  const ex = Math.abs(b.x - a.x), ey = Math.abs(b.y - a.y);
  const c = Math.max(ex, ey) / n;
  if (!(c >= CASE_MIN)) return null;
  const horizontal = ex >= ey;
  const base = precedente ?? { dx: 0, dy: 0 };
  return normaliserGrille({ case: c, dx: horizontal ? Math.min(a.x, b.x) : base.dx, dy: horizontal ? base.dy : Math.min(a.y, b.y) }, dims);
}

/** Les positions (px de l'image) des lignes verticales et horizontales d'une grille sur une image `largeur` × `hauteur`. */
export function lignesGrille(g, largeur, hauteur) {
  const v = [], hz = [];
  if (!g || !(largeur > 0) || !(hauteur > 0)) return { verticales: v, horizontales: hz };
  for (let x = g.dx; x <= largeur + 1e-6; x += g.case) v.push(arrondi(x));
  for (let y = g.dy; y <= hauteur + 1e-6; y += g.case) hz.push(arrondi(y));
  return { verticales: v, horizontales: hz };
}
/** Tracé SVG (attribut `d`) de toutes les lignes, ou '' s'il n'y a pas de grille. */
export function traceGrille(g, largeur, hauteur) {
  const { verticales, horizontales } = lignesGrille(g, largeur, hauteur);
  return [...verticales.map((x) => `M${x} 0V${hauteur}`), ...horizontales.map((y) => `M0 ${y}H${largeur}`)].join('');
}
/** Combien de cases tiennent dans l'image, au dixième près (pour dire « environ 24 × 16 cases »). */
export const nombreDeCases = (g, largeur, hauteur) => ({ colonnes: arrondi(largeur / g.case), lignes: arrondi(hauteur / g.case) });

/**
 * La taille à laquelle l'image s'affiche à la table, en pixels CSS.
 *  - « reel » avec une grille : une case mesure exactement `taille` px (la taille de case calibrée sur la table, qui mesure
 *    `caseMm` mm à l'écran) : l'échelle est taille / case. L'image peut alors dépasser l'écran (`defile`), comme une grande salle ;
 *  - sinon (« remplir », ou carte d'ambiance sans grille) : l'image tient entièrement dans la zone, sans déformation.
 * @param {{mode:string, grille:object|null, taille:number, image:{largeur:number,hauteur:number}, zone:{largeur:number,hauteur:number}}} o
 * @returns {{largeur:number, hauteur:number, echelle:number, defile:boolean, reel:boolean}|null} null tant qu'on ne connaît pas une taille
 */
export function dimensionsTable({ mode, grille, taille, image, zone, zoom = 1 }) {
  if (!(image?.largeur > 0) || !(image?.hauteur > 0)) return null;
  const reel = mode === 'reel' && !!grille && taille > 0;
  let echelle;
  if (reel) echelle = taille / grille.case;
  else {
    if (!(zone?.largeur > 0) || !(zone?.hauteur > 0)) return null;
    echelle = Math.min(zone.largeur / image.largeur, zone.hauteur / image.hauteur);
  }
  echelle *= Number.isFinite(zoom) && zoom > 0 ? zoom : 1; // le zoom de la vue table, par rapport au cadrage de base
  const largeur = image.largeur * echelle, hauteur = image.hauteur * echelle;
  return { largeur, hauteur, echelle, reel, defile: !!zone && (largeur > zone.largeur + 0.5 || hauteur > zone.hauteur + 0.5) };
}
