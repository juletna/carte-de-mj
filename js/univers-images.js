/**
 * Accès aux images d'un univers, via la bibliothèque de cartes (js/bibliotheque/index.js, session B) : choisirCarte, urlImage, infosImage.
 * Le module est chargé à la demande, pour que l'univers (et le reste du site) marche aussi tant que la bibliothèque est absente :
 * sans elle, une image reste désignée par sa référence mais ne s'affiche pas, et on ne peut pas en choisir.
 */
import { urlFondNeutre } from './univers-fond.js';

let promesse = null;
const bibliotheque = () => (promesse ??= import('./bibliotheque/index.js').catch(() => null));
const urls = new Map();
const cle = (ref) => `${ref?.source}:${ref?.id}`;

export const bibliothequeDisponible = async () => !!(await bibliotheque())?.choisirCarte;

/** Ouvre le choix d'une carte : la référence choisie, ou null si annulé. Lève une Error en français si la bibliothèque manque. */
export async function choisirCarte(options = {}) {
  const b = await bibliotheque();
  if (!b?.choisirCarte) throw new Error('Le choix de cartes n’est pas disponible dans cette version de l’outil.');
  return b.choisirCarte(options);
}
/** Ce que rend `choisirCarte({ sansImage: true })` quand on prend « Sans image pour l'instant » (une référence d'image n'a jamais cette forme). */
export const SANS_IMAGE = Object.freeze({ sansImage: true });
export const estSansImage = (r) => !!r && r.sansImage === true;
/** L'URL affichable d'une référence (gardée en mémoire le temps de la page), ou null si elle n'existe plus ou si la bibliothèque manque. */
export async function urlImage(ref) {
  if (!ref) return null;
  if (urls.has(cle(ref))) return urls.get(cle(ref));
  const b = await bibliotheque();
  let url = null;
  try { url = (await b?.urlImage?.(ref)) ?? null; } catch { url = null; }
  if (url) urls.set(cle(ref), url);
  return url;
}
/** L'image d'un lieu : celle de la bibliothèque, ou le fond neutre (nommé d'après le lieu) quand il est « à illustrer ». Null seulement si une image désignée a disparu. */
export const urlLieu = (lieu) => (lieu.image ? urlImage(lieu.image) : Promise.resolve(urlFondNeutre(lieu.nom)));
/** Les métadonnées d'une référence (titre, niveau, largeur, hauteur…), ou null. */
export async function infosImage(ref) {
  const b = await bibliotheque();
  try { return (await b?.infosImage?.(ref)) ?? null; } catch { return null; }
}
