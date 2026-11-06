/**
 * Où vit la bibliothèque pour les scripts de outils/cartes : <racine du dépôt>/bibliotheque par défaut, ou le dossier donné par la
 * variable d'environnement CARTE_DE_MJ_BIBLIOTHEQUE (chemin absolu du sous-dossier bibliotheque/ du « dossier de travail » de l'appli).
 * Module pur : l'environnement est injecté.
 */
import path from 'node:path';

export const VARIABLE_BIBLIOTHEQUE = 'CARTE_DE_MJ_BIBLIOTHEQUE';

/** @throws {Error} si la variable est définie mais n'est pas un chemin absolu. */
export function dossierBibliotheque(racine, env = {}) {
  const v = env[VARIABLE_BIBLIOTHEQUE];
  if (v === undefined || v === '') return path.join(racine, 'bibliotheque');
  if (!path.isAbsolute(v)) throw new Error(`${VARIABLE_BIBLIOTHEQUE} doit être un chemin absolu (reçu : ${v})`);
  return path.normalize(v);
}
