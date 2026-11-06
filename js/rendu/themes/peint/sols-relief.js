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
const JOINT = [96, 84, 74];
const MOUSSE = [118, 150, 84];

/**
 * Hauteur de la pierre en (X, Y), de 0 (fond du joint) à environ 1 (dessus d'une dalle). Laisse dans `V` la dalle trouvée (id, distance au joint).
 * `o.n` : nombre de dalles par côté de la période. Laisse aussi dans `F` la proximité d'une fissure (0 : aucune, 1 : en plein dessus).
 */
const F = { c: 0 };
function hauteurDalles(X, Y, o) {
  const fx = X / PERIODE, fy = Y / PERIODE;
  // Déformation : les joints ondulent (grande échelle) et s'ébrèchent (petite échelle).
  const wx = fx + 0.022 * (fbmp(fx, fy, 6, o.s + 40) - 0.5) + 0.006 * (vbp(fx, fy, 64, 64, o.s + 41) - 0.5);
  const wy = fy + 0.022 * (fbmp(fx, fy, 6, o.s + 42) - 0.5) + 0.006 * (vbp(fx, fy, 64, 64, o.s + 43) - 0.5);
  voroP(wx, wy, o.n, o.s, V);
  const E = V.e * PERIODE, ih = h2(V.id, 3, o.s);
  // Profil : le joint au fond, puis un arrondi de quelques pixels, puis le dessus de la dalle.
  const bord = lisse((E - 0.7) / (2.2 + 1.8 * ih));
  // Chaque dalle est un peu plus haute ou plus basse que ses voisines, et penche légèrement.
  const assise = 0.8 + 0.2 * h2(V.id, 5, o.s) + (V.dx * (h2(V.id, 6, o.s) - 0.5) + V.dy * (h2(V.id, 7, o.s) - 0.5)) * 1.1;
  // Surface à peine bosselée : de grands creux doux, que l'éclairage en aplats découpe en quelques taches.
  const surface = 0.12 * (fbmp(fx, fy, 16, o.s + (V.id % 9), 2) - 0.5);
  let h = bord * (assise + surface);
  // Fissure dans certaines dalles : un sillon étroit qui suit une ligne de bruit (et un trait d'encre, voir dallesRelief).
  F.c = 0;
  if (ih < 0.4) {
    const c = Math.abs(fbmp(wx, wy, 10, 60 + (V.id % 13), 2) - 0.5);
    if (c < 0.014) { F.c = (1 - c / 0.014) * bord; h -= 0.25 * F.c; }
  }
  return h;
}

/** Palier net mais sans crénelage : 0 sous `seuil − l`, 1 au-dessus de `seuil + l`. */
const marche = (v, seuil, l = 0.025) => lisse((v - seuil + l) / (2 * l));

/** Dalles irrégulières éclairées en aplats, cernées d'encre : la pierre « dessin animé » en relief. */
export function dallesRelief(X, Y, o, out) {
  const e = 0.6; // pas (px virtuels) pour lire la pente
  const h = hauteurDalles(X, Y, o);
  const E = V.e * PERIODE, id = V.id, ih = h2(id, 3, o.s), fissure = F.c;
  const hx = hauteurDalles(X + e, Y, o), hy = hauteurDalles(X, Y + e, o);
  let nx = -(hx - h) / e * o.relief, ny = -(hy - h) / e * o.relief, nz = 1;
  const nl = Math.hypot(nx, ny, nz);
  nx /= nl; ny /= nl; nz /= nl;
  const pente = nx * L[0] + ny * L[1] + nz * L[2] - L[2]; // 0 sur une surface plate, > 0 face à la lumière
  // Éclairage en trois aplats, comme au pinceau : reflet, ton propre, ombre (pas de dégradé réaliste).
  const k = 1 + 0.16 * marche(pente, 0.07) - 0.2 * marche(-pente, 0.07);

  // Couleur de la dalle : un ton franc de la gamme, très légèrement nuancé.
  const fx = X / PERIODE, fy = Y / PERIODE;
  const t = TONS[Math.floor(ih * TONS.length)], nuance = 0.95 + 0.1 * fbmp(fx, fy, 10, o.s + 80, 2);
  let r = t[0] * nuance * k, g = t[1] * nuance * k, b = t[2] * nuance * k;
  // Quelques taches de mousse claire, nettes, au bord de certaines dalles.
  const mo = fbmp(fx, fy, 14, o.s + 90, 2) + (1 - lisse(E / 6)) * 0.12;
  const tm = marche(mo, 0.78, 0.02) * 0.8;
  r += (MOUSSE[0] * k - r) * tm; g += (MOUSSE[1] * k - g) * tm; b += (MOUSSE[2] * k - b) * tm;
  // Fond du joint : terre chaude, pas noire.
  const j = marche(E, 1.5, 0.35);
  r = JOINT[0] + (r - JOINT[0]) * j; g = JOINT[1] + (g - JOINT[1]) * j; b = JOINT[2] + (b - JOINT[2]) * j;
  // Contour d'encre : un trait fin qui cerne chaque dalle, et les fissures.
  const encre = Math.max(1 - marche(E, 1.05, 0.3), marche(fissure, 0.5, 0.2));
  out[0] = r + (ENCRE[0] - r) * encre; out[1] = g + (ENCRE[1] - g) * encre; out[2] = b + (ENCRE[2] - b) * encre;
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
