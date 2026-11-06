/**
 * Les feux de la carte (torche, brasero, bougies, feu de camp) : la couleur de leur flamme selon la variante, et le dessin commun d'un feu éteint.
 * Module sans état ni DOM (seulement un contexte 2D passé en argument) : les trois thèmes et la couche de lumière (themes/peint/lumiere.js) s'en servent,
 * pour qu'une même teinte serve à la flamme fixe, à la source de lumière et à la flamme animée. Les variantes elles-mêmes (id, noms, mots) sont dans
 * catalogue.js (VARIANTES_FEU) : ici, seulement leur aspect.
 *
 * Une teinte :
 *   clair, vif   haut et bas du dégradé de la flamme fixe (clair au cœur, vif à la base)
 *   flamme       la goutte de la flamme animée ; coeur : son cœur plus clair
 *   halo         [centre, bord] : couleur 'r,g,b' de la lueur peinte autour de la flamme fixe
 *   c            couleur 'r,g,b' de la source de lumière, ou null pour la couleur propre à l'objet (l'orange d'origine)
 *   braises      trois tons de braise, du plus clair au plus sombre (brasero, feu de camp) ; contourBraise : leur contour
 *   magique      un feu magique : il pulse plus lentement et sa lumière est plus froide et plus large (`RAYON_MAGIQUE`)
 *   eteint       pas de flamme ni de lumière : mèche charbonneuse, cendres grises, filet de fumée (`fumee`, `cendres`)
 */
import { varianteDe } from '../catalogue.js';

/** Une lumière magique éclaire un peu plus large que la flamme ordinaire. */
export const RAYON_MAGIQUE = 1.18;

const orange = { clair: '#fff0b0', vif: '#ff8a2a', flamme: '#f2862a', coeur: '#ffe07a', halo: ['255,190,90', '255,150,40'], c: null,
  braises: ['#ffd27a', '#ff8a3a', '#c43a1a'], contourBraise: '#4a140a', magique: false, eteint: false };

/** Les teintes de flamme par id de variante (voir VARIANTES_FEU dans catalogue.js). */
export const TEINTES_FLAMME = {
  normale: orange,
  eteinte: { ...orange, c: null, braises: ['#9a948c', '#6e6962', '#45413c'], contourBraise: '#2a2622', eteint: true },
  bleue: { clair: '#e6f6ff', vif: '#3f8cff', flamme: '#2f7be8', coeur: '#a8e4ff', halo: ['120,175,255', '70,130,255'], c: '110,170,255',
    braises: ['#bfe6ff', '#5aa2ff', '#2456b8'], contourBraise: '#0e2250', magique: true, eteint: false },
  verte: { clair: '#eaffd6', vif: '#3fcf5a', flamme: '#2fb54c', coeur: '#b6ff9a', halo: ['130,235,130', '60,200,90'], c: '110,230,120',
    braises: ['#d6ffb0', '#5fdc5a', '#1f8a3a'], contourBraise: '#0c3a18', magique: true, eteint: false },
  violette: { clair: '#f6e2ff', vif: '#a655e0', flamme: '#8e3fcf', coeur: '#e0b0ff', halo: ['190,130,245', '140,80,215'], c: '180,120,240',
    braises: ['#ecc8ff', '#b266ea', '#6a2aa6'], contourBraise: '#2e0e50', magique: true, eteint: false },
  argentee: { clair: '#ffffff', vif: '#b8d4ee', flamme: '#cfe3f5', coeur: '#ffffff', halo: ['220,235,255', '170,205,240'], c: '200,225,255',
    braises: ['#ffffff', '#cfe3f5', '#8fb0d0'], contourBraise: '#2a3c52', magique: true, eteint: false },
  infernale: { clair: '#ffb09a', vif: '#c8201c', flamme: '#a8141c', coeur: '#ff6a3a', halo: ['235,70,50', '170,20,30'], c: '225,60,45',
    braises: ['#ff7a4a', '#c8201c', '#6a0a14'], contourBraise: '#2a0408', magique: true, eteint: false },
};

/** La teinte de flamme d'un objet du plan (celle de sa variante ; l'orange d'origine si le type n'a pas de variantes ou si la variante est inconnue). */
export const teinteFlamme = (objet) => TEINTES_FLAMME[varianteDe(objet)] ?? TEINTES_FLAMME.normale;

/**
 * Un mince filet de fumée stylisé : une courbe en S qui monte et s'efface, du point (x, y) vers le haut sur `h` px (négatif : vers le bas de l'écran).
 * @param {number} h  hauteur du filet en px (> 0 : il monte)
 * @param {{largeur?:number, couleur?:string}} [o]  largeur du trait en px (1,6 par défaut), couleur 'r,g,b' (gris clair par défaut)
 */
export function fumee(ctx, x, y, h, { largeur = 1.6, couleur = '215,212,208' } = {}) {
  const ondes = [[0, 0], [0.3, 0.28], [-0.25, 0.6], [0.2, 0.85], [0, 1]];
  ctx.save();
  ctx.lineCap = 'round';
  for (let i = 0; i < ondes.length - 1; i++) {
    const [a, b] = [ondes[i], ondes[i + 1]], u = i / (ondes.length - 1);
    ctx.beginPath();
    ctx.moveTo(x + a[0] * h * 0.35, y - a[1] * h);
    ctx.quadraticCurveTo(x + (a[0] + b[0]) * h * 0.2 + (i % 2 ? -1 : 1) * h * 0.08, y - ((a[1] + b[1]) / 2) * h, x + b[0] * h * 0.35, y - b[1] * h);
    ctx.strokeStyle = `rgba(${couleur},${0.8 * (1 - u * 0.85)})`;
    ctx.lineWidth = Math.max(0.6, largeur * (1 - u * 0.55));
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Un petit tas de cendres grises à plat : une tache et quelques éclats clairs, sans hasard (le dessin ne change jamais d'une image à l'autre).
 * @param {number} rx,ry  demi-axes de la tache en px
 */
export function cendres(ctx, x, y, rx, ry = rx) {
  ctx.save();
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, 7);
  const g = ctx.createRadialGradient(x, y, 0, x, y, Math.max(rx, ry));
  g.addColorStop(0, 'rgba(150,146,140,0.95)'); g.addColorStop(1, 'rgba(95,91,86,0.8)');
  ctx.fillStyle = g; ctx.fill();
  for (let i = 0; i < 7; i++) {
    const a = i * 2.4, d = 0.15 + (i % 3) * 0.25;
    ctx.beginPath(); ctx.arc(x + Math.cos(a) * rx * d, y + Math.sin(a) * ry * d, Math.max(0.6, rx * 0.09), 0, 7);
    ctx.fillStyle = i % 2 ? 'rgba(205,201,195,0.9)' : 'rgba(55,52,48,0.85)'; ctx.fill();
  }
  ctx.restore();
}
