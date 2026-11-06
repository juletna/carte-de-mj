/**
 * Sable DESSINÉ (voir outils.js) : un doré clair ridé en bandes nettes (les rides, éclairées en aplats, ont un liseré clair sur la crête et une ombre
 * hachurée dans le creux ; elles s'effacent par endroits), des points de grains clairs et sombres, quelques galets et des coquillages côtelés cernés d'encre.
 */
import { fbmp, vbp } from '../bruit.js';
import { PERIODE } from '../tuile.js';
import { ENCRE, marche, vers, aplats, hachure, semis, D, caillou } from './outils.js';

const BASE = [238, 208, 144], CRETE = [255, 238, 184], CREUX = [214, 174, 110];
const GALETS = [[176, 160, 138], [196, 176, 146], [164, 156, 150]];
const COQUILLAGE = [248, 224, 204], COTE = [206, 156, 130];
const C = [0, 0, 0];
const R = { s: 0, amp: 0 };

/** Hauteur du sable : des rides ondulantes (3 en x, 8 en y sur la période), d'amplitude variable. Laisse dans `R` le sinus de la ride et son amplitude. */
function hauteurSable(X, Y, o) {
  const fx = X / PERIODE, fy = Y / PERIODE;
  const phase = 3 * fx + 8 * fy + 0.55 * (fbmp(fx, fy, 3, o.s, 2) - 0.5);
  const amp = 0.5 + 0.5 * marche(vbp(fx, fy, 3, 3, o.s + 3), 0.4, 0.15);
  R.s = Math.sin(2 * Math.PI * phase);
  R.amp = amp;
  return 0.5 * amp * R.s + 0.06 * fbmp(fx, fy, 14, o.s + 5, 2);
}

export function sable(X, Y, o, out) {
  const { k, ombre } = aplats(hauteurSable, X, Y, o, 2.2, 0.1, 0.16);
  C[0] = BASE[0] * k; C[1] = BASE[1] * k; C[2] = BASE[2] * k;
  // Creux de la ride : ton plus sombre et hachures légères ; crête : liseré clair net.
  vers(C, CREUX, 0.5 * ombre);
  vers(C, ENCRE, ombre * hachure(X, Y, 3.2) * 0.12);
  vers(C, CRETE, 0.85 * marche(R.s * R.amp, 0.55, 0.06));
  // Points de grains, sombres puis clairs.
  semis(X, Y, 4, 0.22, 0.5, 0.9, o.s + 10);
  if (D.d < 1) vers(C, [176, 134, 84], 0.8);
  semis(X, Y, 6, 0.16, 0.6, 1, o.s + 20);
  if (D.d < 1) vers(C, [255, 246, 208], 0.9);
  // Galets cernés d'encre.
  semis(X, Y, 24, 0.22, 1.5, 2.6, o.s + 30);
  if (D.d < 1) caillou(GALETS[Math.floor(D.h * GALETS.length)], C);
  // Coquillages : un éventail de côtes, cerné d'encre.
  semis(X, Y, 48, 0.4, 4, 6, o.s + 40);
  if (D.d < 1) {
    caillou(COQUILLAGE, C);
    if (D.d < 0.8) vers(C, COTE, 0.85 * marche(Math.sin(Math.atan2(D.oy - 0.9, D.ox) * 9), 0.2, 0.15));
  }
  out[0] = C[0]; out[1] = C[1]; out[2] = C[2];
}
