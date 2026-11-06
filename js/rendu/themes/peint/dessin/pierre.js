/**
 * Pierre et roche DESSINÉES (voir outils.js) : dalles irrégulières (Voronoï aux coordonnées déformées : bords ébréchés), éclairées en aplats,
 * cernées d'encre, avec taches de deux tons, hachures dans l'ombre, petits trous, rayures, fissures, et des joints de largeur variable semés
 * de gravier et de brins d'herbe. Les tons, le joint, le gravier et la mousse viennent des réglages `o` (index.js) : la roche autour de la salle
 * est la même pierre, en sombre et sans mousse.
 */
import { h2, vbp, fbmp, voroP, lisse } from '../bruit.js';
import { PERIODE } from '../tuile.js';
import { ENCRE, marche, vers, aplats, hachure, semis, D, caillou } from './outils.js';

const MOUSSE = [118, 150, 84];
const HERBE = [104, 146, 64];
const V = { e: 0, id: 0, dx: 0, dy: 0 };
const C = [0, 0, 0];

/**
 * Hauteur de la pierre en (X, Y), de 0 (fond du joint) à environ 1 (dessus d'une dalle). Laisse dans `V` la dalle trouvée (id, distance au
 * joint) et dans `F` la largeur du joint à cet endroit (`jw`, px virtuels) et la proximité d'une fissure (`c` : 0 aucune, 1 en plein dessus).
 * `o.n` : nombre de dalles par côté de la période.
 */
const F = { c: 0, jw: 0 };
function hauteurDalles(X, Y, o) {
  const fx = X / PERIODE, fy = Y / PERIODE;
  // Déformation : les joints ondulent (grande échelle) et s'ébrèchent (petite échelle).
  const wx = fx + 0.022 * (fbmp(fx, fy, 6, o.s + 40) - 0.5) + 0.006 * (vbp(fx, fy, 64, 64, o.s + 41) - 0.5);
  const wy = fy + 0.022 * (fbmp(fx, fy, 6, o.s + 42) - 0.5) + 0.006 * (vbp(fx, fy, 64, 64, o.s + 43) - 0.5);
  voroP(wx, wy, o.n, o.s, V);
  const E = V.e * PERIODE, ih = h2(V.id, 3, o.s);
  // Joint plus ou moins large selon l'endroit : assez pour y voir du gravier et de l'herbe.
  F.jw = 1.1 + 1.7 * lisse((vbp(fx, fy, 10, 10, o.s + 44) - 0.3) / 0.5);
  // Profil : le joint au fond, puis un arrondi de quelques pixels, puis le dessus de la dalle.
  const bord = lisse((E - F.jw) / (2 + 1.6 * ih));
  // Chaque dalle est un peu plus haute ou plus basse que ses voisines, et penche légèrement.
  const assise = 0.8 + 0.2 * h2(V.id, 5, o.s) + (V.dx * (h2(V.id, 6, o.s) - 0.5) + V.dy * (h2(V.id, 7, o.s) - 0.5)) * 1.1;
  // Surface à peine bosselée : de grands creux doux, que l'éclairage en aplats découpe en quelques taches.
  const surface = 0.12 * (fbmp(fx, fy, 16, o.s + (V.id % 9), 2) - 0.5);
  let h = bord * (assise + surface);
  // Fissure dans certaines dalles : un sillon étroit qui suit une ligne de bruit (et un trait d'encre, voir dallesRelief).
  F.c = 0;
  if (ih < 0.45) {
    const c = Math.abs(fbmp(wx, wy, 10, 60 + (V.id % 13), 2) - 0.5);
    if (c < 0.014) { F.c = (1 - c / 0.014) * bord; h -= 0.25 * F.c; }
  }
  return h;
}

/** Dalles irrégulières éclairées en aplats, cernées d'encre, avec leurs détails dessinés : la pierre « dessin animé » en relief. */
export function dalles(X, Y, o, out) {
  const { k, ombre } = aplats(hauteurDalles, X, Y, o, o.relief);
  const E = V.e * PERIODE, id = V.id, ih = h2(id, 3, o.s), fissure = F.c, jw = F.jw;
  const fx = X / PERIODE, fy = Y / PERIODE;

  // Dalle : un ton franc de la gamme, avec des taches d'un ton plus clair et d'un ton plus sombre, aux bords nets.
  const t = o.tons[Math.floor(ih * o.tons.length)], tache = fbmp(fx, fy, 22, o.s + 80 + (id % 5), 2);
  const nuance = 1 + 0.07 * marche(tache, 0.6, 0.015) - 0.07 * marche(0.4 - tache, 0, 0.015);
  C[0] = t[0] * nuance * k; C[1] = t[1] * nuance * k; C[2] = t[2] * nuance * k;
  // Hachures d'encre dans l'ombre des arrondis, en diagonale, comme un dessin à la plume.
  vers(C, ENCRE, ombre * hachure(X, Y) * 0.4);
  // Petits trous : un point d'encre, et sa lèvre claire du côté de la lumière.
  semis(X, Y, 6, 0.16, 0.4, 0.75, o.s + 100);
  if (D.d < 1.7) {
    if (D.d < 1) vers(C, ENCRE, 0.6 * (1 - marche(D.d, 0.85, 0.15)));
    else if (D.ox + D.oy > 0.5) vers(C, [255, 250, 236], 0.3 * (1 - marche(D.d, 1.45, 0.2)));
  }
  // Rayures fines : de courts traits clairs sur quelques dalles.
  if (h2(id, 11, o.s) < 0.5) {
    const ray = Math.abs(fbmp(fx, fy, 30, o.s + 110 + (id % 7), 1) - 0.5);
    if (ray < 0.008 && vbp(fx, fy, 40, 40, o.s + 111) > 0.62) vers(C, [240, 236, 222], 0.35 * (1 - ray / 0.008));
  }
  // Quelques taches de mousse claire, nettes, au bord de certaines dalles.
  const mo = fbmp(fx, fy, 14, o.s + 90, 2) + (1 - lisse(E / 6)) * 0.12;
  const tm = o.mousse ? marche(mo, 0.78, 0.02) * 0.8 : 0;
  vers(C, [MOUSSE[0] * k, MOUSSE[1] * k, MOUSSE[2] * k], tm);

  // Joint : terre chaude, semée de gravier cerné d'encre et de quelques brins d'herbe.
  if (E < jw + 0.6) {
    const J = [o.joint[0] * (0.9 + 0.2 * fbmp(fx, fy, 30, o.s + 120, 1)), o.joint[1], o.joint[2]];
    semis(X, Y, 4, 0.7, 1, 1.9, o.s + 130);
    if (D.d < 1) caillou(o.gravier[Math.floor(D.h * o.gravier.length)], J);
    else if (o.mousse && mo > 0.6) {
      semis(X, Y, 2, 0.5, 1, 1.6, o.s + 140);
      if (Math.abs(D.ox) < 0.22 && D.oy < 0.5 && D.oy > -1) vers(J, HERBE, 0.9);
    }
    // Le joint ne recouvre la dalle que jusqu'à son trait d'encre.
    vers(C, J, 1 - marche(E, jw, 0.2));
  }
  // Contour d'encre : un trait fin qui cerne chaque dalle (au bord du joint), et les fissures.
  const encre = Math.max(1 - marche(Math.abs(E - jw), 0.5, 0.25), marche(fissure, 0.5, 0.2));
  out[0] = C[0] + (ENCRE[0] - C[0]) * encre; out[1] = C[1] + (ENCRE[1] - C[1]) * encre; out[2] = C[2] + (ENCRE[2] - C[2]) * encre;
}

