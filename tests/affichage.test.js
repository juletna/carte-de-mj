/**
 * Tests de la source unique des réglages d'affichage (js/affichage.js) et de ses consommateurs : le stockage, le moteur,
 * le téléphone, le parseur et les curseurs des pages HTML. Puis, à la suite, la taille de la carte à la table (`tailleRemplir`, `tailleTable`,
 * `modeTable`). Sans dépendance : marche sous Node et dans tests.html.
 */
import {
  TAILLE_PAR_DEFAUT, TAILLE_MIN, TAILLE_MAX, TAILLE_MAX_REMPLIR, ECHELLE_PAR_DEFAUT, MODES_TABLE, AFFICHAGE_PAR_DEFAUT,
  ROTATIONS_TABLE, caseMmValide, ajusterTaille, carteDeCalibrage, transformOrientation, versCarte,
  tailleReglable, tailleRemplir, tailleTable, modeTableDefaut, modeTable, affichageDeReglages, validerAffichage, tailleQuiTientPlan, tailleCanvasBornee, CANVAS_COTE_MAX, CANVAS_SURFACE_MAX,
} from '../js/affichage.js';
import { chargerReglages, fusionnerReglages, enregistrerReglages, CLE_REGLAGES } from '../js/stockage.js';
import { dessiner } from '../js/rendu/moteur.js';
import { tailleQuiTient } from '../js/telephone.js';
import { dimensionsTable } from '../js/univers-grille.js';
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
  ['zoom de la vue table : multiplie le cadrage de base (Remplir ou Réel), borné, omis quand il vaut 1', () => {
    egal(tailleTable({ mode: 'reel', plan: null, vue: null, taille: 48, zoom: 2 }), 96, 'réel × 2');
    egal(tailleTable({ mode: 'reel', plan: null, vue: null, taille: 48 }), 48, 'sans zoom : inchangé');
    egal(tailleTable({ mode: 'reel', plan: null, vue: null, taille: 48, zoom: 99 }), 48, 'zoom hors bornes : le cadrage de base');
    const defaut = { mode: 'remplir', taille: 48, grille: true, reperes: true };
    egal(validerAffichage({ ...defaut, zoom: 1.6 }, defaut).zoom, 1.6, 'zoom relu');
    egal('zoom' in validerAffichage({ ...defaut, zoom: 1 }, defaut), false, 'zoom 1 : aucune clé');
    egal('zoom' in validerAffichage({ ...defaut, zoom: 0 }, defaut), false, 'zoom invalide écarté');
    egal(dimensionsTable({ mode: 'remplir', grille: null, taille: 48, image: { largeur: 1000, hauteur: 500 }, zone: { largeur: 500, hauteur: 500 }, zoom: 2 }).largeur, 1000, 'carte du monde zoomée');
  }],
  ['écran de table : orientation, miroir et taille réelle sont envoyés seulement s’ils diffèrent du défaut', () => {
    egal(affichageDeReglages({ taille: 60, grille: true, modeTable: 'reel', rotationTable: 180, miroirTable: true, caseMm: 25.4 }),
      { taille: 60, grille: true, reperes: true, mode: 'reel', rotation: 180, miroir: true, caseMm: 25.4 }, 'tout réglé');
    const defaut = { mode: 'remplir', taille: 48, grille: true, reperes: true };
    egal(validerAffichage({ ...defaut, rotation: 90, miroir: true, caseMm: 30 }, defaut), { ...defaut, rotation: 90, miroir: true, caseMm: 30 }, 'tout valide');
    egal(validerAffichage({ ...defaut, rotation: 45, miroir: 'oui', caseMm: 500, calibrage: 1 }, defaut), defaut, 'tout invalide : rien de gardé, et plus de drapeau calibrage');
    egal(validerAffichage({ ...defaut, calibrage: true }, defaut), defaut, 'un drapeau calibrage reçu est écarté');
    egal(validerAffichage({ ...defaut, rotation: 0 }, defaut), defaut, 'rotation nulle : aucune clé');
    egal(ROTATIONS_TABLE, [0, 90, 180, 270], 'quarts de tour');
    egal([caseMmValide(10), caseMmValide(9.9), caseMmValide(50), caseMmValide(50.1), caseMmValide('25')], [true, false, true, false, false], 'bornes de la taille réelle');
    const r = reglagesDe({ taille: 60, rotationTable: 270, miroirTable: true, caseMm: 25.4 });
    egal([r.rotationTable, r.miroirTable, r.caseMm], [270, true, 25.4], 'relus du stockage');
    const m = reglagesDe({ taille: 60, rotationTable: 45, miroirTable: 'oui', caseMm: 0 });
    verifier(!('rotationTable' in m) && !('miroirTable' in m) && !('caseMm' in m), 'valeurs invalides ignorées');
  }],
  ['calibrage : la carte bancaire suit la case visée, la taille se règle au dixième de pixel dans ses bornes', () => {
    egal(carteDeCalibrage(25), { largeur: 85.6, hauteur: 53.98 }, '25 px pour 25 mm : 1 px par mm');
    egal(carteDeCalibrage(50, 25).largeur, 171.2, 'deux fois plus grand');
    verifier(Math.abs(carteDeCalibrage(30, 30).hauteur - 53.98) < 1e-9, 'une autre case visée');
    egal([ajusterTaille(32, 0.1), ajusterTaille(32.1, 0.1), ajusterTaille(32.3, -1)], [32.1, 32.2, 31.3], 'sans erreur d’arrondi');
    egal([ajusterTaille(16, -1), ajusterTaille(160, 1)], [16, 160], 'dans les bornes');
    egal(tailleTable({ mode: 'reel', plan: null, vue: null, taille: 32.4 }), 32.4, 'l’échelle réelle garde les décimales');
  }],
  ['orientation : la transformation et son inverse se répondent', () => {
    egal(transformOrientation({}), '', 'rien par défaut');
    egal(transformOrientation({ rotation: 90 }), 'rotate(90deg)', 'rotation');
    egal(transformOrientation({ miroir: true }), 'scaleX(-1)', 'miroir');
    egal(transformOrientation({ rotation: 180, miroir: true }), 'rotate(180deg) scaleX(-1)', 'les deux');
    egal(versCarte(3, 4, {}), [3, 4], 'rien ne change par défaut');
    // À l'écran, rotate(90deg) envoie (x, y) sur (-y, x) : un point à droite de l'écran vient du haut de la carte.
    const ecran = ([x, y], { rotation = 0, miroir = false }) => {
      const m = miroir ? -x : x;
      return { 0: [m, y], 90: [-y, m], 180: [-m, -y], 270: [y, -m] }[rotation];
    };
    for (const rotation of ROTATIONS_TABLE) for (const miroir of [false, true]) {
      const o = { rotation, miroir }, [dx, dy] = ecran([3, 4], o);
      egal(versCarte(dx, dy, o), [3, 4], `aller-retour, ${rotation}°, miroir ${miroir}`);
    }
    egal(versCarte(0, -1, { rotation: 180 }), [0, 1], 'défiler vers le haut de l’écran, carte retournée : vers le bas de la carte');
    egal(versCarte(0, 0, { rotation: 180, miroir: true }), [0, 0], 'pas de -0');
  }],
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
    egal(fusionnerReglages({ taille: 60, grille: false, inconnu: 1 }, { taille: 40, grille: true, miniTable: false }, { taille: 40, grille: true, reperes: false }), { taille: 60, grille: false, inconnu: 1, reperes: false }, 'seul ce qui a changé ici est repris');
    egal(fusionnerReglages({ taille: 60, miniTable: false }, { taille: 40, miniTable: false }, { taille: 40 }), { taille: 60 }, 'une valeur retirée ici disparaît');
    egal(fusionnerReglages({ taille: 60 }, { taille: 40 }, { taille: 40 }), { taille: 60 }, 'rien de changé ici : ce qui est enregistré reste');
    const stock = fauxStock({ [CLE_REGLAGES]: JSON.stringify({ echelle: 1.5, taille: 60, grille: true, rotationTable: 90, caseMm: 30 }) });
    const vieux = { echelle: 1.5, taille: 48, grille: true };
    egal(enregistrerReglages(vieux, { ...vieux }, stock).ok, true, 'rien de changé ici : rien à écrire');
    egal(chargerReglages(stock).taille, 60, 'et la taille réglée ailleurs reste');
    verifier(enregistrerReglages(vieux, { ...vieux, grille: false }, stock).ok, 'écriture');
    egal(chargerReglages(stock), { echelle: 1.5, taille: 60, grille: false, rotationTable: 90, caseMm: 30 }, 'un onglet en retard n’écrit que ce qu’il a changé');
    verifier(!enregistrerReglages(vieux, { ...vieux, grille: true, taille: 80 }, { getItem: () => null, setItem() { throw new Error('plein'); } }).ok, 'écriture refusée : on le sait');
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
  ['pages HTML : le curseur de taille (Présentation seulement : on n’y calibre plus dans le Donjon) et le champ d’échelle portent les bonnes bornes et les bons défauts', () => {
    verifier(!/id="(taille|calibrage)"/.test(pages['donjon.html']), 'donjon.html : ni taille de case ni calibrage');
    // Le curseur de taille de la régie est dans le popover « Affichage » (js/atelier/affichage-popover.js, groupe Régie), plus dans presentation.html.
    verifier(!/id="taille"/.test(pages['presentation.html']), 'presentation.html : le curseur de taille est dans le popover');
    egal(attribut(pages['donjon.html'], 'echelle', 'value'), String(ECHELLE_PAR_DEFAUT), 'donjon.html : échelle');
  }],
];

const TESTS_TABLE = [
  ['table : « remplir » calcule la case sur la fenêtre (entière, bornée), « échelle réelle » garde exactement la taille calibrée', () => {
    const plan = { largeur: 6, longueur: 6 };
    egal(tailleRemplir(plan, 1920, 1080), 135, 'salle 6×6 sur 1920×1080 : 1080 / 8 = 135');
    egal(tailleRemplir(plan, 800, 1080), 100, 'limitée par la largeur : 800 / 8');
    egal(tailleRemplir({ largeur: 60, longueur: 60 }, 800, 600), TAILLE_MIN, 'salle trop grande : jamais sous la case minimale (elle défile)');
    egal(tailleRemplir({ largeur: 1, longueur: 1 }, 4000, 4000), TAILLE_MAX_REMPLIR, 'petite salle : plafonnée');
    egal(tailleRemplir(plan, 0, 0), null, 'fenêtre sans dimensions : pas de calcul');
    egal(Number.isInteger(tailleRemplir({ largeur: 7, longueur: 5 }, 1000, 777)), true, 'toujours un entier');
    // Le calcul tient dans la fenêtre : (6 + 2) cases ne dépassent ni la largeur ni la hauteur.
    verifier(8 * tailleRemplir(plan, 1366, 650) <= 650, 'la carte tient en hauteur');
    // Échelle réelle : la valeur calibrée, à l'identique, quelle que soit la fenêtre ou la salle.
    for (const [l, h] of [[1920, 1080], [300, 300], [0, 0]]) {
      egal(tailleTable({ mode: 'reel', plan, vue: { largeur: l, hauteur: h }, taille: 61 }), 61, `échelle réelle exacte (${l}×${h})`);
    }
    egal(tailleTable({ mode: 'remplir', plan, vue: { largeur: 1920, hauteur: 1080 }, taille: 61 }), 135, 'remplir : calculé');
    egal(tailleTable({ mode: 'remplir', plan, vue: { largeur: 0, hauteur: 0 }, taille: 61 }), 61, 'remplir sans fenêtre : repli sur la taille réglée');
  }],

  ['table : mode par défaut = échelle réelle si calibré (taille ≠ 48 ou indicateur), sinon remplir ; un choix explicite l’emporte', () => {
    egal(modeTableDefaut({ taille: 48 }), 'remplir', 'taille par défaut');
    egal(modeTableDefaut({ taille: 61 }), 'reel', 'taille changée');
    egal(modeTableDefaut({ taille: 48, calibre: true }), 'reel', 'indicateur de calibrage, même si la taille retombe sur 48');
    egal(modeTable({ taille: 61, modeTable: 'remplir' }), 'remplir', 'choix explicite remplir');
    egal(modeTable({ taille: 48, modeTable: 'reel' }), 'reel', 'choix explicite reel');
    egal(modeTable({ taille: 61, modeTable: 'nimporte' }), 'reel', 'valeur invalide : défaut');
  }],
];

export async function executer({ lire }) {
  const pages = {};
  for (const page of ['donjon.html', 'presentation.html']) pages[page] = await lire(page);
  return [...executerSuite('affichage : ', TESTS(pages)), ...executerSuite('présentation : ', TESTS_TABLE)];
}
