/**
 * Thème « vectoriel » : tout est dessiné en formes simples, sans image
 * externe (donc aucune question de licence).
 *
 * Contrat d'un thème :
 *   roche(ctx, largeurPx, hauteurPx, t)   fond autour de la pièce
 *   sol(ctx, plan, t)                     sol de la pièce
 *   murs(ctx, plan, t)                    murs (les portes sont dessinées par-dessus)
 *   porte(ctx, porte, plan, t)
 *   objets[type](ctx, w, h, t, objet, plan)  dessin centré sur (0, 0) ; w × h en pixels ;
 *                                         l'AVANT de l'objet est vers le bas (+y) ; `plan` (facultatif : absent des vignettes)
 *                                         sert aux objets qui ont besoin de la salle (la toile d'araignée cherche son coin : commun.js `sensDuCoin`)
 *   pion(ctx, creature, t)                pion d'une créature, en coordonnées de la pièce
 *                                         (creature.etat « blesse » ou « mort » : anneau en tirets et grosse pastille à croix, ou grisé et barré)
 *
 * Repères d'interface (facultatifs), rectangles { x, y, l, h } en CASES, origine au coin nord-ouest de la pièce :
 *   repereCache(ctx, rect, t, genre)      contour en pointillés d'un élément secret (genre : 'porte', 'objet' ou 'creature')
 *   marqueLiaison(ctx, rect, mur, t)      porte reliée à une autre salle
 *   marqueSelection(ctx, rect, t, genre)  élément sélectionné
 *
 * Autres crochets facultatifs, que le moteur appelle s'ils existent (voir peint.js) :
 *   preparer(ctx, plan, t, {relief})      avant de dessiner une salle : le thème calcule ce qu'il lui faut (centre de la vue, graine)
 *   grille(ctx, plan, t, opacite)         grille du thème ; `opacite` (0–1) est le réglage « Cases », absent pour un simple « oui »
 */
import { casesRetirees } from '../../formes.js';
import { dessinerMursDecoupes } from '../trace.js';
import { rect, rectArrondi, rond, sensDuCoin, contourIrregulier, toileDans, hasard, enLong } from './commun.js';
import { EPAISSEUR_MUR, ancragePorte } from '../geometrie.js';
import { dessinerPortrait } from '../portraits.js';
import { COULEURS } from '../../parseur/lexique.js';
import { CREATURES, varianteDe, aUneVariante } from '../../catalogue.js';
import { teinteFlamme, fumee, cendres } from '../feu.js';
import { TEINTES_TISSU } from '../teintes-tissu.js';

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

// --- Petites primitives (rect, rectArrondi et rond sont dans commun.js) -----------
/** Ombre portée douce sous un objet. */
function ombre(ctx, t, f) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = t * 0.15;
  ctx.shadowOffsetX = t * 0.04; ctx.shadowOffsetY = t * 0.06;
  f();
  ctx.restore();
}

/** Lueur d'une source de lumière : un disque qui s'estompe (`rgb` : « r,g,b »). */
function halo(ctx, x, y, rayon, rgb, alpha) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, rayon);
  g.addColorStop(0, `rgba(${rgb},${alpha})`); g.addColorStop(1, `rgba(${rgb},0)`);
  rond(ctx, x, y, rayon, g);
}

/** Couleurs de flamme d'une variante : la flamme d'origine pour la normale, sa couleur propre pour une flamme magique. */
const flammeDe = (T) => (T.c === null ? C.flamme : T.vif);
const coeurDe = (T) => (T.c === null ? '#fff2c4' : T.clair);
/** Un feu éteint, au point (x, y) : un moignon noirci, un peu de cendres et un mince filet de fumée (`u` : l'unité de taille de l'objet, en px). */
function eteint(ctx, x, y, u) {
  cendres(ctx, x, y + u * 0.04, u * 0.12, u * 0.08);
  rond(ctx, x, y, u * 0.06, '#2a2420');
  fumee(ctx, x, y - u * 0.05, u * 0.5, { largeur: Math.max(1, u * 0.025), couleur: '120,116,112' });
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
  const vides = casesRetirees(plan);
  for (let x = 0; x < plan.largeur; x++) for (let y = 0; y < plan.longueur; y++) {
    if (vides.has(`${x},${y}`)) continue;
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
const epaisseur = (t) => t * EPAISSEUR_MUR;

export function murs(ctx, plan, t) {
  const e = epaisseur(t);
  if (casesRetirees(plan).size) { dessinerMursDecoupes(ctx, plan, t, e, { fond: C.mur, trait: C.murFonce, epaisseurTrait: 1, joints: true }); return; }
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
  // Repère local : origine au milieu de l'ouverture, côté pièce vers +y.
  const place = ancragePorte(plan, p.mur, p.position, t);
  ctx.save();
  ctx.translate(place.x, place.y);
  ctx.rotate(place.angle);
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

  // Pastille du numéro (inutile pour les PJ, déjà numérotés dans le pion ; `sansNumero` : vignettes de la palette).
  if (k.camp !== 'pj' && !k.sansNumero) {
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

  escalier(ctx, w, h, t, o) {
    // Marches de plus en plus sombres vers l'arrière : l'escalier descend ; de plus en plus claires : il monte.
    const ew = w * 0.86, eh = h * 0.94, n = 6, monte = o?.sens === 'monte';
    for (let i = 0; i < n; i++) {
      const v = monte ? 96 + i * 18 : 150 - i * 18;
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

  torche(ctx, w, h, t, o) {
    // Accrochée au mur, à l'arrière de la case.
    const y = -h / 2 + t * 0.12, T = teinteFlamme(o);
    if (T.eteint) { rect(ctx, -t * 0.05, -h / 2, t * 0.1, t * 0.16, '#3b3b3b'); eteint(ctx, 0, y, t); return; }
    const g = ctx.createRadialGradient(0, y, 0, 0, y, t * 0.6);
    g.addColorStop(0, `rgba(${T.c ?? '255,190,80'},0.55)`); g.addColorStop(1, T.c ? `rgba(${T.c},0)` : 'rgba(255,150,40,0)');
    rond(ctx, 0, y, t * 0.6, g);
    rect(ctx, -t * 0.05, -h / 2, t * 0.1, t * 0.16, '#3b3b3b');
    rond(ctx, 0, y, t * 0.1, flammeDe(T));
    rond(ctx, 0, y, t * 0.05, coeurDe(T));
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

  brasero(ctx, w, h, t, o) {
    const r = Math.min(w, h) * 0.34, T = teinteFlamme(o);
    if (T.eteint) {
      ombre(ctx, t, () => rond(ctx, 0, 0, r, C.noir));
      rond(ctx, 0, 0, r, '#4a4540', '#1c1a18', 2);
      rond(ctx, 0, 0, r * 0.78, '#1b1411');
      eteint(ctx, 0, 0, t * 1.4);
      return;
    }
    halo(ctx, 0, 0, t * 0.8, T.c ?? '255,160,60', 0.5);
    ombre(ctx, t, () => rond(ctx, 0, 0, r, C.noir));
    rond(ctx, 0, 0, r, '#4a4540', '#1c1a18', 2);            // la vasque de fer
    rond(ctx, 0, 0, r * 0.78, '#1b1411');                   // les braises
    rond(ctx, 0, 0, r * 0.64, T.c === null ? '#c9461c' : T.braises[2]);
    rond(ctx, 0, 0, r * 0.44, flammeDe(T));
    rond(ctx, 0, 0, r * 0.2, coeurDe(T));
  },

  bougies(ctx, w, h, t, o) {
    const T = teinteFlamme(o);
    if (!T.eteint) halo(ctx, 0, 0, t * 0.55, T.c ?? '255,190,90', 0.4);
    for (const [x, y] of [[-0.17, 0.09], [0.15, 0.13], [0.02, -0.16]]) {
      ombre(ctx, t, () => rond(ctx, x * t, y * t, t * 0.07, '#d8cdb0'));
      rond(ctx, x * t, y * t, t * 0.07, '#f1e7c9', '#a89c7e', 1);          // la cire
      if (T.eteint) { rond(ctx, x * t, y * t, t * 0.02, '#2a2420'); fumee(ctx, x * t, y * t - t * 0.02, t * 0.2, { largeur: 1, couleur: '120,116,112' }); }
      else rond(ctx, x * t, y * t, t * 0.032, flammeDe(T));
    }
  },

  tapis(ctx, w, h, t, o) {
    const tw = w - t * 0.22, th = h - t * 0.22, x = -tw / 2, y = -th / 2, long = tw >= th;
    ctx.strokeStyle = '#e6d7b0'; ctx.lineWidth = 1; ctx.beginPath();     // les franges, aux deux bouts les plus courts
    for (let k = t * 0.05; k < (long ? th : tw) - t * 0.03; k += t * 0.06) {
      if (long) { ctx.moveTo(x - t * 0.1, y + k); ctx.lineTo(x, y + k); ctx.moveTo(x + tw, y + k); ctx.lineTo(x + tw + t * 0.1, y + k); }
      else { ctx.moveTo(x + k, y - t * 0.1); ctx.lineTo(x + k, y); ctx.moveTo(x + k, y + th); ctx.lineTo(x + k, y + th + t * 0.1); }
    }
    ctx.stroke();
    const T = aUneVariante(o) ? TEINTES_TISSU[varianteDe(o)]?.s : null; // une autre couleur : même motif, autres teintes (rendu/teintes-tissu.js)
    rect(ctx, x, y, tw, th, T?.c ?? C.rouge, T?.x ?? '#4a1010', 1.5);
    rect(ctx, x + t * 0.1, y + t * 0.1, tw - t * 0.2, th - t * 0.2, null, T?.g ?? C.or, Math.max(1.5, t * 0.04));   // la bordure dorée
    const cx = 0, cy = 0, a = Math.min(tw / 2 - t * 0.2, th * 0.4 * (long ? 1.7 : 1)), b = Math.min(th / 2 - t * 0.2, tw * 0.4 * (long ? 1 : 1.7));
    for (const [k, fond] of [[1, T?.g ?? C.or], [0.7, T?.acc ?? C.tissu], [0.38, T?.g ?? C.or], [0.16, T?.ctr ?? C.rouge]]) {
      ctx.beginPath(); ctx.moveTo(cx - a * k, cy); ctx.lineTo(cx, cy - b * k); ctx.lineTo(cx + a * k, cy); ctx.lineTo(cx, cy + b * k); ctx.closePath();
      ctx.fillStyle = fond; ctx.fill();
    }
  },

  banniere(ctx, w, h, t, o) {
    // Accrochée au mur, à l'arrière de la case : une barre, et l'étoffe qui pend vers l'avant, à queue d'hirondelle.
    const y0 = -h / 2 + t * 0.03, bl = t * 0.62, lg = t * 0.58, bw = t * 0.46;
    const T = aUneVariante(o) ? TEINTES_TISSU[varianteDe(o)]?.s : null; // une couleur choisie ; sinon le rouge d'origine
    ombre(ctx, t, () => rect(ctx, -bw / 2, y0, bw, lg, T?.d ?? '#6b1717'));
    ctx.beginPath(); ctx.moveTo(-bw / 2, y0); ctx.lineTo(bw / 2, y0); ctx.lineTo(bw / 2, y0 + lg); ctx.lineTo(0, y0 + lg * 0.78); ctx.lineTo(-bw / 2, y0 + lg); ctx.closePath();
    ctx.fillStyle = T?.c ?? C.rouge; ctx.fill(); ctx.strokeStyle = T?.g ?? C.or; ctx.lineWidth = Math.max(1.5, t * 0.03); ctx.stroke();
    rond(ctx, 0, y0 + lg * 0.42, t * 0.07, T?.g ?? C.or);                         // l'emblème
    rect(ctx, -bl / 2, y0 - t * 0.04, bl, t * 0.07, C.boisFonce);         // la barre
  },

  feudecamp(ctx, w, h, t, o) {
    const R = Math.min(w, h) * 0.34, T = teinteFlamme(o);
    if (!T.eteint) halo(ctx, 0, 0, t * 0.95, T.c ?? '255,150,50', 0.55);
    rond(ctx, 0, 0, R * 1.05, 'rgba(25,18,14,0.7)');
    for (let i = 0; i < 9; i++) {                                         // le cercle de pierres
      const a = (i / 9) * Math.PI * 2 + 0.3;
      rond(ctx, Math.cos(a) * R * 1.05, Math.sin(a) * R * 1.05, t * 0.075, i % 2 ? C.pierre : C.pierreFonce, C.murFonce, 1);
    }
    ctx.lineCap = 'round';
    for (const a of [0.4, 2.0, 3.6]) {                                    // les bûches
      ctx.beginPath(); ctx.moveTo(-Math.cos(a) * R * 0.75, -Math.sin(a) * R * 0.75); ctx.lineTo(Math.cos(a) * R * 0.75, Math.sin(a) * R * 0.75);
      ctx.strokeStyle = C.boisFonce; ctx.lineWidth = t * 0.11; ctx.stroke();
      ctx.strokeStyle = C.bois; ctx.lineWidth = t * 0.07; ctx.stroke();
    }
    ctx.lineCap = 'butt';
    if (T.eteint) { eteint(ctx, 0, 0, t * 1.6); return; }
    rond(ctx, 0, 0, R * 0.5, T.c === null ? '#c9461c' : T.braises[2]); rond(ctx, 0, 0, R * 0.34, flammeDe(T)); rond(ctx, 0, 0, R * 0.15, coeurDe(T));
  },

  flaque(ctx, w, h, t, o) {
    contourIrregulier(ctx, w * 0.42, h * 0.36, o, 22, 0.16);
    ctx.fillStyle = 'rgba(61,127,176,0.82)'; ctx.fill(); ctx.strokeStyle = '#1f4d70'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.strokeStyle = 'rgba(230,245,255,0.7)'; ctx.lineWidth = Math.max(1, t * 0.025); ctx.lineCap = 'round';   // les reflets
    for (const [a, b, l] of [[-0.3, -0.12, 0.34], [0.02, 0.1, 0.24], [-0.16, 0.2, 0.16]]) {
      ctx.beginPath(); ctx.moveTo(a * w, b * h); ctx.quadraticCurveTo((a + l / 2) * w, (b - 0.08) * h, (a + l) * w, b * h); ctx.stroke();
    }
    ctx.lineCap = 'butt';
  },

  rocher(ctx, w, h, t, o) {
    const s = Math.min(w, h);
    ombre(ctx, t, () => { contourIrregulier(ctx, s * 0.4, s * 0.36, o, 9, 0.16); ctx.fillStyle = C.pierreFonce; ctx.fill(); });
    contourIrregulier(ctx, s * 0.4, s * 0.36, o, 9, 0.16);
    const g = ctx.createRadialGradient(-s * 0.15, -s * 0.15, s * 0.05, 0, 0, s * 0.45);
    g.addColorStop(0, C.pierreClair); g.addColorStop(1, C.pierreFonce);
    ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = C.murFonce; ctx.lineWidth = 1.5; ctx.stroke();
    contourIrregulier(ctx, s * 0.22, s * 0.2, o, 7, 0.2, 40);            // la facette du dessus
    ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.lineWidth = 1; ctx.stroke();
  },

  champignons(ctx, w, h, t) {
    halo(ctx, 0, 0, t * 0.7, '90,230,215', 0.5);
    for (const [x, y, r] of [[-0.2, 0.1, 0.1], [0.12, 0.18, 0.08], [0.1, -0.14, 0.11], [-0.12, -0.18, 0.07], [0.3, 0.02, 0.06]]) {
      rond(ctx, x * t, y * t, r * t, '#9ff7ea', '#1f8c86', 1.2);
      rond(ctx, (x - r * 0.3) * t, (y - r * 0.3) * t, r * t * 0.28, 'rgba(255,255,255,0.75)');
    }
  },

  toile(ctx, w, h, t, o, plan) {
    // Un éventail de fils dans l'angle de la case le plus proche d'un coin de la salle.
    const [sx, sy] = sensDuCoin(o, plan), cx = sx * w / 2, cy = sy * h / 2, L = Math.min(w, h) * 0.98;
    toileDans(ctx, cx, cy, -sx, -sy, L, 'rgba(240,240,245,0.85)', Math.max(1, t * 0.02));
  },

  ossements(ctx, w, h, t) {
    ctx.lineCap = 'round';
    for (const [ax, ay, bx, by] of [[-0.3, 0.12, 0.08, 0.28], [0.08, -0.24, 0.34, 0.06]]) {
      ctx.beginPath(); ctx.moveTo(ax * t, ay * t); ctx.lineTo(bx * t, by * t);
      ctx.strokeStyle = '#231b16'; ctx.lineWidth = t * 0.11; ctx.stroke();
      ctx.strokeStyle = '#e7dfca'; ctx.lineWidth = t * 0.07; ctx.stroke();
    }
    ctx.lineCap = 'butt';
    ombre(ctx, t, () => rond(ctx, 0, 0, t * 0.15, '#cfc5aa'));
    rond(ctx, 0, 0, t * 0.15, '#f1e9d2', '#7d7458', 1);                    // le crâne
    rond(ctx, -t * 0.05, -t * 0.01, t * 0.035, '#2a2017'); rond(ctx, t * 0.05, -t * 0.01, t * 0.035, '#2a2017');
  },

  inconnu(ctx, w, h, t) {
    rect(ctx, -w * 0.35, -h * 0.35, w * 0.7, h * 0.7, '#a0309a');
    ctx.fillStyle = '#fff'; ctx.font = `bold ${t * 0.4}px sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('?', 0, 0);
  },
};

// --- États du mobilier (variantes du catalogue : coffre ouvert, tonneau couché…) ---------------------------------

/** Un polygone rempli puis cerné. */
function polygone(ctx, pts, fond, trait, ep = 1) {
  ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath();
  if (fond) { ctx.fillStyle = fond; ctx.fill(); }
  if (trait) { ctx.strokeStyle = trait; ctx.lineWidth = ep; ctx.stroke(); }
}
/** Un rectangle centré en (cx, cy) de côtés l × h, tourné de `a` radians. */
function rectTourne(cx, cy, l, h, a) {
  const c = Math.cos(a), s = Math.sin(a);
  return [[-l / 2, -h / 2], [l / 2, -h / 2], [l / 2, h / 2], [-l / 2, h / 2]].map(([x, y]) => [cx + x * c - y * s, cy + x * s + y * c]);
}
/** Un trait d'un point à l'autre. */
function trace(ctx, pts, couleur, ep) {
  ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.strokeStyle = couleur; ctx.lineWidth = ep; ctx.stroke();
}
const PAILLE = '#d8b95a', VIN = '#8a2a3a', BIERE = '#c88a1c';

/** Le coffre sans son couvercle fermé : intérieur sombre, couvercle relevé en bandeau au dos ; `contenu` : le trésor (pièces et gemmes), sinon vide. */
function coffreOuvert(ctx, w, h, t, contenu) {
  const cw = w * 0.78, ch = h * 0.56, x = -cw / 2, y = -ch / 2;
  ombre(ctx, t, () => rectArrondi(ctx, x, y, cw, ch, t * 0.06, C.bois));
  rectArrondi(ctx, x, y, cw, ch, t * 0.06, C.bois, C.boisFonce, 1.5);
  rect(ctx, x + t * 0.06, y + t * 0.06, cw - t * 0.12, ch - t * 0.12, '#2a1a0e');
  if (contenu) {
    for (const [u, v] of [[0.2, 0.55], [0.35, 0.7], [0.5, 0.5], [0.65, 0.72], [0.8, 0.55], [0.42, 0.42], [0.6, 0.6], [0.28, 0.5]]) rond(ctx, x + cw * u, y + ch * v, t * 0.055, C.or, '#8a6a14', 0.8);
    rond(ctx, x + cw * 0.5, y + ch * 0.62, t * 0.04, '#d8433a'); rond(ctx, x + cw * 0.36, y + ch * 0.55, t * 0.035, '#4d86c4');
    for (const u of [0.25, 0.45, 0.7]) rond(ctx, x + cw * u, y + ch + t * 0.07, t * 0.04, C.or, '#8a6a14', 0.8); // des pièces tombées devant
  }
  rect(ctx, x, y, cw, ch * 0.2, C.boisClair, C.boisFonce, 1.5); // le couvercle relevé, vu par dessus
  rect(ctx, x + cw * 0.18, y, cw * 0.08, ch * 0.2, 'rgba(0,0,0,0.25)'); rect(ctx, x + cw * 0.74, y, cw * 0.08, ch * 0.2, 'rgba(0,0,0,0.25)');
}
/** Le coffre fracassé : couvercle déchiqueté, trou sombre, éclats de planche au sol. */
function coffreBrise(ctx, w, h, t) {
  const cw = w * 0.78, ch = h * 0.56, x = -cw / 2, y = -ch / 2;
  ombre(ctx, t, () => rectArrondi(ctx, x, y, cw, ch, t * 0.06, C.bois));
  rectArrondi(ctx, x, y, cw, ch, t * 0.06, C.bois, C.boisFonce, 1.5);
  polygone(ctx, [[x + cw * 0.12, y + ch * 0.5], [x + cw * 0.3, y + ch * 0.3], [x + cw * 0.5, y + ch * 0.55], [x + cw * 0.68, y + ch * 0.3], [x + cw * 0.9, y + ch * 0.55], [x + cw * 0.7, y + ch * 0.85], [x + cw * 0.3, y + ch * 0.85]], '#2a1a0e');
  trace(ctx, [[x + cw * 0.08, y + ch * 0.05], [x + cw * 0.22, y + ch * 0.3], [x + cw * 0.12, y + ch * 0.5]], C.boisFonce, 1.5);
  rect(ctx, x + cw * 0.2, y, cw * 0.08, ch * 0.3, 'rgba(0,0,0,0.3)');
  for (const [u, v, a] of [[0.1, 1.12, 0.4], [0.4, 1.16, -0.5], [0.85, 1.1, 0.2]]) polygone(ctx, rectTourne(x + cw * u, y + ch * v, t * 0.16, t * 0.05, a), C.boisClair, C.boisFonce, 1);
  rect(ctx, x + cw * 0.9 - t * 0.04, y + ch * 0.9, t * 0.08, t * 0.1, C.or, C.boisFonce, 1); // la serrure arrachée
}
/** Un meuble de livres : les dos, dont on retire la part `trous` (tirée de la place de l'objet). */
function rayonnage(ctx, x0, y0, bw, bh, t, couleurs, largeur, trous, o) {
  ombre(ctx, t, () => rect(ctx, x0, y0, bw, bh, C.boisFonce));
  rect(ctx, x0, y0, bw, bh, C.boisFonce, '#2f1d0c', 1.5);
  const n = Math.max(4, Math.round(bw / (t * largeur)));
  for (let i = 0; i < n; i++) {
    if (hasard(o, i) < trous) continue;
    rect(ctx, x0 + 3 + ((bw - 6) * i) / n, y0 + bh * 0.3, (bw - 6) / n - 1, bh * 0.6, couleurs[i % couleurs.length]);
  }
}
const ETATS = {
  coffre: { ouvert: (ctx, w, h, t) => coffreOuvert(ctx, w, h, t, true), vide: (ctx, w, h, t) => coffreOuvert(ctx, w, h, t, false), brise: coffreBrise },
  bibliotheque: {
    clairsemee(ctx, w, h, t, o) {
      const bw = w - t * 0.08, y0 = -h / 2 + t * 0.04, bh = h * 0.5;
      rayonnage(ctx, -bw / 2, y0, bw, bh, t, ['#8e2323', '#2f5d8a', '#3f7a3a', '#a07a1f', '#5c3b72', '#7a4a2a'], 0.12, 0.5, o);
      polygone(ctx, rectTourne(-bw * 0.2, y0 + bh * 0.8, t * 0.2, t * 0.06, 0.1), '#2f5d8a', '#2f1d0c', 0.8);
    },
    renversee(ctx, w, h, t, o) {
      const bw = w - t * 0.1, prof = h * 0.46, y0 = -h / 2 + t * 0.04, c = ['#8e2323', '#2f5d8a', '#3f7a3a', '#a07a1f', '#5c3b72'];
      ombre(ctx, t, () => polygone(ctx, rectTourne(0, y0 + prof / 2, bw * 0.97, prof, 0.05), C.boisFonce));
      polygone(ctx, rectTourne(0, y0 + prof / 2, bw * 0.97, prof, 0.05), C.boisFonce, '#2f1d0c', 1.5);
      for (const k of [0.3, 0.55, 0.8]) trace(ctx, [[-bw * 0.45, y0 + prof * k], [bw * 0.45, y0 + prof * k]], 'rgba(0,0,0,0.3)', 1);
      for (let i = 0; i < 8; i++) polygone(ctx, rectTourne((hasard(o, i) - 0.5) * bw * 0.9, y0 + prof + t * 0.08 + hasard(o, i + 20) * (h / 2 - y0 - prof - t * 0.16), t * 0.13, t * 0.17, hasard(o, i + 40) * 3), c[i % c.length], '#2f1d0c', 0.8);
    },
    grimoires(ctx, w, h, t, o) {
      const bw = w - t * 0.08, y0 = -h / 2 + t * 0.04;
      rayonnage(ctx, -bw / 2, y0, bw, h * 0.5, t, ['#4a1f4e', '#1f3a5e', '#5a1f2a', '#1f4a3f'], 0.2, 0.03, o);
      rond(ctx, -bw * 0.28, y0 + h * 0.12, t * 0.07, '#f1e9d2', '#7d7458', 1); rond(ctx, bw * 0.28, y0 + h * 0.12, t * 0.05, '#58c46a', '#1f5a2a', 1);
      trace(ctx, [[-bw / 2, y0 + h * 0.3], [0, y0 + h * 0.36], [bw / 2, y0 + h * 0.3]], '#bfc3c9', 1.5);
    },
  },
  tonneau: {
    couche(ctx, w, h, t, o) {
      const s = Math.min(w, h), L = s * 0.45, W = s * 0.34, a = (hasard(o, 1) - 0.5) * 0.35, pts = [];
      for (let i = 0; i <= 10; i++) { const u = i / 5 - 1; pts.push([u * L, -W * (0.8 + 0.2 * Math.cos((u * Math.PI) / 2))]); }
      for (let i = 10; i >= 0; i--) { const u = i / 5 - 1; pts.push([u * L, W * (0.8 + 0.2 * Math.cos((u * Math.PI) / 2))]); }
      ctx.save(); ctx.rotate(a);
      ombre(ctx, t, () => polygone(ctx, pts, C.bois));
      polygone(ctx, pts, C.bois, C.boisFonce, 2);
      for (const u of [-0.7, -0.05, 0.6]) trace(ctx, [[u * L, -W * 0.95], [u * L, W * 0.95]], '#4a4a4a', Math.max(1.5, t * 0.04));
      for (const v of [-0.4, 0, 0.4]) trace(ctx, [[-L * 0.95, v * W], [L * 0.95, v * W]], 'rgba(0,0,0,0.18)', 1);
      rond(ctx, L * 0.2, W * 0.1, t * 0.04, C.boisFonce);
      ctx.restore();
    },
    eventre(ctx, w, h, t, o) {
      const r = Math.min(w, h) * 0.34, liquide = hasard(o, 2) < 0.5 ? VIN : BIERE, fl = [], etoile = [];
      for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2, k = 0.82 + hasard(o, 10 + i) * 0.3; fl.push([r * 0.3 + Math.cos(a) * r * 1.05 * k, r * 0.4 + Math.sin(a) * r * 0.72 * k]); }
      polygone(ctx, fl, liquide, 'rgba(0,0,0,0.35)', 1);
      ombre(ctx, t, () => rond(ctx, 0, 0, r, C.bois));
      rond(ctx, 0, 0, r, C.bois, C.boisFonce, 2);
      for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2, rr = r * (i % 2 ? 0.34 : 0.7); etoile.push([Math.cos(a) * rr, Math.sin(a) * rr]); }
      polygone(ctx, etoile, '#2a1a0e', C.boisFonce, 1);
      polygone(ctx, rectTourne(-r * 0.8, r * 0.75, r * 0.7, r * 0.14, 0.5), C.boisClair, C.boisFonce, 1);
    },
  },
  sarcophage: {
    ouvert(ctx, w, h, t) {
      const sw = w * 0.74, sh = h - t * 0.14;
      ombre(ctx, t, () => rectArrondi(ctx, -sw / 2, -sh / 2, sw, sh, t * 0.15, C.pierre));
      rectArrondi(ctx, -sw / 2, -sh / 2, sw, sh, t * 0.15, C.pierre, C.pierreFonce, 2);
      rectArrondi(ctx, -sw * 0.4, -sh * 0.42, sw * 0.8, sh * 0.84, t * 0.1, '#2a2017');
      rond(ctx, 0, -sh * 0.3, sw * 0.14, '#f1e9d2', '#7d7458', 1);
      for (const k of [-0.18, -0.08]) trace(ctx, [[-sw * 0.3, sh * k], [sw * 0.3, sh * k]], '#d8cfae', 2);
      ctx.save(); ctx.translate(0, sh * 0.2); ctx.rotate(0.12); // le couvercle glissé reste dans l'emprise (boîte englobante comprise)
      ombre(ctx, t, () => rectArrondi(ctx, -sw * 0.38, -sh * 0.25, sw * 0.76, sh * 0.5, t * 0.1, C.pierreClair));
      rectArrondi(ctx, -sw * 0.38, -sh * 0.25, sw * 0.76, sh * 0.5, t * 0.1, C.pierreClair, C.pierreFonce, 2);
      trace(ctx, [[0, -sh * 0.2], [0, sh * 0.2]], C.pierreFonce, 2); trace(ctx, [[-sw * 0.2, -sh * 0.06], [sw * 0.2, -sh * 0.06]], C.pierreFonce, 2);
      ctx.restore();
    },
  },
  statue: {
    brisee(ctx, w, h, t) {
      const r = Math.min(w, h) * 0.42, dents = [];
      ombre(ctx, t, () => rond(ctx, 0, 0, r, C.pierreFonce));
      rond(ctx, 0, 0, r, C.pierreFonce, C.murFonce, 1.5);
      for (let i = 0; i < 11; i++) { const a = (i / 11) * Math.PI * 2, rr = r * (i % 2 ? 0.34 : 0.5); dents.push([Math.cos(a) * rr, Math.sin(a) * rr]); }
      polygone(ctx, dents, C.pierreClair, C.pierreFonce, 1);
      // Les morceaux tombés au pied du socle, gros : la tête (visage), un bras couché (poing au bout), des éclats de torse.
      rond(ctx, -r * 0.55, r * 0.5, r * 0.3, C.pierreClair, C.pierreFonce, 1);
      rond(ctx, -r * 0.5, r * 0.46, r * 0.04, C.pierreFonce); rond(ctx, -r * 0.5, r * 0.58, r * 0.04, C.pierreFonce);
      ctx.save(); ctx.translate(r * 0.62, r * 0.5); ctx.rotate(0.9);
      rectArrondi(ctx, -r * 0.4, -r * 0.11, r * 0.8, r * 0.22, r * 0.1, C.pierreClair, C.pierreFonce, 1); rond(ctx, r * 0.45, 0, r * 0.14, C.pierreClair, C.pierreFonce, 1);
      ctx.restore();
      polygone(ctx, [[r * 0.45, -r * 0.62], [r * 0.85, -r * 0.45], [r * 0.62, -r * 0.18]], C.pierreClair, C.pierreFonce, 1);
      polygone(ctx, [[-r * 0.85, -r * 0.3], [-r * 0.55, -r * 0.6], [-r * 0.4, -r * 0.25]], C.pierreClair, C.pierreFonce, 1);
    },
  },
  caisse: {
    ouverte(ctx, w, h, t, o) {
      const s = Math.min(w, h) * 0.62, x = -s / 2 - t * 0.08, y = -s / 2;
      ombre(ctx, t, () => rect(ctx, x, y, s, s, C.boisClair));
      rect(ctx, x, y, s, s, C.boisClair, C.boisFonce, 2);
      rect(ctx, x + t * 0.06, y + t * 0.06, s - t * 0.12, s - t * 0.12, '#2a1a0e');
      for (let i = 0; i < 12; i++) { const px = x + s * (0.15 + 0.7 * hasard(o, i)), py = y + s * (0.15 + 0.7 * hasard(o, i + 30)), a = hasard(o, i + 60) * 6.28; trace(ctx, [[px, py], [px + Math.cos(a) * t * 0.14, py + Math.sin(a) * t * 0.14]], PAILLE, 1.8); }
      rect(ctx, x + s + t * 0.01, y + s * 0.05, t * 0.2, s * 0.9, C.bois, C.boisFonce, 1.5); // le couvercle appuyé contre le flanc
      trace(ctx, [[x + s + t * 0.1, y + s * 0.05], [x + s + t * 0.1, y + s * 0.95]], C.boisFonce, 1);
    },
  },
  fontaine: {
    asec(ctx, w, h, t, o) {
      const r = Math.min(w, h) * 0.44;
      ombre(ctx, t, () => rond(ctx, 0, 0, r, C.pierreClair));
      rond(ctx, 0, 0, r, C.pierreClair, C.pierreFonce, 1.5);
      rond(ctx, 0, 0, r * 0.78, '#bfb391', C.pierreFonce, 1);
      trace(ctx, [[-r * 0.6, -r * 0.2], [-r * 0.35, -r * 0.05], [-r * 0.4, r * 0.2], [-r * 0.15, r * 0.3]], '#6a604a', 1.2);
      trace(ctx, [[r * 0.6, r * 0.25], [r * 0.4, r * 0.1], [r * 0.5, -r * 0.1]], '#6a604a', 1.2);
      for (let i = 0; i < 4; i++) { const a = hasard(o, i) * 6.28, d = r * (0.3 + hasard(o, i + 9) * 0.35); rond(ctx, Math.cos(a) * d, Math.sin(a) * d, t * 0.04, i % 2 ? '#b8762a' : '#8a5a2a'); } // feuilles mortes
      rond(ctx, 0, 0, r * 0.22, C.pierreClair, C.pierreFonce, 1);
    },
    sombre(ctx, w, h, t, o) {
      const r = Math.min(w, h) * 0.44;
      ombre(ctx, t, () => rond(ctx, 0, 0, r, C.pierreClair));
      rond(ctx, 0, 0, r, C.pierreClair, C.pierreFonce, 1.5);
      rond(ctx, 0, 0, r * 0.78, '#58558f');
      rond(ctx, -r * 0.3, r * 0.25, r * 0.2, '#4f7a58');
      for (let i = 0; i < 4; i++) { const a = hasard(o, i) * 6.28, d = r * (0.25 + hasard(o, i + 9) * 0.4); rond(ctx, Math.cos(a) * d, Math.sin(a) * d, t * 0.04, 'rgba(255,255,255,0.3)', '#2a2850', 1); }
      rond(ctx, 0, 0, r * 0.22, C.pierreClair, C.pierreFonce, 1);
    },
    sacree(ctx, w, h, t) {
      const r = Math.min(w, h) * 0.44;
      halo(ctx, 0, 0, t * 0.95, '120,232,226', 0.55);
      ombre(ctx, t, () => rond(ctx, 0, 0, r, C.pierreClair));
      rond(ctx, 0, 0, r, C.pierreClair, C.pierreFonce, 1.5);
      rond(ctx, 0, 0, r * 0.78, '#6fe0d8');
      rond(ctx, 0, 0, r * 0.5, null, 'rgba(255,255,255,0.7)', 1.2);
      rond(ctx, 0, 0, r * 0.22, '#e6fffb', C.pierreFonce, 1);
      for (const [x, y] of [[-0.4, -0.3], [0.35, 0.3], [0.2, -0.45]]) rond(ctx, x * r, y * r, t * 0.025, '#fff');
    },
  },
  autel: {
    rituel(ctx, w, h, t) {
      const aw = w - t * 0.14, ah = h - t * 0.3;
      ombre(ctx, t, () => rect(ctx, -aw / 2, -ah / 2, aw, ah, C.pierre));
      rect(ctx, -aw / 2, -ah / 2, aw, ah, C.pierre, C.pierreFonce, 1.5);
      rect(ctx, -aw * 0.34, -ah / 2, aw * 0.68, ah, '#5c3a7e', C.or, 1.2);                                 // la nappe
      for (const [x, y] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { halo(ctx, x * aw * 0.43, y * ah * 0.28, t * 0.3, '255,190,110', 0.4); rond(ctx, x * aw * 0.43, y * ah * 0.28, t * 0.055, '#f1e7c9'); rond(ctx, x * aw * 0.43, y * ah * 0.28, t * 0.025, C.flamme); }
      rond(ctx, 0, 0, t * 0.075, C.or, C.boisFonce, 1); rond(ctx, 0, 0, t * 0.045, '#8a2a3a');            // la coupe
    },
    ensanglante(ctx, w, h, t, o) {
      const aw = w - t * 0.14, ah = h - t * 0.3, fl = [];
      for (let i = 0; i < 10; i++) { const a = (i / 10) * 6.28, k = 0.8 + hasard(o, i) * 0.35; fl.push([-aw * 0.1 + Math.cos(a) * aw * 0.18 * k, ah / 2 + t * 0.06 + Math.sin(a) * t * 0.09 * k]); }
      polygone(ctx, fl, '#9a1f26', null);
      ombre(ctx, t, () => rect(ctx, -aw / 2, -ah / 2, aw, ah, C.pierre));
      rect(ctx, -aw / 2, -ah / 2, aw, ah, C.pierre, C.pierreFonce, 1.5);
      for (const [u, v, k] of [[-0.2, 0, 0.17], [0.08, 0.1, 0.12], [0.3, -0.1, 0.09]]) { rond(ctx, aw * u, ah * v, ah * k * 1.4, '#9a1f26'); rond(ctx, aw * u - ah * k * 0.4, ah * v - ah * k * 0.3, ah * k * 0.4, '#c9484c'); }
      for (const u of [-0.3, 0, 0.22]) trace(ctx, [[aw * u, ah * 0.3], [aw * u, ah * 0.5]], '#9a1f26', Math.max(2, t * 0.04));  // les coulures
      polygone(ctx, rectTourne(aw * 0.26, ah * 0.02, t * 0.3, t * 0.05, 0.45), '#c4cbd4', '#2a2018', 0.8);
    },
    sacre(ctx, w, h, t) {
      const aw = w - t * 0.14, ah = h - t * 0.3, rs = ah * 0.17;
      halo(ctx, 0, 0, t * 1.1, '255,214,118', 0.4);
      ombre(ctx, t, () => rect(ctx, -aw / 2, -ah / 2, aw, ah, C.pierreClair));
      rect(ctx, -aw / 2, -ah / 2, aw, ah, C.pierreClair, C.or, 2);
      rect(ctx, -aw * 0.23, -ah / 2, aw * 0.46, ah, '#f1ece0', C.or, 1.2);                                    // la nappe blanche
      for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.28 + 0.2; polygone(ctx, [[Math.cos(a - 0.26) * rs * 1.1, Math.sin(a - 0.26) * rs * 1.1], [Math.cos(a) * rs * 2, Math.sin(a) * rs * 2], [Math.cos(a + 0.26) * rs * 1.1, Math.sin(a + 0.26) * rs * 1.1]], C.or, null); }
      rond(ctx, 0, 0, rs, C.or, '#8a6a20', 1);                                                                // le soleil
      rond(ctx, -aw * 0.42, 0, t * 0.05, C.or, '#8a6a20', 1); rond(ctx, aw * 0.42, 0, t * 0.05, C.or, '#8a6a20', 1);
    },
  },
  puits: {
    couvert(ctx, w, h, t) {
      const r = Math.min(w, h) * 0.42;
      ombre(ctx, t, () => rond(ctx, 0, 0, r, C.pierre));
      rond(ctx, 0, 0, r, C.pierre, C.murFonce, 1.5);
      rond(ctx, 0, 0, r * 0.76, C.bois, C.boisFonce, 1.5);
      for (const k of [-0.45, -0.15, 0.15, 0.45]) trace(ctx, [[k * r * 0.76, -r * 0.7], [k * r * 0.76, r * 0.7]], C.boisFonce, 1);
      for (const k of [-0.4, 0.4]) rect(ctx, -r * 0.75, k * r * 0.76 - r * 0.07, r * 1.5, r * 0.14, C.boisFonce);
      rond(ctx, 0, 0, r * 0.12, null, '#4a4a4a', 2);
    },
    treuil(ctx, w, h, t) {
      const r = Math.min(w, h) * 0.42;
      ombre(ctx, t, () => rond(ctx, 0, 0, r, C.pierre));
      rond(ctx, 0, 0, r, C.pierre, C.murFonce, 1.5);
      rond(ctx, 0, 0, r * 0.66, '#14202a', C.pierreFonce, 1.5);
      rond(ctx, -r * 0.15, -r * 0.15, r * 0.15, 'rgba(120,170,200,0.35)');
      trace(ctx, [[-r * 0.9, 0], [r * 0.9, 0]], C.boisFonce, Math.max(3, t * 0.07)); trace(ctx, [[-r * 0.9, 0], [r * 0.9, 0]], C.bois, Math.max(1.6, t * 0.04)); // la poutre
      rect(ctx, -r * 0.98, -t * 0.05, t * 0.1, t * 0.1, C.bois, C.boisFonce, 1); rect(ctx, r * 0.98 - t * 0.1, -t * 0.05, t * 0.1, t * 0.1, C.bois, C.boisFonce, 1); // les montants
      rond(ctx, 0, 0, r * 0.2, C.boisClair, C.boisFonce, 1.5); rond(ctx, 0, 0, r * 0.13, '#4f7f9a');           // le seau
    },
  },
};
// Un état (variante non défaut) a son dessin ; l'état d'origine garde le dessin d'avant, appelé tel quel.
for (const type of Object.keys(ETATS)) {
  const origine = objets[type];
  objets[type] = (ctx, w, h, t, o, plan) => (ETATS[type][varianteDe(o)] ?? origine)(ctx, w, h, t, o, plan);
}
objets.autel = enLong(objets.autel); // l'autel, long selon x, reste 2 × 1 quand son repère est de 1 × 2 (regard à l'est ou à l'ouest)

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

/** Porte reliée : pastille bleue avec deux maillons, posée côté pièce. Escalier relié (`mur` null) : au milieu de l'escalier. */
export function marqueLiaison(ctx, r, mur, t) {
  const dedans = { nord: [0, 1], sud: [0, -1], ouest: [1, 0], est: [-1, 0] }[mur] || [0, 0];
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
