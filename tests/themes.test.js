/**
 * Conformité des thèmes de rendu (vectoriel, papier) : le moteur (moteur.js) et les vignettes les appellent par leur
 * interface, sans rien vérifier. Un thème qui oublie une fonction, ou un objet sans dessin dans l'un des deux, ne
 * casserait qu'à l'écran, au premier plan qui contient cet objet. Ces tests le disent avant.
 */
import * as vectoriel from '../js/rendu/themes/vectoriel.js';
import * as papier from '../js/rendu/themes/papier.js';
import { OBJETS, CREATURES } from '../js/parseur/lexique.js';
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
