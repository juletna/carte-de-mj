/**
 * Ce que la régie montre à la table quand elle est sur une carte d'univers (module PUR, sans DOM) : un message `univers-etat`
 * sur le même canal que `etat` (protocole-table.js).
 *
 * SÉCURITÉ : le message ne porte que la RÉFÉRENCE de l'image (jamais l'image), le nom du lieu (sauf si le MJ masque les noms), et les
 * points que la table a le droit de voir (voir pointsPourLaTable dans univers-partie.js) : jamais un point caché, ni les notes, ni une
 * destination. À la réception, `lireVueUnivers` relit tout champ par champ.
 */
import { validerAffichage } from './affichage.js';
import { estObjet } from './format.js';
import { imageValide, LIMITES, MAX_POINTS } from './univers.js';

export const TYPE_UNIVERS = 'univers-etat';
const RE_ID = /^[A-Za-z0-9_-]{1,64}$/;
const fraction = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;

/** @param {{image:object, nom?:string, points:object[]}} vue  le résultat de vueDeLaTable() */
export const messageUnivers = (vue, affichage) => ({ type: TYPE_UNIVERS, vue, affichage });

/**
 * Côté table : relit un message `univers-etat`. Un point mal formé est écarté ; une image invalide fait refuser le message.
 * @returns {{vue:{image:{source:string,id:string}, nom?:string, points:{id:string,x:number,y:number,nom?:string}[]}, affichage:object}|null}
 */
export function lireVueUnivers(m, affichageActuel) {
  if (!estObjet(m) || m.type !== TYPE_UNIVERS || !estObjet(m.vue) || !imageValide(m.vue.image)) return null;
  const points = (Array.isArray(m.vue.points) ? m.vue.points : []).slice(0, MAX_POINTS)
    .filter((p) => estObjet(p) && typeof p.id === 'string' && RE_ID.test(p.id) && fraction(p.x) && fraction(p.y))
    .map((p) => ({ id: p.id, x: p.x, y: p.y, ...(typeof p.nom === 'string' && p.nom ? { nom: p.nom.slice(0, LIMITES.nom) } : {}) }));
  const vue = { image: { source: m.vue.image.source, id: m.vue.image.id }, points };
  if (typeof m.vue.nom === 'string' && m.vue.nom) vue.nom = m.vue.nom.slice(0, LIMITES.nom);
  return { vue, affichage: validerAffichage(m.affichage, affichageActuel) };
}
