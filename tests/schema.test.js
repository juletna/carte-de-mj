/**
 * Tests de la table genre → liste du plan (LISTES de js/schema.js), que le modèle, la pose, la présentation et le glisser-déposer lisent.
 * Sans dépendance : marche sous Node et dans tests.html.
 */
import { validerPlan, LISTES } from '../js/schema.js';
import { verifier, egal, executerSuite } from './mini-test.js';

const TESTS = [
  ['LISTES : chaque genre désigne une liste du plan validé, dans l’ordre porte, objet, créature', () => {
    egal(LISTES, { porte: 'portes', objet: 'objets', creature: 'creatures' }, 'table');
    egal(Object.keys(LISTES), ['porte', 'objet', 'creature'], 'ordre (il décide de l’ordre des éléments parcourus)');
    const { plan } = validerPlan({ largeur: 6, longueur: 6, sol: 'pierre', portes: [], objets: [] });
    for (const liste of Object.values(LISTES)) verifier(Array.isArray(plan[liste]), `le plan a une liste « ${liste} »`);
  }],
];

export const executer = () => executerSuite('schéma : ', TESTS);
