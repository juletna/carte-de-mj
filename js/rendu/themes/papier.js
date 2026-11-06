/**
 * Thème « papier » : pour l'impression, en noir et blanc.
 * Fond blanc, traits noirs, gris clairs : lisible sans couleur, sobre en encre (aucun grand aplat sombre).
 * Même contrat que le thème vectoriel (voir themes/vectoriel.js), avec en plus :
 *   grille(ctx, plan, t)                  grille fine (le moteur utilise la sienne si le thème n'en fournit pas)
 *   opaciteCache                          un élément secret reste opaque : il se repère à son contour en pointillés et à son « S »
 *   marqueLiaison(ctx, rect, mur, t, p)   porte reliée : pastille « → N » (p.vers = numéro de la salle de destination)
 * Les tailles de trait sont proportionnelles à la case, avec un minimum en pixels (le canvas d'impression est à ~254 ppp).
 */
import { casesRetirees } from '../../formes.js';
import { tracerSol, dessinerMursDecoupes } from '../trace.js';
import { rect, rectArrondi, rond, sensDuCoin, contourIrregulier, toileDans, hasard } from './commun.js';
import { EPAISSEUR_MUR, ancragePorte } from '../geometrie.js';
import { CREATURES, varianteDe, aUneVariante } from '../../catalogue.js';
import { TEINTES_TISSU } from '../teintes-tissu.js';
import { teinteFlamme, fumee, cendres } from '../feu.js';
import { dessinerPortrait } from '../portraits.js';

const NOIR = '#111', GRIS = '#8c8c8c', CLAIR = '#e4e4e4', TRES_CLAIR = '#f3f3f3';
/** Épaisseur de trait : proportionnelle à la case, jamais plus fine que 2 pixels. */
const trait = (t, k) => Math.max(2, t * k);

// --- Petites primitives (rect, rectArrondi et rond sont dans commun.js) -----------
function ligne(ctx, x1, y1, x2, y2, ep, couleur = NOIR) {
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
  ctx.strokeStyle = couleur; ctx.lineWidth = ep; ctx.stroke();
}
/** Hachures obliques dans la forme tracée par `forme` (qui construit le chemin). */
function hachures(ctx, forme, x, y, w, h, pas, ep) {
  ctx.save();
  ctx.beginPath(); forme(); ctx.clip();
  ctx.strokeStyle = GRIS; ctx.lineWidth = ep;
  ctx.beginPath();
  for (let d = -h; d < w; d += pas) { ctx.moveTo(x + d, y + h); ctx.lineTo(x + d + h, y); }
  ctx.stroke();
  ctx.restore();
}
/** `n` petits traits qui rayonnent autour de (x, y), de la distance `r0` à `r1` : une flamme ou un objet qui luit. */
function rayons(ctx, x, y, r0, r1, n, t, couleur = NOIR) {
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.2;
    ctx.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0); ctx.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1);
  }
  ctx.strokeStyle = couleur; ctx.lineWidth = trait(t, 0.015); ctx.stroke();
}
/** Les rayons d'un feu magique sont en tirets (le papier n'a pas de couleur) ; ceux d'un feu éteint ne sont pas tracés : un moignon noirci, des cendres et un filet de fumée. */
function rayonsFeu(ctx, T, x, y, r0, r1, n, t) {
  if (T.magique) ctx.setLineDash([t * 0.03, t * 0.03]);
  rayons(ctx, x, y, r0, r1, n, t);
  if (T.magique) ctx.setLineDash([]);
}
function feuEteint(ctx, x, y, u) {
  cendres(ctx, x, y + u * 0.04, u * 0.12, u * 0.08);
  rond(ctx, x, y, u * 0.05, NOIR);
  fumee(ctx, x, y - u * 0.05, u * 0.5, { largeur: Math.max(1, u * 0.02), couleur: '60,60,60' });
}
function texte(ctx, s, x, y, taille, couleur = NOIR) {
  ctx.fillStyle = couleur;
  ctx.font = `700 ${taille}px system-ui, sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(s, x, y);
}

// --- Fond, sol, grille, murs, portes -------------------------------------------
export const opaciteCache = 1;

export function roche(ctx, W, H) {
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, W, H);
}

/** Le sol reste blanc : c'est la grille qui compte pour les figurines. */
export function sol(ctx, plan, t) {
  ctx.fillStyle = '#fff';
  tracerSol(ctx, plan, t);
  ctx.fill();
}

export function grille(ctx, plan, t) {
  ctx.save();
  tracerSol(ctx, plan, t);
  ctx.clip();
  ctx.strokeStyle = GRIS;
  ctx.lineWidth = trait(t, 0.012);
  ctx.beginPath();
  for (let x = 0; x <= plan.largeur; x++) { ctx.moveTo(x * t, 0); ctx.lineTo(x * t, plan.longueur * t); }
  for (let y = 0; y <= plan.longueur; y++) { ctx.moveTo(0, y * t); ctx.lineTo(plan.largeur * t, y * t); }
  ctx.stroke();
  ctx.restore();
}

/** Épaisseur du mur : à l'extérieur de la pièce (comme le thème vectoriel), gris clair cerné de noir. */
const epaisseur = (t) => t * EPAISSEUR_MUR;

export function murs(ctx, plan, t) {
  const e = epaisseur(t);
  if (casesRetirees(plan).size) { dessinerMursDecoupes(ctx, plan, t, e, { fond: CLAIR, trait: NOIR, epaisseurTrait: trait(t, 0.025), joints: false }); return; }
  const W = plan.largeur * t, L = plan.longueur * t;
  ctx.save();
  ctx.fillStyle = CLAIR;
  ctx.fillRect(-e, -e, W + 2 * e, e);
  ctx.fillRect(-e, L, W + 2 * e, e);
  ctx.fillRect(-e, 0, e, L);
  ctx.fillRect(W, 0, e, L);
  ctx.strokeStyle = NOIR; ctx.lineWidth = trait(t, 0.025);
  ctx.strokeRect(-e, -e, W + 2 * e, L + 2 * e);
  ctx.strokeRect(0, 0, W, L);
  ctx.restore();
}

export function porte(ctx, p, plan, t) {
  const e = epaisseur(t);
  const place = ancragePorte(plan, p.mur, p.position, t);
  const ep = trait(t, 0.025);
  ctx.save();
  ctx.translate(place.x, place.y);
  ctx.rotate(place.angle);
  const o = t * 0.9; // largeur de l'ouverture
  rect(ctx, -o / 2, -e - 1, o, e + 2, '#fff'); // l'ouverture efface le mur
  if (p.type === 'arche') {
    ligne(ctx, -o / 2, -e, -o / 2, 0, ep * 1.6); ligne(ctx, o / 2, -e, o / 2, 0, ep * 1.6);
  } else if (p.type === 'herse') {
    ctx.beginPath();
    for (let i = 0; i <= 5; i++) { const x = -o / 2 + (o * i) / 5; ctx.moveTo(x, -e); ctx.lineTo(x, 0); }
    ctx.moveTo(-o / 2, -e / 2); ctx.lineTo(o / 2, -e / 2);
    ctx.strokeStyle = NOIR; ctx.lineWidth = ep; ctx.stroke();
  } else {
    // Battant entrouvert vers l'intérieur, avec l'arc d'ouverture en pointillés.
    ctx.setLineDash([t * 0.05, t * 0.05]);
    ctx.beginPath(); ctx.arc(-o / 2, 0, o, 0, Math.PI / 2.6);
    ctx.strokeStyle = GRIS; ctx.lineWidth = trait(t, 0.012); ctx.stroke();
    ctx.setLineDash([]);
    rect(ctx, -o / 2, -e * 0.75, o, e * 0.5, '#fff', NOIR, ep);
    rond(ctx, o / 2 - t * 0.12, -e / 2, t * 0.035, NOIR);
  }
  ctx.restore();
}

// --- Pions (créatures) ---------------------------------------------------------

const ABREVIATIONS = Object.fromEntries(CREATURES.map((c) => [c.type, c.abr]));
const R_PORTRAIT_MIN = 11; // px : sous ce rayon, un pion garde son abréviation (comme le thème vectoriel)

/**
 * Un pion rond par créature, couvrant ses cases. Le camp se lit sans couleur, à l'anneau :
 * personnage = blanc, PNJ = gris clair, monstre = anneau hachuré et doublé. Le portrait du type occupe
 * le centre sur fond gris clair, pour ménager l'encre (les couleurs se rendent en gris) ; sans portrait, ou trop petit, c'est l'abréviation.
 */
export function pion(ctx, k, t) {
  const cote = k.taille * t;
  const cx = k.x * t + cote / 2, cy = k.y * t + cote / 2;
  const r = cote * 0.42;
  const ep = trait(t, 0.035);
  rond(ctx, cx, cy, r, k.camp === 'pnj' ? CLAIR : '#fff', NOIR, ep);
  if (k.camp === 'monstre') {
    hachures(ctx, () => ctx.arc(cx, cy, r, 0, Math.PI * 2), cx - r, cy - r, 2 * r, 2 * r, t * 0.09, trait(t, 0.012));
    rond(ctx, cx, cy, r * 0.84, null, NOIR, trait(t, 0.015));
  }
  // Le portrait laisse visible l'anneau du camp ; un liseré noir le sépare de la trame.
  const portrait = r >= R_PORTRAIT_MIN && dessinerPortrait(ctx, k.type, cx, cy, r * 0.76, CLAIR);
  if (portrait) {
    rond(ctx, cx, cy, r * 0.76, null, NOIR, trait(t, 0.02));
  } else {
    const s = k.camp === 'pj' ? `P${k.numero}` : ABREVIATIONS[k.type] || '?';
    // Un disque blanc sous le texte garde les lettres lisibles sur les hachures.
    if (k.camp === 'monstre') rond(ctx, cx, cy, r * 0.5, '#fff');
    texte(ctx, s, cx, cy + r * 0.04, r * (s.length > 2 ? 0.5 : 0.62));
  }
  if (k.camp !== 'pj') {
    const pr = Math.max(7, t * 0.17);
    const px = cx + r * 0.72, py = cy - r * 0.72;
    rond(ctx, px, py, pr, '#fff', NOIR, trait(t, 0.02));
    texte(ctx, String(k.numero), px, py + pr * 0.06, pr * 1.2);
  }
}

// --- Objets ------------------------------------------------------------------
// Chaque fonction reçoit (ctx, w, h, t, objet), origine au centre de l'objet, avant vers le bas (+y).
export const objets = {
  pilier(ctx, w, h, t) {
    const r = Math.min(w, h) * 0.4;
    rond(ctx, 0, 0, r, CLAIR, NOIR, trait(t, 0.03));
    rond(ctx, 0, 0, r * 0.5, null, GRIS, trait(t, 0.015));
  },

  colonne(ctx, w, h, t) {
    const s = Math.min(w, h) * 0.86;
    rect(ctx, -s / 2, -s / 2, s, s, TRES_CLAIR, NOIR, trait(t, 0.03));
    rond(ctx, 0, 0, s * 0.36, CLAIR, NOIR, trait(t, 0.02));
  },

  coffre(ctx, w, h, t) {
    const cw = w * 0.78, ch = h * 0.56;
    rectArrondi(ctx, -cw / 2, -ch / 2, cw, ch, t * 0.06, CLAIR, NOIR, trait(t, 0.03));
    ligne(ctx, -cw / 2, -ch * 0.15, cw / 2, -ch * 0.15, trait(t, 0.02)); // couvercle
    rect(ctx, -t * 0.05, ch / 2 - t * 0.14, t * 0.1, t * 0.12, '#fff', NOIR, trait(t, 0.015)); // serrure (devant)
  },

  statue(ctx, w, h, t) {
    const r = Math.min(w, h) * 0.42;
    rond(ctx, 0, 0, r, CLAIR, NOIR, trait(t, 0.03));                 // socle
    ctx.beginPath(); ctx.ellipse(0, -r * 0.05, r * 0.7, r * 0.34, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#fff'; ctx.fill(); ctx.strokeStyle = NOIR; ctx.lineWidth = trait(t, 0.02); ctx.stroke(); // épaules
    rond(ctx, 0, r * 0.12, r * 0.26, '#fff', NOIR, trait(t, 0.02));  // tête, tournée vers l'avant
    ctx.beginPath(); ctx.moveTo(-r * 0.15, r * 0.55); ctx.lineTo(r * 0.15, r * 0.55); ctx.lineTo(0, r * 0.82); ctx.closePath();
    ctx.fillStyle = NOIR; ctx.fill();
  },

  table(ctx, w, h, t) {
    const tw = w - t * 0.16, th = h - t * 0.2;
    rectArrondi(ctx, -tw / 2, -th / 2, tw, th, t * 0.08, TRES_CLAIR, NOIR, trait(t, 0.03));
    ctx.beginPath();
    for (let i = 1; i < 3; i++) { const y = -th / 2 + (th * i) / 3; ctx.moveTo(-tw / 2 + t * 0.06, y); ctx.lineTo(tw / 2 - t * 0.06, y); }
    ctx.strokeStyle = GRIS; ctx.lineWidth = trait(t, 0.012); ctx.stroke();
  },

  chaise(ctx, w, h, t) {
    const s = Math.min(w, h) * 0.5;
    rect(ctx, -s / 2, -s / 2, s, s, '#fff', NOIR, trait(t, 0.025));
    rect(ctx, -s / 2, -s / 2, s, s * 0.22, NOIR);                     // dossier à l'arrière
  },

  autel(ctx, w, h, t) {
    const aw = w - t * 0.14, ah = h - t * 0.3;
    rect(ctx, -aw / 2, -ah / 2, aw, ah, CLAIR, NOIR, trait(t, 0.03));
    rect(ctx, -aw * 0.18, -ah / 2, aw * 0.36, ah, '#fff', NOIR, trait(t, 0.015)); // nappe
    rond(ctx, -aw * 0.36, 0, t * 0.06, '#fff', NOIR, trait(t, 0.015));
    rond(ctx, aw * 0.36, 0, t * 0.06, '#fff', NOIR, trait(t, 0.015));            // bougies
  },

  trone(ctx, w, h, t) {
    const s = Math.min(w, h) * 0.82;
    rectArrondi(ctx, -s / 2, -s / 2, s, s * 0.32, t * 0.05, CLAIR, NOIR, trait(t, 0.03));   // dossier
    rect(ctx, -s / 2, -s * 0.18, s * 0.16, s * 0.68, CLAIR, NOIR, trait(t, 0.02));          // accoudoirs
    rect(ctx, s / 2 - s * 0.16, -s * 0.18, s * 0.16, s * 0.68, CLAIR, NOIR, trait(t, 0.02));
    rect(ctx, -s * 0.34, -s * 0.18, s * 0.68, s * 0.62, '#fff', NOIR, trait(t, 0.02));      // assise
  },

  tonneau(ctx, w, h, t) {
    const r = Math.min(w, h) * 0.36;
    rond(ctx, 0, 0, r, TRES_CLAIR, NOIR, trait(t, 0.03));
    rond(ctx, 0, 0, r * 0.7, null, GRIS, trait(t, 0.015)); // cerclage
    rond(ctx, 0, 0, r * 0.25, NOIR);
  },

  caisse(ctx, w, h, t) {
    const s = Math.min(w, h) * 0.72;
    rect(ctx, -s / 2, -s / 2, s, s, TRES_CLAIR, NOIR, trait(t, 0.03));
    ctx.beginPath(); ctx.moveTo(-s / 2, -s / 2); ctx.lineTo(s / 2, s / 2); ctx.moveTo(s / 2, -s / 2); ctx.lineTo(-s / 2, s / 2);
    ctx.strokeStyle = GRIS; ctx.lineWidth = trait(t, 0.015); ctx.stroke();
  },

  escalier(ctx, w, h, t, o) {
    // Marches : traits parallèles, flèche vers l'arrière de la case : pleine s'il descend, évidée s'il monte.
    const ew = w * 0.86, eh = h * 0.94, n = 6;
    rect(ctx, -ew / 2, -eh / 2, ew, eh, '#fff', NOIR, trait(t, 0.03));
    ctx.beginPath();
    for (let i = 1; i < n; i++) { const y = -eh / 2 + (eh * i) / n; ctx.moveTo(-ew / 2, y); ctx.lineTo(ew / 2, y); }
    ctx.strokeStyle = GRIS; ctx.lineWidth = trait(t, 0.015); ctx.stroke();
    const monte = o?.sens === 'monte';
    ctx.fillStyle = monte ? '#fff' : NOIR;
    ctx.beginPath(); ctx.moveTo(0, -eh * 0.38); ctx.lineTo(-t * 0.14, -eh * 0.14); ctx.lineTo(t * 0.14, -eh * 0.14); ctx.closePath(); ctx.fill();
    if (monte) { ctx.strokeStyle = NOIR; ctx.lineWidth = trait(t, 0.02); ctx.stroke(); }
  },

  fosse(ctx, w, h, t) {
    // Une fosse est hachurée, pas noircie : on économise l'encre.
    const fw = w * 0.9, fh = h * 0.9;
    const forme = () => ctx.roundRect(-fw / 2, -fh / 2, fw, fh, t * 0.12);
    ctx.beginPath(); forme(); ctx.fillStyle = TRES_CLAIR; ctx.fill();
    hachures(ctx, forme, -fw / 2, -fh / 2, fw, fh, t * 0.1, trait(t, 0.015));
    ctx.beginPath(); forme(); ctx.strokeStyle = NOIR; ctx.lineWidth = trait(t, 0.035); ctx.stroke();
  },

  lit(ctx, w, h, t) {
    const lw = w * 0.8, lh = h - t * 0.12;
    rect(ctx, -lw / 2, -lh / 2, lw, lh, '#fff', NOIR, trait(t, 0.03));
    rect(ctx, -lw / 2, -lh / 2 + lh * 0.3, lw, lh * 0.7, CLAIR, NOIR, trait(t, 0.015)); // couverture
    rectArrondi(ctx, -lw / 2 + t * 0.05, -lh / 2 + t * 0.05, lw - t * 0.1, lh * 0.2, t * 0.05, '#fff', NOIR, trait(t, 0.015)); // oreiller (à l'arrière)
  },

  bibliotheque(ctx, w, h, t) {
    const bw = w - t * 0.08, bh = h * 0.5;
    const y0 = -h / 2 + t * 0.04; // collée au mur (arrière)
    rect(ctx, -bw / 2, y0, bw, bh, CLAIR, NOIR, trait(t, 0.03));
    const n = Math.max(4, Math.round(bw / (t * 0.12)));
    ctx.beginPath();
    for (let i = 1; i < n; i++) { const x = -bw / 2 + (bw * i) / n; ctx.moveTo(x, y0 + bh * 0.25); ctx.lineTo(x, y0 + bh * 0.9); }
    ctx.strokeStyle = GRIS; ctx.lineWidth = trait(t, 0.012); ctx.stroke();
  },

  torche(ctx, w, h, t, o) {
    // Accrochée au mur, à l'arrière de la case : une flamme et ses rayons.
    const y = -h / 2 + t * 0.14, T = teinteFlamme(o);
    rect(ctx, -t * 0.04, -h / 2, t * 0.08, t * 0.12, NOIR);
    if (T.eteint) { feuEteint(ctx, 0, y, t); return; }
    rond(ctx, 0, y, t * 0.09, '#fff', NOIR, trait(t, 0.02));
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      ctx.moveTo(Math.cos(a) * t * 0.14, y + Math.sin(a) * t * 0.14); ctx.lineTo(Math.cos(a) * t * 0.22, y + Math.sin(a) * t * 0.22);
    }
    if (T.magique) ctx.setLineDash([t * 0.03, t * 0.03]);
    ctx.strokeStyle = NOIR; ctx.lineWidth = trait(t, 0.015); ctx.stroke();
    if (T.magique) ctx.setLineDash([]);
  },

  debris(ctx, w, h, t, o) {
    // Petits éclats irréguliers, différents pour chaque case (graine = position).
    const alea = (i, k) => { const v = Math.sin((o.x * 13 + o.y * 7 + i * 3.7 + k * 1.3) * 12.9898) * 43758.5453; return v - Math.floor(v); };
    for (let i = 0; i < 6; i++) {
      const a = alea(i, 1), b = alea(i, 2);
      const cx = (a - 0.5) * w * 0.7, cy = (b - 0.5) * h * 0.7, r = t * (0.06 + a * 0.08);
      ctx.beginPath();
      for (let k = 0; k < 5; k++) {
        const ang = (k / 5) * Math.PI * 2 + a * 3, rr = r * (0.7 + alea(i, k + 3) * 0.6);
        k ? ctx.lineTo(cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr) : ctx.moveTo(cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr);
      }
      ctx.closePath();
      ctx.fillStyle = i % 2 ? CLAIR : '#fff'; ctx.fill();
      ctx.strokeStyle = NOIR; ctx.lineWidth = trait(t, 0.015); ctx.stroke();
    }
  },

  puits(ctx, w, h, t) {
    const r = Math.min(w, h) * 0.42;
    rond(ctx, 0, 0, r, CLAIR, NOIR, trait(t, 0.03));
    rond(ctx, 0, 0, r * 0.64, '#fff', NOIR, trait(t, 0.02));
    rond(ctx, 0, 0, r * 0.3, null, GRIS, trait(t, 0.012));
  },

  fontaine(ctx, w, h, t) {
    const r = Math.min(w, h) * 0.44;
    rond(ctx, 0, 0, r, TRES_CLAIR, NOIR, trait(t, 0.03));
    rond(ctx, 0, 0, r * 0.76, null, GRIS, trait(t, 0.015));
    rond(ctx, 0, 0, r * 0.22, CLAIR, NOIR, trait(t, 0.02));
  },

  sarcophage(ctx, w, h, t) {
    const sw = w * 0.74, sh = h - t * 0.14;
    rectArrondi(ctx, -sw / 2, -sh / 2, sw, sh, t * 0.15, CLAIR, NOIR, trait(t, 0.03));
    rectArrondi(ctx, -sw * 0.32, -sh * 0.4, sw * 0.64, sh * 0.8, t * 0.1, null, GRIS, trait(t, 0.015));
    rond(ctx, 0, -sh * 0.28, sw * 0.16, '#fff', GRIS, trait(t, 0.015)); // tête du gisant
  },

  brasero(ctx, w, h, t, o) {
    // Une vasque vue de dessus, une flamme en son centre et des rayons tout autour (comme la torche).
    const r = Math.min(w, h) * 0.32, T = teinteFlamme(o);
    rond(ctx, 0, 0, r, CLAIR, NOIR, trait(t, 0.035));
    rond(ctx, 0, 0, r * 0.7, '#fff', NOIR, trait(t, 0.015));
    if (T.eteint) { feuEteint(ctx, 0, 0, t * 1.4); return; }
    rond(ctx, 0, 0, r * 0.3, NOIR);
    rayonsFeu(ctx, T, 0, 0, r * 1.15, r * 1.55, 8, t);
  },

  bougies(ctx, w, h, t, o) {
    const T = teinteFlamme(o);
    for (const [x, y] of [[-0.17, 0.09], [0.15, 0.13], [0.02, -0.16]]) {
      rond(ctx, x * t, y * t, t * 0.07, '#fff', NOIR, trait(t, 0.02));
      rond(ctx, x * t, y * t, t * 0.025, NOIR);
      if (T.eteint) fumee(ctx, x * t, y * t - t * 0.03, t * 0.2, { largeur: 1, couleur: '60,60,60' });
      else rayonsFeu(ctx, T, x * t, y * t, t * 0.1, t * 0.15, 5, t);
    }
  },

  tapis(ctx, w, h, t, o) {
    const tw = w - t * 0.22, th = h - t * 0.22, x = -tw / 2, y = -th / 2, long = tw >= th;
    ctx.beginPath();                                                 // les franges, aux deux bouts les plus courts
    for (let k = t * 0.05; k < (long ? th : tw) - t * 0.03; k += t * 0.07) {
      if (long) { ctx.moveTo(x - t * 0.1, y + k); ctx.lineTo(x, y + k); ctx.moveTo(x + tw, y + k); ctx.lineTo(x + tw + t * 0.1, y + k); }
      else { ctx.moveTo(x + k, y - t * 0.1); ctx.lineTo(x + k, y); ctx.moveTo(x + k, y + th); ctx.lineTo(x + k, y + th + t * 0.1); }
    }
    ctx.strokeStyle = NOIR; ctx.lineWidth = trait(t, 0.012); ctx.stroke();
    const gris = aUneVariante(o) ? TEINTES_TISSU[varianteDe(o)]?.gris : null; // une autre couleur : son niveau de gris (noir et blanc)
    rect(ctx, x, y, tw, th, gris ?? TRES_CLAIR, NOIR, trait(t, 0.03));
    rect(ctx, x + t * 0.1, y + t * 0.1, tw - t * 0.2, th - t * 0.2, null, GRIS, trait(t, 0.02));
    const a = Math.min(tw / 2 - t * 0.2, th * 0.4 * (long ? 1.7 : 1)), b = Math.min(th / 2 - t * 0.2, tw * 0.4 * (long ? 1 : 1.7));
    for (const [k, fond] of [[1, '#fff'], [0.55, CLAIR], [0.2, NOIR]]) {   // le motif central : losanges emboîtés
      ctx.beginPath(); ctx.moveTo(-a * k, 0); ctx.lineTo(0, -b * k); ctx.lineTo(a * k, 0); ctx.lineTo(0, b * k); ctx.closePath();
      ctx.fillStyle = fond; ctx.fill(); ctx.strokeStyle = NOIR; ctx.lineWidth = trait(t, 0.015); ctx.stroke();
    }
  },

  banniere(ctx, w, h, t, o) {
    // Accrochée au mur, à l'arrière de la case : la barre, puis l'étoffe qui pend vers l'avant, à queue d'hirondelle.
    const y0 = -h / 2 + t * 0.03, lg = t * 0.58, bw = t * 0.46;
    ctx.beginPath(); ctx.moveTo(-bw / 2, y0); ctx.lineTo(bw / 2, y0); ctx.lineTo(bw / 2, y0 + lg); ctx.lineTo(0, y0 + lg * 0.78); ctx.lineTo(-bw / 2, y0 + lg); ctx.closePath();
    const gris = aUneVariante(o) ? TEINTES_TISSU[varianteDe(o)]?.gris : null, sombre = gris === '#5a5a5a'; // une couleur choisie : son niveau de gris ; l'emblème devient clair sur le noir
    ctx.fillStyle = gris ?? CLAIR; ctx.fill(); ctx.strokeStyle = NOIR; ctx.lineWidth = trait(t, 0.025); ctx.stroke();
    rond(ctx, 0, y0 + lg * 0.42, t * 0.07, sombre ? '#fff' : NOIR);   // l'emblème
    rect(ctx, -t * 0.31, y0 - t * 0.04, t * 0.62, t * 0.07, NOIR);     // la barre
  },

  feudecamp(ctx, w, h, t, o) {
    const R = Math.min(w, h) * 0.34, T = teinteFlamme(o);
    for (let i = 0; i < 9; i++) {                                      // le cercle de pierres
      const a = (i / 9) * Math.PI * 2 + 0.3;
      rond(ctx, Math.cos(a) * R * 1.05, Math.sin(a) * R * 1.05, t * 0.075, i % 2 ? CLAIR : '#fff', NOIR, trait(t, 0.02));
    }
    ctx.lineCap = 'round';
    for (const a of [0.4, 2.0, 3.6]) {                                 // les bûches
      ctx.beginPath(); ctx.moveTo(-Math.cos(a) * R * 0.7, -Math.sin(a) * R * 0.7); ctx.lineTo(Math.cos(a) * R * 0.7, Math.sin(a) * R * 0.7);
      ctx.strokeStyle = NOIR; ctx.lineWidth = trait(t, 0.08); ctx.stroke();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = trait(t, 0.035); ctx.stroke();
    }
    ctx.lineCap = 'butt';
    if (T.eteint) { feuEteint(ctx, 0, 0, t * 1.6); return; }
    rond(ctx, 0, 0, R * 0.3, '#fff', NOIR, trait(t, 0.02));
    rayonsFeu(ctx, T, 0, 0, R * 0.45, R * 0.75, 8, t);
  },

  flaque(ctx, w, h, t, o) {
    // De l'eau se dessine en traits horizontaux : contour fin et trois vaguelettes.
    contourIrregulier(ctx, w * 0.42, h * 0.36, o, 22, 0.16);
    ctx.fillStyle = TRES_CLAIR; ctx.fill(); ctx.strokeStyle = NOIR; ctx.lineWidth = trait(t, 0.025); ctx.stroke();
    ctx.beginPath();
    for (const [a, b, l] of [[-0.3, -0.12, 0.34], [0.02, 0.1, 0.24], [-0.16, 0.2, 0.16]]) {
      ctx.moveTo(a * w, b * h); ctx.quadraticCurveTo((a + l / 2) * w, (b - 0.08) * h, (a + l) * w, b * h);
    }
    ctx.strokeStyle = GRIS; ctx.lineWidth = trait(t, 0.015); ctx.stroke();
  },

  rocher(ctx, w, h, t, o) {
    const s = Math.min(w, h);
    contourIrregulier(ctx, s * 0.4, s * 0.36, o, 9, 0.16);
    ctx.fillStyle = CLAIR; ctx.fill(); ctx.strokeStyle = NOIR; ctx.lineWidth = trait(t, 0.035); ctx.stroke();
    contourIrregulier(ctx, s * 0.22, s * 0.2, o, 7, 0.2, 40);          // la facette du dessus
    ctx.fillStyle = TRES_CLAIR; ctx.fill(); ctx.strokeStyle = GRIS; ctx.lineWidth = trait(t, 0.015); ctx.stroke();
  },

  champignons(ctx, w, h, t) {
    for (const [x, y, r] of [[-0.2, 0.1, 0.1], [0.12, 0.18, 0.08], [0.1, -0.14, 0.11], [-0.12, -0.18, 0.07]]) {
      rond(ctx, x * t, y * t, r * t, '#fff', NOIR, trait(t, 0.02));
      rond(ctx, x * t, y * t, r * t * 0.3, GRIS);
    }
    rayons(ctx, 0, 0, t * 0.34, t * 0.44, 8, t, GRIS);                   // ils luisent
  },

  toile(ctx, w, h, t, o, plan) {
    const [sx, sy] = sensDuCoin(o, plan), cx = sx * w / 2, cy = sy * h / 2;
    toileDans(ctx, cx, cy, -sx, -sy, Math.min(w, h) * 0.98, NOIR, trait(t, 0.012));
  },

  ossements(ctx, w, h, t) {
    ctx.lineCap = 'round';
    for (const [ax, ay, bx, by] of [[-0.3, 0.12, 0.08, 0.28], [0.08, -0.24, 0.34, 0.06]]) {
      ctx.beginPath(); ctx.moveTo(ax * t, ay * t); ctx.lineTo(bx * t, by * t);
      ctx.strokeStyle = NOIR; ctx.lineWidth = trait(t, 0.11); ctx.stroke();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = trait(t, 0.06); ctx.stroke();
    }
    ctx.lineCap = 'butt';
    rond(ctx, 0, 0, t * 0.15, '#fff', NOIR, trait(t, 0.025));            // le crâne
    rond(ctx, -t * 0.05, -t * 0.01, t * 0.032, NOIR); rond(ctx, t * 0.05, -t * 0.01, t * 0.032, NOIR);
  },

  inconnu(ctx, w, h, t) {
    rect(ctx, -w * 0.35, -h * 0.35, w * 0.7, h * 0.7, '#fff', NOIR, trait(t, 0.03));
    texte(ctx, '?', 0, 0, t * 0.4);
  },
};

// --- États du mobilier (variantes du catalogue : coffre ouvert, tonneau couché…) ---------------------------------

/** Un polygone rempli puis cerné. */
function polygone(ctx, pts, fond, ep, couleur = NOIR) {
  ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath();
  if (fond) { ctx.fillStyle = fond; ctx.fill(); }
  if (ep) { ctx.strokeStyle = couleur; ctx.lineWidth = ep; ctx.stroke(); }
}
/** Un rectangle centré en (cx, cy) de côtés l × h, tourné de `a` radians. */
function rectTourne(cx, cy, l, h, a) {
  const c = Math.cos(a), s = Math.sin(a);
  return [[-l / 2, -h / 2], [l / 2, -h / 2], [l / 2, h / 2], [-l / 2, h / 2]].map(([x, y]) => [cx + x * c - y * s, cy + x * s + y * c]);
}
/** Un creux : une forme claire rayée de hachures grises (pas d'aplat sombre sur le papier). */
function creux(ctx, pts, t) {
  polygone(ctx, pts, TRES_CLAIR, trait(t, 0.015), GRIS);
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]), x = Math.min(...xs), y = Math.min(...ys);
  hachures(ctx, () => pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py))), x, y, Math.max(...xs) - x, Math.max(...ys) - y, t * 0.07, trait(t, 0.01));
}
const pieces = (ctx, t, pts) => pts.forEach(([x, y]) => rond(ctx, x, y, t * 0.045, '#fff', NOIR, trait(t, 0.012)));

function coffreOuvert(ctx, w, h, t, contenu) {
  const cw = w * 0.78, ch = h * 0.56, x = -cw / 2, y = -ch / 2;
  rectArrondi(ctx, x, y, cw, ch, t * 0.06, CLAIR, NOIR, trait(t, 0.03));
  creux(ctx, rectTourne(0, ch * 0.08, cw * 0.84, ch * 0.7, 0), t);
  if (contenu) {
    pieces(ctx, t, [[-cw * 0.25, ch * 0.1], [-cw * 0.08, ch * 0.2], [cw * 0.1, ch * 0.05], [cw * 0.27, ch * 0.22], [0, ch * 0.0], [-cw * 0.3, ch * 0.28]]);
    pieces(ctx, t, [[-cw * 0.2, ch * 0.62], [0, ch * 0.66], [cw * 0.25, ch * 0.6]]); // tombées devant
  }
  rect(ctx, x, y, cw, ch * 0.2, '#fff', NOIR, trait(t, 0.02)); // le couvercle relevé, vu par dessus
}
function coffreBrise(ctx, w, h, t) {
  const cw = w * 0.78, ch = h * 0.56, x = -cw / 2, y = -ch / 2;
  rectArrondi(ctx, x, y, cw, ch, t * 0.06, CLAIR, NOIR, trait(t, 0.03));
  creux(ctx, [[x + cw * 0.12, y + ch * 0.5], [x + cw * 0.3, y + ch * 0.3], [x + cw * 0.5, y + ch * 0.55], [x + cw * 0.68, y + ch * 0.3], [x + cw * 0.9, y + ch * 0.55], [x + cw * 0.7, y + ch * 0.85], [x + cw * 0.3, y + ch * 0.85]], t);
  ligne(ctx, x + cw * 0.08, y + ch * 0.05, x + cw * 0.22, y + ch * 0.3, trait(t, 0.02)); ligne(ctx, x + cw * 0.22, y + ch * 0.3, x + cw * 0.12, y + ch * 0.5, trait(t, 0.02));
  for (const [u, v, a] of [[0.1, 1.12, 0.4], [0.4, 1.16, -0.5], [0.85, 1.1, 0.2]]) polygone(ctx, rectTourne(x + cw * u, y + ch * v, t * 0.16, t * 0.05, a), '#fff', trait(t, 0.012));
}
function livres(ctx, x0, y0, bw, bh, t, largeur, trous, o, gris) {
  rect(ctx, x0, y0, bw, bh, CLAIR, NOIR, trait(t, 0.03));
  const n = Math.max(4, Math.round(bw / (t * largeur)));
  ctx.beginPath();
  for (let i = 0; i < n; i++) { if (hasard(o, i) < trous) continue; const x = x0 + (bw * i) / n; ctx.moveTo(x, y0 + bh * 0.25); ctx.lineTo(x, y0 + bh * 0.9); }
  ctx.strokeStyle = gris ? NOIR : GRIS; ctx.lineWidth = trait(t, gris ? 0.02 : 0.012); ctx.stroke();
}
const ETATS = {
  coffre: { ouvert: (ctx, w, h, t) => coffreOuvert(ctx, w, h, t, true), vide: (ctx, w, h, t) => coffreOuvert(ctx, w, h, t, false), brise: coffreBrise },
  bibliotheque: {
    clairsemee(ctx, w, h, t, o) { const bw = w - t * 0.08; livres(ctx, -bw / 2, -h / 2 + t * 0.04, bw, h * 0.5, t, 0.12, 0.5, o, false); },
    renversee(ctx, w, h, t, o) {
      const bw = w - t * 0.1, prof = h * 0.46, y0 = -h / 2 + t * 0.04;
      polygone(ctx, rectTourne(0, y0 + prof / 2, bw * 0.97, prof, 0.05), CLAIR, trait(t, 0.03));
      for (const k of [0.3, 0.55, 0.8]) ligne(ctx, -bw * 0.45, y0 + prof * k, bw * 0.45, y0 + prof * k, trait(t, 0.012), GRIS);
      for (let i = 0; i < 8; i++) polygone(ctx, rectTourne((hasard(o, i) - 0.5) * bw * 0.9, y0 + prof + t * 0.08 + hasard(o, i + 20) * (h / 2 - y0 - prof - t * 0.16), t * 0.13, t * 0.17, hasard(o, i + 40) * 3), '#fff', trait(t, 0.015));
    },
    grimoires(ctx, w, h, t, o) {
      const bw = w - t * 0.08, y0 = -h / 2 + t * 0.04;
      livres(ctx, -bw / 2, y0, bw, h * 0.5, t, 0.2, 0.03, o, true);
      rond(ctx, -bw * 0.28, y0 + h * 0.12, t * 0.06, '#fff', NOIR, trait(t, 0.015)); rond(ctx, bw * 0.28, y0 + h * 0.12, t * 0.04, GRIS, NOIR, trait(t, 0.012));
      ctx.setLineDash([t * 0.04, t * 0.03]); ligne(ctx, -bw / 2, y0 + h * 0.3, bw / 2, y0 + h * 0.3, trait(t, 0.015), GRIS); ctx.setLineDash([]); // la chaîne
    },
  },
  tonneau: {
    couche(ctx, w, h, t, o) {
      const s = Math.min(w, h), L = s * 0.45, W = s * 0.34, a = (hasard(o, 1) - 0.5) * 0.35, pts = [];
      for (let i = 0; i <= 10; i++) { const u = i / 5 - 1; pts.push([u * L, -W * (0.8 + 0.2 * Math.cos((u * Math.PI) / 2))]); }
      for (let i = 10; i >= 0; i--) { const u = i / 5 - 1; pts.push([u * L, W * (0.8 + 0.2 * Math.cos((u * Math.PI) / 2))]); }
      ctx.save(); ctx.rotate(a);
      polygone(ctx, pts, TRES_CLAIR, trait(t, 0.03));
      for (const u of [-0.7, -0.05, 0.6]) ligne(ctx, u * L, -W * 0.95, u * L, W * 0.95, trait(t, 0.02), GRIS);
      for (const v of [-0.4, 0.4]) ligne(ctx, -L * 0.95, v * W, L * 0.95, v * W, trait(t, 0.01), GRIS);
      rond(ctx, L * 0.2, W * 0.1, t * 0.04, NOIR);
      ctx.restore();
    },
    eventre(ctx, w, h, t, o) {
      const r = Math.min(w, h) * 0.34, fl = [], etoile = [];
      for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2, k = 0.82 + hasard(o, 10 + i) * 0.3; fl.push([r * 0.3 + Math.cos(a) * r * 1.05 * k, r * 0.4 + Math.sin(a) * r * 0.72 * k]); }
      ctx.setLineDash([t * 0.05, t * 0.04]); polygone(ctx, fl, CLAIR, trait(t, 0.015), GRIS); ctx.setLineDash([]); // la flaque
      rond(ctx, 0, 0, r, TRES_CLAIR, NOIR, trait(t, 0.03));
      for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2, rr = r * (i % 2 ? 0.34 : 0.7); etoile.push([Math.cos(a) * rr, Math.sin(a) * rr]); }
      creux(ctx, etoile, t);
      polygone(ctx, rectTourne(-r * 0.8, r * 0.75, r * 0.7, r * 0.14, 0.5), '#fff', trait(t, 0.012));
    },
  },
  sarcophage: {
    ouvert(ctx, w, h, t) {
      const sw = w * 0.74, sh = h - t * 0.14;
      rectArrondi(ctx, -sw / 2, -sh / 2, sw, sh, t * 0.15, CLAIR, NOIR, trait(t, 0.03));
      creux(ctx, rectTourne(0, 0, sw * 0.8, sh * 0.84, 0), t);
      rond(ctx, 0, -sh * 0.3, sw * 0.14, '#fff', NOIR, trait(t, 0.015));
      ctx.save(); ctx.translate(sw * 0.02, sh * 0.2); ctx.rotate(0.15);
      rectArrondi(ctx, -sw * 0.42, -sh * 0.28, sw * 0.84, sh * 0.56, t * 0.1, TRES_CLAIR, NOIR, trait(t, 0.03));
      ligne(ctx, 0, -sh * 0.2, 0, sh * 0.2, trait(t, 0.02), GRIS); ligne(ctx, -sw * 0.2, -sh * 0.06, sw * 0.2, -sh * 0.06, trait(t, 0.02), GRIS);
      ctx.restore();
    },
  },
  statue: {
    brisee(ctx, w, h, t) {
      const r = Math.min(w, h) * 0.42, dents = [];
      rond(ctx, 0, 0, r, CLAIR, NOIR, trait(t, 0.03));
      for (let i = 0; i < 11; i++) { const a = (i / 11) * Math.PI * 2, rr = r * (i % 2 ? 0.34 : 0.5); dents.push([Math.cos(a) * rr, Math.sin(a) * rr]); }
      polygone(ctx, dents, '#fff', trait(t, 0.02));
      rond(ctx, -r * 0.5, r * 0.5, r * 0.2, '#fff', NOIR, trait(t, 0.015)); // la tête tombée
      polygone(ctx, [[r * 0.5, r * 0.45], [r * 0.7, r * 0.6], [r * 0.45, r * 0.7]], '#fff', trait(t, 0.012));
    },
  },
  caisse: {
    ouverte(ctx, w, h, t, o) {
      const s = Math.min(w, h) * 0.62, x = -s / 2 - t * 0.08, y = -s / 2;
      rect(ctx, x, y, s, s, TRES_CLAIR, NOIR, trait(t, 0.03));
      for (let i = 0; i < 12; i++) { const px = x + s * (0.15 + 0.7 * hasard(o, i)), py = y + s * (0.15 + 0.7 * hasard(o, i + 30)), a = hasard(o, i + 60) * 6.28; ligne(ctx, px, py, px + Math.cos(a) * t * 0.14, py + Math.sin(a) * t * 0.14, trait(t, 0.012), GRIS); } // la paille
      rect(ctx, x + s + t * 0.01, y + s * 0.05, t * 0.2, s * 0.9, CLAIR, NOIR, trait(t, 0.02)); // le couvercle appuyé contre le flanc
    },
  },
  fontaine: {
    asec(ctx, w, h, t, o) {
      const r = Math.min(w, h) * 0.44;
      rond(ctx, 0, 0, r, TRES_CLAIR, NOIR, trait(t, 0.03));
      rond(ctx, 0, 0, r * 0.76, CLAIR, GRIS, trait(t, 0.015));
      ligne(ctx, -r * 0.55, -r * 0.2, -r * 0.3, 0, trait(t, 0.012), GRIS); ligne(ctx, -r * 0.3, 0, -r * 0.4, r * 0.25, trait(t, 0.012), GRIS); // une fissure
      for (let i = 0; i < 4; i++) { const a = hasard(o, i) * 6.28, d = r * (0.3 + hasard(o, i + 9) * 0.35); rond(ctx, Math.cos(a) * d, Math.sin(a) * d, t * 0.03, '#fff', NOIR, trait(t, 0.01)); } // feuilles mortes
      rond(ctx, 0, 0, r * 0.22, CLAIR, NOIR, trait(t, 0.02));
    },
    sombre(ctx, w, h, t, o) {
      const r = Math.min(w, h) * 0.44;
      rond(ctx, 0, 0, r, TRES_CLAIR, NOIR, trait(t, 0.03));
      rond(ctx, 0, 0, r * 0.76, GRIS, GRIS, trait(t, 0.015));                                  // l'eau trouble : un gris
      for (let i = 0; i < 4; i++) { const a = hasard(o, i) * 6.28, d = r * (0.25 + hasard(o, i + 9) * 0.4); rond(ctx, Math.cos(a) * d, Math.sin(a) * d, t * 0.04, '#fff', NOIR, trait(t, 0.01)); } // les bulles
      rond(ctx, 0, 0, r * 0.22, CLAIR, NOIR, trait(t, 0.02));
    },
    sacree(ctx, w, h, t) {
      const r = Math.min(w, h) * 0.44;
      rond(ctx, 0, 0, r, TRES_CLAIR, NOIR, trait(t, 0.03));
      rond(ctx, 0, 0, r * 0.76, null, GRIS, trait(t, 0.015));
      ctx.setLineDash([t * 0.05, t * 0.05]); rond(ctx, 0, 0, r * 1.18, null, NOIR, trait(t, 0.012)); ctx.setLineDash([]);   // la lueur, en pointillés
      rond(ctx, 0, 0, r * 0.22, CLAIR, NOIR, trait(t, 0.02));
      for (const [x, y] of [[-0.4, -0.3], [0.35, 0.3], [0.2, -0.45]]) { ligne(ctx, x * r - t * 0.04, y * r, x * r + t * 0.04, y * r, trait(t, 0.012)); ligne(ctx, x * r, y * r - t * 0.04, x * r, y * r + t * 0.04, trait(t, 0.012)); }
    },
  },
  autel: {
    rituel(ctx, w, h, t) {
      const aw = w - t * 0.14, ah = h - t * 0.3;
      rect(ctx, -aw / 2, -ah / 2, aw, ah, CLAIR, NOIR, trait(t, 0.03));
      rect(ctx, -aw * 0.34, -ah / 2, aw * 0.68, ah, GRIS, NOIR, trait(t, 0.015));                                 // la nappe
      for (const [x, y] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { rond(ctx, x * aw * 0.43, y * ah * 0.28, t * 0.055, '#fff', NOIR, trait(t, 0.015)); rond(ctx, x * aw * 0.43, y * ah * 0.28, t * 0.02, NOIR); }
      rond(ctx, 0, 0, t * 0.07, '#fff', NOIR, trait(t, 0.02));                                                     // la coupe
    },
    ensanglante(ctx, w, h, t, o) {
      const aw = w - t * 0.14, ah = h - t * 0.3;
      rect(ctx, -aw / 2, -ah / 2, aw, ah, CLAIR, NOIR, trait(t, 0.03));
      for (const [u, v, k] of [[-0.2, 0, 0.17], [0.08, 0.1, 0.12], [0.3, -0.1, 0.09]]) rond(ctx, aw * u, ah * v, ah * k * 1.4, NOIR);   // les taches, en noir plein
      for (const u of [-0.3, 0, 0.22]) ligne(ctx, aw * u, ah * 0.3, aw * u, ah * 0.5, trait(t, 0.035), NOIR);                              // les coulures
    },
    sacre(ctx, w, h, t) {
      const aw = w - t * 0.14, ah = h - t * 0.3, rs = ah * 0.15;
      rect(ctx, -aw / 2, -ah / 2, aw, ah, TRES_CLAIR, NOIR, trait(t, 0.035));
      rect(ctx, -aw * 0.23, -ah / 2, aw * 0.46, ah, '#fff', NOIR, trait(t, 0.015));
      for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.28; ligne(ctx, Math.cos(a) * rs * 1.3, Math.sin(a) * rs * 1.3, Math.cos(a) * rs * 2, Math.sin(a) * rs * 2, trait(t, 0.02)); }   // les rayons du soleil
      rond(ctx, 0, 0, rs, '#fff', NOIR, trait(t, 0.02));
      rond(ctx, -aw * 0.42, 0, t * 0.05, '#fff', NOIR, trait(t, 0.015)); rond(ctx, aw * 0.42, 0, t * 0.05, '#fff', NOIR, trait(t, 0.015));
    },
  },
  puits: {
    couvert(ctx, w, h, t) {
      const r = Math.min(w, h) * 0.42;
      rond(ctx, 0, 0, r, CLAIR, NOIR, trait(t, 0.03));
      rond(ctx, 0, 0, r * 0.76, '#fff', NOIR, trait(t, 0.02));
      for (const k of [-0.45, -0.15, 0.15, 0.45]) ligne(ctx, k * r * 0.76, -r * 0.7, k * r * 0.76, r * 0.7, trait(t, 0.01), GRIS);   // les planches
      for (const k of [-0.4, 0.4]) rect(ctx, -r * 0.7, k * r * 0.76 - r * 0.06, r * 1.4, r * 0.12, CLAIR, NOIR, trait(t, 0.012));
    },
    treuil(ctx, w, h, t) {
      const r = Math.min(w, h) * 0.42;
      rond(ctx, 0, 0, r, CLAIR, NOIR, trait(t, 0.03));
      rond(ctx, 0, 0, r * 0.64, '#fff', NOIR, trait(t, 0.02));
      ligne(ctx, -r * 0.92, 0, r * 0.92, 0, trait(t, 0.05), NOIR);                              // la poutre
      rect(ctx, -r * 0.98, -t * 0.05, t * 0.1, t * 0.1, '#fff', NOIR, trait(t, 0.015)); rect(ctx, r * 0.98 - t * 0.1, -t * 0.05, t * 0.1, t * 0.1, '#fff', NOIR, trait(t, 0.015));
      rond(ctx, 0, 0, r * 0.2, '#fff', NOIR, trait(t, 0.02)); rond(ctx, 0, 0, r * 0.1, null, GRIS, trait(t, 0.012));       // le seau
    },
  },
};
// Un état (variante non défaut) a son dessin ; l'état d'origine garde le dessin d'avant, appelé tel quel.
for (const type of Object.keys(ETATS)) {
  const origine = objets[type];
  objets[type] = (ctx, w, h, t, o, plan) => (ETATS[type][varianteDe(o)] ?? origine)(ctx, w, h, t, o, plan);
}

// --- Repères --------------------------------------------------------------------

/** Élément secret : contour en pointillés noirs et pastille « S » (se lit en noir et blanc). */
export function repereCache(ctx, r, t) {
  ctx.save();
  ctx.strokeStyle = NOIR;
  ctx.lineWidth = trait(t, 0.025);
  ctx.setLineDash([t * 0.1, t * 0.07]);
  ctx.beginPath();
  ctx.roundRect(r.x * t - 2, r.y * t - 2, r.l * t + 4, r.h * t + 4, t * 0.1);
  ctx.stroke();
  ctx.setLineDash([]);
  const pr = Math.max(7, t * 0.13);
  rond(ctx, r.x * t + pr * 0.4, r.y * t + pr * 0.4, pr, '#fff', NOIR, trait(t, 0.02));
  texte(ctx, 'S', r.x * t + pr * 0.4, r.y * t + pr * 0.45, pr * 1.3);
  ctx.restore();
}

/** Porte reliée : pastille côté pièce, avec le numéro de la salle derrière (« → 2 »). */
export function marqueLiaison(ctx, r, mur, t, p = {}) {
  const dedans = { nord: [0, 1], sud: [0, -1], ouest: [1, 0], est: [-1, 0] }[mur] || [0, 0]; // escalier : au milieu
  const cx = (r.x + r.l / 2) * t + dedans[0] * t * 0.4;
  const cy = (r.y + r.h / 2) * t + dedans[1] * t * 0.4;
  const rayon = Math.max(8, t * 0.18);
  ctx.save();
  rond(ctx, cx, cy, rayon, '#fff', NOIR, trait(t, 0.025));
  texte(ctx, p.vers ? `→${p.vers}` : '↔', cx, cy + rayon * 0.05, rayon * (p.vers && String(p.vers).length > 1 ? 0.8 : 1));
  ctx.restore();
}
