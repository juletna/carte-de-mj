/**
 * Les petits détails semés sur le sol d'une salle usée ou en ruine : cailloux, mousse, feuilles mortes, touffes d'herbe, os, toiles d'araignée dans les coins.
 *
 *   semerDetails(plan, {graine, ambiance, etat})   PUR (aucun DOM, testable sous Node) : la liste des détails, en cases
 *   dessinerDetails(ctx, plan, t)                  les dessine (appelé par peint.js après la tuile de sol, avant l'ombre au pied des murs et les objets)
 *
 * Déterminisme : chaque case tire son hasard d'une graine qui ne dépend que de la graine de la salle et de la case, jamais du reste du plan. Poser, déplacer
 * ou retirer un pion ou un objet ne change donc que les cases touchées : les autres gardent leurs détails, à la régie comme à la table.
 * Jamais de détail sur une case occupée par un objet, un pion ou le seuil d'une porte (ni dans une case retirée de la forme).
 */
import { estSol, retraitPorte } from '../../../formes.js';
import { etat } from './etat.js';
import { alea, h2 } from './bruit.js';
import { densites } from './ambiance.js';
import { masqueVert, decalageDeTuile, CASES_PAR_TUILE, SEUIL_HERBE } from './sols.js';
import { encre, trait, dr } from './trait.js';

/** Les sortes de détails, dans l'ordre où ils sont tirés dans une case. */
export const SORTES = ['toile', 'os', 'caillou', 'mousse', 'feuille', 'touffe'];

/** Part des touffes plantées hors de l'herbe (le masque de végétation, sols.js, dit où l'herbe a repris le sol). */
const TOUFFE_HORS_HERBE = 0.012;

const cle = (x, y) => `${x},${y}`;

/**
 * Les cases où l'on ne sème rien : sous un objet, sous un pion, devant une porte (la case du seuil).
 * @returns {Set<string>} « x,y »
 */
export function casesOccupees(plan) {
  const pris = new Set();
  const prendre = (x, y, l, h) => { for (let i = x; i < x + l; i++) for (let j = y; j < y + h; j++) pris.add(cle(i, j)); };
  for (const o of plan.objets || []) prendre(o.x, o.y, o.l || 1, o.h || 1);
  for (const k of plan.creatures || []) prendre(k.x, k.y, k.taille || 1, k.taille || 1);
  for (const p of plan.portes || []) {
    const d = retraitPorte(plan, p.mur, p.position);
    if (p.mur === 'nord') pris.add(cle(p.position, d));
    else if (p.mur === 'sud') pris.add(cle(p.position, plan.longueur - 1 - d));
    else if (p.mur === 'ouest') pris.add(cle(d, p.position));
    else if (p.mur === 'est') pris.add(cle(plan.largeur - 1 - d, p.position));
  }
  return pris;
}

/** La graine d'une case : celle de la salle mêlée à la case. */
const graineDeCase = (graine, x, y) => ((h2(x, y, graine & 0xffff) * 4294967296) ^ graine) >>> 0;

/**
 * Sème les détails d'une salle.
 * @param {object} plan
 * @param {{graine:number, ambiance?:string, etat?:string}} p  la graine de la salle (graine.js), et ses champs d'ambiance et d'état
 * @returns {{sorte:string, x:number, y:number, sx?:number, sy?:number, graine:number}[]}  x, y en cases (origine : coin nord-ouest de la pièce) ;
 *          sx, sy : pour une toile, le sens du coin (+1 ou −1) vers l'intérieur de la salle
 */
export function semerDetails(plan, { graine, ambiance = 'neutre', etat: etatSalle = 'neuve' }) {
  const dens = densites(etatSalle, ambiance, plan.sol);
  if (!Object.values(dens).some((v) => v > 0)) return [];
  const pris = casesOccupees(plan), [dx, dy] = decalageDeTuile(graine), details = [];
  for (let y = 0; y < plan.longueur; y++) for (let x = 0; x < plan.largeur; x++) {
    if (!estSol(plan, x, y) || pris.has(cle(x, y))) continue;
    const g = graineDeCase(graine, x, y), r = alea(g);
    const nord = !estSol(plan, x, y - 1), sud = !estSol(plan, x, y + 1), ouest = !estSol(plan, x - 1, y), est = !estSol(plan, x + 1, y);
    const aUnMur = nord || sud || ouest || est;
    // Chaque sorte tire toujours le même nombre de nombres, qu'elle soit retenue ou non : une case ne dépend que d'elle-même.
    const jets = SORTES.map(() => [r(), r(), r()]);
    const ajouter = (sorte, i, extra = {}) => details.push({ sorte, x: x + 0.12 + 0.76 * jets[i][1], y: y + 0.12 + 0.76 * jets[i][2], graine: (g + i * 7919) >>> 0, ...extra });
    if ((nord || sud) && (ouest || est) && jets[0][0] < dens.toile) {
      details.push({ sorte: 'toile', x: ouest ? x : x + 1, y: nord ? y : y + 1, sx: ouest ? 1 : -1, sy: nord ? 1 : -1, graine: (g + 1) >>> 0 });
    }
    if (aUnMur && jets[1][0] < dens.os) ajouter('os', 1);
    if (jets[2][0] < dens.caillou) ajouter('caillou', 2);
    if (jets[3][0] < dens.mousse) ajouter('mousse', 3);
    if (jets[4][0] < dens.feuille) ajouter('feuille', 4);
    if (dens.touffe > 0) {
      const fx = ((x + 0.5) / CASES_PAR_TUILE + dx) % 1, fy = ((y + 0.5) / CASES_PAR_TUILE + dy) % 1;
      const dansLHerbe = plan.sol === 'herbe' || masqueVert(fx, fy) > SEUIL_HERBE + 0.01;
      if (jets[5][0] < (dansLHerbe ? dens.touffe : TOUFFE_HORS_HERBE)) ajouter('touffe', 5);
    }
  }
  return details;
}

// --- Dessin -----------------------------------------------------------------------------------------------

/** Dessine les détails d'une salle (l'origine du contexte est le coin nord-ouest de la pièce). `t` : pixels par case. */
export function dessinerDetails(ctx, plan, t) {
  const liste = semerDetails(plan, { graine: etat.graine, ambiance: etat.ambiance, etat: etat.etatSalle });
  if (!liste.length) return;
  ctx.save();
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const dessins = etat.details === 'riches' ? { ...DESSINS, ...DESSINS_RICHES } : DESSINS;
  for (const d of liste) dessins[d.sorte](ctx, alea(d.graine), d.x * t, d.y * t, t, d);
  ctx.restore();
}

/** Les dessins des détails, par sorte : `(ctx, r, x, y, t, détail)`. Les objets « ossements » et « toile d'araignée » (objets.js) réutilisent ceux de l'os et de la toile. */
export const DESSINS = {
  /** Une à trois pierres, gris chaud, cernées d'encre. */
  caillou(ctx, r, x, y, t) {
    for (let i = 0, n = 1 + ((r() * 3) | 0); i < n; i++) {
      const cx = x + (r() - 0.5) * t * 0.14, cy = y + (r() - 0.5) * t * 0.1, rr = t * (0.025 + r() * 0.035);
      ctx.beginPath(); ctx.ellipse(cx, cy, rr * 1.2, rr, r() * 3, 0, 7);
      encre(ctx, dr(ctx, cx, cy, rr * 1.2, '#b3b1a8', '#5d5c58'), 0.7);
    }
  },
  /** Une plaque de mousse : tache floue verte. */
  mousse(ctx, r, x, y, t) {
    const rr = t * (0.12 + r() * 0.13), g = ctx.createRadialGradient(x, y, 0, x, y, rr);
    g.addColorStop(0, 'rgba(80,112,52,0.85)'); g.addColorStop(0.6, 'rgba(72,104,44,0.5)'); g.addColorStop(1, 'rgba(72,104,44,0)');
    ctx.fillStyle = g; ctx.fillRect(x - rr, y - rr, rr * 2, rr * 2);
  },
  /** Une feuille morte : ocre, vert fané ou rouille, avec sa nervure. */
  feuille(ctx, r, x, y, t) {
    const a = r() * 6.28, l = t * (0.075 + r() * 0.06);
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    ctx.beginPath(); ctx.ellipse(0, 0, l, l * 0.45, 0, 0, 7); encre(ctx, ['#b8862e', '#8a9a3a', '#a4542a'][(r() * 3) | 0], 0.6);
    ctx.beginPath(); ctx.moveTo(-l, 0); ctx.lineTo(l, 0); trait(ctx, 'rgba(40,25,10,0.5)', 0.5);
    ctx.restore();
  },
  /** Une touffe d'herbe : sept à onze lames qui s'ouvrent en éventail. */
  touffe(ctx, r, x, y, t) {
    const k = t / 48, s = 0.9 + r() * 0.5, n = 7 + ((r() * 4) | 0);
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (i - n / 2) * 0.24 + (r() - 0.5) * 0.25, lg = s * (7 + r() * 7) * k, w = s * 1.6 * k;
      const tx = x + Math.cos(a) * lg, ty = y + Math.sin(a) * lg, px = -Math.sin(a) * w, py = Math.cos(a) * w;
      ctx.beginPath(); ctx.moveTo(x + px, y + py);
      ctx.quadraticCurveTo(x + Math.cos(a) * lg * 0.5 + px * 0.6, y + Math.sin(a) * lg * 0.5 + py * 0.6, tx, ty);
      ctx.quadraticCurveTo(x + Math.cos(a) * lg * 0.5 - px * 0.6, y + Math.sin(a) * lg * 0.5 - py * 0.6, x - px, y - py);
      ctx.closePath();
      const g = ctx.createLinearGradient(x, y, tx, ty);
      g.addColorStop(0, '#2f4a1c'); g.addColorStop(1, i % 3 ? '#9cc25e' : '#c9d97a');
      ctx.fillStyle = g; ctx.fill(); trait(ctx, 'rgba(25,38,14,0.8)', 0.6);
    }
  },
  /** Deux os croisés et un crâne. */
  os(ctx, r, x, y, t) {
    const k = t * 0.55, a = r() * 6.28, c = Math.cos(a), s = Math.sin(a);
    const R = (u, v) => [x + (u * c - v * s) * k, y + (u * s + v * c) * k];
    for (const [ax, ay, bx, by] of [[-0.35, 0.15, 0.05, 0.3], [0.1, -0.25, 0.4, 0.05]]) {
      ctx.beginPath(); ctx.moveTo(...R(ax, ay)); ctx.lineTo(...R(bx, by));
      trait(ctx, '#231b16', Math.max(2.5, t * 0.1)); trait(ctx, '#e7dfca', Math.max(1.6, t * 0.065));
    }
    ctx.beginPath(); ctx.ellipse(x, y, k * 0.15, k * 0.18, a - 0.3, 0, 7);
    encre(ctx, dr(ctx, x, y, k * 0.18, '#f6efdc', '#b3a688'), 1, true);
    for (const u of [-0.05, 0.05]) { const [ex, ey] = R(u, 0.02); ctx.beginPath(); ctx.ellipse(ex, ey, Math.max(1, k * 0.045), Math.max(1.2, k * 0.057), 0, 0, 7); ctx.fillStyle = '#2a2017'; ctx.fill(); }
  },
  /** Une toile d'araignée dans un coin : `sx`, `sy` donnent le sens du coin vers l'intérieur de la salle. */
  toile(ctx, r, x, y, t, d) {
    ctx.strokeStyle = 'rgba(230,232,238,0.6)'; ctx.lineWidth = 0.7;
    const L = t * (0.8 + r() * 0.2), rayons = [0, 0.25, 0.5, 0.75, 1].map((u) => (u * Math.PI) / 2);
    for (const a of rayons) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + d.sx * Math.cos(a) * L, y + d.sy * Math.sin(a) * L); ctx.stroke(); }
    for (const k of [0.3, 0.5, 0.7, 0.9]) {
      ctx.beginPath();
      rayons.forEach((a, i) => {
        const px = x + d.sx * Math.cos(a) * L * k, py = y + d.sy * Math.sin(a) * L * k;
        if (i) ctx.quadraticCurveTo(x + d.sx * Math.cos(a - 0.4) * L * k * 0.82, y + d.sy * Math.sin(a - 0.4) * L * k * 0.82, px, py); else ctx.moveTo(px, py);
      });
      ctx.stroke();
    }
  },
};

// --- Dessin « riches » : tons clairs et francs, aplats nets, cernés d'encre ----------------------------------------------------------------

const MOUSSE_V = ['#5f9a3e', '#8ccb52'], MOUSSE_CONTOUR = '#2f5a26';
const PIERRE_V = [['#c9c2b0', '#efe9d6'], ['#b4bcc4', '#e3eaf0'], ['#cdb98f', '#f1e4be']];
const TOUFFE_V = ['#4f9a38', '#8fd04e', '#c3e86c'];

/** Les dessins « riches » des détails semés, qui remplacent ceux de `DESSINS` quand `etat.details` est « riches » (les objets du thème gardent les leurs). */
export const DESSINS_RICHES = {
  /** Une à trois pierres : un aplat gris clair, un croissant plus clair côté lumière, un trait d'encre. */
  caillou(ctx, r, x, y, t) {
    for (let i = 0, n = 1 + ((r() * 3) | 0); i < n; i++) {
      const cx = x + (r() - 0.5) * t * 0.16, cy = y + (r() - 0.5) * t * 0.12, rr = t * (0.03 + r() * 0.04), c = PIERRE_V[(r() * PIERRE_V.length) | 0], a = r() * 3;
      ctx.beginPath(); ctx.ellipse(cx, cy, rr * 1.25, rr, a, 0, 7); encre(ctx, c[0], Math.max(0.8, t * 0.022));
      ctx.beginPath(); ctx.ellipse(cx - rr * 0.28, cy - rr * 0.3, rr * 0.55, rr * 0.35, a, 0, 7); ctx.fillStyle = c[1]; ctx.fill();
    }
  },
  /** Une plaque de mousse : trois à cinq boules qui se chevauchent, vert franc, un reflet clair, un trait sombre net. */
  mousse(ctx, r, x, y, t) {
    const rr = t * (0.07 + r() * 0.07), n = 3 + ((r() * 3) | 0), a0 = r() * 6.28, pts = [];
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const a = a0 + i * (6.28 / n) + (r() - 0.5) * 0.5, d = rr * (0.5 + r() * 0.4), rb = rr * (0.55 + r() * 0.3), px = x + Math.cos(a) * d, py = y + Math.sin(a) * d * 0.75;
      pts.push([px, py, rb]); ctx.moveTo(px + rb, py); ctx.arc(px, py, rb, 0, 6.29);
    }
    ctx.fillStyle = MOUSSE_V[0]; ctx.fill(); ctx.lineWidth = Math.max(0.8, t * 0.022); ctx.strokeStyle = MOUSSE_CONTOUR; ctx.stroke();
    ctx.beginPath();
    for (const [px, py, rb] of pts) { ctx.moveTo(px - rb * 0.25 + rb * 0.45, py - rb * 0.3); ctx.arc(px - rb * 0.25, py - rb * 0.3, rb * 0.45, 0, 6.29); }
    ctx.fillStyle = MOUSSE_V[1]; ctx.fill();
  },
  /** Une touffe d'herbe : sept à onze lames en éventail, deux tons plats, cernées d'encre. */
  touffe(ctx, r, x, y, t) {
    const k = t / 48, s = 0.9 + r() * 0.5, n = 7 + ((r() * 4) | 0);
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (i - n / 2) * 0.24 + (r() - 0.5) * 0.25, lg = s * (7 + r() * 7) * k, w = s * 1.7 * k;
      const tx = x + Math.cos(a) * lg, ty = y + Math.sin(a) * lg, px = -Math.sin(a) * w, py = Math.cos(a) * w;
      ctx.beginPath(); ctx.moveTo(x + px, y + py);
      ctx.quadraticCurveTo(x + Math.cos(a) * lg * 0.5 + px * 0.6, y + Math.sin(a) * lg * 0.5 + py * 0.6, tx, ty);
      ctx.quadraticCurveTo(x + Math.cos(a) * lg * 0.5 - px * 0.6, y + Math.sin(a) * lg * 0.5 - py * 0.6, x - px, y - py);
      ctx.closePath(); encre(ctx, TOUFFE_V[i % 3 === 0 ? 2 : i % 2 ? 1 : 0], Math.max(0.7, 0.9 * k));
    }
  },
  /** Deux os croisés et un crâne : aplats ivoire, crâne cerné d'encre sans dégradé ni ombre portée. */
  os(ctx, r, x, y, t) {
    const k = t * 0.55, a = r() * 6.28, c = Math.cos(a), s = Math.sin(a);
    const R = (u, v) => [x + (u * c - v * s) * k, y + (u * s + v * c) * k];
    for (const [ax, ay, bx, by] of [[-0.35, 0.15, 0.05, 0.3], [0.1, -0.25, 0.4, 0.05]]) {
      ctx.beginPath(); ctx.moveTo(...R(ax, ay)); ctx.lineTo(...R(bx, by));
      trait(ctx, '#231b16', Math.max(2.5, t * 0.1)); trait(ctx, '#f1e8cf', Math.max(1.6, t * 0.065));
    }
    ctx.beginPath(); ctx.ellipse(x, y, k * 0.15, k * 0.18, a - 0.3, 0, 7); encre(ctx, '#f6efdc', Math.max(1, t * 0.025));
    ctx.beginPath(); ctx.ellipse(x - k * 0.04, y - k * 0.05, k * 0.07, k * 0.08, a - 0.3, 0, 7); ctx.fillStyle = '#fffbee'; ctx.fill();
    for (const u of [-0.05, 0.05]) { const [ex, ey] = R(u, 0.02); ctx.beginPath(); ctx.ellipse(ex, ey, Math.max(1, k * 0.045), Math.max(1.2, k * 0.057), 0, 0, 7); ctx.fillStyle = '#2a2017'; ctx.fill(); }
  },
};
