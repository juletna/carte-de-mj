/**
 * Tests de la source unique des réglages d'affichage (js/affichage.js) et de ses consommateurs : le stockage, le moteur,
 * le téléphone, le parseur et les curseurs des pages HTML. Sans dépendance : marche sous Node et dans tests.html.
 */
import {
  TAILLE_PAR_DEFAUT, TAILLE_MIN, TAILLE_MAX, TAILLE_MAX_REMPLIR, ECHELLE_PAR_DEFAUT, MODES_TABLE, AFFICHAGE_PAR_DEFAUT,
  tailleReglable, affichageDeReglages, validerAffichage, tailleQuiTientPlan, tailleCanvasBornee, CANVAS_COTE_MAX, CANVAS_SURFACE_MAX,
} from '../js/affichage.js';
import { chargerReglages, CLE_REGLAGES } from '../js/stockage.js';
import { dessiner } from '../js/rendu/moteur.js';
import { tailleQuiTient } from '../js/telephone.js';
import { analyser } from '../js/parseur/index.js';
import { verifier, egal, fauxStock, executerSuite } from './mini-test.js';

const reglagesDe = (brut) => chargerReglages(fauxStock({ [CLE_REGLAGES]: JSON.stringify(brut) }));

/** Attribut d'une balise <input id="…"> d'une page. */
function attribut(html, id, nom) {
  const balise = html.match(new RegExp(`<input[^>]*\\bid="${id}"[^>]*>`))?.[0];
  verifier(balise, `<input id="${id}"> introuvable`);
  return balise.match(new RegExp(`\\b${nom}="([^"]*)"`))?.[1];
}

const TESTS = (pages) => [
  ['les valeurs de référence : 48 par défaut, bornes 16 et 160, 300 en « remplir », 1,5 m par case', () => {
    egal([TAILLE_PAR_DEFAUT, TAILLE_MIN, TAILLE_MAX, TAILLE_MAX_REMPLIR, ECHELLE_PAR_DEFAUT], [48, 16, 160, 300, 1.5], 'constantes');
    egal(MODES_TABLE, ['remplir', 'reel'], 'modes');
    egal(AFFICHAGE_PAR_DEFAUT, { taille: 48, grille: true, reperes: true, mode: 'remplir' }, 'affichage par défaut');
    egal([tailleReglable(15.9), tailleReglable(16), tailleReglable(160), tailleReglable(160.1), tailleReglable(NaN)], [false, true, true, false, false], 'bornes incluses');
  }],
  ['affichageDeReglages : taille et grille telles quelles, repères allumés sauf refus explicite, mode du réglage ou défaut', () => {
    egal(affichageDeReglages({ taille: 60, grille: false }), { taille: 60, grille: false, reperes: true, mode: 'reel' }, 'taille changée : échelle réelle');
    egal(affichageDeReglages({ taille: 48, grille: true, reperes: false }), { taille: 48, grille: true, reperes: false, mode: 'remplir' }, 'repères éteints');
    egal(affichageDeReglages({ taille: 48, grille: true, modeTable: 'reel' }).mode, 'reel', 'mode choisi');
    egal(affichageDeReglages({ taille: 60, grille: true, calibre: true, modeTable: 'remplir' }).mode, 'remplir', 'le choix l’emporte sur le calibrage');
  }],
  ['validerAffichage : un champ invalide reprend le défaut, les autres sont gardés', () => {
    const defaut = { taille: 48, grille: true, reperes: true, mode: 'remplir' };
    egal(validerAffichage({ taille: 90, grille: false, reperes: false, mode: 'reel' }, defaut), { mode: 'reel', taille: 90, grille: false, reperes: false }, 'tout valide');
    egal(validerAffichage({ taille: 16, mode: 'reel' }, defaut), { mode: 'reel', taille: 16, grille: true, reperes: true }, 'borne basse, champs absents');
    egal(validerAffichage({ taille: 160 }, defaut).taille, 160, 'borne haute');
    for (const mauvais of [15, 161, NaN, Infinity, '60', null, undefined]) egal(validerAffichage({ taille: mauvais }, defaut).taille, 48, `taille ${String(mauvais)} refusée`);
    egal(validerAffichage({ mode: 'plein', grille: 'oui', reperes: 1 }, defaut), { mode: 'remplir', taille: 48, grille: true, reperes: true }, 'types invalides');
    egal(validerAffichage(null, { taille: 70, grille: false, reperes: false, mode: 'reel' }), { mode: 'reel', taille: 70, grille: false, reperes: false }, 'rien reçu : le défaut');
  }],
  ['stockage : mêmes bornes et mêmes défauts que affichage.js, même pour une taille écrite en texte', () => {
    egal(reglagesDe({}), { echelle: ECHELLE_PAR_DEFAUT, taille: TAILLE_PAR_DEFAUT, grille: true }, 'défauts');
    egal([15, 16, 160, 161, 0, -3].map((taille) => reglagesDe({ taille }).taille), [48, 16, 160, 48, 48, 48], 'bornes');
    egal(reglagesDe({ taille: '60' }).taille, 60, 'un texte numérique est relu (le stockage convertit, contrairement au message de la table)');
    egal(reglagesDe({ modeTable: 'reel' }).modeTable, 'reel', 'mode valide');
    verifier(!('modeTable' in reglagesDe({ modeTable: 'plein' })), 'mode inconnu écarté');
  }],
  ['moteur : sans taille donnée, une case fait TAILLE_PAR_DEFAUT', () => {
    const canvas = { style: {}, getContext: () => new Proxy({}, { get: () => () => ({ addColorStop() {} }), set: () => true }) };
    dessiner(canvas, { largeur: 6, longueur: 4, sol: 'pierre', portes: [], objets: [], creatures: [] });
    egal([canvas.style.width, canvas.style.height], [`${8 * TAILLE_PAR_DEFAUT}px`, `${6 * TAILLE_PAR_DEFAUT}px`], 'taille CSS du canvas');
  }],
  ['téléphone : la case qui tient ne descend jamais sous TAILLE_MIN, et ne dépasse pas le réglage', () => {
    const zone = (clientWidth, clientHeight) => ({ clientWidth, clientHeight });
    egal(tailleQuiTient(zone(100, 100), 30, 30, 48, 0), TAILLE_MIN, 'salle immense : plancher');
    egal(tailleQuiTient(zone(2000, 2000), 4, 4, 48, 0), 48, 'petite salle : le réglage');
    egal(tailleQuiTient(zone(0, 500), 4, 4, 60, 0), 60, 'zone masquée : le réglage tel quel');
  }],
  ['parseur : l’échelle par défaut est ECHELLE_PAR_DEFAUT', () => {
    const { plan } = analyser('Salle de 9 par 6 mètres');
    egal([plan.largeur, plan.longueur], [9 / ECHELLE_PAR_DEFAUT, 6 / ECHELLE_PAR_DEFAUT], 'mètres → cases');
    const double = analyser('Salle de 9 par 6 mètres', { echelle: 3 }).plan;
    egal([double.largeur, double.longueur], [3, 2], 'une échelle donnée l’emporte');
  }],
  ['tailleQuiTientPlan : la case qui tient le plan dans le cadre, plafonnée, jamais sous 1 px', () => {
    const plan = { largeur: 40, longueur: 20 };
    egal(tailleQuiTientPlan(plan, 400, 400), 10, 'limité par la largeur');
    egal(tailleQuiTientPlan(plan, 4000, 100), 5, 'limité par la hauteur');
    egal(tailleQuiTientPlan(plan, 4000, 4000), 16, 'plafond par défaut : les miniatures ne grossissent pas');
    egal(tailleQuiTientPlan(plan, 4000, 4000, 30), 30, 'plafond donné');
    egal(tailleQuiTientPlan(plan, 10, 10), 1, 'jamais sous 1 px');
  }],
  ['tailleCanvasBornee : rien ne change sous les limites ; sinon moins de pixels physiques d’abord, puis une case plus petite', () => {
    egal(tailleCanvasBornee(20, 20, 48, 2), { t: 48, dpr: 2 }, 'petit canvas');
    egal(tailleCanvasBornee(20, 20, 0.2, 1), { t: 1, dpr: 1 }, 'case minimale 1');
    // 30 × 30 cases de 48 px : à densité 3, 4320 px physiques de côté mais 18,7 millions de pixels > 16 millions : la densité baisse, jusqu'à 2,5 (12,96 millions).
    egal(tailleCanvasBornee(30, 30, 48, 3), { t: 48, dpr: 2.5 }, 'la densité baisse d’abord, par demi-pas');
    // 200 × 200 cases de 48 px : même à densité 1 la surface dépasse : la case rétrécit, à la surface permise (4000 px de côté).
    const r = tailleCanvasBornee(200, 200, 48, 2);
    egal(r, { t: 20, dpr: 1 }, 'densité au plus bas, case réduite (la surface borne avant le côté)');
    verifier(200 * r.t * r.dpr <= CANVAS_COTE_MAX && (200 * r.t * r.dpr) ** 2 <= CANVAS_SURFACE_MAX, 'dans les limites du navigateur');
    egal(tailleCanvasBornee(500, 20, 48, 1).t, 16.38, 'un canvas très long : le côté borne, arrondi au centième inférieur');
    egal(tailleCanvasBornee(100000, 20, 48, 1).t, 1, 'jamais sous 1 px');
  }],
  ['pages HTML : les curseurs de taille et le champ d’échelle portent les mêmes bornes et défauts', () => {
    for (const page of ['donjon.html', 'presentation.html']) {
      const html = pages[page];
      egal(['type', 'min', 'max', 'value'].map((a) => attribut(html, 'taille', a)), ['range', String(TAILLE_MIN), String(TAILLE_MAX), String(TAILLE_PAR_DEFAUT)], `${page} : curseur de taille`);
      verifier(html.includes(`<output id="taille-val">${TAILLE_PAR_DEFAUT} px</output>`), `${page} : valeur affichée du curseur`);
    }
    egal(attribut(pages['donjon.html'], 'echelle', 'value'), String(ECHELLE_PAR_DEFAUT), 'donjon.html : échelle');
  }],
];

export async function executer({ lire }) {
  const pages = {};
  for (const page of ['donjon.html', 'presentation.html']) pages[page] = await lire(page);
  return executerSuite('affichage : ', TESTS(pages));
}
