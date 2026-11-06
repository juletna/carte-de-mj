/**
 * Listes fermées du catalogue (docs/conception-univers.md, section 2) : la source est js/bibliotheque/vocabulaire.js (session B).
 * Ce module n'en garde que les identifiants, plus les listes propres au catalogue.
 */
import { IDS_NIVEAUX, IDS_SOUS_TYPES, IDS_MILIEUX, SOUS_TYPE_PAR_DEFAUT } from '../../js/bibliotheque/vocabulaire.js';

export const NIVEAUX = IDS_NIVEAUX;
export const SOUS_TYPES = IDS_SOUS_TYPES;
export { SOUS_TYPE_PAR_DEFAUT };
export const MILIEUX = IDS_MILIEUX;
export const ORIGINES = ['generee', 'importee', 'externe'];
export const EXTENSIONS = ['webp', 'png', 'jpg', 'jpeg', 'svg'];
