/**
 * Icônes SVG inline communes à toutes les pages (même style que celles du rail du Donjon) : viewBox 24, trait de 1,75 px
 * en `currentColor`, extrémités arrondies, sans remplissage, `aria-hidden="true"` (le sens est porté par le libellé ou l'aria-label).
 * Module sans dépendance au DOM au chargement : `iconeHtml` rend une chaîne (testée sous Node), `icone` un élément SVG.
 *   iconeHtml('plus')               → '<svg class="icone" …>…</svg>' pour du HTML statique
 *   icone('plus', { taille: 20 })   → élément SVG (taille en px ; sinon 1,15 em via la classe .icone de css/base.css)
 * Un nom inconnu lève une Error : on ne rend jamais une icône vide en silence.
 */

/** Intérieur de chaque icône (chemins sur une grille de 24). `donjon` et `fiche` reprennent « Salles » et « Notes » du rail. */
export const ICONES = {
  monde: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17"/><path d="M12 3.5c2.4 2.4 3.6 5.2 3.6 8.5s-1.2 6.1-3.6 8.5c-2.4-2.4-3.6-5.2-3.6-8.5s1.2-6.1 3.6-8.5z"/>',
  donjon: '<rect x="3.5" y="4" width="7" height="6" rx="1"/><rect x="13.5" y="14" width="7" height="6" rx="1"/><path d="M10.5 7H17v7"/>',
  jouer: '<path d="M8 5.5v13l11-6.5z"/>',
  bibliotheque: '<path d="M5 4h4v16H5z"/><path d="M9 4h4v16H9z"/><path d="M14.5 5.5l3.8-1 3.2 14.8-3.8 1z"/>',
  fiche: '<path d="M6 3.5h9l4 4v13H6z"/><path d="M15 3.5v4h4"/><path d="M9.5 12h6M9.5 15.5h6"/>',
  sauvegarde: '<path d="M5 4h11l3 3v13H5z"/><path d="M8 4v5h7V4"/><rect x="8" y="13" width="8" height="7"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  fermer: '<path d="M6 6l12 12M18 6L6 18"/>',
  'plus-d-actions': '<circle cx="5.5" cy="12" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="18.5" cy="12" r="1.2" fill="currentColor"/>',
  retour: '<path d="M20 12H5M11 6l-6 6 6 6"/>',
  remonter: '<path d="M12 20V5M6 11l6-6 6 6"/>',
  micro: '<rect x="9" y="3.5" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v2.5M8.5 20.5h7"/>',
  stop: '<rect x="6.5" y="6.5" width="11" height="11" rx="1.5"/>',
  de: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 3v18M4 7.5l8 4.5 8-4.5"/>',
  oeil: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  'oeil-barre': '<path d="M9.8 5.8A9 9 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a15 15 0 0 1-2.6 3.4M6.3 7.5A15 15 0 0 0 2.5 12S6 18.5 12 18.5a9 9 0 0 0 3.9-.9"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/><path d="M4 4l16 16"/>',
  copier: '<rect x="8.5" y="8.5" width="11" height="11" rx="1.5"/><path d="M15.5 8.5v-3A1.5 1.5 0 0 0 14 4H5.5A1.5 1.5 0 0 0 4 5.5V14a1.5 1.5 0 0 0 1.5 1.5h3"/>',
  'plein-ecran': '<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/>',
  exporter: '<path d="M12 15V4M7.5 8.5L12 4l4.5 4.5"/><path d="M5 14v5h14v-5"/>',
  importer: '<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5"/><path d="M5 14v5h14v-5"/>',
  supprimer: '<path d="M4 7h16M10 7V4.5h4V7M6.5 7l.8 13h9.4l.8-13M10 11v6M14 11v6"/>',
  crayon: '<path d="M4 20l1-4.5L16.5 4a2 2 0 0 1 3 3L8 18.5z"/><path d="M14.5 6l3.5 3.5"/>',
  grille: '<rect x="4" y="4" width="16" height="16" rx="1"/><path d="M9.3 4v16M14.7 4v16M4 9.3h16M4 14.7h16"/>',
  point: '<path d="M12 21s6.5-5.8 6.5-11a6.5 6.5 0 0 0-13 0c0 5.2 6.5 11 6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
  recentrer: '<circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><path d="M12 2.5V6M12 18v3.5M2.5 12H6M18 12h3.5"/>',
  fleches: '<path d="M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3"/>',
  aide: '<circle cx="12" cy="12" r="8.5"/><path d="M9.5 9.5a2.6 2.6 0 0 1 5 .9c0 1.7-2.5 2.1-2.5 3.8"/><circle cx="12" cy="17" r="0.9" fill="currentColor" stroke="none"/>',
  // Ajoutées avec la migration du Donjon et de la Fiche.
  moins: '<path d="M5 12h14"/>',
  annuler: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  'chevron-bas': '<path d="M6 9.5l6 6 6-6"/>',
  'chevron-gauche': '<path d="M14.5 5.5l-6.5 6.5 6.5 6.5"/>',
  alerte: '<path d="M12 4.5l9 15.5H3z"/><path d="M12 10v4.5"/><circle cx="12" cy="17.2" r="0.9" fill="currentColor" stroke="none"/>',
};

/** Les noms disponibles, dans l'ordre de déclaration. */
export const NOMS_ICONES = Object.keys(ICONES);

/** Attributs communs : le style (trait, arrondis) est ici, pas dans le CSS, pour que l'icône reste correcte sans feuille. */
const ATTRS = 'class="icone" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"';

function interieur(nom) {
  if (!Object.hasOwn(ICONES, nom)) throw new Error(`Icône inconnue : « ${nom} » (disponibles : ${NOMS_ICONES.join(', ')})`);
  return ICONES[nom];
}

/** L'icône en chaîne SVG, pour du HTML statique ou innerHTML. */
export function iconeHtml(nom) {
  return `<svg ${ATTRS}>${interieur(nom)}</svg>`;
}

/** L'icône en élément SVG (DOM). `taille` en px fixe largeur et hauteur ; sans elle, la classe .icone donne 1,15 em. */
export function icone(nom, { taille } = {}) {
  const modele = document.createElement('template');
  modele.innerHTML = iconeHtml(nom);
  const svg = modele.content.firstChild;
  if (taille) { svg.setAttribute('width', String(taille)); svg.setAttribute('height', String(taille)); }
  return svg;
}
