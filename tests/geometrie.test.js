/**
 * Tests de la géométrie du rendu (js/rendu/geometrie.js, pur) : l'épaisseur de mur est celle que les deux thèmes
 * dessinent, le rectangle d'une porte et son ancrage suivent le mur (même au fond d'une entaille).
 * Sans dépendance : marche sous Node et dans tests.html.
 */
import { MARGE, EPAISSEUR_MUR, rectPorte, rectDe, ancragePorte } from '../js/rendu/geometrie.js';
import { retraitPorte } from '../js/formes.js';
import * as vectoriel from '../js/rendu/themes/vectoriel.js';
import * as papier from '../js/rendu/themes/papier.js';
import { verifier, egal, executerSuite } from './mini-test.js';

const rect = (largeur, longueur) => ({ largeur, longueur, sol: 'pierre', portes: [], objets: [] });
/** Une croix : les coins sont retirés, donc une porte à la position 0 s'enfonce jusqu'au premier mur. */
const croix = { ...rect(9, 7), forme: 'croix' };
const proche = (a, b, quoi) => verifier(Math.abs(a - b) < 1e-9, `${quoi} : ${a} ≠ ${b}`);

/** Contexte 2D qui note ses appels (nom et arguments), sans rien dessiner. */
function journal() {
  const appels = [];
  const degrade = () => ({ addColorStop() {} });
  const ctx = new Proxy({}, {
    get: (_, nom) => (typeof nom === 'symbol' ? undefined
      : nom === 'createRadialGradient' || nom === 'createLinearGradient' ? degrade
      : nom === 'measureText' ? (s) => ({ width: String(s).length * 6 })
      : (...args) => { appels.push([nom, ...args]); }),
    set: () => true,
  });
  return { ctx, appels };
}

const TESTS = [
  ['la marge et l’épaisseur de mur : les valeurs que tout le site partage', () => {
    egal([MARGE, EPAISSEUR_MUR], [1, 0.32], 'marge et épaisseur');
  }],
  ['rectPorte : une case le long du mur, l’épaisseur du mur en travers, collé au bord de la pièce', () => {
    const p = rect(6, 4);
    egal(rectPorte(p, { mur: 'nord', position: 2 }), { x: 2, y: -EPAISSEUR_MUR, l: 1, h: EPAISSEUR_MUR }, 'nord');
    egal(rectPorte(p, { mur: 'sud', position: 3 }), { x: 3, y: 4, l: 1, h: EPAISSEUR_MUR }, 'sud');
    egal(rectPorte(p, { mur: 'ouest', position: 1 }), { x: -EPAISSEUR_MUR, y: 1, l: EPAISSEUR_MUR, h: 1 }, 'ouest');
    egal(rectPorte(p, { mur: 'est', position: 0 }), { x: 6, y: 0, l: EPAISSEUR_MUR, h: 1 }, 'est');
  }],
  ['rectPorte : au fond d’une entaille, la porte suit le mur plus loin que le bord', () => {
    const d = retraitPorte(croix, 'nord', 0);
    verifier(d > 0, 'cette porte est bien enfoncée');
    proche(rectPorte(croix, { mur: 'nord', position: 0 }).y, d - EPAISSEUR_MUR, 'nord');
    const s = retraitPorte(croix, 'sud', 0);
    proche(rectPorte(croix, { mur: 'sud', position: 0 }).y, croix.longueur - s, 'sud');
    const o = retraitPorte(croix, 'ouest', 0);
    proche(rectPorte(croix, { mur: 'ouest', position: 0 }).x, o - EPAISSEUR_MUR, 'ouest');
    const e = retraitPorte(croix, 'est', 0);
    proche(rectPorte(croix, { mur: 'est', position: 0 }).x, croix.largeur - e, 'est');
  }],
  ['rectDe : porte, créature (côté = taille) et objet (l × h)', () => {
    const p = rect(6, 4);
    egal(rectDe('porte', { mur: 'nord', position: 1 }, p), rectPorte(p, { mur: 'nord', position: 1 }), 'porte');
    egal(rectDe('creature', { x: 2, y: 3, taille: 2 }, p), { x: 2, y: 3, l: 2, h: 2 }, 'créature');
    egal(rectDe('objet', { x: 1, y: 0, l: 3, h: 1, type: 'table' }, p), { x: 1, y: 0, l: 3, h: 1 }, 'objet');
  }],
  ['ancragePorte : milieu de l’ouverture au bord de la pièce, angle qui tourne l’intérieur vers +y', () => {
    const p = rect(6, 4);
    egal(ancragePorte(p, 'nord', 2), { x: 2.5, y: 0, angle: 0 }, 'nord');
    egal(ancragePorte(p, 'sud', 2), { x: 2.5, y: 4, angle: Math.PI }, 'sud');
    egal(ancragePorte(p, 'ouest', 1), { x: 0, y: 1.5, angle: -Math.PI / 2 }, 'ouest');
    egal(ancragePorte(p, 'est', 1), { x: 6, y: 1.5, angle: Math.PI / 2 }, 'est');
    egal(ancragePorte(p, 'haut', 1), undefined, 'un mur inconnu n’a pas d’ancrage');
  }],
  ['ancragePorte : l’échelle convertit en pixels, et suit l’entaille', () => {
    const p = rect(6, 4);
    egal(ancragePorte(p, 'sud', 2, 48), { x: 2.5 * 48, y: 4 * 48, angle: Math.PI }, 'sud à 48 px');
    const d = retraitPorte(croix, 'nord', 0);
    verifier(d > 0, 'porte enfoncée');
    egal(ancragePorte(croix, 'nord', 0, 10), { x: 5, y: d * 10, angle: 0 }, 'nord enfoncé');
    const e = retraitPorte(croix, 'est', 0);
    egal(ancragePorte(croix, 'est', 0, 10), { x: (croix.largeur * 10) - e * 10, y: 5, angle: Math.PI / 2 }, 'est enfoncé');
  }],
  ['les deux thèmes dessinent les murs à EPAISSEUR_MUR et placent la porte sur l’ancrage', () => {
    const p = rect(6, 4), t = 40, e = EPAISSEUR_MUR * t;
    for (const [nom, theme] of Object.entries({ vectoriel, papier })) {
      const m = journal();
      theme.murs(m.ctx, p, t);
      const nord = m.appels.find((a) => a[0] === 'fillRect');
      egal(nord.slice(1), [-e, -e, 6 * t + 2 * e, e], `${nom} : mur nord`);
      for (const mur of ['nord', 'sud', 'ouest', 'est']) {
        const j = journal();
        theme.porte(j.ctx, { mur, position: 1, type: 'porte' }, p, t);
        const a = ancragePorte(p, mur, 1, t);
        egal(j.appels.find((c) => c[0] === 'translate').slice(1), [a.x, a.y], `${nom} : porte ${mur}, position`);
        egal(j.appels.find((c) => c[0] === 'rotate').slice(1), [a.angle], `${nom} : porte ${mur}, angle`);
      }
    }
  }],
];

export const executer = () => executerSuite('géométrie : ', TESTS);
