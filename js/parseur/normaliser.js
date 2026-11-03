import { sansAccents } from '../format.js';

/**
 * Normalisation du texte avant analyse.
 * On travaille ensuite sur une chaîne en minuscules, sans accents,
 * avec des mots séparés par une seule espace. La ponctuation qui
 * sépare les propositions (, ; . : ! ?) est conservée.
 */
export function normaliser(texte) {
  return sansAccents(texte || '') // minuscules, é → e, ô → o…
    .replace(/œ/g, 'oe')
    .replace(/(\d),(\d)/g, '$1.$2')                   // 4,5 → 4.5
    .replace(/(\d)\s*[x×]\s*(\d)/g, '$1 par $2')      // 12x8 → 12 par 8
    .replace(/(\d)\s*m\b/g, '$1 m')                   // 4m → 4 m
    .replace(/[’'`-]/g, ' ')                          // l'entrée → l entree, nord-est → nord est
    .replace(/[^a-z0-9.,;:!?\s]/g, ' ')
    .replace(/\s*([,;:!?])\s*/g, ' $1 ')
    .replace(/\s+/g, ' ')
    .trim();
}
