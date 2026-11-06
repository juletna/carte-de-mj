/**
 * Les objets du thème « peint » : chacun est un empilement de volumes (prismes, cylindres : volumes.js) vus depuis le centre de la salle,
 * dans le style du trait colorié (contour brun irrégulier, dégradés, ombre portée douce, faces ombrées selon la lumière du nord-ouest).
 *
 * Le contrat est celui du thème vectoriel (vectoriel.js) : `objets[type](ctx, w, h, t, objet)`, dessin centré sur (0, 0), `w × h` en pixels,
 * l'AVANT de l'objet vers +y (le dos, contre le mur, vers −y). Le moteur a déjà translaté et tourné le contexte : `volumesLocaux(ctx)` ramène le
 * centre de la salle et la lumière dans ce repère, où `V.haut(x, y, h)` dit où tombe un point à la hauteur h (1 = un mur).
 *
 * Règles de ce fichier :
 *   - le pied reste sur les cases de l'objet ; seul le haut penche vers l'extérieur (vue du centre) ;
 *   - les pièces d'un objet sont dessinées du plus loin au plus proche du centre (`ordonner`) : le haut d'une pièce recouvre ce qui est derrière ;
 *   - tout aléa vient d'une graine tirée de la salle et de la place de l'objet (même salle, même rendu, sur la régie comme à la table) ;
 *   - sans relief (KP = 0), il ne reste que le dessus de chaque pièce : il doit rester lisible.
 *
 * Sources de lumière : un objet qui brûle appelle `V.lumiere(x, y, h, { s, r, c, k })` (volumes.js) ; la source est relevée dans `etat.lumieres`
 * pour la couche de lumière (lot suivant). Tant que cette couche n'anime pas les flammes (`etat.flammesAnimees`), l'objet dessine lui-même une flamme fixe.
 */
import { faceVisible, eclairage } from '../../perspective.js';
import { volumesLocaux } from './volumes.js';
import { etat } from './etat.js';
import { alea, graineDeTexte } from './bruit.js';
import { chemin, cercle, encre, trait, dl, dr, ton, centre, rectPts, arrondi, ENCRE } from './trait.js';
import { sensDuCoin } from '../commun.js';
import { DESSINS as DETAILS } from './details.js';
import * as vectoriel from '../vectoriel.js';
import { RICHES } from './objets-dessines.js';
import { teinteFlamme, RAYON_MAGIQUE, fumee, cendres } from '../../feu.js';

const PIERRE = [40, 6, 60], PIERRE_SOMBRE = [40, 5, 46], MARBRE = [40, 8, 74];
const BOIS = [28, 45, 38], BOIS_SOMBRE = [26, 42, 26], BOIS_CLAIR = [30, 48, 50];
const FER = [20, 8, 24], OR = [43, 60, 50];

// --- Briques communes -----------------------------------------------------------------------------------------

/** Les volumes de l'objet (repère local) et son générateur d'aléa, propre à sa place dans la salle. */
export function preparerObjet(ctx, o, surMur = false) {
  const V = volumesLocaux(ctx, surMur);
  const r = alea((etat.graine ^ graineDeTexte(`${o?.type}|${o?.x}|${o?.y}`)) >>> 0);
  return { V, r };
}

export const poly = (ctx, pts) => { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); };
export const milieu = (a, b, u = 0.5) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
export const distCentre = (V, x, y) => Math.hypot(x - V.vue.cx, y - V.vue.cy);

/** Les pièces `{ x, y, dessiner }` d'un objet, jouées du plus loin au plus proche du centre de la salle ((x, y) : le milieu de la pièce). */
export function ordonner(V, pieces) {
  [...pieces].sort((a, b) => distCentre(V, b.x, b.y) - distCentre(V, a.x, a.y)).forEach((p) => p.dessiner());
}

/**
 * Une face verticale du rectangle (x, y, l, h), côté 'nord' | 'sud' | 'est' | 'ouest'. `P(u, v)` : le point à l'abscisse u (0–1, de gauche à droite
 * ou du nord au sud) et à la hauteur v (en murs). `visible` : la face est-elle tournée vers le centre (jamais sans relief) ?
 */
export function face(V, x, y, l, h, cote) {
  const [a, b, n] = {
    nord: [[x, y], [x + l, y], [0, -1]], sud: [[x, y + h], [x + l, y + h], [0, 1]],
    ouest: [[x, y], [x, y + h], [-1, 0]], est: [[x + l, y], [x + l, y + h], [1, 0]],
  }[cote];
  return { n, visible: faceVisible(V.vue, a, b, n), P: (u, v) => V.haut(a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, v) };
}
export const COTES = ['nord', 'sud', 'ouest', 'est'];
const quad = (F, u0, u1, v0, v1) => [F.P(u0, v0), F.P(u1, v0), F.P(u1, v1), F.P(u0, v1)];

/** Une bande pleine sur une face visible. */
function bande(ctx, F, u0, u1, v0, v1, fond, ep = 0.7) {
  if (!F.visible) return;
  poly(ctx, quad(F, u0, u1, v0, v1));
  encre(ctx, fond, ep);
}
/** `n - 1` traits horizontaux régulièrement répartis entre v0 et v1 sur une face visible (planches, joints). */
function traits(ctx, F, v0, v1, n, couleur = 'rgba(30,18,8,0.55)', ep = 0.9) {
  if (!F.visible) return;
  ctx.beginPath();
  for (let k = 1; k < n; k++) {
    const v = v0 + ((v1 - v0) * k) / n;
    ctx.moveTo(...F.P(0.02, v)); ctx.lineTo(...F.P(0.98, v));
  }
  trait(ctx, couleur, ep);
}

/** Flamme fixe (tant que la couche de lumière n'anime pas les flammes) : halo chaud et goutte de feu, `s` px de haut. */
export function flamme(ctx, V, x, y, h, s, r, teinte = teinteFlamme()) {
  if (etat.flammesAnimees) return;
  const [fx, fy] = V.haut(x, y, h);
  const g = ctx.createRadialGradient(fx, fy, 0, fx, fy, s * 4);
  g.addColorStop(0, `rgba(${teinte.halo[0]},0.38)`); g.addColorStop(1, `rgba(${teinte.halo[1]},0)`);
  ctx.beginPath(); ctx.arc(fx, fy, s * 4, 0, 7); ctx.fillStyle = g; ctx.fill();
  ctx.beginPath();
  ctx.moveTo(fx, fy - s * 1.5);
  ctx.quadraticCurveTo(fx + s * 0.9, fy - s * 0.3, fx, fy + s * 0.5);
  ctx.quadraticCurveTo(fx - s * 0.9, fy - s * 0.3, fx, fy - s * 1.5);
  encre(ctx, dl(ctx, fx, fy - s * 1.5, fx, fy + s * 0.5, teinte.clair, teinte.vif), 0.6);
}

/**
 * Déclare la source de lumière d'un feu, aux couleurs de sa variante : `base` est la source d'origine (orange) ; une variante colorée en change la couleur
 * (`c`), les couleurs de la flamme animée (`f`) et, pour un feu magique, la rend plus large et pulsée (`m`). Pour la variante normale, rien ne change.
 */
export function lumiereFeu(V, x, y, h, base, teinte) {
  V.lumiere(x, y, h, { ...base, c: teinte.c ?? base.c, r: base.r * (teinte.magique ? RAYON_MAGIQUE : 1), f: { flamme: teinte.flamme, coeur: teinte.coeur }, m: teinte.magique });
}

/** Le bout d'un feu éteint, au point (x, y) à la hauteur h : un moignon charbonneux, quelques cendres et un mince filet de fumée (`s` px : la taille de la flamme qu'il remplace). */
function feuEteint(ctx, V, x, y, h, s) {
  const [fx, fy] = V.haut(x, y, h);
  ctx.beginPath(); ctx.ellipse(fx, fy - s * 0.1, s * 0.55, s * 0.4, 0, 0, 7);
  encre(ctx, dr(ctx, fx, fy - s * 0.1, s * 0.55, '#4a423c', '#1c1714'), 0.8);
  cendres(ctx, fx + s * 0.15, fy - s * 0.2, s * 0.3, s * 0.2);
  fumee(ctx, fx, fy - s * 0.4, s * 3.2, { largeur: Math.max(0.9, s * 0.18) });
}

/** Le rocher : un petit bloc irrégulier, bas, au sommet plus étroit (aussi utilisé par les débris). */
export function rocher(ctx, V, r, cx, cy, R, h = 0.14, c = [35, 6, 50]) {
  const pts = [];
  for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2 + r() * 0.3, rr = R * (0.78 + r() * 0.28); pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.88]); }
  V.prisme(ctx, r, pts, 0, h, c, (S) => {
    const g = centre(S);
    chemin(ctx, S.slice(5).concat([S[0]]).map(([x, y]) => [x + (g[0] - x) * 0.2, y + (g[1] - y) * 0.2]), false, r, 0.4);
    trait(ctx, 'rgba(255,255,255,0.3)', 1.1);
  }, 0.62);
}

/** Un creux dont `d` murs de profondeur : la paroi du côté opposé au centre se laisse voir (entre le bord et le fond, qui se rapproche du centre). */
export function paroi(ctx, V, a, b, n, da, db, c, sombre = 0.6) {
  if (!faceVisible(V.vue, a, b, n)) return;
  const A0 = V.haut(a[0], a[1], 0), B0 = V.haut(b[0], b[1], 0), A1 = V.haut(a[0], a[1], -da), B1 = V.haut(b[0], b[1], -db);
  const k = (0.8 + 0.3 * eclairage(V.vue, n[0], n[1])) * sombre;
  poly(ctx, [A0, B0, B1, A1]);
  encre(ctx, dl(ctx, A0[0], A0[1], A1[0], A1[1], ton(c, k * 1.1), ton(c, k * 0.45)), 0.9);
}

/** Un escalier qui monte vers le fond (−y) : des marches en volume, de plus en plus hautes, jusqu'au tiers d'un mur. */
function escalierQuiMonte(ctx, w, h, t, o) {
  const { V, r } = preparerObjet(ctx, o), x0 = -w * 0.43, x1 = w * 0.43, y0 = -h * 0.47, y1 = h * 0.47;
  const n = Math.max(4, Math.round((y1 - y0) / (t * 0.27))), sh = (y1 - y0) / n, H = 0.36; // plus haut, il passerait par-dessus le mur
  const marche = (i) => {
    const ya = y1 - (i + 1) * sh, yb = y1 - i * sh, k = 0.85 + 0.35 * (i / (n - 1)); // plus haute, plus claire
    const pts = rectPts(x0, ya, x1 - x0, yb - ya);
    V.prisme(ctx, r, pts, 0, ((i + 1) * H) / n, PIERRE_SOMBRE, () => {
      chemin(ctx, pts, true, r, 0.3); encre(ctx, dl(ctx, x0, ya, x1, yb, ton(PIERRE, k * 0.86), ton(PIERRE, k * 1.05)), 1);
      ctx.beginPath(); ctx.moveTo(x0, yb); ctx.lineTo(x1, yb); trait(ctx, 'rgba(255,255,255,0.3)', 1.1); // le nez de la marche
    });
  };
  // La plus loin de l'œil d'abord : vue de devant, la marche du fond (la plus haute) ; vue de derrière, celle de devant.
  if (V.vue.cy >= (y0 + y1) / 2) for (let i = n - 1; i >= 0; i--) marche(i);
  else for (let i = 0; i < n; i++) marche(i);
}

// --- Les objets -------------------------------------------------------------------------------------------------

const sobres = {
  pilier(ctx, w, h, t, o) {
    const { V, r } = preparerObjet(ctx, o), s = Math.min(w, h), a = s * 0.46, f = s * 0.31, ch = s * 0.41;
    V.prisme(ctx, r, rectPts(-a, -a, a * 2, a * 2), 0, 0.07, PIERRE_SOMBRE, () => {
      chemin(ctx, arrondi(-a, -a, a * 2, a * 2, 4), true, r, 0.4); encre(ctx, dl(ctx, -s / 2, -s / 2, s / 2, s / 2, '#b3afa5', '#6c6961'), 1.6);
    });
    V.prisme(ctx, r, rectPts(-f, -f, f * 2, f * 2), 0.07, 0.94, PIERRE, () => {
      chemin(ctx, rectPts(-f, -f, f * 2, f * 2), true, r, 0.3); encre(ctx, dl(ctx, -f, -f, f, f, '#c4c0b6', '#7c786f'), 1.4);
    });
    for (const c of COTES) { const F = face(V, -f, -f, f * 2, f * 2, c); traits(ctx, F, 0.07, 0.94, 6, 'rgba(30,26,20,0.4)', 0.8); }
    V.prisme(ctx, r, rectPts(-ch, -ch, ch * 2, ch * 2), 0.94, 1, PIERRE_SOMBRE, () => {
      chemin(ctx, arrondi(-ch, -ch, ch * 2, ch * 2, 3), true, r, 0.4); encre(ctx, dl(ctx, -ch, -ch, ch, ch, '#c9c5ba', '#7d796f'), 1.6);
      chemin(ctx, rectPts(-f, -f, f * 2, f * 2), true, r, 0.3); trait(ctx, 'rgba(255,255,255,0.25)', 1);
    });
  },

  colonne(ctx, w, h, t, o) {
    const { V, r } = preparerObjet(ctx, o), s = Math.min(w, h), R = s * 0.28;
    V.cylindre(ctx, r, 0, 0, s * 0.4, 0, 0.07, PIERRE_SOMBRE, () => {
      cercle(ctx, 0, 0, s * 0.4, r); encre(ctx, dr(ctx, 0, 0, s * 0.4, '#bdb9ae', '#7a766d'), 1.5);
    });
    V.cylindre(ctx, r, 0, 0, R, 0.07, 0.93, PIERRE, () => {
      cercle(ctx, 0, 0, R, r); encre(ctx, dr(ctx, 0, 0, R, '#d9d4c8', '#8a857b'), 1.4);
    }, true);
    V.cylindre(ctx, r, 0, 0, s * 0.37, 0.93, 1, PIERRE, () => {
      cercle(ctx, 0, 0, s * 0.37, r); encre(ctx, dr(ctx, 0, 0, s * 0.37, '#ebe6db', '#8f8a80'), 1.7);
      cercle(ctx, 0, 0, R * 0.9, r); trait(ctx, 'rgba(60,55,48,0.55)', 1);
      cercle(ctx, 0, 0, R * 0.45, r); encre(ctx, dr(ctx, 0, 0, R * 0.45, '#f4efe4', '#aaa59a'), 1);
    });
  },

  coffre(ctx, w, h, t, o) {
    const { V, r } = preparerObjet(ctx, o), cw = w * 0.8, ch = h * 0.6, x = -cw / 2, y = -ch / 2;
    V.prisme(ctx, r, rectPts(x, y, cw, ch), 0, 0.17, BOIS, () => {
      chemin(ctx, rectPts(x, y, cw, ch), true, r, 0.4); encre(ctx, dl(ctx, x, y, x + cw, y + ch, '#b07843', '#6d4422'), 1.5);
    });
    for (const c of COTES) {
      const F = face(V, x, y, cw, ch, c);
      traits(ctx, F, 0, 0.17, 3);
      for (const u of c === 'nord' || c === 'sud' ? [0.2, 0.8] : [0.25, 0.75]) bande(ctx, F, u - 0.045, u + 0.045, 0, 0.17, '#6a645d', 0.6);
    }
    const devant = face(V, x, y, cw, ch, 'sud');
    bande(ctx, devant, 0.46, 0.54, 0.06, 0.15, '#d9b24a', 0.7);
    V.prisme(ctx, r, rectPts(x, y, cw, ch), 0.17, 0.27, BOIS_CLAIR, (S) => {
      for (const u of [0.2, 0.8]) { ctx.beginPath(); ctx.moveTo(...milieu(S[0], S[1], u)); ctx.lineTo(...milieu(S[3], S[2], u)); trait(ctx, ENCRE, 4.2); trait(ctx, '#7d7770', 2.6); }
      ctx.beginPath(); ctx.moveTo(...milieu(S[0], S[3], 0.5)); ctx.lineTo(...milieu(S[1], S[2], 0.5)); trait(ctx, 'rgba(40,22,8,0.45)', 0.9);
      const [fx, fy] = milieu(S[3], S[2], 0.5);
      poly(ctx, [[fx - 3, fy - 5], [fx + 3, fy - 5], [fx + 3, fy], [fx - 3, fy]]); encre(ctx, '#d9b24a', 0.8);
    }, 0.88);
  },

  statue(ctx, w, h, t, o) {
    const { V, r } = preparerObjet(ctx, o), s = Math.min(w, h), a = s * 0.38;
    V.prisme(ctx, r, rectPts(-a, -a, a * 2, a * 2), 0, 0.13, PIERRE_SOMBRE, () => {
      chemin(ctx, arrondi(-a, -a, a * 2, a * 2, 4), true, r, 0.4); encre(ctx, dl(ctx, -a, -a, a, a, '#aaa69c', '#68645c'), 1.6);
    });
    V.cylindre(ctx, r, 0, 0, s * 0.19, 0.13, 0.46, MARBRE, () => {
      cercle(ctx, 0, 0, s * 0.19, r, 0.3); encre(ctx, dr(ctx, 0, 0, s * 0.19, '#f0ece2', '#98938a'), 1.3);
    });
    V.cylindre(ctx, r, 0, 0, s * 0.24, 0.46, 0.58, MARBRE, () => {
      ctx.beginPath(); ctx.ellipse(0, 0, s * 0.27, s * 0.2, 0, 0, 7); encre(ctx, dr(ctx, 0, 0, s * 0.27, '#f4f0e6', '#9c978d'), 1.4);
    });
    V.cylindre(ctx, r, 0, s * 0.01, s * 0.115, 0.58, 0.72, MARBRE, () => {
      cercle(ctx, 0, s * 0.01, s * 0.115, r, 0.25); encre(ctx, dr(ctx, 0, s * 0.01, s * 0.115, '#f8f4ea', '#a29d93'), 1.2);
      poly(ctx, [[-s * 0.035, s * 0.07], [s * 0.035, s * 0.07], [0, s * 0.13]]); encre(ctx, '#c9c4b8', 0.7); // le nez : le regard de la statue
    });
  },

  table(ctx, w, h, t, o) {
    const { V, r } = preparerObjet(ctx, o), tw = w - t * 0.16, th = h - t * 0.2, x = -tw / 2, y = -th / 2, p = t * 0.09, hp = 0.22;
    for (const [lx, ly] of [[x + t * 0.05, y + t * 0.05], [x + tw - t * 0.05 - p, y + t * 0.05], [x + t * 0.05, y + th - t * 0.05 - p], [x + tw - t * 0.05 - p, y + th - t * 0.05 - p]]
      .sort((a, b) => distCentre(V, b[0], b[1]) - distCentre(V, a[0], a[1]))) V.prisme(ctx, r, rectPts(lx, ly, p, p), 0, hp, BOIS_SOMBRE);
    V.prisme(ctx, r, rectPts(x, y, tw, th), hp, 0.28, BOIS_CLAIR, () => {
      chemin(ctx, arrondi(x, y, tw, th, 5), true, r, 0.4); encre(ctx, dl(ctx, x, y, x, y + th, '#b07843', '#6d4422'), 1.8);
      for (const k of [0.25, 0.5, 0.75]) { chemin(ctx, [[x + 4, y + th * k], [x + tw - 4, y + th * k]], false, r, 0.4); trait(ctx, 'rgba(50,28,12,0.5)', 0.9); }
    });
  },

  chaise(ctx, w, h, t, o) {
    const { V, r } = preparerObjet(ctx, o), s = Math.min(w, h), sx = s * 0.54, sy = s * 0.5, x = -sx / 2, y = -sy / 2 + s * 0.04, p = s * 0.08;
    const assise = () => {
      for (const [lx, ly] of [[x + 1, y + 1], [x + sx - p - 1, y + 1], [x + 1, y + sy - p - 1], [x + sx - p - 1, y + sy - p - 1]]
        .sort((a, b) => distCentre(V, b[0], b[1]) - distCentre(V, a[0], a[1]))) V.prisme(ctx, r, rectPts(lx, ly, p, p), 0, 0.14, BOIS_SOMBRE);
      V.prisme(ctx, r, rectPts(x, y, sx, sy), 0.14, 0.19, BOIS, () => {
        chemin(ctx, arrondi(x, y, sx, sy, 4), true, r, 0.35); encre(ctx, dl(ctx, x, y, x + sx, y + sy, '#b07a46', '#6a4220'), 1.3);
        chemin(ctx, arrondi(x + sx * 0.14, y + sy * 0.14, sx * 0.72, sy * 0.72, 3), true, r, 0.3); encre(ctx, '#7a2a24', 0.8);
      });
    };
    const bd = s * 0.1, by = y - bd * 0.2;
    const dossier = () => V.prisme(ctx, r, rectPts(x - sx * 0.04, by, sx * 1.08, bd), 0.19, 0.5, BOIS_SOMBRE, () => {
      chemin(ctx, rectPts(x - sx * 0.04, by, sx * 1.08, bd), true, r, 0.3); encre(ctx, dl(ctx, x, by, x + sx, by + bd, '#8a5a30', '#4a2c14'), 1.2);
    });
    ordonner(V, [{ x: 0, y: y + sy / 2, dessiner: assise }, { x: 0, y: by + bd / 2, dessiner: dossier }]);
  },

  autel(ctx, w, h, t, o) {
    const { V, r } = preparerObjet(ctx, o), aw = w - t * 0.14, ah = h - t * 0.3, x = -aw / 2, y = -ah / 2;
    V.prisme(ctx, r, rectPts(x + t * 0.05, y + t * 0.04, aw - t * 0.1, ah - t * 0.08), 0, 0.24, PIERRE_SOMBRE, () => {
      chemin(ctx, rectPts(x, y, aw, ah), true, r, 0.4); encre(ctx, PIERRE, 1.4);
    });
    for (const c of COTES) { const F = face(V, x + t * 0.05, y + t * 0.04, aw - t * 0.1, ah - t * 0.08, c); traits(ctx, F, 0, 0.24, 3, 'rgba(20,18,14,0.5)', 0.9); }
    V.prisme(ctx, r, rectPts(x, y, aw, ah), 0.24, 0.32, PIERRE, () => {
      chemin(ctx, arrondi(x, y, aw, ah, 4), true, r, 0.4); encre(ctx, dl(ctx, x, y, x + aw, y + ah, '#cfcbc0', '#85817a'), 1.5);
      chemin(ctx, rectPts(x + aw * 0.32, y, aw * 0.36, ah), true, r, 0.3); encre(ctx, dl(ctx, x, y, x, y + ah, '#a5302a', '#5b1513'), 1);
      chemin(ctx, rectPts(x + aw * 0.35, y + 1, aw * 0.3, ah - 2), true, r, 0.2); trait(ctx, '#d8b257', 1);
      cercle(ctx, 0, 0, ah * 0.17, r, 0.2); encre(ctx, dr(ctx, 0, 0, ah * 0.17, '#f2d98a', '#9a7428'), 0.9);
    });
    for (const sgn of [-1, 1]) {
      const cx = sgn * aw * 0.4, rr = t * 0.05;
      V.cylindre(ctx, r, cx, 0, rr, 0.32, 0.43, [44, 40, 86], () => { cercle(ctx, cx, 0, rr, r, 0.15); encre(ctx, dr(ctx, cx, 0, rr, '#fffaf0', '#d6c69e'), 0.7); });
      V.lumiere(cx, 0, 0.43, { s: t * 0.07, r: t * 1.6, c: '255,190,110', k: 0.45, petite: true });
      flamme(ctx, V, cx, 0, 0.43, t * 0.045);
    }
  },

  trone(ctx, w, h, t, o) {
    const { V, r } = preparerObjet(ctx, o), s = Math.min(w, h) * 0.82, e = s / 2;
    V.prisme(ctx, r, rectPts(-e, -e, s, s), 0, 0.07, PIERRE_SOMBRE, () => {
      chemin(ctx, arrondi(-e, -e, s, s, 4), true, r, 0.4); encre(ctx, dl(ctx, -e, -e, e, e, '#a8a49a', '#66625a'), 1.5);
    });
    const piece = (x, y, l, p, h0, h1, dessus, c = OR) => ({ x: x + l / 2, y: y + p / 2, dessiner: () => V.prisme(ctx, r, rectPts(x, y, l, p), h0, h1, c, dessus) });
    ordonner(V, [
      piece(-s * 0.4, -s * 0.46, s * 0.8, s * 0.16, 0.07, 0.9, () => {
        chemin(ctx, arrondi(-s * 0.4, -s * 0.46, s * 0.8, s * 0.16, 3), true, r, 0.3); encre(ctx, dl(ctx, -e, -e, e, e, '#f0cc66', '#8a6a1e'), 1.4);
        cercle(ctx, 0, -s * 0.38, s * 0.05, r, 0.2); encre(ctx, dr(ctx, 0, -s * 0.38, s * 0.05, '#e45a4a', '#6a1410'), 0.8);
      }),
      piece(-s * 0.38, -s * 0.3, s * 0.76, s * 0.6, 0.07, 0.2, () => {
        chemin(ctx, arrondi(-s * 0.38, -s * 0.3, s * 0.76, s * 0.6, 4), true, r, 0.3); encre(ctx, dl(ctx, -e, -e, e, e, '#f0cc66', '#8a6a1e'), 1.2);
        chemin(ctx, arrondi(-s * 0.26, -s * 0.2, s * 0.52, s * 0.42, 5), true, r, 0.3); encre(ctx, dl(ctx, -s * 0.26, -s * 0.2, s * 0.26, s * 0.22, '#b8332c', '#661512'), 0.9);
      }),
      piece(-s * 0.48, -s * 0.3, s * 0.12, s * 0.6, 0.07, 0.34, () => {
        chemin(ctx, arrondi(-s * 0.48, -s * 0.3, s * 0.12, s * 0.6, 3), true, r, 0.3); encre(ctx, dl(ctx, -e, -e, e, e, '#e8c35e', '#86661c'), 1.1);
      }),
      piece(s * 0.36, -s * 0.3, s * 0.12, s * 0.6, 0.07, 0.34, () => {
        chemin(ctx, arrondi(s * 0.36, -s * 0.3, s * 0.12, s * 0.6, 3), true, r, 0.3); encre(ctx, dl(ctx, -e, -e, e, e, '#e8c35e', '#86661c'), 1.1);
      }),
    ]);
  },

  tonneau(ctx, w, h, t, o) {
    const { V, r } = preparerObjet(ctx, o), R = Math.min(w, h) * 0.38, h1 = 0.34;
    V.cylindre(ctx, r, 0, 0, R, 0, h1, BOIS, () => {
      cercle(ctx, 0, 0, R, r); encre(ctx, dr(ctx, 0, 0, R, '#b88049', '#6a3e1a'), 1.6);
      cercle(ctx, 0, 0, R * 0.9, r, 0.3); trait(ctx, '#3b3836', 2.2);
      cercle(ctx, 0, 0, R * 0.68, r); encre(ctx, dr(ctx, 0, 0, R * 0.68, '#cc955c', '#82502a'), 1.1);
      for (const dx of [-0.08, 0.08]) { chemin(ctx, [[dx * t, -R * 0.62], [dx * t, R * 0.62]], false, r, 0.3); trait(ctx, 'rgba(60,35,15,0.6)', 0.8); }
    });
    V.cerclage(ctx, 0, 0, R, 0.07, h1); V.cerclage(ctx, 0, 0, R, 0.26, h1);
  },

  caisse(ctx, w, h, t, o) {
    const { V, r } = preparerObjet(ctx, o), s = Math.min(w, h) * 0.78, x = -s / 2, y = -s / 2;
    V.prisme(ctx, r, rectPts(x, y, s, s), 0, 0.27, BOIS, () => {
      chemin(ctx, rectPts(x, y, s, s), true, r, 0.4); encre(ctx, dl(ctx, x, y, x + s, y + s, '#c1915c', '#7a5028'), 1.6);
      chemin(ctx, rectPts(x + 4, y + 4, s - 8, s - 8), true, r, 0.3); trait(ctx, 'rgba(40,22,8,0.7)', 1);
      chemin(ctx, [[x + 5, y + 5], [x + s - 5, y + s - 5]], false, r, 0.3); trait(ctx, '#5a3818', 2.4);
    });
    for (const c of COTES) {
      const F = face(V, x, y, s, s, c);
      traits(ctx, F, 0, 0.27, 3);
      bande(ctx, F, 0.04, 0.12, 0, 0.27, '#6b4524', 0.5); bande(ctx, F, 0.88, 0.96, 0, 0.27, '#6b4524', 0.5);
    }
  },

  escalier(ctx, w, h, t, o) {
    if (o?.sens === 'monte') return escalierQuiMonte(ctx, w, h, t, o);
    // Les marches descendent vers le fond (−y) : un creux dans le sol, dont les marches s'enfoncent de plus en plus.
    const { V, r } = preparerObjet(ctx, o), x0 = -w * 0.43, x1 = w * 0.43, y0 = -h * 0.47, y1 = h * 0.47;
    const n = Math.max(4, Math.round((y1 - y0) / (t * 0.27))), sh = (y1 - y0) / n, D = 0.5, niv = (i) => (-(i + 1) * D) / n; // niveau (négatif) de la marche i, 0 = devant
    ctx.save();
    chemin(ctx, rectPts(x0, y0, x1 - x0, y1 - y0), true, r, 0.5);
    ctx.clip();
    ctx.fillStyle = '#100c09'; ctx.fillRect(x0 - 4, y0 - 4, x1 - x0 + 8, y1 - y0 + 8);
    paroi(ctx, V, [x0, y1], [x0, y0], [1, 0], -niv(0), D, PIERRE_SOMBRE); // flanc ouest, vu de l'est
    paroi(ctx, V, [x1, y0], [x1, y1], [-1, 0], D, -niv(0), PIERRE_SOMBRE);
    paroi(ctx, V, [x0, y0], [x1, y0], [0, 1], D, D, PIERRE_SOMBRE);
    paroi(ctx, V, [x1, y1], [x0, y1], [0, -1], -niv(0), -niv(0), PIERRE_SOMBRE);
    const marche = (i) => {
      const ya = y1 - (i + 1) * sh, yb = y1 - i * sh, L = niv(i), k = 1.12 - 0.62 * (i / (n - 1));
      const pts = [V.haut(x0, ya, L), V.haut(x1, ya, L), V.haut(x1, yb, L), V.haut(x0, yb, L)];
      poly(ctx, pts);
      encre(ctx, dl(ctx, pts[0][0], pts[0][1], pts[3][0], pts[3][1], ton(PIERRE, k * 0.86), ton(PIERRE, k * 1.05)), 1);
      ctx.beginPath(); ctx.moveTo(...pts[3]); ctx.lineTo(...pts[2]); trait(ctx, 'rgba(255,255,255,0.28)', 1.1); // le nez de la marche
    };
    const contremarche = (i) => { // contremarche entre la marche i et la suivante, plus profonde (tournée vers le fond)
      const yb = y1 - (i + 1) * sh;
      if (!faceVisible(V.vue, [x0, yb], [x1, yb], [0, -1])) return;
      poly(ctx, [V.haut(x0, yb, niv(i)), V.haut(x1, yb, niv(i)), V.haut(x1, yb, niv(i + 1)), V.haut(x0, yb, niv(i + 1))]);
      encre(ctx, ton(PIERRE_SOMBRE, 0.7), 0.8);
    };
    if (V.vue.cy >= (y0 + y1) / 2) for (let i = n - 1; i >= 0; i--) marche(i);
    else for (let i = 0; i < n; i++) { marche(i); if (i < n - 1) contremarche(i); }
    ctx.restore();
    chemin(ctx, rectPts(x0, y0, x1 - x0, y1 - y0), true, r, 0.5); trait(ctx, ENCRE, 1.8);
    chemin(ctx, rectPts(x0 - 1.5, y0 - 1.5, x1 - x0 + 3, y1 - y0 + 3), true, r, 0.5); trait(ctx, 'rgba(200,196,186,0.35)', 1); // la margelle
  },

  fosse(ctx, w, h, t, o) {
    const { V, r } = preparerObjet(ctx, o), fw = w * 0.9, fh = h * 0.9, x = -fw / 2, y = -fh / 2, D = 0.9;
    const contour = () => chemin(ctx, arrondi(x, y, fw, fh, t * 0.14), true, r, 1.1, 5);
    ctx.save();
    contour(); ctx.clip();
    ctx.fillStyle = '#0b0807'; ctx.fillRect(x - 4, y - 4, fw + 8, fh + 8);
    paroi(ctx, V, [x, y + fh], [x, y], [1, 0], D, D, PIERRE_SOMBRE, 0.7);
    paroi(ctx, V, [x + fw, y], [x + fw, y + fh], [-1, 0], D, D, PIERRE_SOMBRE, 0.7);
    paroi(ctx, V, [x, y], [x + fw, y], [0, 1], D, D, PIERRE_SOMBRE, 0.7);
    paroi(ctx, V, [x + fw, y + fh], [x, y + fh], [0, -1], D, D, PIERRE_SOMBRE, 0.7);
    // Le fond, qui se rapproche du centre : très sombre, avec quelques pierres tombées.
    const fond = [V.haut(x, y, -D), V.haut(x + fw, y, -D), V.haut(x + fw, y + fh, -D), V.haut(x, y + fh, -D)], c = centre(fond);
    poly(ctx, fond);
    const g = ctx.createRadialGradient(c[0], c[1], 1, c[0], c[1], Math.max(fw, fh) * 0.6);
    g.addColorStop(0, '#1d1815'); g.addColorStop(1, '#050403');
    ctx.fillStyle = g; ctx.fill();
    for (let i = 0; i < 5; i++) { const [px, py] = V.haut((r() - 0.5) * fw * 0.7, (r() - 0.5) * fh * 0.7, -D); cercle(ctx, px, py, 1.5 + r() * 2.5, r, 0.4); encre(ctx, '#2a2420', 0.6); }
    ctx.restore();
    contour(); trait(ctx, ENCRE, 2.2);
    contour(); ctx.save(); ctx.translate(0, -1); trait(ctx, 'rgba(210,205,192,0.28)', 1); ctx.restore();
  },

  lit(ctx, w, h, t, o) {
    const { V, r } = preparerObjet(ctx, o), lw = w * 0.8, lh = h - t * 0.12, x = -lw / 2, y = -lh / 2, ep = t * 0.1;
    const corps = () => {
      V.prisme(ctx, r, rectPts(x, y, lw, lh), 0, 0.1, BOIS_SOMBRE, () => {
        chemin(ctx, rectPts(x, y, lw, lh), true, r, 0.4); encre(ctx, dl(ctx, x, y, x + lw, y + lh, '#7a4e28', '#3e2410'), 1.5);
      });
      V.prisme(ctx, r, rectPts(x + t * 0.04, y + t * 0.04, lw - t * 0.08, lh - t * 0.08), 0.1, 0.18, [40, 15, 82], () => {
        const mx = x + t * 0.06, my = y + t * 0.06, mw = lw - t * 0.12, mh = lh - t * 0.12;
        chemin(ctx, arrondi(mx, my, mw, mh, 5), true, r, 0.4); encre(ctx, dl(ctx, mx, my, mx + mw, my + mh, '#f1ece0', '#c9c1ad'), 1.3);
        chemin(ctx, arrondi(mx, my + mh * 0.3, mw, mh * 0.7, 5), true, r, 0.4); encre(ctx, dl(ctx, mx, my + mh * 0.3, mx + mw, my + mh, '#4a6aa0', '#243a66'), 1.3);
        chemin(ctx, [[mx + 3, my + mh * 0.34], [mx + mw - 3, my + mh * 0.34]], false, r, 0.4); trait(ctx, '#e8e2d0', 2.2);
        chemin(ctx, arrondi(mx + mw * 0.12, my + mh * 0.04, mw * 0.76, mh * 0.2, 5), true, r, 0.4); encre(ctx, dl(ctx, mx, my, mx, my + mh * 0.24, '#fffdf6', '#d3cab4'), 1);
      });
    };
    const tete = () => V.prisme(ctx, r, rectPts(x, y - ep * 0.3, lw, ep), 0, 0.34, BOIS_SOMBRE, () => {
      chemin(ctx, rectPts(x, y - ep * 0.3, lw, ep), true, r, 0.3); encre(ctx, dl(ctx, x, y, x + lw, y + ep, '#8a5a30', '#4a2c14'), 1.4);
    });
    const pied = () => V.prisme(ctx, r, rectPts(x, y + lh - ep * 0.7, lw, ep), 0, 0.2, BOIS_SOMBRE, () => {
      chemin(ctx, rectPts(x, y + lh - ep * 0.7, lw, ep), true, r, 0.3); encre(ctx, dl(ctx, x, y, x + lw, y + ep, '#8a5a30', '#4a2c14'), 1.2);
    });
    ordonner(V, [{ x: 0, y: 0, dessiner: corps }, { x: 0, y: y - ep * 0.3 + ep / 2, dessiner: tete }, { x: 0, y: y + lh - ep * 0.2, dessiner: pied }]);
  },

  bibliotheque(ctx, w, h, t, o) {
    const { V, r } = preparerObjet(ctx, o), bw = w - t * 0.08, bh = h * 0.7, x = -bw / 2, y = -h / 2 + t * 0.04, h1 = 0.95;
    const couleurs = ['#7b2d26', '#2f4f6f', '#3f6b3a', '#8a6a2a', '#5a3d6b', '#6b4a2e', '#a08a5a', '#264a4a'];
    V.prisme(ctx, r, rectPts(x, y, bw, bh), 0, h1, BOIS_SOMBRE, () => {
      chemin(ctx, rectPts(x, y, bw, bh), true, r, 0.4); encre(ctx, dl(ctx, x, y, x, y + bh, '#7a4e2a', '#4a2c14'), 1.6);
      chemin(ctx, rectPts(x + 3, y + 3, bw - 6, bh - 6), true, r, 0.3); trait(ctx, 'rgba(255,230,190,0.22)', 1); // la corniche
      for (const k of [0.3, 0.55, 0.8]) { chemin(ctx, [[x + 6, y + bh * k], [x + bw - 6, y + bh * k]], false, r, 0.5); trait(ctx, 'rgba(30,16,6,0.35)', 0.9); }
      if (V.KP > 0) return;
      // À plat, on ne voit que le dessus des livres, alignés sur le devant.
      chemin(ctx, rectPts(x + 3, y + bh * 0.45, bw - 6, bh * 0.5), true, r, 0.3); encre(ctx, '#1a1009', 0.6);
      for (let u = x + 4; u < x + bw - 6;) { const du = t * (0.07 + r() * 0.05); ctx.fillStyle = couleurs[(r() * couleurs.length) | 0]; ctx.fillRect(u, y + bh * 0.52, du - 1, bh * 0.4); u += du; }
    });
    const F = face(V, x, y, bw, bh, 'sud');
    if (!F.visible) return;
    const P = (u, v) => F.P(u, h1 * v);
    for (const [v0, v1] of [[0.05, 0.33], [0.37, 0.65], [0.69, 0.95]]) {
      poly(ctx, [P(0.02, v0), P(0.98, v0), P(0.98, v1), P(0.02, v1)]); ctx.fillStyle = '#1a1009'; ctx.fill();
      let u = 0.03;
      while (u < 0.96) {
        const du = (0.012 + r() * 0.014) * (2 * t) / bw; // largeur d'un livre : la même quelle que soit la largeur du meuble
        if (r() > 0.08) {
          const top = v0 + (v1 - v0) * (0.7 + r() * 0.28);
          poly(ctx, [P(u, v0), P(u + du, v0), P(u + du, top), P(u, top)]); ctx.fillStyle = couleurs[(r() * couleurs.length) | 0]; ctx.fill(); trait(ctx, 'rgba(10,6,3,0.8)', 0.4);
        }
        u += du + 0.002;
      }
      ctx.beginPath(); ctx.moveTo(...P(0.01, v0)); ctx.lineTo(...P(0.99, v0)); trait(ctx, '#5a3a1c', 1.4); // la tablette
    }
  },

  torche(ctx, w, h, t, o) {
    // Accrochée à la face du mur, derrière la case (−y).
    const { V } = preparerObjet(ctx, o, true), yMur = -h / 2, F = face(V, -w / 2, yMur, w, h, 'nord');
    const P = (v) => F.P(0.5, v);
    const [tx, ty] = P(0.7);
    const suie = ctx.createRadialGradient(tx, ty - t * 0.05, 0, tx, ty - t * 0.05, t * 0.38);
    suie.addColorStop(0, 'rgba(20,12,8,0.38)'); suie.addColorStop(1, 'rgba(20,12,8,0)');
    ctx.beginPath(); ctx.arc(tx, ty - t * 0.05, t * 0.38, 0, 7); ctx.fillStyle = suie; ctx.fill();
    const [ax, ay] = P(0.36), [bx, by] = P(0.64), e = Math.max(2, t * 0.05);
    ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); trait(ctx, ENCRE, e * 2 + 1.5); trait(ctx, '#6a5f54', e * 2 - 0.5); ctx.lineCap = 'butt';
    poly(ctx, [[bx - t * 0.1, by - t * 0.12], [bx + t * 0.1, by - t * 0.12], [bx + t * 0.06, by + t * 0.02], [bx - t * 0.06, by + t * 0.02]]);
    encre(ctx, dl(ctx, bx - t * 0.1, by, bx + t * 0.1, by, '#8a7f73', '#2e2823'), 1.3);
    const [px, py] = [0, yMur + t * 0.1]; // la flamme est un peu en avant du mur
    const T = teinteFlamme(o);
    if (T.eteint) { feuEteint(ctx, V, px, py, 0.7, t * 0.12); return; }
    lumiereFeu(V, px, py, 0.7, { s: t * 0.13, r: t * 3, c: '255,170,80', k: 0.6 }, T);
    flamme(ctx, V, px, py, 0.7, t * 0.12, undefined, T);
  },

  debris(ctx, w, h, t, o) {
    const { V, r } = preparerObjet(ctx, o);
    ctx.beginPath(); // poussière et éclats à plat sous les blocs
    for (let i = 0; i < 12; i++) { const a = (i / 12) * 7; ctx.lineTo(Math.cos(a) * w * (0.32 + r() * 0.12), Math.sin(a) * h * (0.3 + r() * 0.12)); }
    ctx.closePath(); ctx.fillStyle = 'rgba(30,24,18,0.3)'; ctx.fill();
    const blocs = [];
    for (let i = 0; i < 6; i++) blocs.push({ x: (r() - 0.5) * w * 0.66, y: (r() - 0.5) * h * 0.66, R: t * (0.09 + r() * 0.1), h: 0.06 + r() * 0.12, c: [35 + ((r() * 10) | 0), 6, 44 + ((r() * 12) | 0)] });
    for (let i = 0; i < 6; i++) { cercle(ctx, (r() - 0.5) * w * 0.9, (r() - 0.5) * h * 0.9, 1.2 + r() * 1.8, r, 0.4); encre(ctx, '#8d8f8a', 0.6); }
    ordonner(V, blocs.map((b) => ({ x: b.x, y: b.y, dessiner: () => rocher(ctx, V, r, b.x, b.y, b.R, b.h, b.c) })));
  },

  puits(ctx, w, h, t, o) {
    const { V, r } = preparerObjet(ctx, o), R = Math.min(w, h) * 0.42, ri = R * 0.66, H1 = 0.22, bas = -0.3;
    V.cylindre(ctx, r, 0, 0, R, 0, H1, PIERRE, () => {
      const rel = V.echelle(bas) / V.echelle(H1); // le fond de l'eau, ramené dans le repère (à plat) du dessus de la margelle
      const [wx, wy] = [V.vue.cx + (0 - V.vue.cx) * rel, V.vue.cy + (0 - V.vue.cy) * rel];
      cercle(ctx, 0, 0, R, r); encre(ctx, dr(ctx, 0, 0, R, '#d6d1c6', '#85807a'), 1.6);
      cercle(ctx, 0, 0, ri, r, 0.3); encre(ctx, dl(ctx, -ri, -ri, ri, ri, '#3a3b3c', '#1a1b1c'), 1.2);
      ctx.save(); cercle(ctx, 0, 0, ri, r, 0.2); ctx.clip();
      const rw = ri * 0.88 * rel;
      cercle(ctx, wx, wy, rw, r, 0.3); encre(ctx, dr(ctx, wx, wy, rw, '#4f7f9a', '#0f2230'), 0.8);
      ctx.beginPath(); ctx.arc(wx - rw * 0.3, wy - rw * 0.3, rw * 0.25, 0, 7); ctx.fillStyle = 'rgba(190,225,240,0.35)'; ctx.fill();
      ctx.restore();
      cercle(ctx, 0, 0, ri, r, 0.3); trait(ctx, ENCRE, 1.4);
      for (let i = 0; i < 10; i++) { const a = (i / 10) * 7 + 0.3; ctx.beginPath(); ctx.moveTo(Math.cos(a) * ri * 1.05, Math.sin(a) * ri * 1.05); ctx.lineTo(Math.cos(a) * R * 0.97, Math.sin(a) * R * 0.97); trait(ctx, 'rgba(50,46,40,0.5)', 0.9); }
    });
  },

  fontaine(ctx, w, h, t, o) {
    const { V, r } = preparerObjet(ctx, o), R = Math.min(w, h) * 0.45, ri = R * 0.82, H1 = 0.16;
    V.cylindre(ctx, r, 0, 0, R, 0, H1, MARBRE, () => {
      const rel = V.echelle(H1 - 0.05) / V.echelle(H1), [wx, wy] = [V.vue.cx * (1 - rel), V.vue.cy * (1 - rel)];
      cercle(ctx, 0, 0, R, r); encre(ctx, dr(ctx, 0, 0, R, '#f0ece2', '#9a958a'), 1.5);
      cercle(ctx, 0, 0, ri, r, 0.3); encre(ctx, '#7f7a70', 1);
      ctx.save(); cercle(ctx, 0, 0, ri, r, 0.2); ctx.clip();
      cercle(ctx, wx, wy, ri * 0.95 * rel, r, 0.3); encre(ctx, dr(ctx, wx, wy, ri, '#7fc0dc', '#2d6f93'), 0.8);
      for (const k of [0.45, 0.65, 0.85]) { ctx.beginPath(); ctx.arc(wx, wy, ri * k * rel, 0.3, 1.5); trait(ctx, 'rgba(230,245,255,0.5)', 0.9); }
      ctx.restore();
      cercle(ctx, 0, 0, ri, r, 0.3); trait(ctx, ENCRE, 1.2);
    });
    V.cylindre(ctx, r, 0, 0, R * 0.14, H1 - 0.05, 0.36, MARBRE, () => { cercle(ctx, 0, 0, R * 0.14, r); encre(ctx, dr(ctx, 0, 0, R * 0.14, '#f4f0e6', '#a09b91'), 1); });
    V.cylindre(ctx, r, 0, 0, R * 0.38, 0.36, 0.42, MARBRE, () => {
      cercle(ctx, 0, 0, R * 0.38, r); encre(ctx, dr(ctx, 0, 0, R * 0.38, '#f4f0e6', '#9a958a'), 1.2);
      cercle(ctx, 0, 0, R * 0.3, r); encre(ctx, dr(ctx, 0, 0, R * 0.3, '#9fd2e8', '#3a7ea3'), 0.8);
      for (let i = 0; i < 6; i++) { const a = (i / 6) * 6.28; cercle(ctx, Math.cos(a) * R * 0.1, Math.sin(a) * R * 0.1, 1.4, r, 0.2); encre(ctx, 'rgba(235,248,255,0.85)', 0); }
    });
    const [jx, jy] = V.haut(0, 0, 0.55);
    ctx.beginPath(); ctx.arc(jx, jy + R * 0.2, R * 0.2, Math.PI * 1.1, Math.PI * 1.9); trait(ctx, 'rgba(225,244,255,0.8)', 1.6);
  },

  sarcophage(ctx, w, h, t, o) {
    const { V, r } = preparerObjet(ctx, o), sw = w * 0.76, sh = h - t * 0.12, x = -sw / 2, y = -sh / 2, long = sh >= sw;
    V.prisme(ctx, r, rectPts(x, y, sw, sh), 0, 0.2, PIERRE_SOMBRE, () => {
      chemin(ctx, rectPts(x, y, sw, sh), true, r, 0.4); encre(ctx, dl(ctx, x, y, x + sw, y + sh, '#a8a49a', '#66625a'), 1.4);
    });
    for (const c of COTES) { const F = face(V, x, y, sw, sh, c); traits(ctx, F, 0, 0.2, 3, 'rgba(20,18,14,0.5)', 0.9); bande(ctx, F, 0.05, 0.95, 0.15, 0.2, ton(PIERRE, 0.8), 0.6); }
    const m = t * 0.05;
    V.prisme(ctx, r, rectPts(x + m, y + m, sw - 2 * m, sh - 2 * m), 0.2, 0.3, PIERRE, () => {
      const lx = x + m, ly = y + m, lw = sw - 2 * m, lh = sh - 2 * m;
      chemin(ctx, arrondi(lx, ly, lw, lh, 5), true, r, 0.4); encre(ctx, dl(ctx, lx, ly, lx + lw, ly + lh, '#d6d2c7', '#8a867d'), 1.4);
      chemin(ctx, rectPts(lx + 5, ly + 5, lw - 10, lh - 10), true, r, 0.3); trait(ctx, 'rgba(40,36,30,0.5)', 1);
      // Le gisant : tête du côté du dos de l'objet (−y, ou −x si le sarcophage est couché), mains croisées, croix de pierre.
      const L = long ? lh : lw, E = long ? lw : lh;
      const P = (a, b) => (long ? [b * E, -L / 2 + a * L] : [-L / 2 + a * L, b * E]);
      ctx.beginPath(); ctx.ellipse(...P(0.2, 0), E * 0.16, E * 0.16, 0, 0, 7); encre(ctx, dr(ctx, ...P(0.2, 0), E * 0.16, '#ebe6da', '#9b968b'), 1);
      chemin(ctx, [P(0.3, -0.3), P(0.34, -0.4), P(0.5, -0.4), P(0.62, -0.3), P(0.94, -0.16), P(0.98, 0), P(0.94, 0.16), P(0.62, 0.3), P(0.5, 0.4), P(0.34, 0.4), P(0.3, 0.3)], true, r, 0.3); encre(ctx, dl(ctx, ...P(0.3, -0.3), ...P(0.9, 0.3), '#e1ddd1', '#9d988d'), 1);
      for (const [a0, b0, a1, b1] of [[0.5, -0.3, 0.5, 0.3], [0.4, 0, 0.88, 0]]) {
        ctx.beginPath(); ctx.moveTo(...P(a0, b0)); ctx.lineTo(...P(a1, b1)); trait(ctx, '#5f5b53', 3.4);
        ctx.beginPath(); ctx.moveTo(P(a0, b0)[0] - 0.8, P(a0, b0)[1] - 0.8); ctx.lineTo(P(a1, b1)[0] - 0.8, P(a1, b1)[1] - 0.8); trait(ctx, '#e6e1d5', 1.6);
      }
    });
  },

  // --- Lot 5 : brasero, bougies, tapis, bannière, feu de camp, flaque, rocher, champignons, toile d'araignée, ossements ---

  brasero(ctx, w, h, t, o) {
    // Une vasque de fer sur trois pieds, pleine de braises : la source de lumière la plus forte du mobilier après le feu de camp.
    const { V, r } = preparerObjet(ctx, o), R = Math.min(w, h) * 0.34, hb = 0.13, h1 = 0.28, k = t / 48, T = teinteFlamme(o);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * 6.28 + 0.5;
      ctx.beginPath(); ctx.moveTo(Math.cos(a) * R * 1.2, Math.sin(a) * R * 1.2); ctx.lineTo(...V.haut(Math.cos(a) * R * 0.75, Math.sin(a) * R * 0.75, hb));
      trait(ctx, ENCRE, 4.5 * k); trait(ctx, '#4a423b', 2.5 * k);
    }
    V.ombrePied(ctx, () => { ctx.beginPath(); ctx.arc(0, 0, R * 0.9, 0, 7); });
    V.cylindre(ctx, r, 0, 0, R, hb, h1, FER, () => {
      cercle(ctx, 0, 0, R, r, 0.3); encre(ctx, dr(ctx, 0, 0, R, '#7a736c', '#2a2420'), 1.7);
      cercle(ctx, 0, 0, R * 0.8, r, 0.3); encre(ctx, '#160f0b', 1);
      for (let i = 0; i < 11; i++) {
        const a = i * 2.4, d = (i % 4) * R * 0.17, x = Math.cos(a) * d, y = Math.sin(a) * d, rr = R * (0.16 + r() * 0.08);
        cercle(ctx, x, y, rr, r, 0.3); encre(ctx, dr(ctx, x, y, rr, T.braises[i % 3], T.contourBraise), 0.7);
      }
    });
    if (T.eteint) { feuEteint(ctx, V, 0, 0, h1, R * 0.5); return; }
    lumiereFeu(V, 0, 0, h1, { s: R * 0.8, r: t * 4.4, c: '255,150,60', k: 0.7 }, T);
    flamme(ctx, V, 0, 0, h1, R * 0.7, undefined, T);
  },

  bougies(ctx, w, h, t, o) {
    // Trois bougies sur une soucoupe : des flammes minuscules, une lueur douce.
    const { V, r } = preparerObjet(ctx, o), T = teinteFlamme(o);
    cercle(ctx, 0, 0, t * 0.24, r, 0.3); encre(ctx, dr(ctx, 0, 0, t * 0.24, '#8b7f6f', '#3e362e'), 0.9);
    const cires = [0, 1, 2].map((i) => {
      const a = (i / 3) * 6.28 + 0.6, d = t * 0.1;
      return { x: Math.cos(a) * d, y: Math.sin(a) * d, rr: t * (0.055 + r() * 0.015), hb: 0.06 + r() * 0.05 };
    });
    ordonner(V, cires.map((b) => ({ x: b.x, y: b.y, dessiner: () => {
      V.cylindre(ctx, r, b.x, b.y, b.rr, 0, b.hb, [44, 45, 84], () => { cercle(ctx, b.x, b.y, b.rr, r, 0.15); encre(ctx, dr(ctx, b.x, b.y, b.rr, '#fffaf0', '#d6c69e'), 0.7); });
      if (T.eteint) { // une mèche noircie et un filet de fumée minuscule
        const [mx, my] = V.haut(b.x, b.y, b.hb);
        ctx.beginPath(); ctx.arc(mx, my, Math.max(1, t * 0.018), 0, 7); ctx.fillStyle = '#1c1714'; ctx.fill();
        fumee(ctx, mx, my - t * 0.02, t * 0.22, { largeur: Math.max(0.7, t * 0.014) });
        return;
      }
      lumiereFeu(V, b.x, b.y, b.hb, { s: t * 0.07, r: t * 1.5, c: '255,190,110', k: 0.26, petite: true }, T);
      flamme(ctx, V, b.x, b.y, b.hb, t * 0.06, undefined, T);
    } })));
  },

  tapis(ctx, w, h, t, o) {
    // À plat sur le sol (couche basse, sous la grille et sous les autres objets) : bordure dorée, losanges emboîtés, franges aux deux bouts les plus courts.
    const { r } = preparerObjet(ctx, o), tw = w - t * 0.2, th = h - t * 0.2, x = -tw / 2, y = -th / 2, long = tw >= th, k = t / 48;
    ctx.beginPath();
    for (let u = t * 0.05; u < (long ? th : tw) - t * 0.03; u += t * 0.065) {
      if (long) { ctx.moveTo(x - 4 * k, y + u); ctx.lineTo(x, y + u); ctx.moveTo(x + tw, y + u); ctx.lineTo(x + tw + 4 * k, y + u); }
      else { ctx.moveTo(x + u, y - 4 * k); ctx.lineTo(x + u, y); ctx.moveTo(x + u, y + th); ctx.lineTo(x + u, y + th + 4 * k); }
    }
    trait(ctx, '#e6d7b0', 1);
    chemin(ctx, rectPts(x, y, tw, th), true, r, 0.4); encre(ctx, dl(ctx, x, y, x + tw, y + th, '#9b302a', '#5f1918'), 1.6, true);
    chemin(ctx, rectPts(x + 5 * k, y + 5 * k, tw - 10 * k, th - 10 * k), true, r, 0.3); trait(ctx, '#d8b257', 3 * k);
    chemin(ctx, rectPts(x + 10 * k, y + 10 * k, tw - 20 * k, th - 20 * k), true, r, 0.3); trait(ctx, '#3a0f0e', 1.2);
    ctx.beginPath();                                                   // des perles le long des deux grands côtés
    if (long) for (let u = x + 14 * k; u < x + tw - 12 * k; u += 9 * k) { ctx.moveTo(u + 1.3, y + 5 * k); ctx.arc(u, y + 5 * k, 1.3, 0, 7); ctx.moveTo(u + 1.3, y + th - 5 * k); ctx.arc(u, y + th - 5 * k, 1.3, 0, 7); }
    else for (let u = y + 14 * k; u < y + th - 12 * k; u += 9 * k) { ctx.moveTo(x + 5 * k + 1.3, u); ctx.arc(x + 5 * k, u, 1.3, 0, 7); ctx.moveTo(x + tw - 5 * k + 1.3, u); ctx.arc(x + tw - 5 * k, u, 1.3, 0, 7); }
    ctx.fillStyle = '#5a1614'; ctx.fill();
    const a = Math.min(tw / 2 - 16 * k, th * 0.4 * (long ? 1.7 : 1)), b = Math.min(th / 2 - 16 * k, tw * 0.4 * (long ? 1 : 1.7));
    for (const [s, fond] of [[1, '#d8b257'], [0.72, '#26335f'], [0.42, '#d8b257'], [0.2, '#7a1e1c']]) {
      chemin(ctx, [[-a * s, 0], [0, -b * s], [a * s, 0], [0, b * s]], true, r, 0.3); encre(ctx, fond, 1);
    }
    for (const [ox, oy, sx, sy] of [[x + 10 * k, y + 10 * k, 1, 1], [x + tw - 10 * k, y + 10 * k, -1, 1], [x + 10 * k, y + th - 10 * k, 1, -1], [x + tw - 10 * k, y + th - 10 * k, -1, -1]]) {
      chemin(ctx, [[ox, oy], [ox + sx * 14 * k, oy], [ox, oy + sy * 14 * k]], true, r, 0.2); encre(ctx, '#d8b257', 0.9);   // les écoinçons
    }
  },

  banniere(ctx, w, h, t, o) {
    // Accrochée à la face du mur, derrière la case (−y), comme la torche. Sans relief le mur n'a pas de face : on la voit du dessus, pendue vers l'avant.
    const { V, r } = preparerObjet(ctx, o, true);
    if (!V.KP) return vectoriel.objets.banniere(ctx, w, h, t, o);
    const yMur = -h / 2, F = face(V, -w / 2, yMur, w, h, 'nord'), u0 = 0.2, u1 = 0.8, um = 0.5;
    const [fond, ombre] = [['#a5302a', '#5b1513'], ['#2f4f9a', '#17274f'], ['#3f7a3a', '#1f3d1c']][(r() * 3) | 0];
    const pts = [F.P(u0, 0.92), F.P(u1, 0.92), F.P(u1, 0.14), F.P(um, 0.3), F.P(u0, 0.14)];
    chemin(ctx, pts, true, r, 0.3); encre(ctx, dl(ctx, pts[0][0], pts[0][1], pts[0][0], pts[2][1], fond, ombre), 1.3, true);
    const c = centre(pts);
    chemin(ctx, pts.map(([x, y]) => [x + (c[0] - x) * 0.2, y + (c[1] - y) * 0.2]), true, r, 0.2); trait(ctx, '#d8b257', 1.1);
    const [ex, ey] = F.P(um, 0.6); cercle(ctx, ex, ey, t * 0.065, r, 0.2); encre(ctx, '#d8b257', 0.8);
    const [ax, ay] = F.P(u0 - 0.04, 0.95), [bx, by] = F.P(u1 + 0.04, 0.95);
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); trait(ctx, ENCRE, 3); trait(ctx, '#8a5a2a', 1.6);
  },

  feudecamp(ctx, w, h, t, o) {
    // Un cercle de pierres, des bûches en étoile, des cendres et une grande flamme : la plus forte lumière du mobilier.
    const { V, r } = preparerObjet(ctx, o), s = Math.min(w, h), k = t / 48, T = teinteFlamme(o);
    cercle(ctx, 0, 0, s * 0.4, r, 1); ctx.fillStyle = 'rgba(30,22,16,0.75)'; ctx.fill();
    V.auNiveau(ctx, 0.04, () => {
      for (const a of [0.3, 1.9, 3.6]) {
        const lx = Math.cos(a) * s * 0.28, ly = Math.sin(a) * s * 0.28;
        ctx.beginPath(); ctx.moveTo(-lx, -ly); ctx.lineTo(lx, ly); ctx.lineCap = 'round'; trait(ctx, ENCRE, 9 * k); trait(ctx, T.eteint ? '#3a2c24' : '#7a4a24', 6.5 * k); ctx.lineCap = 'butt';
        ctx.beginPath(); ctx.arc(lx, ly, 3 * k, 0, 7); ctx.fillStyle = '#c99a5e'; ctx.fill();   // le bout scié
      }
    });
    const pierres = [];
    for (let i = 0; i < 10; i++) { const a = (i / 10) * 6.28; pierres.push({ x: Math.cos(a) * s * 0.42, y: Math.sin(a) * s * 0.42, R: s * (0.085 + r() * 0.03), c: [35 + ((r() * 8) | 0), 6, 46 + ((r() * 12) | 0)] }); }
    ordonner(V, pierres.map((p) => ({ x: p.x, y: p.y, dessiner: () => rocher(ctx, V, r, p.x, p.y, p.R, 0.07, p.c) })));
    if (T.eteint) { // des cendres sur le lit de braises éteint, un mince filet de fumée
      const [cx, cy] = V.haut(0, 0, 0.05);
      cendres(ctx, cx, cy, s * 0.3, s * 0.22);
      fumee(ctx, cx, cy - s * 0.05, t * 0.9, { largeur: Math.max(1, t * 0.03) });
      return;
    }
    if (T.c) { // les bûches rougeoient de la couleur du feu
      const [cx, cy] = V.haut(0, 0, 0.05), g = ctx.createRadialGradient(cx, cy, 0, cx, cy, s * 0.36);
      g.addColorStop(0, `rgba(${T.halo[0]},0.7)`); g.addColorStop(1, `rgba(${T.halo[1]},0)`);
      ctx.beginPath(); ctx.arc(cx, cy, s * 0.36, 0, 7); ctx.fillStyle = g; ctx.fill();
    }
    lumiereFeu(V, 0, 0, 0.08, { s: t * 0.3, r: t * 5.2, c: '255,150,60', k: 0.85 }, T);
    flamme(ctx, V, 0, 0, 0.08, t * 0.26, undefined, T);
  },

  flaque(ctx, w, h, t, o) {
    // De l'eau à plat : bord irrégulier, dégradé du clair au profond, reflets, sol mouillé autour.
    const { r } = preparerObjet(ctx, o), rx = w * 0.44, ry = h * 0.38, p1 = r() * 6, p2 = r() * 6, pts = [], bord = [];
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * 6.28, f = 0.9 + 0.1 * Math.sin(a * 2 + p1) + 0.06 * Math.sin(a * 3 + p2);
      pts.push([Math.cos(a) * rx * f, Math.sin(a) * ry * f]); bord.push([Math.cos(a) * rx * f * 1.12, Math.sin(a) * ry * f * 1.14]);
    }
    chemin(ctx, bord, true, r, 0.6, 5); ctx.fillStyle = 'rgba(20,24,28,0.22)'; ctx.fill();
    chemin(ctx, pts, true, r, 0.5, 5);
    const g = ctx.createRadialGradient(-rx * 0.3, -ry * 0.3, 2, 0, 0, rx);
    g.addColorStop(0, 'rgba(90,150,180,0.95)'); g.addColorStop(1, 'rgba(25,55,75,0.95)');
    ctx.fillStyle = g; ctx.fill(); trait(ctx, 'rgba(20,32,38,0.8)', 1.4);
    for (const [a, b, l] of [[-0.4, -0.3, 0.5], [0.1, 0.2, 0.35], [-0.1, 0.4, 0.25]]) {
      ctx.beginPath(); ctx.moveTo(a * rx, b * ry); ctx.quadraticCurveTo((a + l / 2) * rx, (b - 0.1) * ry, (a + l) * rx, b * ry); trait(ctx, 'rgba(230,245,255,0.55)', 1.2);
    }
  },

  rocher(ctx, w, h, t, o) {
    // Un bloc de pierre irrégulier, entouré de deux éclats : en volume, il bloque le passage.
    const { V, r } = preparerObjet(ctx, o), s = Math.min(w, h);
    const blocs = [
      { x: (r() - 0.5) * s * 0.1, y: (r() - 0.5) * s * 0.1, R: s * 0.36, h: 0.3 },
      { x: -s * 0.3 + r() * s * 0.08, y: s * 0.28, R: s * 0.15, h: 0.12 },
      { x: s * 0.3, y: -s * 0.25 + r() * s * 0.1, R: s * 0.1, h: 0.08 },
    ];
    ordonner(V, blocs.map((b) => ({ x: b.x, y: b.y, dessiner: () => rocher(ctx, V, r, b.x, b.y, b.R, b.h, [35 + ((r() * 8) | 0), 6, 48 + ((r() * 10) | 0)]) })));
  },

  champignons(ctx, w, h, t, o) {
    // Des champignons qui luisent : chapeaux clairs au bout de pieds minces, halo cyan, aucune flamme.
    const { V, r } = preparerObjet(ctx, o), n = 6, liste = [];
    for (let i = 0; i < n; i++) liste.push({ x: (r() - 0.5) * t * 0.7, y: (r() - 0.5) * t * 0.6, rr: t * (0.06 + r() * 0.07), hc: 0.05 + r() * 0.06 });
    ordonner(V, liste.map((c) => ({ x: c.x, y: c.y, dessiner: () => V.cylindre(ctx, r, c.x, c.y, c.rr * 0.3, 0, c.hc, [45, 30, 80], () => {
      cercle(ctx, c.x, c.y, c.rr, r, 0.2); encre(ctx, dr(ctx, c.x, c.y, c.rr, '#c8fff5', '#1f8c86'), 0.8);
      ctx.beginPath(); ctx.arc(c.x - c.rr * 0.3, c.y - c.rr * 0.3, c.rr * 0.2, 0, 7); ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fill();
    }) })));
    V.lumiere(0, 0, 0, { s: 0, r: t * 2.2, c: '90,230,215', k: 0.55 });
  },

  toile(ctx, w, h, t, o, plan) {
    // Posée à plat dans l'angle de la case le plus proche d'un coin de la salle ; c'est le dessin des toiles semées dans les salles en ruine.
    const { r } = preparerObjet(ctx, o), [sx, sy] = sensDuCoin(o, plan || etat.plan);
    ctx.save();
    ctx.lineCap = 'round';
    DETAILS.toile(ctx, r, sx * w / 2, sy * h / 2, Math.min(w, h), { sx: -sx, sy: -sy });
    ctx.restore();
  },

  ossements(ctx, w, h, t, o) {
    // Le crâne et les os croisés des salles en ruine, avec deux petits éclats autour.
    const { r } = preparerObjet(ctx, o);
    for (let i = 0; i < 2; i++) {
      const a = r() * 6.28, d = t * (0.28 + r() * 0.08), x = Math.cos(a) * d, y = Math.sin(a) * d, b = a + 1 + r();
      ctx.beginPath(); ctx.moveTo(x - Math.cos(b) * t * 0.07, y - Math.sin(b) * t * 0.07); ctx.lineTo(x + Math.cos(b) * t * 0.07, y + Math.sin(b) * t * 0.07);
      ctx.lineCap = 'round'; trait(ctx, ENCRE, Math.max(2, t * 0.06)); trait(ctx, '#e7dfca', Math.max(1.2, t * 0.035)); ctx.lineCap = 'butt';
    }
    ctx.save();
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    DETAILS.os(ctx, r, 0, 0, t);
    ctx.restore();
  },

  inconnu: vectoriel.objets.inconnu,
};

/**
 * Les dessins d'objets du thème. Le réglage « Détails des sols » ('riches' par défaut, `etat.details`) choisit le style : 'riches' passe par
 * `RICHES[type]` (objets-dessines.js) quand l'objet en a une version ; sinon, et toujours en 'sobres', c'est le dessin historique ci-dessus,
 * appelé tel quel (aucun tirage de plus). La table `RICHES` est lue à chaque appel (import circulaire : objets-dessines.js réutilise les briques de ce fichier).
 */
export const objets = Object.fromEntries(Object.keys(sobres).map((type) => [type, (ctx, w, h, t, o, plan) => {
  const riche = etat.details === 'riches' ? RICHES[type] : undefined;
  return riche ? riche(ctx, w, h, t, o, plan) : sobres[type](ctx, w, h, t, o, plan);
}]));
