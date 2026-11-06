/**
 * Tests de la liste de panneau (js/atelier/liste.js), avec une fabrique simulée.
 */
import { creerListe } from '../js/atelier/liste.js';
import { verifier, egal, executerSuite } from './mini-test.js';

function faux(tag) {
  return { tag, enfants: [], attributs: {}, ecouteurs: {}, textContent: '', className: '',
    append(...x) { this.enfants.push(...x); }, setAttribute(n, v) { this.attributs[n] = v; },
    addEventListener(t, f) { this.ecouteurs[t] = f; }, click() { this.ecouteurs.click?.(); } };
}
const fabrique = (tag, props = {}, ...enfants) => { const e = faux(tag); Object.assign(e, props); e.append(...enfants); return e; };
const outils = { fabrique, icone: (nom) => fabrique(`icone:${nom}`) };
const bouton = (ul, i) => ul.enfants[i].enfants[0];
const parties = (b) => Object.fromEntries(b.enfants.map((e) => [e.className.split(' ')[0], e]));

const TESTS = [
  ['liste : une rangée par élément (icône, nom, position, sous-ligne), la choisie marquée, le clic choisit', () => {
    const appels = [];
    const ul = creerListe([
      { nom: 'Entrée du Repère', icone: 'donjon', detail: ['vers ', { fort: 'Repaire gobelin' }], choisie: true, surChoix: () => appels.push('a') },
      { nom: '  ', vide: 'Point sans nom', icone: 'monde', position: 'D4', surChoix: () => appels.push('b') },
    ], outils);
    egal(ul.className, 'p-liste', 'classe de la liste');
    egal(ul.enfants.length, 2, 'deux rangées');
    const a = bouton(ul, 0), pa = parties(a);
    verifier(a.className.includes('choisie') && a.attributs['aria-current'] === 'true', 'choisie et annoncée');
    egal(pa['p-rang-nom'].textContent, 'Entrée du Repère', 'nom');
    egal(pa['p-rang-icone'].enfants[0].tag, 'icone:donjon', 'icône');
    egal(pa['p-rang-detail'].enfants[1].tag, 'b', 'morceau mis en valeur');
    egal(pa['p-rang-detail'].enfants[1].textContent, 'Repaire gobelin', 'texte mis en valeur');
    const b = bouton(ul, 1), pb = parties(b);
    egal(pb['p-rang-nom'].textContent, 'Point sans nom', 'nom vide : le texte d’absence');
    verifier(pb['p-rang-nom'].className.includes('vide'), 'en style d’absence');
    egal(pb['p-rang-position'].textContent, 'D4', 'position');
    verifier(!pb['p-rang-detail'], 'pas de sous-ligne sans détail');
    b.click();
    egal(appels.join(), 'b', 'le clic choisit');
  }],
];

export async function executer() {
  return executerSuite('liste de panneau : ', TESTS);
}
