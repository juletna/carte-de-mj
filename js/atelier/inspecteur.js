/**
 * L'inspecteur de l'atelier : la colonne de droite (panneau bas sous 760 px) qui ne montre que la sélection.
 * Voir docs/conception-atelier.md §2 « Contrat de l'inspecteur ». Chaque lot y enregistre ses types :
 *
 *   inspecteur.enregistrer(type, {
 *     titre(sel, ctx) → string,
 *     rendre(conteneur, sel, ctx),                          // remplit le conteneur ; rappelée à chaque changement de sélection ou de données
 *     actions?(sel, ctx) → [{ libelle, icone?, executer }], // actions courantes, visibles
 *     destructives?(sel, ctx) → [{ libelle, executer }]     // rangées dans « ⋯ », en .btn-danger
 *   });
 *
 * Un seul lot enregistre un type (un second enregistrement lève une Error). `rendre` ne garde aucun état entre deux appels.
 * Sans sélection, l'inspecteur montre le nœud actif (`parDefaut()`), jamais un panneau vide.
 * Le DOM est fabriqué par `fabrique` (`h` de js/dom.js par défaut) : le module s'importe et se teste sous Node avec une fabrique simulée.
 */
import { h as hDom } from '../dom.js';
import { icone as iconeDom } from '../icones.js';

export const TYPES_INSPECTEUR = ['monde', 'lieu', 'point', 'donjon', 'salle', 'porte', 'objet', 'creature', 'pion'];

/**
 * @param {{ racine: HTMLElement, ctx?: () => object, parDefaut?: () => object|null, fabrique?: Function, icone?: Function }} options
 *   racine   : l'élément (ex. `.atelier-inspecteur`) que l'inspecteur remplit
 *   ctx      : le contexte passé à titre / rendre / actions (lu à chaque appel)
 *   parDefaut: la sélection à montrer quand il n'y en a pas (le nœud actif de l'arbre)
 */
export function creerInspecteur({ racine, ctx = () => ({}), parDefaut = () => null, fabrique = hDom, icone = iconeDom } = {}) {
  const h = fabrique;
  const definitions = new Map();
  let courante = null;

  const titre = h('h2', { className: 'atelier-inspecteur-titre' });
  const actions = h('div', { className: 'atelier-inspecteur-actions' });
  const plus = h('details', { className: 'atelier-inspecteur-plus', hidden: true });
  const plusCorps = h('div', { className: 'atelier-inspecteur-plus-corps' });
  const corps = h('div', { className: 'atelier-inspecteur-corps' });
  const resume = h('summary', { className: 'btn btn-icone btn-discret', title: 'Autres actions', 'aria-label': 'Autres actions' });
  try { resume.append(icone('plus-d-actions')); } catch { resume.append('Plus'); }
  plus.append(resume, plusCorps);
  const tete = h('div', { className: 'atelier-inspecteur-tete' }, titre, actions, plus);
  racine.append(tete, corps);

  const bouton = (a, classe) => {
    const b = h('button', { type: 'button', className: `btn ${classe}` });
    if (a.icone) { try { b.append(icone(a.icone)); } catch { /* icône inconnue : le libellé suffit */ } }
    b.append(a.libelle);
    b.addEventListener('click', () => { if (plus) plus.open = false; a.executer(); });
    return b;
  };

  function enregistrer(type, definition) {
    if (!TYPES_INSPECTEUR.includes(type)) throw new Error(`type d’inspecteur inconnu : ${type}`);
    if (definitions.has(type)) throw new Error(`le type « ${type} » est déjà enregistré`);
    if (!definition || typeof definition.titre !== 'function' || typeof definition.rendre !== 'function') throw new Error(`le type « ${type} » doit fournir titre() et rendre()`);
    definitions.set(type, definition);
    if (courante && courante.type === type) rafraichir();
  }

  /** Affiche la sélection (ou, sans elle, le nœud actif). Renvoie le type affiché, ou null s'il n'y a rien à montrer. */
  function afficher(sel = null) {
    courante = sel ?? null;
    return dessiner();
  }

  function dessiner() {
    const sel = courante ?? parDefaut();
    const def = sel && definitions.get(sel.type);
    const c = ctx();
    racine.hidden = false;
    if (!def) {
      titre.textContent = 'Rien à régler';
      actions.replaceChildren();
      plusCorps.replaceChildren();
      plus.hidden = true;
      corps.replaceChildren(h('p', { className: 'note', textContent: 'Choisis un élément dans l’arbre ou sur la carte pour le régler ici.' }));
      return null;
    }
    titre.textContent = def.titre(sel, c);
    actions.replaceChildren(...(def.actions?.(sel, c) ?? []).map((a) => bouton(a, 'btn-discret')));
    const destructives = def.destructives?.(sel, c) ?? [];
    plusCorps.replaceChildren(...destructives.map((a) => bouton(a, 'btn-danger')));
    plus.hidden = destructives.length === 0;
    corps.replaceChildren();
    def.rendre(corps, sel, c);
    return sel.type;
  }

  /** Redessine la sélection courante (les données ont changé). */
  function rafraichir() { return dessiner(); }

  return {
    enregistrer, afficher, rafraichir,
    courante: () => courante,
    enregistres: () => [...definitions.keys()],
    a: (type) => definitions.has(type),
    corps, titre, element: racine,
  };
}
