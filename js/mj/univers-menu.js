/**
 * Petits éléments d'interface de l'écran Monde (js/mj/univers-ui.js) : le menu « plus d'actions » (trois points), l'aide repliable (.aide)
 * et les notifications temporaires. Du DOM seulement ; les règles (durées) sont dans js/univers-vue.js.
 */
import { h, deuxTemps } from '../dom.js';
import { iconeHtml } from '../icones.js';
import { btn } from '../univers-boutons.js';
import { dureeNotification } from '../univers-vue.js';
import { telephone } from '../telephone.js';

/**
 * Un bouton-icône « plus d'actions » qui ouvre une courte liste. Les éléments : `{ libelle, icone?, faire }`, `{ libelle, confirmation, faire, danger: true }`
 * (suppression en deux clics, .btn-danger), `{ separateur: true }` ou `{ element }` (un contrôle déjà prêt, par exemple un import de fichier).
 * Se ferme à l'Échap, au clic ailleurs et après chaque action. Renvoie `{ element, fermer }`.
 */
export function menuPlus({ libelle = 'Plus d’actions', items, classe = '' }) {
  const declencheur = btn(libelle, null, { icone: 'plus-d-actions', iconeSeule: true, classe: `btn-discret univers-plus ${classe}`.trim() });
  declencheur.setAttribute('aria-haspopup', 'menu');
  declencheur.setAttribute('aria-expanded', 'false');
  const liste = h('div', { className: 'univers-menu', role: 'menu', hidden: true });
  const fermer = ({ rendreFocus = false } = {}) => {
    if (liste.hidden) return;
    liste.hidden = true;
    declencheur.setAttribute('aria-expanded', 'false');
    if (rendreFocus) declencheur.focus();
  };
  for (const it of items) {
    if (it.separateur) { liste.append(h('hr', { role: 'separator' })); continue; }
    if (it.element) { liste.append(it.element); continue; }
    const b = h('button', { type: 'button', role: 'menuitem', className: `btn ${it.danger ? 'btn-danger univers-menu-danger' : 'btn-discret'} univers-menu-item` });
    if (it.danger) {
      deuxTemps(b, it.libelle, it.confirmation ?? 'Confirmer', it.faire);
      b.addEventListener('click', () => { if (b.dataset.confirme !== '1') fermer(); }); // la première pression attend la confirmation, menu ouvert
    } else {
      b.innerHTML = `${it.icone ? iconeHtml(it.icone) : ''}<span></span>`;
      b.lastChild.textContent = it.libelle;
      b.addEventListener('click', () => { fermer(); it.faire(); });
    }
    liste.append(b);
  }
  declencheur.addEventListener('click', (e) => {
    e.stopPropagation();
    const ouvre = liste.hidden;
    liste.hidden = !ouvre;
    declencheur.setAttribute('aria-expanded', String(ouvre));
    if (ouvre) liste.querySelector('button')?.focus();
  });
  const element = h('span', { className: 'univers-menu-cadre' }, declencheur, liste);
  element.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !liste.hidden) { e.preventDefault(); e.stopPropagation(); fermer({ rendreFocus: true }); } });
  document.addEventListener('click', (e) => { if (!element.contains(e.target)) fermer(); });
  return { element, fermer };
}

/** Une aide longue, repliée sous une icône « ? » (sans script : un <details class="aide"> du système visuel). */
export function aide(texte, classe = '') {
  const resume = h('summary', { className: 'btn btn-icone btn-discret', title: 'Afficher l’aide' });
  resume.setAttribute('aria-label', 'Aide');
  resume.innerHTML = iconeHtml('aide');
  return h('details', { className: `aide ${classe}`.trim() }, resume, h('div', { className: 'aide-texte', textContent: texte }));
}

/**
 * Les notifications temporaires : `zone` est une région annoncée par les lecteurs d'écran (aria-live), placée par le CSS
 * hors de la carte. Renvoie `dire(texte, { erreur, action: { libelle, faire } })` ; un texte vide efface tout.
 */
export function creerNotifications(zone) {
  zone.setAttribute('aria-live', 'polite');
  zone.setAttribute('role', 'status');
  function dire(texte, { erreur = false, action = null } = {}) {
    if (!texte) { zone.replaceChildren(); return; }
    const carte = h('div', { className: `univers-notification${erreur ? ' erreur' : ''}` }, h('span', { textContent: texte }));
    let minuteur = null;
    const retirer = () => { clearTimeout(minuteur); carte.remove(); };
    if (action) carte.append(btn(action.libelle, () => { retirer(); action.faire(); }, { classe: 'btn-discret' }));
    carte.append(btn('Fermer le message', retirer, { icone: 'fermer', iconeSeule: true, classe: 'btn-discret univers-notification-x' }));
    while (zone.children.length >= (telephone() ? 2 : 3)) zone.firstChild.remove(); // au plus deux sur téléphone
    zone.append(carte);
    minuteur = setTimeout(retirer, dureeNotification(texte, { erreur, action: !!action }));
  }
  return dire;
}
