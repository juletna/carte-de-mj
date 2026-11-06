/**
 * Fabrique de boutons du système visuel (css/base.css : .btn, .btn-primaire, .btn-discret, .btn-danger, .btn-icone) pour les écrans
 * Monde (js/mj/) et régie de monde (js/regie-univers.js). Une icône (js/icones.js) précède le libellé ; sans libellé visible
 * (`iconeSeule`), le libellé devient l'aria-label et le title.
 *   btn('Jouer', faire, { icone: 'jouer', classe: 'btn-primaire' })
 *   btn('Fermer le message', faire, { icone: 'fermer', iconeSeule: true, classe: 'btn-discret' })
 */
import { h } from './dom.js';
import { icone } from './icones.js';

/** Classes d'un bouton : `btn`, `btn-icone` si icône seule, puis `classe`. */
export function classesBouton({ iconeSeule = false, classe = '' } = {}) {
  return ['btn', iconeSeule ? 'btn-icone' : '', classe].filter(Boolean).join(' ');
}

/** Remplit un bouton (ou un lien) : l'icône, puis le libellé s'il est visible. */
export function remplirBouton(b, libelle, { icone: nom = null, iconeSeule = false, titre = '' } = {}) {
  b.replaceChildren();
  if (nom) b.append(icone(nom));
  if (iconeSeule) {
    b.setAttribute('aria-label', libelle);
    b.title = titre || libelle;
  } else {
    b.append(libelle);
    if (titre) b.title = titre;
  }
  return b;
}

export function btn(libelle, faire, options = {}) {
  const b = h('button', { type: 'button', className: classesBouton(options) });
  remplirBouton(b, libelle, options);
  if (faire) b.addEventListener('click', faire);
  return b;
}

/** Un lien qui a l'allure d'un bouton. */
export function lienBtn(libelle, href, options = {}) {
  const a = h('a', { className: classesBouton(options) });
  if (href) a.href = href;
  remplirBouton(a, libelle, options);
  return a;
}
