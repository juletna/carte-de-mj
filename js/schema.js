/**
 * Schéma du plan d'une salle et validation.
 *
 * {
 *   "version": 1,
 *   "id": "salle-1", "nom": "Salle aux piliers",
 *   "forme": "rectangle",
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
 * rotation : direction du regard de l'objet (0 nord, 90 est, 180 sud, 270 ouest).
 * position d'une porte : index de case le long du mur (de l'ouest vers l'est
 * pour nord/sud, du nord vers le sud pour est/ouest).
 */
import { OBJETS, PORTES, CREATURES, COULEURS } from './parseur/lexique.js';

export const MURS = ['nord', 'sud', 'est', 'ouest'];
export const SOLS = ['pierre', 'bois', 'terre', 'sable', 'herbe', 'marbre', 'glace'];
const TYPES_OBJETS = new Set(OBJETS.map((o) => o.type));
const TYPES_PORTES = new Set(Object.values(PORTES));
const TYPES_CREATURES = new Set(CREATURES.map((c) => c.type));
const CAMPS = ['pj', 'pnj', 'monstre'];
const MAX = 60;

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
  if (!entier(W) || W < 1 || W > MAX) erreurs.push(`largeur invalide (entier de 1 à ${MAX})`);
  if (!entier(L) || L < 1 || L > MAX) erreurs.push(`longueur invalide (entier de 1 à ${MAX})`);
  if (erreurs.length) return { ok: false, erreurs, plan: null };

  const plan = {
    version: 1,
    id: String(brut.id || 'salle-1'),
    nom: String(brut.nom || 'Salle'),
    forme: 'rectangle',
    largeur: W, longueur: L,
    sol: SOLS.includes(brut.sol) ? brut.sol : 'pierre',
    entree: MURS.includes(brut.entree) ? brut.entree : 'sud',
    portes: [], objets: [], creatures: [],
    connexions: Array.isArray(brut.connexions) ? brut.connexions : [],
  };

  (Array.isArray(brut.portes) ? brut.portes : []).forEach((p, i) => {
    const long = p?.mur === 'nord' || p?.mur === 'sud' ? W : L;
    if (!MURS.includes(p?.mur)) return erreurs.push(`porte ${i + 1} : mur inconnu « ${p?.mur} »`);
    if (!entier(p.position) || p.position < 0 || p.position >= long) return erreurs.push(`porte ${i + 1} : position hors du mur`);
    plan.portes.push({ id: String(p.id || `p${i + 1}`), mur: p.mur, position: p.position, type: TYPES_PORTES.has(p.type) ? p.type : 'porte', ...marqueCache(p) });
  });

  (Array.isArray(brut.objets) ? brut.objets : []).forEach((o, i) => {
    if (!TYPES_OBJETS.has(o?.type)) return erreurs.push(`objet ${i + 1} : type inconnu « ${o?.type} »`);
    const l = entier(o.l) && o.l > 0 ? o.l : 1, h = entier(o.h) && o.h > 0 ? o.h : 1;
    if (!entier(o.x) || !entier(o.y) || o.x < 0 || o.y < 0 || o.x + l > W || o.y + h > L) {
      return erreurs.push(`objet ${i + 1} (${o.type}) : hors de la pièce`);
    }
    const rotation = ((Math.round((Number(o.rotation) || 0) / 90) * 90) % 360 + 360) % 360;
    plan.objets.push({ id: String(o.id || `o${i + 1}`), type: o.type, x: o.x, y: o.y, l, h, rotation, ...marqueCache(o) });
  });

  const numeros = {};
  (Array.isArray(brut.creatures) ? brut.creatures : []).forEach((k, i) => {
    if (!TYPES_CREATURES.has(k?.type)) return erreurs.push(`créature ${i + 1} : type inconnu « ${k?.type} »`);
    const taille = entier(k.taille) && k.taille > 0 ? k.taille : 1;
    if (!entier(k.x) || !entier(k.y) || k.x < 0 || k.y < 0 || k.x + taille > W || k.y + taille > L) {
      return erreurs.push(`créature ${i + 1} (${k.type}) : hors de la pièce`);
    }
    numeros[k.type] = (numeros[k.type] || 0) + 1;
    const c = {
      id: String(k.id || `c${i + 1}`), type: k.type,
      camp: CAMPS.includes(k.camp) ? k.camp : CREATURES.find((d) => d.type === k.type).camp,
      x: k.x, y: k.y, taille, numero: entier(k.numero) ? k.numero : numeros[k.type],
    };
    if (COULEURS[k.couleur]) c.couleur = k.couleur;
    Object.assign(c, marqueCache(k));
    plan.creatures.push(c);
  });

  return { ok: erreurs.length === 0, erreurs, plan };
}
