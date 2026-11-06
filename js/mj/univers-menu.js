/**
 * Petits éléments d'interface de l'écran Monde (js/mj/univers-ui.js) : le menu « ⋯ », l'aide repliée sous un « ? »
 * et les notifications temporaires. Du DOM seulement ; les règles (durées) sont dans js/univers-vue.js.
 */
import { h, bouton, deuxTemps } from '../dom.js';
import { dureeNotification } from '../univers-vue.js';

/**
 * Un bouton « ⋯ » qui ouvre une courte liste d'actions. Les éléments : `{ libelle, faire }`, `{ libelle, confirmation, faire, danger: true }`
 * (suppression en deux clics, en rouge), `{ separateur: true }` ou `{ element }` (un contrôle déjà prêt, par exemple un import de fichier).
 * Se ferme à l'Échap, au clic ailleurs et après chaque action. Renvoie `{ element, fermer }`.
 */
export function menuPlus({ libelle = 'Plus d’actions', items, classe = '' }) {
  const declencheur = h('button', { type: 'button', className: `discret univers-plus ${classe}`.trim(), textContent: '⋯' });
  declencheur.setAttribute('aria-label', libelle);
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
    const b = h('button', { type: 'button', role: 'menuitem', className: `univers-menu-item${it.danger ? ' univers-menu-danger' : ''}` });
    if (it.danger) {
      deuxTemps(b, it.libelle, it.confirmation ?? 'Confirmer', it.faire);
      b.addEventListener('click', () => { if (b.dataset.confirme !== '1') fermer(); }); // la première pression attend la confirmation, menu ouvert
    } else {
      b.textContent = it.libelle;
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

/** Une aide longue, repliée sous un « ? » (sans script : un <details>). */
export function aide(texte, classe = '') {
  const resume = h('summary', { textContent: '?', title: 'Afficher l’aide' });
  resume.setAttribute('aria-label', 'Aide');
  return h('details', { className: `univers-aide ${classe}`.trim() }, resume, h('p', { className: 'note', textContent: texte }));
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
    if (action) carte.append(bouton(action.libelle, () => { retirer(); action.faire(); }, 'discret petit'));
    const x = bouton('✕', retirer, 'discret petit univers-notification-x');
    x.setAttribute('aria-label', 'Fermer le message');
    carte.append(x);
    while (zone.children.length >= 3) zone.firstChild.remove();
    zone.append(carte);
    minuteur = setTimeout(retirer, dureeNotification(texte, { erreur, action: !!action }));
  }
  return dire;
}
