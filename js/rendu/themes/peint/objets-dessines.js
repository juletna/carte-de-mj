/**
 * Objets DESSINÉS du thème peint (réglage « Détails des sols » = riches), dans le langage des murs dessinés (murs-dessines.js) et des portes
 * dessinées (portes-dessinees.js) : aplats clairs et francs (pierre chaude, bois doré, marbre blanc, drap bleu, ferrures grises, or), éclairés en
 * deux bandes sans dégradé (liseré clair du côté de la lumière nord-ouest, bande d'ombre nette du côté opposé), cernés d'un trait d'encre net, avec des
 * détails nets plutôt que du bruit : joints de pierre, fil et planches du bois, veinage du marbre, clous et reflets, ferrures, serrures dorées.
 *
 * Ce qui ne change JAMAIS entre les deux styles : l'emprise, les proportions, la fausse 3D (`V.prisme`, `V.cylindre` : mêmes pièces, mêmes hauteurs),
 * l'ordre de dessin (`ordonner`), les sources de lumière (`V.lumiere`) et les flammes. Seuls changent les tons, le dessus des pièces et les détails
 * de leurs faces. Appelé par le garde de objets.js (`etat.details === 'riches'`) ; le dessin « sobres » ne passe jamais ici. Chaque objet y a sa
 * fonction, rangée dans `RICHES` ; un type sans entrée garde son dessin d'avant (les derniers objets arrivent dans un second temps).
 * Tout est déterministe : l'aléa vient de la graine de l'objet (`preparerObjet`), jamais de Math.random. Sans relief (KP = 0), seul le dessus des
 * pièces se voit : il porte les détails principaux pour rester lisible. Toutes les couleurs et épaisseurs à régler sont les constantes ci-dessous.
 */
import { faceVisible } from '../../perspective.js';
import { encre, trait, ton, arrondi, rectPts, centre, ENCRE } from './trait.js';
import { preparerObjet, face, ordonner, poly, milieu, distCentre, COTES, paroi, flamme, lumiereFeu } from './objets.js';
import { etat } from './etat.js';
import { etatPeint } from './objets-etats.js';
import { sensDuCoin } from '../commun.js';
import { teinteFlamme, fumee } from '../../feu.js';
import { TEINTES_TISSU } from '../../teintes-tissu.js';
import { aUneVariante, varianteDe } from '../../../catalogue.js';

// --- Réglages -----------------------------------------------------------------------------------------------
const EP = 1.3; // trait d'encre autour des formes
const EP_FIN = 0.9; // trait d'encre des joints et des fentes
const FIL = 'rgba(70,40,16,0.5)'; // fil du bois
const JOINT = 'rgba(52,40,26,0.6)'; // joint de pierre
const LISERE = 'rgba(255,252,238,0.85)'; // liseré clair (côté lumière)
const OMBRE = 'rgba(96,64,32,0.34)'; // bande d'ombre nette (côté opposé)

// Pierre chaude et claire : teintes [h, s, l] pour les flancs (la fausse 3D les ombre) et aplats pour les dessus.
const PIERRE_C = [38, 24, 76], PIERRE_C_SOMBRE = [36, 22, 66];
const DESSUS_PIERRE = ['#e6dac0', '#eee3c9', '#d9cba9'];
const PIERRE_CLAIRE = '#ece4d0', PIERRE_ECLAT = '#f6f0e2';
// Marbre blanc veiné de gris-bleu.
const MARBRE_C = [42, 14, 86];
const MARBRE_DESSUS = '#f6f2e8', MARBRE_VEINE = 'rgba(110,126,150,0.55)';
// Bois : flancs, planches de tons variés (dorés), bois foncé (dossiers, pieds).
const BOIS_C = [30, 58, 60], BOIS_C_SOMBRE = [28, 52, 52];
const PLANCHES = ['#dba660', '#cf9650', '#e4b476', '#c78a46', '#d6a05a'];
const BOIS_FONCE = ['#b97b3f', '#a96f36', '#c4854a'];
// Fer et or.
const FER = '#5d6270', FER_REFLET = '#bfc6d2', FER_CLAIR = '#8a90a0';
const OR = '#f0c648', OR_REFLET = '#fff2ad', OR_OMBRE = '#b8862a', OR_C = [43, 72, 60];
const ROUGE = '#cf4a3c', ROUGE_CLAIR = '#ef7a64', ROUGE_OMBRE = '#8e2a22';
const BLEU = '#5a89cf', BLEU_CLAIR = '#8db3ea', BLEU_OMBRE = '#36609f';
const DRAP = '#f8f2e2', DRAP_OMBRE = '#d8cdb0';
const LIVRES = ['#d6584a', '#4d86c4', '#58a54a', '#e0a93a', '#8d62b8', '#c9794a', '#e6d6a0', '#3f9a96']; // dos des livres : francs et clairs
// Eau : bleu clair franc, reflets en aplats. Mousse, os.
const EAU = '#6cbdee', EAU_CLAIR = '#b2e1f9', EAU_REFLET = '#f4fbff', EAU_LISERE = 'rgba(255,255,255,0.55)', EAU_OMBRE = 'rgba(38,104,168,0.4)';
const MOUSSE = '#7fbf4a', MOUSSE_CLAIR = '#a9dd6c';
const OS = '#f4ecd2', OS_OMBRE = '#cdbf98';
const CRANE = ['#f4ecd2', '#e8dcb8'];
const VIDE = '#6a523b'; // le fond d'un creux : brun chaud, jamais noir
const VIDE_FOND = '#4d3a2a';

// --- Briques ------------------------------------------------------------------------------------------------

/** Une forme remplie : liste de points (rectangle, polygone). `trace` ajoute son contour au chemin courant (décalé de dx, dy). */
const polygone = (pts) => ({
  taille: Math.min(Math.max(...pts.map((p) => p[0])) - Math.min(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[1])) - Math.min(...pts.map((p) => p[1]))),
  trace(ctx, dx = 0, dy = 0) { pts.forEach(([x, y], i) => (i ? ctx.lineTo(x + dx, y + dy) : ctx.moveTo(x + dx, y + dy))); ctx.closePath(); },
});
const rect = (x, y, w, h, rr = 0) => polygone(rr ? arrondi(x, y, w, h, rr) : rectPts(x, y, w, h));
const disque = (cx, cy, R) => ({ taille: R * 2, trace(ctx, dx = 0, dy = 0) { ctx.moveTo(cx + dx + R, cy + dy); ctx.arc(cx + dx, cy + dy, R, 0, Math.PI * 2); } });

/**
 * Un aplat éclairé : la forme `F` remplie de `fond`, un liseré clair du côté de la lumière et une bande d'ombre nette du côté opposé (la forme décalée
 * vers l'un puis l'autre, ce qui dépasse est recoupé), puis le trait d'encre. `o.dedans(ctx)` dessine des détails dans la forme avant les bandes.
 */
function plaque(ctx, V, F, fond, o = {}) {
  const [lx, ly] = V.vue.lum, d = o.bande ?? Math.max(1.8, Math.min(6, F.taille * 0.12));
  ctx.beginPath(); F.trace(ctx); ctx.fillStyle = fond; ctx.fill();
  ctx.save();
  ctx.beginPath(); F.trace(ctx); ctx.clip();
  o.dedans?.(ctx);
  for (const [sg, c] of [[-1, o.lisere ?? LISERE], [1, o.ombre ?? OMBRE]]) {
    ctx.beginPath(); ctx.rect(-1e4, -1e4, 2e4, 2e4); F.trace(ctx, sg * lx * d, sg * ly * d); ctx.fillStyle = c; ctx.fill('evenodd');
  }
  ctx.restore();
  ctx.beginPath(); F.trace(ctx); ctx.lineWidth = o.ep ?? EP; ctx.strokeStyle = ENCRE; ctx.stroke();
}

/** Le point de la forme rectangulaire (x, y, w, h) à l'abscisse u et à l'ordonnée v (0–1). */
const pRect = (x, y, w, h) => (u, v) => [x + w * u, y + h * v];
/** Idem pour un quadrilatère S = [nord-ouest, nord-est, sud-est, sud-ouest] (le dessus d'une pièce en retrait). */
const pQuad = (S) => (u, v) => { const a = milieu(S[0], S[1], u), b = milieu(S[3], S[2], u); return milieu(a, b, v); };

/** Un ligne brisée d'une couleur et d'une épaisseur. */
function ligne(ctx, pts, couleur, ep) { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(...p) : ctx.moveTo(...p))); trait(ctx, couleur, ep); }

/**
 * Des planches de `n` bandes (dans le sens des v) sur la forme décrite par `P(u, v)` : tons variés, fente d'encre entre deux planches, un ou deux traits de fil
 * du bois ondulés, une rangée de clous aux deux bouts si `clous`. À appeler dans `dedans` d'une plaque.
 */
function planches(ctx, r, P, n, tons = PLANCHES, clous = 0) {
  for (let i = 0; i < n; i++) {
    const v0 = i / n, v1 = (i + 1) / n;
    ctx.beginPath(); [P(-0.1, v0), P(1.1, v0), P(1.1, v1), P(-0.1, v1)].forEach((p, k) => (k ? ctx.lineTo(...p) : ctx.moveTo(...p)));
    ctx.fillStyle = tons[Math.floor(r() * tons.length)]; ctx.fill();
    if (i) ligne(ctx, [P(-0.1, v0), P(1.1, v0)], 'rgba(40,26,14,0.75)', EP_FIN);
    for (let k = 0; k < 2; k++) {
      const vm = v0 + (v1 - v0) * (0.3 + 0.4 * r()), a = 0.05 + r() * 0.3, b = a + 0.25 + r() * 0.35, w = (v1 - v0) * 0.12 * (r() - 0.5);
      ctx.beginPath(); ctx.moveTo(...P(a, vm)); ctx.quadraticCurveTo(...P((a + b) / 2, vm + w), ...P(b, vm + w * 0.2)); trait(ctx, FIL, 0.8);
    }
  }
  if (clous) for (let i = 0; i < n; i++) for (const u of [0.04, 0.96]) clou(ctx, P(u, (i + 0.5) / n), clous);
}

/** Un clou ou rivet : un petit disque de fer cerné d'encre avec un point de reflet. */
function clou(ctx, [x, y], rr, fond = FER_CLAIR) {
  ctx.beginPath(); ctx.arc(x, y, rr, 0, 7); encre(ctx, fond, 0.7);
  ctx.beginPath(); ctx.arc(x - rr * 0.3, y - rr * 0.3, rr * 0.35, 0, 7); ctx.fillStyle = FER_REFLET; ctx.fill();
}

/** Vers quel côté va la lumière quand on avance sur une face (+1 : le sens croissant de u regarde la lumière) ? */
const sensLumiere = (V, cote) => ((cote === 'nord' || cote === 'sud' ? V.vue.lum[0] : V.vue.lum[1]) >= 0 ? 1 : -1);

/** Sur une face visible : liseré clair le long de l'arête côté lumière, bande d'ombre le long de l'autre (de la hauteur v0 à v1, largeur `w` en part de la face). */
function aretes(ctx, V, F, cote, v0, v1, w = 0.07) {
  if (!F.visible) return;
  const s = sensLumiere(V, cote), bande = (u0, u1, c) => { poly(ctx, [F.P(u0, v0), F.P(u1, v0), F.P(u1, v1), F.P(u0, v1)]); ctx.fillStyle = c; ctx.fill(); };
  bande(s > 0 ? 1 - w : 0, s > 0 ? 1 : w, LISERE);
  bande(s > 0 ? 0 : 1 - w, s > 0 ? w : 1, OMBRE);
}

/** Joints d'une maçonnerie sur une face visible : `rangs` assises, joints verticaux décalés d'une assise à l'autre (`par` pierres par assise). */
function joints(ctx, F, v0, v1, rangs, par = 3) {
  if (!F.visible) return;
  ctx.beginPath();
  for (let k = 1; k < rangs; k++) { const v = v0 + ((v1 - v0) * k) / rangs; ctx.moveTo(...F.P(0.02, v)); ctx.lineTo(...F.P(0.98, v)); }
  for (let k = 0; k < rangs; k++) {
    const va = v0 + ((v1 - v0) * k) / rangs, vb = v0 + ((v1 - v0) * (k + 1)) / rangs;
    for (let j = 1; j < par; j++) { const u = (j + (k % 2 ? 0.5 : 0)) / par; if (u < 0.98) { ctx.moveTo(...F.P(u, va)); ctx.lineTo(...F.P(u, vb)); } }
  }
  trait(ctx, JOINT, EP_FIN);
}

/** Les planches verticales d'une face de bois visible : `n` fentes d'encre et un trait de fil par planche. */
function planchesFace(ctx, r, F, v0, v1, n) {
  if (!F.visible) return;
  ctx.beginPath();
  for (let k = 1; k < n; k++) { const v = v0 + ((v1 - v0) * k) / n; ctx.moveTo(...F.P(0.015, v)); ctx.lineTo(...F.P(0.985, v)); }
  trait(ctx, 'rgba(48,28,12,0.7)', EP_FIN);
  ctx.beginPath();
  for (let k = 0; k < n; k++) { const v = v0 + ((v1 - v0) * (k + 0.35 + r() * 0.3)) / n * 1, u = 0.1 + r() * 0.4; ctx.moveTo(...F.P(u, v)); ctx.lineTo(...F.P(u + 0.18 + r() * 0.2, v)); }
  trait(ctx, FIL, 0.7);
}

/** Une bande pleine (ferrure, sangle, galon) sur une face visible, cernée d'encre, avec un reflet clair. */
function bandeFace(ctx, F, u0, u1, v0, v1, fond, reflet = true) {
  if (!F.visible) return;
  poly(ctx, [F.P(u0, v0), F.P(u1, v0), F.P(u1, v1), F.P(u0, v1)]); encre(ctx, fond, 0.8);
  if (reflet) ligne(ctx, [F.P(u0 + (u1 - u0) * 0.22, v0 + (v1 - v0) * 0.82), F.P(u0 + (u1 - u0) * 0.22, v0 + (v1 - v0) * 0.18)], FER_REFLET, 0.7);
}

/** Quelques reflets nets sur l'eau : trois traits courbes clairs, dans l'ellipse (cx, cy, rx, ry). */
function reflets(ctx, cx, cy, rx, ry) {
  for (const [a, b, l] of [[-0.5, -0.3, 0.5], [0.05, 0.25, 0.4], [-0.25, 0.5, 0.28]]) {
    ctx.beginPath(); ctx.moveTo(cx + a * rx, cy + b * ry); ctx.quadraticCurveTo(cx + (a + l / 2) * rx, cy + (b - 0.1) * ry, cx + (a + l) * rx, cy + b * ry);
    ctx.lineCap = 'round'; trait(ctx, EAU_REFLET, 1.4); ctx.lineCap = 'butt';
  }
}

/** Le rocher dessiné : un bloc irrégulier bas au sommet étroit (mêmes pièces que `rocher` de objets.js), dessus clair éclairé, une fissure, un peu de mousse si `mousse`. */
function bloc(ctx, V, r, cx, cy, R, h, c, dessus = DESSUS_PIERRE[0], mousse = false) {
  const pts = [];
  for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2 + r() * 0.3, rr = R * (0.78 + r() * 0.28); pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.88]); }
  const kf = r(), kc = (r() * 9) | 0;
  V.prisme(ctx, r, pts, 0, h, c, (S) => {
    const g = centre(S), A = S[kc % 9], k = 0.45 + kf * 0.2;
    plaque(ctx, V, polygone(S), dessus, { ep: 1.1, dedans: () => {
      ligne(ctx, [A, [A[0] + (g[0] - A[0]) * k, A[1] + (g[1] - A[1]) * k]], JOINT, 0.9); // la fissure
      if (mousse) for (const [dx, dy, q] of [[-0.3, -0.2, 0.3], [-0.05, -0.32, 0.22], [-0.45, 0.05, 0.2]]) {
        ctx.beginPath(); ctx.arc(g[0] + dx * R, g[1] + dy * R, R * q * 0.5, 0, 7); encre(ctx, MOUSSE, 0.7);
        ctx.beginPath(); ctx.arc(g[0] + dx * R - R * 0.04, g[1] + dy * R - R * 0.04, R * q * 0.22, 0, 7); ctx.fillStyle = MOUSSE_CLAIR; ctx.fill();
      }
    } });
  }, 0.62);
}

/** Le bout éteint d'un feu : un moignon de charbon gris clair, un peu de cendre blanche et un filet de fumée (`s` px : la taille de la flamme qu'il remplace). */
function feuEteintRiche(ctx, V, x, y, h, s) {
  const [fx, fy] = V.haut(x, y, h);
  ctx.beginPath(); ctx.ellipse(fx, fy - s * 0.1, s * 0.55, s * 0.4, 0, 0, 7); encre(ctx, '#7f756c', 0.9);
  ctx.beginPath(); ctx.ellipse(fx + s * 0.15, fy - s * 0.2, s * 0.3, s * 0.2, 0, 0, 7); encre(ctx, '#ddd7cc', 0.6);
  fumee(ctx, fx, fy - s * 0.4, s * 3.2, { largeur: Math.max(1.1, s * 0.2), couleur: '176,170,164' });
}

// --- Les objets ---------------------------------------------------------------------------------------------

export const RICHES = {
  pilier(ctx, w, h, t, o) {
    const { V, r } = preparerObjet(ctx, o), s = Math.min(w, h), a = s * 0.46, f = s * 0.31, ch = s * 0.41;
    V.prisme(ctx, r, rectPts(-a, -a, a * 2, a * 2), 0, 0.07, PIERRE_C_SOMBRE, () => plaque(ctx, V, rect(-a, -a, a * 2, a * 2, 4), DESSUS_PIERRE[2], { ep: EP * 1.2 }));
    V.prisme(ctx, r, rectPts(-f, -f, f * 2, f * 2), 0.07, 0.94, PIERRE_C, () => plaque(ctx, V, rect(-f, -f, f * 2, f * 2), DESSUS_PIERRE[0]));
    for (const c of COTES) { const F = face(V, -f, -f, f * 2, f * 2, c); joints(ctx, F, 0.07, 0.94, 6, 2); aretes(ctx, V, F, c, 0.07, 0.94); }
    V.prisme(ctx, r, rectPts(-ch, -ch, ch * 2, ch * 2), 0.94, 1, PIERRE_C_SOMBRE, () => plaque(ctx, V, rect(-ch, -ch, ch * 2, ch * 2, 3), DESSUS_PIERRE[1], {
      ep: EP * 1.2,
      dedans: (c) => { c.beginPath(); rect(-f, -f, f * 2, f * 2).trace(c); trait(c, 'rgba(120,104,80,0.7)', 1); },
    }));
  },

  colonne(ctx, w, h, t, o) {
    const { V, r } = preparerObjet(ctx, o), s = Math.min(w, h), R = s * 0.28;
    V.cylindre(ctx, r, 0, 0, s * 0.4, 0, 0.07, PIERRE_C_SOMBRE, () => plaque(ctx, V, disque(0, 0, s * 0.4), DESSUS_PIERRE[2], { ep: EP * 1.2 }));
    V.cylindre(ctx, r, 0, 0, R, 0.07, 0.93, PIERRE_C, () => plaque(ctx, V, disque(0, 0, R), DESSUS_PIERRE[0]), true);
    V.cylindre(ctx, r, 0, 0, s * 0.37, 0.93, 1, PIERRE_C, () => {
      plaque(ctx, V, disque(0, 0, s * 0.37), DESSUS_PIERRE[1], { ep: EP * 1.2 });
      ctx.beginPath(); ctx.arc(0, 0, R * 0.9, 0, 7); trait(ctx, 'rgba(120,104,80,0.7)', 1);
      plaque(ctx, V, disque(0, 0, R * 0.45), PIERRE_CLAIRE, { ep: 1 });
    });
  },

  coffre(ctx, w, h, t, o) {
    const etatRiche = etatPeint(true, 'coffre', o); // une variante (coffre ouvert…) : objets-etats.js
    if (etatRiche) return etatRiche(ctx, w, h, t, o);
    const { V, r } = preparerObjet(ctx, o), cw = w * 0.8, ch = h * 0.6, x = -cw / 2, y = -ch / 2;
    V.prisme(ctx, r, rectPts(x, y, cw, ch), 0, 0.17, BOIS_C, () => plaque(ctx, V, rect(x, y, cw, ch), PLANCHES[1], { dedans: () => planches(ctx, r, pRect(x, y, cw, ch), 3) }));
    for (const c of COTES) {
      const F = face(V, x, y, cw, ch, c);
      planchesFace(ctx, r, F, 0, 0.17, 3);
      for (const u of c === 'nord' || c === 'sud' ? [0.2, 0.8] : [0.25, 0.75]) bandeFace(ctx, F, u - 0.05, u + 0.05, 0, 0.17, FER);
      aretes(ctx, V, F, c, 0, 0.17, 0.04);
    }
    V.prisme(ctx, r, rectPts(x, y, cw, ch), 0.17, 0.27, BOIS_C, (S) => {
      plaque(ctx, V, polygone(S), PLANCHES[2], { dedans: () => planches(ctx, r, pQuad(S), 3, PLANCHES) });
      const P = pQuad(S);
      for (const u of [0.2, 0.8]) { // sangles de fer, rivetées
        poly(ctx, [P(u - 0.05, 0), P(u + 0.05, 0), P(u + 0.05, 1), P(u - 0.05, 1)]); encre(ctx, FER, 0.9);
        ligne(ctx, [P(u - 0.025, 0.08), P(u - 0.025, 0.92)], FER_REFLET, 0.8);
        for (const v of [0.12, 0.88]) clou(ctx, P(u, v), Math.max(0.9, t * 0.022));
      }
      const [fx, fy] = P(0.5, 0.94), q = Math.max(2.2, t * 0.06); // serrure dorée sur le devant
      poly(ctx, [[fx - q, fy - q * 1.6], [fx + q, fy - q * 1.6], [fx + q, fy + q * 0.4], [fx - q, fy + q * 0.4]]); encre(ctx, OR, 0.9);
      ctx.beginPath(); ctx.arc(fx, fy - q * 0.7, q * 0.35, 0, 7); ctx.fillStyle = OR_OMBRE; ctx.fill();
      ligne(ctx, [[fx - q * 0.6, fy - q * 1.35], [fx + q * 0.2, fy - q * 1.35]], OR_REFLET, 0.8);
    }, 0.88);
  },

  statue(ctx, w, h, t, o) {
    const etatRiche = etatPeint(true, 'statue', o); // une variante (coffre ouvert…) : objets-etats.js
    if (etatRiche) return etatRiche(ctx, w, h, t, o);
    const { V, r } = preparerObjet(ctx, o), s = Math.min(w, h), a = s * 0.38;
    const veines = (ctx2, R) => { // veinage du marbre : trois traits fins ondulés
      for (let k = 0; k < 3; k++) {
        const y0 = (r() - 0.5) * R * 1.4, x0 = -R * 0.9, w0 = (r() - 0.5) * R * 0.6;
        ctx2.beginPath(); ctx2.moveTo(x0, y0); ctx2.quadraticCurveTo(0, y0 + w0, R * 0.9, y0 - w0 * 0.6); trait(ctx2, MARBRE_VEINE, 0.8);
      }
    };
    V.prisme(ctx, r, rectPts(-a, -a, a * 2, a * 2), 0, 0.13, PIERRE_C_SOMBRE, () => plaque(ctx, V, rect(-a, -a, a * 2, a * 2, 4), DESSUS_PIERRE[2], { ep: EP * 1.2 }));
    const F = face(V, -a, -a, a * 2, a * 2, 'sud'); // la plaque dorée du socle
    bandeFace(ctx, F, 0.3, 0.7, 0.035, 0.095, OR, false);
    for (const c of COTES) aretes(ctx, V, face(V, -a, -a, a * 2, a * 2, c), c, 0, 0.13, 0.05);
    V.cylindre(ctx, r, 0, 0, s * 0.19, 0.13, 0.46, MARBRE_C, () => plaque(ctx, V, disque(0, 0, s * 0.19), MARBRE_DESSUS, { dedans: () => veines(ctx, s * 0.19) }));
    V.cylindre(ctx, r, 0, 0, s * 0.24, 0.46, 0.58, MARBRE_C, () => plaque(ctx, V, { taille: s * 0.4, trace: (c, dx = 0, dy = 0) => { c.moveTo(s * 0.27 + dx, dy); c.ellipse(dx, dy, s * 0.27, s * 0.2, 0, 0, Math.PI * 2); } }, MARBRE_DESSUS, { dedans: () => veines(ctx, s * 0.22) }));
    V.cylindre(ctx, r, 0, s * 0.01, s * 0.115, 0.58, 0.72, MARBRE_C, () => {
      plaque(ctx, V, disque(0, s * 0.01, s * 0.115), '#fbf7ee', { ep: 1.2 });
      poly(ctx, [[-s * 0.035, s * 0.07], [s * 0.035, s * 0.07], [0, s * 0.13]]); encre(ctx, '#e2dccd', 0.7); // le nez : le regard de la statue
      for (const sg of [-1, 1]) { ctx.beginPath(); ctx.arc(sg * s * 0.045, s * 0.04, s * 0.012, 0, 7); ctx.fillStyle = '#7c8aa0'; ctx.fill(); }
    });
  },

  table(ctx, w, h, t, o) {
    const { V, r } = preparerObjet(ctx, o), tw = w - t * 0.16, th = h - t * 0.2, x = -tw / 2, y = -th / 2, p = t * 0.09, hp = 0.22;
    for (const [lx, ly] of [[x + t * 0.05, y + t * 0.05], [x + tw - t * 0.05 - p, y + t * 0.05], [x + t * 0.05, y + th - t * 0.05 - p], [x + tw - t * 0.05 - p, y + th - t * 0.05 - p]]
      .sort((a, b) => distCentre(V, b[0], b[1]) - distCentre(V, a[0], a[1]))) V.prisme(ctx, r, rectPts(lx, ly, p, p), 0, hp, BOIS_C_SOMBRE, () => plaque(ctx, V, rect(lx, ly, p, p), BOIS_FONCE[0], { ep: 1 }));
    V.prisme(ctx, r, rectPts(x, y, tw, th), hp, 0.28, BOIS_C, () => plaque(ctx, V, rect(x, y, tw, th, 5), PLANCHES[0], { ep: EP * 1.3, dedans: () => planches(ctx, r, pRect(x, y, tw, th), 4, PLANCHES, Math.max(0.9, t * 0.02)) }));
    for (const c of COTES) aretes(ctx, V, face(V, x, y, tw, th, c), c, hp, 0.28, 0.03);
  },

  chaise(ctx, w, h, t, o) {
    const { V, r } = preparerObjet(ctx, o), s = Math.min(w, h), sx = s * 0.54, sy = s * 0.5, x = -sx / 2, y = -sy / 2 + s * 0.04, p = s * 0.08;
    const assise = () => {
      for (const [lx, ly] of [[x + 1, y + 1], [x + sx - p - 1, y + 1], [x + 1, y + sy - p - 1], [x + sx - p - 1, y + sy - p - 1]]
        .sort((a, b) => distCentre(V, b[0], b[1]) - distCentre(V, a[0], a[1]))) V.prisme(ctx, r, rectPts(lx, ly, p, p), 0, 0.14, BOIS_C_SOMBRE, () => plaque(ctx, V, rect(lx, ly, p, p), BOIS_FONCE[0], { ep: 1 }));
      V.prisme(ctx, r, rectPts(x, y, sx, sy), 0.14, 0.19, BOIS_C, () => {
        plaque(ctx, V, rect(x, y, sx, sy, 4), PLANCHES[0], { ep: EP * 1.2 });
        plaque(ctx, V, rect(x + sx * 0.14, y + sy * 0.14, sx * 0.72, sy * 0.72, 3), ROUGE, { ep: 0.9, bande: 1.6, lisere: 'rgba(255,170,150,0.7)', ombre: 'rgba(90,20,14,0.4)' });
        ctx.beginPath(); ctx.arc(x + sx / 2, y + sy / 2, Math.max(1, s * 0.03), 0, 7); encre(ctx, ROUGE_CLAIR, 0.6); // le bouton du coussin
      });
    };
    const bd = s * 0.1, by = y - bd * 0.2;
    const dossier = () => {
      V.prisme(ctx, r, rectPts(x - sx * 0.04, by, sx * 1.08, bd), 0.19, 0.5, BOIS_C_SOMBRE, () => plaque(ctx, V, rect(x - sx * 0.04, by, sx * 1.08, bd), BOIS_FONCE[1], { ep: EP * 1.1, dedans: () => planches(ctx, r, pRect(x - sx * 0.04, by, sx * 1.08, bd), 1, BOIS_FONCE) }));
      for (const c of COTES) planchesFace(ctx, r, face(V, x - sx * 0.04, by, sx * 1.08, bd, c), 0.19, 0.5, 2);
    };
    ordonner(V, [{ x: 0, y: y + sy / 2, dessiner: assise }, { x: 0, y: by + bd / 2, dessiner: dossier }]);
  },

  autel(ctx, w, h, t, o) {
    const etatRiche = etatPeint(true, 'autel', o); // une variante : objets-etats-decor.js
    if (etatRiche) return etatRiche(ctx, w, h, t, o);
    const { V, r } = preparerObjet(ctx, o), aw = w - t * 0.14, ah = h - t * 0.3, x = -aw / 2, y = -ah / 2;
    V.prisme(ctx, r, rectPts(x + t * 0.05, y + t * 0.04, aw - t * 0.1, ah - t * 0.08), 0, 0.24, PIERRE_C_SOMBRE, () => plaque(ctx, V, rect(x, y, aw, ah), DESSUS_PIERRE[2]));
    for (const c of COTES) { const F = face(V, x + t * 0.05, y + t * 0.04, aw - t * 0.1, ah - t * 0.08, c); joints(ctx, F, 0, 0.24, 3, 4); aretes(ctx, V, F, c, 0, 0.24); }
    V.prisme(ctx, r, rectPts(x, y, aw, ah), 0.24, 0.32, PIERRE_C, () => {
      plaque(ctx, V, rect(x, y, aw, ah, 4), DESSUS_PIERRE[1], { ep: EP * 1.2 });
      plaque(ctx, V, rect(x + aw * 0.32, y, aw * 0.36, ah), ROUGE, { ep: 1, bande: 2, lisere: 'rgba(255,170,150,0.7)', ombre: 'rgba(90,20,14,0.4)' }); // le chemin d'autel
      ctx.beginPath(); rect(x + aw * 0.35, y + 1.5, aw * 0.3, ah - 3).trace(ctx); trait(ctx, OR, 1.1); // galon doré
      plaque(ctx, V, disque(0, 0, ah * 0.17), OR, { ep: 0.9, bande: 1.6, lisere: OR_REFLET, ombre: 'rgba(140,90,20,0.45)' }); // le soleil d'or
      ctx.beginPath(); ctx.arc(0, 0, ah * 0.07, 0, 7); trait(ctx, OR_OMBRE, 0.8);
    });
    for (const sgn of [-1, 1]) {
      const cx = sgn * aw * 0.4, rr = t * 0.05;
      V.cylindre(ctx, r, cx, 0, rr, 0.32, 0.43, [44, 40, 90], () => plaque(ctx, V, disque(cx, 0, rr), '#fffaf0', { ep: 0.8, bande: 1 }));
      V.lumiere(cx, 0, 0.43, { s: t * 0.07, r: t * 1.6, c: '255,190,110', k: 0.45, petite: true });
      flamme(ctx, V, cx, 0, 0.43, t * 0.045);
    }
  },

  trone(ctx, w, h, t, o) {
    const { V, r } = preparerObjet(ctx, o), s = Math.min(w, h) * 0.82, e = s / 2;
    V.prisme(ctx, r, rectPts(-e, -e, s, s), 0, 0.07, PIERRE_C_SOMBRE, () => plaque(ctx, V, rect(-e, -e, s, s, 4), DESSUS_PIERRE[2], { ep: EP * 1.2 }));
    const or = (F, fond = OR) => plaque(ctx, V, F, fond, { lisere: OR_REFLET, ombre: 'rgba(130,84,18,0.45)' });
    const piece = (x, y, l, p, h0, h1, dessus, c = OR_C) => ({ x: x + l / 2, y: y + p / 2, dessiner: () => {
      V.prisme(ctx, r, rectPts(x, y, l, p), h0, h1, c, dessus);
      for (const k of COTES) aretes(ctx, V, face(V, x, y, l, p, k), k, h0, h1, 0.1);
    } });
    ordonner(V, [
      piece(-s * 0.4, -s * 0.46, s * 0.8, s * 0.16, 0.07, 0.9, () => {
        or(rect(-s * 0.4, -s * 0.46, s * 0.8, s * 0.16, 3), '#f4cf56');
        plaque(ctx, V, disque(0, -s * 0.38, s * 0.05), ROUGE_CLAIR, { ep: 0.8, bande: 1.2, lisere: '#ffd2c4', ombre: 'rgba(120,20,16,0.5)' }); // le rubis du dossier
      }),
      piece(-s * 0.38, -s * 0.3, s * 0.76, s * 0.6, 0.07, 0.2, () => {
        or(rect(-s * 0.38, -s * 0.3, s * 0.76, s * 0.6, 4));
        plaque(ctx, V, rect(-s * 0.26, -s * 0.2, s * 0.52, s * 0.42, 5), ROUGE, { ep: 0.9, bande: 1.8, lisere: 'rgba(255,170,150,0.7)', ombre: 'rgba(90,20,14,0.4)' });
        ctx.beginPath(); ctx.arc(0, s * 0.01, Math.max(1, s * 0.035), 0, 7); encre(ctx, OR, 0.6); // bouton du coussin
      }),
      piece(-s * 0.48, -s * 0.3, s * 0.12, s * 0.6, 0.07, 0.34, () => or(rect(-s * 0.48, -s * 0.3, s * 0.12, s * 0.6, 3), '#eec346')),
      piece(s * 0.36, -s * 0.3, s * 0.12, s * 0.6, 0.07, 0.34, () => or(rect(s * 0.36, -s * 0.3, s * 0.12, s * 0.6, 3), '#eec346')),
    ]);
  },

  tonneau(ctx, w, h, t, o) {
    const etatRiche = etatPeint(true, 'tonneau', o); // une variante (coffre ouvert…) : objets-etats.js
    if (etatRiche) return etatRiche(ctx, w, h, t, o);
    const { V, r } = preparerObjet(ctx, o), R = Math.min(w, h) * 0.38, h1 = 0.34;
    V.cylindre(ctx, r, 0, 0, R, 0, h1, BOIS_C, () => {
      plaque(ctx, V, disque(0, 0, R), PLANCHES[0], { ep: EP * 1.2, dedans: () => planches(ctx, r, (u, v) => [-R + 2 * R * v, -R + 2 * R * u], 6, PLANCHES) }); // douelles
      ctx.beginPath(); ctx.arc(0, 0, R * 0.9, 0, 7); trait(ctx, FER, 2.6); // le cercle de fer, avec son reflet
      ctx.beginPath(); ctx.arc(0, 0, R * 0.9, Math.PI * 1.05, Math.PI * 1.45); trait(ctx, FER_REFLET, 1);
      ctx.beginPath(); ctx.arc(0, 0, R * 0.9 + 1.5, 0, 7); trait(ctx, ENCRE, 0.7);
      plaque(ctx, V, disque(R * 0.25, R * 0.1, Math.max(1.4, R * 0.1)), '#6a4020', { ep: 0.8, bande: 0.8 }); // la bonde
    });
    V.cerclage(ctx, 0, 0, R, 0.07, h1); V.cerclage(ctx, 0, 0, R, 0.26, h1);
  },

  caisse(ctx, w, h, t, o) {
    const etatRiche = etatPeint(true, 'caisse', o); // une variante (coffre ouvert…) : objets-etats.js
    if (etatRiche) return etatRiche(ctx, w, h, t, o);
    const { V, r } = preparerObjet(ctx, o), s = Math.min(w, h) * 0.78, x = -s / 2, y = -s / 2;
    V.prisme(ctx, r, rectPts(x, y, s, s), 0, 0.27, BOIS_C, () => plaque(ctx, V, rect(x, y, s, s), PLANCHES[2], { ep: EP * 1.2, dedans: (c) => {
      planches(ctx, r, pRect(x, y, s, s), 4, PLANCHES);
      ligne(c, [[x + 3, y + 3], [x + s - 3, y + s - 3]], '#a8702f', 3.2); ligne(c, [[x + 3, y + 3], [x + s - 3, y + s - 3]], ENCRE, 0.7); // la croix de renfort
      ligne(c, [[x + s - 3, y + 3], [x + 3, y + s - 3]], '#a8702f', 3.2);
      for (const [px, py] of [[x + 4, y + 4], [x + s - 4, y + 4], [x + 4, y + s - 4], [x + s - 4, y + s - 4]]) clou(c, [px, py], Math.max(0.9, t * 0.02));
    } }));
    for (const c of COTES) {
      const F = face(V, x, y, s, s, c);
      planchesFace(ctx, r, F, 0, 0.27, 3);
      bandeFace(ctx, F, 0.04, 0.12, 0, 0.27, BOIS_FONCE[0], false); bandeFace(ctx, F, 0.88, 0.96, 0, 0.27, BOIS_FONCE[0], false);
      aretes(ctx, V, F, c, 0, 0.27, 0.05);
    }
  },

  escalier(ctx, w, h, t, o) {
    const { V, r } = preparerObjet(ctx, o), x0 = -w * 0.43, x1 = w * 0.43, y0 = -h * 0.47, y1 = h * 0.47;
    const n = Math.max(4, Math.round((y1 - y0) / (t * 0.27))), sh = (y1 - y0) / n;
    const nez = (a, b) => { ligne(ctx, [a, b], PIERRE_ECLAT, 1.6); };
    if (o?.sens === 'monte') {
      const H = 0.36;
      const marche = (i) => {
        const ya = y1 - (i + 1) * sh, yb = y1 - i * sh;
        V.prisme(ctx, r, rectPts(x0, ya, x1 - x0, yb - ya), 0, ((i + 1) * H) / n, PIERRE_C, () => {
          plaque(ctx, V, rect(x0, ya, x1 - x0, yb - ya), ton([36, 30, 72 + 12 * (i / (n - 1))], 1), { ep: 1, bande: Math.min(2.4, sh * 0.35) });
          ctx.beginPath(); ctx.moveTo(x0, yb); ctx.lineTo(x1, yb); trait(ctx, PIERRE_ECLAT, 1.5);
        });
        const F = face(V, x0, ya, x1 - x0, yb - ya, 'sud'); aretes(ctx, V, F, 'sud', 0, ((i + 1) * H) / n, 0.05);
      };
      if (V.vue.cy >= (y0 + y1) / 2) for (let i = n - 1; i >= 0; i--) marche(i);
      else for (let i = 0; i < n; i++) marche(i);
      return;
    }
    // Les marches descendent vers le fond (−y) : un creux clair dans le sol, aux marches de pierre qui s'enfoncent.
    const D = 0.5, niv = (i) => (-(i + 1) * D) / n;
    ctx.save();
    ctx.beginPath(); rect(x0, y0, x1 - x0, y1 - y0).trace(ctx); ctx.clip();
    ctx.fillStyle = VIDE; ctx.fillRect(x0 - 4, y0 - 4, x1 - x0 + 8, y1 - y0 + 8);
    paroi(ctx, V, [x0, y1], [x0, y0], [1, 0], -niv(0), D, PIERRE_C, 0.9);
    paroi(ctx, V, [x1, y0], [x1, y1], [-1, 0], D, -niv(0), PIERRE_C, 0.9);
    paroi(ctx, V, [x0, y0], [x1, y0], [0, 1], D, D, PIERRE_C, 0.9);
    paroi(ctx, V, [x1, y1], [x0, y1], [0, -1], -niv(0), -niv(0), PIERRE_C, 0.9);
    const marche = (i) => {
      const ya = y1 - (i + 1) * sh, yb = y1 - i * sh, L = niv(i);
      const pts = [V.haut(x0, ya, L), V.haut(x1, ya, L), V.haut(x1, yb, L), V.haut(x0, yb, L)];
      poly(ctx, pts); encre(ctx, ton([36, 30, 80 - 20 * (i / (n - 1))]), 1);
      ligne(ctx, [pts[0], pts[1]], 'rgba(58,36,18,0.35)', 2.2); // l'ombre de la marche d'en face
      nez(pts[3], pts[2]);
    };
    const contremarche = (i) => {
      const yb = y1 - (i + 1) * sh;
      if (!faceVisible(V.vue, [x0, yb], [x1, yb], [0, -1])) return;
      poly(ctx, [V.haut(x0, yb, niv(i)), V.haut(x1, yb, niv(i)), V.haut(x1, yb, niv(i + 1)), V.haut(x0, yb, niv(i + 1))]);
      encre(ctx, ton([34, 20, 46]), 0.8);
    };
    if (V.vue.cy >= (y0 + y1) / 2) for (let i = n - 1; i >= 0; i--) marche(i);
    else for (let i = 0; i < n; i++) { marche(i); if (i < n - 1) contremarche(i); }
    ctx.restore();
    ctx.beginPath(); rect(x0, y0, x1 - x0, y1 - y0).trace(ctx); trait(ctx, ENCRE, 1.8);
    ctx.beginPath(); rect(x0 - 1.5, y0 - 1.5, x1 - x0 + 3, y1 - y0 + 3).trace(ctx); trait(ctx, 'rgba(240,232,214,0.7)', 1.2); // la margelle claire
  },

  fosse(ctx, w, h, t, o) {
    const { V, r } = preparerObjet(ctx, o), fw = w * 0.9, fh = h * 0.9, x = -fw / 2, y = -fh / 2, D = 0.9;
    const F = rect(x, y, fw, fh, t * 0.14);
    ctx.save();
    ctx.beginPath(); F.trace(ctx); ctx.clip();
    ctx.fillStyle = VIDE; ctx.fillRect(x - 4, y - 4, fw + 8, fh + 8);
    paroi(ctx, V, [x, y + fh], [x, y], [1, 0], D, D, PIERRE_C, 0.8);
    paroi(ctx, V, [x + fw, y], [x + fw, y + fh], [-1, 0], D, D, PIERRE_C, 0.8);
    paroi(ctx, V, [x, y], [x + fw, y], [0, 1], D, D, PIERRE_C, 0.8);
    paroi(ctx, V, [x + fw, y + fh], [x, y + fh], [0, -1], D, D, PIERRE_C, 0.8);
    // Le fond : un aplat brun chaud, une marche d'ombre nette au pied des parois, quelques pierres tombées aux arêtes claires.
    const fond = [V.haut(x, y, -D), V.haut(x + fw, y, -D), V.haut(x + fw, y + fh, -D), V.haut(x, y + fh, -D)];
    poly(ctx, fond); encre(ctx, VIDE_FOND, 1);
    for (let i = 0; i < 5; i++) {
      const [px, py] = V.haut((r() - 0.5) * fw * 0.7, (r() - 0.5) * fh * 0.7, -D), rr = 1.8 + r() * 2.6;
      ctx.beginPath(); ctx.ellipse(px, py, rr, rr * 0.75, 0, 0, 7); encre(ctx, '#6b563f', 0.7);
      ctx.beginPath(); ctx.arc(px - rr * 0.25, py - rr * 0.3, rr * 0.35, 0, 7); ctx.fillStyle = 'rgba(255,240,210,0.5)'; ctx.fill();
    }
    ctx.restore();
    ctx.beginPath(); F.trace(ctx); trait(ctx, ENCRE, 2.2);
    ctx.save(); ctx.translate(0, -1); ctx.beginPath(); F.trace(ctx); trait(ctx, 'rgba(244,236,216,0.8)', 1.3); ctx.restore(); // la lèvre claire
    for (let i = 0; i < 6; i++) { // petits éclats de bord
      const a = r() * 6.28, ex = Math.cos(a) * fw * 0.5, ey = Math.sin(a) * fh * 0.5, cx = Math.max(x, Math.min(x + fw, ex)), cy = Math.max(y, Math.min(y + fh, ey));
      ligne(ctx, [[cx - 2, cy - 1], [cx + 1, cy + 1.5]], 'rgba(40,28,18,0.45)', 0.8);
    }
  },

  lit(ctx, w, h, t, o) {
    const { V, r } = preparerObjet(ctx, o), lw = w * 0.8, lh = h - t * 0.12, x = -lw / 2, y = -lh / 2, ep = t * 0.1;
    const corps = () => {
      V.prisme(ctx, r, rectPts(x, y, lw, lh), 0, 0.1, BOIS_C_SOMBRE, () => plaque(ctx, V, rect(x, y, lw, lh), BOIS_FONCE[0], { ep: EP * 1.2 }));
      for (const c of COTES) { const F = face(V, x, y, lw, lh, c); planchesFace(ctx, r, F, 0, 0.1, 2); aretes(ctx, V, F, c, 0, 0.1, 0.04); }
      V.prisme(ctx, r, rectPts(x + t * 0.04, y + t * 0.04, lw - t * 0.08, lh - t * 0.08), 0.1, 0.18, [40, 20, 88], () => {
        const mx = x + t * 0.06, my = y + t * 0.06, mw = lw - t * 0.12, mh = lh - t * 0.12;
        plaque(ctx, V, rect(mx, my, mw, mh, 5), DRAP, { ep: EP * 1.1, ombre: 'rgba(110,90,50,0.25)' });
        plaque(ctx, V, rect(mx, my + mh * 0.3, mw, mh * 0.7, 5), BLEU, { ep: EP, bande: 2.4, lisere: 'rgba(200,225,255,0.7)', ombre: 'rgba(20,40,100,0.35)', dedans: () => {
          for (let k = 1; k < 4; k++) ligne(ctx, [[mx + 2, my + mh * (0.3 + 0.7 * k / 4)], [mx + mw - 2, my + mh * (0.3 + 0.7 * k / 4)]], 'rgba(30,50,120,0.3)', 0.9); // plis
        } });
        ligne(ctx, [[mx + 2, my + mh * 0.32], [mx + mw - 2, my + mh * 0.32]], DRAP, 2.6); // le rabat du drap
        plaque(ctx, V, rect(mx + mw * 0.12, my + mh * 0.04, mw * 0.76, mh * 0.2, 5), '#fffdf4', { ep: 1, bande: 1.8, ombre: 'rgba(130,110,70,0.3)' }); // l'oreiller
      });
    };
    const bois = (yy, hh, hauteur) => () => {
      V.prisme(ctx, r, rectPts(x, yy, lw, hh), 0, hauteur, BOIS_C_SOMBRE, () => plaque(ctx, V, rect(x, yy, lw, hh), BOIS_FONCE[1], { ep: EP * 1.1, dedans: () => planches(ctx, r, pRect(x, yy, lw, hh), 1, BOIS_FONCE) }));
      for (const c of COTES) { const F = face(V, x, yy, lw, hh, c); planchesFace(ctx, r, F, 0, hauteur, 2); aretes(ctx, V, F, c, 0, hauteur, 0.06); }
    };
    ordonner(V, [{ x: 0, y: 0, dessiner: corps }, { x: 0, y: y - ep * 0.3 + ep / 2, dessiner: bois(y - ep * 0.3, ep, 0.34) }, { x: 0, y: y + lh - ep * 0.2, dessiner: bois(y + lh - ep * 0.7, ep, 0.2) }]);
  },

  bibliotheque(ctx, w, h, t, o) {
    const etatRiche = etatPeint(true, 'bibliotheque', o); // une variante (coffre ouvert…) : objets-etats.js
    if (etatRiche) return etatRiche(ctx, w, h, t, o);
    const { V, r } = preparerObjet(ctx, o), bw = w - t * 0.08, bh = h * 0.7, x = -bw / 2, y = -h / 2 + t * 0.04, h1 = 0.95;
    V.prisme(ctx, r, rectPts(x, y, bw, bh), 0, h1, BOIS_C_SOMBRE, () => {
      plaque(ctx, V, rect(x, y, bw, bh), BOIS_FONCE[1], { ep: EP * 1.3, dedans: () => planches(ctx, r, pRect(x, y, bw, bh), 4, BOIS_FONCE) });
      ctx.beginPath(); rect(x + 3, y + 3, bw - 6, bh - 6).trace(ctx); trait(ctx, 'rgba(255,236,196,0.5)', 1); // la corniche
      if (V.KP > 0) { // des livres posés sur le dessus, en piles
        for (let i = 0; i < 3; i++) {
          const px = x + bw * (0.14 + 0.3 * i) + (r() - 0.5) * 6, pw = t * (0.17 + r() * 0.06), n = 1 + ((r() * 3) | 0);
          for (let k = 0; k < n; k++) {
            const py = y + bh * 0.3 - k * 3.2 + (r() - 0.5) * 2;
            poly(ctx, rectPts(px + (r() - 0.5) * 3, py, pw, bh * 0.28)); encre(ctx, LIVRES[(r() * LIVRES.length) | 0], 0.6);
          }
        }
        return;
      }
      // À plat, on ne voit que le dessus des livres, alignés sur le devant.
      poly(ctx, rectPts(x + 3, y + bh * 0.45, bw - 6, bh * 0.5)); encre(ctx, '#6b4425', 0.7);
      for (let u = x + 4; u < x + bw - 6;) {
        const du = t * (0.07 + r() * 0.05);
        poly(ctx, rectPts(u, y + bh * 0.52, du - 1, bh * 0.4)); encre(ctx, LIVRES[(r() * LIVRES.length) | 0], 0.5); u += du;
      }
    });
    for (const c of COTES) aretes(ctx, V, face(V, x, y, bw, bh, c), c, 0, h1, 0.03);
    const F = face(V, x, y, bw, bh, 'sud');
    if (!F.visible) return;
    const P = (u, v) => F.P(u, h1 * v);
    for (const [v0, v1] of [[0.05, 0.33], [0.37, 0.65], [0.69, 0.95]]) {
      poly(ctx, [P(0.02, v0), P(0.98, v0), P(0.98, v1), P(0.02, v1)]); encre(ctx, '#6b4425', 0.8); // le fond de l'étagère : brun chaud
      poly(ctx, [P(0.02, v0), P(0.98, v0), P(0.98, v0 + (v1 - v0) * 0.12), P(0.02, v0 + (v1 - v0) * 0.12)]); ctx.fillStyle = 'rgba(30,16,6,0.35)'; ctx.fill(); // ombre sous la tablette du dessus
      let u = 0.03;
      while (u < 0.96) {
        const du = (0.012 + r() * 0.014) * (2 * t) / bw;
        if (r() > 0.08) {
          const top = v0 + (v1 - v0) * (0.7 + r() * 0.26);
          poly(ctx, [P(u, v0), P(u + du, v0), P(u + du, top), P(u, top)]); encre(ctx, LIVRES[(r() * LIVRES.length) | 0], 0.5);
          ligne(ctx, [P(u + du * 0.25, top - (top - v0) * 0.12), P(u + du * 0.25, v0 + (top - v0) * 0.1)], 'rgba(255,255,255,0.45)', 0.6); // reflet sur le dos
          if (r() > 0.6) ligne(ctx, [P(u, v0 + (top - v0) * 0.62), P(u + du, v0 + (top - v0) * 0.62)], OR, 0.7); // filet doré
        }
        u += du + 0.002;
      }
      ligne(ctx, [P(0.01, v0), P(0.99, v0)], '#e0a960', 1.8); ligne(ctx, [P(0.01, v0), P(0.99, v0)], ENCRE, 0.5); // la tablette claire
    }
  },

  // --- Partie 2 : torche, débris, puits, fontaine, sarcophage, brasero, bougies, tapis, bannière, feu de camp, flaque, rocher, champignons, toile, ossements ---

  torche(ctx, w, h, t, o) {
    // Accrochée à la face du mur, derrière la case (−y) : manche de bois cerclé de fer, coupelle de fer claire, flamme de la variante.
    const { V } = preparerObjet(ctx, o, true), yMur = -h / 2, F = face(V, -w / 2, yMur, w, h, 'nord'), T = teinteFlamme(o);
    const P = (v) => F.P(0.5, v), [tx, ty] = P(0.7), e = Math.max(2, t * 0.05);
    ctx.beginPath(); ctx.ellipse(tx, ty - t * 0.05, t * 0.26, t * 0.3, 0, 0, 7); ctx.fillStyle = 'rgba(120,92,60,0.2)'; ctx.fill(); // la trace de suie sur le mur
    const [ax, ay] = P(0.36), [bx, by] = P(0.64);
    ctx.lineCap = 'round';
    ligne(ctx, [[ax, ay], [bx, by]], ENCRE, e * 2 + 1.6); ligne(ctx, [[ax, ay], [bx, by]], PLANCHES[1], e * 2 - 0.4);
    ligne(ctx, [[ax - e * 0.45, ay], [bx - e * 0.45, by]], PLANCHES[2], Math.max(0.8, e * 0.55)); // reflet du bois
    ctx.lineCap = 'butt';
    for (const u of [0.25, 0.7]) { const [cx, cy] = [ax + (bx - ax) * u, ay + (by - ay) * u]; poly(ctx, [[cx - e * 1.15, cy - e * 0.3], [cx + e * 1.15, cy - e * 0.3], [cx + e * 1.15, cy + e * 0.3], [cx - e * 1.15, cy + e * 0.3]]); encre(ctx, FER_CLAIR, 0.7); } // anneaux de fer
    const k = t * 0.1;
    plaque(ctx, V, polygone([[bx - k * 1.15, by - k * 1.2], [bx + k * 1.15, by - k * 1.2], [bx + k * 0.65, by + k * 0.2], [bx - k * 0.65, by + k * 0.2]]), FER_CLAIR, { bande: 1.6, ep: 1.1 });
    ctx.beginPath(); ctx.ellipse(bx, by - k * 1.2, k * 1.15, k * 0.38, 0, 0, 7); encre(ctx, T.braises[1], 0.8); // les braises dans la coupelle
    const [px, py] = [0, yMur + t * 0.1]; // la flamme est un peu en avant du mur
    if (T.eteint) { feuEteintRiche(ctx, V, px, py, 0.7, t * 0.12); return; }
    lumiereFeu(V, px, py, 0.7, { s: t * 0.13, r: t * 3, c: '255,170,80', k: 0.6 }, T);
    flamme(ctx, V, px, py, 0.7, t * 0.12, undefined, T);
  },

  debris(ctx, w, h, t, o) {
    const { V, r } = preparerObjet(ctx, o);
    ctx.beginPath(); // la poussière claire sous les blocs
    for (let i = 0; i < 12; i++) { const a = (i / 12) * 7; ctx.lineTo(Math.cos(a) * w * (0.32 + r() * 0.12), Math.sin(a) * h * (0.3 + r() * 0.12)); }
    ctx.closePath(); ctx.fillStyle = 'rgba(140,112,76,0.28)'; ctx.fill();
    const blocs = [];
    for (let i = 0; i < 6; i++) blocs.push({ x: (r() - 0.5) * w * 0.66, y: (r() - 0.5) * h * 0.66, R: t * (0.09 + r() * 0.1), h: 0.06 + r() * 0.12, c: [34 + ((r() * 10) | 0), 20 + ((r() * 10) | 0), 74 + ((r() * 10) | 0)], d: DESSUS_PIERRE[(r() * 3) | 0] });
    for (let i = 0; i < 6; i++) { const px = (r() - 0.5) * w * 0.9, py = (r() - 0.5) * h * 0.9, rr = 1.2 + r() * 1.8; plaque(ctx, V, disque(px, py, rr), PIERRE_CLAIRE, { ep: 0.7, bande: Math.min(1, rr * 0.5) }); }
    ordonner(V, blocs.map((b) => ({ x: b.x, y: b.y, dessiner: () => bloc(ctx, V, r, b.x, b.y, b.R, b.h, b.c, b.d) })));
  },

  puits(ctx, w, h, t, o) {
    const etatRiche = etatPeint(true, 'puits', o); // une variante : objets-etats-decor.js
    if (etatRiche) return etatRiche(ctx, w, h, t, o);
    const { V, r } = preparerObjet(ctx, o), R = Math.min(w, h) * 0.42, ri = R * 0.66, H1 = 0.22, bas = -0.14;
    V.cylindre(ctx, r, 0, 0, R, 0, H1, PIERRE_C, () => {
      const rel = V.echelle(bas) / V.echelle(H1), [wx, wy] = [V.vue.cx + (0 - V.vue.cx) * rel, V.vue.cy + (0 - V.vue.cy) * rel], rw = ri * 0.88 * rel;
      plaque(ctx, V, disque(0, 0, R), DESSUS_PIERRE[1], { ep: EP * 1.3 });
      ctx.beginPath(); // les pierres de la margelle : joints en rayons
      for (let i = 0; i < 10; i++) { const a = (i / 10) * 7 + 0.3; ctx.moveTo(Math.cos(a) * ri * 1.05, Math.sin(a) * ri * 1.05); ctx.lineTo(Math.cos(a) * R * 0.97, Math.sin(a) * R * 0.97); }
      trait(ctx, JOINT, EP_FIN);
      plaque(ctx, V, disque(0, 0, ri), '#c4b08c', { ep: EP, ombre: 'rgba(80,56,30,0.4)' }); // la paroi du puits
      ctx.save(); ctx.beginPath(); disque(0, 0, ri).trace(ctx); ctx.clip();
      plaque(ctx, V, disque(wx, wy, rw), EAU, { ep: EP, lisere: EAU_LISERE, ombre: EAU_OMBRE, dedans: () => reflets(ctx, wx, wy, rw, rw * 0.8) });
      ctx.restore();
      ctx.beginPath(); disque(0, 0, ri).trace(ctx); trait(ctx, ENCRE, EP);
    });
  },

  fontaine(ctx, w, h, t, o) {
    const etatRiche = etatPeint(true, 'fontaine', o); // une variante : objets-etats-decor.js
    if (etatRiche) return etatRiche(ctx, w, h, t, o);
    const { V, r } = preparerObjet(ctx, o), R = Math.min(w, h) * 0.45, ri = R * 0.82, H1 = 0.16;
    V.cylindre(ctx, r, 0, 0, R, 0, H1, MARBRE_C, () => {
      const rel = V.echelle(H1 - 0.05) / V.echelle(H1), [wx, wy] = [V.vue.cx * (1 - rel), V.vue.cy * (1 - rel)];
      plaque(ctx, V, disque(0, 0, R), MARBRE_DESSUS, { ep: EP * 1.3 });
      ctx.beginPath(); ctx.arc(0, 0, R * 0.93, 0.2, 1.5); trait(ctx, MARBRE_VEINE, 0.9);
      ctx.save(); ctx.beginPath(); disque(0, 0, ri).trace(ctx); ctx.clip();
      plaque(ctx, V, disque(wx, wy, ri * 0.95 * rel), EAU, { ep: EP, lisere: EAU_LISERE, ombre: EAU_OMBRE, dedans: () => reflets(ctx, wx, wy, ri * rel, ri * rel * 0.8) });
      ctx.restore();
      ctx.beginPath(); disque(0, 0, ri).trace(ctx); trait(ctx, ENCRE, EP);
    });
    V.cylindre(ctx, r, 0, 0, R * 0.14, H1 - 0.05, 0.36, MARBRE_C, () => plaque(ctx, V, disque(0, 0, R * 0.14), MARBRE_DESSUS, { ep: 1 }));
    V.cylindre(ctx, r, 0, 0, R * 0.38, 0.36, 0.42, MARBRE_C, () => {
      plaque(ctx, V, disque(0, 0, R * 0.38), MARBRE_DESSUS, { ep: EP });
      plaque(ctx, V, disque(0, 0, R * 0.3), EAU, { ep: 0.9, bande: 1.6, lisere: EAU_LISERE, ombre: EAU_OMBRE });
      for (let i = 0; i < 6; i++) { const a = (i / 6) * 6.28; ctx.beginPath(); ctx.arc(Math.cos(a) * R * 0.14, Math.sin(a) * R * 0.14, 1.3, 0, 7); ctx.fillStyle = EAU_REFLET; ctx.fill(); }
    });
    const [jx, jy] = V.haut(0, 0, 0.55); // le jet d'eau
    ctx.beginPath(); ctx.arc(jx, jy + R * 0.2, R * 0.2, Math.PI * 1.1, Math.PI * 1.9); trait(ctx, EAU, 3.4); trait(ctx, EAU_REFLET, 1.4);
  },

  sarcophage(ctx, w, h, t, o) {
    const etatRiche = etatPeint(true, 'sarcophage', o); // une variante (coffre ouvert…) : objets-etats.js
    if (etatRiche) return etatRiche(ctx, w, h, t, o);
    const { V, r } = preparerObjet(ctx, o), sw = w * 0.76, sh = h - t * 0.12, x = -sw / 2, y = -sh / 2, long = sh >= sw, m = t * 0.05;
    V.prisme(ctx, r, rectPts(x, y, sw, sh), 0, 0.2, PIERRE_C_SOMBRE, () => plaque(ctx, V, rect(x, y, sw, sh), DESSUS_PIERRE[2], { ep: EP * 1.2 }));
    for (const c of COTES) { const F = face(V, x, y, sw, sh, c); joints(ctx, F, 0, 0.14, 2, 3); bandeFace(ctx, F, 0.03, 0.97, 0.15, 0.19, OR, false); aretes(ctx, V, F, c, 0, 0.2, 0.05); }
    V.prisme(ctx, r, rectPts(x + m, y + m, sw - 2 * m, sh - 2 * m), 0.2, 0.3, PIERRE_C, () => {
      const lx = x + m, ly = y + m, lw = sw - 2 * m, lh = sh - 2 * m;
      plaque(ctx, V, rect(lx, ly, lw, lh, 5), DESSUS_PIERRE[0], { ep: EP * 1.2 });
      ctx.beginPath(); rect(lx + 5, ly + 5, lw - 10, lh - 10).trace(ctx); trait(ctx, 'rgba(120,104,80,0.7)', 1);
      // Le gisant : tête du côté du dos (−y, ou −x si couché), mains croisées, croix de pierre.
      const L = long ? lh : lw, E = long ? lw : lh, P = (a, b) => (long ? [b * E, -L / 2 + a * L] : [-L / 2 + a * L, b * E]);
      plaque(ctx, V, polygone([P(0.3, -0.3), P(0.34, -0.4), P(0.5, -0.4), P(0.62, -0.3), P(0.94, -0.16), P(0.98, 0), P(0.94, 0.16), P(0.62, 0.3), P(0.5, 0.4), P(0.34, 0.4), P(0.3, 0.3)]), MARBRE_DESSUS, { ep: 1.1 });
      plaque(ctx, V, disque(...P(0.2, 0), E * 0.16), '#fbf7ee', { ep: 1.1 });
      for (const [a0, b0, a1, b1] of [[0.5, -0.3, 0.5, 0.3], [0.4, 0, 0.88, 0]]) { ligne(ctx, [P(a0, b0), P(a1, b1)], ENCRE, 4); ligne(ctx, [P(a0, b0), P(a1, b1)], '#bdb6a4', 2.4); ligne(ctx, [[P(a0, b0)[0] - 0.7, P(a0, b0)[1] - 0.7], [P(a1, b1)[0] - 0.7, P(a1, b1)[1] - 0.7]], '#fbf7ee', 0.9); }
    });
  },

  brasero(ctx, w, h, t, o) {
    // Une vasque de fer clair sur trois pieds, pleine de braises de la couleur du feu.
    const { V, r } = preparerObjet(ctx, o), R = Math.min(w, h) * 0.34, hb = 0.13, h1 = 0.28, k = t / 48, T = teinteFlamme(o);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * 6.28 + 0.5, pied = [[Math.cos(a) * R * 1.2, Math.sin(a) * R * 1.2], V.haut(Math.cos(a) * R * 0.75, Math.sin(a) * R * 0.75, hb)];
      ligne(ctx, pied, ENCRE, 4.8 * k); ligne(ctx, pied, FER, 2.9 * k); ligne(ctx, pied.map(([px, py]) => [px - 0.7 * k, py - 0.7 * k]), FER_REFLET, 0.8);
    }
    V.cylindre(ctx, r, 0, 0, R, hb, h1, [220, 12, 56], () => {
      plaque(ctx, V, disque(0, 0, R), FER_CLAIR, { ep: EP * 1.3, lisere: 'rgba(255,255,255,0.6)' });
      plaque(ctx, V, disque(0, 0, R * 0.8), '#6e5f52', { ep: 1, ombre: 'rgba(30,20,12,0.4)' });
      for (let i = 0; i < 11; i++) {
        const a = i * 2.4, d = (i % 4) * R * 0.17, bx = Math.cos(a) * d, by = Math.sin(a) * d, rr = R * (0.16 + r() * 0.08);
        ctx.beginPath(); ctx.arc(bx, by, rr, 0, 7); encre(ctx, T.braises[i % 3], 0.8);
        ctx.beginPath(); ctx.arc(bx - rr * 0.3, by - rr * 0.3, rr * 0.35, 0, 7); ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fill();
      }
      for (let i = 0; i < 6; i++) { const a = (i / 6) * 6.28 + 0.3; clou(ctx, [Math.cos(a) * R * 0.9, Math.sin(a) * R * 0.9], Math.max(0.8, R * 0.05)); } // rivets du rebord
    });
    if (T.eteint) { feuEteintRiche(ctx, V, 0, 0, h1, R * 0.5); return; }
    lumiereFeu(V, 0, 0, h1, { s: R * 0.8, r: t * 4.4, c: '255,150,60', k: 0.7 }, T);
    flamme(ctx, V, 0, 0, h1, R * 0.7, undefined, T);
  },

  bougies(ctx, w, h, t, o) {
    // Trois bougies de cire crème sur une soucoupe dorée.
    const { V, r } = preparerObjet(ctx, o), T = teinteFlamme(o);
    plaque(ctx, V, disque(0, 0, t * 0.24), OR, { ep: 1.1, bande: 1.8, lisere: OR_REFLET, ombre: 'rgba(140,90,20,0.45)' });
    ctx.beginPath(); ctx.arc(0, 0, t * 0.17, 0, 7); trait(ctx, OR_OMBRE, 0.8);
    const cires = [0, 1, 2].map((i) => { const a = (i / 3) * 6.28 + 0.6, d = t * 0.1; return { x: Math.cos(a) * d, y: Math.sin(a) * d, rr: t * (0.055 + r() * 0.015), hb: 0.06 + r() * 0.05 }; });
    ordonner(V, cires.map((b) => ({ x: b.x, y: b.y, dessiner: () => {
      V.cylindre(ctx, r, b.x, b.y, b.rr, 0, b.hb, [44, 45, 86], () => {
        plaque(ctx, V, disque(b.x, b.y, b.rr), '#fffaf0', { ep: 0.9, bande: Math.max(0.8, b.rr * 0.4), ombre: 'rgba(160,130,70,0.35)' });
        ctx.beginPath(); ctx.arc(b.x + b.rr * 0.25, b.y + b.rr * 0.1, b.rr * 0.28, 0, 7); ctx.fillStyle = '#efe2bc'; ctx.fill(); // la cire fondue
      });
      if (T.eteint) { const [mx, my] = V.haut(b.x, b.y, b.hb); ctx.beginPath(); ctx.arc(mx, my, Math.max(1, t * 0.02), 0, 7); encre(ctx, '#4a423c', 0.5); fumee(ctx, mx, my - t * 0.02, t * 0.22, { largeur: Math.max(0.8, t * 0.016), couleur: '176,170,164' }); return; }
      lumiereFeu(V, b.x, b.y, b.hb, { s: t * 0.07, r: t * 1.5, c: '255,190,110', k: 0.26, petite: true }, T);
      flamme(ctx, V, b.x, b.y, b.hb, t * 0.06, undefined, T);
    } })));
  },

  tapis(ctx, w, h, t, o) {
    // À plat sur le sol : franges crème, bord rouge, galon doré perlé, losanges emboîtés, écoinçons.
    const { V } = preparerObjet(ctx, o), tw = w - t * 0.2, th = h - t * 0.2, x = -tw / 2, y = -th / 2, long = tw >= th, k = t / 48;
    const T = aUneVariante(o) ? TEINTES_TISSU[varianteDe(o)]?.r : null; // une autre couleur : même motif, autres teintes (rendu/teintes-tissu.js)
    const [fond, lis, om, ombre, acc, ctr, g] = T ? [T.fond, T.lis, T.om, T.ombre, T.acc, T.ctr, T.g] : [ROUGE, 'rgba(255,170,150,0.7)', 'rgba(90,20,14,0.35)', ROUGE_OMBRE, BLEU, ROUGE, OR];
    ctx.beginPath();
    for (let u = t * 0.05; u < (long ? th : tw) - t * 0.03; u += t * 0.065) {
      if (long) { ctx.moveTo(x - 4 * k, y + u); ctx.lineTo(x, y + u); ctx.moveTo(x + tw, y + u); ctx.lineTo(x + tw + 4 * k, y + u); }
      else { ctx.moveTo(x + u, y - 4 * k); ctx.lineTo(x + u, y); ctx.moveTo(x + u, y + th); ctx.lineTo(x + u, y + th + 4 * k); }
    }
    ctx.lineCap = 'round'; trait(ctx, ENCRE, 2.2); trait(ctx, '#f6ecd0', 1.2); ctx.lineCap = 'butt';
    plaque(ctx, V, rect(x, y, tw, th), fond, { ep: EP * 1.3, bande: 2.2, lisere: lis, ombre: om });
    for (const [i, c, ep] of [[5 * k, g, 3 * k], [10 * k, ombre, 1.1]]) { ctx.beginPath(); rect(x + i, y + i, tw - 2 * i, th - 2 * i).trace(ctx); trait(ctx, c, ep); }
    ctx.beginPath(); rect(x + 3.4 * k, y + 3.4 * k, tw - 6.8 * k, th - 6.8 * k).trace(ctx); trait(ctx, ENCRE, 0.6);
    ctx.beginPath(); // les perles du galon, sur les deux grands côtés
    if (long) for (let u = x + 14 * k; u < x + tw - 12 * k; u += 9 * k) { ctx.moveTo(u + 1.3, y + 5 * k); ctx.arc(u, y + 5 * k, 1.3, 0, 7); ctx.moveTo(u + 1.3, y + th - 5 * k); ctx.arc(u, y + th - 5 * k, 1.3, 0, 7); }
    else for (let u = y + 14 * k; u < y + th - 12 * k; u += 9 * k) { ctx.moveTo(x + 5 * k + 1.3, u); ctx.arc(x + 5 * k, u, 1.3, 0, 7); ctx.moveTo(x + tw - 5 * k + 1.3, u); ctx.arc(x + tw - 5 * k, u, 1.3, 0, 7); }
    ctx.fillStyle = ombre; ctx.fill();
    const a = Math.min(tw / 2 - 16 * k, th * 0.4 * (long ? 1.7 : 1)), b = Math.min(th / 2 - 16 * k, tw * 0.4 * (long ? 1 : 1.7));
    for (const [s, fond] of [[1, g], [0.72, acc], [0.42, g], [0.2, ctr]]) { poly(ctx, [[-a * s, 0], [0, -b * s], [a * s, 0], [0, b * s]]); encre(ctx, fond, 1); }
    for (const [ox, oy, sx, sy] of [[x + 10 * k, y + 10 * k, 1, 1], [x + tw - 10 * k, y + 10 * k, -1, 1], [x + 10 * k, y + th - 10 * k, 1, -1], [x + tw - 10 * k, y + th - 10 * k, -1, -1]]) {
      poly(ctx, [[ox, oy], [ox + sx * 14 * k, oy], [ox, oy + sy * 14 * k]]); encre(ctx, g, 0.9);
    }
  },

  banniere(ctx, w, h, t, o) {
    // Accrochée au mur, derrière la case (−y) : barre de bois aux pommeaux dorés, étoffe à queue d'hirondelle, liseré et emblème d'or. Sans relief, vue du dessus.
    const { V, r } = preparerObjet(ctx, o, true), yMur = -h / 2, F = face(V, -w / 2, yMur, w, h, 'nord'), flat = !V.KP;
    const T = aUneVariante(o) ? TEINTES_TISSU[varianteDe(o)]?.r : null, g = T?.g ?? OR; // une couleur choisie : celle de la variante ; sinon rouge, bleue ou verte selon la place
    const [fond, lis, omb] = [[ROUGE, 'rgba(255,170,150,0.7)', 'rgba(90,20,14,0.4)'], [BLEU, 'rgba(200,225,255,0.7)', 'rgba(20,40,100,0.4)'], ['#58a54a', 'rgba(210,255,190,0.65)', 'rgba(20,70,20,0.4)']][(r() * 3) | 0];
    const y0 = yMur + t * 0.03, bw = t * 0.46, lg = t * 0.58;
    const pts = flat ? [[-bw / 2, y0], [bw / 2, y0], [bw / 2, y0 + lg], [0, y0 + lg * 0.78], [-bw / 2, y0 + lg]] : [F.P(0.2, 0.92), F.P(0.8, 0.92), F.P(0.8, 0.14), F.P(0.5, 0.3), F.P(0.2, 0.14)];
    const [a, b] = flat ? [[-t * 0.31, y0 - t * 0.01], [t * 0.31, y0 - t * 0.01]] : [F.P(0.16, 0.95), F.P(0.84, 0.95)];
    plaque(ctx, V, polygone(pts), T?.fond ?? fond, { ep: EP * 1.2, bande: 2.4, lisere: T?.lis ?? lis, ombre: T?.om ?? omb });
    const c = centre(pts), inner = pts.map(([px, py]) => [px + (c[0] - px) * 0.2, py + (c[1] - py) * 0.2]);
    poly(ctx, inner); trait(ctx, g, 1.3);
    const [ex, ey] = flat ? [0, y0 + lg * 0.42] : F.P(0.5, 0.6);
    plaque(ctx, V, disque(ex, ey, t * 0.065), g, { ep: 0.9, bande: 1.2, lisere: OR_REFLET, ombre: 'rgba(140,90,20,0.45)' });
    ctx.beginPath(); ctx.arc(ex, ey, t * 0.03, 0, 7); trait(ctx, OR_OMBRE, 0.8);
    ctx.lineCap = 'round'; ligne(ctx, [a, b], ENCRE, 4.2); ligne(ctx, [a, b], PLANCHES[1], 2.4); ligne(ctx, [a, b].map(([px, py]) => [px, py - 0.7]), PLANCHES[2], 0.9); ctx.lineCap = 'butt';
    for (const [px, py] of [a, b]) { ctx.beginPath(); ctx.arc(px, py, Math.max(1.4, t * 0.03), 0, 7); encre(ctx, OR, 0.8); }
  },

  feudecamp(ctx, w, h, t, o) {
    // Un cercle de pierres claires, des bûches en étoile aux bouts rougeoyants, un lit de braises et une grande flamme de la couleur de la variante.
    const { V, r } = preparerObjet(ctx, o), s = Math.min(w, h), k = t / 48, T = teinteFlamme(o);
    plaque(ctx, V, disque(0, 0, s * 0.4), '#b59773', { ep: 1.1, bande: 2.4, ombre: 'rgba(80,52,28,0.4)' }); // la terre battue
    ctx.beginPath(); ctx.arc(0, 0, s * 0.27, 0, 7); ctx.fillStyle = T.eteint ? '#cfc8bc' : 'rgba(255,255,255,0.18)'; ctx.fill();
    V.auNiveau(ctx, 0.04, () => {
      for (const a of [0.3, 1.9, 3.6]) {
        const lx = Math.cos(a) * s * 0.28, ly = Math.sin(a) * s * 0.28;
        ctx.lineCap = 'round'; ligne(ctx, [[-lx, -ly], [lx, ly]], ENCRE, 9.5 * k); ligne(ctx, [[-lx, -ly], [lx, ly]], T.eteint ? '#8e7a6a' : PLANCHES[3], 7 * k);
        ligne(ctx, [[-lx - k, -ly - k], [lx - k, ly - k]], T.eteint ? '#a89684' : PLANCHES[2], 2 * k); ctx.lineCap = 'butt';
        ctx.beginPath(); ctx.arc(lx, ly, 3.2 * k, 0, 7); encre(ctx, T.eteint ? '#c9b8a2' : T.braises[0], 0.7); // le bout scié : il rougeoie
      }
    });
    const pierres = [];
    for (let i = 0; i < 10; i++) { const a = (i / 10) * 6.28; pierres.push({ x: Math.cos(a) * s * 0.42, y: Math.sin(a) * s * 0.42, R: s * (0.085 + r() * 0.03), c: [34 + ((r() * 8) | 0), 20, 70 + ((r() * 8) | 0)], d: DESSUS_PIERRE[(r() * 3) | 0] }); }
    ordonner(V, pierres.map((p) => ({ x: p.x, y: p.y, dessiner: () => bloc(ctx, V, r, p.x, p.y, p.R, 0.07, p.c, p.d) })));
    if (T.eteint) { // des cendres sur le lit éteint, un filet de fumée
      const [cx, cy] = V.haut(0, 0, 0.05);
      ctx.beginPath(); ctx.ellipse(cx, cy, s * 0.3, s * 0.22, 0, 0, 7); encre(ctx, '#aaa39a', 0.9);
      ctx.beginPath(); ctx.ellipse(cx - s * 0.05, cy - s * 0.04, s * 0.18, s * 0.12, 0, 0, 7); ctx.fillStyle = '#d6d0c6'; ctx.fill();
      fumee(ctx, cx, cy - s * 0.05, t * 0.9, { largeur: Math.max(1.2, t * 0.035), couleur: '176,170,164' });
      return;
    }
    const [cx, cy] = V.haut(0, 0, 0.05); // le lit de braises, de la couleur du feu
    for (let i = 0; i < 7; i++) { const a = i * 2.4, d = (i % 3) * s * 0.07, rr = s * (0.055 + (i % 2) * 0.02); ctx.beginPath(); ctx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, rr, 0, 7); encre(ctx, T.braises[i % 3], 0.7); }
    lumiereFeu(V, 0, 0, 0.08, { s: t * 0.3, r: t * 5.2, c: '255,150,60', k: 0.85 }, T);
    flamme(ctx, V, 0, 0, 0.08, t * 0.26, undefined, T);
  },

  flaque(ctx, w, h, t, o) {
    // De l'eau à plat : bord irrégulier, bleu clair franc, reflets nets, sol mouillé autour.
    const { V, r } = preparerObjet(ctx, o), rx = w * 0.44, ry = h * 0.38, p1 = r() * 6, p2 = r() * 6, pts = [], bord = [];
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * 6.28, f = 0.9 + 0.1 * Math.sin(a * 2 + p1) + 0.06 * Math.sin(a * 3 + p2);
      pts.push([Math.cos(a) * rx * f, Math.sin(a) * ry * f]); bord.push([Math.cos(a) * rx * f * 1.12, Math.sin(a) * ry * f * 1.14]);
    }
    poly(ctx, bord); ctx.fillStyle = 'rgba(96,130,160,0.22)'; ctx.fill(); // le sol mouillé
    plaque(ctx, V, polygone(pts), EAU, { ep: EP * 1.2, bande: 2.6, lisere: EAU_LISERE, ombre: EAU_OMBRE, dedans: () => reflets(ctx, 0, 0, rx, ry) });
    ctx.beginPath(); ctx.ellipse(rx * 0.35, ry * 0.3, rx * 0.16, ry * 0.1, 0, 0, 7); trait(ctx, EAU_CLAIR, 1); // une ride
  },

  rocher(ctx, w, h, t, o) {
    // Un bloc de pierre claire aux éclats, un peu de mousse sur le plus gros.
    const { V, r } = preparerObjet(ctx, o), s = Math.min(w, h);
    const blocs = [
      { x: (r() - 0.5) * s * 0.1, y: (r() - 0.5) * s * 0.1, R: s * 0.36, h: 0.3, mousse: true },
      { x: -s * 0.3 + r() * s * 0.08, y: s * 0.28, R: s * 0.15, h: 0.12 },
      { x: s * 0.3, y: -s * 0.25 + r() * s * 0.1, R: s * 0.1, h: 0.08 },
    ];
    ordonner(V, blocs.map((b) => ({ x: b.x, y: b.y, dessiner: () => bloc(ctx, V, r, b.x, b.y, b.R, b.h, [34 + ((r() * 8) | 0), 20, 68 + ((r() * 8) | 0)], DESSUS_PIERRE[(r() * 3) | 0], b.mousse) })));
  },

  champignons(ctx, w, h, t, o) {
    // Des champignons qui luisent : chapeaux clairs mouchetés, pieds crème, halo de lumière cyan.
    const { V, r } = preparerObjet(ctx, o), n = 6, liste = [], CHAPEAUX = ['#8fe8dc', '#b4f2e8', '#86d8ee', '#b8f0c8'];
    for (let i = 0; i < n; i++) liste.push({ x: (r() - 0.5) * t * 0.7, y: (r() - 0.5) * t * 0.6, rr: t * (0.06 + r() * 0.07), hc: 0.05 + r() * 0.06, c: CHAPEAUX[(r() * CHAPEAUX.length) | 0] });
    ordonner(V, liste.map((c) => ({ x: c.x, y: c.y, dessiner: () => V.cylindre(ctx, r, c.x, c.y, c.rr * 0.3, 0, c.hc, [44, 40, 84], () => {
      plaque(ctx, V, disque(c.x, c.y, c.rr), c.c, { ep: 1, bande: Math.max(1, c.rr * 0.3), lisere: 'rgba(255,255,255,0.7)', ombre: 'rgba(20,120,130,0.4)', dedans: () => {
        for (const [dx, dy, k] of [[-0.35, -0.25, 0.18], [0.3, 0.1, 0.14], [-0.05, 0.4, 0.12]]) { ctx.beginPath(); ctx.arc(c.x + dx * c.rr, c.y + dy * c.rr, c.rr * k, 0, 7); ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fill(); }
      } });
    }) })));
    V.lumiere(0, 0, 0, { s: 0, r: t * 2.2, c: '90,230,215', k: 0.55 });
  },

  toile(ctx, w, h, t, o, plan) {
    // Posée à plat dans l'angle de la case le plus proche d'un coin : fils crème cernés d'un trait gris-bleu, gouttes de rosée, et son araignée.
    const { r } = preparerObjet(ctx, o), [sx, sy] = sensDuCoin(o, plan || etat.plan), x = sx * w / 2, y = sy * h / 2, dx = -sx, dy = -sy, s = Math.min(w, h);
    const L = s * (0.8 + r() * 0.2), rayons = [0, 0.25, 0.5, 0.75, 1].map((u) => (u * Math.PI) / 2), P = (a, kk) => [x + dx * Math.cos(a) * L * kk, y + dy * Math.sin(a) * L * kk];
    const fils = () => {
      ctx.beginPath();
      for (const a of rayons) { ctx.moveTo(x, y); ctx.lineTo(...P(a, 1)); }
      for (const kk of [0.3, 0.5, 0.7, 0.9]) rayons.forEach((a, i) => { const [px, py] = P(a, kk); if (i) ctx.quadraticCurveTo(...P(a - 0.4, kk * 0.82), px, py); else ctx.moveTo(px, py); });
    };
    ctx.save(); ctx.lineCap = 'round';
    fils(); trait(ctx, 'rgba(96,108,130,0.7)', 2); fils(); trait(ctx, '#fbf8ee', 0.9);
    for (const [a, kk] of [[0.3, 0.7], [0.9, 0.5], [1.3, 0.9], [0.6, 0.3]]) { const [px, py] = P(a, kk); ctx.beginPath(); ctx.arc(px, py, Math.max(0.9, s * 0.02), 0, 7); encre(ctx, EAU_CLAIR, 0.5); }
    const [bx, by] = P(0.7, 0.5), q = Math.max(1.6, s * 0.035); // l'araignée : un corps rond et quatre pattes de chaque côté
    ctx.beginPath(); for (const sg of [-1, 1]) for (let i = 0; i < 4; i++) { ctx.moveTo(bx, by); ctx.lineTo(bx + sg * q * 1.8, by + (i - 1.5) * q * 0.9); }
    trait(ctx, ENCRE, 0.8);
    ctx.beginPath(); ctx.arc(bx, by, q, 0, 7); encre(ctx, '#7b5aa6', 0.8);
    ctx.beginPath(); ctx.arc(bx - q * 0.3, by - q * 0.3, q * 0.3, 0, 7); ctx.fillStyle = '#d8c4f2'; ctx.fill();
    ctx.restore();
  },

  ossements(ctx, w, h, t, o) {
    // Le crâne et les os croisés des salles en ruine : os crème cernés d'encre aux extrémités rondes, deux éclats autour.
    const { V, r } = preparerObjet(ctx, o);
    const os = (ax, ay, bx, by, e) => {
      ctx.lineCap = 'round'; ligne(ctx, [[ax, ay], [bx, by]], ENCRE, e * 2 + 1.6); ligne(ctx, [[ax, ay], [bx, by]], OS, e * 2 - 0.2); ctx.lineCap = 'butt';
      const a = Math.atan2(by - ay, bx - ax), nx = -Math.sin(a) * e * 0.8, ny = Math.cos(a) * e * 0.8;
      for (const [px, py] of [[ax, ay], [bx, by]]) for (const sg of [-1, 1]) { ctx.beginPath(); ctx.arc(px + nx * sg, py + ny * sg, e * 0.85, 0, 7); encre(ctx, OS, 0.8); }
      ligne(ctx, [[ax + nx * 0.2 + 1, ay + ny * 0.2 - 0.6], [bx + nx * 0.2 + 1, by + ny * 0.2 - 0.6]], OS_OMBRE, 0.8);
    };
    for (let i = 0; i < 2; i++) {
      const a = r() * 6.28, d = t * (0.28 + r() * 0.08), x = Math.cos(a) * d, y = Math.sin(a) * d, b = a + 1 + r(), l = t * 0.07;
      os(x - Math.cos(b) * l, y - Math.sin(b) * l, x + Math.cos(b) * l, y + Math.sin(b) * l, Math.max(1.1, t * 0.03));
    }
    const k = t * 0.55, a = r() * 6.28, c = Math.cos(a), s = Math.sin(a), R = (u, v) => [(u * c - v * s) * k, (u * s + v * c) * k];
    for (const [ax, ay, bx, by] of [[-0.38, 0.17, 0.08, 0.34], [0.12, -0.28, 0.42, 0.06]]) os(...R(ax, ay), ...R(bx, by), Math.max(1.5, t * 0.045));
    plaque(ctx, V, { taille: k * 0.34, trace: (c2, ddx = 0, ddy = 0) => { c2.moveTo(k * 0.15 + ddx, ddy); c2.ellipse(ddx, ddy, k * 0.15, k * 0.18, a - 0.3, 0, 7); } }, CRANE[0], { ep: 1.1, bande: Math.max(1, k * 0.05), ombre: 'rgba(150,130,90,0.4)' }); // le crâne
    for (const u of [-0.055, 0.055]) { const [ex, ey] = R(u, 0.02); ctx.beginPath(); ctx.ellipse(ex, ey, Math.max(1, k * 0.045), Math.max(1.2, k * 0.057), 0, 0, 7); ctx.fillStyle = '#5a4630'; ctx.fill(); }
    ctx.beginPath(); ctx.moveTo(...R(0, 0.1)); ctx.lineTo(...R(-0.02, 0.15)); ctx.lineTo(...R(0.02, 0.15)); ctx.closePath(); trait(ctx, '#5a4630', 0.9); // le nez
    ligne(ctx, [R(-0.07, 0.19), R(0.07, 0.19)], '#5a4630', 0.9); // les dents
  },
};

/**
 * Les briques et les tons du style riches, pour les états du mobilier (objets-etats.js : coffre ouvert, bibliothèque renversée…), qui les réutilisent
 * pour rester dans le même langage que les objets d'origine.
 */
export const BRIQUES = {
  plaque, polygone, rect, disque, planches, planchesFace, bandeFace, aretes, clou, ligne, pRect, pQuad, bloc, joints,
  BOIS_C, BOIS_C_SOMBRE, PLANCHES, BOIS_FONCE, PIERRE_C, PIERRE_C_SOMBRE, DESSUS_PIERRE, MARBRE_C, MARBRE_DESSUS, MARBRE_VEINE, FER, FER_REFLET, FER_CLAIR,
  OR, OR_REFLET, OR_OMBRE, ROUGE, ROUGE_CLAIR, LIVRES, OS, OS_OMBRE, CRANE, VIDE, VIDE_FOND, DRAP, DRAP_OMBRE, EP, EP_FIN, FIL, JOINT,
};
