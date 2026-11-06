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
  ['Masquer puis Afficher rend la dernière opacité, même après un rechargement (champ facultatif casesAvant)', () => {
    const r = { cases: 35, grille: true };
    appliquerCases(r, 0);
    egal(r.casesAvant, 35, 'l’opacité visible est gardée pendant le masquage');
    // Un rechargement : seul le contenu des réglages survit, pas la mémoire du contrôle.
    egal(casesApresBascule({ ...r }, 0), 35, 'Afficher rend 35 % et non 60 %');
    appliquerCases(r, 35);
    egal('casesAvant' in r, false, 'effacé dès que les lignes se voient');
    const d = { cases: 60 };
    appliquerCases(d, 0);
    egal('casesAvant' in d, false, 'rien d’écrit quand l’opacité est celle par défaut');
    egal(casesApresBascule(d, 0), 60, 'et Afficher rend 60 %');
    const c = { cases: 80 };
    appliquerCases(c, 0); appliquerCases(c, 0);
    egal(c.casesAvant, 80, 'masquer deux fois ne perd pas la valeur');
    const n = { cases: 0, casesAvant: 25 };
    appliquerCases(n, 40);
    egal([n.cases, 'casesAvant' in n], [40, false], 'le curseur depuis « masquée » efface la mémoire');
  }],
];

export async function executer() {
  return executerSuite('grille (préférence d’affichage) : ', TESTS);
}
