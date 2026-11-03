/**
 * Tracés Canvas du sol et des murs d'une salle, partagés par le moteur et les deux thèmes.
 * Le calcul des cases et des tronçons reste dans formes.js (pur) ; ici, seulement l'appel au contexte 2D.
 */
import { estSol, troncons } from '../formes.js';
import { estHorizontal } from '../murs.js';

/** Trace (sans le remplir) le sol de la salle dans le chemin courant du contexte, pour peindre ou découper. */
export function tracerSol(ctx, plan, t) {
  ctx.beginPath();
  for (let y = 0; y < plan.longueur; y++) for (let x = 0; x < plan.largeur; x++) if (estSol(plan, x, y)) ctx.rect(x * t, y * t, t, t);
}

/**
 * Dessine les murs d'une salle découpée, pour les deux thèmes.
 * @param {{fond:string, trait:string, epaisseurTrait:number, joints:boolean}} style
 */
export function dessinerMursDecoupes(ctx, plan, t, e, { fond, trait, epaisseurTrait, joints }) {
  const liste = troncons(plan).map((c) => {
    const horizontal = estHorizontal(c.mur);
    const a = c.avant ? e : 0, b = c.apres ? e : 0;
    if (horizontal) {
      const y = c.mur === 'nord' ? c.y * t - e : (c.y + 1) * t;
      return { c, x: c.x * t - a, y, l: t + a + b, h: e, horizontal };
    }
    const x = c.mur === 'ouest' ? c.x * t - e : (c.x + 1) * t;
    return { c, x, y: c.y * t - a, l: e, h: t + a + b, horizontal };
  });
  ctx.save();
  ctx.fillStyle = fond;
  for (const r of liste) ctx.fillRect(r.x, r.y, r.l, r.h);
  ctx.strokeStyle = trait;
  ctx.lineWidth = epaisseurTrait;
  ctx.beginPath();
  for (const { c, x, y, l, h, horizontal } of liste) {
    if (horizontal) {
      ctx.moveTo(x, y); ctx.lineTo(x + l, y);
      ctx.moveTo(x, y + h); ctx.lineTo(x + l, y + h);
      if (joints) { ctx.moveTo(c.x * t, y); ctx.lineTo(c.x * t, y + h); }
      if (c.avant) { ctx.moveTo(x, y); ctx.lineTo(x, y + h); }
      if (c.apres) { ctx.moveTo(x + l, y); ctx.lineTo(x + l, y + h); }
    } else {
      ctx.moveTo(x, y); ctx.lineTo(x, y + h);
      ctx.moveTo(x + l, y); ctx.lineTo(x + l, y + h);
      if (joints) { ctx.moveTo(x, c.y * t); ctx.lineTo(x + l, c.y * t); }
      if (c.avant) { ctx.moveTo(x, y); ctx.lineTo(x + l, y); }
      if (c.apres) { ctx.moveTo(x, y + h); ctx.lineTo(x + l, y + h); }
    }
  }
  ctx.stroke();
  ctx.restore();
}
