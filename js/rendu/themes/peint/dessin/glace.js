/**
 * Glace DESSINÉE (voir outils.js) : surface lisse en plaques de deux tons nets (cyan clair et bleu pâle) au léger rebord éclairé en aplats,
 * craquelures en traits d'encre bleu nuit cernés d'un liseré blanc, reflets en bandes diagonales blanches nettes et interrompues,
 * quelques bulles prises dans la glace (anneau bleu, reflet blanc).
 */
import { h2, vbp, fbmp, voroP } from '../bruit.js';
import { PERIODE } from '../tuile.js';
import { mod, marche, vers, aplats, semis, D } from './outils.js';

const NUIT = [40, 78, 128];
const TONS = [[190, 232, 248], [168, 214, 244], [206, 240, 250], [150, 204, 240]];
const V = { e: 0, id: 0, dx: 0, dy: 0 };
const C = [0, 0, 0];
const F = { f: 0 };

/** Hauteur : plaques à peine bombées, séparées par un rebord d'une paire de pixels (et les craquelures en creux). */
function hauteur(X, Y, o) {
  const fx = X / PERIODE, fy = Y / PERIODE;
  voroP(fx + 0.012 * (fbmp(fx, fy, 6, o.s + 40, 2) - 0.5), fy + 0.012 * (fbmp(fx, fy, 6, o.s + 41, 2) - 0.5), 4, o.s, V);
  const E = V.e * PERIODE;
  F.f = Math.abs(fbmp(fx, fy, 5, o.s + 50, 3) - 0.5);
  return marche(E, 2.5, 2.2) * 0.8 + 0.1 * h2(V.id, 3, o.s);
}

export function glace(X, Y, o, out) {
  const { k, ombre } = aplats(hauteur, X, Y, o, 1.6, 0.1, 0.1);
  const E = V.e * PERIODE, id = V.id, fx = X / PERIODE, fy = Y / PERIODE;
  const t = TONS[Math.floor(h2(id, 1, o.s) * TONS.length)];
  C[0] = t[0] * k; C[1] = t[1] * k; C[2] = t[2] * k;
  // Zone plus profonde : une tache de bleu d'aplat net.
  vers(C, [110, 176, 228], 0.5 * marche(fbmp(fx, fy, 3, o.s + 20, 2), 0.58, 0.012));

  // Reflets : bandes diagonales blanches, une large et une fine, coupées par des plages.
  const bande = mod((X + Y) / PERIODE * 3, 1), coupe = marche(vbp(fx, fy, 6, 6, o.s + 60), 0.45, 0.02);
  const r1 = 1 - marche(Math.abs(bande - 0.25), 0.045, 0.01), r2 = 1 - marche(Math.abs(bande - 0.4), 0.014, 0.008);
  vers(C, [255, 255, 255], Math.max(r1, r2) * coupe * 0.8);

  // Bulles : anneau bleu, intérieur plus clair, reflet blanc en haut à gauche.
  semis(X, Y, 16, 0.13, 2, 4.5, o.s + 70);
  if (D.d < 1.25) {
    vers(C, [235, 250, 255], 0.55 * (1 - marche(D.d, 0.8, 0.1)));
    vers(C, NUIT, 0.75 * (1 - marche(Math.abs(D.d - 1), 0.12, 0.08)));
    if (Math.hypot(D.ox + 0.4, D.oy + 0.4) < 0.28) vers(C, [255, 255, 255], 0.95);
  }
  // Craquelures : bords de plaques et fissures sinueuses, traits d'encre bleu nuit cernés de blanc.
  const ligne = Math.min(E / 1.0, F.f / 0.0075);
  vers(C, [248, 253, 255], 0.9 * (1 - marche(ligne, 2.2, 0.5)) * marche(ligne, 0.9, 0.3));
  vers(C, NUIT, 1 - marche(ligne, 0.9, 0.3));
  out[0] = C[0]; out[1] = C[1]; out[2] = C[2];
}
