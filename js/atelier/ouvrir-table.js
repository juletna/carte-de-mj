/**
 * « Ouvrir la table » dans la barre d'outils de la scène, à côté du sélecteur En régie / À la table : un bouton doré qui ouvre la fenêtre
 * des joueurs (à glisser sur l'écran de la table, avec son propre bouton « Plein écran »). C'est le seul endroit où l'on ouvre la table.
 * Le bouton garde l'identifiant `ouvrir-table`.
 *
 *   const o = creerOuvrirTable({ barre, avant, fenetre });   // `barre` : la barre d'outils, `avant` : le nœud devant lequel poser le bouton
 *   o.pastille(true | false)  la table est ouverte mais jamais calibrée : pastille dorée et infobulle « À calibrer »
 *   o.ouverte(true | false)   la fenêtre de table est ouverte : le bouton doré devient discret (« Table ouverte »), et redevient doré à sa fermeture
 */
import { h } from '../dom.js';
import { icone } from '../icones.js';

export function creerOuvrirTable({ barre, avant = null, fenetre }) {
  const bouton = h('button', { type: 'button', id: 'ouvrir-table', className: 'btn btn-primaire ouvrir-table-bouton', title: 'Ouvre presentation.html?vue=table dans une nouvelle fenêtre, à glisser sur l’écran de la table' },
    icone('plein-ecran'), h('span', { className: 'ouvrir-table-texte', textContent: 'Ouvrir la table' }));
  bouton.addEventListener('click', fenetre);
  barre.insertBefore(bouton, avant);
  /** La table est ouverte dans une fenêtre : le bouton se fait discret (le MJ n'a plus besoin de le chercher) ; fermée, il revient en doré. */
  function ouverte(oui) {
    bouton.classList.toggle('btn-primaire', !oui);
    bouton.classList.toggle('btn-discret', oui);
    bouton.querySelector('.ouvrir-table-texte').textContent = oui ? 'Table ouverte' : 'Ouvrir la table';
  }
  const TITRE = bouton.title;
  /** Pastille dorée « À calibrer » sur le bouton discret (la table est ouverte mais jamais calibrée). */
  function pastille(oui) {
    bouton.classList.toggle('a-calibrer', oui);
    bouton.title = oui ? 'À calibrer : un clic lance le calibrage de l’écran de la table' : TITRE;
    bouton.querySelector('.ouvrir-table-pastille')?.remove();
    if (oui) bouton.append(h('span', { className: 'ouvrir-table-pastille', 'aria-label': 'À calibrer' }));
  }
  return { element: bouton, ouverte, pastille };
}
