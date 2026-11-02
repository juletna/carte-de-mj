/**
 * Thème « vectoriel » : tout est dessiné en formes simples, sans image
 * externe (donc aucune question de licence).
 *
 * Contrat d'un thème :
 *   roche(ctx, largeurPx, hauteurPx, t)   fond autour de la pièce
 *   sol(ctx, plan, t)                     sol de la pièce
 *   murs(ctx, plan, t)                    murs (les portes sont dessinées par-dessus)
 *   porte(ctx, porte, plan, t)
 *   objets[type](ctx, w, h, t, objet)     dessin centré sur (0, 0) ; w × h en pixels ;
 *                                         l'AVANT de l'objet est vers le bas (+y)
 *   pion(ctx, creature, t)                pion d'une créature, en coordonnées de la pièce
 *                                         (creature.etat « blesse » ou « mort » : anneau en tirets et grosse pastille à croix, ou grisé et barré)
 *
 * Repères d'interface (facultatifs), rectangles { x, y, l, h } en CASES, origine au coin nord-ouest de la pièce :
 *   repereCache(ctx, rect, t)             contour en pointillés d'un élément secret
 *   marqueLiaison(ctx, rect, mur, t)      porte reliée à une autre salle
 *   marqueSelection(ctx, rect, t)         élément sélectionné
 */
import { dessinerPortrait } from '../portraits.js';
import { CREATURES, COULEURS } from '../../parseur/lexique.js';

const C = {
  roche: '#23211f', rocheClair: '#2e2b28',
  mur: '#5d5852', murClair: '#7a746c', murFonce: '#3a3632',
  bois: '#8b5a2b', boisClair: '#a87440', boisFonce: '#5a3818',
  or: '#d9a929', pierre: '#9c9a95', pierreClair: '#c3c0b9', pierreFonce: '#6c6a66',
  rouge: '#8e2323', tissu: '#3f5f8f', noir: '#0d0c0b', eau: '#3d7fb0', flamme: '#ffb43a',
};

const SOLS = {
  pierre: ['#7d7a74', '#85827b', '#77746e', '#8a877f'],
  marbre: ['#d8d4cc', '#e0dcd4', '#d0ccc4', '#e6e2da'],
  bois: ['#8a6038', '#93683f', '#80582f', '#9a6f45'],
  terre: ['#6e5a42', '#75604a', '#68543d', '#7a654d'],
  sable: ['#c9b282', '#d1ba8a', '#c2ab7b', '#d6c092'],
  herbe: ['#5c7a3e', '#648444', '#567338', '#6a8a48'],
  glace: ['#bcd8e6', '#c6e0ec', '#b2d0de', '#d0e6f0'],
};

/** Hachage d'une case : variations stables d'une case à l'autre. */
const hash = (x, y) => {
  let h = (x * 374761393 + y * 668265263) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

// --- Petites primitives ------------------------------------------------------
function rect(ctx, x, y, w, h, fond, trait, epaisseur = 1) {
  ctx.beginPath(); ctx.rect(x, y, w, h);
  if (fond) { ctx.fillStyle = fond; ctx.fill(); }
  if (trait) { ctx.strokeStyle = trait; ctx.lineWidth = epaisseur; ctx.stroke(); }
}
function rectArrondi(ctx, x, y, w, h, r, fond, trait, epaisseur = 1) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
  if (fond) { ctx.fillStyle = fond; ctx.fill(); }
  if (trait) { ctx.strokeStyle = trait; ctx.lineWidth = epaisseur; ctx.stroke(); }
}
function rond(ctx, x, y, r, fond, trait, epaisseur = 1) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  if (fond) { ctx.fillStyle = fond; ctx.fill(); }
  if (trait) { ctx.strokeStyle = trait; ctx.lineWidth = epaisseur; ctx.stroke(); }
}
/** Ombre portée douce sous un objet. */
function ombre(ctx, t, f) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = t * 0.15;
  ctx.shadowOffsetX = t * 0.04; ctx.shadowOffsetY = t * 0.06;
  f();
  ctx.restore();
}

// --- Fond, sol, murs, portes -------------------------------------------------
export function roche(ctx, W, H, t) {
  ctx.fillStyle = C.roche;
  ctx.fillRect(0, 0, W, H);
  // Quelques taches pour suggérer la roche.
  for (let i = 0; i < W / t; i++) for (let j = 0; j < H / t; j++) {
    if (hash(i, j) > 0.6) rond(ctx, (i + hash(j, i)) * t, (j + hash(i + 7, j)) * t, t * (0.1 + hash(j, i + 3) * 0.25), C.rocheClair);
  }
}

export function sol(ctx, plan, t) {
  const teintes = SOLS[plan.sol] || SOLS.pierre;
  for (let x = 0; x < plan.largeur; x++) for (let y = 0; y < plan.longueur; y++) {
    ctx.fillStyle = teintes[Math.floor(hash(x, y) * teintes.length)];
    ctx.fillRect(x * t, y * t, t, t);
    if (plan.sol === 'bois') { // lames de parquet
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(x * t, y * t + t / 2 - 0.5, t, 1);
    } else if (plan.sol === 'pierre' && hash(y, x) > 0.85) { // fissure
      ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x * t + t * 0.2, y * t + t * 0.3); ctx.lineTo(x * t + t * 0.5, y * t + t * 0.55); ctx.lineTo(x * t + t * 0.7, y * t + t * 0.5); ctx.stroke();
    }
  }
}

/** Épaisseur du mur : dessiné à l'extérieur de la pièce, sur la marge. */
const epaisseur = (t) => t * 0.32;

export function murs(ctx, plan, t) {
  const e = epaisseur(t);
  const W = plan.largeur * t, L = plan.longueur * t;
  ctx.save();
  ctx.fillStyle = C.mur;
  ctx.fillRect(-e, -e, W + 2 * e, e);       // nord
  ctx.fillRect(-e, L, W + 2 * e, e);        // sud
  ctx.fillRect(-e, 0, e, L);                // ouest
  ctx.fillRect(W, 0, e, L);                 // est
  // Joints de pierre
  ctx.strokeStyle = C.murFonce; ctx.lineWidth = 1;
  ctx.strokeRect(-e, -e, W + 2 * e, L + 2 * e);
  ctx.strokeRect(0, 0, W, L);
  ctx.beginPath();
  for (let x = 0; x <= plan.largeur; x++) { ctx.moveTo(x * t, -e); ctx.lineTo(x * t, 0); ctx.moveTo(x * t, L); ctx.lineTo(x * t, L + e); }
  for (let y = 0; y <= plan.longueur; y++) { ctx.moveTo(-e, y * t); ctx.lineTo(0, y * t); ctx.moveTo(W, y * t); ctx.lineTo(W + e, y * t); }
  ctx.stroke();
  ctx.restore();
}

export function porte(ctx, p, plan, t) {
  const e = epaisseur(t);
  const W = plan.largeur * t, L = plan.longueur * t;
  // Repère local : origine au milieu de l'ouverture, côté pièce vers +y.
  const pos = (p.position + 0.5) * t;
  const place = {
    nord: [pos, 0, 0], sud: [pos, L, Math.PI], ouest: [0, pos, -Math.PI / 2], est: [W, pos, Math.PI / 2],
  }[p.mur];
  ctx.save();
  ctx.translate(place[0], place[1]);
  ctx.rotate(place[2]);
  const o = t * 0.9; // largeur de l'ouverture
  // Ouverture : on efface le mur et on prolonge le sol.
  rect(ctx, -o / 2, -e - 1, o, e + 1, '#6f6b65');
  if (p.type === 'arche') {
    rect(ctx, -o / 2 - t * 0.06, -e, t * 0.12, e, C.murClair);
    rect(ctx, o / 2 - t * 0.06, -e, t * 0.12, e, C.murClair);
  } else if (p.type === 'herse') {
    ctx.strokeStyle = '#2b2b2b'; ctx.lineWidth = Math.max(1.5, t * 0.05);
    ctx.beginPath();
    for (let i = 0; i <= 5; i++) { const x = -o / 2 + (o * i) / 5; ctx.moveTo(x, -e); ctx.lineTo(x, 0); }
    ctx.moveTo(-o / 2, -e / 2); ctx.lineTo(o / 2, -e / 2);
    ctx.stroke();
  } else {
    // Battant en bois, entrouvert vers l'intérieur, avec l'arc d'ouverture.
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.setLineDash([t * 0.06, t * 0.06]); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(-o / 2, 0, o, 0, Math.PI / 2.6); ctx.stroke();
    ctx.setLineDash([]);
    rect(ctx, -o / 2, -e * 0.75, o, e * 0.5, C.bois, C.boisFonce, 1.5);
    ctx.strokeStyle = C.boisFonce; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 1; i < 4; i++) { const x = -o / 2 + (o * i) / 4; ctx.moveTo(x, -e * 0.75); ctx.lineTo(x, -e * 0.25); }
    ctx.stroke();
    rond(ctx, o / 2 - t * 0.12, -e / 2, t * 0.04, C.or);
  }
  ctx.restore();
}

// --- Pions (créatures) ---------------------------------------------------------

const ABREVIATIONS = Object.fromEntries(CREATURES.map((c) => [c.type, c.abr]));
const R_PORTRAIT_MIN = 11; // px : sous ce rayon, un pion affiche son abréviation
// Couleur du camp : bleu pour les joueurs, or pour les neutres, rouge pour les monstres.
const CAMP = { pj: '#2e6fd1', pnj: '#c9a227', monstre: '#b02a2a' };

/**
 * Un pion rond par créature, couvrant ses cases : la couleur indique le camp,
 * l'abréviation le type et la pastille le numéro.
 */
export function pion(ctx, k, t) {
  const cote = k.taille * t;
  const cx = k.x * t + cote / 2, cy = k.y * t + cote / 2;
  const r = cote * 0.42;
  const mort = k.etat === 'mort';
  const fond = mort ? '#6e6c68' : CAMP[k.camp] || CAMP.pnj;

  // Un pion mort est grisé (gris uni, sans anneau de couleur) et barré d'une croix : lisible sans la couleur.
  ctx.save();
  if (mort) ctx.globalAlpha *= 0.75;
  ombre(ctx, t, () => rond(ctx, cx, cy, r, fond));
  rond(ctx, cx, cy, r, fond, '#f4efe4', Math.max(2, t * 0.06));
  // Anneau de la couleur propre à la créature (dragon rouge, etc.).
  if (!mort && k.couleur && COULEURS[k.couleur]) rond(ctx, cx, cy, r * 0.8, null, COULEURS[k.couleur], Math.max(3, r * 0.18));

  // Portrait du monstre dans l'anneau du camp ; très petit, il deviendrait illisible : on garde alors l'abréviation.
  const portrait = !mort && r >= R_PORTRAIT_MIN && dessinerPortrait(ctx, k.type, cx, cy, r * 0.84);
  if (!portrait) {
    const texte = k.camp === 'pj' ? `P${k.numero}` : ABREVIATIONS[k.type] || '?';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `700 ${Math.max(9, r * (texte.length > 2 ? 0.62 : 0.8))}px system-ui, sans-serif`;
    ctx.fillText(texte, cx, cy + r * 0.04);
  }
  ctx.restore();

  // Pastille du numéro (inutile pour les PJ, déjà numérotés dans le pion).
  if (k.camp !== 'pj') {
    const pr = Math.max(7, t * 0.17);
    const px = cx + r * 0.72, py = cy - r * 0.72;
    rond(ctx, px, py, pr, '#f4efe4', '#1b1a17', 1.5);
    ctx.fillStyle = '#1b1a17';
    ctx.font = `700 ${pr * 1.2}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(k.numero), px, py + pr * 0.06);
  }

  if (mort) croix(ctx, cx, cy, r, t);
  else if (k.etat === 'blesse') pansement(ctx, cx, cy, r, t);
}

/** Pion mort : grande croix noire cernée de blanc, qui se lit aussi en noir et blanc. */
function croix(ctx, cx, cy, r, t) {
  const a = r * 0.78;
  ctx.save();
  ctx.lineCap = 'round';
  for (const [couleur, epaisseur] of [['#f4efe4', Math.max(6, r * 0.5)], ['#111', Math.max(3.5, r * 0.28)]]) {
    ctx.strokeStyle = couleur;
    ctx.lineWidth = epaisseur;
    ctx.beginPath();
    ctx.moveTo(cx - a, cy - a); ctx.lineTo(cx + a, cy + a);
    ctx.moveTo(cx + a, cy - a); ctx.lineTo(cx - a, cy + a);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Pion blessé : anneau en tirets (blanc sur sombre, lisible sans la couleur) autour du pion, et grosse pastille
 * blanche à croix rouge foncée en bas à gauche. Tout est proportionnel au pion (r), pas à une taille fixe.
 */
function pansement(ctx, cx, cy, r, t) {
  ctx.save();
  const anneau = r + Math.max(2.5, r * 0.1);
  const epais = Math.max(3.5, r * 0.15);
  rond(ctx, cx, cy, anneau, null, '#111', epais + Math.max(2, r * 0.08)); // fond sombre
  ctx.setLineDash([Math.max(5, r * 0.34), Math.max(3, r * 0.2)]);
  rond(ctx, cx, cy, anneau, null, '#fff', epais * 0.7);                   // tirets clairs : se lit en noir et blanc
  ctx.setLineDash([]);
  const pr = Math.max(11, r * 0.62);
  const px = cx - r * 0.74, py = cy + r * 0.74;
  rond(ctx, px, py, pr, '#fff', '#111', Math.max(2, pr * 0.14));
  ctx.strokeStyle = '#a01818';
  ctx.lineCap = 'butt';
  ctx.lineWidth = Math.max(4, pr * 0.46);
  ctx.beginPath();
  ctx.moveTo(px - pr * 0.6, py); ctx.lineTo(px + pr * 0.6, py);
  ctx.moveTo(px, py - pr * 0.6); ctx.lineTo(px, py + pr * 0.6);
  ctx.stroke();
  ctx.restore();
}

// --- Objets ------------------------------------------------------------------
// Chaque fonction reçoit (ctx, w, h, t, objet), origine au centre de l'objet.
export const objets = {
  pilier(ctx, w, h, t) {
    const r = Math.min(w, h) * 0.4;
    ombre(ctx, t, () => rond(ctx, 0, 0, r, C.pierre));
    const g = ctx.createRadialGradient(-r * 0.35, -r * 0.35, r * 0.1, 0, 0, r);
    g.addColorStop(0, C.pierreClair); g.addColorStop(1, C.pierreFonce);
    rond(ctx, 0, 0, r, g, C.murFonce, 1.5);
  },

  colonne(ctx, w, h, t) {
    const s = Math.min(w, h) * 0.86;
    ombre(ctx, t, () => rect(ctx, -s / 2, -s / 2, s, s, C.pierreFonce));
    rect(ctx, -s / 2, -s / 2, s, s, C.pierreFonce, C.murFonce, 1);
    const r = s * 0.38;
    const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
    g.addColorStop(0, C.pierreClair); g.addColorStop(1, C.pierre);
    rond(ctx, 0, 0, r, g, C.murFonce, 1);
    rond(ctx, 0, 0, r * 0.6, null, 'rgba(0,0,0,0.25)', 1);
  },

  coffre(ctx, w, h, t) {
    const cw = w * 0.78, ch = h * 0.56;
    ombre(ctx, t, () => rectArrondi(ctx, -cw / 2, -ch / 2, cw, ch, t * 0.06, C.bois));
    rectArrondi(ctx, -cw / 2, -ch / 2, cw, ch, t * 0.06, C.bois, C.boisFonce, 1.5);
    rect(ctx, -cw / 2, -ch * 0.12, cw, ch * 0.24, C.or);            // ferrure
    rect(ctx, -cw * 0.3, -ch / 2, cw * 0.08, ch, 'rgba(0,0,0,0.25)');
    rect(ctx, cw * 0.22, -ch / 2, cw * 0.08, ch, 'rgba(0,0,0,0.25)');
    rect(ctx, -t * 0.06, ch / 2 - t * 0.1, t * 0.12, t * 0.12, C.or, C.boisFonce, 1); // serrure (devant)
  },

  statue(ctx, w, h, t) {
    const r = Math.min(w, h) * 0.42;
    ombre(ctx, t, () => rond(ctx, 0, 0, r, C.pierreFonce));
    rond(ctx, 0, 0, r, C.pierreFonce, C.murFonce, 1.5);             // socle
    ctx.beginPath(); ctx.ellipse(0, -r * 0.05, r * 0.72, r * 0.36, 0, 0, Math.PI * 2);
    ctx.fillStyle = C.pierreClair; ctx.fill(); ctx.strokeStyle = C.pierreFonce; ctx.stroke(); // épaules
    rond(ctx, 0, r * 0.12, r * 0.28, C.pierreClair, C.pierreFonce, 1); // tête, tournée vers l'avant
    ctx.beginPath(); ctx.moveTo(-r * 0.15, r * 0.55); ctx.lineTo(r * 0.15, r * 0.55); ctx.lineTo(0, r * 0.85); ctx.closePath();
    ctx.fillStyle = C.or; ctx.fill(); // repère du regard
  },

  table(ctx, w, h, t) {
    const tw = w - t * 0.16, th = h - t * 0.2;
    ombre(ctx, t, () => rectArrondi(ctx, -tw / 2, -th / 2, tw, th, t * 0.08, C.boisClair));
    rectArrondi(ctx, -tw / 2, -th / 2, tw, th, t * 0.08, C.boisClair, C.boisFonce, 1.5);
    ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 1; ctx.beginPath();
    for (let i = 1; i < 3; i++) { const y = -th / 2 + (th * i) / 3; ctx.moveTo(-tw / 2 + 3, y); ctx.lineTo(tw / 2 - 3, y); }
    ctx.stroke();
  },

  chaise(ctx, w, h, t) {
    const s = Math.min(w, h) * 0.5;
    ombre(ctx, t, () => rect(ctx, -s / 2, -s / 2, s, s, C.bois));
    rect(ctx, -s / 2, -s / 2, s, s, C.bois, C.boisFonce, 1.5);
    rect(ctx, -s / 2, -s / 2, s, s * 0.22, C.boisFonce); // dossier à l'arrière
  },

  autel(ctx, w, h, t) {
    const aw = w - t * 0.14, ah = h - t * 0.3;
    ombre(ctx, t, () => rect(ctx, -aw / 2, -ah / 2, aw, ah, C.pierre));
    rect(ctx, -aw / 2, -ah / 2, aw, ah, C.pierre, C.pierreFonce, 1.5);
    rect(ctx, -aw * 0.18, -ah / 2, aw * 0.36, ah, C.rouge);        // nappe
    rond(ctx, -aw * 0.36, 0, t * 0.07, '#f1e7c9'); rond(ctx, aw * 0.36, 0, t * 0.07, '#f1e7c9'); // bougies
    rond(ctx, -aw * 0.36, 0, t * 0.03, C.flamme); rond(ctx, aw * 0.36, 0, t * 0.03, C.flamme);
  },

  trone(ctx, w, h, t) {
    const s = Math.min(w, h) * 0.82;
    ombre(ctx, t, () => rect(ctx, -s / 2, -s / 2, s, s, C.or));
    rectArrondi(ctx, -s / 2, -s / 2, s, s * 0.32, t * 0.05, C.or, C.boisFonce, 1.5);  // dossier
    rect(ctx, -s / 2, -s * 0.18, s * 0.16, s * 0.68, C.or, C.boisFonce, 1);           // accoudoirs
    rect(ctx, s / 2 - s * 0.16, -s * 0.18, s * 0.16, s * 0.68, C.or, C.boisFonce, 1);
    rect(ctx, -s * 0.34, -s * 0.18, s * 0.68, s * 0.62, C.rouge, C.boisFonce, 1);     // assise
  },

  tonneau(ctx, w, h, t) {
    const r = Math.min(w, h) * 0.36;
    ombre(ctx, t, () => rond(ctx, 0, 0, r, C.bois));
    rond(ctx, 0, 0, r, C.bois, C.boisFonce, 2);
    rond(ctx, 0, 0, r * 0.72, null, '#4a4a4a', Math.max(1.5, t * 0.04)); // cerclage
    rond(ctx, 0, 0, r * 0.3, C.boisFonce);
  },

  caisse(ctx, w, h, t) {
    const s = Math.min(w, h) * 0.72;
    ombre(ctx, t, () => rect(ctx, -s / 2, -s / 2, s, s, C.boisClair));
    rect(ctx, -s / 2, -s / 2, s, s, C.boisClair, C.boisFonce, 2);
    ctx.strokeStyle = C.boisFonce; ctx.lineWidth = Math.max(1.5, t * 0.04);
    ctx.beginPath(); ctx.moveTo(-s / 2, -s / 2); ctx.lineTo(s / 2, s / 2); ctx.moveTo(s / 2, -s / 2); ctx.lineTo(-s / 2, s / 2); ctx.stroke();
  },

  escalier(ctx, w, h, t) {
    // Marches de plus en plus sombres vers l'arrière : l'escalier descend.
    const ew = w * 0.86, eh = h * 0.94, n = 6;
    for (let i = 0; i < n; i++) {
      const v = 150 - i * 18;
      rect(ctx, -ew / 2, eh / 2 - (eh * (i + 1)) / n, ew, eh / n, `rgb(${v},${v - 4},${v - 10})`, 'rgba(0,0,0,0.5)', 1);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.beginPath(); ctx.moveTo(0, -eh * 0.3); ctx.lineTo(-t * 0.14, -eh * 0.1); ctx.lineTo(t * 0.14, -eh * 0.1); ctx.closePath(); ctx.fill();
  },

  fosse(ctx, w, h, t) {
    const fw = w * 0.9, fh = h * 0.9;
    const g = ctx.createRadialGradient(0, 0, Math.min(fw, fh) * 0.1, 0, 0, Math.max(fw, fh) * 0.7);
    g.addColorStop(0, C.noir); g.addColorStop(0.7, '#1c1a18'); g.addColorStop(1, '#3a3632');
    rectArrondi(ctx, -fw / 2, -fh / 2, fw, fh, t * 0.12, g, '#2a2724', 2);
  },

  lit(ctx, w, h, t) {
    const lw = w * 0.8, lh = h - t * 0.12;
    ombre(ctx, t, () => rect(ctx, -lw / 2, -lh / 2, lw, lh, C.boisFonce));
    rect(ctx, -lw / 2, -lh / 2, lw, lh, C.boisFonce, '#2f1d0c', 1.5);
    rect(ctx, -lw / 2 + 3, -lh / 2 + lh * 0.3, lw - 6, lh * 0.66, C.tissu);          // couverture
    rectArrondi(ctx, -lw / 2 + 4, -lh / 2 + 4, lw - 8, lh * 0.2, t * 0.05, '#ece6d8'); // oreiller (à l'arrière)
  },

  bibliotheque(ctx, w, h, t) {
    const bw = w - t * 0.08, bh = h * 0.5;
    const y0 = -h / 2 + t * 0.04; // collée au mur (arrière)
    ombre(ctx, t, () => rect(ctx, -bw / 2, y0, bw, bh, C.boisFonce));
    rect(ctx, -bw / 2, y0, bw, bh, C.boisFonce, '#2f1d0c', 1.5);
    const couleurs = ['#8e2323', '#2f5d8a', '#3f7a3a', '#a07a1f', '#5c3b72', '#7a4a2a'];
    const n = Math.max(4, Math.round(bw / (t * 0.12)));
    for (let i = 0; i < n; i++) {
      const bx = -bw / 2 + 3 + ((bw - 6) * i) / n;
      rect(ctx, bx, y0 + bh * 0.3, (bw - 6) / n - 1, bh * 0.6, couleurs[i % couleurs.length]);
    }
  },

  torche(ctx, w, h, t) {
    // Accrochée au mur, à l'arrière de la case.
    const y = -h / 2 + t * 0.12;
    const g = ctx.createRadialGradient(0, y, 0, 0, y, t * 0.6);
    g.addColorStop(0, 'rgba(255,190,80,0.55)'); g.addColorStop(1, 'rgba(255,150,40,0)');
    rond(ctx, 0, y, t * 0.6, g);
    rect(ctx, -t * 0.05, -h / 2, t * 0.1, t * 0.16, '#3b3b3b');
    rond(ctx, 0, y, t * 0.1, C.flamme);
    rond(ctx, 0, y, t * 0.05, '#fff2c4');
  },

  debris(ctx, w, h, t, o) {
    // Formes irrégulières, différentes pour chaque case.
    for (let i = 0; i < 6; i++) {
      const a = hash(o.x * 13 + i, o.y * 7 + i), b = hash(o.y * 11 + i, o.x * 5 + i);
      const cx = (a - 0.5) * w * 0.7, cy = (b - 0.5) * h * 0.7, r = t * (0.07 + a * 0.1);
      ctx.beginPath();
      for (let k = 0; k < 5; k++) {
        const ang = (k / 5) * Math.PI * 2 + a * 3, rr = r * (0.7 + hash(i, k) * 0.6);
        k ? ctx.lineTo(cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr) : ctx.moveTo(cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr);
      }
      ctx.closePath();
      ctx.fillStyle = i % 2 ? C.pierreFonce : C.pierre; ctx.fill();
      ctx.strokeStyle = C.murFonce; ctx.lineWidth = 1; ctx.stroke();
    }
  },

  puits(ctx, w, h, t) {
    const r = Math.min(w, h) * 0.42;
    ombre(ctx, t, () => rond(ctx, 0, 0, r, C.pierre));
    rond(ctx, 0, 0, r, C.pierre, C.murFonce, 1.5);
    rond(ctx, 0, 0, r * 0.66, '#14202a', C.pierreFonce, 1.5);
    rond(ctx, -r * 0.15, -r * 0.15, r * 0.15, 'rgba(120,170,200,0.35)');
  },

  fontaine(ctx, w, h, t) {
    const r = Math.min(w, h) * 0.44;
    ombre(ctx, t, () => rond(ctx, 0, 0, r, C.pierreClair));
    rond(ctx, 0, 0, r, C.pierreClair, C.pierreFonce, 1.5);
    rond(ctx, 0, 0, r * 0.78, C.eau);
    rond(ctx, 0, 0, r * 0.22, C.pierreClair, C.pierreFonce, 1);
  },

  sarcophage(ctx, w, h, t) {
    const sw = w * 0.74, sh = h - t * 0.14;
    ombre(ctx, t, () => rectArrondi(ctx, -sw / 2, -sh / 2, sw, sh, t * 0.15, C.pierre));
    rectArrondi(ctx, -sw / 2, -sh / 2, sw, sh, t * 0.15, C.pierre, C.pierreFonce, 2);
    rectArrondi(ctx, -sw * 0.32, -sh * 0.4, sw * 0.64, sh * 0.8, t * 0.1, null, C.pierreFonce, 1);
    rond(ctx, 0, -sh * 0.28, sw * 0.16, null, C.pierreFonce, 1); // tête du gisant
  },

  inconnu(ctx, w, h, t) {
    rect(ctx, -w * 0.35, -h * 0.35, w * 0.7, h * 0.7, '#a0309a');
    ctx.fillStyle = '#fff'; ctx.font = `bold ${t * 0.4}px sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('?', 0, 0);
  },
};

// --- Repères d'interface -------------------------------------------------------

/** Élément secret (déjà dessiné en translucide) : contour en pointillés. */
export function repereCache(ctx, r, t) {
  ctx.save();
  ctx.strokeStyle = '#d6b8ff';
  ctx.lineWidth = Math.max(1.5, t * 0.04);
  ctx.setLineDash([t * 0.1, t * 0.08]);
  ctx.beginPath();
  ctx.roundRect(r.x * t - 2, r.y * t - 2, r.l * t + 4, r.h * t + 4, t * 0.1);
  ctx.stroke();
  ctx.restore();
}

/** Porte reliée : pastille bleue avec deux maillons, posée côté pièce. */
export function marqueLiaison(ctx, r, mur, t) {
  const dedans = { nord: [0, 1], sud: [0, -1], ouest: [1, 0], est: [-1, 0] }[mur];
  const cx = (r.x + r.l / 2) * t + dedans[0] * t * 0.42;
  const cy = (r.y + r.h / 2) * t + dedans[1] * t * 0.42;
  const rayon = Math.max(6, t * 0.16);
  ctx.save();
  rond(ctx, cx, cy, rayon, '#2a6fdb', '#f4efe4', Math.max(1.5, t * 0.03));
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = Math.max(1.5, rayon * 0.28);
  rond(ctx, cx - rayon * 0.28, cy, rayon * 0.4, null, '#fff', ctx.lineWidth);
  rond(ctx, cx + rayon * 0.28, cy, rayon * 0.4, null, '#fff', ctx.lineWidth);
  ctx.restore();
}

/**
 * Sélection : cadre épais de la couleur d'accent, doublé d'un liseré sombre (il ressort sur tous les sols)
 * et avec un halo. Un élément fin comme une porte reçoit un cadre d'au moins 0,7 case de côté.
 */
export function marqueSelection(ctx, r, t) {
  const minimum = t * 0.7;
  const l = Math.max(r.l * t, minimum), h = Math.max(r.h * t, minimum);
  const x = r.x * t + (r.l * t - l) / 2, y = r.y * t + (r.h * t - h) / 2;
  const trace = () => {
    ctx.beginPath();
    ctx.roundRect(x - 3, y - 3, l + 6, h + 6, t * 0.12);
    ctx.stroke();
  };
  const epaisseur = Math.max(3, t * 0.08);
  ctx.save();
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.75)';
  ctx.lineWidth = epaisseur + 4;
  trace();
  ctx.shadowColor = 'rgba(217, 169, 41, 0.95)';
  ctx.shadowBlur = t * 0.25;
  ctx.strokeStyle = C.or;
  ctx.lineWidth = epaisseur;
  trace();
  ctx.restore();
}
