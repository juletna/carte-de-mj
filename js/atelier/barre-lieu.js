/**
 * La barre d'outils de la scène « lieu » du Monde (lot C), dans `coquille.barreOutils`.
 * Les points n'ont pas d'outil : la carte les pose d'un clic dans le vide et les choisit d'un clic dessus (js/mj/univers-ui.js). La barre garde
 *   - Calage : le calage de la grille du lieu (réglages dans l'inspecteur) ; proposé pour une zone, une localité, un bâtiment ou un souterrain ;
 *   - une consigne courte et discrète, « Clic : poser un point » (masquée sous 760 px, où l'aide du panneau suffit) ; pendant le calage, une
 *     pastille `.barre-lieu-etat` dit « Calage en cours » à sa place.
 * L'aide de Calage est son infobulle (`title`, relue par `aria-describedby`). Le groupe n'est visible que pendant que le Monde est affiché.
 * Sous 760 px, l'outil est une icône seule (le libellé reste en `aria-label`).
 */
import { h } from '../dom.js';
import { btn } from '../univers-boutons.js';
import { icone } from '../icones.js';

const AIDE_CALAGE = 'Règle la grille dans le panneau (Échap : quitter sans enregistrer).';
const CONSIGNE = 'Clic : poser un point · Glisser : déplacer · Suppr : effacer';

/** @param {object} coquille  js/atelier/coquille.js   @param {object} U  `ctx.univers` (js/mj/univers-ui.js) */
export function creerBarreLieu(coquille, U) {
  const decrit = h('span', { className: 'cache-visuel', id: 'aide-outil-lieu-calage', textContent: AIDE_CALAGE });
  const calage = btn('Calage', () => U.definirMode(U.mode() === 'grille' ? 'carte' : 'grille'), { icone: 'grille', classe: 'btn-discret outil-lieu' });
  calage.replaceChildren(icone('grille'), h('span', { className: 'libelle', textContent: 'Calage' }));
  calage.setAttribute('aria-label', 'Calage');
  calage.title = AIDE_CALAGE;
  calage.setAttribute('aria-describedby', decrit.id);
  const consigne = h('span', { className: 'barre-lieu-consigne doux', textContent: CONSIGNE });
  const etat = h('span', { className: 'barre-lieu-etat', 'aria-live': 'polite', hidden: true });
  const groupe = h('div', { className: 'barre-lieu', role: 'group', 'aria-label': 'Outils de la carte', hidden: true }, calage, etat, consigne, decrit);
  coquille.barreOutils.append(groupe);

  let version = 0;
  function maj() {
    const ouvert = U.ouvert();
    groupe.hidden = !ouvert;
    if (!ouvert) return;
    const lieu = U.lieuCourant();
    const enCalage = U.mode() === 'grille';
    calage.setAttribute('aria-pressed', String(enCalage));
    calage.disabled = !lieu;
    etat.textContent = lieu && enCalage ? 'Calage en cours' : '';
    etat.hidden = !etat.textContent;
    consigne.hidden = !lieu || enCalage;
    const moi = ++version;
    U.grillePossible().then((ok) => { if (moi === version) calage.hidden = !!lieu && !ok && !enCalage; });
  }
  U.surChangement(maj);
  return { groupe, boutons: { grille: calage }, maj };
}
