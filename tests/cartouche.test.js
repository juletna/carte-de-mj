/** Tests du cartouche d'échelle (js/atelier/cartouche.js, fonctions pures). */
import { cartoucheSalle, cartoucheLieu, cartoucheEnsemble, phraseEchelle } from '../js/atelier/cartouche.js';
import { egal, executerSuite } from './mini-test.js';

const TESTS = [
  ['une salle : cases, mètres et échelle ; la version courte tient à 375 px', () => {
    egal(cartoucheSalle(8, 6, 1.5), { long: '8 × 6 cases · 12 × 9 m · 1 case = 1,5 m', moyen: '8 × 6 cases · 12 × 9 m', court: '8 × 6 · 12 × 9 m' }, 'salle de 8 × 6');
    egal(cartoucheSalle(3, 8, 1.5).long, '3 × 8 cases · 4,5 × 12 m · 1 case = 1,5 m', 'virgule française');
    egal(cartoucheSalle(5, 5, 0.5), { long: '5 × 5 cases · 2,5 × 2,5 m · 1 case = 0,5 m', moyen: '5 × 5 cases · 2,5 × 2,5 m', court: '5 × 5 · 2,5 × 2,5 m' }, 'demi-mètre');
  }],
  ['une salle sans échelle valide ne dit que les cases ; sans taille, rien', () => {
    egal(cartoucheSalle(4, 4, 0), { long: '4 × 4 cases', moyen: '4 × 4 cases', court: '4 × 4' }, 'cases seules');
    egal(cartoucheSalle(0, 4, 1.5), null, 'taille invalide');
    egal(cartoucheSalle(undefined, 4, 1.5), null, 'taille inconnue');
  }],
  ['un lieu à grille dit sa taille sans l’échelle ; sans grille ou sans dimensions, rien', () => {
    egal(cartoucheLieu({ case: 50, dx: 0, dy: 0 }, 1200, 1800, 1.5), { long: '24 × 36 cases · 36 × 54 m', moyen: '24 × 36 cases · 36 × 54 m', court: '24 × 36 · 36 × 54 m' }, 'lieu à grille');
    egal(cartoucheLieu(null, 1200, 1800, 1.5), null, 'lieu sans grille');
    egal(cartoucheLieu({ case: 50 }, undefined, 1800, 1.5), null, 'dimensions inconnues');
  }],
  ['la vue d’ensemble dit l’échelle seule', () => {
    egal(cartoucheEnsemble(1.5), { long: '1 case = 1,5 m', moyen: '1 case = 1,5 m', court: '1 case = 1,5 m' }, 'échelle par défaut');
    egal(cartoucheEnsemble(2), { long: '1 case = 2 m', moyen: '1 case = 2 m', court: '1 case = 2 m' }, 'échelle entière sans virgule');
    egal(cartoucheEnsemble(0), null, 'échelle invalide');
    egal(phraseEchelle(NaN), '', 'phrase vide');
  }],
];

export async function executer() {
  return executerSuite('cartouche d’échelle : ', TESTS);
}
