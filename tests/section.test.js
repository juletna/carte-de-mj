/**
 * Tests de la section de panneau (js/atelier/section.js), avec une fabrique simulée et un stockage en mémoire.
 */
import { creerSection, memoireReplis } from '../js/atelier/section.js';
import { verifier, egal, executerSuite } from './mini-test.js';

/** Un élément minimal : enfants, attributs, classes, écouteurs. */
function faux(tag) {
  const classes = new Set();
  const e = { tag, enfants: [], ecouteurs: {}, attributs: {}, dataset: {}, hidden: false, textContent: '',
    classList: { add: (c) => classes.add(c), contains: (c) => classes.has(c), toggle: (c, oui) => (oui ? classes.add(c) : classes.delete(c)) },
    set className(v) { classes.clear(); for (const c of v.split(' ').filter(Boolean)) classes.add(c); },
    get className() { return [...classes].join(' '); },
    append(...x) { this.enfants.push(...x); }, setAttribute(n, v) { this.attributs[n] = v; },
    addEventListener(t, f) { this.ecouteurs[t] = f; }, click() { this.ecouteurs.click?.(); } };
  return e;
}
const fabrique = (tag, props = {}, ...enfants) => {
  const e = faux(tag);
  for (const [k, v] of Object.entries(props)) if (k.startsWith('aria-')) e.setAttribute(k, v); else e[k] = v;
  e.append(...enfants);
  return e;
};
const outils = (stockage = new Map()) => ({
  fabrique, icone: (nom) => faux(`icone:${nom}`),
  replis: memoireReplis({ getItem: (k) => stockage.get(k) ?? null, setItem: (k, v) => stockage.set(k, v) }),
});
const tete = (s) => s.element.enfants[0];
const bascule = (s) => tete(s).enfants[0];

const TESTS = [
  ['section : bandeau (titre, compteur, aide, action) puis corps ; le bandeau ouvre et ferme', () => {
    const appels = [];
    const enfant = faux('p');
    const s = creerSection({ cle: 'lieu:points', titre: 'Points', compte: 2, aide: 'Choisis l’outil Point.', action: { libelle: 'Point au centre', icone: 'point', executer: () => appels.push('centre') }, enfants: [enfant] }, outils());
    verifier(s.element.classList.contains('p-section'), 'classe p-section');
    egal(bascule(s).enfants[1].textContent, 'Points', 'titre');
    egal(tete(s).enfants[1].textContent, '2', 'compteur');
    verifier(tete(s).enfants[1].classList.contains('p-section-compte'), 'pastille du compteur');
    egal(s.corps.enfants[0], enfant, 'le corps reçoit les enfants');
    egal(bascule(s).attributs['aria-expanded'], 'true', 'ouverte par défaut');
    tete(s).enfants[3].click();
    egal(appels.join(), 'centre', 'l’action du bandeau');
    bascule(s).click();
    verifier(s.element.classList.contains('repliee') && s.corps.hidden, 'repliée au clic');
    egal(bascule(s).attributs['aria-expanded'], 'false', 'aria-expanded suit');
  }],
  ['section : l’aide se déplie sous le bandeau et rouvre une section repliée', () => {
    const s = creerSection({ cle: 'a', titre: 'Notes', aide: 'Texte', repliee: true }, outils());
    const aide = s.element.enfants[1];
    verifier(aide.hidden && s.corps.hidden, 'au départ : repliée, aide fermée');
    tete(s).enfants[1].click();
    verifier(!aide.hidden && !s.corps.hidden, 'le « ? » montre l’aide et déplie');
    bascule(s).click();
    verifier(aide.hidden, 'replier ferme aussi l’aide');
  }],
  ['section : l’état replié est gardé par clé pour la session ; sans état gardé, le défaut', () => {
    const stockage = new Map();
    const a = creerSection({ cle: 'salle:forme', titre: 'Forme' }, outils(stockage));
    bascule(a).click();
    const b = creerSection({ cle: 'salle:forme', titre: 'Forme' }, outils(stockage));
    verifier(b.corps.hidden, 'repliée au redessin');
    const c = creerSection({ cle: 'salle:avance', titre: 'Avancé', repliee: true }, outils(stockage));
    verifier(c.corps.hidden, 'le rare : replié par défaut');
    bascule(c).click();
    const d = creerSection({ cle: 'salle:avance', titre: 'Avancé', repliee: true }, outils(stockage));
    verifier(!d.corps.hidden, 'ouvert par le MJ : reste ouvert');
  }],
  ['section : sans compteur ni aide ni action, le bandeau n’a que la bascule ; un compteur vivant est déplacé tel quel', () => {
    const s = creerSection({ cle: 'x', titre: 'Notes' }, outils());
    egal(tete(s).enfants.length, 1, 'bascule seule');
    const vivant = faux('span');
    vivant.id = 'personnages-compte';
    const p = creerSection({ cle: 'y', titre: 'Personnages', compte: vivant }, outils());
    egal(tete(p).enfants[1], vivant, 'le même nœud');
    verifier(vivant.classList.contains('p-section-compte'), 'stylé en pastille');
  }],
];

export async function executer() {
  return executerSuite('section de panneau : ', TESTS);
}
