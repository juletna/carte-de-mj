/**
 * Ce que la régie montre à la table quand elle est sur une carte d'univers (module PUR, sans DOM) : un message `univers-etat`
 * sur le même canal que `etat` (protocole-table.js).
 *
 * SÉCURITÉ : le message ne porte que la RÉFÉRENCE de l'image (jamais l'image), le nom du lieu (sauf si le MJ masque les noms), sa grille calée (nombres seulement), et les
 * points que la table a le droit de voir (voir pointsPourLaTable dans univers-partie.js) : jamais un point caché, ni les notes, ni une
 * destination. À la réception, `lireVueUnivers` relit tout champ par champ.
 */
import { validerAffichage } from './affichage.js';
import { estObjet } from './format.js';
import { normaliserGrille } from './univers-grille.js';
import { imageValide, LIMITES, MAX_POINTS } from './univers.js';

export const TYPE_UNIVERS = 'univers-etat';
const RE_ID = /^[A-Za-z0-9_-]{1,64}$/;
const fraction = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;

/**
 * Quelle partie de la carte la table montre quand la carte dépasse son écran : `{ x, y }`, deux fractions de 0 à 1 de la course du
 * défilement, dans le repère de la CARTE (0 : bord gauche / haut, 1 : bord droit / bas). Ce repère ne change ni avec la rotation ni
 * avec le miroir de la table : « vers le haut » est toujours le haut de la carte que le MJ a sous les yeux.
 */
export const CENTRE = Object.freeze({ x: 0.5, y: 0.5 });
export const PAS_DEFILEMENT = 0.25;
const borner01 = (v) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.5);
export const bornerDefilement = (d) => ({ x: borner01(d?.x), y: borner01(d?.y) });
/** Décale la vue d'un pas (dx, dy valent -1, 0 ou 1) ; borné à la carte. */
export const decalerDefilement = (d, dx, dy, pas = PAS_DEFILEMENT) => bornerDefilement({ x: borner01(d?.x) + Math.sign(dx || 0) * pas, y: borner01(d?.y) + Math.sign(dy || 0) * pas });
/** Position de défilement en pixels pour une fraction et une course (contenu moins fenêtre, jamais négative). */
export const positionDefilement = (fraction, course) => Math.round(borner01(fraction) * Math.max(0, Number.isFinite(course) ? course : 0));

/** @param {{image:object, nom?:string, points:object[]}} vue  le résultat de vueDeLaTable() ; `defilement` : voir CENTRE */
export const messageUnivers = (vue, affichage, defilement = CENTRE) => ({ type: TYPE_UNIVERS, vue, affichage, defilement: bornerDefilement(defilement) });

/**
 * Côté table : relit un message `univers-etat`. Un point mal formé est écarté ; une image invalide fait refuser le message.
 * @returns {{defilement:{x:number,y:number}, vue:{image:{source:string,id:string}, nom?:string, grille?:{case:number,dx:number,dy:number}, points:{id:string,x:number,y:number,nom?:string}[]}, affichage:object}|null}
 */
export function lireVueUnivers(m, affichageActuel) {
  if (!estObjet(m) || m.type !== TYPE_UNIVERS || !estObjet(m.vue) || !imageValide(m.vue.image)) return null;
  const points = (Array.isArray(m.vue.points) ? m.vue.points : []).slice(0, MAX_POINTS)
    .filter((p) => estObjet(p) && typeof p.id === 'string' && RE_ID.test(p.id) && fraction(p.x) && fraction(p.y))
    .map((p) => ({ id: p.id, x: p.x, y: p.y, ...(typeof p.nom === 'string' && p.nom ? { nom: p.nom.slice(0, LIMITES.nom) } : {}) }));
  const vue = { image: { source: m.vue.image.source, id: m.vue.image.id }, points };
  const grille = normaliserGrille(m.vue.grille);
  if (grille) vue.grille = grille;
  if (typeof m.vue.nom === 'string' && m.vue.nom) vue.nom = m.vue.nom.slice(0, LIMITES.nom);
  return { vue, affichage: validerAffichage(m.affichage, affichageActuel), defilement: bornerDefilement(estObjet(m.defilement) ? m.defilement : CENTRE) };
}
