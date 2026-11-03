/**
 * Placement, la grille de la pièce : cases occupées ou réservées, recherche de la case libre la plus proche,
 * répartition régulière de n éléments sur une ligne, et la gauche et la droite vues depuis l'entrée.
 * Module feuille : aucun import.
 */

// Vu depuis l'entrée en regardant le fond.
export const GAUCHE = { sud: 'ouest', nord: 'est', est: 'sud', ouest: 'nord' };
export const DROITE = { sud: 'est', nord: 'ouest', est: 'nord', ouest: 'sud' };

/**
 * Répartit n éléments de façon symétrique sur une ligne de `long` cases.
 * Ex. : repartir(2, 3) → [0, 2] ; repartir(1, 5) → [2].
 */
export function repartir(n, long) {
  const res = new Array(n);
  for (let i = 0; i < Math.ceil(n / 2); i++) {
    const a = Math.max(0, Math.round((i + 0.5) * long / n - 0.5));
    res[i] = a;
    res[n - 1 - i] = long - 1 - a;
  }
  if (n % 2) res[(n - 1) / 2] = Math.floor((long - 1) / 2);
  return res;
}

/** Comme repartir, mais en laissant de l'espace contre les bords si possible. */
export function repartirInterieur(n, long) {
  if (long < 2 * n + 1) return repartir(n, long);
  const res = new Array(n);
  for (let i = 0; i < Math.ceil(n / 2); i++) {
    const a = Math.round((i + 1) * (long - 1) / (n + 1));
    res[i] = a;
    res[n - 1 - i] = long - 1 - a;
  }
  if (n % 2) res[(n - 1) / 2] = Math.floor((long - 1) / 2);
  return res;
}

/** Grille d'occupation de la pièce. */
export class Grille {
  constructor(W, L) {
    this.W = W; this.L = L;
    this.occupe = new Set();  // cases prises par un objet
    this.reserve = new Set(); // cases devant les portes : à laisser libres si possible
  }
  dedans(x, y, l, h) { return x >= 0 && y >= 0 && x + l <= this.W && y + h <= this.L; }
  libre(x, y, l, h, ignorerReserve) {
    if (!this.dedans(x, y, l, h)) return false;
    for (let i = x; i < x + l; i++) for (let j = y; j < y + h; j++) {
      const k = `${i},${j}`;
      if (this.occupe.has(k) || (!ignorerReserve && this.reserve.has(k))) return false;
    }
    return true;
  }
  occuper(x, y, l, h) {
    for (let i = x; i < x + l; i++) for (let j = y; j < y + h; j++) this.occupe.add(`${i},${j}`);
  }
  /** Case libre la plus proche de (x, y), en spirale. */
  chercher(x, y, l, h, ignorerReserve = false) {
    const max = Math.max(this.W, this.L);
    for (let d = 0; d <= max; d++) {
      const anneau = [];
      for (let i = x - d; i <= x + d; i++) for (let j = y - d; j <= y + d; j++) {
        if (Math.max(Math.abs(i - x), Math.abs(j - y)) === d) anneau.push([i, j]);
      }
      anneau.sort((a, b) => Math.hypot(a[0] - x, a[1] - y) - Math.hypot(b[0] - x, b[1] - y));
      for (const [i, j] of anneau) if (this.libre(i, j, l, h, ignorerReserve)) return [i, j];
    }
    return null;
  }
}
