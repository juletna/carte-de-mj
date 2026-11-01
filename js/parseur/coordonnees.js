/**
 * Coordonnées de cases façon jeu d'échecs : la colonne est une lettre
 * (A = ouest), la rangée un nombre (1 = nord). « C4 » → x = 2, y = 3.
 * Au-delà de la colonne Z : AA, AB…
 */

/** Numéro de colonne (à partir de 0) → lettres : 0 → « A », 26 → « AA ». */
export function lettreColonne(x) {
  return x < 26 ? String.fromCharCode(65 + x) : `A${String.fromCharCode(65 + x - 26)}`;
}

/** Lettres de colonne (minuscules ou majuscules) → numéro : « c » → 2, « aa » → 26. */
export function indexColonne(lettres) {
  const l = lettres.toLowerCase();
  const code = (c) => c.charCodeAt(0) - 97;
  return l.length === 1 ? code(l) : 26 + code(l[1]);
}

/** (2, 3) → « C4 ». */
export function nomCase(x, y) {
  return `${lettreColonne(x)}${y + 1}`;
}

/** « c4 » → [2, 3], ou null si ce n'est pas une case. */
export function lireCase(mot) {
  const m = /^([a-z]{1,2})(\d{1,2})$/.exec(mot || '');
  return m ? [indexColonne(m[1]), Number(m[2]) - 1] : null;
}
