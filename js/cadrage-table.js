/**
 * Les gestes de cadrage de la vue « Table » de la régie (le cadre `?vue=table&apercu=1`) : la molette et le pincer zooment, le glisser décale la carte.
 * Ce module ne décide de rien : il envoie des gestes à la régie (voir protocole-table.js, « Cadrage »), qui garde le zoom.
 * Sans DOM propre : tout passe par l'élément donné et ses écouteurs (la molette est lue avec `facteurMolette`, js/mise-en-page.js).
 */
import { facteurMolette } from './mise-en-page.js';

/**
 * Molette et pincer sur `element` : `surZoom(facteur)`. Le pincer suit l'écart entre deux doigts (tactile) ; la molette se lit sans défiler la page.
 * @returns {() => void} ce qui retire les écouteurs
 */
export function activerZoomGestes(element, { surZoom }) {
  const onWheel = (e) => { e.preventDefault(); surZoom(facteurMolette(e.deltaY)); };
  element.addEventListener('wheel', onWheel, { passive: false });
  const doigts = new Map();
  let ecart = 0;
  const distance = () => { const [a, b] = [...doigts.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
  const bas = (e) => { if (e.pointerType !== 'touch') return; doigts.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (doigts.size === 2) ecart = distance(); };
  const bouge = (e) => {
    if (!doigts.has(e.pointerId)) return;
    doigts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (doigts.size === 2 && ecart > 0) { const d = distance(); if (d > 0) { surZoom(d / ecart); ecart = d; } }
  };
  const haut = (e) => { doigts.delete(e.pointerId); ecart = 0; };
  element.addEventListener('pointerdown', bas, true);
  element.addEventListener('pointermove', bouge, true);
  element.addEventListener('pointerup', haut, true);
  element.addEventListener('pointercancel', haut, true);
  return () => {
    element.removeEventListener('wheel', onWheel);
    element.removeEventListener('pointerdown', bas, true); element.removeEventListener('pointermove', bouge, true);
    element.removeEventListener('pointerup', haut, true); element.removeEventListener('pointercancel', haut, true);
  };
}

/** La position de défilement de `conteneur`, en fractions 0–1 de sa course (0,5 si elle est nulle sur l'axe : rien ne défile). */
export function positionFractions(conteneur) {
  const fraction = (pos, course) => (course > 0 ? Math.max(0, Math.min(1, pos / course)) : 0.5);
  return { x: fraction(conteneur.scrollLeft, conteneur.scrollWidth - conteneur.clientWidth), y: fraction(conteneur.scrollTop, conteneur.scrollHeight - conteneur.clientHeight) };
}
/** Pose la position de défilement de `conteneur` d'après des fractions 0–1 de sa course. */
export function poserPosition(conteneur, { x, y }) {
  conteneur.scrollTo({ left: x * Math.max(0, conteneur.scrollWidth - conteneur.clientWidth), top: y * Math.max(0, conteneur.scrollHeight - conteneur.clientHeight) });
}

/**
 * Le glisser qui décale la carte, sur un conteneur qui défile (la zone de la carte du monde) : un doigt ou une souris posé hors d'un point.
 * `surFin(position)` : la position finale, en fractions, à envoyer à la régie.
 */
export function activerGlisser(conteneur, { surFin, ignorer = () => false }) {
  let prise = null;
  conteneur.addEventListener('pointerdown', (e) => {
    if (e.button || ignorer(e.target) || !(e.pointerType === 'mouse' || e.pointerType === 'touch' || e.pointerType === 'pen')) return;
    prise = { id: e.pointerId, x: e.clientX, y: e.clientY, bouge: false };
  });
  conteneur.addEventListener('pointermove', (e) => {
    if (!prise || e.pointerId !== prise.id) return;
    if (!prise.bouge && Math.hypot(e.clientX - prise.x, e.clientY - prise.y) < 6) return;
    if (!prise.bouge) { prise.bouge = true; conteneur.setPointerCapture?.(e.pointerId); }
    conteneur.scrollBy({ left: prise.x - e.clientX, top: prise.y - e.clientY });
    prise.x = e.clientX; prise.y = e.clientY;
  });
  const fin = (e) => {
    if (!prise || e.pointerId !== prise.id) return;
    const bouge = prise.bouge;
    prise = null;
    if (bouge) surFin(positionFractions(conteneur));
  };
  conteneur.addEventListener('pointerup', fin);
  conteneur.addEventListener('pointercancel', fin);
}
