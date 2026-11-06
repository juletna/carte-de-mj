/**
 * La vignette d'un lieu de l'arbre et des listes : l'icône du monde d'abord, puis l'image dès qu'elle est connue.
 * Partagée par le Monde (préparation) et la régie (arbre de lecture), sans tirer les inspecteurs avec elle.
 */
import { h } from '../dom.js';
import { icone } from '../icones.js';
import * as images from '../univers-images.js';

const cleImage = (ref) => `${ref?.source}:${ref?.id}`;
const urlsVignettes = new Map(); // clé d'image → URL, pour que la vignette d'un lieu n'attende qu'une fois

/** La vignette d'un lieu : l'icône du monde d'abord, puis l'image dès qu'elle est connue. `classe` : 'petite' (32 px) ou '' (40 px). */
export function vignetteLieu(ref, classe = 'petite') {
  const boite = h('span', { className: `univers-vignette ${classe}`.trim(), 'aria-hidden': 'true' }, icone('monde'));
  if (!ref) return boite;
  const cle = cleImage(ref);
  const poser = (url) => { if (url) boite.replaceChildren(h('img', { src: url, alt: '', loading: 'lazy', decoding: 'async' })); };
  if (urlsVignettes.has(cle)) poser(urlsVignettes.get(cle));
  else images.urlImage(ref).then((url) => { if (url) { urlsVignettes.set(cle, url); poser(url); } });
  return boite;
}

