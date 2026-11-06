/**
 * Les ÉTATS du mobilier dans le thème peint : coffre ouvert / vide / brisé, bibliothèque clairsemée / renversée / de grimoires, tonneau couché / éventré,
 * sarcophage ouvert, statue brisée, caisse ouverte. Ce sont les variantes déclarées au catalogue (catalogue.js : `variantes`) ; la première de chaque
 * type (le dessin d'origine) n'est pas ici : elle reste dans objets.js (sobres) et objets-dessines.js (riches), inchangée.
 *
 * Chaque état est écrit UNE fois, pour un « kit » de style : `creerKit(false)` donne les teintes et les briques du style sobres (objets.js),
 * `creerKit(true)` celles du style riches (objets-dessines.js : aplats clairs, liseré et ombre nets, détails nets). Les deux styles partagent donc
 * la forme, la fausse 3D (mêmes pièces, mêmes hauteurs), l'ordre de dessin et les tirages de la graine de l'objet ; seuls les tons et les détails
 * changent. Les états sont appelés par le garde de objets.js (sobres) et par la tête de chaque fonction de `RICHES` (riches) : `etatPeint`.
 * Règles de l'objet : tout reste dans l'emprise de la case (à quelques pixels près), l'avant vers +y, le dos vers −y ; aucun Math.random.
 */
import { varianteDe, varianteParDefaut } from '../../../catalogue.js';
import { chemin, encre, trait, dl, rectPts, centre, ENCRE } from './trait.js';
import {
  preparerObjet, face, poly, milieu, COTES, traits, bande, rocher,
  PIERRE, PIERRE_SOMBRE, MARBRE, BOIS, BOIS_SOMBRE, BOIS_CLAIR,
} from './objets.js';
import { BRIQUES as B } from './objets-dessines.js';
import { etatsDecor } from './objets-etats-decor.js';

// --- Géométrie -----------------------------------------------------------------------------------------------

/** Les points `pts` tournés de `a` radians autour de (cx, cy). */
export const tourner = (pts, a, cx = 0, cy = 0) => pts.map(([x, y]) => [cx + (x - cx) * Math.cos(a) - (y - cy) * Math.sin(a), cy + (x - cx) * Math.sin(a) + (y - cy) * Math.cos(a)]);
/** Un rectangle centré en (cx, cy), de côtés l × h, tourné de `a`. */
export const rectC = (cx, cy, l, h, a = 0) => tourner(rectPts(cx - l / 2, cy - h / 2, l, h), a, cx, cy);
/** Le point de la forme S = [nord-ouest, nord-est, sud-est, sud-ouest] à l'abscisse u et à l'ordonnée v (0–1). */
const pQ = (S) => (u, v) => milieu(milieu(S[0], S[1], u), milieu(S[3], S[2], u), v);

// --- Les kits de style -------------------------------------------------------------------------------------------

/**
 * Les teintes et les briques d'un style. `bloc` est un volume à base polygonale avec son dessus ; `faces` et `bandes` habillent les flancs visibles ;
 * `piece`, `gemme`, `livre`, `disque`, `poly2`, `ligne` sont de petits objets à plat (à poser avec `V.auNiveau` pour les mettre à la bonne hauteur).
 */
function creerKit(riche) {
  const MAT = riche ? {
    bois: { f: B.BOIS_C, d: B.PLANCHES[1] }, boisClair: { f: B.BOIS_C, d: B.PLANCHES[2] }, boisSombre: { f: B.BOIS_C_SOMBRE, d: B.BOIS_FONCE[1] }, boisNuit: { f: [350, 30, 38], d: '#8a5a52' },
    pierre: { f: B.PIERRE_C_SOMBRE, d: B.DESSUS_PIERRE[2] }, pierreClaire: { f: B.PIERRE_C, d: B.DESSUS_PIERRE[0] }, marbre: { f: B.MARBRE_C, d: B.MARBRE_DESSUS },
    vide: { f: B.BOIS_C_SOMBRE, d: B.VIDE },
  } : {
    bois: { f: BOIS, d: ['#b07843', '#6d4422'] }, boisClair: { f: BOIS_CLAIR, d: ['#c1915c', '#7a5028'] }, boisSombre: { f: BOIS_SOMBRE, d: ['#7a4e2a', '#4a2c14'] }, boisNuit: { f: [350, 22, 22], d: ['#5a3a3a', '#33202a'] },
    pierre: { f: PIERRE_SOMBRE, d: ['#a8a49a', '#66625a'] }, pierreClaire: { f: PIERRE, d: ['#d6d2c7', '#8a867d'] }, marbre: { f: MARBRE, d: ['#f4f0e6', '#9c978d'] },
    vide: { f: BOIS_SOMBRE, d: ['#3a2412', '#1e1209'] },
  };
  const pal = riche ? {
    or: B.OR, orClair: B.OR_REFLET, orOmbre: B.OR_OMBRE, livres: B.LIVRES, fer: B.FER, ferClair: B.FER_CLAIR, os: B.OS, osOmbre: B.OS_OMBRE,
    fond: B.VIDE_FOND, paroi: B.VIDE, velours: '#d9604f', bois: B.PLANCHES[2], boisFonce: B.BOIS_FONCE[1], bandelette: B.DRAP, bandeletteOmbre: B.DRAP_OMBRE,
    paille: ['#f2d46a', '#e4b94a', '#f8e08a'], vin: '#c0394f', biere: '#f0b43a', gemmes: ['#ef5a4a', '#4d86c4', '#58a54a'], page: '#fbf4dc',
    grimoires: ['#a23a5a', '#3b6bb0', '#7a4ab0', '#2f8a70', '#b0702a', '#5a5f78'], fiole: '#58c46a', pierre: '#e6dac0', marbreCaillou: B.MARBRE_C,
  } : {
    or: '#d9b24a', orClair: '#f1d98a', orOmbre: '#9a7620', livres: ['#7b2d26', '#2f4f6f', '#3f6b3a', '#8a6a2a', '#5a3d6b', '#6b4a2e', '#a08a5a', '#264a4a'], fer: '#6a645d', ferClair: '#9a948b',
    os: '#e6dfc8', osOmbre: '#a89f84', fond: '#1e1209', paroi: '#4a2c14', velours: '#7a2a2a', bois: '#c1915c', boisFonce: '#7a4e2a', bandelette: '#d8cfae', bandeletteOmbre: '#8c8468',
    paille: ['#c9a64a', '#b89238', '#d8b95a'], vin: '#6a1f2a', biere: '#a8741a', gemmes: ['#b53a30', '#2f5f9a', '#3f8a3a'], page: '#e8dcb8',
    grimoires: ['#4a1f2e', '#2a3b5e', '#3a2a52', '#1f4a3f', '#5a3a1a', '#2b2b33'], fiole: '#3f9a52', pierre: '#a8a49a', marbreCaillou: MARBRE,
  };
  const ep = riche ? 0.8 : 0.6;

  /** Le dessus d'un volume : la forme `pts` pleine, cernée, puis les détails `detail(pts)` (dessinés dedans, dans la forme). */
  function dessusForme(ctx, V, r, pts, mat, detail) {
    const M = MAT[mat];
    if (riche) { B.plaque(ctx, V, B.polygone(pts), M.d, { dedans: detail ? () => detail(pts) : undefined }); return; }
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    chemin(ctx, pts, true, r, 0.4); encre(ctx, dl(ctx, Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys), M.d[0], M.d[1]), 1.5);
    detail?.(pts);
  }
  const kit = {
    riche, MAT, pal, ep,
    /** Un volume de la hauteur z0 à z1, de matière `mat`. Avec `retrait` < 1, le dessus est en perspective (S) comme celui d'un couvercle. */
    bloc(ctx, V, r, pts, z0, z1, mat, detail, retrait = 1) {
      V.prisme(ctx, r, pts, z0, z1, MAT[mat].f, (S) => {
        if (retrait === 1) dessusForme(ctx, V, r, S ?? pts, mat, detail);
        else if (riche) B.plaque(ctx, V, B.polygone(S), MAT[mat].d, { dedans: detail ? () => detail(S) : undefined });
        else detail?.(S);
      }, retrait);
    },
    /** Les planches des quatre flancs d'un rectangle (x, y, w, h), de z0 à z1 : `n` rangs. */
    faces(ctx, V, r, x, y, w, h, z0, z1, n = 3) {
      for (const c of COTES) {
        const F = face(V, x, y, w, h, c);
        if (riche) { B.planchesFace(ctx, r, F, z0, z1, n); B.aretes(ctx, V, F, c, z0, z1, 0.04); } else traits(ctx, F, z0, z1, n);
      }
    },
    /** Des ferrures verticales aux abscisses `us` de chaque flanc. */
    bandes(ctx, V, x, y, w, h, z0, z1, us = [0.2, 0.8]) {
      for (const c of COTES) {
        const F = face(V, x, y, w, h, c);
        for (const u of c === 'nord' || c === 'sud' ? us : us.map((q) => 0.05 + q * 0.9)) {
          if (riche) B.bandeFace(ctx, F, u - 0.05, u + 0.05, z0, z1, B.FER); else bande(ctx, F, u - 0.045, u + 0.045, z0, z1, '#6a645d', 0.6);
        }
      }
    },
    /** Une bande pleine sur une face visible (de la hauteur z0 à z1). */
    bandeUnie(ctx, F, u0, u1, z0, z1, fond) { if (riche) B.bandeFace(ctx, F, u0, u1, z0, z1, fond, false); else bande(ctx, F, u0, u1, z0, z1, fond, 0.7); },
    /** Des planches sur le dessus : `n` bandes dans le sens des v de la forme décrite par P(u, v). */
    planchesDessus(ctx, r, P, n, tons) {
      if (riche) { B.planches(ctx, r, P, n, tons ?? B.PLANCHES); return; }
      ctx.beginPath();
      for (let k = 1; k < n; k++) { ctx.moveTo(...P(0.02, k / n)); ctx.lineTo(...P(0.98, k / n)); }
      trait(ctx, 'rgba(40,22,8,0.45)', 0.9);
    },
    poly2(ctx, pts, fond, e = ep) { poly(ctx, pts); encre(ctx, fond, e); },
    disque(ctx, x, y, R, fond, e = ep) { ctx.beginPath(); ctx.arc(x, y, R, 0, 7); encre(ctx, fond, e); },
    ligne(ctx, pts, couleur, e) { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(...p) : ctx.moveTo(...p))); trait(ctx, couleur, e); },
    /** Une pièce d'or à plat (rayon R). */
    piece(ctx, x, y, R) {
      kit.disque(ctx, x, y, R, pal.or, 0.5);
      ctx.beginPath(); ctx.arc(x - R * 0.28, y - R * 0.28, R * 0.38, 0, 7); ctx.fillStyle = pal.orClair; ctx.fill();
    },
    /** Une gemme taillée à plat (rayon R). */
    gemme(ctx, x, y, R, fond) {
      kit.poly2(ctx, [[x, y - R * 1.2], [x + R, y], [x, y + R * 1.1], [x - R, y]], fond, 0.5);
      kit.ligne(ctx, [[x - R * 0.5, y - R * 0.1], [x, y - R * 0.7]], 'rgba(255,255,255,0.7)', 0.7);
    },
    /** Un livre à plat : le rectangle `pts`, sa couleur, un filet clair sur la tranche. */
    livre(ctx, pts, fond) {
      kit.poly2(ctx, pts, fond, riche ? 0.6 : 0.5);
      kit.ligne(ctx, [milieu(pts[0], pts[1], 0.15), milieu(pts[3], pts[2], 0.15)], 'rgba(255,255,255,0.35)', 0.7);
    },
    /** Un éclat de pierre ou de marbre : un petit bloc bas (aux deux styles). */
    caillou(ctx, V, r, cx, cy, R, h = 0.1) {
      if (riche) B.bloc(ctx, V, r, cx, cy, R, h, B.MARBRE_C, B.MARBRE_DESSUS); else rocher(ctx, V, r, cx, cy, R, h, MARBRE);
    },
  };
  return kit;
}

const kits = {};
const kitDe = (riche) => (kits[riche] ??= creerKit(riche));

// --- Les états ----------------------------------------------------------------------------------------------------

/** Un tas de pièces (et de gemmes) sur le dessus d'un rectangle (x, y, w, h) à la hauteur `z`, en trois couches qui se resserrent. */
function tasDOr(ctx, V, r, K, x, y, w, h, z, R) {
  const cx = x + w / 2, cy = y + h / 2;
  for (const [dz, n, sp] of [[0, 15, 1], [0.022, 9, 0.7], [0.044, 4, 0.4]]) {
    V.auNiveau(ctx, z + dz, () => { for (let i = 0; i < n; i++) K.piece(ctx, cx + (r() - 0.5) * w * sp, cy + (r() - 0.5) * h * sp, R); });
  }
  V.auNiveau(ctx, z + 0.06, () => { K.pal.gemmes.forEach((c, i) => K.gemme(ctx, cx + (i - 1) * w * 0.2 + (r() - 0.5) * 2, cy + (r() - 0.5) * h * 0.3, R * 1.05, c)); });
}

/** Le coffre sans son couvercle fermé : le corps ouvert (intérieur sombre, planches du fond) et le couvercle relevé contre le dos, doublé de velours. */
function coffreOuvert(K, vide) {
  return (ctx, w, h, t, o) => {
    const { V, r } = preparerObjet(ctx, o), cw = w * 0.8, ch = h * 0.6, x = -cw / 2, y = -ch / 2, m = t * 0.07, e = 0.17;
    K.bloc(ctx, V, r, rectPts(x, y, cw, ch), 0, e, 'bois', () => {
      K.poly2(ctx, rectPts(x + m, y + m, cw - 2 * m, ch - 2 * m), K.pal.fond, K.ep);
      K.poly2(ctx, rectPts(x + m, y + m, cw - 2 * m, ch * 0.2), K.pal.paroi, 0.5);
      const P = (u, v) => [x + m + (cw - 2 * m) * u, y + ch * 0.3 + (ch - 2 * m - ch * 0.2) * v];
      ctx.beginPath(); for (let k = 1; k < 4; k++) { ctx.moveTo(...P(0.03, k / 4)); ctx.lineTo(...P(0.97, k / 4)); }
      trait(ctx, 'rgba(255,230,190,0.18)', 0.8);
    });
    K.faces(ctx, V, r, x, y, cw, ch, 0, e, 3);
    K.bandes(ctx, V, x, y, cw, ch, 0, e);
    // Le couvercle, relevé : un panneau debout contre le dos, sa face interne (doublée de velours) tournée vers le centre.
    const th = ch * 0.16, z1 = 0.5;
    K.bloc(ctx, V, r, rectPts(x, y, cw, th), e, z1, 'boisClair', () => {
      for (const u of [0.2, 0.8]) K.ligne(ctx, [[x + cw * (u - 0.05), y], [x + cw * (u - 0.05), y + th]], K.pal.fer, 2.4);
    });
    const F = face(V, x, y, cw, th, 'sud');
    if (F.visible) {
      K.bandeUnie(ctx, F, 0.05, 0.95, e + 0.03, z1 - 0.03, K.pal.velours);
      for (const u of [0.2, 0.8]) K.bandeUnie(ctx, F, u - 0.045, u + 0.045, e + 0.01, z1 - 0.01, K.pal.fer);
    }
    if (vide) { // vide : une seule pièce oubliée au fond, un peu de poussière
      V.auNiveau(ctx, e + 0.004, () => K.piece(ctx, x + cw * 0.7, y + ch * 0.62, t * 0.04));
      return;
    }
    tasDOr(ctx, V, r, K, x + m * 1.5, y + ch * 0.28, cw - 3 * m, ch * 0.62, e + 0.01, t * 0.05);
    for (let i = 0; i < 4; i++) K.piece(ctx, x + cw * (0.2 + 0.2 * i) + (r() - 0.5) * 3, y + ch + t * (0.05 + 0.04 * r()), t * 0.045); // ce qui a débordé sur le sol
  };
}

/** Le coffre fracassé : couvercle éclaté (bord déchiqueté, planches fendues, sangle arrachée), l'intérieur sombre visible, éclats et serrure au sol. */
function coffreBrise(K) {
  return (ctx, w, h, t, o) => {
    const { V, r } = preparerObjet(ctx, o), cw = w * 0.8, ch = h * 0.6, x = -cw / 2, y = -ch / 2, m = t * 0.07, e = 0.17;
    K.bloc(ctx, V, r, rectPts(x, y, cw, ch), 0, e, 'bois', () => {
      K.poly2(ctx, rectPts(x + m, y + m, cw - 2 * m, ch - 2 * m), K.pal.fond, K.ep);
      K.poly2(ctx, rectPts(x + m, y + m, cw - 2 * m, ch * 0.2), K.pal.paroi, 0.5);
    });
    K.faces(ctx, V, r, x, y, cw, ch, 0, e, 3);
    K.bandes(ctx, V, x, y, cw, ch, 0, e, [0.2]); // la ferrure de droite a été arrachée
    const front = face(V, x, y, cw, ch, 'sud');
    if (front.visible) { // un coin de la planche de devant est cassé
      K.poly2(ctx, [front.P(0.66, e), front.P(0.86, e), front.P(0.8, e * 0.55), front.P(0.7, e * 0.7)], K.pal.fond, 0.7);
    }
    // Le couvercle : un polygone au bord avant déchiqueté.
    const lid = [[x, y], [x + cw, y], [x + cw, y + ch * 0.6], [x + cw * 0.86, y + ch * 0.72], [x + cw * 0.74, y + ch * 0.52], [x + cw * 0.58, y + ch * 0.8], [x + cw * 0.42, y + ch * 0.55],
      [x + cw * 0.28, y + ch * 0.74], [x + cw * 0.12, y + ch * 0.58], [x, y + ch * 0.7]];
    K.bloc(ctx, V, r, lid, e, 0.27, 'boisClair', (S) => {
      const g = centre(S);
      ctx.save(); ctx.beginPath(); S.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.closePath(); ctx.clip();
      K.planchesDessus(ctx, r, pQ([S[0], S[1], [S[1][0], g[1] + (S[2][1] - g[1]) * 0.9], [S[0][0], g[1] + (S[9][1] - g[1]) * 0.9]]), 3);
      for (const u of [0.2, 0.8]) K.ligne(ctx, [[S[0][0] + (S[1][0] - S[0][0]) * u, S[0][1]], [S[0][0] + (S[1][0] - S[0][0]) * u, g[1] + (S[2][1] - g[1]) * 0.55]], K.pal.fer, 2.6); // les sangles, brisées net
      K.ligne(ctx, [[g[0] - cw * 0.12, S[0][1]], [g[0] - cw * 0.04, g[1] - ch * 0.1], [g[0] - cw * 0.14, g[1] + ch * 0.12], [g[0] - cw * 0.06, g[1] + ch * 0.3]], ENCRE, 1.3); // la fente
      ctx.restore();
    }, 0.88);
    // Au sol : la serrure arrachée, trois éclats de planche, la sangle tordue.
    K.poly2(ctx, rectC(x + cw * 0.88, y + ch * 1.12, t * 0.1, t * 0.12, 0.5), K.pal.or, 0.8);
    K.ligne(ctx, [[x + cw * 0.5, y + ch * 1.16], [x + cw * 0.62, y + ch * 1.1], [x + cw * 0.74, y + ch * 1.18]], K.pal.fer, 2.8);
    for (const [u, v, a] of [[0.1, 1.1, 0.4], [0.34, 1.16, -0.5], [0.96, 0.3, 0.9]]) K.poly2(ctx, rectC(x + cw * u, y + ch * v, t * 0.17, t * 0.045, a), K.pal.bois, 0.7);
  };
}

/** Les livres d'une étagère de la face `F` (v0 à v1 : la hauteur du rayon, en part de h1) : des dos serrés, avec des trous, des livres penchés ou couchés. */
function rayon(ctx, r, K, F, h1, v0, v1, bw, t, opts) {
  const P = (u, v) => F.P(u, h1 * v);
  K.poly2(ctx, [P(0.02, v0), P(0.98, v0), P(0.98, v1), P(0.02, v1)], K.riche ? '#6b4425' : '#1a1009', 0.8);
  const haut = v1 - v0, couleurs = opts.couleurs ?? K.pal.livres;
  let u = 0.03, trou = 0;
  while (u < 0.96) {
    const du = (opts.largeur[0] + r() * opts.largeur[1]) * (2 * t) / bw;
    if (trou > 0) { // un vide : parfois un livre couché au bout
      trou--;
      if (trou === 0 && opts.couches && u < 0.88) {
        const lw = du * 2.4, hh = haut * 0.2;
        for (let k = 0; k < 1 + ((r() * 2) | 0); k++) K.livre(ctx, [P(u, v0 + hh * k), P(u + lw, v0 + hh * k), P(u + lw, v0 + hh * (k + 1)), P(u, v0 + hh * (k + 1))], couleurs[(r() * couleurs.length) | 0]);
        u += lw;
      }
      u += du * 0.9; continue;
    }
    if (r() < opts.trous) { trou = 1 + ((r() * 4) | 0); continue; }
    const top = v0 + haut * (opts.hauteur[0] + r() * opts.hauteur[1]), pente = r() < opts.penches ? du * 1.1 : 0;
    K.livre(ctx, [P(u, v0), P(u + du, v0), P(u + du + pente, top), P(u + pente, top)], couleurs[(r() * couleurs.length) | 0]);
    if (opts.dorures) K.ligne(ctx, [P(u + du * 0.1, v0 + (top - v0) * 0.72), P(u + du * 0.9, v0 + (top - v0) * 0.72)], K.pal.or, 0.8);
    u += du + 0.002;
  }
  K.ligne(ctx, [P(0.01, v0), P(0.99, v0)], K.riche ? '#e0a960' : '#5a3a1c', 1.6);
}

/** La bibliothèque debout (même corps que l'original) dont on choisit le matériau et le contenu des rayons. */
function bibliothequeDebout(K, { mat, rayons, dessus }) {
  return (ctx, w, h, t, o) => {
    const { V, r } = preparerObjet(ctx, o), bw = w - t * 0.08, bh = h * 0.7, x = -bw / 2, y = -h / 2 + t * 0.04, h1 = 0.95;
    K.bloc(ctx, V, r, rectPts(x, y, bw, bh), 0, h1, mat, (S) => {
      const P = (u, v) => [x + bw * u, y + bh * v];
      K.planchesDessus(ctx, r, (u, v) => P(v, u), 4, K.riche ? B.BOIS_FONCE : undefined);
      if (V.KP > 0) return;
      // À plat, on ne voit que le dessus des livres, alignés sur le devant (avec les trous des états abîmés).
      K.poly2(ctx, rectPts(x + 3, y + bh * 0.45, bw - 6, bh * 0.5), K.riche ? '#6b4425' : '#1a1009', 0.7);
      for (let u = x + 4; u < x + bw - 6;) {
        const du = t * (rayons.largeur[0] + r() * rayons.largeur[1]) * 1.3;
        if (r() >= rayons.trous) K.poly2(ctx, rectPts(u, y + bh * 0.52, du - 1, bh * 0.4), (rayons.couleurs ?? K.pal.livres)[(r() * (rayons.couleurs ?? K.pal.livres).length) | 0], 0.5);
        u += du;
      }
    });
    for (const c of COTES) { const F = face(V, x, y, bw, bh, c); if (K.riche) B.aretes(ctx, V, F, c, 0, h1, 0.03); }
    const F = face(V, x, y, bw, bh, 'sud');
    if (F.visible) {
      for (const [v0, v1] of [[0.05, 0.33], [0.37, 0.65], [0.69, 0.95]]) rayon(ctx, r, K, F, h1, v0, v1, bw, t, rayons);
      dessus?.(ctx, V, r, K, F, { x, y, bw, bh, h1, t });
    }
    if (dessus && !F.visible) dessus(ctx, V, r, K, null, { x, y, bw, bh, h1, t });
  };
}

/** Un crâne à plat (rayon R) : le dessus, deux orbites, le nez. */
function crane(ctx, K, x, y, R) {
  ctx.beginPath(); ctx.ellipse(x, y, R, R * 1.1, 0, 0, 7); encreCrane(ctx, K);
  for (const sg of [-1, 1]) { ctx.beginPath(); ctx.ellipse(x + sg * R * 0.38, y + R * 0.05, R * 0.24, R * 0.3, 0, 0, 7); ctx.fillStyle = '#4a3a28'; ctx.fill(); }
  K.ligne(ctx, [[x - R * 0.35, y + R * 0.7], [x + R * 0.35, y + R * 0.7]], '#4a3a28', 0.8);
}
const encreCrane = (ctx, K) => encre(ctx, K.pal.os, K.riche ? 0.8 : 0.6);

/** Une fiole à plat : un ventre rond, un goulot, un bouchon. */
function fiole(ctx, K, x, y, R, liquide) {
  K.disque(ctx, x, y, R, liquide, K.ep);
  K.poly2(ctx, rectPts(x - R * 0.28, y - R * 1.5, R * 0.56, R * 0.9), K.riche ? '#e9f4ee' : '#b9c9c0', K.ep);
  K.poly2(ctx, rectPts(x - R * 0.34, y - R * 1.75, R * 0.68, R * 0.3), K.pal.bois, K.ep);
  ctx.beginPath(); ctx.arc(x - R * 0.3, y - R * 0.25, R * 0.25, 0, 7); ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fill();
}

/** Des maillons de chaîne le long d'une courbe de (x0, y0) à (x1, y1) qui s'affaisse de `creux` px. */
function chaine(ctx, K, x0, y0, x1, y1, creux, taille) {
  const n = Math.max(8, Math.round(Math.hypot(x1 - x0, y1 - y0) / (taille * 1.7)));
  for (let i = 0; i <= n; i++) {
    const u = i / n, px = x0 + (x1 - x0) * u, py = y0 + (y1 - y0) * u + Math.sin(u * Math.PI) * creux;
    ctx.beginPath(); ctx.ellipse(px, py, taille * (i % 2 ? 0.55 : 0.95), taille * (i % 2 ? 0.95 : 0.55), 0, 0, 7);
    ctx.lineWidth = Math.max(0.9, taille * 0.5); ctx.strokeStyle = ENCRE; ctx.stroke();
    ctx.lineWidth = Math.max(0.5, taille * 0.28); ctx.strokeStyle = K.pal.ferClair; ctx.stroke();
  }
}

/** La bibliothèque basculée sur son devant : on voit son dos (planches), un peu de travers, et ses livres éparpillés devant elle. */
function bibliothequeRenversee(K) {
  return (ctx, w, h, t, o) => {
    const { V, r } = preparerObjet(ctx, o), bw = w - t * 0.1, prof = h * 0.56, y0 = -h / 2 + t * 0.04, cy = y0 + prof / 2, a = (r() - 0.5) * 0.1;
    const pts = rectC(0, cy, bw * 0.97, prof, a);
    K.bloc(ctx, V, r, pts, 0, 0.16, 'boisSombre', (S) => {
      const P = pQ(S);
      K.planchesDessus(ctx, r, (u, v) => P(v, u), 5, K.riche ? B.BOIS_FONCE : undefined);
      K.ligne(ctx, [P(0.03, 0.06), P(0.97, 0.06)], 'rgba(255,236,196,0.5)', 1);
      for (const u of [0.28, 0.55, 0.8]) K.ligne(ctx, [P(0.02, u), P(0.98, u)], 'rgba(30,16,6,0.5)', 1.6); // les tablettes, qui se devinent sous le dos
      K.ligne(ctx, [P(0.62, 0.02), P(0.56, 0.3), P(0.64, 0.5), P(0.58, 0.8)], ENCRE, 1.2); // le dos s'est fendu en tombant
    });
    // Une tablette arrachée, posée de travers sur le dos.
    V.auNiveau(ctx, 0.16, () => K.poly2(ctx, rectC(-bw * 0.22, cy + prof * 0.12, bw * 0.34, t * 0.09, -0.35 + a), K.pal.bois, 0.7));
    // Les livres éparpillés devant (au sol), deux ouverts, trois restés sur le meuble.
    const yf = y0 + prof + t * 0.02, couleurs = K.pal.livres;
    for (let i = 0; i < 9; i++) {
      const lx = (r() - 0.5) * bw * 0.92, ly = yf + r() * (h / 2 - yf - t * 0.1), an = r() * 3.14, l = t * (0.12 + r() * 0.06), hh = t * (0.17 + r() * 0.06);
      K.poly2(ctx, rectC(lx + 1.4, ly + 1.6, l, hh, an), 'rgba(20,10,4,0.3)', 0);
      if (i < 2) { // ouvert : deux couvertures et des pages
        K.poly2(ctx, rectC(lx, ly, l * 2, hh, an), couleurs[(r() * couleurs.length) | 0], 0.6);
        K.poly2(ctx, rectC(lx, ly, l * 1.8, hh * 0.84, an), K.pal.page, 0.4);
        K.ligne(ctx, [[lx - Math.sin(an) * hh * 0.42, ly + Math.cos(an) * hh * 0.42], [lx + Math.sin(an) * hh * 0.42, ly - Math.cos(an) * hh * 0.42]], K.pal.boisFonce, 0.8);
      } else K.livre(ctx, rectC(lx, ly, l, hh, an), couleurs[(r() * couleurs.length) | 0]);
    }
    V.auNiveau(ctx, 0.16, () => { for (let i = 0; i < 3; i++) K.livre(ctx, rectC((r() - 0.5) * bw * 0.7, y0 + prof * (0.7 + r() * 0.2), t * 0.12, t * 0.18, r() * 3.14), couleurs[(r() * couleurs.length) | 0]); });
  };
}

/** Le contour d'un tonneau couché (axe en x) : un fuseau bombé, de demi-longueur L, de demi-largeur W au milieu, tourné de `a`. */
function fuseau(L, W, a, n = 12) {
  const bas = [], haut = [];
  for (let i = 0; i <= n; i++) { const u = (i / n) * 2 - 1, hw = W * (0.8 + 0.2 * Math.cos((u * Math.PI) / 2)); haut.push([u * L, -hw]); bas.push([u * L, hw]); }
  return tourner(haut.concat(bas.reverse()), a);
}

/** Le tonneau sur le flanc : fuseau de douelles dans le sens de la longueur, cerclages de fer en travers, bonde sur le dessus. */
function tonneauCouche(K) {
  return (ctx, w, h, t, o) => {
    const { V, r } = preparerObjet(ctx, o), s = Math.min(w, h), L = s * 0.46, W = s * 0.34, a = (r() - 0.5) * 0.35;
    const pts = fuseau(L, W, a);
    K.bloc(ctx, V, r, pts, 0, 0.3, 'bois', () => {
      const R = (u, v) => tourner([[u * L, v * W]], a)[0]; // (u, v) dans [−1, 1] : le long de l'axe, en travers
      const largeur = (u) => 0.8 + 0.2 * Math.cos((u * Math.PI) / 2);
      if (K.riche) B.planches(ctx, r, (u, v) => R(u * 2 - 1, (v * 2 - 1) * largeur(u * 2 - 1)), 6, B.PLANCHES);
      else { ctx.beginPath(); for (let k = 1; k < 6; k++) { const v = (k / 6) * 2 - 1; ctx.moveTo(...R(-1, v * largeur(-1))); for (let i = 1; i <= 8; i++) { const u = -1 + i / 4; ctx.lineTo(...R(u, v * largeur(u))); } } trait(ctx, 'rgba(60,35,15,0.6)', 0.9); }
      for (const u of [-0.74, -0.1, 0.54]) { // les cerclages : en travers, bombés comme le fût
        ctx.beginPath(); ctx.moveTo(...R(u, -largeur(u) * 1.02)); ctx.lineTo(...R(u, largeur(u) * 1.02)); trait(ctx, K.pal.fer, K.riche ? 2.8 : 2.4);
        if (K.riche) { ctx.beginPath(); ctx.moveTo(...R(u - 0.02, -largeur(u) * 0.8)); ctx.lineTo(...R(u - 0.02, -largeur(u) * 0.1)); trait(ctx, B.FER_REFLET, 1); }
      }
      K.disque(ctx, ...R(0.25, 0.1), Math.max(1.6, s * 0.035), K.pal.boisFonce, 0.8); // la bonde
    });
  };
}

/** Le tonneau éventré : le fond défoncé (douelles brisées vers l'intérieur et vers l'extérieur), du liquide répandu au sol, deux douelles et un cercle tombés. */
function tonneauEventre(K) {
  return (ctx, w, h, t, o) => {
    const { V, r } = preparerObjet(ctx, o), R = Math.min(w, h) * 0.36, h1 = 0.34, liquide = r() < 0.5 ? K.pal.vin : K.pal.biere;
    // La flaque : une tache irrégulière qui sort du pied, côté avant-droit, cernée et rehaussée d'un reflet clair.
    const fl = [];
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2, k = 0.82 + r() * 0.3; fl.push([R * 0.32 + Math.cos(a) * R * 1.08 * k, R * 0.4 + Math.sin(a) * R * 0.74 * k]); }
    K.poly2(ctx, fl, liquide, K.riche ? 1 : 0.8);
    K.ligne(ctx, [[R * 0.7, R * 0.78], [R * 1.05, R * 0.72], [R * 1.25, R * 0.6]], K.riche ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.3)', 1.4);
    // Deux douelles et un cercle de fer tombés sur la flaque.
    K.poly2(ctx, rectC(-R * 0.78, R * 0.7, R * 0.78, R * 0.15, 0.5), K.pal.bois, 0.7);
    K.poly2(ctx, rectC(R * 0.3, R * 1.02, R * 0.7, R * 0.13, -0.25), K.pal.bois, 0.7);
    V.cylindre(ctx, r, 0, 0, R, 0, h1, K.MAT.bois.f, () => {
      K.disque(ctx, 0, 0, R, K.riche ? B.PLANCHES[0] : '#b88049', K.riche ? 1.4 : 1.6);
      ctx.beginPath(); ctx.arc(0, 0, R * 0.9, 0, 7); trait(ctx, K.pal.fer, 2.4);
      // Le trou : une brèche irrégulière, sombre, qui laisse voir le liquide ; des douelles brisées s'y enfoncent depuis le bord, en biais.
      const trou = [];
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + 0.3, rr = R * (0.52 + r() * 0.26); trou.push([Math.cos(a) * rr + R * 0.04, Math.sin(a) * rr]); }
      K.poly2(ctx, trou, K.pal.fond, K.ep);
      K.poly2(ctx, trou.map(([px, py]) => [px * 0.6 + R * 0.06, py * 0.5 + R * 0.12]), liquide, 0.5);
      for (const a0 of [0.2, 1.9, 3.6, 5.0]) { // une douelle cassée : un coin de bois clair planté dans la brèche
        const a = a0 + (r() - 0.5) * 0.4, w1 = 0.2 + r() * 0.1, dedans = R * (0.45 + r() * 0.2);
        K.poly2(ctx, [[Math.cos(a - w1) * R * 0.88, Math.sin(a - w1) * R * 0.88], [Math.cos(a + w1) * R * 0.88, Math.sin(a + w1) * R * 0.88], [Math.cos(a + w1 * 0.3) * dedans, Math.sin(a + w1 * 0.3) * dedans], [Math.cos(a - w1 * 0.2) * (dedans + R * 0.08), Math.sin(a - w1 * 0.2) * (dedans + R * 0.08)]], K.pal.bois, K.riche ? 0.8 : 0.6);
      }
    });
    V.cerclage(ctx, 0, 0, R, 0.07, h1);
  };
}

/** Le sarcophage ouvert : intérieur sombre (os, bandelettes, crâne), le couvercle de pierre glissé de travers vers l'avant. */
function sarcophageOuvert(K) {
  return (ctx, w, h, t, o) => {
    const { V, r } = preparerObjet(ctx, o), sw = w * 0.76, sh = h - t * 0.12, x = -sw / 2, y = -sh / 2, long = sh >= sw, m = t * 0.07;
    const L = long ? sh : sw, E = long ? sw : sh, A = (a, b) => (long ? [b * E, -L / 2 + a * L] : [-L / 2 + a * L, b * E]); // a : de la tête (0) aux pieds (1) ; b : −0,5 à 0,5
    K.bloc(ctx, V, r, rectPts(x, y, sw, sh), 0, 0.2, 'pierre', () => {
      K.poly2(ctx, rectPts(x + m, y + m, sw - 2 * m, sh - 2 * m), K.pal.fond, K.ep);
      // Le défunt : bandelettes en travers, côtes, crâne tourné vers le haut, os des mains.
      for (let i = 0; i < 4; i++) { const a = 0.2 + i * 0.1, e = i % 2 ? -0.02 : 0.03; K.poly2(ctx, [A(a, -0.34 + e), A(a + 0.045, -0.36), A(a + 0.05, 0.36), A(a, 0.34 - e)], i % 2 ? K.pal.bandelette : K.pal.bandeletteOmbre, 0.5); }
      for (let i = 0; i < 3; i++) { K.ligne(ctx, [A(0.24 + i * 0.07, 0.04), A(0.22 + i * 0.07, 0.3)], K.pal.os, 1.8); K.ligne(ctx, [A(0.24 + i * 0.07, -0.04), A(0.22 + i * 0.07, -0.3)], K.pal.os, 1.8); }
      K.ligne(ctx, [A(0.2, 0), A(0.62, 0)], K.pal.osOmbre, 2.2);
      const [cx, cy] = A(0.1, 0); crane(ctx, K, cx, cy, Math.min(sw, sh) * 0.13);
    });
    for (const c of COTES) { const F = face(V, x, y, sw, sh, c); if (K.riche) { B.joints(ctx, F, 0, 0.14, 2, 3); B.aretes(ctx, V, F, c, 0, 0.2, 0.05); } else traits(ctx, F, 0, 0.2, 3, 'rgba(20,18,14,0.5)', 0.9); }
    // Le couvercle, de travers, glissé vers les pieds : un peu plus court que le coffre, tourné de 9° ; à plat, il dépasse à peine.
    const ac = 0.66, an = (long ? 1 : -1) * 0.16, [lx, ly] = A(ac, 0.04), lid = tourner(long ? rectPts(lx - E * 0.47, ly - L * 0.36, E * 0.94, L * 0.72) : rectPts(lx - L * 0.36, ly - E * 0.47, L * 0.72, E * 0.94), an, lx, ly);
    K.bloc(ctx, V, r, lid, 0.2, 0.3, 'pierreClaire', (S) => {
      const g = centre(S), d = (u, v) => { const [px, py] = tourner([[(long ? v * E * 0.8 : u * L * 0.6), (long ? u * L * 0.6 : v * E * 0.8)]], an)[0]; return [g[0] + px, g[1] + py]; };
      if (K.riche) { K.ligne(ctx, [d(-1, -0.7), d(1, -0.7), d(1, 0.7), d(-1, 0.7), d(-1, -0.7)], 'rgba(120,104,80,0.7)', 1); }
      K.disque(ctx, ...d(-0.62, 0), E * 0.12, K.riche ? '#fbf7ee' : '#ebe6da', 1);
      for (const [a0, b0, a1, b1] of [[-0.3, -0.45, -0.3, 0.45], [-0.45, 0, 0.7, 0]]) {
        K.ligne(ctx, [d(a0, b0), d(a1, b1)], K.riche ? ENCRE : '#5f5b53', K.riche ? 4 : 3.4); K.ligne(ctx, [d(a0, b0), d(a1, b1)], K.riche ? '#bdb6a4' : '#c9c4b8', K.riche ? 2.4 : 1.6);
      }
    }, 1);
  };
}

/** La statue brisée : le socle intact (plaque dorée), un moignon de marbre à la cassure dentelée, la tête tombée sur le socle, des éclats au pied. */
function statueBrisee(K) {
  return (ctx, w, h, t, o) => {
    const { V, r } = preparerObjet(ctx, o), s = Math.min(w, h), a = s * 0.38;
    K.bloc(ctx, V, r, rectPts(-a, -a, a * 2, a * 2), 0, 0.13, 'pierre', undefined);
    const F = face(V, -a, -a, a * 2, a * 2, 'sud');
    K.bandeUnie(ctx, F, 0.3, 0.7, 0.035, 0.095, K.pal.or);
    if (K.riche) for (const c of COTES) B.aretes(ctx, V, face(V, -a, -a, a * 2, a * 2, c), c, 0, 0.13, 0.05);
    // Les éclats au sol, devant le socle, puis ceux posés dessus.
    K.caillou(ctx, V, r, a * 1.2, a * 1.14, s * 0.085, 0.09);
    K.caillou(ctx, V, r, -a * 1.12, a * 1.2, s * 0.06, 0.07);
    K.caillou(ctx, V, r, a * 0.6, a * 0.5, s * 0.075, 0.1);
    // Le moignon : un cylindre de marbre à la cassure dentelée, légèrement de biais.
    const R = s * 0.19;
    V.cylindre(ctx, r, 0, -s * 0.02, R, 0.13, 0.4, K.MAT.marbre.f, () => {
      const dents = [];
      for (let i = 0; i < 11; i++) { const an = (i / 11) * Math.PI * 2, rr = R * (i % 2 ? 0.72 : 1.02) * (0.94 + r() * 0.1); dents.push([Math.cos(an) * rr, -s * 0.02 + Math.sin(an) * rr]); }
      K.poly2(ctx, dents, K.riche ? '#e8e2d2' : '#cfcabc', K.riche ? 1.2 : 1.3);
      K.ligne(ctx, [[-R * 0.5, -s * 0.06], [-R * 0.05, s * 0.0], [R * 0.25, -s * 0.05], [R * 0.55, s * 0.03]], K.riche ? B.MARBRE_VEINE : 'rgba(70,64,56,0.6)', 1);
      K.disque(ctx, R * 0.05, -s * 0.02, R * 0.22, K.riche ? '#d5ccb4' : '#a7a295', 0.7); // le cœur de la pierre, à nu
    });
    // La tête, tombée sur le socle : un disque de marbre, le regard tourné de côté.
    const hx = -a * 0.5, hy = a * 0.48, Rh = s * 0.115;
    V.cylindre(ctx, r, hx, hy, Rh, 0.13, 0.22, K.MAT.marbre.f, () => {
      K.disque(ctx, hx, hy, Rh, K.riche ? '#fbf7ee' : '#f2eee4', 1.2);
      K.poly2(ctx, [[hx + Rh * 0.5, hy - Rh * 0.12], [hx + Rh * 1.02, hy + Rh * 0.12], [hx + Rh * 0.5, hy + Rh * 0.3]], K.riche ? '#e2dccd' : '#c9c4b8', 0.7);
      for (const sg of [-1, 1]) { ctx.beginPath(); ctx.arc(hx + Rh * 0.18, hy + sg * Rh * 0.32, Rh * 0.1, 0, 7); ctx.fillStyle = K.riche ? '#7c8aa0' : '#4a4a4a'; ctx.fill(); }
    });
  };
}

/** La caisse ouverte : le dessus béant, la paille qui déborde, le couvercle appuyé contre le flanc (une rampe de planches) ; quelques brins au sol. */
function caisseOuverte(K) {
  return (ctx, w, h, t, o) => {
    const { V, r } = preparerObjet(ctx, o), s = Math.min(w, h) * 0.64, x = -s / 2 - t * 0.08, y = -s / 2, e = 0.27, m = t * 0.07, lw = t * 0.2;
    K.bloc(ctx, V, r, rectPts(x, y, s, s), 0, e, 'bois', () => {
      K.poly2(ctx, rectPts(x + m, y + m, s - 2 * m, s - 2 * m), K.pal.fond, K.ep);
      for (const [px, py] of [[x + m * 0.5, y + m * 0.5], [x + s - m * 0.5, y + m * 0.5], [x + m * 0.5, y + s - m * 0.5], [x + s - m * 0.5, y + s - m * 0.5]]) if (K.riche) B.clou(ctx, [px, py], Math.max(0.8, t * 0.016));
    });
    K.faces(ctx, V, r, x, y, s, s, 0, e, 3);
    for (const c of COTES) { const Fc = face(V, x, y, s, s, c); K.bandeUnie(ctx, Fc, 0.04, 0.12, 0, e, K.riche ? B.BOIS_FONCE[0] : '#6b4524'); K.bandeUnie(ctx, Fc, 0.88, 0.96, 0, e, K.riche ? B.BOIS_FONCE[0] : '#6b4524'); }
    // Le couvercle : une rampe de planches, du bord du coffre (en haut) jusqu'au sol.
    const A0 = V.haut(x + s, y + s * 0.04, e), A1 = V.haut(x + s, y + s * 0.96, e), B0 = V.haut(x + s + lw, y + s * 0.04, 0), B1 = V.haut(x + s + lw, y + s * 0.96, 0);
    const S = [A0, B0, B1, A1];
    if (K.riche) B.plaque(ctx, V, B.polygone(S), B.PLANCHES[2], { dedans: () => { B.planches(ctx, r, (u, v) => pQ(S)(v, u), 4, B.PLANCHES); } });
    else { poly(ctx, S); encre(ctx, dl(ctx, A0[0], A0[1], B0[0], B0[1], '#c1915c', '#8a5e30'), 1.4); ctx.beginPath(); for (let k = 1; k < 4; k++) { ctx.moveTo(...milieu(A0, A1, k / 4)); ctx.lineTo(...milieu(B0, B1, k / 4)); } trait(ctx, 'rgba(40,22,8,0.5)', 0.9); }
    for (const u of [0.18, 0.82]) K.ligne(ctx, [milieu(A0, A1, u), milieu(B0, B1, u)], K.riche ? '#a8702f' : '#5a3818', 2.4);
    // La paille : une botte hérissée au-dessus du bord, des brins retombés dehors.
    V.auNiveau(ctx, e + 0.02, () => {
      for (let i = 0; i < 26; i++) {
        const px = x + s / 2 + (r() - 0.5) * (s - 2 * m) * 0.9, py = y + s / 2 + (r() - 0.5) * (s - 2 * m) * 0.9, an = r() * 6.28, l = t * (0.1 + r() * 0.1);
        K.ligne(ctx, [[px, py], [px + Math.cos(an) * l, py + Math.sin(an) * l]], i % 3 ? K.pal.paille[i % 3] : ENCRE, i % 3 ? 1.7 : 0.7);
      }
    });
    for (let i = 0; i < 5; i++) {
      const px = x + s * (0.1 + r() * 0.8), py = y + s + t * (0.02 + r() * 0.05), an = r() * 3, l = t * (0.08 + r() * 0.07);
      K.ligne(ctx, [[px, py], [px + Math.cos(an) * l, py + Math.sin(an) * l * 0.5]], K.pal.paille[i % 3], 1.6);
    }
  };
}

/** Tous les états d'un style : `{ type: { variante: dessin(ctx, w, h, t, o) } }`. */
function etats(K) {
  const grimoires = K.pal.grimoires;
  return {
    coffre: { ouvert: coffreOuvert(K, false), vide: coffreOuvert(K, true), brise: coffreBrise(K) },
    bibliotheque: {
      clairsemee: bibliothequeDebout(K, {
        mat: 'boisSombre',
        rayons: { largeur: [0.07, 0.05], trous: 0.5, hauteur: [0.7, 0.28], penches: 0.25, couches: true },
        dessus(ctx, V, r, K2, F, g) { // un seul livre oublié sur le meuble, de travers
          V.auNiveau(ctx, g.h1, () => K2.livre(ctx, rectC(g.x + g.bw * 0.7, g.y + g.bh * 0.45, g.t * 0.2, g.t * 0.14, 0.4), K2.pal.livres[(r() * K2.pal.livres.length) | 0]));
        },
      }),
      renversee: bibliothequeRenversee(K),
      grimoires: bibliothequeDebout(K, {
        mat: 'boisNuit',
        rayons: { largeur: [0.022, 0.018], trous: 0.04, hauteur: [0.8, 0.2], penches: 0, dorures: true, couleurs: grimoires },
        dessus(ctx, V, r, K2, F, g) { // le crâne et la fiole posés sur le meuble, et une chaîne tendue en travers de la face
          V.auNiveau(ctx, g.h1, () => { crane(ctx, K2, g.x + g.bw * 0.22, g.y + g.bh * 0.5, g.t * 0.1); fiole(ctx, K2, g.x + g.bw * 0.76, g.y + g.bh * 0.62, g.t * 0.07, K2.pal.fiole); });
          if (F?.visible) { const a = F.P(0.02, g.h1 * 0.5), b = F.P(0.98, g.h1 * 0.38); chaine(ctx, K2, a[0], a[1], b[0], b[1], g.t * 0.1, Math.max(1.3, g.t * 0.03)); }
        },
      }),
    },
    tonneau: { couche: tonneauCouche(K), eventre: tonneauEventre(K) },
    sarcophage: { ouvert: sarcophageOuvert(K) },
    statue: { brisee: statueBrisee(K) },
    caisse: { ouverte: caisseOuverte(K) },
    ...etatsDecor(K), // fontaine, autel, puits (objets-etats-decor.js)
  };
}

const tables = {};
/**
 * Le dessin peint de l'état (variante non défaut) d'un objet dans le style demandé, ou undefined si l'objet est dans son état d'origine ou n'a pas
 * de variantes : l'appelant dessine alors le dessin habituel.
 */
export function etatPeint(riche, type, o) {
  const v = varianteDe(o);
  if (!v || v === varianteParDefaut(type)) return undefined;
  return (tables[riche] ??= etats(kitDe(riche)))[type]?.[v];
}
