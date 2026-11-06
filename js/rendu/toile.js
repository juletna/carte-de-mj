/**
 * Un canevas hors écran, quand le navigateur sait en fabriquer (OffscreenCanvas, sinon un <canvas> détaché) ; `null` ailleurs (tests sous Node).
 * Sert aux tuiles de sol du thème peint, à la couche fixe mise en cache pour l'animation (moteur.js) et à la couche de lumière (themes/peint/lumiere.js).
 */
export function creerToile(largeur, hauteur) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(largeur, hauteur);
  if (typeof document !== 'undefined') { const c = document.createElement('canvas'); c.width = largeur; c.height = hauteur; return c; }
  return null;
}
