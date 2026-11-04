/**
 * Mise de côté : ce qui ne se relit pas est copié, tel quel, dans CLE_MIS_DE_COTE avant que la clé d'origine soit réécrite.
 * Partagée par le stockage du Donjon (js/stockage.js) et par la Fiche (js/fiche/main.js), qui ne peut pas importer stockage.js
 * (il tire tout le Donjon) : ce module-ci n'importe que le test d'objet de ./format.js.
 *
 * Clé  carte-de-mj:mis-de-cote-v1  { entrees: [{ cle, le, raison, valeur }] }
 */
import { estObjet } from './format.js';

export const CLE_MIS_DE_COTE = 'carte-de-mj:mis-de-cote-v1';

/** Le texte enregistré sous `cle` et ce qu'il donne : `brut` vaut null si la clé est vide, undefined si le texte n'est pas du JSON. */
export function lireBrut(stock, cle) {
  let texte = null;
  try { texte = stock?.getItem(cle) || null; } catch { /* stockage bloqué : comme s'il était vide */ }
  if (!texte) return { texte: null, brut: null };
  try { return { texte, brut: JSON.parse(texte) }; } catch { return { texte, brut: undefined }; }
}
export function ecrireJson(stock, cle, valeur) {
  try {
    stock?.setItem(cle, JSON.stringify(valeur));
    return true;
  } catch {
    return false; // Stockage indisponible ou plein : l'outil marche quand même, sans mémoire.
  }
}

/**
 * Une copie déjà là (même clé d'origine, même contenu) n'est pas refaite : recharger dix fois la page n'ajoute rien.
 */
const MAX_RAISON = 200;
const empreinte = (cle, valeur) => `${cle}\n${JSON.stringify(valeur)}`;

/** @returns {boolean} true : chaque élément est en sécurité (déjà copié, ou copié à l'instant) ; false : la copie a échoué, rien n'est à réécrire. */
export function mettreDeCote(stock, cle, ecartes) {
  if (!ecartes.length) return true;
  const { texte, brut } = lireBrut(stock, CLE_MIS_DE_COTE);
  if (texte && !(estObjet(brut) && Array.isArray(brut.entrees))) return false; // la clé de secours est elle-même abîmée : on n'y touche pas
  const entrees = brut?.entrees ?? [];
  const connues = new Set(entrees.map((e) => empreinte(e.cle, e.valeur)));
  const neuves = [];
  for (const e of ecartes) {
    if (connues.has(empreinte(cle, e.valeur))) continue;
    connues.add(empreinte(cle, e.valeur));
    neuves.push({ cle, le: new Date().toISOString(), raison: String(e.raison).slice(0, MAX_RAISON), valeur: e.valeur });
  }
  return !neuves.length || ecrireJson(stock, CLE_MIS_DE_COTE, { entrees: [...entrees, ...neuves] });
}
