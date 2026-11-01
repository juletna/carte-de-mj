/**
 * Le chemin inverse du parseur : plan JSON → description en français.
 *
 * Le texte produit donne le même plan quand on le relit (testé dans
 * tests/parseur.test.js). Toutes les positions y sont exactes, en
 * coordonnées de cases : « deux coffres en A1 C1 », « un lit de A2 à B2 ».
 */
import { definition, nomAffiche } from './lexique.js';
import { lettreColonne, nomCase } from './coordonnees.js';

const FEMININS = new Set([
  'colonne', 'statue', 'table', 'chaise', 'caisse', 'fosse', 'bibliotheque', 'torche', 'fontaine',
  'porte', 'herse', 'arche', 'goule', 'liche', 'araignee', 'harpie', 'manticore', 'wyverne', 'hydre',
]);
// Objets identiques quelle que soit leur orientation : inutile de la préciser.
const SYMETRIQUES = new Set(['pilier', 'colonne', 'tonneau', 'caisse', 'fosse', 'debris', 'puits', 'fontaine']);
const NOMBRES = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze'];
const DIRECTIONS = { 0: 'le nord', 90: 'l’est', 180: 'le sud', 270: 'l’ouest' };
const FACE_ENTREE = { nord: 0, sud: 180, est: 90, ouest: 270 }; // regard tourné vers le mur d'entrée

function quantite(type, n) {
  const f = FEMININS.has(type);
  if (n === 1) return f ? 'une' : 'un';
  return NOMBRES[n] || String(n);
}

function accord(mot, type, n) {
  return `${mot}${FEMININS.has(type) ? 'e' : ''}${n > 1 ? 's' : ''}`;
}

/** Une porte : « une porte au mur sud en D », « une herse au mur est en 4 ». */
function decrirePorte(p) {
  const repere = p.mur === 'nord' || p.mur === 'sud' ? lettreColonne(p.position) : p.position + 1;
  return `${quantite(p.type, 1)} ${p.type} au mur ${p.mur} en ${repere}`;
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
    const rotation = SYMETRIQUES.has(o.type) || o.rotation === regardDefaut ? null : o.rotation;
    const etendue = emplacement(o, o.l, o.h, def);
    const suite = rotation === null ? '' : (n) => ` ${accord('tourné', o.type, n)} vers ${DIRECTIONS[rotation]}`;
    if (etendue) {
      seuls.push(`${quantite(o.type, 1)} ${nomAffiche(o.type)} ${etendue}${suite ? suite(1) : ''}`);
    } else {
      const cle = `${o.type}|${rotation}`;
      if (!groupes.has(cle)) groupes.set(cle, { type: o.type, suite, cases: [] });
      groupes.get(cle).cases.push(nomCase(o.x, o.y));
    }
  }
  const lignes = [...groupes.values()].map(({ type, suite, cases }) => {
    const n = cases.length;
    return `${quantite(type, n)} ${nomAffiche(type, n)} en ${cases.join(' ')}${suite ? suite(n) : ''}`;
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
    const identite = `${k.type}|${k.camp}|${k.couleur || ''}`;
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

/**
 * @param {object} plan
 * @returns {string} description relisible par analyser()
 */
export function decrire(plan) {
  const debut = plan.nom && plan.nom !== 'Salle' ? plan.nom : 'Salle';
  const propositions = [`${debut} de ${plan.largeur} par ${plan.longueur} cases`];
  if (plan.sol && plan.sol !== 'pierre') propositions.push(`sol en ${plan.sol}`);

  // La porte du mur d'entrée d'abord : c'est la première porte qui définit l'entrée.
  const portes = [...plan.portes].sort((a, b) => (b.mur === plan.entree) - (a.mur === plan.entree));
  propositions.push(...portes.map(decrirePorte));

  const entree = portes[0]?.mur || 'sud';
  propositions.push(...decrireObjets(plan.objets, FACE_ENTREE[entree]));
  propositions.push(...decrireCreatures(plan.creatures || []));
  return `${propositions.join(', ')}.`;
}
