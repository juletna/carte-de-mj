/**
 * Formes de salle : un rectangle auquel on retire des cases. Module PUR (testable sous Node) ; les tracés Canvas sont dans rendu/trace.js.
 *
 * Le plan garde sa largeur et sa longueur (le rectangle qui englobe la forme) ; s'y ajoutent, hors rectangle :
 *   forme     croix, L, T, U, octogone, 8, E, F, H, O ou S
 *   bras      épaisseur des bras en cases (pour l'octogone : taille des pans coupés). Absent : selon la taille de la salle
 *   position  croix : haut, milieu, bas (où passent les bras) ; T : mur de la barre ; U : mur ouvert ; L : coin de l'angle
 * Les cases retirées se recalculent toujours : on ne les stocke jamais, et agrandir une salle agrandit sa forme.
 *
 * Une porte garde son écriture (mur + position) : elle se pose sur le premier mur rencontré en venant de ce côté.
 * « Mur nord en A » tombe donc au fond de l'entaille si le coin est retiré.
 */

import { MURS, estHorizontal } from './murs.js';

/**
 * La table des formes, dans l'ordre des boutons. Une forme est un identifiant (celui du JSON) et :
 *   libelle    le texte de son bouton
 *   mot        comment la description la nomme après « en » (« en croix »). Une forme d'une lettre ou d'un chiffre (L, T, 8…)
 *              s'écrit « en L », « en 8 » : elle n'a pas besoin de `mot`
 *   adjectifs  motifs d'adjectifs qui la nomment seuls (« une salle cruciforme », « octogonale »)
 *   diviseur   l'épaisseur des bras par défaut est le petit côté de la salle divisé par ce nombre (3 si absent) ; plus il est grand,
 *              plus les bras sont fins (les formes à trois barres, 8, E, F et S, laissent ainsi voir les vides entre leurs barres)
 *   bras       comment nommer ce que règle `bras` quand ce ne sont pas des « bras » : { nom, libelle } (octogone : les pans coupés)
 *   position   ce que règle `position` : { choix, libelle } ; le premier choix est la valeur par défaut
 * Le tracé de chaque forme est plus bas (brasMax et dansLaForme). Le parseur compose son motif de reconnaissance depuis cette table (parseur/dimensions.js).
 */
export const DEFINITIONS_FORMES = [
  { forme: 'rectangle', libelle: 'Rectangle' },
  { forme: 'croix', libelle: 'Croix', mot: 'croix', adjectifs: ['cruciforme'], position: { choix: ['milieu', 'haut', 'bas'], libelle: 'Hauteur des bras' } },
  { forme: 'octogone', libelle: 'Octogone', mot: 'octogone', adjectifs: ['octogonale?'], diviseur: 4, bras: { nom: 'pans', libelle: 'Taille des pans coupés' } },
  { forme: 'L', libelle: 'L', position: { choix: ['sud-ouest', 'sud-est', 'nord-ouest', 'nord-est'], libelle: 'Coin de l’angle' } },
  { forme: 'T', libelle: 'T', position: { choix: MURS, libelle: 'Mur de la barre' } },
  { forme: 'U', libelle: 'U', position: { choix: MURS, libelle: 'Mur ouvert' } },
  { forme: '8', libelle: '8', diviseur: 5 },
  { forme: 'E', libelle: 'E', diviseur: 5 },
  { forme: 'F', libelle: 'F', diviseur: 5 },
  { forme: 'H', libelle: 'H' },
  { forme: 'O', libelle: 'O' },
  { forme: 'S', libelle: 'S', diviseur: 5 },
];

export const FORMES = DEFINITIONS_FORMES.map((d) => d.forme);
export const LIBELLES_FORMES = Object.fromEntries(DEFINITIONS_FORMES.map((d) => [d.forme, d.libelle]));
const parForme = new Map(DEFINITIONS_FORMES.map((d) => [d.forme, d]));
/** Choix de `position` par forme ; le premier est la valeur par défaut. */
export const POSITIONS_FORMES = Object.fromEntries(DEFINITIONS_FORMES.filter((d) => d.position).map((d) => [d.forme, d.position.choix]));
/** Ce que règle `position`, par forme (« Mur de la barre »), et le nom de chacun de ses choix. */
export const LIBELLES_POSITIONS = Object.fromEntries(DEFINITIONS_FORMES.filter((d) => d.position).map((d) => [d.forme, d.position.libelle]));
export const NOMS_POSITIONS = {
  milieu: 'Au milieu', haut: 'En haut', bas: 'En bas', nord: 'Nord', sud: 'Sud', est: 'Est', ouest: 'Ouest',
  'sud-ouest': 'Sud-ouest', 'sud-est': 'Sud-est', 'nord-ouest': 'Nord-ouest', 'nord-est': 'Nord-est',
};
/** Ce que règle `bras`, en un mot (« bras », « pans ») et en légende du curseur (« Épaisseur des bras »). */
export const nomDesBras = (forme) => parForme.get(forme)?.bras?.nom ?? 'bras';
export const libelleDesBras = (forme) => parForme.get(forme)?.bras?.libelle ?? 'Épaisseur des bras';

/** Champs de forme d'un plan, validés : rien d'autre que `{forme:'rectangle'}` pour un rectangle. */
export function normaliserForme(brut) {
  const forme = FORMES.includes(brut?.forme) ? brut.forme : 'rectangle';
  if (forme === 'rectangle') return { forme };
  const champs = { forme };
  if (Number.isInteger(brut.bras) && brut.bras >= 1) champs.bras = brut.bras;
  if (POSITIONS_FORMES[forme]?.includes(brut.position)) champs.position = brut.position;
  return champs;
}

const positionDe = (plan) => (POSITIONS_FORMES[plan.forme]?.includes(plan.position) ? plan.position : POSITIONS_FORMES[plan.forme]?.[0]);

/** Épaisseur la plus grande qui laisse encore une forme (0 : la salle est trop petite pour cette forme). */
export function brasMax(plan) {
  const W = plan.largeur, L = plan.longueur, position = positionDe(plan);
  const debout = estHorizontal(position);
  switch (plan.forme) {
    case 'croix': return Math.max(0, Math.min(W, L) - 2);
    case 'L': return Math.max(0, Math.min(W, L) - 1);
    case 'T': return Math.max(0, debout ? Math.min(L - 1, W - 2) : Math.min(W - 1, L - 2));
    case 'U': return Math.max(0, debout ? Math.min(L - 1, Math.floor((W - 1) / 2)) : Math.min(W - 1, Math.floor((L - 1) / 2)));
    case 'octogone': return Math.floor((Math.min(W, L) - 1) / 2);
    case '8': return Math.max(0, Math.min(Math.floor((W - 1) / 2), Math.floor((L - 2) / 3)));
    case 'E': case 'F': case 'S': return Math.max(0, Math.min(W - 1, Math.floor((L - 2) / 3)));
    case 'H': return Math.max(0, Math.min(Math.floor((W - 1) / 2), L - 2));
    case 'O': return Math.floor((Math.min(W, L) - 1) / 2);
    default: return 0;
  }
}

/** L'épaisseur réellement utilisée : celle du plan, bornée, sinon proportionnelle à la salle. */
export function brasDe(plan) {
  const max = brasMax(plan);
  if (!max) return 0;
  const diviseur = parForme.get(plan.forme)?.diviseur ?? 3;
  const defaut = Math.max(1, Math.round(Math.min(plan.largeur, plan.longueur) / diviseur));
  return Math.min(max, plan.bras || defaut);
}

/** La case (x, y) du rectangle fait-elle partie de la forme ? */
function dansLaForme(plan, a, position, x, y) {
  const W = plan.largeur, L = plan.longueur;
  const centreX = x >= Math.floor((W - a) / 2) && x < Math.floor((W - a) / 2) + a;
  const centreY = y >= Math.floor((L - a) / 2) && y < Math.floor((L - a) / 2) + a;
  const nord = y < a, sud = y >= L - a, ouest = x < a, est = x >= W - a;
  const barreMilieu = centreY;
  switch (plan.forme) {
    case 'croix': {
      const reste = L - a, haut = { haut: Math.floor(reste / 3), bas: reste - Math.floor(reste / 3) }[position] ?? Math.floor(reste / 2);
      return centreX || (y >= haut && y < haut + a);
    }
    case 'T': return { nord: nord || centreX, sud: sud || centreX, ouest: ouest || centreY, est: est || centreY }[position];
    case 'U': return { nord: ouest || est || sud, sud: ouest || est || nord, ouest: nord || sud || est, est: nord || sud || ouest }[position];
    case 'L': {
      const [ns, eo] = position.split('-');
      return (ns === 'nord' ? nord : sud) || (eo === 'ouest' ? ouest : est);
    }
    case 'octogone': return Math.min(x, W - 1 - x) + Math.min(y, L - 1 - y) >= a;
    case '8': return ouest || est || nord || sud || barreMilieu;
    case 'E': return ouest || nord || sud || barreMilieu;
    case 'F': return ouest || nord || (barreMilieu && x < a + Math.ceil((W - a) * 2 / 3));
    case 'H': return ouest || est || centreY;
    case 'O': return ouest || est || nord || sud;
    case 'S': return nord || sud || barreMilieu || (ouest && y < L / 2) || (est && y >= L / 2);
    default: return true;
  }
}

const memoire = new Map();
const AUCUNE = new Set();

/** Cases retirées du rectangle, sous la forme « x,y ». Ensemble vide pour un rectangle ou une salle trop petite. */
export function casesRetirees(plan) {
  if (!plan?.forme || plan.forme === 'rectangle') return AUCUNE;
  const a = brasDe(plan);
  if (!a) return AUCUNE;
  const position = positionDe(plan);
  const cle = `${plan.largeur},${plan.longueur},${plan.forme},${a},${position}`;
  if (memoire.has(cle)) return memoire.get(cle);
  const vides = new Set();
  for (let y = 0; y < plan.longueur; y++) for (let x = 0; x < plan.largeur; x++) if (!dansLaForme(plan, a, position, x, y)) vides.add(`${x},${y}`);
  if (memoire.size > 200) memoire.clear();
  memoire.set(cle, vides);
  return vides;
}

/** Petit dessin d'une forme (SVG en texte, jamais une donnée du MJ : uniquement nos propres rectangles), tiré du même calcul que la vraie salle. */
export function svgForme(forme) {
  const plan = { largeur: 5, longueur: 5, forme, bras: forme === 'rectangle' ? undefined : 1 };
  const vides = casesRetirees(plan);
  let cases = '';
  for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) if (!vides.has(`${x},${y}`)) cases += `<rect x="${x}" y="${y}" width="1.02" height="1.02"/>`;
  return `<svg viewBox="-0.5 -0.5 6 6" aria-hidden="true" fill="currentColor">${cases}</svg>`;
}

/** La case (x, y) est-elle du sol de la salle ? */
export const estSol = (plan, x, y) => x >= 0 && y >= 0 && x < plan.largeur && y < plan.longueur && !casesRetirees(plan).has(`${x},${y}`);

/** Un rectangle de cases est-il entièrement sur le sol ? */
export function surLeSol(plan, x, y, l = 1, h = 1) {
  for (let i = x; i < x + l; i++) for (let j = y; j < y + h; j++) if (!estSol(plan, i, j)) return false;
  return true;
}

/** Nombre de cases de sol de la salle. */
export const nombreCases = (plan) => plan.largeur * plan.longueur - casesRetirees(plan).size;

/** De combien de cases une porte s'enfonce depuis le bord du rectangle, pour atteindre le premier mur. */
export function retraitPorte(plan, mur, position) {
  const horizontal = estHorizontal(mur);
  const profondeur = horizontal ? plan.longueur : plan.largeur;
  if (!casesRetirees(plan).size) return 0;
  for (let d = 0; d < profondeur; d++) {
    const x = horizontal ? position : (mur === 'ouest' ? d : plan.largeur - 1 - d);
    const y = horizontal ? (mur === 'nord' ? d : plan.longueur - 1 - d) : position;
    if (estSol(plan, x, y)) return d;
  }
  return 0;
}

/**
 * Les murs d'une salle découpée : un tronçon par côté de case qui donne sur le vide.
 * `avant` et `apres` : le tronçon se prolonge de l'épaisseur du mur à ce bout, parce que c'est un coin sortant.
 */
export function troncons(plan) {
  const res = [];
  for (let y = 0; y < plan.longueur; y++) for (let x = 0; x < plan.largeur; x++) {
    if (!estSol(plan, x, y)) continue;
    if (!estSol(plan, x, y - 1)) res.push({ x, y, mur: 'nord', avant: !estSol(plan, x - 1, y), apres: !estSol(plan, x + 1, y) });
    if (!estSol(plan, x, y + 1)) res.push({ x, y, mur: 'sud', avant: !estSol(plan, x - 1, y), apres: !estSol(plan, x + 1, y) });
    if (!estSol(plan, x - 1, y)) res.push({ x, y, mur: 'ouest', avant: !estSol(plan, x, y - 1), apres: !estSol(plan, x, y + 1) });
    if (!estSol(plan, x + 1, y)) res.push({ x, y, mur: 'est', avant: !estSol(plan, x, y - 1), apres: !estSol(plan, x, y + 1) });
  }
  return res;
}

/**
 * Le contour du sol, à `d` pixels à l'extérieur : un segment par côté de case qui donne sur le vide.
 * Il suit les coins : un coin sortant allonge le segment de `d`, un coin rentrant le raccourcit de `d`. Les trous (O, 8) ont aussi leur contour.
 * @returns {Array<{x1:number,y1:number,x2:number,y2:number}>} en pixels, l'origine étant le coin nord-ouest de la salle
 */
export function contourSol(plan, t, d) {
  // Bout d'un segment : la case voisine le long du mur, et la case en face de celle-ci, du côté du vide.
  const bout = (voisine, enFace) => (!voisine ? d : enFace ? -d : 0);
  return troncons(plan).map(({ x, y, mur }) => {
    const horizontal = estHorizontal(mur);
    const dehors = mur === 'nord' || mur === 'ouest' ? -1 : 1;
    if (horizontal) {
      const Y = (mur === 'nord' ? y : y + 1) * t + dehors * d;
      return { x1: x * t - bout(estSol(plan, x - 1, y), estSol(plan, x - 1, y + dehors)), y1: Y, x2: (x + 1) * t + bout(estSol(plan, x + 1, y), estSol(plan, x + 1, y + dehors)), y2: Y };
    }
    const X = (mur === 'ouest' ? x : x + 1) * t + dehors * d;
    return { x1: X, y1: y * t - bout(estSol(plan, x, y - 1), estSol(plan, x + dehors, y - 1)), x2: X, y2: (y + 1) * t + bout(estSol(plan, x, y + 1), estSol(plan, x + dehors, y + 1)) };
  });
}
