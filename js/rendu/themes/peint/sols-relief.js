/**
 * Sols « en relief » du thème peint (PROTOTYPE, comparé aux sols actuels dans outils/comparaison-sols.html) : module PUR, testable sous Node.
 *
 * Au lieu d'écrire une couleur directement, chaque sol calcule d'abord une HAUTEUR en tout point, puis on l'éclaire : la pente (lue en trois
 * points voisins) donne une normale, et la lumière du nord-ouest fait un côté clair et un côté dans l'ombre à chaque bosse, fissure ou caillou.
 * La couleur, elle, vient d'une petite gamme de tons (pas une seule teinte plus ou moins foncée), et des plaques de saleté ou d'humidité
 * la font virer sur plusieurs cases. Les coordonnées sont DÉFORMÉES par un bruit (domain warping) avant le Voronoï : les dalles ont des bords
 * ébréchés, pas des polygones nets.
 *
 * Même contrat que sols.js : pixels virtuels (VIRTUEL px par case), périodique sur PERIODE, donc la tuile se raccorde à elle-même.
 */
import { h2, vbp, fbmp, voroP, lisse } from './bruit.js';
import { PERIODE, CASES_PAR_TUILE } from './sols.js';

const VIRTUEL = PERIODE / CASES_PAR_TUILE;
const V = { e: 0, id: 0, dx: 0, dy: 0 };

/** Lumière du nord-ouest, un peu rasante (normalisée). */
const L = (() => { const x = -0.62, y = -0.62, z = 0.48, n = Math.hypot(x, y, z); return [x / n, y / n, z / n]; })();

/** Tons de pierre, choisis par dalle : gris chaud, gris froid, beige, gris verdâtre. */
const TONS = [[152, 146, 134], [136, 140, 142], [162, 152, 130], [132, 136, 124], [146, 143, 138]];
const JOINT = [58, 50, 42];
const SALETE = [104, 86, 60];

/**
 * Hauteur de la pierre en (X, Y), de 0 (fond du joint) à environ 1 (dessus d'une dalle). Laisse dans `V` la dalle trouvée (id, distance au joint).
 * `o.n` : nombre de dalles par côté de la période.
 */
function hauteurDalles(X, Y, o) {
  const fx = X / PERIODE, fy = Y / PERIODE;
  // Déformation : les joints ondulent (grande échelle) et s'ébrèchent (petite échelle).
  const wx = fx + 0.022 * (fbmp(fx, fy, 6, o.s + 40) - 0.5) + 0.006 * (vbp(fx, fy, 64, 64, o.s + 41) - 0.5);
  const wy = fy + 0.022 * (fbmp(fx, fy, 6, o.s + 42) - 0.5) + 0.006 * (vbp(fx, fy, 64, 64, o.s + 43) - 0.5);
  voroP(wx, wy, o.n, o.s, V);
  const E = V.e * PERIODE, ih = h2(V.id, 3, o.s);
  // Profil : le joint (E < ~1,2 px) est au fond, puis un arrondi de quelques pixels, puis le dessus de la dalle.
  const bord = lisse((E - 0.7) / (2.2 + 1.8 * ih));
  // Chaque dalle est un peu plus haute ou plus basse que ses voisines, et penche légèrement.
  const assise = 0.78 + 0.22 * h2(V.id, 5, o.s) + (V.dx * (h2(V.id, 6, o.s) - 0.5) + V.dy * (h2(V.id, 7, o.s) - 0.5)) * 1.1;
  // Surface : bosselée (moyenne échelle) et piquée (petite échelle).
  const surface = 0.24 * (fbmp(fx, fy, 24, o.s + (V.id % 9), 3) - 0.5) + 0.07 * (fbmp(fx, fy, 72, o.s + 50, 2) - 0.5);
  let h = bord * (assise + surface);
  // Fissure dans certaines dalles : un sillon étroit qui suit une ligne de bruit.
  if (ih < 0.4) {
    const c = Math.abs(fbmp(wx, wy, 10, 60 + (V.id % 13), 2) - 0.5);
    if (c < 0.012) h -= bord * 0.35 * (1 - c / 0.012);
  }
  // Le joint n'est pas plat : de la terre tassée, des graviers.
  const fond = 0.06 * fbmp(fx, fy, 48, o.s + 70, 2) + 0.08 * lisse((vbp(fx, fy, 120, 120, o.s + 71) - 0.7) / 0.15);
  return Math.max(h, fond * (1 - bord));
}

/** Dalles irrégulières éclairées : la pierre en relief. */
export function dallesRelief(X, Y, o, out) {
  const e = 0.6; // pas (px virtuels) pour lire la pente
  const h = hauteurDalles(X, Y, o);
  const E = V.e * PERIODE, id = V.id, ih = h2(id, 3, o.s);
  const hx = hauteurDalles(X + e, Y, o), hy = hauteurDalles(X, Y + e, o);
  // Normale : la pente est exagérée (o.relief) pour que les reliefs fins se lisent à l'échelle d'une case.
  let nx = -(hx - h) / e * o.relief, ny = -(hy - h) / e * o.relief, nz = 1;
  const nl = Math.hypot(nx, ny, nz);
  nx /= nl; ny /= nl; nz /= nl;
  const diffus = nx * L[0] + ny * L[1] + nz * L[2], plat = L[2];
  // Éclairage : 1 sur une surface plate, plus clair face à la lumière, plus sombre derrière. Les creux reçoivent moins de lumière (occlusion).
  const occlusion = 0.62 + 0.38 * lisse(h / 0.5);
  const k = (1 + (diffus - plat) * 1.15) * occlusion;

  // Couleur de la dalle : un ton de la gamme, mélangé au suivant, puis marbrée.
  const fx = X / PERIODE, fy = Y / PERIODE;
  const t0 = TONS[Math.floor(ih * TONS.length)], t1 = TONS[Math.floor(h2(id, 9, o.s) * TONS.length)];
  const melange = fbmp(fx, fy, 12, o.s + 80, 3);
  let r = t0[0] + (t1[0] - t0[0]) * melange, g = t0[1] + (t1[1] - t0[1]) * melange, b = t0[2] + (t1[2] - t0[2]) * melange;
  const marbrure = 0.84 + 0.2 * fbmp(fx, fy, 40, o.s + 81, 3) + 0.12 * fbmp(fx, fy, 16, o.s + 84, 2);
  r *= marbrure; g *= marbrure; b *= marbrure;
  // Grains minéraux : quelques points clairs et sombres.
  const gm = vbp(fx, fy, 240, 240, o.s + 83);
  if (gm > 0.8) { const t = (gm - 0.8) * 0.6; r *= 1 + t; g *= 1 + t; b *= 1 + t; } else if (gm < 0.15) { const t = (0.15 - gm) * 0.9; r *= 1 - t; g *= 1 - t; b *= 1 - t; }
  // Le joint : terre sombre, qui remonte un peu sur l'arrondi des bords.
  const j = lisse((E - 0.4) / 1.6);
  r = JOINT[0] + (r - JOINT[0]) * j; g = JOINT[1] + (g - JOINT[1]) * j; b = JOINT[2] + (b - JOINT[2]) * j;
  // Plaques de saleté sur plusieurs cases (plus fortes près des joints), qui réchauffent la pierre.
  const sale = lisse((fbmp(fx, fy, 3, o.s + 90, 4) - 0.48) / 0.16) * (0.3 + 0.12 * (1 - j));
  r += (SALETE[0] - r) * sale; g += (SALETE[1] - g) * sale; b += (SALETE[2] - b) * sale;
  // Humidité : des plaques plus sombres et un peu plus froides.
  const humide = lisse((fbmp(fx, fy, 2, o.s + 95, 3) - 0.56) / 0.1) * 0.22;
  r *= 1 - humide * 1.1; g *= 1 - humide; b *= 1 - humide * 0.8;
  // Reflet sur les arêtes bien éclairées : un liseré clair, comme un coup de pinceau.
  const reflet = Math.max(0, diffus - 0.9) * 2.2 * (1 - j * 0.6);
  out[0] = r * k + 255 * reflet * 0.25; out[1] = g * k + 250 * reflet * 0.25; out[2] = b * k + 235 * reflet * 0.25;
}

/** Réglages des sols en relief. */
export const SOLS_RELIEF = {
  pierre: { fn: dallesRelief, o: { n: 9, s: 3, relief: 2 } },
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
