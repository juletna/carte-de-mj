/**
 * Tests des tables du schéma (js/schema.js) : genre → liste du plan (LISTES), que le modèle, la pose, la présentation et le glisser-déposer lisent ; sols.
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

export const executer = () => executerSuite('schéma : ', TESTS);
