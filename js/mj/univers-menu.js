/**
 * Petits éléments d'interface du Monde (js/mj/univers-ui.js) : l'aide repliable (.aide) et les notifications temporaires.
 * Du DOM seulement ; les règles (durées) sont dans js/univers-vue.js. Le menu « plus d'actions » est celui de l'inspecteur (js/atelier/inspecteur.js).
 */
import { h } from '../dom.js';
import { iconeHtml } from '../icones.js';
import { btn } from '../univers-boutons.js';
import { dureeNotification } from '../univers-vue.js';
import { telephone } from '../telephone.js';

/** Une aide longue, repliée sous une icône « ? » (sans script : un <details class="aide"> du système visuel). */
export function aide(texte, classe = '') {
  const resume = h('summary', { className: 'btn btn-icone btn-discret', title: 'Afficher l’aide' });
  resume.setAttribute('aria-label', 'Aide');
  resume.innerHTML = iconeHtml('aide');
  return h('details', { className: `aide ${classe}`.trim() }, resume, h('div', { className: 'aide-texte', textContent: texte }));
}

/**
 * Les notifications temporaires : `zone` est une région annoncée par les lecteurs d'écran (aria-live), posée par le CSS en haut de la scène,
 * sans jamais recouvrir l'inspecteur. Elles se ferment SEULES (durée : `dureeNotification`, plus longue avec une action ou une erreur) ;
 * le bouton « Fermer le message » les ferme avant. Renvoie `dire(texte, { erreur, action: { libelle, faire } })` ; un texte vide efface tout.
 * Au plus trois à la fois, une seule sur téléphone (la plus récente remplace l'ancienne).
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
    while (zone.children.length >= (telephone() ? 1 : 3)) zone.firstChild.remove(); // une seule sur téléphone
    zone.append(carte);
    minuteur = setTimeout(retirer, dureeNotification(texte, { erreur, action: !!action }));
  }
  return dire;
}
