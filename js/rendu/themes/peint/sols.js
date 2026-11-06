/**
 * Sols du thème « peint » : une TUILE RACCORDABLE par sol, calculée pixel par pixel une seule fois puis mise en cache et posée en motif
 * (peint.js). Module PUR (aucun DOM) : `calculerTuile` rend les pixels, le canvas est fabriqué par peint.js.
 *
 * La tuile couvre CASES_PAR_TUILE × CASES_PAR_TUILE cases. Chaque sol est une fonction (X, Y) → couleur, écrite en PIXELS VIRTUELS
 * (VIRTUEL px par case, quelle que soit la résolution réelle de la tuile) et PÉRIODIQUE sur PERIODE px : ses bruits viennent de
 * bruit.js (indices de réseau pris modulo la période), donc la tuile se raccorde à elle-même, sans couture. La lumière vient du nord-ouest.
 *
 * L'AMBIANCE et l'ÉTAT de la salle (lot « ambiance », peint/ambiance.js) sont cuits dans la tuile : `calculerTuile(sol, résolution, {ambiance, etat})`
 * teinte les pixels, et l'usure ajoute des fissures, des joints sombres et de la mousse (usée), puis la terre et l'herbe qui reprennent le dallage
 * selon un masque de bruit, `masqueVert` (en ruine). Le masque est périodique comme le reste : il est aussi lu par les petits détails (details.js).
 *
 * Pour ajouter un sol : une fonction ici, une entrée dans SOLS_PEINTS, et sa couleur de mur dans peint/murs.js.
 */
import { h2, vbp, fbmp, voroP, lisse } from './bruit.js';
import { usureDe, teinterSol } from './ambiance.js';

import { CASES_PAR_TUILE, VIRTUEL, PERIODE } from './tuile.js';

export { CASES_PAR_TUILE, PERIODE };
/** Résolution réelle d'une tuile, en pixels par case : jamais plus que ce plafond (la tuile est ensuite agrandie par le motif). */
export const RESOLUTION_MIN = 16;
export const RESOLUTION_MAX = 64;

/** Les réglages ci-dessous ont été pensés pour une tuile de 4 cases : on multiplie leurs nombres de mailles pour la tuile réelle. */
const K = CASES_PAR_TUILE / 4;
const m = (n) => Math.max(1, Math.round(n * K));

/** Nombre de mailles d'un bruit de fréquence `f` (par pixel virtuel) sur la période : un entier, pour que la tuile se raccorde. */
const nb = (f) => Math.max(1, Math.round(f * PERIODE));
const mod = (a, n) => ((a % n) + n) % n;
/** Grain fin (cellules de 3 px virtuels), périodique. */
const grain = (X, Y, s) => h2(mod(Math.floor(X / 3), PERIODE / 3), mod(Math.floor(Y / 3), PERIODE / 3), s);
const V = { e: 0, id: 0, dx: 0, dy: 0 }; // sortie réutilisée de voroP
const FISSURES = [0.3, 0.5, 0.65]; // part des dalles fissurées, selon l'usure
const JOINT_SOMBRE = [1, 0.72, 0.8];
const MOUSSE = [74, 102, 54];

/** Dalles irrégulières en biseau (Voronoï), joints sombres : pierre, et la roche autour de la salle. */
function dalles(X, Y, o, out) {
  const fx = X / PERIODE, fy = Y / PERIODE;
  voroP(fx, fy, o.n, o.s, V);
  const E = V.e * PERIODE, id = V.id, ih = h2(id, 3, o.s);
  let k = o.contraste * (0.74 + 0.36 * fbmp(fx, fy, m(4), o.s + (id % 7)) + 0.14 * (vbp(fx, fy, nb(0.2), nb(0.2), o.s + 3) - 0.5));
  let nx = V.dx * PERIODE, ny = V.dy * PERIODE;
  const l = Math.hypot(nx, ny) || 1;
  nx /= l; ny /= l;
  const biseau = Math.max(0, 1 - (E - 1.4) / 5);
  k *= 1 + biseau * (-(nx * 0.6 + ny * 0.8) * 0.34 - 0.07);
  if (ih < FISSURES[o.usure | 0]) { const c = Math.abs(vbp(fx, fy, m(12), m(12), 5 + (id % 13)) - 0.5); if (c < 0.016) k *= 0.5 + c * 25; } // fissure (plus nombreuses quand la salle est usée)
  k += (grain(X, Y, 9) - 0.5) * 0.07;
  let r = (o.a[0] + (o.b[0] - o.a[0]) * ih) * k, g = (o.a[1] + (o.b[1] - o.a[1]) * ih) * k, b = (o.a[2] + (o.b[2] - o.a[2]) * ih) * k;
  const j = lisse((E - 0.5) / 1.3);
  if (j < 1) {
    const sombre = JOINT_SOMBRE[o.usure | 0]; // joints plus sombres quand la salle vieillit, et la mousse y prend
    let jr = o.joint[0] * sombre, jg = o.joint[1] * sombre, jb = o.joint[2] * sombre;
    if (o.usure) {
      const mo = fbmp(fx, fy, m(13), o.s + 11), seuil = o.usure === 2 ? 0.52 : 0.58;
      if (mo > seuil) { const t = Math.min(1, (mo - seuil) * 7); jr += (MOUSSE[0] - jr) * t; jg += (MOUSSE[1] - jg) * t; jb += (MOUSSE[2] - jb) * t; }
    }
    r = jr + (r - jr) * j; g = jg + (g - jg) * j; b = jb + (b - jb) * j;
  }
  out[0] = r; out[1] = g; out[2] = b;
}

/** Losanges alternés (damier posé sur la pointe), veinés : marbre. */
function losanges(X, Y, o, out) {
  const fx = X / PERIODE, fy = Y / PERIODE, s = PERIODE / o.m;
  const u = (X + Y) / s, v = (Y - X) / s + 100;
  const iu = Math.floor(u), iv = Math.floor(v), fu = u - iu, fv = v - iv;
  const alt = (iu + iv) & 1, base = alt ? o.a : o.b;
  const ih = h2(mod(iu + iv, 2 * o.m), mod(iu - iv, 2 * o.m), o.s); // périodique : (iu + iv) et (iu − iv) reviennent modulo 2m
  const m1 = Math.min(fu, 1 - fu), m2 = Math.min(fv, 1 - fv), de = Math.min(m1, m2) * s * 0.7071;
  let nx, ny;
  if (m1 < m2) { const sg = fu < 0.5 ? -1 : 1; nx = sg * 0.7071; ny = sg * 0.7071; } else { const sg = fv < 0.5 ? -1 : 1; nx = -sg * 0.7071; ny = sg * 0.7071; }
  let k = 0.88 + 0.1 * ih + 0.22 * (fbmp(fx, fy, m(3), o.s) - 0.5) + 0.07 * (vbp(fx, fy, nb(0.25), nb(0.25), o.s + 1) - 0.5);
  const biseau = Math.max(0, 1 - (de - 1) / 4);
  k *= 1 + biseau * (-(nx * 0.6 + ny * 0.8) * 0.3 - 0.06);
  let r = base[0] * k, g = base[1] * k, b = base[2] * k;
  if (alt) { const cx = Math.abs(fu - 0.5), cy = Math.abs(fv - 0.5); if (cx + cy < 0.16) { r = o.c[0] * k; g = o.c[1] * k; b = o.c[2] * k; } }
  const veine = 1 - lisse(Math.abs(fbmp(fx, fy, m(3), o.s + 30, 4) - 0.5) / 0.022); // veines grises qui traversent les dalles
  const ombre = 1 - 0.28 * veine;
  r *= ombre; g *= ombre; b *= ombre;
  const j = lisse((de - 0.4) / 1), sombre = JOINT_SOMBRE[o.usure | 0];
  out[0] = o.joint[0] * sombre + (r - o.joint[0] * sombre) * j; out[1] = o.joint[1] * sombre + (g - o.joint[1] * sombre) * j; out[2] = o.joint[2] * sombre + (b - o.joint[2] * sombre) * j;
}

/** Planches en rangées décalées, grain du bois, rainures et bouts sombres : bois. */
function planches(X, Y, o, out) {
  const fy = Y / PERIODE, hauteur = PERIODE / o.lignes;
  const i0 = Math.floor(Y / hauteur), yy = Y - i0 * hauteur, i = mod(i0, o.lignes); // la rangée revient modulo la période
  const decal = h2(i, 0, o.s) * PERIODE, Xp = mod(X + decal, PERIODE);
  const longueur = 2 * VIRTUEL, kk = Math.floor(Xp / longueur), xi = Xp - kk * longueur, id = i * (PERIODE / longueur) + kk; // des planches de 2 cases
  const teinte = 0.82 + 0.3 * h2(id, 1, o.s);
  const fil = vbp(Xp / PERIODE, fy, m(5), m(120), o.s + (id % 5)) * 0.6 + vbp(Xp / PERIODE, fy, m(9), m(40), o.s + 9) * 0.4;
  let k = teinte * (0.86 + 0.28 * fil) + (grain(X, Y, 11) - 0.5) * 0.05;
  if (yy < 1.2) k *= 1.18; else if (yy > hauteur - 1.4) k *= 0.6; // rainure : liseré clair en haut, ombre en bas
  const bout = Math.min(xi, longueur - xi);
  if (bout < 1.1) k *= 0.5;
  else if (bout > 5 && bout < 7.5 && Math.abs(yy - hauteur / 2) < 1.4) k *= 0.72; // clou
  const c = o.base;
  out[0] = c[0] * k; out[1] = c[1] * k; out[2] = c[2] * k;
}

/** Terre battue : taches sombres, cailloux clairs. */
function terre(X, Y, o, out) {
  const fx = X / PERIODE, fy = Y / PERIODE;
  const d = fbmp(fx, fy, m(6), 64) * 0.6 + vbp(fx, fy, nb(0.22), nb(0.22), 65) * 0.4;
  let k = 0.72 + 0.5 * d;
  const humide = fbmp(fx, fy, m(2), 71);
  if (humide > 0.58) k *= 1 - Math.min(0.28, (humide - 0.58) * 1.4);
  let r = 104 * k, g = 80 * k, b = 56 * k;
  const gx = Math.floor(X / 6), gy = Math.floor(Y / 6);
  if (h2(mod(gx, PERIODE / 6), mod(gy, PERIODE / 6), 70) > 0.978) { // caillou
    const cx = (gx + 0.5) * 6, cy = (gy + 0.5) * 6, t = lisse(1 - Math.hypot(X - cx, Y - cy) / 2.6);
    const lum = 138 - (Y - cy) * 6 - (X - cx) * 4;
    r += (lum - r) * t; g += (lum * 0.93 - g) * t; b += (lum * 0.82 - b) * t;
  }
  const n = (grain(X, Y, 69) - 0.5) * 10;
  out[0] = r + n; out[1] = g + n; out[2] = b + n;
}

/** Sable : rides légères et grains. */
function sable(X, Y, o, out) {
  const fx = X / PERIODE, fy = Y / PERIODE;
  const ride = Math.sin(2 * Math.PI * (m(6) * fy + 1.3 * fbmp(fx, fy, m(3), 80)));
  const k = 0.93 + 0.14 * fbmp(fx, fy, m(3), 81) + 0.04 * ride + (grain(X, Y, 82) - 0.5) * 0.09;
  const sombre = grain(X + 1, Y + 2, 83) > 0.975 ? 0.82 : 1; // quelques grains sombres
  out[0] = 208 * k * sombre; out[1] = 184 * k * sombre; out[2] = 134 * k * sombre;
}

/** Herbe : brins, plages plus sombres, quelques fleurs. */
function herbe(X, Y, o, out) {
  const fx = X / PERIODE, fy = Y / PERIODE;
  const brin = vbp(fx, fy, nb(0.42), nb(0.1), 66) * 0.55 + vbp(fx, fy, nb(0.13), nb(0.13), 67) * 0.45;
  let k = 1;
  const sombre = fbmp(fx, fy, m(3), 90);
  if (sombre < 0.42) k = 1 - (0.42 - sombre) * 0.9;
  let r = (62 + 74 * brin) * k, g = (104 + 82 * brin) * k, b = (38 + 30 * brin) * k;
  const gx = Math.floor(X / 8), gy = Math.floor(Y / 8);
  if (h2(mod(gx, PERIODE / 8), mod(gy, PERIODE / 8), 91) > 0.985) { // fleur
    const cx = (gx + 0.5) * 8, cy = (gy + 0.5) * 8, t = lisse(1 - Math.hypot(X - cx, Y - cy) / 2);
    const teinte = h2(gx, gy, 92) > 0.5 ? [240, 232, 170] : [236, 238, 226];
    r += (teinte[0] - r) * t; g += (teinte[1] - g) * t; b += (teinte[2] - b) * t;
  }
  const n = (grain(X, Y, 93) - 0.5) * 12;
  out[0] = r + n; out[1] = g + n; out[2] = b + n;
}

/** Glace : bleus profonds, craquelures blanches, reflets en diagonale. */
function glace(X, Y, o, out) {
  const fx = X / PERIODE, fy = Y / PERIODE;
  const k = 0.9 + 0.2 * fbmp(fx, fy, m(3), 100) + 0.03 * Math.sin(2 * Math.PI * m(3) * (fx + fy));
  let r = 196 * k, g = 226 * k, b = 240 * k;
  const profond = fbmp(fx, fy, m(2), 101);
  if (profond > 0.55) { const t = Math.min(0.7, (profond - 0.55) * 3); r += (150 - r) * t; g += (196 - g) * t; b += (224 - b) * t; }
  voroP(fx, fy, m(3), 102, V);
  const E = V.e * PERIODE;
  if (E < 0.7) { r = 238; g = 248; b = 253; } // craquelure claire
  else if (E < 1.5) { const t = (1 - (E - 0.7) / 0.8) * 0.6; r += (120 - r) * t; g += (162 - g) * t; b += (192 - b) * t; } // et son ombre
  const n = (grain(X, Y, 103) - 0.5) * 8;
  out[0] = r + n; out[1] = g + n; out[2] = b + n;
}

/** Les sols du plan (schema.js) et la roche, avec leurs réglages. */
export const SOLS_PEINTS = {
  pierre: { fn: dalles, o: { n: m(5), s: 3, contraste: 1, a: [112, 120, 122], b: [150, 152, 146], joint: [30, 33, 34] } },
  marbre: { fn: losanges, o: { m: m(5), s: 5, a: [226, 222, 210], b: [196, 192, 184], c: [140, 132, 124], joint: [128, 124, 116] } },
  bois: { fn: planches, o: { lignes: m(12), s: 7, base: [140, 98, 58] } },
  terre: { fn: terre, o: {} },
  sable: { fn: sable, o: {} },
  herbe: { fn: herbe, o: {} },
  glace: { fn: glace, o: {} },
  roche: { fn: dalles, o: { n: m(6), s: 13, contraste: 0.95, a: [34, 32, 36], b: [52, 48, 50], joint: [12, 11, 13] } },
};

const OPTIONS_USEES = new Map(); // « sol|usure » → les réglages du sol avec son usure (un objet par couple, pas un par pixel)
const optionsUsees = (nom, def, usure) => {
  const cle = `${nom}|${usure}`;
  if (!OPTIONS_USEES.has(cle)) OPTIONS_USEES.set(cle, { ...def.o, usure });
  return OPTIONS_USEES.get(cle);
};

/** Mélange `out` vers la couleur `c` de la part `t`. */
function vers(out, c, t) { out[0] += (c[0] - out[0]) * t; out[1] += (c[1] - out[1]) * t; out[2] += (c[2] - out[2]) * t; }

/**
 * Le masque de végétation d'une salle en ruine, de 0 à 1 (fractions de la période, périodique) : la mousse gagne dès 0,538, la terre à 0,558, l'herbe à 0,578 (le bruit se tient entre 0,49 et 0,62 : à peu près la moitié de la salle reste dallée).
 * Les petits détails (touffes, details.js) le relisent pour ne planter que dans l'herbe.
 */
export const masqueVert = (fx, fy) => fbmp(fx, fy, 3, 61) * 0.75 + fbmp(fx, fy, 13, 63) * 0.25;
export const SEUIL_MOUSSE = 0.538, SEUIL_TERRE = 0.558, SEUIL_HERBE = 0.578;

/** Le décalage (fractions de la période) du motif d'une salle : deux salles ne se ressemblent pas, et les détails le suivent. */
export const decalageDeTuile = (graine) => [h2(graine & 0xffff, 1, 5), h2(graine & 0xffff, 2, 5)];

/** Salle usée : taches de saleté, mousse par plaques, fissures fines (sur les sols qui n'ont pas déjà leurs dalles). */
function abimer(X, Y, sol, usure, out) {
  const fx = X / PERIODE, fy = Y / PERIODE;
  const sale = fbmp(fx, fy, m(5), 120);
  if (sale > 0.5) { const k = 1 - Math.min(usure === 2 ? 0.22 : 0.15, (sale - 0.5) * 0.9); out[0] *= k; out[1] *= k; out[2] *= k; }
  if (sol === 'pierre' || sol === 'marbre' || sol === 'bois' || sol === 'terre') {
    const mo = fbmp(fx, fy, m(6), 130), seuil = usure === 2 ? 0.58 : 0.65;
    if (mo > seuil) vers(out, MOUSSE, Math.min(0.55, (mo - seuil) * 5) * (0.75 + 0.5 * grain(X, Y, 131)));
  }
  if (sol !== 'pierre') { // la pierre a ses fissures de dalles ; les autres sols en reçoivent de fines
    const zone = vbp(fx, fy, m(2), m(2), 141);
    if (zone > (usure === 2 ? 0.4 : 0.55) && Math.abs(vbp(fx, fy, m(9), m(9), 140) - 0.5) < 0.011) { out[0] *= 0.5; out[1] *= 0.5; out[2] *= 0.5; }
  }
}

/** Salle en ruine : la terre, puis l'herbe, reprennent le sol là où le masque de végétation est fort. */
function reprendre(X, Y, sol, out) {
  if (sol === 'herbe' || sol === 'glace') return;
  const fx = X / PERIODE, fy = Y / PERIODE, mv = masqueVert(fx, fy);
  if (mv < SEUIL_MOUSSE) return;
  if (mv < SEUIL_TERRE) { vers(out, MOUSSE, ((mv - SEUIL_MOUSSE) / (SEUIL_TERRE - SEUIL_MOUSSE)) * 0.6); return; }
  if (sol !== 'terre' && sol !== 'sable') {
    const d = fbmp(fx, fy, m(6), 64) * 0.6 + vbp(fx, fy, nb(0.22), nb(0.22), 65) * 0.4, k = 0.72 + 0.5 * d;
    out[0] = 104 * k; out[1] = 80 * k; out[2] = 56 * k;
  }
  if (mv > SEUIL_HERBE) {
    const brin = vbp(fx, fy, nb(0.42), nb(0.1), 66) * 0.55 + vbp(fx, fy, nb(0.13), nb(0.13), 67) * 0.45, t = lisse((mv - SEUIL_HERBE) / 0.012);
    let gr = 74 + 70 * brin, gg = 112 + 78 * brin, gb = 46 + 34 * brin;
    if (mv < SEUIL_HERBE + 0.008) { gr *= 0.62; gg *= 0.66; gb *= 0.6; } // la lisière de l'herbe est plus sombre
    out[0] += (gr - out[0]) * t; out[1] += (gg - out[1]) * t; out[2] += (gb - out[2]) * t;
  }
  const n = (grain(X, Y, 69) - 0.5) * 10;
  out[0] += n; out[1] += n; out[2] += n;
}

/**
 * Couleur (r, g, b) d'un sol au point virtuel (X, Y) ; périodique sur PERIODE. Sert aux tests et au calcul de la tuile.
 * @param {{ambiance?:string, etat?:string}} [variante]  neutre et neuve : le sol tel quel
 */
export function couleurSol(nom, X, Y, sortie = [0, 0, 0], { ambiance = 'neutre', etat = 'neuve' } = {}) {
  const def = SOLS_PEINTS[nom] || SOLS_PEINTS.pierre, usure = nom === 'roche' ? 0 : usureDe(etat);
  def.fn(X, Y, usure ? optionsUsees(nom, def, usure) : def.o, sortie);
  if (usure) { abimer(X, Y, nom, usure, sortie); if (usure === 2) reprendre(X, Y, nom, sortie); }
  return teinterSol(sortie, ambiance);
}

const borne = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);

/**
 * Résolution (pixels par case) de la tuile pour une case de `t` px CSS et une densité `dpr` : la case réelle, arrondie au multiple de 8
 * (peu de tuiles différentes en cache), bornée pour que la tuile reste calculable en une fraction de seconde.
 */
export function resolutionTuile(t, dpr = 1) {
  const brute = Math.round((t * dpr) / 8) * 8;
  return Math.max(RESOLUTION_MIN, Math.min(RESOLUTION_MAX, brute));
}

/**
 * Clé de cache d'une tuile : le sol, la résolution et la `variante` (ambiance et état de la salle ; lot 4 : elles teintent et abîment le sol).
 * @param {{ambiance?:string, etat?:string}} [variante]
 */
export const cleTuile = (sol, resolution, { ambiance = 'neutre', etat = 'neuve' } = {}) => `${sol}|${resolution}|${ambiance}|${etat}`;

/**
 * Calcule les pixels d'une tuile.
 * @param {{ambiance?:string, etat?:string}} [variante]
 * @returns {{cote:number, data:Uint8ClampedArray}} `cote` px de côté, RGBA opaque
 */
export function calculerTuile(sol, resolution, variante = {}) {
  const cote = CASES_PAR_TUILE * resolution, pas = VIRTUEL / resolution;
  const data = new Uint8ClampedArray(cote * cote * 4), c = [0, 0, 0];
  for (let py = 0; py < cote; py++) for (let px = 0; px < cote; px++) {
    couleurSol(sol, (px + 0.5) * pas, (py + 0.5) * pas, c, variante);
    const i = (py * cote + px) * 4;
    data[i] = borne(c[0]); data[i + 1] = borne(c[1]); data[i + 2] = borne(c[2]); data[i + 3] = 255;
  }
  return { cote, data };
}
