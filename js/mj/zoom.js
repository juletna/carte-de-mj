/**
 * Le zoom de la scène : boutons « − », « + », « Ajuster », « Taille réelle » et Ctrl ou Cmd + molette (ou pincement), appliqués à la
 * vue affichée, la carte de la salle ou le plan du donjon. Un seul calcul pour les deux : chaque vue donne sa « cible de zoom »
 * (`cibleZoom`) ; le zoom ne connaît ni leurs bornes ni leur dessin.
 *
 * Une cible a : `taille()` (côté de case affiché), `peut()` (le zoom est permis : pas pendant le calibrage), `definir(t)` (retient le
 * zoom, arrondi et borné ; `null` = « ajuster »), `canvas()` et `marge` (cases de roche autour du dessin : le point sous le curseur
 * se mesure dans le canvas), `redessiner()`, `apres()` (facultatif : après avoir recalé le défilement) et `afficher(plan?)`
 * (pourcentage et état des boutons).
 *
 * Fabrique `creerZoom(ctx)` ; `ctx` est celui de main-mj.js (`etat`, `carte`, `plan`), lu au moment de l'appel.
 * Renvoie `afficher(plan?)` : le zoom de la vue affichée est à remontrer.
 */
import { pasDeZoom, facteurMolette } from '../mise-en-page.js';
import { $ } from '../dom.js';

export function creerZoom(ctx) {
  const { etat } = ctx;
  const r = etat.reglages;
  const cible = () => (etat.plan ? ctx.plan.cibleZoom : ctx.carte.cibleZoom);

  /**
   * Applique un zoom manuel (côté de case en px). Si `ancre` ({x, y} en px écran) est donné, la case qui s'y trouve y reste :
   * le zoom à la molette se fait sous le curseur.
   */
  function zoomer(t, ancre) {
    const c = cible();
    if (!c.peut()) return;
    const avant = c.taille();
    c.definir(t);
    let sous = null;
    if (ancre) {
      const cv = c.canvas().getBoundingClientRect();
      sous = [(ancre.x - cv.left) / avant - c.marge, (ancre.y - cv.top) / avant - c.marge];
    }
    c.redessiner();
    if (sous) {
      const apres = c.taille(), cv = c.canvas().getBoundingClientRect();
      $('scene').scrollLeft += cv.left + (sous[0] + c.marge) * apres - ancre.x;
      $('scene').scrollTop += cv.top + (sous[1] + c.marge) * apres - ancre.y;
      c.apres?.();
    }
  }
  /** Un cran de zoom : ×1,25 ou ÷1,25, d'au moins 1 px. */
  const pasZoom = (sens) => zoomer(pasDeZoom(cible().taille(), sens));
  $('zoom-plus').addEventListener('click', () => pasZoom(1));
  $('zoom-moins').addEventListener('click', () => pasZoom(-1));
  $('zoom-ajuster').addEventListener('click', () => zoomer(null));
  $('zoom-reel').addEventListener('click', () => zoomer(r.taille));
  // Ctrl ou Cmd + molette (et le pincement du pavé tactile) : zoom sous le curseur ; la molette seule fait défiler.
  $('scene').addEventListener('wheel', (e) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    zoomer(cible().taille() * facteurMolette(e.deltaY), { x: e.clientX, y: e.clientY });
  }, { passive: false });

  return { afficher: (plan) => cible().afficher(plan) };
}
