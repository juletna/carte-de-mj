/**
 * La boucle d'animation de la carte à la table : une seule, qui joue la scène rendue par `dessiner` (rendu/moteur.js) tant qu'elle a des flammes à animer.
 * Elle s'arrête d'elle-même quand l'onglet est caché ou que le canevas n'est plus affiché (écran de table refermé, canevas hors de la page), et repart quand
 * il redevient visible. `suivre(scene)` remplace la scène : l'ancienne n'est plus jouée, il n'y a jamais deux boucles. Une scène sans flammes (`anime` faux,
 * thème vectoriel, animation désactivée) arrête la boucle : le dessin est déjà complet.
 *
 * Tout ce qui touche au navigateur peut être remplacé (`env`) pour les tests ; sans navigateur (Node), la boucle ne tourne simplement pas.
 */
import { IMAGES_PAR_SECONDE } from './rendu/lumiere.js';

/** L'utilisateur demande-t-il moins de mouvement ? (réglage du système : prefers-reduced-motion) */
export function mouvementReduit() {
  try { return !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}

/**
 * @param {HTMLCanvasElement|null} canvas  surveillé : la boucle ne tourne que s'il est affiché
 * @param {{raf?:Function, annuler?:Function, cache?:()=>boolean}} [env]
 *        raf / annuler = requestAnimationFrame / cancelAnimationFrame ; cache = l'onglet est-il caché ?
 * @returns {{suivre:(scene:{anime:boolean, image:(ms:number)=>void}|null)=>void, arreter:()=>void, tourne:()=>boolean, visible:(v:boolean)=>void}}
 */
export function creerAnimation(canvas, env = {}) {
  const raf = 'raf' in env ? env.raf : globalThis.requestAnimationFrame?.bind(globalThis);
  const annuler = 'annuler' in env ? env.annuler : globalThis.cancelAnimationFrame?.bind(globalThis);
  const cache = env.cache || (() => !!globalThis.document?.hidden);
  const ecart = 1000 / IMAGES_PAR_SECONDE;
  let scene = null, boucle = 0, derniere = -Infinity, affiche = true;

  const peutTourner = () => !!(raf && scene?.anime && affiche && !cache());
  function image(ms) {
    boucle = 0;
    if (!peutTourner()) return;
    if (ms - derniere >= ecart - 1) { derniere = ms; scene.image(ms); }
    boucle = raf(image);
  }
  function arreterBoucle() { if (boucle) { annuler?.(boucle); boucle = 0; } }
  function demarrer() { if (!boucle && peutTourner()) boucle = raf(image); }

  function visible(v) {
    affiche = v;
    if (v) demarrer(); else arreterBoucle();
  }
  globalThis.document?.addEventListener?.('visibilitychange', () => { if (cache()) arreterBoucle(); else demarrer(); });
  if (canvas && typeof IntersectionObserver !== 'undefined') new IntersectionObserver(([e]) => visible(e.isIntersecting)).observe(canvas);

  return {
    suivre(nouvelle) { arreterBoucle(); scene = nouvelle || null; derniere = -Infinity; demarrer(); },
    arreter() { arreterBoucle(); scene = null; },
    tourne: () => boucle !== 0,
    visible,
  };
}
