/**
 * Thème « peint » : le thème par défaut à l'écran. Style « trait colorié » : contour brun irrégulier, aplats nuancés, ombres portées douces,
 * sols riches (tuiles procédurales raccordables), murs en perspective vus du centre de la salle. Rien n'est une image : tout est calculé.
 * Il respecte le contrat des thèmes (voir vectoriel.js) et y ajoute :
 *   preparer(ctx, plan, t, {relief})      appelé par le moteur avant de dessiner une salle : calcule la vue (centre, KP) et la graine (peint/etat.js)
 *   grille(ctx, plan, t, opacite)         grille en pointillés, d'opacité réglable (0–1)
 *
 * Où se brancheront les lots suivants :
 *   - objets en fausse 3D (lot 2)  : peint/objets.js, avec `volumesLocaux(ctx)` (peint/volumes.js : haut, KP, prisme, cylindre, auNiveau) ; les pions à plat : peint/pions.js.
 *                                    Le moteur dessine les objets du plus loin au plus proche du centre (moteur.js : `ordonnerObjets`).
 *   - lumière et flammes (lot 3)   : une couche sombre posée par le moteur après `pions`. Les sources sont relevées pendant le dessin des objets dans `etat.lumieres`
 *                                    (un objet les déclare avec `V.lumiere(x, y, h, source)`, voir peint/volumes.js et peint/etat.js) ; `etat.flammesAnimees` éteint les flammes fixes.
 *   - ambiance, état, éclairage (lot 4) : champs du plan lus par `preparer` (etat.ambiance, etat.etatSalle) et déjà dans la clé des tuiles de sol.
 *
 * Modules : peint/bruit.js (bruits), peint/sols.js (tuiles), peint/segments.js (murs en segments), peint/murs.js (murs, ombre, portes),
 * peint/trait.js (trait à la main), peint/volumes.js (volumes en fausse 3D), peint/objets.js (les 19 objets), peint/pions.js (pions à plat), peint/etat.js (état du dessin en cours), ../perspective.js (calculs de vue).
 */
import { tracerSol } from '../trace.js';
import { vueDeSalle, IDENTITE, haut as hautVue } from '../perspective.js';
import { CASES_PAR_TUILE, calculerTuile, cleTuile, resolutionTuile } from './peint/sols.js';
import { dessinerMurs, dessinerPorte, ombreAuPied } from './peint/murs.js';
import { h2 } from './peint/bruit.js';
import { graineDePlan } from '../graine.js';
import { etat } from './peint/etat.js';
import * as vectoriel from './vectoriel.js';

// Les objets et les pions sont ceux du thème peint (peint/objets.js, peint/pions.js) ; le repère de liaison reste celui du vectoriel.
export { objets } from './peint/objets.js';
export { pion } from './peint/pions.js';
export { marqueLiaison } from './vectoriel.js';

const FOND_ROCHE = '#141316';
const GRILLE_COULEUR = '20,14,10'; // brun très sombre
const GRILLE_PART = 0.7; // opacité du trait à 100 % du réglage « Cases » : plein, la grille mangerait le décor

/**
 * Prépare le dessin d'une salle : le centre de la vue, KP (0 sans relief), la graine tirée de l'identifiant de la salle, la matrice de base.
 * Appelée par le moteur avant `roche` puis au début de `peindre` (la matrice change entre les deux : la marge de roche).
 * @param {{relief?:boolean}} [options]
 */
export function preparer(ctx, plan, t, { relief = true } = {}) {
  const m = ctx.getTransform?.();
  const valide = m && Number.isFinite(m.a);
  etat.base = valide ? { a: m.a, b: m.b, c: m.c, d: m.d, e: m.e, f: m.f } : IDENTITE;
  etat.dpr = (valide ? Math.hypot(m.a, m.b) : globalThis.window?.devicePixelRatio) || 1;
  etat.vue = vueDeSalle(plan, t, relief);
  etat.relief = etat.vue.kp > 0;
  etat.graine = graineDePlan(plan);
  etat.ambiance = plan.ambiance ?? 'neutre';
  etat.etatSalle = plan.etat ?? 'neuve';
  etat.plan = plan;
  etat.t = t;
  etat.lumieres = [];
}

// --- Tuiles de sol --------------------------------------------------------------------------------------------

const tuiles = new Map(); // clé de cache → canvas (ou null quand le navigateur ne sait pas en fabriquer : tests sous Node)
const TUILES_MAX = 40;

function creerCanvas(largeur, hauteur) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(largeur, hauteur);
  if (typeof document !== 'undefined') { const c = document.createElement('canvas'); c.width = largeur; c.height = hauteur; return c; }
  return null;
}

/** La tuile d'un sol pour des cases de `t` px, calculée une fois puis gardée. @returns {{canvas:object, cote:number}|null} */
function tuile(nom, t) {
  const resolution = resolutionTuile(t, etat.dpr);
  const cle = cleTuile(nom, resolution, { ambiance: etat.ambiance, etat: etat.etatSalle });
  if (!tuiles.has(cle)) {
    if (tuiles.size >= TUILES_MAX) tuiles.delete(tuiles.keys().next().value);
    let canvas = null;
    const { cote, data } = calculerTuile(nom, resolution);
    canvas = creerCanvas(cote, cote);
    if (canvas) {
      const g = canvas.getContext('2d'), img = g.createImageData(cote, cote);
      img.data.set(data);
      g.putImageData(img, 0, 0);
    }
    tuiles.set(cle, canvas ? { canvas, cote } : null);
  }
  return tuiles.get(cle);
}

/**
 * Remplit le rectangle (0, 0, largeur, hauteur) avec la tuile du sol `nom`, décalée selon la graine de la salle (deux salles ne se ressemblent pas).
 * Sans tuile (pas de canvas pour la fabriquer), un aplat de `secours`.
 */
function remplirDeTuile(ctx, nom, t, largeur, hauteur, secours) {
  const une = tuile(nom, t);
  const motif = une && ctx.createPattern?.(une.canvas, 'repeat');
  if (!motif) { ctx.fillStyle = secours; ctx.fillRect(0, 0, largeur, hauteur); return; }
  const periode = CASES_PAR_TUILE * t, k = periode / une.cote;
  const ox = -h2(etat.graine & 0xffff, 1, 5) * periode, oy = -h2(etat.graine & 0xffff, 2, 5) * periode;
  ctx.save();
  ctx.translate(ox, oy);
  ctx.scale(k, k);
  ctx.fillStyle = motif;
  ctx.fillRect(-ox / k, -oy / k, largeur / k, hauteur / k);
  ctx.restore();
}

// --- Le contrat d'un thème ----------------------------------------------------------------------------------

export function roche(ctx, W, H, t) {
  remplirDeTuile(ctx, 'roche', t, W, H, FOND_ROCHE);
}

const COULEURS_SECOURS = { pierre: '#7d7a74', marbre: '#d8d4cc', bois: '#8a6038', terre: '#6e5a42', sable: '#c9b282', herbe: '#5c7a3e', glace: '#bcd8e6' };

export function sol(ctx, plan, t) {
  ctx.save();
  tracerSol(ctx, plan, t);
  ctx.clip();
  remplirDeTuile(ctx, plan.sol, t, plan.largeur * t, plan.longueur * t, COULEURS_SECOURS[plan.sol] || COULEURS_SECOURS.pierre);
  ctx.restore();
  ombreAuPied(ctx, plan, t);
}

export function murs(ctx, plan, t) { dessinerMurs(ctx, plan, t); }
export function porte(ctx, p, plan, t) { dessinerPorte(ctx, p, plan, t); }

/** Grille en pointillés sombres sur le sol ; `opacite` de 0 à 1 (le réglage « Cases »). */
export function grille(ctx, plan, t, opacite = 0.5) {
  const a = Math.max(0, Math.min(1, opacite)) * GRILLE_PART;
  if (!a) return;
  ctx.save();
  tracerSol(ctx, plan, t);
  ctx.clip();
  ctx.setLineDash([t * 0.06, t * 0.1]);
  ctx.strokeStyle = `rgba(${GRILLE_COULEUR},${a})`;
  ctx.lineWidth = 1 + a;
  ctx.beginPath();
  for (let x = 1; x < plan.largeur; x++) { ctx.moveTo(x * t, 0); ctx.lineTo(x * t, plan.longueur * t); }
  for (let y = 1; y < plan.longueur; y++) { ctx.moveTo(0, y * t); ctx.lineTo(plan.largeur * t, y * t); }
  ctx.stroke();
  ctx.restore();
}

// --- Repères d'interface -----------------------------------------------------------------------------------

/** Une porte dessinée sur la face du mur est plus haut que son pied : les repères qui l'entourent la suivent. */
function rectPorteRelevee(r, t) {
  if (!etat.relief) return r;
  const [x, y] = hautVue(etat.vue, (r.x + r.l / 2) * t, (r.y + r.h / 2) * t, 0.37);
  return { x: x / t - r.l / 2, y: y / t - r.h / 2, l: r.l, h: r.h };
}

export function repereCache(ctx, r, t, genre) {
  vectoriel.repereCache(ctx, genre === 'porte' ? rectPorteRelevee(r, t) : r, t);
}

export function marqueSelection(ctx, r, t, genre) {
  vectoriel.marqueSelection(ctx, genre === 'porte' ? rectPorteRelevee(r, t) : r, t);
}
