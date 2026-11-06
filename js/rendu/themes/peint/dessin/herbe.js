/**
 * Herbe DESSINÉE (voir outils.js) : un vert franc et lumineux en grandes plaques de trois tons aux bords nets (la plaque claire est un peu plus
 * haute : sa lisière nord-ouest accroche la lumière, l'autre s'ombre), semé de petits traits en V, de touffes de brins cernées d'encre, de trèfles,
 * de petites fleurs (pétales autour d'un cœur jaune) et de quelques cailloux. Reste lisible par plaques quand elle envahit un dallage en ruine.
 * Exporte aussi `touffe`, que la terre réutilise pour ses rares touffes.
 */
import { fbmp } from '../bruit.js';
import { PERIODE } from '../tuile.js';
import { ENCRE, marche, vers, aplats, semis, D, caillou } from './outils.js';

const BASE = [112, 184, 72], CLAIR = [150, 208, 88], SOMBRE = [78, 150, 62];
const BRIN_CLAIR = [168, 222, 98], BRIN_SOMBRE = [52, 118, 52];
const CAILLOUX = [[176, 170, 156], [160, 160, 164], [190, 176, 150]];
const FLEURS = [[255, 252, 240], [255, 224, 96], [255, 190, 206], [200, 214, 255]];
const C = [0, 0, 0];
const P = { p: 0 };

/** Brins d'une touffe : angle, longueur relative. Base commune en (0, 0.75), pointes vers le haut. */
const ANG = [-0.75, -0.38, 0, 0.38, 0.75], LON = [0.68, 0.92, 1, 0.9, 0.66];

/**
 * Touffe de `n` brins (3 ou 5) dessinée dans le disque semé `D` : brins effilés cernés d'encre, les brins du bord sombres, ceux du milieu clairs.
 * Écrit dans `out` (qui garde sa couleur hors des brins).
 */
export function touffe(out, n, clair, sombre) {
  const dec = n === 3 ? 1 : 0;
  let meilleur = 9, qui = 0;
  for (let i = dec; i < 5 - dec; i++) {
    const a = ANG[i], tx = Math.sin(a) * LON[i] * 1.2, ty = -Math.cos(a) * LON[i] * 1.5;
    const px = D.ox, py = D.oy - 0.75, t = Math.max(0, Math.min(1, (px * tx + py * ty) / (tx * tx + ty * ty)));
    const v = Math.hypot(px - t * tx, py - t * ty) - (0.2 * (1 - t) + 0.02);
    if (v < meilleur) { meilleur = v; qui = i; }
  }
  vers(out, ENCRE, 1 - marche(meilleur, 0.07, 0.04));
  vers(out, qui === 0 || qui === 4 ? sombre : clair, 1 - marche(meilleur, -0.01, 0.04));
}

/** `n` lobes arrondis autour du centre de `D` (pétales, feuilles) : cernés d'encre, de couleur `coul`. Rend la distance au lobe le plus proche. */
function lobes(out, n, rot, anneau, rayon, coul) {
  let m = 9;
  for (let k = 0; k < n; k++) {
    const a = rot + (k * 2 * Math.PI) / n;
    m = Math.min(m, Math.hypot(D.ox - Math.cos(a) * anneau, D.oy - Math.sin(a) * anneau) - rayon);
  }
  vers(out, ENCRE, 1 - marche(m, 0.13, 0.05));
  vers(out, coul, 1 - marche(m, 0, 0.05));
  return m;
}

/** Hauteur de l'herbe : la plaque claire est surélevée, la sombre en creux, avec de très légères bosses. Laisse dans `P` le bruit des plaques. */
function hauteurHerbe(X, Y, o) {
  const fx = X / PERIODE, fy = Y / PERIODE;
  const p = fbmp(fx, fy, 5, o.s, 3);
  P.p = p;
  return 0.3 * marche(p, 0.6, 0.03) - 0.3 * marche(0.4 - p, 0, 0.03) + 0.08 * fbmp(fx, fy, 14, o.s + 2, 2);
}

export function herbe(X, Y, o, out) {
  const { k } = aplats(hauteurHerbe, X, Y, o, 3.2, 0.1, 0.12);
  const p = P.p;
  C[0] = BASE[0]; C[1] = BASE[1]; C[2] = BASE[2];
  vers(C, CLAIR, marche(p, 0.6, 0.03));
  vers(C, SOMBRE, marche(0.4 - p, 0, 0.03));
  C[0] *= k; C[1] *= k; C[2] *= k;

  // Petits traits en V semés partout : des brins isolés, sans contour.
  semis(X, Y, 8, 0.4, 1.6, 2.2, o.s + 10);
  if (D.d < 1) touffe(C, 3, BRIN_CLAIR, BRIN_SOMBRE);
  // Grosses touffes de cinq brins, cernées d'encre.
  semis(X, Y, 24, 0.5, 3.6, 5.6, o.s + 20);
  if (D.d < 1.05) touffe(C, 5, BRIN_CLAIR, BRIN_SOMBRE);
  // Trèfles : trois feuilles rondes et leur nervure claire.
  semis(X, Y, 32, 0.28, 3, 4, o.s + 30);
  if (D.d < 1.05) {
    const rot = D.h * 6.28;
    if (lobes(C, 3, rot, 0.44, 0.4, SOMBRE) < 0) vers(C, BRIN_CLAIR, 0.5 * (1 - marche(Math.abs(Math.sin(rot * 3 - Math.atan2(D.oy, D.ox) * 3)), 0.12, 0.1)));
  }
  // Fleurs : cinq pétales autour d'un cœur jaune cerné d'encre.
  semis(X, Y, 24, 0.14, 3.2, 4.2, o.s + 40);
  if (D.d < 1.05) {
    lobes(C, 5, D.h * 6.28, 0.52, 0.34, FLEURS[Math.floor(D.h * 977) % FLEURS.length]);
    vers(C, ENCRE, 1 - marche(D.d, 0.34, 0.05));
    vers(C, [255, 200, 40], 1 - marche(D.d, 0.24, 0.05));
  }
  // Quelques cailloux gris posés dans l'herbe.
  semis(X, Y, 48, 0.2, 2, 3.4, o.s + 50);
  if (D.d < 1) caillou(CAILLOUX[Math.floor(D.h * CAILLOUX.length)], C);
  out[0] = C[0]; out[1] = C[1]; out[2] = C[2];
}
