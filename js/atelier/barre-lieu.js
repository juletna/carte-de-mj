/**
 * La barre d'outils de la scène « lieu » du Monde (lot C) : Sélection · Point · Grille, dans `coquille.barreOutils`.
 *   - Sélection : un clic sur un point le choisit (son inspecteur s'ouvre), un clic dans le vide le lâche ; glisser un point le déplace ;
 *   - Point     : le prochain clic dans le vide pose un point, puis on revient à Sélection ;
 *   - Grille    : le calage de la grille du lieu (réglages dans l'inspecteur) ; proposé pour une zone, une localité, un bâtiment ou un souterrain.
 * Le groupe n'est visible que pendant que le Monde est affiché. L'outil vit dans js/mj/univers-ui.js (`mode()`, `definirMode()`).
 */
import { h } from '../dom.js';
import { btn } from '../univers-boutons.js';

const AIDE = {
  selection: 'Clique un point pour le régler, glisse-le pour le déplacer.',
  point: 'Clique sur la carte pour poser un point (Échap : annuler).',
  grille: 'Règle la grille dans le panneau (Échap : quitter sans enregistrer).',
};

/** @param {object} coquille  js/atelier/coquille.js   @param {object} U  `ctx.univers` (js/mj/univers-ui.js) */
export function creerBarreLieu(coquille, U) {
  const boutons = {
    selection: btn('Sélection', () => U.definirMode('selection'), { icone: 'fleches', classe: 'btn-discret', titre: 'Choisir et déplacer les points' }),
    point: btn('Point', () => U.definirMode(U.mode() === 'point' ? 'selection' : 'point'), { icone: 'point', classe: 'btn-discret', titre: 'Poser un point sur la carte' }),
    grille: btn('Grille', () => U.definirMode(U.mode() === 'grille' ? 'selection' : 'grille'), { icone: 'grille', classe: 'btn-discret', titre: 'Caler la grille de cases sur la carte' }),
  };
  const aide = h('span', { className: 'barre-lieu-aide doux', 'aria-live': 'polite' });
  const groupe = h('div', { className: 'barre-lieu', role: 'group', 'aria-label': 'Outils de la carte', hidden: true }, boutons.selection, boutons.point, boutons.grille, aide);
  coquille.barreOutils.append(groupe);

  let version = 0;
  function maj() {
    const ouvert = U.ouvert();
    groupe.hidden = !ouvert;
    if (!ouvert) return;
    const lieu = U.lieuCourant();
    const m = U.mode();
    for (const [nom, b] of Object.entries(boutons)) b.setAttribute('aria-pressed', String(nom === m));
    boutons.point.disabled = !lieu;
    boutons.grille.disabled = !lieu;
    aide.textContent = lieu ? AIDE[m] : '';
    const moi = ++version;
    U.grillePossible().then((ok) => { if (moi === version) boutons.grille.hidden = !!lieu && !ok && m !== 'grille'; });
  }
  U.surChangement(maj);
  return { groupe, boutons, maj };
}
