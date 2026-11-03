/**
 * Géométrie d'une salle dessinée : marge de roche, épaisseur des murs, rectangle d'un élément, ancrage d'une porte.
 * Une seule source pour le moteur, les thèmes, l'impression, le déplacement et l'interface (pur : aucun DOM ni canvas,
 * il se teste sous Node). Toutes les mesures sont en cases, l'origine étant le coin nord-ouest de la pièce.
 */
import { retraitPorte } from '../formes.js';

export const MARGE = 1; // cases de roche autour de la pièce

/** Épaisseur des murs en cases : ils sont dessinés à l'extérieur de la pièce, sur la marge (thèmes, impression, repères de porte). */
export const EPAISSEUR_MUR = 0.32;

/** Rectangle d'une porte dans le mur, en cases (origine : coin nord-ouest de la pièce). */
export function rectPorte(plan, p) {
  const e = EPAISSEUR_MUR, d = retraitPorte(plan, p.mur, p.position);
  return {
    nord: { x: p.position, y: d - e, l: 1, h: e },
    sud: { x: p.position, y: plan.longueur - d, l: 1, h: e },
    ouest: { x: d - e, y: p.position, l: e, h: 1 },
    est: { x: plan.largeur - d, y: p.position, l: e, h: 1 },
  }[p.mur];
}

/** Rectangle occupé par un élément (`genre` : 'porte', 'creature' ou 'objet'), en cases. */
export function rectDe(genre, e, plan) {
  if (genre === 'porte') return rectPorte(plan, e);
  if (genre === 'creature') return { x: e.x, y: e.y, l: e.taille, h: e.taille };
  return { x: e.x, y: e.y, l: e.l, h: e.h };
}

/**
 * Où s'ancre une porte : le milieu de l'ouverture, au bord de la pièce, et l'angle qui oriente le dessin pour que
 * l'intérieur de la salle soit vers +y (un thème dessine alors la porte d'un seul côté).
 * `echelle` convertit les cases en pixels (par défaut 1 : le résultat est en cases).
 * @returns {{x:number, y:number, angle:number}|undefined} undefined si `mur` n'est pas un des quatre murs
 */
export function ancragePorte(plan, mur, position, echelle = 1) {
  const W = plan.largeur * echelle, L = plan.longueur * echelle;
  const pos = (position + 0.5) * echelle;
  const d = retraitPorte(plan, mur, position) * echelle;
  const [x, y, angle] = {
    nord: [pos, d, 0], sud: [pos, L - d, Math.PI], ouest: [d, pos, -Math.PI / 2], est: [W - d, pos, Math.PI / 2],
  }[mur] || [];
  return x === undefined ? undefined : { x, y, angle };
}
