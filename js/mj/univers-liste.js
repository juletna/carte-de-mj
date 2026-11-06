/**
 * Liste déroulante maison de la bulle d'un point (écran Monde) : un bouton « combobox » qui ouvre une liste (rôle listbox) où chaque
 * option peut porter une vignette (le lieu et son image). Remplace le <select> natif, qui ne sait pas montrer d'image.
 * Clavier : Bas / Haut / Début / Fin déplacent l'option active (le focus reste sur le bouton, `aria-activedescendant`), Entrée ou Espace
 * choisit, Échap ferme sans choisir (et ne ferme pas la bulle), Tab ferme, une lettre saute à la première option qui commence ainsi.
 * Souris et doigt : un clic ouvre, un clic sur une option choisit, un clic ailleurs ferme. La liste est posée en `position: fixed` sous
 * le bouton (au-dessus s'il manque de place) pour ne pas être rognée par le défilement de la bulle. Les règles de touches sont dans
 * js/univers-liste.js (pur).
 *
 * `creerListeDeroulante({ libelle, options, valeur, vide, vignette, surChoix, cle })` :
 *  - `options` : [{ valeur, libelle, desactive?, ajout?, ... }] ; `ajout` marque l'action « + Nouvelle carte… » (jamais « sélectionnée ») ;
 *  - `vignette(option)` : un nœud à placer devant le nom (ou rien) ;
 *  - `surChoix(option)` : appelée au choix ; `cle` : la clé de focus de la bulle (`data-cle` du bouton).
 * Renvoie `{ element, bouton, fermer }`.
 */
import { h } from '../dom.js';
import { icone } from '../icones.js';
import { indexApresTouche, indexParFrappe } from '../univers-liste.js';

let compteur = 0;
const DELAI_FRAPPE = 700;

export function creerListeDeroulante({ libelle, options, valeur = '', vide = 'Choisir…', vignette = null, surChoix, cle = '' }) {
  const id = `univers-combo-${++compteur}`;
  const elus = options.findIndex((o) => !o.ajout && o.valeur === valeur);
  let actif = -1;
  let frappe = '';
  let minuteur = null;

  const nomLibelle = h('span', { id: `${id}-nom`, className: 'univers-masque', textContent: libelle });
  const nomValeur = h('span', { id: `${id}-val`, className: 'univers-combo-valeur' });
  const bouton = h('button', {
    type: 'button', className: 'btn univers-combo-bouton', role: 'combobox',
    'aria-haspopup': 'listbox', 'aria-expanded': 'false', 'aria-controls': `${id}-liste`, 'aria-labelledby': `${id}-nom ${id}-val`,
  });
  if (cle) bouton.dataset.cle = cle;
  const choisie = elus >= 0 ? options[elus] : null;
  const contenu = (o) => (o && vignette ? vignette(o) : null);
  nomValeur.replaceChildren(...[contenu(choisie)].filter(Boolean), h('span', { className: 'univers-combo-texte', textContent: choisie ? choisie.libelle : vide }));
  bouton.append(nomValeur, h('span', { className: 'univers-combo-fleche', 'aria-hidden': 'true' }));

  const liste = h('ul', { id: `${id}-liste`, className: 'univers-combo-options', role: 'listbox', 'aria-label': libelle, hidden: true });
  const lignes = options.map((o, i) => {
    const li = h('li', { id: `${id}-o${i}`, role: 'option', className: `univers-combo-option${o.ajout ? ' ajout' : ''}`, 'aria-selected': String(i === elus) });
    if (o.desactive) li.setAttribute('aria-disabled', 'true');
    if (o.ajout) li.append(icone('plus'));
    else { const v = contenu(o); if (v) li.append(v); }
    li.append(h('span', { className: 'univers-combo-texte', textContent: o.libelle }));
    li.addEventListener('mousedown', (e) => e.preventDefault()); // le focus reste sur le bouton
    li.addEventListener('click', () => choisir(i));
    li.addEventListener('mousemove', () => marquer(i));
    liste.append(li);
    return li;
  });
  const desactives = options.map((o) => !!o.desactive);

  const element = h('div', { className: 'univers-combo' }, nomLibelle, bouton, liste);

  const estOuvert = () => !liste.hidden;
  function marquer(i) {
    actif = i;
    lignes.forEach((li, k) => li.classList.toggle('actif', k === i));
    if (i >= 0) { bouton.setAttribute('aria-activedescendant', lignes[i].id); lignes[i].scrollIntoView?.({ block: 'nearest' }); } else bouton.removeAttribute('aria-activedescendant');
  }
  function placer() {
    const r = bouton.getBoundingClientRect();
    const bas = window.innerHeight - r.bottom - 8;
    const haut = r.top - 8;
    liste.style.maxHeight = '';
    liste.style.width = `${Math.round(r.width)}px`;
    liste.style.left = `${Math.round(r.left)}px`;
    const hauteur = Math.min(liste.scrollHeight, 280);
    const dessous = bas >= hauteur || bas >= haut;
    liste.style.maxHeight = `${Math.max(96, Math.floor(Math.min(280, dessous ? bas : haut)))}px`;
    if (dessous) { liste.style.top = `${Math.round(r.bottom + 4)}px`; liste.style.bottom = 'auto'; } else { liste.style.bottom = `${Math.round(window.innerHeight - r.top + 4)}px`; liste.style.top = 'auto'; }
  }
  const fermerSiDefile = (e) => { if (!liste.contains(e.target)) fermer(); };
  const fermerSiDehors = (e) => { if (!element.contains(e.target)) fermer(); };
  function ouvrir(depart = elus) {
    if (estOuvert()) return;
    liste.hidden = false;
    bouton.setAttribute('aria-expanded', 'true');
    placer();
    marquer(depart >= 0 && !desactives[depart] ? depart : indexApresTouche('Home', -1, desactives));
    document.addEventListener('pointerdown', fermerSiDehors, true);
    window.addEventListener('scroll', fermerSiDefile, true);
    window.addEventListener('resize', fermer);
  }
  function fermer() {
    if (!estOuvert()) return;
    liste.hidden = true;
    bouton.setAttribute('aria-expanded', 'false');
    bouton.removeAttribute('aria-activedescendant');
    document.removeEventListener('pointerdown', fermerSiDehors, true);
    window.removeEventListener('scroll', fermerSiDefile, true);
    window.removeEventListener('resize', fermer);
  }
  function choisir(i) {
    if (i < 0 || desactives[i]) return;
    fermer();
    bouton.focus({ preventScroll: true });
    surChoix?.(options[i]);
  }

  bouton.addEventListener('click', () => (estOuvert() ? fermer() : ouvrir()));
  bouton.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const touche = e.key;
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(touche)) {
      e.preventDefault();
      if (!estOuvert()) { ouvrir(touche === 'End' ? options.length - 1 : touche === 'Home' ? 0 : elus); if (touche === 'ArrowUp' || touche === 'ArrowDown') return; }
      const i = indexApresTouche(touche, actif, desactives);
      if (i >= 0) marquer(i);
    } else if (touche === 'Enter' || (touche === ' ' && !frappe)) {
      e.preventDefault();
      if (estOuvert()) choisir(actif); else ouvrir();
    } else if (touche === 'Escape') {
      if (estOuvert()) { e.preventDefault(); e.stopPropagation(); fermer(); }
    } else if (touche === 'Tab') {
      fermer();
    } else if (touche.length === 1) {
      frappe += touche;
      clearTimeout(minuteur);
      minuteur = setTimeout(() => { frappe = ''; }, DELAI_FRAPPE);
      const i = indexParFrappe(options.map((o) => o.libelle), frappe, desactives, frappe.length > 1 ? actif - 1 : actif);
      if (i >= 0) { e.preventDefault(); if (!estOuvert()) ouvrir(i); marquer(i); }
    }
  });
  bouton.addEventListener('blur', () => { if (estOuvert()) setTimeout(() => { if (!element.contains(document.activeElement)) fermer(); }, 0); });

  return { element, bouton, fermer };
}
