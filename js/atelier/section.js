/**
 * Une section de panneau (docs/design-panneaux.md, « Section ») : un bandeau (chevron, titre, compteur, aide « ? », une action),
 * puis le corps. Le bandeau entier ouvre et ferme ; l'état replié est gardé pour la session, par clé (`inspecteur:salle:notes`…).
 *
 *   const s = creerSection({ cle, titre, compte?, aide?, action?: { libelle, icone, executer }, repliee?, enfants: [nœuds] });
 *   s.element   la <section class="p-section">, à poser dans le corps
 *   s.corps     son corps, pour y ajouter des nœuds après coup
 *
 * `compte` : un texte (« 2 ») ou un nœud vivant qu'un autre module met à jour (il est déplacé dans le bandeau, son id suit).
 * `repliee` : l'état par défaut, quand la session n'en a pas gardé (le rare d'abord replié : JSON, exemples, réglages).
 * Le DOM est fabriqué par `fabrique` (`h` de js/dom.js par défaut) et le stockage est injectable : le module se teste sous Node.
 */
import { h as hDom } from '../dom.js';
import { icone as iconeDom } from '../icones.js';

const CLE_STOCKAGE = 'carte-de-mj:sections-repliees';

function stockageSession() {
  try { return globalThis.sessionStorage ?? null; } catch { return null; }
}

/** Les clés repliées, lues et écrites dans le stockage de session (ou en mémoire s'il manque). */
export function memoireReplis(stockage = stockageSession()) {
  let memoire = null;
  const lire = () => {
    if (memoire) return memoire;
    try { memoire = JSON.parse(stockage?.getItem(CLE_STOCKAGE) ?? '{}') ?? {}; } catch { memoire = {}; }
    return memoire;
  };
  return {
    /** vrai / faux si la session a gardé un état pour cette clé, sinon `undefined`. */
    etat: (cle) => lire()[cle],
    garder(cle, replie) {
      lire()[cle] = replie;
      try { stockage?.setItem(CLE_STOCKAGE, JSON.stringify(memoire)); } catch { /* stockage indisponible : l'état vit le temps de la page */ }
    },
  };
}

const replisParDefaut = memoireReplis();

export function creerSection({ cle, titre, compte = null, aide = null, action = null, repliee = false, enfants = [] } = {},
  { fabrique = hDom, icone = iconeDom, replis = replisParDefaut } = {}) {
  const h = fabrique;
  const idCorps = `p-section-${String(cle).replace(/[^a-z0-9-]/gi, '-')}`;
  const corps = h('div', { className: 'p-section-corps', id: idCorps }, ...enfants);
  const chevron = h('span', { className: 'p-section-chevron', 'aria-hidden': 'true' });
  const bascule = h('button', { type: 'button', className: 'p-section-bascule', 'aria-controls': idCorps }, chevron, h('span', { className: 'p-section-titre', textContent: titre }));
  const tete = h('div', { className: 'p-section-tete' }, bascule);
  if (compte !== null && compte !== '') {
    const pastille = typeof compte === 'object' ? compte : h('span', { textContent: String(compte) });
    pastille.classList.add('p-section-compte');
    tete.append(pastille);
  }
  let texteAide = null;
  if (aide) {
    texteAide = h('div', { className: 'aide-texte p-section-aide', hidden: true, textContent: aide });
    const b = h('button', { type: 'button', className: 'btn btn-icone btn-discret p-section-outil', 'aria-label': `Aide : ${titre}`, title: 'Aide', 'aria-expanded': 'false' }, icone('aide'));
    b.addEventListener('click', () => {
      texteAide.hidden = !texteAide.hidden;
      b.setAttribute('aria-expanded', String(!texteAide.hidden));
      if (!texteAide.hidden) appliquer(false);
    });
    tete.append(b);
  }
  if (action) {
    const b = h('button', { type: 'button', className: 'btn btn-icone btn-discret p-section-outil', 'aria-label': action.libelle, title: action.libelle }, icone(action.icone ?? 'plus'));
    b.addEventListener('click', () => action.executer());
    tete.append(b);
  }
  const element = h('section', { className: 'p-section' }, tete, ...(texteAide ? [texteAide] : []), corps);
  element.dataset.cle = cle;

  function appliquer(replie, garder = true) {
    element.classList.toggle('repliee', replie);
    corps.hidden = replie;
    bascule.setAttribute('aria-expanded', String(!replie));
    if (replie && texteAide) texteAide.hidden = true;
    if (garder) replis.garder(cle, replie);
  }
  bascule.addEventListener('click', () => appliquer(!element.classList.contains('repliee')));
  const garde = replis.etat(cle);
  appliquer(garde === undefined ? !!repliee : garde, false);

  return { element, corps, replier: () => appliquer(true), deplier: () => appliquer(false) };
}
