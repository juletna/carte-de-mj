/**
 * Outils communs des sols DESSINÉS du thème peint (un fichier par sol dans ce dossier, rassemblés par index.js) : module PUR, testable sous Node.
 *
 * Le style est celui d'un dessin animé, pas d'une photo : chaque sol calcule une HAUTEUR, éclairée du nord-ouest en trois aplats (reflet, ton propre,
 * ombre ; `aplats`), avec des tons clairs et francs, un trait d'encre (ENCRE) autour des formes, et des détails NETS semés (`semis`) plutôt que du bruit.
 * Contrat d'un sol : `fn(X, Y, o, out)` écrit [r, g, b] dans `out`, en pixels virtuels (VIRTUEL par case), PÉRIODIQUE sur PERIODE (bruits de
 * bruit.js aux nombres de mailles entiers, `semis` avec un pas qui divise PERIODE) : la tuile se raccorde à elle-même.
 */
import { h2, lisse } from '../bruit.js';
import { PERIODE } from '../tuile.js';

export const ENCRE = [44, 38, 40];
export const mod = (a, n) => ((a % n) + n) % n;

/** Lumière du nord-ouest, un peu rasante (normalisée). */
export const L = (() => { const x = -0.62, y = -0.62, z = 0.48, n = Math.hypot(x, y, z); return [x / n, y / n, z / n]; })();

/** Palier net mais sans crénelage : 0 sous `seuil − l`, 1 au-dessus de `seuil + l`. */
export const marche = (v, seuil, l = 0.025) => lisse((v - seuil + l) / (2 * l));

/** Mélange la couleur `c` (modifiée sur place) vers `cible`, de la part `t`. */
export const vers = (c, cible, t) => { c[0] += (cible[0] - c[0]) * t; c[1] += (cible[1] - c[1]) * t; c[2] += (cible[2] - c[2]) * t; };

/**
 * Éclairage en aplats d'un champ de hauteur `hauteur(X, Y, o)`. Lit la pente en (X + e, Y) et (X, Y + e), puis appelle `hauteur` en (X, Y) EN DERNIER :
 * un sol qui laisse des informations dans un objet partagé (la dalle trouvée…) les retrouve donc pour le point lui-même.
 * Rend dans `A` : `h` (la hauteur), `pente` (0 à plat, > 0 face à la lumière), `ombre` (0 ou 1, adouci), `k` (facteur de luminosité : 1 + reflet − ombre).
 * `relief` exagère la pente ; `reflet` et `sombre` règlent l'écart des aplats.
 */
export const A = { h: 0, pente: 0, ombre: 0, k: 1 };
export function aplats(hauteur, X, Y, o, relief = 1.6, reflet = 0.16, sombre = 0.2) {
  const e = 0.6;
  const hx = hauteur(X + e, Y, o), hy = hauteur(X, Y + e, o), h = hauteur(X, Y, o);
  let nx = -(hx - h) / e * relief, ny = -(hy - h) / e * relief, nz = 1;
  const nl = Math.hypot(nx, ny, nz);
  nx /= nl; ny /= nl; nz /= nl;
  A.h = h;
  A.pente = nx * L[0] + ny * L[1] + nz * L[2] - L[2];
  A.ombre = marche(-A.pente, 0.07);
  A.k = 1 + reflet * marche(A.pente, 0.07) - sombre * A.ombre;
  return A;
}

/** Hachures d'encre en diagonale (0 entre les traits, 1 sur un trait), au pas de `pas` px virtuels : à mélanger dans l'ombre. */
export const hachure = (X, Y, pas = 2.4) => 1 - marche(Math.abs(mod((X - Y) / pas, 1) - 0.5), 0.36, 0.08);

/**
 * Petit disque semé sur une grille de `pas` px virtuels (un par maille au plus, avec la probabilité `p`) : rend dans `D` la distance relative
 * au centre (`d` < 1 dans le disque), le décalage (`ox`, `oy`) et un hachage de la maille (`h`). Périodique si `pas` divise PERIODE.
 */
export const D = { d: 9, ox: 0, oy: 0, h: 0 };
export function semis(X, Y, pas, p, rMin, rMax, s) {
  const n = PERIODE / pas, gx = Math.floor(X / pas), gy = Math.floor(Y / pas), i = mod(gx, n), j = mod(gy, n);
  D.d = 9; D.h = h2(i, j, s + 3);
  if (h2(i, j, s) > p) return D;
  const r = rMin + (rMax - rMin) * h2(i, j, s + 4), m = Math.min(r, pas / 2);
  const cx = gx * pas + m + (pas - 2 * m) * h2(i, j, s + 1), cy = gy * pas + m + (pas - 2 * m) * h2(i, j, s + 2);
  D.ox = (X - cx) / r; D.oy = (Y - cy) / r; D.d = Math.hypot(D.ox, D.oy);
  return D;
}

/** Un caillou dessiné (dans le disque de `D`, d < 1) de couleur `c` : éclairé du nord-ouest, cerné d'encre. Écrit dans `out`. */
export function caillou(c, out) {
  const s = (D.ox + D.oy) * 0.7, l = 1 + 0.18 * marche(-s, 0.15, 0.1) - 0.16 * marche(s, 0.3, 0.1);
  out[0] = c[0] * l; out[1] = c[1] * l; out[2] = c[2] * l;
  vers(out, ENCRE, 1 - marche(-D.d, -0.78, 0.1));
  return out;
}
