/**
 * Parquet de bois DESSINÉ (voir outils.js) : planches de deux cases en rangées décalées, chacune d'un ton chaud franc (blond, miel, noisette,
 * brun roux), éclairées en aplats (bords arrondis : liseré clair au nord-ouest, ombre au sud-est, hachurée à la plume), avec le fil du bois en
 * traits ondulés plus sombres, quelques nœuds aux anneaux d'encre, des rainures d'encre entre les planches et des clous (point d'encre + reflet).
 */
import { h2, vbp } from '../bruit.js';
import { PERIODE } from '../tuile.js';
import { ENCRE, mod, marche, vers, aplats, hachure } from './outils.js';

const LIGNES = 24, LONG = 96; // rangées par période (16 px chacune : une planche = un tiers de case, comme le bois sobre) ; longueur d'une planche (divise PERIODE)
const TONS = [[226, 176, 100], [212, 150, 80], [196, 128, 70], [184, 108, 66], [222, 188, 124]];
const P = { E: 0, bout: 0, yy: 0, xi: 0, id: 0, i: 0, Xp: 0 };
const C = [0, 0, 0];

/** Situe (X, Y) dans sa planche : rangée, identité, position locale et distance au bord (E) dans `P`. */
function planche(X, Y, s) {
  const H = PERIODE / LIGNES, i0 = Math.floor(Y / H), i = mod(i0, LIGNES);
  const Xp = mod(X + h2(i, 0, s) * PERIODE, PERIODE), kk = Math.floor(Xp / LONG);
  P.yy = Y - i0 * H; P.xi = Xp - kk * LONG; P.i = i; P.Xp = Xp;
  P.id = i * (PERIODE / LONG) + kk;
  P.bout = Math.min(P.xi, LONG - P.xi);
  P.E = Math.min(P.yy, H - P.yy, P.bout);
  return P;
}

/** Hauteur : plat au milieu de la planche, arrondi de 3 px vers la rainure. */
function hauteur(X, Y, o) {
  planche(X, Y, o.s);
  return marche(P.E, 2.4, 2.2) * 0.9 + 0.1 * h2(P.id, 8, o.s);
}

export function bois(X, Y, o, out) {
  const { k, ombre } = aplats(hauteur, X, Y, o, 2);
  const H = PERIODE / LIGNES, { E, yy, xi, id, Xp } = P, fx = Xp / PERIODE, fy = Y / PERIODE;
  const t = TONS[Math.floor(h2(id, 1, o.s) * TONS.length)], n = 0.94 + 0.12 * h2(id, 2, o.s);
  C[0] = t[0] * n * k; C[1] = t[1] * n * k; C[2] = t[2] * n * k;

  // Fil du bois : traits ondulés plus sombres, d'écartement propre à la planche.
  const gauchi = (vbp(fx, fy, 8, 36, o.s + 5) - 0.5) * 7 + (vbp(fx, fy, 3, 12, o.s + 6) - 0.5) * 9;
  const pas = 4.2 + 2.2 * h2(id, 3, o.s);
  const fil = 1 - marche(Math.abs(mod((yy + gauchi) / pas + h2(id, 4, o.s), 1) - 0.5), 0.07, 0.03);
  vers(C, [t[0] * 0.62, t[1] * 0.55, t[2] * 0.5], fil * 0.85 * (0.6 + 0.4 * h2(id, 9, o.s)));
  // Un second fil, fin et clair, pour la vie.
  const fil2 = 1 - marche(Math.abs(mod((yy - gauchi * 0.7) / (pas * 1.7) + h2(id, 5, o.s), 1) - 0.5), 0.04, 0.02);
  vers(C, [255, 228, 160], fil2 * 0.22);

  // Nœud : quelques anneaux d'encre, étirés dans le sens du fil.
  if (h2(id, 6, o.s) < 0.3) {
    const cx = 22 + 52 * h2(id, 7, o.s), cy = 5 + (H - 10) * h2(id, 10, o.s);
    const d = Math.hypot((xi - cx) / 2.2, yy - cy) / 0.55; // nœud réduit de moitié : la planche est deux fois moins haute
    if (d < 6.5) {
      vers(C, [t[0] * 0.7, t[1] * 0.6, t[2] * 0.55], 0.8 * (1 - marche(d, 5.6, 0.5)));
      const r = 1 - marche(Math.abs(mod(d / 2.1, 1) - 0.5), 0.12, 0.06);
      vers(C, ENCRE, (r * 0.7 + (1 - marche(d, 1.1, 0.35))) * (1 - marche(d, 6, 0.4)) * 0.85);
    }
  }
  // Hachures d'encre dans l'ombre des bords.
  vers(C, ENCRE, ombre * hachure(X, Y, 2.4) * 0.4);
  // Rainure : trait d'encre à la jonction ; liseré clair du côté éclairé (haut et gauche) de chaque planche.
  if (E < 3.2) {
    const clair = (yy < 3.2 || xi < 3.2) && yy > 1.1 && xi > 1.1 && E < 3.2;
    if (clair) vers(C, [255, 232, 170], 0.4 * (1 - marche(E, 2.4, 0.5)) * marche(E, 1.1, 0.4));
    vers(C, ENCRE, 1 - marche(E, 1, 0.4));
  }
  // Clous aux deux bouts : point d'encre et petit reflet.
  const dy = yy - H / 2;
  for (let q = 0; q < 2; q++) {
    const dx = xi - (q ? LONG - 8 : 8), dd = Math.hypot(dx, dy);
    if (dd < 2.6) {
      vers(C, ENCRE, 1 - marche(dd, 1.9, 0.35));
      if (dd < 1.5) vers(C, [235, 232, 224], 0.85 * (1 - marche(Math.hypot(dx + 0.5, dy + 0.5), 0.6, 0.3)));
    }
  }
  out[0] = C[0]; out[1] = C[1]; out[2] = C[2];
}
