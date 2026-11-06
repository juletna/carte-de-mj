/**
 * Bruits du thème « peint » : module PUR (aucun DOM), donc testable sous Node.
 * Tout est déterministe, et les bruits « périodiques » (`vbp`, `fbmp`, `voroP`) se raccordent : leurs indices de réseau sont pris
 * modulo la période, ce qui permet de poser une tuile calculée une fois, côte à côte, sans couture visible (voir sols.js).
 * Les coordonnées des bruits périodiques sont des FRACTIONS de la période, dans [0, 1[ (hors de cet intervalle, le motif se répète).
 */

/** Hachage d'une paire d'entiers (et d'une graine) vers [0, 1[. */
export function h2(i, j, s = 0) {
  let h = (i * 374761393 + j * 668265263 + s * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Hachage d'un texte vers un entier 32 bits non signé (graine d'une salle ou d'un élément). */
export function graineDeTexte(texte) {
  let h = 2166136261;
  for (let i = 0; i < texte.length; i++) h = Math.imul(h ^ texte.charCodeAt(i), 16777619);
  h = Math.imul(h ^ (h >>> 15), 2246822507);
  return (h ^ (h >>> 13)) >>> 0;
}

/** Générateur pseudo-aléatoire (mulberry32) : `alea(graine)()` rend un nombre de [0, 1[ à chaque appel. */
export const alea = (graine) => {
  let g = graine | 0;
  return () => {
    g = (g + 0x6d2b79f5) | 0;
    let t = Math.imul(g ^ (g >>> 15), 1 | g);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** Palier doux de 0 à 1 (zéro en deçà de 0, un au-delà de 1). */
export const lisse = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

const mod = (a, n) => ((a % n) + n) % n;

/** Bruit de valeur lissé, périodique : `nx` × `ny` mailles sur la période. */
export function vbp(x, y, nx, ny, s = 0) {
  const X = x * nx, Y = y * ny, i = Math.floor(X), j = Math.floor(Y), fx = X - i, fy = Y - j;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const i0 = mod(i, nx), i1 = mod(i + 1, nx), j0 = mod(j, ny), j1 = mod(j + 1, ny);
  const a = h2(i0, j0, s), b = h2(i1, j0, s), c = h2(i0, j1, s), d = h2(i1, j1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** Bruit fractal périodique : `n` mailles à la première octave, puis le double, le quadruple… */
export function fbmp(x, y, n, s = 0, octaves = 3) {
  let total = 0, amplitude = 0.5, somme = 0, m = n;
  for (let k = 0; k < octaves; k++) {
    total += amplitude * vbp(x, y, m, m, s + k * 17);
    somme += amplitude;
    amplitude *= 0.5;
    m *= 2;
  }
  return total / somme;
}

/**
 * Diagramme de Voronoï périodique : `n` × `n` cellules sur la période. Rend, dans l'objet `sortie` (réutilisé, pour ne rien allouer
 * par pixel), `e` = la demi-distance au joint le plus proche, `id` = l'identité de la cellule, `dx`/`dy` = le vecteur du centre de la cellule
 * au point. Distances en FRACTIONS de la période.
 */
export function voroP(x, y, n, s, sortie) {
  const gx = Math.floor(x * n), gy = Math.floor(y * n);
  let d1 = 1e9, d2 = 1e9;
  for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
    const i = gx + ox, j = gy + oy, im = mod(i, n), jm = mod(j, n);
    const px = (i + 0.12 + 0.76 * h2(im, jm, s)) / n, py = (j + 0.12 + 0.76 * h2(im, jm, s + 7)) / n;
    const dx = px - x, dy = py - y, dd = dx * dx + dy * dy;
    if (dd < d1) { d2 = d1; d1 = dd; sortie.id = im * 7919 + jm; sortie.dx = -dx; sortie.dy = -dy; } else if (dd < d2) d2 = dd;
  }
  sortie.e = (Math.sqrt(d2) - Math.sqrt(d1)) / 2;
  return sortie;
}
