/**
 * Tests du calage de grille sur une carte image (js/univers-grille.js, definirGrilleLieu, message de table).
 */
import * as g from '../js/univers-grille.js';
import * as u from '../js/univers.js';
import * as p from '../js/univers-partie.js';
import { validerUnivers } from '../js/univers-validation.js';
import { messageUnivers, lireVueUnivers } from '../js/univers-protocole.js';
import { AFFICHAGE_PAR_DEFAUT } from '../js/affichage.js';
import { verifier, egal, executerSuite } from './mini-test.js';

const IMG = { source: 'bibliotheque', id: 'carte-1' };
const DIMS = { largeur: 1024, hauteur: 768 };
const proche = (a, b, eps, quoi) => verifier(Math.abs(a - b) <= eps, `${quoi} : ${a} au lieu de ${b}`);

const TESTS = [
  ['normaliser : bornes de la case, décalages dans [0, case), dixième de pixel, rien d’exploitable → null', () => {
    egal(g.normaliserGrille({ case: 70, dx: 5, dy: 0 }), { case: 70, dx: 5, dy: 0 }, 'inchangée');
    egal(g.normaliserGrille({ case: 70, dx: 75.04, dy: -10 }), { case: 70, dx: 5, dy: 60 }, 'décalage ramené');
    egal(g.normaliserGrille({ case: 2 }).case, g.CASE_MIN, 'trop petite');
    egal(g.normaliserGrille({ case: 99999 }).case, g.CASE_MAX, 'trop grande');
    egal(g.normaliserGrille({ case: 900 }, DIMS).case, 384, 'au plus la moitié du petit côté de l’image');
    egal(g.normaliserGrille({ case: 33.33333, dx: 'x' }), { case: 33.3, dx: 0, dy: 0 }, 'arrondi, décalage non numérique');
    for (const mauvais of [null, undefined, 3, 'a', [], {}, { case: 0 }, { case: -4 }, { case: NaN }, { case: '70' }, { case: Infinity }]) egal(g.normaliserGrille(mauvais), null, `refusée : ${JSON.stringify(mauvais)}`);
    const t = g.normaliserGrille({ case: 70, dx: 69.97 });
    verifier(t.dx >= 0 && t.dx < t.case, 'jamais égal à la case');
  }],
  ['grille effective : celle du lieu prime, null = pas de grille, sinon catalogue, sinon ambiance', () => {
    const cat = { grille: { case: 64, dx: 0, dy: 0 } };
    egal(g.grilleEffective({ grille: { case: 70, dx: 5, dy: 6 } }, cat), { grille: { case: 70, dx: 5, dy: 6 }, origine: 'lieu' }, 'lieu');
    egal(g.grilleEffective({}, cat), { grille: { case: 64, dx: 0, dy: 0 }, origine: 'catalogue' }, 'catalogue');
    egal(g.grilleEffective({ grille: null }, cat), { grille: null, origine: 'aucune' }, 'pas de grille malgré le catalogue');
    egal(g.grilleEffective({}, {}), { grille: null, origine: 'ambiance' }, 'ambiance');
    egal(g.grilleEffective({}, null), { grille: null, origine: 'ambiance' }, 'sans infos');
    egal(g.grilleEffective({ grille: { case: -1 } }, cat).origine, 'catalogue', 'grille de lieu abîmée : le catalogue prend le relais');
  }],
  ['deux clics qui encadrent N cases : taille de case et décalage', () => {
    const r = g.grilleDeuxClics({ x: 104, y: 50 }, { x: 104 + 8 * 70, y: 53 }, 8, { dx: 0, dy: 11 });
    egal(r, { case: 70, dx: 34, dy: 11 }, 'horizontal : dx du premier clic modulo la case, dy gardé');
    const v = g.grilleDeuxClics({ x: 20, y: 400 }, { x: 22, y: 100 }, 5, { dx: 7, dy: 0 });
    egal(v, { case: 60, dx: 7, dy: 40 }, 'vertical : le plus haut des deux clics fixe dy');
    egal(g.grilleDeuxClics({ x: 10, y: 10 }, { x: 14, y: 10 }, 1), null, 'clics trop proches');
    egal(g.grilleDeuxClics({ x: 0, y: 0 }, { x: 500, y: 0 }, 0), null, 'zéro case');
    egal(g.grilleDeuxClics({ x: 0, y: 0 }, { x: 500, y: 0 }, 2.5), null, 'nombre de cases non entier');
    egal(g.grilleDeuxClics({ x: 0, y: 0 }, { x: 500, y: 0 }, g.NB_CASES_MAX + 1), null, 'trop de cases');
    egal(g.grilleDeuxClics({ x: 0, y: 0 }, { x: 500, y: 0 }, 5).case, 100, 'sans grille précédente');
  }],
  ['décaler et changer la case : la ligne la plus proche de l’ancre ne bouge pas', () => {
    egal(g.decalerGrille({ case: 70, dx: 60, dy: 0 }, 20, -5), { case: 70, dx: 10, dy: 65 }, 'décalage qui fait le tour');
    const a = { case: 70, dx: 12, dy: 30 };
    const b = g.changerCase(a, 90, { x: 512, y: 384 });
    egal(b.case, 90, 'nouvelle case');
    // la ligne verticale k = round((512-12)/70) = 7 était à 502 ; elle reste à 502 (mod 90 : 502 - 5*90 = 52)
    proche(b.dx, 52, 0.11, 'dx');
    // la ligne horizontale k = round((384-30)/70) = 5, à 380 ; 380 - 4*90 = 20
    proche(b.dy, 20, 0.11, 'dy');
    egal(g.changerCase(a, 5, { x: 0, y: 0 }).case, g.CASE_MIN, 'borne basse');
  }],
  ['lignes : positions, tracé SVG, nombre de cases', () => {
    const l = g.lignesGrille({ case: 100, dx: 30, dy: 0 }, 350, 200);
    egal(l.verticales, [30, 130, 230, 330], 'verticales');
    egal(l.horizontales, [0, 100, 200], 'horizontales (la dernière sur le bord)');
    egal(g.lignesGrille(null, 100, 100), { verticales: [], horizontales: [] }, 'sans grille');
    egal(g.traceGrille({ case: 100, dx: 0, dy: 0 }, 200, 100), 'M0 0V100M100 0V100M200 0V100M0 0H200M0 100H200', 'tracé');
    egal(g.traceGrille(null, 200, 100), '', 'pas de tracé');
    egal(g.nombreDeCases({ case: 64, dx: 0, dy: 0 }, 1024, 768), { colonnes: 16, lignes: 12 }, 'cases');
  }],
  ['taille à la table : échelle réelle = une case mesure `taille` px ; remplir ou sans grille = tient dans la zone', () => {
    const base = { image: { largeur: 1024, hauteur: 768 }, zone: { largeur: 1000, hauteur: 600 }, taille: 48 };
    const reel = g.dimensionsTable({ ...base, mode: 'reel', grille: { case: 64, dx: 0, dy: 0 } });
    egal([reel.largeur, reel.hauteur, reel.reel, reel.defile], [768, 576, true, false], 'une case de 64 px de l’image = 48 px écran');
    const grand = g.dimensionsTable({ ...base, mode: 'reel', grille: { case: 32, dx: 0, dy: 0 } });
    egal([grand.largeur, grand.hauteur, grand.defile], [1536, 1152, true], 'plus grand que la zone : défile');
    const rempli = g.dimensionsTable({ ...base, mode: 'remplir', grille: { case: 64, dx: 0, dy: 0 } });
    egal([rempli.largeur, rempli.hauteur, rempli.reel, rempli.defile], [800, 600, false, false], 'remplir : tient, sans déformation');
    const ambiance = g.dimensionsTable({ ...base, mode: 'reel', grille: null });
    egal([ambiance.largeur, ambiance.hauteur, ambiance.reel], [800, 600, false], 'ambiance en échelle réelle : tient dans l’écran');
    egal(g.dimensionsTable({ ...base, mode: 'remplir', grille: null, zone: { largeur: 0, hauteur: 0 } }), null, 'zone inconnue');
    egal(g.dimensionsTable({ ...base, image: { largeur: 0, hauteur: 0 }, mode: 'reel', grille: { case: 64 } }), null, 'image inconnue');
    proche(reel.largeur / 1024 * 64, 48, 1e-9, 'échelle exacte');
  }],
  ['modèle : définir, retirer et rétablir la grille d’un lieu', () => {
    const univ = u.creerUnivers({ nom: 'T' });
    const l = u.ajouterLieu(univ, { nom: 'Carte', image: IMG, grille: { case: 70.04, dx: 80, dy: 0 } });
    egal(l.grille, { case: 70, dx: 10, dy: 0 }, 'grille de création normalisée');
    u.definirGrilleLieu(univ, l.id, { case: 64.25, dx: 3, dy: 4 }, DIMS);
    egal(univ.lieux[l.id].grille, { case: 64.3, dx: 3, dy: 4 }, 'calée');
    u.definirGrilleLieu(univ, l.id, null);
    verifier(univ.lieux[l.id].grille === null, 'pas de grille = null');
    u.definirGrilleLieu(univ, l.id, undefined);
    verifier(!('grille' in univ.lieux[l.id]), 'retour au catalogue = clé retirée');
    let erreur = '';
    try { u.definirGrilleLieu(univ, l.id, { case: 'x' }); } catch (e) { erreur = e.message; }
    egal(erreur, 'grille invalide', 'refusée');
    try { u.definirGrilleLieu(univ, 'nulle-part', null); } catch (e) { erreur = e.message; }
    egal(erreur, 'lieu inconnu', 'lieu inconnu');
    const sans = u.ajouterLieu(univ, { nom: 'Sans', image: IMG, grille: { case: 'x' } });
    verifier(!('grille' in sans), 'grille de création inexploitable ignorée');
  }],
  ['fichier d’univers : la grille du lieu, null compris, survit à la relecture ; une grille abîmée est écartée avec avertissement', () => {
    const univ = u.creerUnivers({ nom: 'T' });
    const a = u.ajouterLieu(univ, { nom: 'A', image: IMG });
    const b = u.ajouterLieu(univ, { nom: 'B', image: IMG });
    const c = u.ajouterLieu(univ, { nom: 'C', image: IMG });
    u.definirGrilleLieu(univ, a.id, { case: 70, dx: 5, dy: 6 });
    u.definirGrilleLieu(univ, b.id, null);
    const relu = validerUnivers(JSON.parse(JSON.stringify(univ)));
    egal(relu.univers.lieux[a.id].grille, { case: 70, dx: 5, dy: 6 }, 'grille calée');
    verifier(relu.univers.lieux[b.id].grille === null, 'pas de grille');
    verifier(!('grille' in relu.univers.lieux[c.id]), 'catalogue');
    const brut = JSON.parse(JSON.stringify(univ));
    brut.lieux[c.id].grille = { case: 'beaucoup' };
    const v = validerUnivers(brut);
    verifier(!('grille' in v.univers.lieux[c.id]) && v.avertissements.join().includes('grille'), 'abîmée : écartée, dite');
    brut.lieux[c.id].grille = { case: 90.04, dx: 200, dy: -5 };
    egal(validerUnivers(brut).univers.lieux[c.id].grille, { case: 90, dx: 20, dy: 85 }, 'ramenée dans les bornes');
  }],
  ['table : la grille voyage dans le message (nombres seulement) et est relue champ par champ', () => {
    const univ = u.creerUnivers({ nom: 'T' });
    u.ajouterLieu(univ, { nom: 'Carte', image: IMG });
    const pa = p.creerPartieUnivers(univ);
    verifier(!('grille' in p.vueDeLaTable(pa, univ)), 'pas de grille : pas de champ');
    verifier(!('grille' in p.vueDeLaTable(pa, univ, null)), 'null : pas de champ');
    const vue = p.vueDeLaTable(pa, univ, { case: 70, dx: 5, dy: 6, secret: 'x' });
    egal(vue.grille, { case: 70, dx: 5, dy: 6 }, 'copie des trois nombres');
    const lu = lireVueUnivers(JSON.parse(JSON.stringify(messageUnivers(vue, { ...AFFICHAGE_PAR_DEFAUT }))), AFFICHAGE_PAR_DEFAUT);
    egal(lu.vue.grille, { case: 70, dx: 5, dy: 6 }, 'relue');
    const piege = { type: 'univers-etat', vue: { image: IMG, points: [], grille: { case: '70', dx: 5 } }, affichage: {} };
    verifier(!('grille' in lireVueUnivers(piege, AFFICHAGE_PAR_DEFAUT).vue), 'grille mal formée écartée, le message reste lu');
    const hors = lireVueUnivers({ ...piege, vue: { ...piege.vue, grille: { case: 1e9, dx: -50, dy: 'a' } } }, AFFICHAGE_PAR_DEFAUT).vue.grille;
    egal(hors.case, g.CASE_MAX, 'bornée');
    verifier(hors.dx >= 0 && hors.dx < hors.case && hors.dy === 0, 'décalages bornés');
  }],
];

export const executer = () => executerSuite('univers (grille) : ', TESTS);
