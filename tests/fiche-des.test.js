/**
 * Tests des dés de la Fiche (js/fiche/des.js) : expressions, tirage borné, modificateur, signe, bonus de maîtrise.
 * Sans dépendance : marche sous Node et dans tests.html.
 */
import { rnd, mod, sg, profFor, rollExpr } from '../js/fiche/des.js';
import { verifier, egal, executerSuite } from './mini-test.js';

/** Un tirage imposé : rend les valeurs données dans l'ordre (et note les nombres de faces demandés). */
const impose = (valeurs, faces = []) => { let i = 0; return (d) => { faces.push(d); return valeurs[i++]; }; };

const TESTS = [
  ['rnd : toujours entre 1 et le nombre de faces, toutes les faces sortent', () => {
    const vus = new Set();
    for (let i = 0; i < 400; i++) { const v = rnd(6); verifier(Number.isInteger(v) && v >= 1 && v <= 6, `d6 = ${v}`); vus.add(v); }
    egal([...vus].sort(), [1, 2, 3, 4, 5, 6], 'les six faces');
    for (let i = 0; i < 50; i++) egal(rnd(1), 1, 'd1');
  }],
  ['modificateur, signe et bonus de maîtrise', () => {
    egal([1, 8, 9, 10, 11, 12, 20, 30].map(mod), [-5, -1, -1, 0, 0, 1, 5, 10], 'modificateurs');
    egal([sg(3), sg(0), sg(-2)], ['+3', '+0', '−2'], 'signe (le moins typographique)');
    egal([1, 4, 5, 8, 9, 12, 13, 16, 17, 20].map(profFor), [2, 2, 3, 3, 4, 4, 5, 5, 6, 6], 'maîtrise par niveau');
    egal([0, -4, 25, 99].map(profFor), [2, 2, 6, 6], 'niveau borné à 1..20');
  }],
  ['rollExpr : dés, constantes et signes, avec des tirages imposés', () => {
    const faces = [];
    egal(rollExpr('1d8+3', false, impose([5], faces)), { tot: 8, det: '[5] + 3' }, '1d8+3');
    egal(faces, [8], 'un d8 demandé');
    egal(rollExpr('2d6+1d4+2', false, impose([3, 4, 2])), { tot: 11, det: '[3,4] [2] + 2' }, '2d6+1d4+2');
    egal(rollExpr('d10-1', false, impose([7])), { tot: 6, det: '[7] − 1' }, 'd10-1 (« d » seul = un dé)');
    egal(rollExpr(' 1D6 + 1 ', false, impose([2])), { tot: 3, det: '[2] + 1' }, 'espaces et majuscules');
    egal(rollExpr('2d6-1d4', false, impose([6, 6, 4])), { tot: 8, det: '[6,6] − [4]' }, 'un dé retiré');
  }],
  ['rollExpr : le critique double les dés, jamais les constantes ; une expression illisible vaut 0', () => {
    const faces = [];
    egal(rollExpr('1d8+3', true, impose([5, 4], faces)), { tot: 12, det: '[5,4] + 3' }, '2 dés au lieu d’1');
    egal(faces, [8, 8], 'deux d8');
    egal(rollExpr('', false, impose([])), { tot: 0, det: '—' }, 'vide');
    egal(rollExpr('abc', false, impose([])), { tot: 0, det: '—' }, 'illisible');
    egal(rollExpr(undefined, false, impose([])), { tot: 0, det: '—' }, 'absent');
    egal(rollExpr('3', false, impose([])), { tot: 3, det: '+ 3' }, 'constante seule');
  }],
];

export async function executer() {
  return executerSuite('fiche (dés) : ', TESTS);
}
