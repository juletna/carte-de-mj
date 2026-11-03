/**
 * Tests des tables du schéma (js/schema.js) : genre → liste du plan (LISTES), que le modèle, la pose, la présentation et le glisser-déposer lisent ; sols ; l'état facultatif d'une créature (`etat`).
 * Sans dépendance : marche sous Node et dans tests.html.
 */
import { validerPlan, LISTES, SOLS, NOMS_SOLS } from '../js/schema.js';
import { analyser } from '../js/parseur/index.js';
import { verifier, egal, executerSuite } from './mini-test.js';

const TESTS = [
  ['LISTES : chaque genre désigne une liste du plan validé, dans l’ordre porte, objet, créature', () => {
    egal(LISTES, { porte: 'portes', objet: 'objets', creature: 'creatures' }, 'table');
    egal(Object.keys(LISTES), ['porte', 'objet', 'creature'], 'ordre (il décide de l’ordre des éléments parcourus)');
    const { plan } = validerPlan({ largeur: 6, longueur: 6, sol: 'pierre', portes: [], objets: [] });
    for (const liste of Object.values(LISTES)) verifier(Array.isArray(plan[liste]), `le plan a une liste « ${liste} »`);
  }],
  ['SOLS : chaque sol a son nom, et chaque sol se lit dans une description', () => {
    egal(Object.keys(NOMS_SOLS), SOLS, 'un nom par sol, dans l’ordre');
    for (const sol of SOLS) {
      egal(analyser(`salle de 6 par 6, sol en ${sol}`).plan.sol, sol, `« sol en ${sol} »`);
      verifier(NOMS_SOLS[sol].toLowerCase() === sol, `${sol} : nom « ${NOMS_SOLS[sol]} »`);
    }
  }],
];

const TESTS_PRESENTATION = [
  ['schéma : etat est facultatif sur une créature, borné à blessé / mort ; un plan sans état ne change pas', () => {
    const base = { largeur: 4, longueur: 4, creatures: [{ type: 'gobelin', x: 0, y: 0 }, { type: 'gobelin', x: 1, y: 0, etat: 'blesse' }, { type: 'gobelin', x: 2, y: 0, etat: 'x' }] };
    const r = validerPlan(base).plan.creatures;
    egal(r.map((k) => k.etat), [undefined, 'blesse', undefined], 'états');
    verifier(!JSON.stringify(validerPlan({ ...base, creatures: [base.creatures[0]] }).plan).includes('etat'), 'aucun champ « etat » inventé');
  }],
];

export const executer = () => [...executerSuite('schéma : ', TESTS), ...executerSuite('présentation : ', TESTS_PRESENTATION)];
