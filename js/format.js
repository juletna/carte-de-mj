/**
 * Petits formats de texte français partagés, libellés de boutons communs, et deux petits tests de valeur (pur : ni DOM, ni stockage).
 */

/** Le bouton qui referme un panneau ou une sélection. */
export const LIBELLE_FERMER = '✕ Fermer';

/** Le bouton du micro (dictée) : « Dicter » au repos, « Arrêter » pendant l'écoute. Les pages HTML portent l'état de repos. */
export const libelleMicro = (actif) => (actif ? '⏹ Arrêter' : '🎙️ Dicter');

/** Un objet JSON au sens strict : ni null, ni tableau. */
export const estObjet = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** Minuscules, sans accents ni espaces de bord : « Élémentaire » et « elementaire » se valent. */
export const sansAccents = (texte) => String(texte ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

/** « 1 salle », « 3 salles » : le nombre suivi du mot, au pluriel dès 2. */
export const pluriel = (n, un, plusieurs) => `${n} ${n > 1 ? plusieurs : un}`;

/** Un nombre arrondi au dixième, à la virgule française : 2.5 → « 2,5 », 25 → « 25 ». */
export const virgule = (v) => String(Math.round(v * 10) / 10).replace('.', ',');
