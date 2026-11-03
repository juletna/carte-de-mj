/**
 * Tests des calculs de mise en page du Donjon (js/mise-en-page.js, pur) : la bulle de sélection, les pas du zoom, la taille du plan.
 * Sans dépendance : marche sous Node et dans tests.html.
 */
import {
  ZOOM_MIN, ZOOM_MAX, PLAN_ZOOM_MIN, PLAN_ZOOM_MAX, PLAN_AJUSTE_MIN, PLAN_AJUSTE_DEFAUT, ECART_BULLE,
  zoomBorne, pasDeZoom, facteurMolette, tailleAfficheePlan, hauteurMaxBulle, positionBulle,
} from '../js/mise-en-page.js';
import { TAILLE_MAX_REMPLIR } from '../js/affichage.js';
import { verifier, egal, executerSuite } from './mini-test.js';

const proche = (a, b) => Math.abs(a - b) < 1e-9;
/** Une scène de 1000 × 600 px à l'origine, avec 8 px de retrait. */
const VUE = { g: 8, h: 8, d: 992, b: 592 };
const rect = (g, h, l, ha) => ({ g, h, d: g + l, b: h + ha });

const TESTS = [
  ['zoomBorne : arrondi, borné, et « ajuster » (null) reste null', () => {
    egal([zoomBorne(null, 8, 300), zoomBorne(3, 8, 300), zoomBorne(48.6, 8, 300), zoomBorne(999, 8, 300)], [null, 8, 49, 300], 'bornes');
    egal([ZOOM_MIN, ZOOM_MAX], [8, TAILLE_MAX_REMPLIR], 'le zoom de la salle va jusqu’à la plus grande case de « remplir »');
    egal([PLAN_ZOOM_MIN, PLAN_ZOOM_MAX], [3, 80], 'zoom du plan');
  }],
  ['pasDeZoom : ×1,25 ou ÷1,25, d’au moins 1 px dans chaque sens', () => {
    egal([pasDeZoom(48, 1), pasDeZoom(48, -1)], [60, 38.4], 'grande case');
    egal([pasDeZoom(2, 1), pasDeZoom(2, -1)], [3, 1], 'petite case : au moins 1 px');
    egal([pasDeZoom(48, 5), pasDeZoom(48, 0)], [60, 38.4], 'seul le signe compte, et zéro réduit');
  }],
  ['facteurMolette : exponentielle de la molette, bornée à ±50', () => {
    verifier(proche(facteurMolette(0), 1), 'sans mouvement : 1');
    verifier(proche(facteurMolette(-10), Math.exp(0.1)) && proche(facteurMolette(10), Math.exp(-0.1)), 'molette vers le haut agrandit');
    verifier(proche(facteurMolette(5000), Math.exp(-0.5)) && proche(facteurMolette(-5000), Math.exp(0.5)), 'un coup brusque est borné');
  }],
  ['tailleAfficheePlan : le zoom choisi, sinon le plan remplit la scène (entre 4 et 80 px) ; scène masquée ou plan absent : 16', () => {
    const dispo = { largeur: 40, longueur: 20 };
    egal(tailleAfficheePlan({ zoom: 33, dispo, largeur: 800, hauteur: 600 }), 33, 'zoom choisi');
    egal(tailleAfficheePlan({ zoom: null, dispo, largeur: 800, hauteur: 600 }), 20, 'limité par la largeur : 800 / 40');
    egal(tailleAfficheePlan({ zoom: null, dispo, largeur: 800, hauteur: 300 }), 15, 'limité par la hauteur : 300 / 20, arrondi en bas');
    egal(tailleAfficheePlan({ zoom: null, dispo, largeur: 90, hauteur: 600 }), PLAN_AJUSTE_MIN, 'jamais sous 4 px : la scène défile');
    egal(tailleAfficheePlan({ zoom: null, dispo: { largeur: 2, longueur: 2 }, largeur: 800, hauteur: 600 }), PLAN_ZOOM_MAX, 'jamais au-dessus de 80 px');
    egal([tailleAfficheePlan({ zoom: null, dispo, largeur: 0, hauteur: 600 }), tailleAfficheePlan({ zoom: null, dispo, largeur: 800, hauteur: 0 }), tailleAfficheePlan({ zoom: null, dispo: null, largeur: 800, hauteur: 600 })], [PLAN_AJUSTE_DEFAUT, PLAN_AJUSTE_DEFAUT, PLAN_AJUSTE_DEFAUT], 'scène masquée, plan absent');
    egal(tailleAfficheePlan({ zoom: 0, dispo, largeur: 800, hauteur: 600 }), 20, 'un zoom nul ne compte pas');
  }],
  ['hauteurMaxBulle : la place visible, jamais sous 120 px', () => {
    egal([hauteurMaxBulle(VUE), hauteurMaxBulle({ h: 8, b: 100 }), hauteurMaxBulle({ h: 50, b: 20 })], [584, 120, 120], 'hauteurs');
  }],
  ['positionBulle : à droite d’abord, puis à gauche, dessous, dessus ; recalée dans la zone visible', () => {
    const w = 200, ha = 150, e = ECART_BULLE;
    // Élément au milieu : à droite, la bulle part du haut de l’élément moins 6 px.
    let a = rect(400, 300, 50, 50);
    egal(positionBulle(a, VUE, w, ha), { x: a.d + e, y: a.h - 6 }, 'à droite');
    // Élément au bord droit : à gauche.
    a = rect(900, 300, 50, 50);
    egal(positionBulle(a, VUE, w, ha), { x: a.g - e - w, y: a.h - 6 }, 'à gauche');
    // Scène étroite (ni à droite ni à gauche) : dessous, alignée à gauche de l’élément.
    const etroite = { g: 8, h: 8, d: 330, b: 592 };
    a = rect(100, 100, 60, 60);
    egal(positionBulle(a, etroite, w, ha), { x: a.g, y: a.b + e }, 'dessous');
    // Même scène, élément en bas : dessus.
    a = rect(100, 450, 60, 130);
    egal(positionBulle(a, etroite, w, ha), { x: a.g, y: a.h - e - ha }, 'dessus');
  }],
  ['positionBulle : la bulle glisse pour rester dans la zone visible, et si rien ne tient, c’est l’essai de droite recalé', () => {
    const w = 200, ha = 150;
    // À droite, mais l’élément est tout en bas : la bulle remonte pour rester visible.
    let p = positionBulle(rect(400, 560, 50, 30), VUE, w, ha);
    egal(p, { x: 460, y: VUE.b - ha }, 'recalée vers le haut');
    // Élément au-dessus de la zone visible (carte zoomée qui déborde) : la bulle est ramenée en haut.
    p = positionBulle(rect(400, -300, 50, 50), VUE, w, ha);
    egal(p.y, VUE.h, 'ramenée en haut');
    // Bulle plus grande que la zone : aucun essai ne tient, on prend celui de droite, recalé au bord gauche puis au bord haut.
    p = positionBulle(rect(400, 300, 50, 50), { g: 8, h: 8, d: 100, b: 100 }, 500, 500);
    egal(p, { x: 8, y: 8 }, 'rien ne tient');
    verifier(p.x >= 8 && p.y >= 8, 'jamais avant la zone');
  }],
];

export const executer = () => executerSuite('mise en page : ', TESTS);
