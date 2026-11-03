/**
 * Petits formats de texte français partagés (pur : ni DOM, ni stockage).
 */

/** « 1 salle », « 3 salles » : le nombre suivi du mot, au pluriel dès 2. */
export const pluriel = (n, un, plusieurs) => `${n} ${n > 1 ? plusieurs : un}`;

/** Un nombre arrondi au dixième, à la virgule française : 2.5 → « 2,5 », 25 → « 25 ». */
export const virgule = (v) => String(Math.round(v * 10) / 10).replace('.', ',');
