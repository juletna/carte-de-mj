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
import { encre, trait, ton, arrondi, rectPts, ENCRE } from './trait.js';
import { preparerObjet, face, ordonner, poly, milieu, distCentre, COTES, paroi, flamme } from './objets.js';

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
};
