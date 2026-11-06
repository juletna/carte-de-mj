/**
 * La barre d'outils de la scène « lieu » du Monde (lot C) : Sélection · Point · Calage, dans `coquille.barreOutils`.
 *   - Sélection : un clic sur un point le choisit (son inspecteur s'ouvre), un clic dans le vide le lâche ; glisser un point le déplace ;
 *   - Point     : le prochain clic dans le vide pose un point, puis on revient à Sélection ;
 *   - Calage    : le calage de la grille du lieu (réglages dans l'inspecteur) ; proposé pour une zone, une localité, un bâtiment ou un souterrain.
 * La phrase d'aide de chaque outil n'est plus un texte permanent : c'est son infobulle (`title`, relue par `aria-describedby`). Pendant une action
 * armée (Point, Calage), une pastille courte `.barre-lieu-etat` à côté de l'outil actif dit quoi faire ; elle disparaît avec l'action.
 * Le groupe n'est visible que pendant que le Monde est affiché. L'outil vit dans js/mj/univers-ui.js (`mode()`, `definirMode()`).
 * Sous 760 px, les outils sont des icônes seules (le libellé reste en `aria-label`).
 */
import { h } from '../dom.js';
import { btn } from '../univers-boutons.js';
import { icone } from '../icones.js';

const AIDE = {
  selection: 'Clique un point pour le régler, glisse-le pour le déplacer.',
  point: 'Clique sur la carte pour poser un point (Échap : annuler).',
  grille: 'Règle la grille dans le panneau (Échap : quitter sans enregistrer).',
};
/** La consigne courte d'une action armée (jamais pour Sélection, qui n'arme rien). */
const ETAT = { point: 'Clique la carte', grille: 'Calage en cours' };

/** @param {object} coquille  js/atelier/coquille.js   @param {object} U  `ctx.univers` (js/mj/univers-ui.js) */
export function creerBarreLieu(coquille, U) {
  const decrits = h('span', { className: 'cache-visuel' });
  /** Un outil : icône + libellé (masqué sous 760 px), infobulle = l'aide, `aria-describedby` vers la même phrase. */
  function outil(nom, libelle, icn, aide, faire) {
    const b = btn(libelle, faire, { icone: icn, classe: 'btn-discret outil-lieu' });
    const id = `aide-outil-lieu-${nom}`;
    b.replaceChildren(icone(icn), h('span', { className: 'libelle', textContent: libelle }));
    b.setAttribute('aria-label', libelle);
    b.title = aide;
    b.setAttribute('aria-describedby', id);
    decrits.append(h('span', { id, textContent: aide }));
    return b;
  }
  const boutons = {
    selection: outil('selection', 'Sélection', 'fleches', AIDE.selection, () => U.definirMode('selection')),
    point: outil('point', 'Point', 'point', AIDE.point, () => U.definirMode(U.mode() === 'point' ? 'selection' : 'point')),
    grille: outil('calage', 'Calage', 'grille', AIDE.grille, () => U.definirMode(U.mode() === 'grille' ? 'selection' : 'grille')),
  };
  const etat = h('span', { className: 'barre-lieu-etat', 'aria-live': 'polite', hidden: true });
  const groupe = h('div', { className: 'barre-lieu', role: 'group', 'aria-label': 'Outils de la carte', hidden: true }, boutons.selection, boutons.point, boutons.grille, etat, decrits);
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
    etat.textContent = lieu ? (ETAT[m] ?? '') : '';
    etat.hidden = !etat.textContent;
    const moi = ++version;
    U.grillePossible().then((ok) => { if (moi === version) boutons.grille.hidden = !!lieu && !ok && m !== 'grille'; });
  }
  U.surChangement(maj);
  return { groupe, boutons, maj };
}
