/**
 * Le fond d'un lieu « à illustrer » (sans image) : une carte neutre en paysage 16:9 (le format des cartes générées), couleur parchemin,
 * dessinée et claire, avec le nom du lieu au centre en discret. Un SVG en URL de données : la scène, la régie et la table le traitent
 * comme n'importe quelle image (mêmes dimensions, mêmes points posés en fractions), sans code à part. Aucun fichier, aucune bibliothèque.
 * Fonctions pures (sans DOM) : le nom vient d'un fichier, il est échappé avant d'entrer dans le SVG.
 */
export const FOND_LARGEUR = 1600;
export const FOND_HAUTEUR = 900;

const echapper = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Le nom coupé en au plus deux lignes (mots entiers, 22 caractères la ligne), chaque ligne coupée à 30 caractères. */
export function lignesDuNom(nom) {
  const mots = String(nom ?? '').trim().split(/\s+/).filter(Boolean);
  const lignes = [];
  let ligne = '';
  for (const m of mots) {
    if (ligne && (ligne + ' ' + m).length > 22 && lignes.length < 1) { lignes.push(ligne); ligne = m; } else ligne = ligne ? `${ligne} ${m}` : m;
  }
  if (ligne) lignes.push(ligne);
  return lignes.map((l) => (l.length > 30 ? `${l.slice(0, 29)}…` : l));
}

/** Le SVG du fond neutre pour un lieu de ce nom (texte). */
export function svgFondNeutre(nom = '') {
  const lignes = lignesDuNom(nom);
  const taille = lignes.some((l) => l.length > 18) ? 60 : 76;
  const y0 = FOND_HAUTEUR / 2 - ((lignes.length - 1) * taille * 1.1) / 2 - 40;
  const texte = lignes.map((l, i) => `<tspan x="${FOND_LARGEUR / 2}" y="${Math.round(y0 + i * taille * 1.1)}">${echapper(l)}</tspan>`).join('');
  const bas = FOND_HAUTEUR * 0.82, haut = FOND_HAUTEUR * 0.18;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${FOND_LARGEUR}" height="${FOND_HAUTEUR}" viewBox="0 0 ${FOND_LARGEUR} ${FOND_HAUTEUR}">`
    + '<defs><radialGradient id="p" cx="50%" cy="46%" r="75%"><stop offset="0" stop-color="#f7ecd0"/><stop offset="0.7" stop-color="#eedcb0"/><stop offset="1" stop-color="#dfc78f"/></radialGradient></defs>'
    + `<rect width="${FOND_LARGEUR}" height="${FOND_HAUTEUR}" fill="url(#p)"/>`
    + `<rect x="36" y="36" width="${FOND_LARGEUR - 72}" height="${FOND_HAUTEUR - 72}" rx="18" fill="none" stroke="#c9ae72" stroke-width="3" stroke-dasharray="3 14" stroke-linecap="round" opacity="0.8"/>`
    + `<path d="M0 ${bas} C 400 ${bas - 70} 700 ${bas + 60} 1100 ${bas - 20} S 1500 ${bas - 40} ${FOND_LARGEUR} ${bas + 20}" fill="none" stroke="#d3ba82" stroke-width="3" opacity="0.5"/>`
    + `<path d="M0 ${haut} C 300 ${haut + 70} 640 ${haut - 60} 1000 ${haut + 10} S 1450 ${haut + 40} ${FOND_LARGEUR} ${haut - 30}" fill="none" stroke="#d3ba82" stroke-width="3" opacity="0.5"/>`
    + `<text text-anchor="middle" font-family="Georgia, 'Palatino Linotype', 'Book Antiqua', serif" font-style="italic" font-size="${taille}" fill="#8b7447" opacity="0.62">${texte}</text>`
    + '</svg>';
}

/** L'URL de données du fond neutre : utilisable comme `src` d'une image. */
export const urlFondNeutre = (nom = '') => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgFondNeutre(nom))}`;
