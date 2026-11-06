/**
 * Listes fermées du catalogue (docs/conception-univers.md, section 2) : la source est js/bibliotheque/vocabulaire.js (session B).
 * Ce module n'en garde que les identifiants, plus les listes propres au catalogue.
 */
import { IDS_NIVEAUX, IDS_MILIEUX } from '../../js/bibliotheque/vocabulaire.js';

export const NIVEAUX = IDS_NIVEAUX;
export const MILIEUX = IDS_MILIEUX;
export const ORIGINES = ['generee', 'importee', 'externe'];
export const EXTENSIONS = ['webp', 'png', 'jpg', 'jpeg', 'svg'];
