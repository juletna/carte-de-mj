/**
 * Le popover d'un élément de la carte (pion, porte, objet, point) : une bulle `position: fixed` posée à côté du point touché, à droite, sinon à gauche,
 * dessous, dessus, sans sortir de la scène (le placement est celui de Préparer : js/mise-en-page.js, positionBulle). Sous 760 px, la CSS en fait une feuille
 * du bas : le style en ligne est alors retiré. Partagé par regie-selection.js (donjon) et regie-univers.js (monde).
 */
import { telephone } from './telephone.js';
import { positionBulle } from './mise-en-page.js';

/** `ancre` : { x, y } en px écran (le point touché), ou null (la CSS place la bulle en bas à droite). `scene` : l'élément dont la bulle ne sort pas. */
export function placerPopover(zone, ancre, scene) {
  if (telephone() || !ancre) { zone.style.left = zone.style.top = zone.style.right = zone.style.bottom = zone.style.maxHeight = ''; return; }
  const sc = scene.getBoundingClientRect();
  const vue = { g: sc.left, h: sc.top, d: sc.right, b: sc.bottom };
  zone.style.right = zone.style.bottom = 'auto';
  zone.style.maxHeight = `${Math.max(160, vue.b - vue.h - 16)}px`;
  const { x, y } = positionBulle({ g: ancre.x - 14, h: ancre.y - 14, d: ancre.x + 14, b: ancre.y + 14 }, vue, zone.offsetWidth, zone.offsetHeight);
  zone.style.left = `${x}px`; zone.style.top = `${y}px`;
}
