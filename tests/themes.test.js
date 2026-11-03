/**
 * Conformité des thèmes de rendu (vectoriel, papier) : le moteur (moteur.js) et les vignettes les appellent par leur
 * interface, sans rien vérifier. Un thème qui oublie une fonction, ou un objet sans dessin dans l'un des deux, ne
 * casserait qu'à l'écran, au premier plan qui contient cet objet. Ces tests le disent avant.
 */
import * as vectoriel from '../js/rendu/themes/vectoriel.js';
import * as papier from '../js/rendu/themes/papier.js';
import * as commun from '../js/rendu/themes/commun.js';
import { tracerSol, dessinerMursDecoupes } from '../js/rendu/trace.js';
import { nombreCases } from '../js/formes.js';
import { OBJETS, CREATURES } from '../js/catalogue.js';
import { verifier, egal, executerSuite } from './mini-test.js';

const THEMES = { vectoriel, papier };
/** Ce que le moteur appelle sans test préalable. */
const FONCTIONS = ['roche', 'sol', 'murs', 'porte', 'pion', 'repereCache', 'marqueLiaison'];
/** Facultatif : le moteur teste leur présence (`theme.grille || …`, `theme.marqueSelection?.(…)`, `theme.opaciteCache ?? 0.5`). */
const FACULTATIFS = { vectoriel: ['marqueSelection'], papier: ['grille', 'opaciteCache'] };
/** Les types qui ont un dessin : tous ceux du lexique, plus le repli des types inconnus. */
const TYPES = [...OBJETS.map((o) => o.type), 'inconnu'];

/** Contexte 2D qui accepte tout (dégradés compris) : on ne cherche que les exceptions. */
function ctxPermissif() {
  const degrade = () => ({ addColorStop() {} });
  return new Proxy({}, {
    get: (_, nom) => (typeof nom === 'symbol' ? undefined
      : nom === 'createRadialGradient' || nom === 'createLinearGradient' ? degrade
      : nom === 'measureText' ? (s) => ({ width: String(s).length * 6 })
      : () => {}),
    set: () => true,
  });
}

/** Contexte qui note chaque appel (`nom(args)`) et chaque affectation (`nom=valeur`), dans l'ordre. */
function ctxJournal() {
  const lignes = [];
  const ctx = new Proxy({}, {
    get: (_, nom) => (typeof nom === 'symbol' ? undefined : (...args) => { lignes.push(`${nom}(${args.join(',')})`); }),
    set: (_, nom, v) => { lignes.push(`${nom}=${v}`); return true; },
  });
  return { ctx, lignes };
}

const TESTS = [
  ['les deux thèmes exportent toute l’interface attendue par le moteur', () => {
    for (const [nom, theme] of Object.entries(THEMES)) {
      for (const f of FONCTIONS) verifier(typeof theme[f] === 'function', `${nom} : « ${f} » manque ou n’est pas une fonction`);
      verifier(theme.objets && typeof theme.objets === 'object', `${nom} : « objets » manque`);
    }
  }],
  ['aucun export inattendu : un nouvel export d’un thème doit être déclaré ici et géré par le moteur', () => {
    for (const [nom, theme] of Object.entries(THEMES)) {
      egal(Object.keys(theme).sort(), [...FONCTIONS, 'objets', ...FACULTATIFS[nom]].sort(), `exports de ${nom}`);
    }
  }],
  ['les exports facultatifs ont le bon type', () => {
    verifier(typeof vectoriel.marqueSelection === 'function', 'vectoriel : marqueSelection');
    verifier(typeof papier.grille === 'function', 'papier : grille');
    verifier(typeof papier.opaciteCache === 'number', 'papier : opaciteCache');
  }],
  ['chaque objet du lexique a son dessin dans les deux thèmes, et rien d’autre', () => {
    for (const [nom, theme] of Object.entries(THEMES)) {
      for (const type of TYPES) verifier(typeof theme.objets[type] === 'function', `${nom} : pas de dessin pour « ${type} »`);
      egal(Object.keys(theme.objets).sort(), [...TYPES].sort(), `types dessinés par ${nom}`);
    }
  }],
  ['chaque dessin d’objet s’exécute, à plusieurs tailles, dans les deux thèmes', () => {
    for (const [nom, theme] of Object.entries(THEMES)) {
      for (const type of TYPES) {
        for (const [w, h, t] of [[48, 48, 48], [96, 48, 48], [48, 144, 48], [10, 10, 10]]) {
          try { theme.objets[type](ctxPermissif(), w, h, t, { type, l: w / t, h: h / t, rotation: 0 }); }
          catch (e) { throw new Error(`${nom} · ${type} ${w}×${h} : ${e.message}`); }
        }
      }
    }
  }],
  ['primitives communes : remplissage puis contour, dans cet ordre ; épaisseur 1 par défaut ; rien à tracer sans fond ni contour', () => {
    const essai = (f, ...args) => { const { ctx, lignes } = ctxJournal(); f(ctx, ...args); return lignes; };
    egal(essai(commun.rect, 1, 2, 3, 4, '#fff', '#000', 5), ['beginPath()', 'rect(1,2,3,4)', 'fillStyle=#fff', 'fill()', 'strokeStyle=#000', 'lineWidth=5', 'stroke()'], 'rect');
    egal(essai(commun.rect, 1, 2, 3, 4, null, '#000'), ['beginPath()', 'rect(1,2,3,4)', 'strokeStyle=#000', 'lineWidth=1', 'stroke()'], 'rect : contour seul');
    egal(essai(commun.rectArrondi, 1, 2, 3, 4, 6, '#fff'), ['beginPath()', 'roundRect(1,2,3,4,6)', 'fillStyle=#fff', 'fill()'], 'rectArrondi : fond seul');
    egal(essai(commun.rond, 5, 6, 7, '#fff', '#000', 2), ['beginPath()', `arc(5,6,7,0,${Math.PI * 2})`, 'fillStyle=#fff', 'fill()', 'strokeStyle=#000', 'lineWidth=2', 'stroke()'], 'rond');
    egal(essai(commun.rond, 5, 6, 7), ['beginPath()', `arc(5,6,7,0,${Math.PI * 2})`], 'rond : ni fond ni contour');
  }],
  ['tracerSol : un carré par case de sol, aucun pour les cases retirées ; dessinerMursDecoupes : un tronçon par côté sur le vide', () => {
    const plan = { largeur: 5, longueur: 5, forme: 'croix', bras: 1, position: 'milieu' };
    const { ctx, lignes } = ctxJournal();
    tracerSol(ctx, plan, 10);
    egal([lignes[0], lignes.length - 1], ['beginPath()', nombreCases(plan)], 'un rect par case de sol');
    egal(lignes[1], 'rect(20,0,10,10)', 'première case de sol (la branche nord de la croix)');
    const murs = ctxJournal();
    dessinerMursDecoupes(murs.ctx, plan, 10, 3, { fond: '#aaa', trait: '#000', epaisseurTrait: 2, joints: true });
    egal([murs.lignes[0], murs.lignes[1], murs.lignes.at(-2), murs.lignes.at(-1)], ['save()', 'fillStyle=#aaa', 'stroke()', 'restore()'], 'encadrement du dessin');
    verifier(murs.lignes.filter((l) => l.startsWith('fillRect')).length === 20, 'un fillRect par tronçon : le contour de cette croix compte 20 côtés');
  }],
  ['chaque pion se dessine dans les deux thèmes, pour chaque type de créature et chaque camp', () => {
    for (const [nom, theme] of Object.entries(THEMES)) {
      for (const camp of ['monstre', 'pnj', 'pj']) {
        for (const c of [...CREATURES, { type: 'pj', taille: 1 }]) {
          try { theme.pion(ctxPermissif(), { type: c.type, camp, numero: 2, x: 0, y: 0, taille: c.taille || 1 }, 48); }
          catch (e) { throw new Error(`${nom} · ${c.type} (${camp}) : ${e.message}`); }
        }
      }
    }
  }],
];

export const executer = () => executerSuite('thèmes : ', TESTS);
