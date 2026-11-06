/**
 * La fausse 3D du thème « peint » : module PUR (aucun DOM ni canvas), donc testable sous Node.
 *
 * La caméra est au-dessus du CENTRE de la salle. Un point à la hauteur h (1 = la hauteur d'un mur) s'écarte du centre d'un facteur
 * `1 + h·KP` : plus il est loin du centre, plus on voit la face tournée vers le centre. Murs et objets suivent la même règle.
 * Sans relief, KP vaut 0 et la vue est à plat.
 *
 * Une « vue » est { cx, cy, kp, lum } : le centre de la salle en pixels (origine : coin nord-ouest de la pièce), le facteur de perspective et la
 * direction d'où vient la lumière (nord-ouest). Les matrices { a, b, c, d, e, f } ont le sens de celles du Canvas (x' = a·x + c·y + e).
 */
import { MARGE, EPAISSEUR_MUR } from './geometrie.js';

/** Relief de base : le haut d'un mur s'écarte du centre de 10,5 % de plus que son pied (kpDeSalle le relève sur les petites salles). */
export const KP_MAX = 0.105;
/** Part de la marge (en cases) que le décalage du haut des murs peut occuper ; le reste est pour leur épaisseur. */
export const PART_MARGE = 0.62;
/** D'où vient la lumière : le nord-ouest (vecteur unitaire vers la source). */
export const LUMIERE = [-0.6, -0.8];

/** Décalage que le haut du mur le plus proche du centre doit prendre au moins, en cases : en dessous, les faces de mur des petites salles sont trop fines. */
export const DECALAGE_MIN = 0.42;

/**
 * KP d'une salle : `min(PART_MARGE·T / demiMax, max(KP_MAX, DECALAGE_MIN·T / demiMin))` (demi = demi-dimension intérieure en pixels).
 * Le haut du mur le plus éloigné se décale de `KP × demiMax` : il ne dépasse jamais PART_MARGE cases, pour que ce décalage plus l'épaisseur
 * du mur (EPAISSEUR_MUR) tiennent dans MARGE. Mais sur une petite salle, `KP_MAX` ferait des faces trop fines : on relève KP pour que le
 * mur du côté court se décale d'au moins DECALAGE_MIN case, tant que la marge le permet.
 * @param {{largeur:number, longueur:number}} plan
 * @param {number} t       côté d'une case en pixels
 * @param {boolean} [relief=true]  faux : vue à plat, KP = 0
 */
export function kpDeSalle(plan, t, relief = true) {
  if (!relief) return 0;
  const demiMax = (Math.max(plan.largeur, plan.longueur) * t) / 2, demiMin = (Math.min(plan.largeur, plan.longueur) * t) / 2;
  // L'épaisseur du mur grandit aussi avec KP : sur les toutes petites salles, un dernier plafond garde le dessus des murs dans la marge.
  const plafond = (0.98 * (MARGE - EPAISSEUR_MUR)) / (demiMax / t + EPAISSEUR_MUR);
  return Math.min((PART_MARGE * MARGE * t) / demiMax, Math.max(KP_MAX, (DECALAGE_MIN * t) / demiMin), plafond);
}

/** Jusqu'où le dessus des murs déborde du rectangle de la salle, en cases : le décalage du haut du mur le plus éloigné plus l'épaisseur du mur. Toujours inférieur à MARGE. */
export function debordMax(plan, t, relief = true) {
  const kp = kpDeSalle(plan, t, relief);
  return (kp * Math.max(plan.largeur, plan.longueur)) / 2 + EPAISSEUR_MUR * (1 + kp);
}

/** La vue d'une salle de `plan` dessinée avec des cases de `t` px. */
export function vueDeSalle(plan, t, relief = true) {
  return { cx: (plan.largeur * t) / 2, cy: (plan.longueur * t) / 2, kp: kpDeSalle(plan, t, relief), lum: LUMIERE };
}

/** Facteur d'agrandissement à la hauteur h. */
export const echelle = (vue, h) => 1 + h * vue.kp;

/** Où tombe, à l'écran, le point (x, y) du sol quand on le monte à la hauteur h. */
export function haut(vue, x, y, h) {
  const s = echelle(vue, h);
  return [vue.cx + (x - vue.cx) * s, vue.cy + (y - vue.cy) * s];
}

/**
 * La face d'un mur ou d'un volume est-elle tournée vers le centre ?
 * @param {number[]} a  début du segment [x, y]
 * @param {number[]} b  fin du segment
 * @param {number[]} normale  normale de la face (unitaire), du côté qu'on regarde
 */
export function faceVisible(vue, a, b, normale) {
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
  return vue.kp > 0 && (vue.cx - mx) * normale[0] + (vue.cy - my) * normale[1] > 1e-9;
}

/** Éclairage d'une face de normale (nx, ny) : 1 = face tournée vers la lumière, −1 = tournée à l'opposé. */
export const eclairage = (vue, nx, ny) => nx * vue.lum[0] + ny * vue.lum[1];

// --- Matrices : passer du repère de la salle au repère local d'un objet ------------------------------------

export const IDENTITE = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

/** m1 ∘ m2 : applique m2, puis m1. */
export const composer = (m1, m2) => ({
  a: m1.a * m2.a + m1.c * m2.b, b: m1.b * m2.a + m1.d * m2.b,
  c: m1.a * m2.c + m1.c * m2.d, d: m1.b * m2.c + m1.d * m2.d,
  e: m1.a * m2.e + m1.c * m2.f + m1.e, f: m1.b * m2.e + m1.d * m2.f + m1.f,
});

export function inverser(m) {
  const det = m.a * m.d - m.b * m.c || 1;
  const a = m.d / det, b = -m.b / det, c = -m.c / det, d = m.a / det;
  return { a, b, c, d, e: -(a * m.e + c * m.f), f: -(b * m.e + d * m.f) };
}

export const appliquer = (m, x, y) => [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f];

/**
 * La vue dans le repère LOCAL d'un objet (celui du contexte une fois translaté et tourné, voir moteur.js). `base` est la matrice du contexte
 * dans le repère de la salle, `courante` celle du contexte local : le centre et la lumière sont ramenés dans ce repère, `kp` ne change pas
 * (une rotation et une translation conservent les distances). Les dessins d'objets peuvent alors élever des points avec `haut(vueLocale, x, y, h)`.
 */
export function vueLocale(vue, base, courante) {
  const m = composer(inverser(courante), base);
  const [cx, cy] = appliquer(m, vue.cx, vue.cy);
  const lx = m.a * vue.lum[0] + m.c * vue.lum[1], ly = m.b * vue.lum[0] + m.d * vue.lum[1];
  const n = Math.hypot(lx, ly) || 1;
  return { cx, cy, kp: vue.kp, lum: [lx / n, ly / n] };
}
