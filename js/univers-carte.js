/**
 * Une carte image avec ses points (DOM) : partagée par la préparation (Donjon), la régie et la vue table (Présentation).
 * Aucune logique d'univers ici : l'appelant donne l'URL de l'image et les points à montrer ; les positions sont des fractions (0 à 1).
 * Tout texte passe par textContent (le nom d'un point vient d'un fichier).
 */
import { h } from './dom.js';

const borne = (v) => Math.min(1, Math.max(0, v));

/**
 * @param {HTMLElement} parent
 * @param {{onPoint?:(id:string)=>void, onVide?:(x:number,y:number)=>void, onDeplace?:(id:string,x:number,y:number)=>void}} rappels
 */
export function creerCarteUnivers(parent, { onPoint, onVide, onDeplace } = {}) {
  const img = h('img', { className: 'univers-image', alt: '', draggable: false });
  const couche = h('div', { className: 'univers-points' });
  const manque = h('p', { className: 'univers-manque', hidden: true });
  const cadre = h('div', { className: 'univers-cadre' }, img, couche, manque);
  parent.append(cadre);
  let etat = { modifiable: false, arme: false };

  const fraction = (e) => {
    const r = img.getBoundingClientRect();
    return r.width && r.height ? [borne((e.clientX - r.left) / r.width), borne((e.clientY - r.top) / r.height)] : [0.5, 0.5];
  };
  cadre.addEventListener('click', (e) => {
    if (!etat.arme || e.target.closest('.univers-point')) return;
    const [x, y] = fraction(e);
    onVide?.(x, y);
  });

  function marqueur(p, modifiable) {
    const b = h('button', { type: 'button', className: ['univers-point', ...(p.classes ?? [])].join(' '), title: p.titre ?? p.nom ?? '' },
      h('span', { className: 'univers-pastille', 'aria-hidden': 'true' }),
      ...(p.nom ? [h('span', { className: 'univers-etiquette', textContent: p.nom })] : []));
    b.setAttribute('aria-label', p.aria ?? p.nom ?? 'Point sans nom');
    if (p.selectionne) b.setAttribute('aria-current', 'true');
    b.style.left = `${p.x * 100}%`;
    b.style.top = `${p.y * 100}%`;
    b.dataset.id = p.id;
    if (!modifiable) { b.addEventListener('click', () => onPoint?.(p.id)); return b; }
    let depart = null;
    b.addEventListener('pointerdown', (e) => {
      if (e.button) return;
      b.setPointerCapture(e.pointerId);
      depart = { x: e.clientX, y: e.clientY, bouge: false };
      e.preventDefault();
    });
    b.addEventListener('pointermove', (e) => {
      if (!depart) return;
      if (!depart.bouge && Math.hypot(e.clientX - depart.x, e.clientY - depart.y) < 5) return;
      depart.bouge = true;
      const [x, y] = fraction(e);
      b.style.left = `${x * 100}%`; b.style.top = `${y * 100}%`;
      depart.fin = [x, y];
    });
    const fin = (e) => {
      if (!depart) return;
      const d = depart; depart = null;
      if (e.type === 'pointercancel') { b.style.left = `${p.x * 100}%`; b.style.top = `${p.y * 100}%`; return; }
      if (d.bouge && d.fin) onDeplace?.(p.id, d.fin[0], d.fin[1]); else onPoint?.(p.id);
    };
    b.addEventListener('pointerup', fin);
    b.addEventListener('pointercancel', fin);
    b.addEventListener('click', (e) => { if (e.detail === 0) onPoint?.(p.id); }); // clavier : Entrée ou Espace
    b.addEventListener('keydown', (e) => {
      const pas = e.shiftKey ? 0.05 : 0.01;
      const d = { ArrowLeft: [-pas, 0], ArrowRight: [pas, 0], ArrowUp: [0, -pas], ArrowDown: [0, pas] }[e.key];
      if (!d) return;
      e.preventDefault();
      onDeplace?.(p.id, borne(p.x + d[0]), borne(p.y + d[1]));
    });
    return b;
  }

  return {
    /**
     * @param {{url:string|null, alt?:string, absente?:string, points:{id:string,x:number,y:number,nom?:string,titre?:string,aria?:string,classes?:string[],selectionne?:boolean}[], modifiable?:boolean, arme?:boolean}} o
     * `url` null : l'image n'existe plus (ou la bibliothèque manque) ; `absente` dit pourquoi, les points restent posés.
     */
    afficher({ url, alt = '', absente = 'Image introuvable.', points, modifiable = false, arme = false }) {
      etat = { modifiable, arme };
      cadre.classList.toggle('arme', arme);
      cadre.classList.toggle('sans-image', !url);
      if (url) { if (img.getAttribute('src') !== url) img.src = url; img.alt = alt; } else img.removeAttribute('src');
      manque.hidden = !!url;
      manque.textContent = absente;
      couche.replaceChildren(...points.map((p) => marqueur(p, modifiable)));
    },
    cadre,
    image: img,
    focaliser(idPoint) { couche.querySelector(`[data-id="${CSS.escape(idPoint)}"]`)?.focus(); },
  };
}
