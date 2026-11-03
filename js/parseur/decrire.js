/**
 * Le chemin inverse du parseur : plan JSON → description en français.
 *
 * Le texte produit donne le même plan quand on le relit (testé dans
 * tests/parseur.test.js). Toutes les positions y sont exactes, en
 * coordonnées de cases : « deux coffres en A1 C1 », « un lit de A2 à B2 ».
 */
import { definition, nomAffiche } from './lexique.js';
import { estFeminin, estSymetrique } from '../catalogue.js';
import { nomCase, reperePorte } from './coordonnees.js';
import { REGARD_VERS, portesEntreeDabord, murEntree } from '../murs.js';
import { nomDesBras } from '../formes.js';

const NOMBRES = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze'];
const DIRECTIONS = { 0: 'le nord', 90: 'l’est', 180: 'le sud', 270: 'l’ouest' };

function quantite(type, n) {
  const f = estFeminin(type);
  if (n === 1) return f ? 'une' : 'un';
  return NOMBRES[n] || String(n);
}

function accord(mot, type, n) {
  return `${mot}${estFeminin(type) ? 'e' : ''}${n > 1 ? 's' : ''}`;
}

/** Un élément secret : « caché », « cachés »… accordé comme le nom (voir ADJ_CACHE dans lexique.js). */
const motCache = (type, n) => ` ${accord('caché', type, n)}`;

/** Une porte : « une porte au mur sud en D », « une herse au mur est en 4 », « une porte secrète au mur nord en B ». */
function decrirePorte(p) {
  return `${quantite(p.type, 1)} ${p.type}${p.cache ? ' secrète' : ''} au mur ${p.mur} en ${reperePorte(p.mur, p.position)}`;
}

/** « deux coffres en A1 C1 » ou, si la taille n'est pas celle par défaut, « un lit de A2 à B2 ». */
function emplacement(e, largeur, hauteur, defaut) {
  if (largeur === defaut.l && hauteur === defaut.h) return null;
  return `de ${nomCase(e.x, e.y)} à ${nomCase(e.x + largeur - 1, e.y + hauteur - 1)}`;
}

function decrireObjets(objets, regardDefaut) {
  // Les objets de même type, taille et orientation sont regroupés sur une seule proposition.
  const groupes = new Map();
  const seuls = [];
  for (const o of objets) {
    const def = definition(o.type);
    // Un objet identique quelle que soit son orientation : inutile de la préciser.
    const rotation = estSymetrique(o.type) || o.rotation === regardDefaut ? null : o.rotation;
    const etendue = emplacement(o, o.l, o.h, def);
    const cache = o.cache === true;
    const suite = rotation === null ? '' : (n) => ` ${accord('tourné', o.type, n)} vers ${DIRECTIONS[rotation]}`;
    if (etendue) {
      seuls.push(`${quantite(o.type, 1)} ${nomAffiche(o.type)}${cache ? motCache(o.type, 1) : ''} ${etendue}${suite ? suite(1) : ''}`);
    } else {
      // Un élément caché n'est jamais regroupé avec un visible.
      const cle = `${o.type}|${rotation}|${cache}`;
      if (!groupes.has(cle)) groupes.set(cle, { type: o.type, suite, cache, cases: [] });
      groupes.get(cle).cases.push(nomCase(o.x, o.y));
    }
  }
  const lignes = [...groupes.values()].map(({ type, suite, cache, cases }) => {
    const n = cases.length;
    return `${quantite(type, n)} ${nomAffiche(type, n)}${cache ? motCache(type, n) : ''} en ${cases.join(' ')}${suite ? suite(n) : ''}`;
  });
  return [...lignes, ...seuls];
}

/** Ce qui distingue une créature de ses semblables : couleur et camp. */
function qualificatifs(k, n) {
  const mots = [];
  if (k.couleur) mots.push(n > 1 && !/s$/.test(k.couleur) ? `${k.couleur}s` : k.couleur);
  if (k.camp !== definition(k.type).camp) {
    mots.push(k.camp === 'monstre' ? `hostile${n > 1 ? 's' : ''}` : accord('allié', k.type, n));
  }
  if (k.cache) mots.push(accord('caché', k.type, n).trim());
  return mots.length ? ` ${mots.join(' ')}` : '';
}

function decrireCreatures(creatures) {
  // On suit l'ordre des numéros : ils restent ainsi les mêmes à la relecture.
  const tries = [...creatures].sort((a, b) => a.type.localeCompare(b.type) || a.numero - b.numero);
  const lignes = [];
  let groupe = null;
  for (const k of tries) {
    const def = definition(k.type);
    const etendue = emplacement(k, k.taille, k.taille, def);
    const identite = `${k.type}|${k.camp}|${k.couleur || ''}|${k.cache === true}`;
    if (etendue) {
      lignes.push(`${quantite(k.type, 1)} ${nomAffiche(k.type)}${qualificatifs(k, 1)} ${etendue}`);
      groupe = null;
    } else if (groupe?.identite === identite) {
      groupe.cases.push(nomCase(k.x, k.y));
    } else {
      groupe = { identite, k, cases: [nomCase(k.x, k.y)] };
      lignes.push(groupe);
    }
  }
  return lignes.map((l) => {
    if (typeof l === 'string') return l;
    const n = l.cases.length;
    return `${quantite(l.k.type, n)} ${nomAffiche(l.k.type, n)}${qualificatifs(l.k, n)} en ${l.cases.join(' ')}`;
  });
}

const QUALIF_POSITION = {
  croix: (p) => `bras ${p === 'milieu' ? 'au' : 'en'} ${p}`,
  T: (p) => `barre au ${p}`,
  U: (p) => `ouverte au ${p}`,
  L: (p) => `angle au ${p.replace('-', ' ')}`,
};
const decrireForme = (plan) => (plan.forme && plan.forme !== 'rectangle' ? ` en ${plan.forme}` : '');

/** Le début d'une description : nom, forme et dimensions, épaisseur des bras, position. */
export function debutDescription(plan) {
  const debut = plan.nom && plan.nom !== 'Salle' ? plan.nom : 'Salle';
  const propositions = [`${debut}${decrireForme(plan)} de ${plan.largeur} par ${plan.longueur} cases`];
  if (plan.bras && plan.forme && plan.forme !== 'rectangle') propositions.push(`${nomDesBras(plan.forme)} de ${plan.bras} case${plan.bras > 1 ? 's' : ''}`);
  if (plan.position && QUALIF_POSITION[plan.forme]) propositions.push(QUALIF_POSITION[plan.forme](plan.position));
  return propositions;
}

/**
 * @param {object} plan
 * @returns {string} description relisible par analyser()
 */
export function decrire(plan) {
  const propositions = debutDescription(plan);
  if (plan.sol && plan.sol !== 'pierre') propositions.push(`sol en ${plan.sol}`);

  // La porte du mur d'entrée d'abord : c'est la première porte qui définit l'entrée.
  propositions.push(...portesEntreeDabord(plan).map(decrirePorte));

  propositions.push(...decrireObjets(plan.objets, REGARD_VERS[murEntree(plan)]));
  propositions.push(...decrireCreatures(plan.creatures || []));
  return `${propositions.join(', ')}.`;
}
