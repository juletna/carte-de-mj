/**
 * Dés de la Fiche : tirage, expression « 2d6+1d4+2 », modificateur, signe, bonus de maîtrise.
 * Module PUR (sans DOM, sans état de la fiche), testable sous Node : `tirer(n)` rend un entier de 1 à n, et chaque fonction
 * qui lance des dés en reçoit un en dernier paramètre (le vrai par défaut), pour qu'un test impose les tirages.
 */

/** Un dé à `d` faces, tiré par le navigateur (crypto), de 1 à `d`. */
export const rnd = (d) => { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % d + 1; };
/** Modificateur d'une caractéristique. */
export const mod = (v) => Math.floor((v - 10) / 2);
/** Un nombre avec son signe, le moins typographique : +3, −2, +0. */
export const sg = (n) => (n >= 0 ? '+' : '−') + Math.abs(n);
/** Bonus de maîtrise de la règle, pour un niveau de 1 à 20 */
export const profFor = (l) => 2 + Math.floor((Math.max(1, Math.min(20, l)) - 1) / 4);

/** Dés : "1d8+3", "2d6+1d4+2", "d10-1". `double` double le nombre de dés (coup critique). Rend { tot, det }. */
export function rollExpr(expr, double, tirer = rnd) {
  const terms = String(expr).replace(/\s/g, '').toLowerCase().match(/[+-]?[^+-]+/g) || [];
  let tot = 0; const parts = [];
  for (const t of terms) {
    const sign = t[0] === '-' ? -1 : 1, b = t.replace(/^[+-]/, '');
    const m = b.match(/^(\d*)d(\d+)$/);
    if (m) { let n = (+m[1] || 1) * (double ? 2 : 1), d = +m[2]; const rs = Array.from({ length: n }, () => tirer(d)); tot += sign * rs.reduce((x, y) => x + y, 0); parts.push((sign < 0 ? '− ' : '') + '[' + rs.join(',') + ']'); }
    else if (/^\d+$/.test(b)) { tot += sign * +b; parts.push((sign < 0 ? '− ' : '+ ') + b); }
  }
  return { tot, det: parts.join(' ') || '—' };
}
