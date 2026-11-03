/**
 * Tests des libellés de coordonnées (js/parseur/coordonnees.js) : repère d'une porte et texte d'une sélection,
 * que le Donjon, la régie, le générateur, l'impression et decrire() écrivent tous de la même façon.
 * Sans dépendance : marche sous Node et dans tests.html.
 */
import { lettreColonne, indexColonne, nomCase, lireCase, reperePorte, libelleDePorte, libelleSelection } from '../js/parseur/coordonnees.js';
import { libellePorte } from '../js/impression.js';
import { decrire } from '../js/parseur/decrire.js';
import { egal, executerSuite } from './mini-test.js';

const TESTS = [
  ['cases façon échecs : lettres, numéros, aller-retour', () => {
    egal([lettreColonne(0), lettreColonne(25), lettreColonne(26), lettreColonne(53)], ['A', 'Z', 'AA', 'BB'], 'lettres');
    egal([indexColonne('c'), indexColonne('aa'), nomCase(2, 3), lireCase('c4'), lireCase('4c')], [2, 26, 'C4', [2, 3], null], 'lecture');
  }],
  ['reperePorte : une lettre au nord et au sud, un numéro à l’est et à l’ouest (toujours du texte)', () => {
    egal([reperePorte('nord', 3), reperePorte('sud', 0), reperePorte('est', 3), reperePorte('ouest', 0)], ['D', 'A', '4', '1'], 'repères');
    egal(typeof reperePorte('est', 0), 'string', 'type');
  }],
  ['libelleDePorte et libellePorte (impression) disent la même position', () => {
    egal(libelleDePorte({ type: 'herse', mur: 'est', position: 5 }), 'herse · mur est, repère 6', 'libellé');
    egal(libellePorte('nord', 2), 'mur nord en C', 'impression');
    const plan = { largeur: 6, longueur: 6, sol: 'pierre', portes: [{ type: 'porte', mur: 'sud', position: 3 }, { type: 'herse', mur: 'ouest', position: 1, cache: true }], objets: [] };
    egal(decrire(plan).includes('une porte au mur sud en D') && decrire(plan).includes('une herse secrète au mur ouest en 2'), true, 'decrire');
  }],
  ['libelleSelection : porte, créature (nom remplaçable), objet', () => {
    egal(libelleSelection({ genre: 'porte', element: { type: 'porte', mur: 'nord', position: 1 } }), 'porte · mur nord, repère B', 'porte');
    egal(libelleSelection({ genre: 'objet', element: { type: 'coffre', x: 1, y: 2 } }), 'coffre · B3', 'objet');
    const gobelin = { type: 'gobelin', numero: 2, x: 2, y: 3 };
    egal(libelleSelection({ genre: 'creature', element: gobelin }), 'gobelin 2 · C4', 'créature');
    egal(libelleSelection({ genre: 'creature', element: gobelin }, (k) => `Brune (P${k.numero})`), 'Brune (P2) · C4', 'nom du personnage');
  }],
];

export const executer = () => executerSuite('coordonnées : ', TESTS);
