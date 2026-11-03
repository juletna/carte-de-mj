/**
 * Format de l'outil Fiche : où il enregistre ses personnages, comment s'appelle son fichier exporté, ce qu'est une fiche.
 * Feuille sans dépendance de l'application (elle n'importe que le test d'objet de ../format.js, lui-même sans import) :
 * le Donjon la lit pour ses personnages (personnages.js, stockage.js), la Fiche ne dépend jamais de stockage.js.
 *
 * `fiche.html` garde pour l'instant sa propre copie de ces valeurs dans son script (classique, en ligne) : tests/fiche-contrat.test.js
 * compare les deux, pour qu'elles ne divergent pas.
 */
import { estObjet } from '../format.js';

/** Clé du navigateur où la Fiche range { actif, persos: { <id>: fiche } }. Le Donjon la lit, il n'y écrit jamais. */
export const CLE_FICHES = 'dd-fiche-personnages-v1';
/** Ancienne clé de la Fiche (un seul personnage) : elle la relit tant que la précédente est absente. */
export const CLE_FICHE_ANCIENNE = 'dd-fiche-partie-v1';
/** Le fichier exporté par la Fiche : { format: FORMAT_FICHE, version: VERSION_FICHE, personnage }. */
export const FORMAT_FICHE = 'fiche-partie';
export const VERSION_FICHE = 1;

/** Ce qui peut être une fiche : un objet avec ses caractéristiques (`stats`), rien de plus exigé. */
export const estFiche = (brut) => estObjet(brut) && estObjet(brut.stats);
