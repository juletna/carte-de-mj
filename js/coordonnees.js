/**
 * Coordonnées de cases façon jeu d'échecs : la colonne est une lettre
 * (A = ouest), la rangée un nombre (1 = nord). « C4 » → x = 2, y = 3.
 * Au-delà de la colonne Z : AA, AB… puis BA, BB…
 * Et les libellés qui s'en servent : repère d'une porte sur son mur, texte d'un élément sélectionné.
 */
import { estHorizontal } from './murs.js';
import { nomAffiche } from './parseur/lexique.js';

/** Numéro de colonne (à partir de 0) → lettres : 0 → « A », 26 → « AA ». */
export function lettreColonne(x) {
  return `${x < 26 ? '' : String.fromCharCode(64 + Math.floor(x / 26))}${String.fromCharCode(65 + x % 26)}`;
}

/** Lettres de colonne (minuscules ou majuscules) → numéro : « c » → 2, « aa » → 26. */
export function indexColonne(lettres) {
  const l = lettres.toLowerCase();
  const code = (c) => c.charCodeAt(0) - 97;
  return l.length === 1 ? code(l) : 26 * (code(l[0]) + 1) + code(l[1]);
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

/** Repère d'une porte sur son mur : une lettre de colonne au nord et au sud (« D »), un numéro de rangée à l'est et à l'ouest (« 4 »). */
export function reperePorte(mur, position) {
  return estHorizontal(mur) ? lettreColonne(position) : String(position + 1);
}

/** « porte · mur sud, repère D » : une porte (ou une herse, une arche…) dans une liste ou une bulle. */
export const libelleDePorte = (p) => `${p.type} · mur ${p.mur}, repère ${reperePorte(p.mur, p.position)}`;

/**
 * Texte d'un élément sélectionné ({ genre: 'porte' | 'creature' | 'objet', element }) : « porte · mur sud, repère D »,
 * « Gobelin 2 · C4 », « Coffre · B3 ». `nomCreature(pion)` remplace le nom d'une créature (la régie y met celui de son personnage).
 */
export function libelleSelection({ genre, element: e }, nomCreature = (k) => `${nomAffiche(k.type)} ${k.numero}`) {
  if (genre === 'porte') return libelleDePorte(e);
  if (genre === 'creature') return `${nomCreature(e)} · ${nomCase(e.x, e.y)}`;
  return `${nomAffiche(e.type)} · ${nomCase(e.x, e.y)}`;
}
