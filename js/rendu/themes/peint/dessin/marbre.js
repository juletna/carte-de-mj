/**
 * Marbre en losanges DESSINÉ (voir outils.js) : losanges sur la pointe, crème et gris bleuté en alternance, au biseau éclairé en aplats
 * (hachuré à la plume côté ombre), séparés par un joint d'encre fin. Veines tracées en traits nets et sinueux, petits éclats à lèvre claire,
 * brillances en tirets blancs, et un cabochon incrusté (losange d'encre, de couleur et de reflet) au centre d'un losange sur deux.
 */
import { h2, fbmp } from '../bruit.js';
import { PERIODE, CASES_PAR_TUILE } from '../tuile.js';
import { ENCRE, mod, marche, vers, aplats, hachure, semis, D } from './outils.js';

const N = 5 * (CASES_PAR_TUILE / 4), S = PERIODE / N; // losanges par période (réglés pour une tuile de 4 cases, comme les sols sobres : 0,8 case de côté), et leur diagonale-côté
const CREME = [240, 228, 196], GRIS = [196, 208, 222], INCRUSTE = [110, 128, 176], ROUGE = [178, 92, 80];
const M = { de: 0, fu: 0, fv: 0, alt: 0, id: 0 };
const C = [0, 0, 0];

function cellule(X, Y) {
  const u = (X + Y) / S, v = (Y - X) / S + 100, iu = Math.floor(u), iv = Math.floor(v);
  M.fu = u - iu; M.fv = v - iv; M.alt = (iu + iv) & 1;
  M.id = mod(iu + iv, 2 * N) * 31 + mod(iu - iv, 2 * N);
  M.de = Math.min(M.fu, 1 - M.fu, M.fv, 1 - M.fv) * S * 0.7071;
  return M;
}

/** Hauteur : dalle plate avec un biseau de 5 px, et l'incrustation en léger relief. */
function hauteur(X, Y, o) {
  cellule(X, Y);
  let h = marche(M.de, 3.6, 3);
  if (M.alt) { const c = Math.max(Math.abs(M.fu - 0.5), Math.abs(M.fv - 0.5)); h += 0.25 * marche(0.17 - c, 0, 0.012); }
  return h;
}

export function marbre(X, Y, o, out) {
  const { k, ombre } = aplats(hauteur, X, Y, o, 1.8, 0.14, 0.18);
  const { de, fu, fv, alt, id } = M, fx = X / PERIODE, fy = Y / PERIODE;
  const base = alt ? CREME : GRIS, n = 0.97 + 0.06 * h2(id, 1, o.s);
  C[0] = base[0] * n * k; C[1] = base[1] * n * k; C[2] = base[2] * n * k;
  const c = Math.max(Math.abs(fu - 0.5), Math.abs(fv - 0.5)); // « rayon » depuis le centre de la dalle

  if (!(alt && c < 0.2)) {
    // Le bruit fait onduler les veines sans jamais annuler la pente de la bande (sinon le trait s'élargit en tache).
    const g1 = 3 * fx + 2 * fy + 0.24 * (fbmp(fx, fy, N, o.s + 30, 3) - 0.5), g2 = 2 * fx - 3 * fy + 0.16 * (fbmp(fx, fy, N * 2, o.s + 31, 2) - 0.5);
    const v1 = Math.abs(mod(g1, 1) - 0.5), v2 = Math.abs(mod(g2, 1) - 0.5);
    // Veines : traits nets et sinueux, une grande (bleu-gris) et une fine plus claire.
    vers(C, [120, 128, 150], (1 - marche(v1, 0.014, 0.005)) * 0.8 * marche(de, 4.5, 1.5));
    vers(C, [150, 160, 182], (1 - marche(v2, 0.009, 0.004)) * 0.55 * marche(de, 4.5, 1.5));
  }
  // Hachures d'encre dans l'ombre du biseau.
  vers(C, ENCRE, ombre * hachure(X, Y, 3) * 0.25);
  // Éclats : petit creux d'encre avec sa lèvre claire.
  semis(X, Y, 16, 0.2, 0.9, 1.7, o.s + 60);
  if (D.d < 1.7 && de > 6) {
    if (D.d < 1) vers(C, ENCRE, 0.55 * (1 - marche(D.d, 0.8, 0.2)));
    else if (D.ox + D.oy > 0.4) vers(C, [255, 252, 240], 0.45 * (1 - marche(D.d, 1.5, 0.2)));
  }
  // Brillances : petits tirets blancs en diagonale.
  semis(X, Y, 24, 0.22, 3, 4, o.s + 70);
  if (D.d < 1.6 && Math.abs(D.ox + D.oy) < 0.22 && Math.abs(D.ox - D.oy) < 1.2 && de > 6) vers(C, [255, 255, 255], 0.75);

  // Cabochon incrusté : liseré clair, trait d'encre, couleur franche, reflet.
  if (alt) {
    const col = (id % 2) ? INCRUSTE : ROUGE;
    if (c < 0.17) {
      const t = c / 0.17; // 0 au centre, 1 au bord
      C[0] = col[0] * k; C[1] = col[1] * k; C[2] = col[2] * k;
      vers(C, [255, 255, 255], 0.38 * (1 - marche(Math.abs(c - 0.08), 0.012, 0.01))); // petit losange clair gravé
      vers(C, ENCRE, 1 - marche(0.17 - c, 0.012, 0.006)); // contour
      if ((fu - 0.5) + (fv - 0.5) < -0.01 && t < 0.85 && t > 0.55) vers(C, [255, 255, 255], 0.25);
    } else if (c < 0.2) vers(C, ENCRE, 0.5 * (1 - marche(c, 0.185, 0.012)));
  }
  // Joint d'encre fin, avec un liseré clair juste à l'intérieur côté lumière.
  vers(C, ENCRE, 1 - marche(de, 0.7, 0.3));
  out[0] = C[0]; out[1] = C[1]; out[2] = C[2];
}
