/**
 * Une fiche de personnage à l'écran : la même carte dans le Donjon et dans la régie de la Présentation.
 * Tout texte passe par textContent : une fiche vient d'un fichier, jamais de HTML.
 */
import { STATS } from './personnages.js';

function h(tag, props = {}, ...enfants) {
  const e = document.createElement(tag);
  Object.assign(e, props);
  e.append(...enfants);
  return e;
}
const signe = (n) => (n >= 0 ? `+${n}` : String(n));
const modificateur = (v) => signe(Math.floor((v - 10) / 2));

/**
 * @param {object} fiche  résumé de personnages.js
 * @param {Node[]} [actions]  boutons à poser sous la fiche
 * @param {string} [mention]  ligne d'état au-dessus des boutons (où est son pion, par exemple)
 */
export function carteFiche(fiche, actions = [], mention = '') {
  const identite = [fiche.race, fiche.classe, `niveau ${fiche.niveau}`].filter(Boolean).join(' · ');
  const pv = `PV ${fiche.pv}/${fiche.pvMax}${fiche.pvTemp ? ` (+${fiche.pvTemp})` : ''}`;
  const details = h('details', {},
    h('summary', { textContent: 'Détails' }),
    h('ul', { className: 'fiche-stats' }, ...STATS.map((s) => h('li', {}, h('b', { textContent: s }), ` ${fiche.stats[s]} (${modificateur(fiche.stats[s])})`))),
    ...(fiche.attaques.length ? [h('p', { className: 'fiche-titre', textContent: 'Attaques' }), h('ul', {}, ...fiche.attaques.map((a) => h('li', { textContent: `${a.nom} : ${signe(a.toucher)}, ${a.degats}${a.note ? ` (${a.note})` : ''}` })))] : []),
    ...(fiche.sac.length ? [h('p', { className: 'fiche-titre', textContent: 'Sac' }), h('ul', {}, ...fiche.sac.map((o) => h('li', { textContent: `${o.nom}${o.quantite > 1 ? ` × ${o.quantite}` : ''}` })))] : []));
  return h('li', { className: 'fiche-carte' },
    h('b', { className: 'fiche-nom', textContent: fiche.nom }),
    h('p', { className: 'note', textContent: identite }),
    h('p', { className: 'fiche-chiffres', textContent: `${pv} · CA ${fiche.ca} · Vitesse ${fiche.vitesse} m · Init. ${signe(fiche.initiative)}` }),
    ...(fiche.etats.length ? [h('p', { className: 'note', textContent: `États : ${fiche.etats.join(', ')}` })] : []),
    details,
    ...(mention ? [h('p', { className: 'note', textContent: mention })] : []),
    ...(actions.length ? [h('div', { className: 'actions' }, ...actions)] : []));
}
