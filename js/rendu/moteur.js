/**
 * Moteur de rendu : dessine un plan de salle sur un <canvas>.
 *
 * Le moteur s'occupe de la géométrie (taille du canvas, grille, murs,
 * portes, ordre de dessin) ; l'apparence de chaque élément est déléguée
 * à un « thème » (voir themes/vectoriel.js), ce qui permettra d'ajouter
 * un thème pixel art ou des sprites sans toucher à ce fichier.
 */
import * as vectoriel from './themes/vectoriel.js';
import { lettreColonne } from '../parseur/coordonnees.js';

export const MARGE = 1; // cases de roche autour de la pièce

// Ordre de dessin : ce qui est au sol d'abord, ce qui est accroché aux murs en dernier.
const COUCHE = { fosse: 0, debris: 1, torche: 9 };

/**
 * @param {HTMLCanvasElement} canvas
 * @param {object} plan     plan validé (voir schema.js)
 * @param {{taille?:number, grille?:boolean, theme?:object}} options
 *        taille = côté d'une case en pixels CSS
 */
export function dessiner(canvas, plan, { taille = 48, grille = true, theme = vectoriel } = {}) {
  const t = taille;
  const largeurPx = (plan.largeur + 2 * MARGE) * t;
  const hauteurPx = (plan.longueur + 2 * MARGE) * t;

  // Canvas net sur les écrans haute densité : on dessine en pixels physiques.
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(largeurPx * dpr);
  canvas.height = Math.round(hauteurPx * dpr);
  canvas.style.width = `${largeurPx}px`;
  canvas.style.height = `${hauteurPx}px`;

  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, largeurPx, hauteurPx);

  theme.roche(ctx, largeurPx, hauteurPx, t);

  // À partir d'ici, l'origine est le coin nord-ouest de la pièce.
  ctx.translate(MARGE * t, MARGE * t);
  theme.sol(ctx, plan, t);

  const objets = [...plan.objets].sort((a, b) => (COUCHE[a.type] ?? 5) - (COUCHE[b.type] ?? 5));
  const auSol = objets.filter((o) => (COUCHE[o.type] ?? 5) < 5);
  const autres = objets.filter((o) => (COUCHE[o.type] ?? 5) >= 5);

  auSol.forEach((o) => dessinerObjet(ctx, o, t, theme));
  if (grille) dessinerGrille(ctx, plan, t);
  theme.murs(ctx, plan, t);
  if (grille) dessinerReperes(ctx, plan, t);
  plan.portes.forEach((p) => theme.porte(ctx, p, plan, t));
  autres.forEach((o) => dessinerObjet(ctx, o, t, theme));
  // Les pions passent par-dessus tout le décor.
  (plan.creatures || []).forEach((k) => theme.pion(ctx, k, t));
}

/** Repères de cases dans la marge : lettres en haut, numéros à gauche (« C4 »). */
function dessinerReperes(ctx, plan, t) {
  ctx.save();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.font = `600 ${Math.max(9, t * 0.28)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let x = 0; x < plan.largeur; x++) ctx.fillText(lettreColonne(x), (x + 0.5) * t, -t * 0.66);
  for (let y = 0; y < plan.longueur; y++) ctx.fillText(String(y + 1), -t * 0.66, (y + 0.5) * t);
  ctx.restore();
}

/** Lignes de la grille, par-dessus le sol et sous les objets. */
function dessinerGrille(ctx, plan, t) {
  ctx.save();
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.lineWidth = Math.max(1, t / 40);
  ctx.beginPath();
  for (let x = 0; x <= plan.largeur; x++) { ctx.moveTo(x * t, 0); ctx.lineTo(x * t, plan.longueur * t); }
  for (let y = 0; y <= plan.longueur; y++) { ctx.moveTo(0, y * t); ctx.lineTo(plan.largeur * t, y * t); }
  ctx.stroke();
  ctx.restore();
}

/**
 * Place le contexte au centre de l'objet, orienté pour que son « avant »
 * pointe vers le bas du repère local, puis appelle le dessin du thème.
 * Ainsi chaque fonction de dessin n'a qu'une seule orientation à gérer.
 */
function dessinerObjet(ctx, o, t, theme) {
  const dessin = theme.objets[o.type] || theme.objets.inconnu;
  const quart = o.rotation === 90 || o.rotation === 270;
  const w = (quart ? o.h : o.l) * t; // dimensions dans le repère local
  const h = (quart ? o.l : o.h) * t;
  ctx.save();
  ctx.translate((o.x + o.l / 2) * t, (o.y + o.h / 2) * t);
  ctx.rotate(((o.rotation - 180) * Math.PI) / 180);
  dessin(ctx, w, h, t, o);
  ctx.restore();
}
