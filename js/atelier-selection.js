/**
 * La sélection commune de l'atelier (module PUR, sans DOM). Voir docs/conception-atelier.md §2.
 *
 * { type: 'monde'|'lieu'|'point'|'donjon'|'salle'|'porte'|'objet'|'creature'|'pion',
 *   id,        // identifiant stable ; pour porte/objet/creature/pion le DESCRIPTEUR de donjon.js (jamais un id de plan)
 *   contexte } // { monde?, lieu?, donjon?, salle? } : le chemin qui permet de retrouver l'objet
 *
 * `etat` (pour `selectionValide` et `retrouver`) : { univers: univers | liste | { id: univers }, donjons: { id: donjon } }.
 * Un point se retrouve dans le lieu du contexte ; un élément de salle (porte, objet, creature, pion) dans le plan de la salle du contexte.
 */
import { listerMondes } from './atelier-arbre.js';
import { memeDescripteur, retrouverElement } from './donjon.js';

export const TYPES = ['monde', 'lieu', 'point', 'donjon', 'salle', 'porte', 'objet', 'creature', 'pion'];
export const TYPES_ELEMENT = ['porte', 'objet', 'creature', 'pion'];

/** Une sélection bien formée. `contexte` est copié (seulement ses quatre champs). */
export function selection(type, id, contexte = {}) {
  const c = {};
  for (const k of ['monde', 'lieu', 'donjon', 'salle']) if (contexte[k] !== undefined && contexte[k] !== null) c[k] = contexte[k];
  return { type, id, contexte: c };
}

/** Une sélection depuis un descripteur de donjon.js (porte, objet ou creature) dans une salle ; `type` ('pion') si ce n'est pas le genre. */
export const selectionElement = (desc, contexte, type = desc.genre) => selection(type, { ...desc }, contexte);

const estElement = (type) => TYPES_ELEMENT.includes(type);
const memeId = (type, a, b) => (estElement(type) && a && b && typeof a === 'object' && typeof b === 'object' ? memeDescripteur(a, b) : a === b);

/** Deux sélections désignent-elles la même chose ? (`null` n'est égal qu'à `null`.) */
export function meme(a, b) {
  if (!a || !b) return !a && !b;
  if (a.type !== b.type || !memeId(a.type, a.id, b.id)) return false;
  const ca = a.contexte ?? {}, cb = b.contexte ?? {};
  return ['monde', 'lieu', 'donjon', 'salle'].every((k) => (ca[k] ?? null) === (cb[k] ?? null));
}

/**
 * Le parent d'une sélection : porte/objet/creature/pion → salle, salle → donjon, donjon → lieu d'où l'on y va (sinon rien),
 * point → lieu, lieu → monde, monde → null.
 */
export function parent(sel) {
  if (!sel) return null;
  const c = sel.contexte ?? {};
  if (estElement(sel.type)) return c.salle ? selection('salle', c.salle, c) : null;
  switch (sel.type) {
    case 'salle': return c.donjon ? selection('donjon', c.donjon, { ...c, salle: undefined }) : null;
    case 'donjon': return c.lieu ? selection('lieu', c.lieu, { monde: c.monde, lieu: c.lieu }) : null;
    case 'point': return c.lieu ? selection('lieu', c.lieu, { monde: c.monde, lieu: c.lieu }) : null;
    case 'lieu': return c.monde ? selection('monde', c.monde, { monde: c.monde }) : null;
    default: return null;
  }
}

/** Le contexte plus l'identifiant : où l'on se trouve quand on sélectionne `sel` (utile à la route). */
export function position(sel) {
  if (!sel) return {};
  const c = { ...(sel.contexte ?? {}) };
  if (sel.type === 'monde') c.monde = sel.id;
  else if (sel.type === 'lieu') c.lieu = sel.id;
  else if (sel.type === 'donjon') c.donjon = sel.id;
  else if (sel.type === 'salle') c.salle = sel.id;
  return c;
}

const mondeDe = (etat, id) => listerMondes(etat?.univers).find((u) => u.id === id) ?? null;

/**
 * Retrouve l'objet désigné : le monde, le lieu, le point, le donjon, la salle ou l'élément du plan ; null s'il n'existe plus.
 * Un élément de salle rend { genre, liste, index, element } (comme `retrouverElement`).
 */
export function retrouver(sel, etat) {
  if (!sel) return null;
  const c = sel.contexte ?? {};
  if (sel.type === 'monde') return mondeDe(etat, sel.id);
  if (sel.type === 'lieu') return mondeDe(etat, c.monde ?? sel.id)?.lieux?.[sel.id] ?? (c.monde ? null : listerMondes(etat?.univers).map((u) => u.lieux?.[sel.id]).find(Boolean) ?? null);
  if (sel.type === 'point') return mondeDe(etat, c.monde)?.lieux?.[c.lieu]?.points?.find((p) => p.id === sel.id) ?? null;
  const d = etat?.donjons?.[sel.type === 'donjon' ? sel.id : c.donjon];
  if (!d) return null;
  if (sel.type === 'donjon') return d;
  if (sel.type === 'salle') return d.salles?.[sel.id] ?? null;
  if (estElement(sel.type)) {
    const s = d.salles?.[c.salle];
    if (!s) return null;
    const desc = sel.id && typeof sel.id === 'object' ? { ...sel.id, genre: sel.id.genre ?? (sel.type === 'pion' ? 'creature' : sel.type) } : null;
    return desc ? retrouverElement(s.plan, desc) : null;
  }
  return null;
}

/** L'objet désigné existe-t-il encore ? À vérifier à chaque rendu : un objet déplacé ou supprimé n'est plus sélectionné. */
export const selectionValide = (sel, etat) => !!sel && TYPES.includes(sel.type) && retrouver(sel, etat) !== null;
