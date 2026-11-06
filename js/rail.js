/**
 * Les trois catégories du catalogue de vignettes (js/palette.js), onglet « Ajouter » de l'inspecteur du Donjon
 * (js/atelier/catalogue-onglet.js) : Portes, Mobilier et Créatures. L'ancien rail à gauche n'existe plus : Salle, Personnages, Notes, Salles et Réglages
 * sont passés dans l'inspecteur (js/atelier/inspecteurs-donjon.js). Ne reste ici que la table des outils de catalogue et l'état
 * mémorisé de l'ancien rail (`etatDepuis`, `outilAffiche`, gardés tels quels : testés dans tests/pose.test.js).
 */

/**
 * Les outils de la barre, dans l'ordre des boutons. `titre` : celui du bouton ; `aide` : son infobulle ; `trace` : le dessin de son
 * icône (intérieur d'un <svg viewBox="0 0 24 24">, trait de 1,7 px). `catalogue` : l'outil montre le catalogue de vignettes ; sur
 * téléphone, ils passent tous par le bouton « + Ajouter » et le tiroir du bas. Un test garde cette table et la page d'accord.
 */
export const OUTILS = [
  { id: 'portes', titre: 'Portes', catalogue: true, aide: 'Portes, herses et arches',
    trace: '<path d="M7 21V4.5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1V21"/><path d="M4 21h16"/><circle cx="14.2" cy="12.5" r="0.9" fill="currentColor" stroke="none"/>' },
  { id: 'mobilier', titre: 'Mobilier', catalogue: true, aide: 'Mobilier : coffres, tables, piliers…',
    trace: '<path d="M3.5 10.5a8.5 5.5 0 0 1 17 0V19a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1z"/><path d="M3.5 14h17"/><rect x="10.5" y="12" width="3" height="4" rx="0.6"/>' },
  { id: 'creatures', titre: 'Créatures', catalogue: true, aide: 'Créatures : monstres, peuples, personnage',
    trace: '<circle cx="12" cy="7.5" r="3.5"/><path d="M6.5 20.5c0-4.2 2.4-7 5.5-7s5.5 2.8 5.5 7z"/>' },
];
export const OUTILS_CATALOGUE = OUTILS.filter((o) => o.catalogue).map((o) => o.id);
export const TITRES_OUTILS = Object.fromEntries(OUTILS.map((o) => [o.id, o.titre]));
export const OUTIL_DEFAUT = 'salle';

/**
 * État mémorisé → { outil, replie }, sans jamais échouer : texte absent, abîmé ou d'un outil inconnu → valeurs par défaut.
 * @param {string|null} brut  contenu du localStorage
 * @param {string[]} valides  outils connus
 */
export function etatDepuis(brut, valides) {
  let lu = null;
  try { lu = JSON.parse(brut); } catch { /* texte abîmé : défauts */ }
  const outil = lu && valides.includes(lu.outil) ? lu.outil : OUTIL_DEFAUT;
  return { outil, replie: !!lu && lu.replie === true };
}

/**
 * Outil réellement affiché : sur téléphone, un outil de catalogue n'a pas de panneau (il passe par le tiroir) ;
 * on montre alors l'outil par défaut.
 */
export function outilAffiche(outil, surTelephone) {
  return surTelephone && OUTILS_CATALOGUE.includes(outil) ? OUTIL_DEFAUT : outil;
}
