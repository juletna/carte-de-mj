/**
 * Où vit le « dossier de travail » de l'appli pour les scripts de outils/cartes : la variable d'environnement
 * CARTE_DE_MJ_DOSSIER (chemin absolu de la racine du dossier choisi dans l'appli). Les cartes sont dans images/ + images/index.json.
 * Ancienne variable CARTE_DE_MJ_BIBLIOTHEQUE (chemin du sous-dossier bibliotheque/) : on en prend le parent, avec un avertissement.
 * Module pur : l'environnement est injecté.
 */
import path from 'node:path';

export const VARIABLE_DOSSIER = 'CARTE_DE_MJ_DOSSIER';
export const VARIABLE_ANCIENNE = 'CARTE_DE_MJ_BIBLIOTHEQUE';

/** Le message qui explique quoi exporter. */
export const AIDE_VARIABLE = `Le dossier de travail de l'appli n'est pas indiqué : exportez ${VARIABLE_DOSSIER} avec son chemin absolu (la racine du dossier choisi dans l'appli, celle qui contient images/), puis relancez.\nExemple : export ${VARIABLE_DOSSIER}="$HOME/Drive/jeu-de-role"`;

/**
 * Rend { dossier, avertissement? } : le dossier de travail (chemin absolu normalisé).
 * @throws {Error} sans variable, ou si le chemin n'est pas absolu.
 */
export function dossierTravail(env = {}) {
  const v = env[VARIABLE_DOSSIER];
  if (v !== undefined && v !== '') {
    if (!path.isAbsolute(v)) throw new Error(`${VARIABLE_DOSSIER} doit être un chemin absolu (reçu : ${v})`);
    return { dossier: path.normalize(v).replace(/(.)[\\/]+$/, '$1') };
  }
  const ancienne = env[VARIABLE_ANCIENNE];
  if (ancienne !== undefined && ancienne !== '') {
    if (!path.isAbsolute(ancienne)) throw new Error(`${VARIABLE_ANCIENNE} doit être un chemin absolu (reçu : ${ancienne})`);
    const n = path.normalize(ancienne).replace(/[\\/]+$/, '');
    if (path.basename(n) === 'bibliotheque') {
      return { dossier: path.dirname(n), avertissement: `${VARIABLE_ANCIENNE} est l'ancienne variable : j'utilise son parent (${path.dirname(n)}). Exportez plutôt ${VARIABLE_DOSSIER}=${path.dirname(n)}` };
    }
  }
  throw new Error(AIDE_VARIABLE);
}
