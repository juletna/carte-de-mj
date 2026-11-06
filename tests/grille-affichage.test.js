/** Tests de la préférence de grille commune (js/atelier/grille-affichage.js, fonctions pures). */
import { appliquerCases, casesApresBascule } from '../js/atelier/grille-affichage.js';
import { casesDeReglages } from '../js/affichage.js';
import { egal, executerSuite } from './mini-test.js';

const TESTS = [
  ['appliquerCases borne, arrondit et garde le booléen d’avant', () => {
    const r = {};
    egal(appliquerCases(r, 140), 100, 'borné haut'); egal(r.grille, true, 'grille vraie');
    egal(appliquerCases(r, -3), 0, 'borné bas'); egal(r.grille, false, 'grille fausse'); egal(casesDeReglages(r), 0, 'lue');
    egal(appliquerCases(r, '35.4'), 35, 'texte du curseur');
  }],
  ['la bascule masque puis rend la dernière opacité visible', () => {
    egal(casesApresBascule({ cases: 40 }, 40), 0, 'visible → masquée');
    egal(casesApresBascule({ cases: 0 }, 40), 40, 'masquée → dernière');
    egal(casesApresBascule({ cases: 0 }, 0), 60, 'sans mémoire : défaut');
    egal(casesApresBascule({}, 0), 0, 'défaut visible → masquée');
  }],
];

export async function executer() {
  return executerSuite('grille (préférence d’affichage) : ', TESTS);
}
