/**
 * Thème « papier » : pour l'impression, en noir et blanc.
 * Fond blanc, traits noirs, gris clairs : lisible sans couleur, sobre en encre (aucun grand aplat sombre).
 * Même contrat que le thème vectoriel (voir themes/vectoriel.js), avec en plus :
 *   grille(ctx, plan, t)                  grille fine (le moteur utilise la sienne si le thème n'en fournit pas)
 *   opaciteCache                          un élément secret reste opaque : il se repère à son contour en pointillés et à son « S »
 *   marqueLiaison(ctx, rect, mur, t, p)   porte reliée : pastille « → N » (p.vers = numéro de la salle de destination)
 * Les tailles de trait sont proportionnelles à la case, avec un minimum en pixels (le canvas d'impression est à ~254 ppp).
 */
import { casesRetirees, retraitPorte, tracerSol, dessinerMursDecoupes } from '../../formes.js';
import { CREATURES } from '../../parseur/lexique.js';
import { dessinerPortrait } from '../portraits.js';

const NOIR = '#111', GRIS = '#8c8c8c', CLAIR = '#e4e4e4', TRES_CLAIR = '#f3f3f3';
/** Épaisseur de trait : proportionnelle à la case, jamais plus fine que 2 pixels. */
const trait = (t, k) => Math.max(2, t * k);

// --- Petites primitives ------------------------------------------------------
function rect(ctx, x, y, w, h, fond, contour, ep) {
  ctx.beginPath(); ctx.rect(x, y, w, h);
  if (fond) { ctx.fillStyle = fond; ctx.fill(); }
  if (contour) { ctx.strokeStyle = contour; ctx.lineWidth = ep; ctx.stroke(); }
}
function rectArrondi(ctx, x, y, w, h, r, fond, contour, ep) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
  if (fond) { ctx.fillStyle = fond; ctx.fill(); }
  if (contour) { ctx.strokeStyle = contour; ctx.lineWidth = ep; ctx.stroke(); }
}
function rond(ctx, x, y, r, fond, contour, ep) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  if (fond) { ctx.fillStyle = fond; ctx.fill(); }
  if (contour) { ctx.strokeStyle = contour; ctx.lineWidth = ep; ctx.stroke(); }
}
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
const epaisseur = (t) => t * 0.32;

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
  const W = plan.largeur * t, L = plan.longueur * t;
  const pos = (p.position + 0.5) * t;
  const d = retraitPorte(plan, p.mur, p.position) * t;
  const place = { nord: [pos, d, 0], sud: [pos, L - d, Math.PI], ouest: [d, pos, -Math.PI / 2], est: [W - d, pos, Math.PI / 2] }[p.mur];
  const ep = trait(t, 0.025);
  ctx.save();
  ctx.translate(place[0], place[1]);
  ctx.rotate(place[2]);
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

  escalier(ctx, w, h, t) {
    // Marches : traits parallèles, flèche vers le bas de l'escalier (l'arrière de la case).
    const ew = w * 0.86, eh = h * 0.94, n = 6;
    rect(ctx, -ew / 2, -eh / 2, ew, eh, '#fff', NOIR, trait(t, 0.03));
    ctx.beginPath();
    for (let i = 1; i < n; i++) { const y = -eh / 2 + (eh * i) / n; ctx.moveTo(-ew / 2, y); ctx.lineTo(ew / 2, y); }
    ctx.strokeStyle = GRIS; ctx.lineWidth = trait(t, 0.015); ctx.stroke();
    ctx.fillStyle = NOIR;
    ctx.beginPath(); ctx.moveTo(0, -eh * 0.38); ctx.lineTo(-t * 0.14, -eh * 0.14); ctx.lineTo(t * 0.14, -eh * 0.14); ctx.closePath(); ctx.fill();
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

  torche(ctx, w, h, t) {
    // Accrochée au mur, à l'arrière de la case : une flamme et ses rayons.
    const y = -h / 2 + t * 0.14;
    rect(ctx, -t * 0.04, -h / 2, t * 0.08, t * 0.12, NOIR);
    rond(ctx, 0, y, t * 0.09, '#fff', NOIR, trait(t, 0.02));
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      ctx.moveTo(Math.cos(a) * t * 0.14, y + Math.sin(a) * t * 0.14); ctx.lineTo(Math.cos(a) * t * 0.22, y + Math.sin(a) * t * 0.22);
    }
    ctx.strokeStyle = NOIR; ctx.lineWidth = trait(t, 0.015); ctx.stroke();
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

  inconnu(ctx, w, h, t) {
    rect(ctx, -w * 0.35, -h * 0.35, w * 0.7, h * 0.7, '#fff', NOIR, trait(t, 0.03));
    texte(ctx, '?', 0, 0, t * 0.4);
  },
};

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
  const dedans = { nord: [0, 1], sud: [0, -1], ouest: [1, 0], est: [-1, 0] }[mur];
  const cx = (r.x + r.l / 2) * t + dedans[0] * t * 0.4;
  const cy = (r.y + r.h / 2) * t + dedans[1] * t * 0.4;
  const rayon = Math.max(8, t * 0.18);
  ctx.save();
  rond(ctx, cx, cy, rayon, '#fff', NOIR, trait(t, 0.025));
  texte(ctx, p.vers ? `→${p.vers}` : '↔', cx, cy + rayon * 0.05, rayon * (p.vers && String(p.vers).length > 1 ? 0.8 : 1));
  ctx.restore();
}
