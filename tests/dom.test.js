/**
 * Tests des outils communs : format.js (pur) et dom.js (avec des éléments simulés, donc sans navigateur).
 * Sans dépendance : marche sous Node et dans tests.html.
 */
import { pluriel, virgule, sansAccents, estObjet } from '../js/format.js';
import { h, bouton, deuxTemps, fichierChoisi } from '../js/dom.js';
import { verifier, egal, executerSuite } from './mini-test.js';

/** Un élément minimal (sous Node) : de quoi suivre ce que h(), bouton() et deuxTemps() lui font. Dans le navigateur, h() crée de vrais éléments. */
function fauxElement(tag) {
  const classes = new Set(), ecouteurs = {}, attributs = {};
  return {
    tagName: tag.toUpperCase(), style: { cssText: '' }, dataset: {}, childNodes: [], offsetWidth: 80,
    classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c), contains: (c) => classes.has(c) },
    setAttribute(k, v) { attributs[k] = v; },
    getAttribute: (k) => attributs[k] ?? null,
    append(...e) { this.childNodes.push(...e); },
    addEventListener(type, f) { ecouteurs[type] = f; },
    emettre(type) { ecouteurs[type]?.(); },
    click() { this.emettre('click'); },
  };
}

/** Joue `corps` avec un faux minuteur (setTimeout manuel) et, sous Node, un faux document ; puis remet l'environnement. */
function avecFaux(corps) {
  const doc = globalThis.document, st = globalThis.setTimeout, ct = globalThis.clearTimeout;
  const minuteurs = new Map();
  let n = 0;
  if (doc === undefined) globalThis.document = { createElement: fauxElement };
  globalThis.setTimeout = (f, ms) => { minuteurs.set(++n, { f, ms }); return n; };
  globalThis.clearTimeout = (id) => { minuteurs.delete(id); };
  try { corps(minuteurs); } finally {
    if (doc === undefined) delete globalThis.document;
    globalThis.setTimeout = st; globalThis.clearTimeout = ct;
  }
}

const TESTS = [
  ['pluriel : le nombre suivi du mot, au pluriel dès 2', () => {
    egal([0, 1, 2, 5].map((n) => pluriel(n, 'salle', 'salles')), ['0 salle', '1 salle', '2 salles', '5 salles'], 'salles');
    egal(pluriel(3, 'pion a suivi', 'pions ont suivi'), '3 pions ont suivi', 'un verbe accordé');
  }],
  ['virgule : arrondi au dixième, virgule française, sans zéro inutile', () => {
    egal([25, 2.5, 22.04, 22.06, 0.25, 7.95].map(virgule), ['25', '2,5', '22', '22,1', '0,3', '8'], 'arrondis');
  }],
  ['h : style en texte CSS, aria-* et data-* en attributs, le reste en propriétés ; les enfants suivent', () => {
    avecFaux(() => {
      const enfant = globalThis.document.createElement('b');
      const e = h('div', { className: 'x', style: 'color: red;', 'aria-label': 'L', 'data-groupe': 'g', hidden: true }, enfant, 'texte');
      egal([e.tagName.toLowerCase(), e.className, e.hidden], ['div', 'x', true], 'propriétés');
      egal(e.style.cssText, 'color: red;', 'style');
      egal([e.getAttribute('aria-label'), e.getAttribute('data-groupe')], ['L', 'g'], 'attributs');
      egal(e.childNodes.length, 2, 'enfants');
      egal(h('p').childNodes.length, 0, 'sans propriétés ni enfants');
    });
  }],
  ['bouton : de type button, avec son texte, sa classe et son clic', () => {
    avecFaux(() => {
      let clics = 0;
      const b = bouton('Fermer', () => { clics++; }, 'discret petit');
      egal([b.tagName.toLowerCase(), b.type, b.textContent, b.className], ['button', 'button', 'Fermer', 'discret petit'], 'bouton');
      b.click();
      egal(clics, 1, 'clic');
      egal(bouton('Ok', () => {}).className, '', 'classe vide par défaut');
    });
  }],
  ['deuxTemps : le premier clic demande confirmation, le second agit ; 4 s sans suite ou une perte de focus annulent', () => {
    avecFaux((minuteurs) => {
      const b = fauxElement('button');
      let actions = 0;
      const reinit = deuxTemps(b, 'Supprimer', 'Confirmer ?', () => { actions++; });
      egal([b.textContent, b.dataset.confirme], ['Supprimer', ''], 'au repos');
      b.emettre('click');
      egal([b.textContent, b.dataset.confirme, b.classList.contains('danger'), actions], ['Confirmer ?', '1', true, 0], 'premier clic');
      egal([...minuteurs.values()].map((m) => m.ms), [4000], 'annulation au bout de 4 s');
      [...minuteurs.values()][0].f();
      egal([b.textContent, b.classList.contains('danger'), actions], ['Supprimer', false, 0], 'délai écoulé');
      b.emettre('click'); b.emettre('click');
      egal([actions, b.textContent, b.classList.contains('danger')], [1, 'Supprimer', false], 'second clic');
      b.emettre('click'); b.emettre('blur');
      egal([b.textContent, b.dataset.confirme], ['Supprimer', ''], 'perte de focus');
      b.emettre('click'); reinit();
      egal([b.textContent, b.classList.contains('danger')], ['Supprimer', false], 'la fonction rendue remet au repos');
      verifier(b.style.minWidth === undefined, 'sans annonce, la largeur n’est pas touchée');
    });
  }],
  ['deuxTemps avec annonce : largeur figée, zone montrée puis vidée', () => {
    avecFaux(() => {
      const b = fauxElement('button'), zone = { hidden: false, textContent: 'ancien' };
      let actions = 0;
      deuxTemps(b, 'Retirer', 'Confirmer', () => { actions++; }, { zone, texte: () => 'La salle 2 sera supprimée.' });
      egal([zone.hidden, zone.textContent], [true, ''], 'zone cachée au repos');
      b.emettre('click');
      egal([b.style.minWidth, zone.hidden, zone.textContent], ['80px', false, 'La salle 2 sera supprimée.'], 'après le premier clic');
      b.emettre('click');
      egal([actions, b.style.minWidth, zone.hidden, zone.textContent], [1, '', true, ''], 'après le second');
    });
  }],
  ['sansAccents : minuscules, sans accents ni espaces de bord ; rien ou null donne le texte vide', () => {
    egal(['  Élémentaire ', 'ÀÉÎÔÛ ç œ', 'déjà', '', null, undefined].map(sansAccents), ['elementaire', 'aeiou c œ', 'deja', '', '', ''], 'textes');
    egal(sansAccents(0), '0', 'un nombre est un texte');
  }],
  ['estObjet : un objet JSON au sens strict, ni null ni tableau', () => {
    egal([{}, { a: 1 }, null, undefined, [], [1], 'x', 3, true].map(estObjet), [true, true, false, false, false, false, false, false, false], 'valeurs');
  }],
  ['fichierChoisi : rend le premier fichier et vide le champ (même fichier rechoisi = nouvel événement)', () => {
    const champ = { files: ['a.json'], value: 'a.json' };
    egal(fichierChoisi({ target: champ }), 'a.json', 'fichier');
    egal(champ.value, '', 'champ vidé');
    egal(fichierChoisi({ target: { files: [], value: 'x' } }), undefined, 'aucun fichier');
  }],
];

export const executer = () => executerSuite('outils communs : ', TESTS);
