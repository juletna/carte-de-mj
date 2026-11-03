/**
 * Tests de l'historique d'annulation du Donjon (js/historique.js, pur). Sans dépendance : marche sous Node et dans tests.html.
 */
import { creerHistorique, PROFONDEUR_MAX } from '../js/historique.js';
import { verifier, egal, executerSuite } from './mini-test.js';

const TESTS = [
  ['une pile par salle : la même pile se retrouve, une autre salle ou un autre donjon a la sienne', () => {
    const h = creerHistorique();
    egal(h.pile('d1', 's1'), [], 'neuve');
    h.pile('d1', 's1').push({ texte: 'a' });
    verifier(h.pile('d1', 's1') === h.pile('d1', 's1'), 'même tableau');
    egal([h.pile('d1', 's2').length, h.pile('d2', 's1').length, h.pile('d1', 's1').length], [0, 0, 1], 'salles et donjons séparés');
  }],
  ['memoriser empile ; annuler (pop) rend les entrées dans l’ordre inverse', () => {
    const h = creerHistorique();
    for (const texte of ['a', 'b', 'c']) h.memoriser('d1', 's1', { texte, ancres: [], liaisons: [] });
    egal(h.pile('d1', 's1').pop().texte, 'c', 'la plus récente d’abord');
    egal(h.pile('d1', 's1').pop().texte, 'b', 'puis la précédente');
    egal(h.pile('d1', 's1').length, 1, 'il en reste une');
  }],
  ['la pile garde au plus PROFONDEUR_MAX entrées : la plus ancienne part', () => {
    const h = creerHistorique();
    egal(PROFONDEUR_MAX, 100, 'profondeur');
    for (let i = 0; i < PROFONDEUR_MAX + 5; i++) h.memoriser('d1', 's1', { texte: String(i) });
    const p = h.pile('d1', 's1');
    egal([p.length, p[0].texte, p.at(-1).texte], [PROFONDEUR_MAX, '5', String(PROFONDEUR_MAX + 4)], 'taille, plus ancienne, plus récente');
  }],
  ['vider la pile (length = 0) la garde utilisable ; oublierSalle la fait disparaître sans toucher aux autres', () => {
    const h = creerHistorique();
    h.memoriser('d1', 's1', { texte: 'a' }); h.memoriser('d1', 's2', { texte: 'b' });
    h.pile('d1', 's1').length = 0;
    egal(h.pile('d1', 's1'), [], 'vidée');
    h.oublierSalle('d1', 's2');
    egal(h.pile('d1', 's2'), [], 'oubliée : neuve à la prochaine demande');
    h.memoriser('d1', 's1', { texte: 'c' });
    egal(h.pile('d1', 's1').length, 1, 'l’autre salle intacte');
  }],
  ['oublierDonjon : toutes les salles du donjon, et seulement les siennes (« d1 » n’emporte pas « d10 »)', () => {
    const h = creerHistorique();
    for (const [d, s] of [['d1', 's1'], ['d1', 's2'], ['d10', 's1'], ['d2', 's1']]) h.memoriser(d, s, { texte: `${d}/${s}` });
    h.oublierDonjon('d1');
    egal([h.pile('d1', 's1').length, h.pile('d1', 's2').length, h.pile('d10', 's1').length, h.pile('d2', 's1').length], [0, 0, 1, 1], 'piles restantes');
  }],
];

export const executer = () => executerSuite('historique : ', TESTS);
