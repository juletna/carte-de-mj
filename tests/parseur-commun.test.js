/**
 * Tests des petits outils communs du parseur : le hachage de la graine et la préparation du texte, que `analyser` et les commandes partagent.
 * Sans dépendance : marche sous Node et dans tests.html.
 */
import { hacher, preparer } from '../js/parseur/index.js';
import { normaliser } from '../js/parseur/normaliser.js';
import { verifier, egal, executerSuite } from './mini-test.js';

const TESTS = [
  ['hacher : FNV-1a sur 32 bits, stable (valeurs de référence), toujours un entier non signé', () => {
    egal([hacher(''), hacher('a'), hacher('Salle de 12 par 8')], [2166136261, 3826002220, 2376767753], 'valeurs de référence');
    verifier(['', 'é', 'une salle de 4 par 5 avec des gobelins'].every((s) => Number.isInteger(hacher(s)) && hacher(s) >= 0 && hacher(s) < 2 ** 32), 'entier sur 32 bits');
  }],
  ['preparer : normalise, met les nombres en chiffres et soude les expressions, dans cet ordre', () => {
    egal(preparer('Une Salle de 4,5 m par douze, ÉLÉGANTE!'), '1 salle de 4.5 m par 12 , elegante !', 'texte préparé');
    egal(preparer('   '), '', 'texte vide');
    egal(preparer('Salle de 12x8 avec un coffre'), preparer(normaliser('Salle de 12x8 avec un coffre')), 'la normalisation vient en premier');
  }],
];

export const executer = () => executerSuite('parseur commun : ', TESTS);
