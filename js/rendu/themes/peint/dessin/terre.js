/**
 * Terre battue DESSINÉE (voir outils.js) : un brun chaud et clair en grandes plaques de trois tons aux bords nets (la plaque claire est surélevée),
 * traversé de sillons de roues éclairés en aplats, de petites craquelures d'encre, de pierres de trois tailles cernées d'encre, de petits trous et
 * de rares touffes d'herbe. Reste lisible par plaques quand elle reprend un dallage en ruine.
 */
import { fbmp, vbp } from '../bruit.js';
import { PERIODE } from '../tuile.js';
import { ENCRE, marche, vers, aplats, hachure, semis, D, caillou } from './outils.js';
import { touffe } from './herbe.js';

const BASE = [184, 136, 88], CLAIR = [208, 162, 108], SOMBRE = [158, 110, 70];
const PIERRES = [[196, 184, 164], [172, 168, 166], [208, 186, 150], [180, 164, 142]];
const C = [0, 0, 0];
const P = { p: 0 };

/** Hauteur de la terre : plaques surélevées ou en creux, sillons étroits (par endroits), légères bosses. Laisse dans `P` le bruit des plaques. */
function hauteurTerre(X, Y, o) {
  const fx = X / PERIODE, fy = Y / PERIODE;
  const p = fbmp(fx, fy, 5, o.s, 3);
  P.p = p;
  const sillon = 1 - marche(Math.abs(fbmp(fx, fy, 4, o.s + 9, 2) - 0.5), 0.028, 0.012);
  const zone = marche(vbp(fx, fy, 3, 3, o.s + 11), 0.5, 0.1);
  return 0.35 * marche(p, 0.58, 0.03) - 0.3 * marche(0.42 - p, 0, 0.03) - 0.55 * sillon * zone + 0.14 * fbmp(fx, fy, 12, o.s + 2, 2);
}

export function terre(X, Y, o, out) {
  const { k, ombre } = aplats(hauteurTerre, X, Y, o, 2.4, 0.14, 0.2);
  const p = P.p, fx = X / PERIODE, fy = Y / PERIODE;
  C[0] = BASE[0]; C[1] = BASE[1]; C[2] = BASE[2];
  vers(C, CLAIR, marche(p, 0.58, 0.03));
  vers(C, SOMBRE, marche(0.42 - p, 0, 0.03));
  C[0] *= k; C[1] *= k; C[2] *= k;
  // Hachures d'encre dans l'ombre des sillons et des plaques.
  vers(C, ENCRE, ombre * hachure(X, Y, 2.4) * 0.3);
  // Petits trous : un point d'encre.
  semis(X, Y, 6, 0.05, 0.5, 0.9, o.s + 60);
  if (D.d < 1) vers(C, ENCRE, 0.55 * (1 - marche(D.d, 0.8, 0.2)));
  // Craquelures : des traits d'encre fins, seulement dans les zones sèches.
  const fis = Math.abs(fbmp(fx, fy, 9, o.s + 20, 2) - 0.5);
  if (fis < 0.008) vers(C, ENCRE, 0.8 * marche(vbp(fx, fy, 4, 4, o.s + 21), 0.55, 0.06) * (1 - marche(fis, 0.004, 0.003)));
  // Rares touffes d'herbe.
  semis(X, Y, 48, 0.2, 4, 5.4, o.s + 70);
  if (D.d < 1.05) touffe(C, 5, [150, 200, 92], [74, 128, 60]);
  // Pierres : petites, moyennes et grosses, cernées d'encre.
  semis(X, Y, 8, 0.025, 1, 1.8, o.s + 30);
  if (D.d < 1) caillou(PIERRES[Math.floor(D.h * PIERRES.length)], C);
  semis(X, Y, 16, 0.06, 2, 3.2, o.s + 40);
  if (D.d < 1) caillou(PIERRES[Math.floor(D.h * PIERRES.length)], C);
  semis(X, Y, 48, 0.14, 3.6, 5.6, o.s + 50);
  if (D.d < 1) caillou(PIERRES[Math.floor(D.h * PIERRES.length)], C);
  out[0] = C[0]; out[1] = C[1]; out[2] = C[2];
}
