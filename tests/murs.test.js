/**
 * Tests de la source unique des murs (js/murs.js) et de la limite de taille d'une salle (CASES_MAX),
 * que le schéma, le parseur et la pose partagent. Sans dépendance : marche sous Node et dans tests.html.
 */
import { MURS, OPPOSE, REGARD, REGARD_VERS, VECTEUR, estHorizontal, longueurMur, portesEntreeDabord, murEntree } from '../js/murs.js';
import { validerPlan, CASES_MAX } from '../js/schema.js';
import { analyser } from '../js/parseur/index.js';
import { redimensionner } from '../js/pose.js';
import { verifier, egal, executerSuite } from './mini-test.js';

const plan = (largeur, longueur) => ({ largeur, longueur, sol: 'pierre', portes: [], objets: [] });

const TESTS = [
  ['les quatre murs, chacun avec son opposé, qui est une involution', () => {
    egal([...MURS].sort(), ['est', 'nord', 'ouest', 'sud'], 'murs');
    for (const m of MURS) {
      verifier(OPPOSE[m] && OPPOSE[m] !== m, `${m} a un opposé`);
      egal(OPPOSE[OPPOSE[m]], m, `opposé de l’opposé de ${m}`);
    }
  }],
  ['estHorizontal et longueurMur : nord et sud courent le long de la largeur, est et ouest le long de la longueur', () => {
    egal(MURS.map(estHorizontal), [true, true, false, false], 'estHorizontal');
    egal(MURS.map((m) => longueurMur(m, 7, 9)), [7, 7, 9, 9], 'longueurMur');
    egal([estHorizontal(undefined), estHorizontal('haut')], [false, false], 'un mur inconnu n’est pas horizontal');
  }],
  ['regards : vers le mur, adossé au mur (= vers le mur opposé), et leur sens sur la carte', () => {
    egal(REGARD_VERS, { nord: 0, est: 90, sud: 180, ouest: 270 }, 'vers un mur');
    egal(REGARD, { nord: 180, sud: 0, est: 270, ouest: 90 }, 'adossé à un mur');
    for (const m of MURS) egal(REGARD[m], REGARD_VERS[OPPOSE[m]], `adossé au ${m} = regarde vers le ${OPPOSE[m]}`);
    // Une rotation de 0° regarde vers le haut de la carte (y décroissant), 90° vers la droite : c'est le vecteur du mur.
    const sens = { 0: [0, -1], 90: [1, 0], 180: [0, 1], 270: [-1, 0] };
    for (const m of MURS) egal(sens[REGARD_VERS[m]], VECTEUR[m], `vecteur du ${m}`);
  }],
  ['vecteurs : opposés pour des murs opposés, ordre des murs fixé (il décide des tirages du générateur)', () => {
    for (const m of MURS) egal([VECTEUR[m][0] + VECTEUR[OPPOSE[m]][0], VECTEUR[m][1] + VECTEUR[OPPOSE[m]][1]], [0, 0], `${m} et son opposé`);
    egal(Object.keys(VECTEUR), ['nord', 'sud', 'est', 'ouest'], 'ordre des clés');
  }],
  ['portesEntreeDabord, murEntree : la porte du mur d’entrée passe devant, les autres gardent leur ordre ; sans porte, le sud', () => {
    const portes = [{ id: 'a', mur: 'est' }, { id: 'b', mur: 'nord' }, { id: 'c', mur: 'est' }, { id: 'd', mur: 'sud' }];
    const ids = (p) => portesEntreeDabord(p).map((q) => q.id).join('');
    egal(ids({ portes, entree: 'nord' }), 'bacd', 'entrée au nord');
    egal(ids({ portes, entree: 'est' }), 'acbd', 'entrée à l’est : ordre du plan à égalité');
    egal(ids({ portes, entree: 'ouest' }), 'abcd', 'aucune porte à l’entrée : ordre du plan');
    egal(portes.map((q) => q.id).join(''), 'abcd', 'le plan n’est pas modifié');
    egal([murEntree({ portes, entree: 'nord' }), murEntree({ portes, entree: 'sud' }), murEntree({ portes: [], entree: 'est' })], ['nord', 'sud', 'sud'], 'mur d’entrée');
    egal(murEntree({ portes, entree: 'ouest' }), 'est', 'sans porte à l’entrée : la première porte');
  }],
  ['CASES_MAX : le schéma, le parseur et la pose refusent ou bornent à la même limite', () => {
    egal(CASES_MAX, 60, 'la limite');
    verifier(validerPlan(plan(CASES_MAX, CASES_MAX)).plan, 'la taille limite est valide');
    verifier(!validerPlan(plan(CASES_MAX + 1, 5)).plan, 'une case de plus est refusée');
    const lu = analyser('Salle de 200 par 80 cases').plan;
    egal([lu.largeur, lu.longueur], [CASES_MAX, CASES_MAX], 'le parseur borne');
    verifier(redimensionner(plan(CASES_MAX, 5), 'est', 1).erreur, 'la pose refuse de dépasser');
    verifier(redimensionner(plan(CASES_MAX - 1, 5), 'est', 1).plan, 'la pose accepte d’atteindre la limite');
  }],
];

export const executer = () => executerSuite('murs : ', TESTS);
