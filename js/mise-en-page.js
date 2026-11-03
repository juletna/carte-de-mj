/**
 * Calculs de mise en page du Donjon, sans DOM (pur, testable sous Node) : où poser la bulle de sélection, les pas du zoom,
 * la taille du plan complet. Les modules de js/mj/ mesurent l'écran et appliquent le résultat ; les décisions sont ici.
 */
import { TAILLE_MAX_REMPLIR } from './affichage.js';

// --- Zoom -----------------------------------------------------------------------------------
export const ZOOM_MIN = 8, ZOOM_MAX = TAILLE_MAX_REMPLIR; // le zoom ne dépasse pas la plus grande case que « remplir » atteint
/** Le plan complet : zoom permis, taille minimale qui le fait tenir dans la scène (au-delà, la scène défile), taille d'une scène sans mesure. */
export const PLAN_ZOOM_MIN = 3, PLAN_ZOOM_MAX = 80, PLAN_AJUSTE_MIN = 4, PLAN_AJUSTE_DEFAUT = 16;

/** Côté de case après un zoom manuel : arrondi et borné ; `null` (« ajuster ») reste `null`. */
export const zoomBorne = (t, min, max) => (t === null ? null : Math.max(min, Math.min(max, Math.round(t))));

/** Un cran de zoom : ×1,25 ou ÷1,25, d'au moins 1 px. `sens` > 0 agrandit, sinon réduit. */
export const pasDeZoom = (t, sens) => (sens > 0 ? Math.max(t + 1, t * 1.25) : Math.min(t - 1, t / 1.25));

/** Facteur de zoom d'un cran de molette (ou de pincement) : `deltaY` est borné à ±50 pour qu'un coup de molette brusque ne bondisse pas. */
export const facteurMolette = (deltaY) => Math.exp(-Math.max(-50, Math.min(50, deltaY)) * 0.01);

/**
 * Côté de case du plan complet : le zoom choisi, sinon le plan remplit la scène (jamais sous PLAN_AJUSTE_MIN px : au-delà, la scène défile).
 * Scène masquée (sans dimensions) ou plan pas encore disposé : PLAN_AJUSTE_DEFAUT, un redessin suivra.
 * @param {{zoom:number|null, dispo:{largeur:number, longueur:number}|null, largeur:number, hauteur:number}} p  `dispo` : la disposition du plan ; `largeur` × `hauteur` : la scène en px
 */
export function tailleAfficheePlan({ zoom, dispo, largeur, hauteur }) {
  if (zoom) return zoom;
  if (!dispo || !largeur || !hauteur) return PLAN_AJUSTE_DEFAUT;
  const t = Math.floor(Math.min(largeur / dispo.largeur, hauteur / dispo.longueur));
  return Math.max(PLAN_AJUSTE_MIN, Math.min(PLAN_ZOOM_MAX, t));
}

// --- Bulle de sélection -----------------------------------------------------------------------
/** Distance entre la bulle et l'élément, en px. */
export const ECART_BULLE = 10;
/** Hauteur minimale que garde la bulle quand la scène est basse. */
export const HAUTEUR_BULLE_MIN = 120;

/** Hauteur maximale de la bulle : la place visible de la scène (`vue` : { h, b } en px écran), sans descendre sous HAUTEUR_BULLE_MIN. */
export const hauteurMaxBulle = (vue) => Math.max(HAUTEUR_BULLE_MIN, vue.b - vue.h);

/**
 * Où poser la bulle (coin haut-gauche, px écran) à côté de l'élément : à droite, sinon à gauche, sinon dessous, sinon dessus,
 * puis recalée pour ne jamais dépasser de la zone visible. Si rien ne tient, l'essai de droite, recalé.
 * @param {{g:number,h:number,d:number,b:number}} ancre  rectangle de l'élément (gauche, haut, droite, bas)
 * @param {{g:number,h:number,d:number,b:number}} vue    zone visible de la scène
 * @param {number} w  largeur de la bulle
 * @param {number} ha hauteur de la bulle
 */
export function positionBulle(ancre, vue, w, ha) {
  // À côté (la bulle glisse alors verticalement pour rester visible), sinon dessous ou dessus (elle glisse horizontalement).
  const essais = [
    { x: ancre.d + ECART_BULLE, y: ancre.h - 6, ok: ancre.d + ECART_BULLE + w <= vue.d },    // à droite
    { x: ancre.g - ECART_BULLE - w, y: ancre.h - 6, ok: ancre.g - ECART_BULLE - w >= vue.g }, // à gauche
    { x: ancre.g, y: ancre.b + ECART_BULLE, ok: ancre.b + ECART_BULLE + ha <= vue.b },       // dessous
    { x: ancre.g, y: ancre.h - ECART_BULLE - ha, ok: ancre.h - ECART_BULLE - ha >= vue.h },  // dessus
  ];
  let { x, y } = essais.find((e) => e.ok) || essais[0];
  x = Math.max(vue.g, Math.min(x, vue.d - w));
  y = Math.max(vue.h, Math.min(y, vue.b - ha));
  return { x, y };
}
