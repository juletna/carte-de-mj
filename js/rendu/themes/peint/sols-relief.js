/**
 * Sols « en relief » du thème peint (PROTOTYPE, comparé aux sols actuels dans outils/comparaison-sols.html) : module PUR, testable sous Node.
 *
 * Au lieu d'écrire une couleur directement, chaque sol calcule d'abord une HAUTEUR en tout point, puis on l'éclaire : la pente (lue en trois
 * points voisins) donne une normale, et la lumière du nord-ouest fait un côté clair et un côté dans l'ombre à chaque arrondi ou fissure.
 * Le style reste DESSINÉ, pas réaliste : l'éclairage tombe en trois aplats (reflet, ton propre, ombre), chaque dalle a un ton franc et clair
 * d'une petite gamme, un trait d'encre cerne les dalles et les fissures, et le fond des joints est une terre chaude, jamais noire.
 * Les coordonnées sont DÉFORMÉES par un bruit (domain warping) avant le Voronoï : les dalles ont des bords ébréchés, pas des polygones nets.
 *
 * Même contrat que sols.js : pixels virtuels (VIRTUEL px par case), périodique sur PERIODE, donc la tuile se raccorde à elle-même.
 */
import { h2, vbp, fbmp, voroP, lisse } from './bruit.js';
import { PERIODE, CASES_PAR_TUILE } from './sols.js';

const VIRTUEL = PERIODE / CASES_PAR_TUILE;
const V = { e: 0, id: 0, dx: 0, dy: 0 };

/** Lumière du nord-ouest, un peu rasante (normalisée). */
const L = (() => { const x = -0.62, y = -0.62, z = 0.48, n = Math.hypot(x, y, z); return [x / n, y / n, z / n]; })();

/** Tons de pierre, choisis par dalle : clairs et un peu saturés, comme un dessin animé (gris chaud, gris bleu, sable, gris vert, gris rosé). */
const TONS = [[172, 164, 150], [156, 162, 170], [182, 168, 142], [158, 164, 148], [170, 160, 154]];
const ENCRE = [44, 38, 40];
const JOINT = [104, 88, 70];
const GRAVIER = [[168, 156, 138], [146, 140, 132], [184, 170, 146]];
const MOUSSE = [118, 150, 84];
const HERBE = [104, 146, 64];
const mod = (a, n) => ((a % n) + n) % n;

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

/** Palier net mais sans crénelage : 0 sous `seuil − l`, 1 au-dessus de `seuil + l`. */
const marche = (v, seuil, l = 0.025) => lisse((v - seuil + l) / (2 * l));

/**
 * Petit disque semé sur une grille de `pas` px virtuels (un par maille au plus, avec la probabilité `p`) : rend dans `D` la distance relative
 * au centre (`d` < 1 dans le disque), le décalage (`ox`, `oy`) et un hachage de la maille (`h`). Périodique si `pas` divise PERIODE.
 */
const D = { d: 9, ox: 0, oy: 0, h: 0 };
function semis(X, Y, pas, p, rMin, rMax, s) {
  const n = PERIODE / pas, gx = Math.floor(X / pas), gy = Math.floor(Y / pas), i = mod(gx, n), j = mod(gy, n);
  D.d = 9; D.h = h2(i, j, s + 3);
  if (h2(i, j, s) > p) return D;
  const r = rMin + (rMax - rMin) * h2(i, j, s + 4), m = Math.min(r, pas / 2);
  const cx = gx * pas + m + (pas - 2 * m) * h2(i, j, s + 1), cy = gy * pas + m + (pas - 2 * m) * h2(i, j, s + 2);
  D.ox = (X - cx) / r; D.oy = (Y - cy) / r; D.d = Math.hypot(D.ox, D.oy);
  return D;
}

const vers = (c, cible, t) => { c[0] += (cible[0] - c[0]) * t; c[1] += (cible[1] - c[1]) * t; c[2] += (cible[2] - c[2]) * t; };
const C = [0, 0, 0];

/** Dalles irrégulières éclairées en aplats, cernées d'encre, avec leurs détails dessinés : la pierre « dessin animé » en relief. */
export function dallesRelief(X, Y, o, out) {
  const e = 0.6; // pas (px virtuels) pour lire la pente
  const h = hauteurDalles(X, Y, o);
  const E = V.e * PERIODE, id = V.id, ih = h2(id, 3, o.s), fissure = F.c, jw = F.jw;
  const hx = hauteurDalles(X + e, Y, o), hy = hauteurDalles(X, Y + e, o);
  let nx = -(hx - h) / e * o.relief, ny = -(hy - h) / e * o.relief, nz = 1;
  const nl = Math.hypot(nx, ny, nz);
  nx /= nl; ny /= nl; nz /= nl;
  const pente = nx * L[0] + ny * L[1] + nz * L[2] - L[2]; // 0 sur une surface plate, > 0 face à la lumière
  // Éclairage en trois aplats, comme au pinceau : reflet, ton propre, ombre (pas de dégradé réaliste).
  const ombre = marche(-pente, 0.07), k = 1 + 0.16 * marche(pente, 0.07) - 0.2 * ombre;
  const fx = X / PERIODE, fy = Y / PERIODE;

  // Dalle : un ton franc de la gamme, avec des taches d'un ton plus clair et d'un ton plus sombre, aux bords nets.
  const t = TONS[Math.floor(ih * TONS.length)], tache = fbmp(fx, fy, 22, o.s + 80 + (id % 5), 2);
  const nuance = 1 + 0.07 * marche(tache, 0.6, 0.015) - 0.07 * marche(0.4 - tache, 0, 0.015);
  C[0] = t[0] * nuance * k; C[1] = t[1] * nuance * k; C[2] = t[2] * nuance * k;
  // Hachures d'encre dans l'ombre des arrondis, en diagonale, comme un dessin à la plume.
  const hachure = Math.abs(mod((X - Y) / 2.4, 1) - 0.5);
  vers(C, ENCRE, ombre * (1 - marche(hachure, 0.36, 0.08)) * 0.4);
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
  const tm = marche(mo, 0.78, 0.02) * 0.8;
  vers(C, [MOUSSE[0] * k, MOUSSE[1] * k, MOUSSE[2] * k], tm);

  // Joint : terre chaude, semée de gravier cerné d'encre et de quelques brins d'herbe.
  if (E < jw + 0.6) {
    const J = [JOINT[0] * (0.9 + 0.2 * fbmp(fx, fy, 30, o.s + 120, 1)), JOINT[1], JOINT[2]];
    semis(X, Y, 4, 0.7, 1, 1.9, o.s + 130);
    if (D.d < 1) {
      const g = GRAVIER[Math.floor(D.h * GRAVIER.length)], l = 1 + 0.18 * marche(-(D.ox + D.oy) * 0.7, 0.15, 0.1) - 0.16 * marche((D.ox + D.oy) * 0.7, 0.3, 0.1);
      const P = [g[0] * l, g[1] * l, g[2] * l];
      vers(P, ENCRE, 1 - marche(-D.d, -0.78, 0.1));
      J[0] = P[0]; J[1] = P[1]; J[2] = P[2];
    } else if (mo > 0.6) {
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

/** Réglages des sols en relief. */
export const SOLS_RELIEF = {
  pierre: { fn: dallesRelief, o: { n: 9, s: 3, relief: 1.6 } },
};

const borne = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);

/**
 * Pixels d'une tuile en relief (même forme que `calculerTuile` de sols.js).
 * @returns {{cote:number, data:Uint8ClampedArray}}
 */
export function calculerTuileRelief(sol, resolution) {
  const def = SOLS_RELIEF[sol] || SOLS_RELIEF.pierre;
  const cote = CASES_PAR_TUILE * resolution, pas = VIRTUEL / resolution;
  const data = new Uint8ClampedArray(cote * cote * 4), c = [0, 0, 0];
  for (let py = 0; py < cote; py++) for (let px = 0; px < cote; px++) {
    def.fn((px + 0.5) * pas, (py + 0.5) * pas, def.o, c);
    const i = (py * cote + px) * 4;
    data[i] = borne(c[0]); data[i + 1] = borne(c[1]); data[i + 2] = borne(c[2]); data[i + 3] = 255;
  }
  return { cote, data };
}
