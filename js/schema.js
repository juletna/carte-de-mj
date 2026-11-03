/**
 * Schéma du plan d'une salle et validation.
 *
 * {
 *   "version": 1,
 *   "id": "salle-1", "nom": "Salle aux piliers",
 *   "forme": "rectangle",               // ou une autre forme de FORMES (croix, octogone, L, T, U, 8, E, F, H, O, S), avec "bras" et "position" facultatifs : voir formes.js
 *   "largeur": 3, "longueur": 8,        // en cases ; x : ouest→est, y : nord→sud
 *   "sol": "pierre",                    // pierre, bois, terre, sable, herbe, marbre, glace
 *   "entree": "sud",                    // mur d'entrée ; « le fond » est le mur opposé
 *   "portes": [{ "id": "p1", "mur": "sud", "position": 1, "type": "porte" }],
 *   "objets": [{ "id": "o1", "type": "pilier", "x": 0, "y": 2, "l": 1, "h": 1, "rotation": 0 }],
 *   "creatures": [{ "id": "c1", "type": "gobelin", "camp": "monstre", "x": 1, "y": 0, "taille": 1, "numero": 1 }],
 *   "connexions": []                    // V3 : [{ "porte": "p1", "vers": "salle-2" }]
 * }
 *
 * cache (facultatif, sur une porte, un objet ou une créature) : true = élément secret,
 * à ne pas montrer aux joueurs. Il reste visible dans la vue MJ (dessiné en translucide).
 *
 * camp d'une créature : pj, pnj ou monstre ; taille = côté du pion en cases ;
 * couleur (facultative) : rouge, bleu, vert… (voir COULEURS dans lexique.js).
 * etat (facultatif, posé en partie par la Présentation) : « blesse » ou « mort » ; absent = normal.
 * fiche (facultatif, posé en partie) : identifiant du personnage du donjon dont ce pion est le pion (voir personnages.js).
 * rotation : direction du regard de l'objet (0 nord, 90 est, 180 sud, 270 ouest).
 * position d'une porte : index de case le long du mur (de l'ouest vers l'est
 * pour nord/sud, du nord vers le sud pour est/ouest).
 */
import { PORTES, COULEURS } from './parseur/lexique.js';
import { OBJETS, CREATURES } from './catalogue.js';
import { normaliserForme, surLeSol } from './formes.js';
import { MURS, longueurMur } from './murs.js';

export const SOLS = ['pierre', 'bois', 'terre', 'sable', 'herbe', 'marbre', 'glace'];
/** Le nom de chaque sol, pour le sélecteur de l'écran. */
export const NOMS_SOLS = { pierre: 'Pierre', bois: 'Bois', terre: 'Terre', sable: 'Sable', herbe: 'Herbe', marbre: 'Marbre', glace: 'Glace' };
const TYPES_OBJETS = new Set(OBJETS.map((o) => o.type));
const TYPES_PORTES = new Set(Object.values(PORTES));
const TYPES_CREATURES = new Set(CREATURES.map((c) => c.type));
const CAMPS = ['pj', 'pnj', 'monstre'];
/** États d'un pion en jeu (absence de champ = normal). */
export const ETATS = ['blesse', 'mort'];
/** Côté maximal d'une salle, en cases : la même limite pour le schéma, le parseur et la pose. */
export const CASES_MAX = 60;
/** Numéro de version écrit dans chaque plan (le champ `version` du schéma ci-dessus). */
export const VERSION_PLAN = 1;

/** Le genre d'un élément du plan (porte, objet, créature) → la liste du plan qui le contient. */
export const LISTES = { porte: 'portes', objet: 'objets', creature: 'creatures' };

const entier = (v) => Number.isInteger(v);
/** `cache: true` conservé tel quel ; toute autre valeur est ignorée (le champ n'existe alors pas). */
const marqueCache = (e) => (e?.cache === true ? { cache: true } : {});

/**
 * Valide (et corrige quand c'est sans risque) un plan venant d'un fichier
 * importé ou de l'éditeur JSON.
 * @returns {{ok:boolean, erreurs:string[], plan:object|null}}
 */
export function validerPlan(brut) {
  const erreurs = [];
  if (!brut || typeof brut !== 'object') return { ok: false, erreurs: ['le plan doit être un objet JSON'], plan: null };

  const W = brut.largeur, L = brut.longueur;
  if (!entier(W) || W < 1 || W > CASES_MAX) erreurs.push(`largeur invalide (entier de 1 à ${CASES_MAX})`);
  if (!entier(L) || L < 1 || L > CASES_MAX) erreurs.push(`longueur invalide (entier de 1 à ${CASES_MAX})`);
  if (erreurs.length) return { ok: false, erreurs, plan: null };

  const plan = {
    version: VERSION_PLAN,
    id: String(brut.id || 'salle-1'),
    nom: String(brut.nom || 'Salle'),
    ...normaliserForme(brut),
    largeur: W, longueur: L,
    sol: SOLS.includes(brut.sol) ? brut.sol : 'pierre',
    entree: MURS.includes(brut.entree) ? brut.entree : 'sud',
    portes: [], objets: [], creatures: [],
    connexions: Array.isArray(brut.connexions) ? brut.connexions : [],
  };

  (Array.isArray(brut.portes) ? brut.portes : []).forEach((p, i) => {
    const long = longueurMur(p?.mur, W, L);
    if (!MURS.includes(p?.mur)) return erreurs.push(`porte ${i + 1} : mur inconnu « ${p?.mur} »`);
    if (!entier(p.position) || p.position < 0 || p.position >= long) return erreurs.push(`porte ${i + 1} : position hors du mur`);
    plan.portes.push({ id: String(p.id || `p${i + 1}`), mur: p.mur, position: p.position, type: TYPES_PORTES.has(p.type) ? p.type : 'porte', ...marqueCache(p) });
  });

  (Array.isArray(brut.objets) ? brut.objets : []).forEach((o, i) => {
    if (!TYPES_OBJETS.has(o?.type)) return erreurs.push(`objet ${i + 1} : type inconnu « ${o?.type} »`);
    const l = entier(o.l) && o.l > 0 ? o.l : 1, h = entier(o.h) && o.h > 0 ? o.h : 1;
    if (!entier(o.x) || !entier(o.y) || o.x < 0 || o.y < 0 || o.x + l > W || o.y + h > L || !surLeSol(plan, o.x, o.y, l, h)) {
      return erreurs.push(`objet ${i + 1} (${o.type}) : hors de la pièce`);
    }
    const rotation = ((Math.round((Number(o.rotation) || 0) / 90) * 90) % 360 + 360) % 360;
    plan.objets.push({ id: String(o.id || `o${i + 1}`), type: o.type, x: o.x, y: o.y, l, h, rotation, ...marqueCache(o) });
  });

  const numeros = {};
  (Array.isArray(brut.creatures) ? brut.creatures : []).forEach((k, i) => {
    if (!TYPES_CREATURES.has(k?.type)) return erreurs.push(`créature ${i + 1} : type inconnu « ${k?.type} »`);
    const taille = entier(k.taille) && k.taille > 0 ? k.taille : 1;
    if (!entier(k.x) || !entier(k.y) || k.x < 0 || k.y < 0 || k.x + taille > W || k.y + taille > L || !surLeSol(plan, k.x, k.y, taille, taille)) {
      return erreurs.push(`créature ${i + 1} (${k.type}) : hors de la pièce`);
    }
    numeros[k.type] = (numeros[k.type] || 0) + 1;
    const c = {
      id: String(k.id || `c${i + 1}`), type: k.type,
      camp: CAMPS.includes(k.camp) ? k.camp : CREATURES.find((d) => d.type === k.type).camp,
      x: k.x, y: k.y, taille, numero: entier(k.numero) ? k.numero : numeros[k.type],
    };
    if (COULEURS[k.couleur]) c.couleur = k.couleur;
    if (ETATS.includes(k.etat)) c.etat = k.etat;
    if (typeof k.fiche === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(k.fiche)) c.fiche = k.fiche;
    Object.assign(c, marqueCache(k));
    plan.creatures.push(c);
  });

  return { ok: erreurs.length === 0, erreurs, plan };
}
