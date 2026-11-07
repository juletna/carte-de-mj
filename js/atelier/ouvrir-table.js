/**
 * « Ouvrir la table ▾ » dans la barre d'outils de la scène, à côté du sélecteur En régie / À la table : un bouton doré et un menu,
 * « Dans une fenêtre » (la fenêtre des joueurs, à glisser sur l'écran de la table) et « Plein écran ici » (la vue table sur cet écran).
 * C'est le seul endroit où l'on ouvre la table. Les entrées gardent les identifiants `ouvrir-table` et `plein-ici` (une carte de monde masque
 * « Plein écran ici », voir regie-univers.js).
 *
 *   const o = creerOuvrirTable({ barre, avant, fenetre, pleinIci });   // `barre` : la barre d'outils, `avant` : le nœud devant lequel poser le bouton
 */
import { h } from '../dom.js';
import { icone } from '../icones.js';

export function creerOuvrirTable({ barre, avant = null, fenetre, pleinIci }) {
  const bouton = h('button', { type: 'button', id: 'ouvrir-table-bouton', className: 'btn btn-primaire ouvrir-table-bouton', 'aria-haspopup': 'menu', 'aria-expanded': 'false', title: 'Ouvre la table : dans une fenêtre à glisser sur l’écran des joueurs, ou en plein écran ici' },
    icone('plein-ecran'), h('span', { textContent: 'Ouvrir la table' }), h('span', { className: 'ouvrir-table-chevron', 'aria-hidden': 'true', textContent: '▾' }));
  const entree = (id, texte, titre, action) => {
    const b = h('button', { type: 'button', id, role: 'menuitem', className: 'btn btn-discret ouvrir-table-entree', title: titre, textContent: texte });
    b.addEventListener('click', () => { fermer(); action(); });
    return b;
  };
  const menu = h('div', { className: 'ouvrir-table-menu', role: 'menu', 'aria-label': 'Ouvrir la table', hidden: true },
    entree('ouvrir-table', 'Dans une fenêtre', 'Ouvre presentation.html?vue=table dans une nouvelle fenêtre, à glisser sur l’écran de la table', fenetre),
    entree('plein-ici', 'Plein écran ici', 'Montre la vue table en plein écran sur cet écran', pleinIci));
  const racine = h('div', { className: 'ouvrir-table' }, bouton, menu);
  function fermer({ rendreFocus = false } = {}) {
    if (menu.hidden) return;
    menu.hidden = true; bouton.setAttribute('aria-expanded', 'false');
    if (rendreFocus) bouton.focus();
  }
  bouton.addEventListener('click', () => {
    menu.hidden = !menu.hidden;
    bouton.setAttribute('aria-expanded', String(!menu.hidden));
  });
  document.addEventListener('pointerdown', (e) => { if (!racine.contains(e.target)) fermer(); });
  racine.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) { e.preventDefault(); e.stopPropagation(); fermer({ rendreFocus: true }); } });
  barre.insertBefore(racine, avant);
  return { element: racine, fermer };
}
