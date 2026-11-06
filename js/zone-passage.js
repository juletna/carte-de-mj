/**
 * Zone de clic des portes et des escaliers (fonctions pures, testées sous Node). Le dessin d'une porte ne fait qu'une
 * ouverture sombre de quelques pixels : la viser demande trop de précision. La zone de clic est donc plus large que le dessin.
 *
 *   NOYAU      toute la case du mur où se trouve la porte, de 0,6 case vers l'extérieur à 0,5 case vers l'intérieur.
 *              Dans le noyau, la porte gagne toujours (même sur un pion ou un objet). Un escalier : sa case, qu'il a déjà.
 *   ÉTENDUE    le noyau élargi : 0,35 case de part et d'autre le long du mur, 1 case de chaque côté du mur. La porte n'y gagne que
 *              si rien d'autre n'est sous le pointeur (ni pion ni objet) : un objet ou un pion tout près garde son clic. Un escalier :
 *              sa case élargie de 0,5 case tout autour.
 *   TACTILE    (doigt, ou écran sous 760 px) : la zone étendue fait au moins 44 px dans chaque sens (cible tactile minimale).
 *
 * Plusieurs candidats : le plus proche du pointeur (centre de la porte) l'emporte. Les unités sont des cases du plan.
 */
import { retraitPorte } from './formes.js';
import { largeurDe, hauteurDe } from './pose.js';

export const SORTIE_NOYAU = 0.6;     // cases : du mur vers l'extérieur
export const ENTREE_NOYAU = 0.5;     // cases : du mur vers l'intérieur
export const MARGE_LONGUEUR = 0.35;  // cases : le long du mur, de chaque côté de la case de la porte (zone étendue)
export const PROFONDEUR_ETENDUE = 1; // cases : de chaque côté du mur (zone étendue)
export const MARGE_ESCALIER = 0.5;   // cases : autour de la case d'un escalier (zone étendue)
export const CIBLE_TACTILE_PX = 44;

const rect = (x0, y0, x1, y1) => ({ x0, y0, x1, y1 });
const dans = (r, cx, cy) => cx >= r.x0 && cx < r.x1 && cy >= r.y0 && cy < r.y1;

/** Élargit `r` autour de son centre pour que chaque côté fasse au moins `mini` cases. */
function auMoins(r, mini) {
  const dx = Math.max(0, (mini - (r.x1 - r.x0)) / 2), dy = Math.max(0, (mini - (r.y1 - r.y0)) / 2);
  return rect(r.x0 - dx, r.y0 - dy, r.x1 + dx, r.y1 + dy);
}

/** Bande le long d'un mur : la case de la porte, plus `avant`/`apres` cases le long du mur, `ext` cases vers l'extérieur, `int` vers l'intérieur. */
function bande(plan, mur, position, avant, apres, ext, int) {
  const r = retraitPorte(plan, mur, position); // au fond d'une entaille, le mur est plus loin que le bord
  const a = position - avant, b = position + 1 + apres;
  switch (mur) {
    case 'nord': return rect(a, r - ext, b, r + int);
    case 'sud': return rect(a, plan.longueur - r - int, b, plan.longueur - r + ext);
    case 'ouest': return rect(r - ext, a, r + int, b);
    default: return rect(plan.largeur - r - int, a, plan.largeur - r + ext, b);
  }
}

/** Le noyau d'une porte : la case du mur, sans marge le long du mur. */
export const noyauPorte = (plan, p) => bande(plan, p.mur, p.position, 0, 0, SORTIE_NOYAU, ENTREE_NOYAU);

/** La zone étendue d'une porte ; `taille` (px par case) et `tactile` imposent la cible minimale de 44 px. */
export function etenduePorte(plan, p, { taille = 0, tactile = false } = {}) {
  const z = bande(plan, p.mur, p.position, MARGE_LONGUEUR, MARGE_LONGUEUR, PROFONDEUR_ETENDUE, PROFONDEUR_ETENDUE);
  return tactile && taille > 0 ? auMoins(z, CIBLE_TACTILE_PX / taille) : z;
}

/** La case d'un escalier (son noyau) et sa zone étendue. */
const noyauEscalier = (o) => rect(o.x, o.y, o.x + largeurDe(o), o.y + hauteurDe(o));
export function etendueEscalier(o, { taille = 0, tactile = false } = {}) {
  const n = noyauEscalier(o), m = MARGE_ESCALIER;
  const z = rect(n.x0 - m, n.y0 - m, n.x1 + m, n.y1 + m);
  return tactile && taille > 0 ? auMoins(z, CIBLE_TACTILE_PX / taille) : z;
}

/**
 * La porte ou l'escalier visé au point (cx, cy) en cases : `{ genre: 'porte' | 'objet', element, noyau }` ou null.
 * `occupant` : l'élément (pion ou objet) déjà sous le pointeur, ou null. Il prive de la zone étendue (pas du noyau) tout autre
 * passage que lui-même.
 */
export function passageVise(cx, cy, plan, { taille = 0, tactile = false, occupant = null } = {}) {
  let meilleur = null, distance = Infinity;
  const essayer = (genre, element, noyau, etendue) => {
    const dansNoyau = dans(noyau, cx, cy);
    if (!dansNoyau && (!dans(etendue, cx, cy) || (occupant && occupant !== element))) return;
    const d = Math.hypot(cx - (noyau.x0 + noyau.x1) / 2, cy - (noyau.y0 + noyau.y1) / 2) - (dansNoyau ? 100 : 0); // un noyau l'emporte sur toute zone étendue
    if (d < distance) { distance = d; meilleur = { genre, element, noyau: dansNoyau }; }
  };
  for (const p of plan.portes || []) essayer('porte', p, noyauPorte(plan, p), etenduePorte(plan, p, { taille, tactile }));
  for (const o of plan.objets || []) if (o.type === 'escalier') essayer('objet', o, noyauEscalier(o), etendueEscalier(o, { taille, tactile }));
  return meilleur;
}

/** Le rectangle à surligner au survol : le noyau d'une porte, la case d'un escalier. */
export const rectangleSurligne = (plan, vise) => (vise.genre === 'porte' ? noyauPorte(plan, vise.element) : noyauEscalier(vise.element));

/** Est-ce un écran tactile (doigt, stylet) ou étroit (sous 760 px) ? */
export const estTactile = (e) => e?.pointerType === 'touch' || (typeof matchMedia === 'function' && matchMedia('(max-width: 760px)').matches);
