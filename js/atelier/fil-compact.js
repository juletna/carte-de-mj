/**
 * Le fil d'Ariane de la régie, version téléphone : sur une seule ligne. Trois lieux ou plus se réduisent à « premier › … › dernier » ;
 * le « … » ouvre la liste complète (un bouton de 44 px par lieu). Deux lieux ou moins : rien n'est caché.
 *
 *   filCompact([{ nom, index }, …])  → { premier, caches: [{ nom, index }], dernier }   (pur, testé : tests/fil-compact.test.js)
 *   creerFilCompact(items, { aller }) → l'élément <span class="fil-compact"> ; `aller(index)` remonte au lieu choisi
 *
 * Le dernier élément est l'endroit où l'on est (jamais un bouton). Le DOM complet reste dans la page : css/presentation.css n'affiche que l'une
 * des deux versions (complète sur ordinateur, compacte sous 760 px).
 */
import { h } from '../dom.js';
import { btn } from '../univers-boutons.js';

/** Découpe le fil : le premier lieu, ceux du milieu (cachés derrière « … ») et le dernier. `caches` est vide sous trois éléments. */
export function filCompact(items) {
  if (!items?.length) return { premier: null, caches: [], dernier: null };
  if (items.length === 1) return { premier: null, caches: [], dernier: items[0] };
  if (items.length === 2) return { premier: items[0], caches: [], dernier: items[1] };
  return { premier: items[0], caches: items.slice(1, -1), dernier: items.at(-1) };
}

// Un seul écouteur pour tous les fils (la régie refait le sien à chaque rendu) : un appui hors du fil ouvert le referme.
let ouvert = null; // { racine, fermer } du fil dont la liste est ouverte
let ecoute = false;
function ecouter() {
  if (ecoute) return;
  ecoute = true;
  document.addEventListener('pointerdown', (e) => { if (ouvert && !ouvert.racine.contains(e.target)) ouvert.fermer(); });
}

const separateur = () => h('span', { className: 'univers-sep', textContent: '›', 'aria-hidden': 'true' });

export function creerFilCompact(items, { aller }) {
  const { premier, caches, dernier } = filCompact(items);
  const racine = h('span', { className: 'fil-compact' });
  const etiquette = (it) => h('span', { className: 'fil-nom', textContent: it.nom });
  if (premier) {
    const b = btn('', () => aller(premier.index), { classe: 'btn-discret fil-premier', titre: premier.nom });
    b.append(etiquette(premier));
    racine.append(b, separateur());
  }
  if (caches.length) {
    const liste = h('ul', { className: 'fil-liste', 'aria-label': 'Tous les lieux du fil', hidden: true });
    const ellipse = h('button', { type: 'button', className: 'btn btn-icone btn-discret fil-ellipse', 'aria-label': 'Afficher tout le fil', 'aria-expanded': 'false', textContent: '…' });
    const fermer = (rendreFocus = false) => { if (liste.hidden) return; liste.hidden = true; ellipse.setAttribute('aria-expanded', 'false'); if (rendreFocus) ellipse.focus(); };
    liste.append(...items.map((it, i) => h('li', {}, i === items.length - 1
      ? h('strong', { className: 'fil-liste-courant', textContent: it.nom, 'aria-current': 'location' })
      : btn(it.nom, () => { fermer(); aller(it.index); }, { classe: 'btn-discret fil-liste-lieu' }))));
    ellipse.addEventListener('click', () => { liste.hidden = !liste.hidden; ellipse.setAttribute('aria-expanded', String(!liste.hidden)); ouvert = liste.hidden ? null : { racine, fermer }; });
    racine.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !liste.hidden) { e.preventDefault(); e.stopPropagation(); fermer(true); } });
    ecouter();
    racine.append(ellipse, liste, separateur());
  }
  if (dernier) racine.append(h('strong', { className: 'fil-nom fil-courant', textContent: dernier.nom, title: dernier.nom, 'aria-current': 'location' }));
  return racine;
}
