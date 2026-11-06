/**
 * Thème « peint » : le thème par défaut à l'écran. Style « trait colorié » : contour brun irrégulier, aplats nuancés, ombres portées douces,
 * sols riches (tuiles procédurales raccordables), murs en perspective vus du centre de la salle. Rien n'est une image : tout est calculé.
 * Il respecte le contrat des thèmes (voir vectoriel.js) et y ajoute :
 *   preparer(ctx, plan, t, {relief, details})      appelé par le moteur avant de dessiner une salle : calcule la vue (centre, KP) et la graine (peint/etat.js)
 *   grille(ctx, plan, t, opacite)         grille en pointillés, d'opacité réglable (0–1)
 *   sources()                             les sources de lumière relevées pendant le dessin du décor (brutes : rendu/lumiere.js `listeSources` les nettoie)
 *   creerCouche(decor, {ambiance})        la couche sombre d'un décor dessiné ; eclairer(ctx, couche, {…}) pose la lumière (peint/lumiere.js)
 *
 * Où se brancheront les lots suivants :
 *   - objets en fausse 3D (lot 2)  : peint/objets.js, avec `volumesLocaux(ctx)` (peint/volumes.js : haut, KP, prisme, cylindre, auNiveau) ; les pions à plat : peint/pions.js.
 *                                    Le moteur dessine les objets du plus loin au plus proche du centre (moteur.js : `ordonnerObjets`).
 *   - lumière et flammes (lot 3)   : peint/lumiere.js. Les sources sont relevées pendant le dessin des objets dans `etat.lumieres` (un objet les déclare avec
 *                                    `V.lumiere(x, y, h, source)`, voir peint/volumes.js et peint/etat.js) ; le moteur les lit avec `sources()`, fabrique la couche sombre
 *                                    (`creerCouche`) puis pose pénombre, halos et flammes (`eclairer`) entre le décor et les pions. `etat.flammesAnimees` (option `flammes`
 *                                    de `preparer`) éteint les flammes fixes des objets quand `eclairer` dessine les siennes.
 *   - ambiance, état, éclairage (lot 4) : champs du plan lus par `preparer` (etat.ambiance, etat.etatSalle) : teinte et usure cuites dans les tuiles de sol (peint/sols.js, clé de cache),
 *                                    murs teintés, ébréchés, mousse et lierre (peint/murs.js), petits détails semés (peint/details.js) ; peint/ambiance.js (pur) porte les tables. L'éclairage ne règle que la pénombre (rendu/lumiere.js).
 *
 * Modules : peint/bruit.js (bruits), peint/sols.js (tuiles), peint/segments.js (murs en segments), peint/murs.js (murs, ombre, portes),
 * peint/trait.js (trait à la main), peint/volumes.js (volumes en fausse 3D), peint/objets.js (les 29 objets, style sobres) et peint/objets-dessines.js (leur style riches, objet par objet), peint/pions.js (pions à plat), peint/details.js (petits détails semés), peint/ambiance.js (teintes et usure : pur), peint/etat.js (état du dessin en cours), ../perspective.js (calculs de vue).
 */
import { tracerSol } from '../trace.js';
import { vueDeSalle, IDENTITE, haut as hautVue } from '../perspective.js';
import { CASES_PAR_TUILE, calculerTuile, cleTuile, resolutionTuile, decalageDeTuile } from './peint/sols.js';
import { dessinerDetails } from './peint/details.js';
import { dessinerMurs, dessinerPorte, ombreAuPied } from './peint/murs.js';
import { graineDePlan } from '../graine.js';
import { creerToile } from '../toile.js';
import { etat } from './peint/etat.js';
import * as vectoriel from './vectoriel.js';

// Les objets et les pions sont ceux du thème peint (peint/objets.js, peint/pions.js) ; le repère de liaison reste celui du vectoriel.
export { objets } from './peint/objets.js';
export { pion } from './peint/pions.js';
export { creerCouche, eclairer } from './peint/lumiere.js';
export { marqueLiaison } from './vectoriel.js';

const FOND_ROCHE = '#141316';
const GRILLE_COULEUR = '20,14,10'; // brun très sombre
const GRILLE_CLAIR = '255,240,215'; // liseré clair à côté du trait sombre
const GRILLE_PART = 0.85; // opacité du trait à 100 % du réglage « Grille » : plein, la grille mangerait le décor

/**
 * Prépare le dessin d'une salle : le centre de la vue, KP (0 sans relief), la graine tirée de l'identifiant de la salle, la matrice de base.
 * Appelée par le moteur avant `roche` puis au début de `peindre` (la matrice change entre les deux : la marge de roche), et avant chaque image de l'animation.
 * @param {{relief?:boolean, details?:string, flammes?:boolean}} [options]  details = 'riches' (sols dessinés) ou 'sobres' ; flammes = la couche de lumière dessine les flammes : les objets n'ont plus la leur
 */
export function preparer(ctx, plan, t, { relief = true, details = 'riches', flammes = false } = {}) {
  const m = ctx.getTransform?.();
  const valide = m && Number.isFinite(m.a);
  etat.base = valide ? { a: m.a, b: m.b, c: m.c, d: m.d, e: m.e, f: m.f } : IDENTITE;
  etat.dpr = (valide ? Math.hypot(m.a, m.b) : globalThis.window?.devicePixelRatio) || 1;
  etat.vue = vueDeSalle(plan, t, relief);
  etat.relief = etat.vue.kp > 0;
  etat.graine = graineDePlan(plan);
  etat.ambiance = plan.ambiance ?? 'neutre';
  etat.etatSalle = plan.etat ?? 'neuve';
  etat.details = details;
  etat.plan = plan;
  etat.t = t;
  etat.lumieres = [];
  etat.flammesAnimees = flammes;
}

/** Les sources de lumière déclarées par les objets depuis le dernier `preparer`. */
export const sources = () => etat.lumieres.slice();

// --- Tuiles de sol --------------------------------------------------------------------------------------------

const tuiles = new Map(); // clé de cache → canvas (ou null quand le navigateur ne sait pas en fabriquer : tests sous Node)
const TUILES_MAX = 40;

/** La tuile d'un sol pour des cases de `t` px, calculée une fois puis gardée. @returns {{canvas:object, cote:number}|null} */
function tuile(nom, t) {
  const resolution = resolutionTuile(t, etat.dpr);
  const variante = { ambiance: etat.ambiance, etat: nom === 'roche' ? 'neuve' : etat.etatSalle, details: etat.details }; // la roche autour de la salle ne s'use pas
  const cle = cleTuile(nom, resolution, variante);
  if (!tuiles.has(cle)) {
    if (tuiles.size >= TUILES_MAX) tuiles.delete(tuiles.keys().next().value);
    let canvas = null;
    const { cote, data } = calculerTuile(nom, resolution, variante);
    canvas = creerToile(cote, cote);
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
  const [dx, dy] = decalageDeTuile(etat.graine), ox = -dx * periode, oy = -dy * periode;
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
  dessinerDetails(ctx, plan, t); // cailloux, mousse, feuilles, os, toiles : salle usée ou en ruine seulement
  ombreAuPied(ctx, plan, t);
}

export function murs(ctx, plan, t) { dessinerMurs(ctx, plan, t); }
export function porte(ctx, p, plan, t) { dessinerPorte(ctx, p, plan, t); }

/**
 * Grille sur le sol ; `opacite` de 0 à 1 (le réglage « Grille »). Un trait clair continu doublé d'une ombre sombre : il ne se
 * confond pas avec les joints sombres des planches ou des dalles, et se lit sur un sol sombre (bois, terre) comme clair (marbre).
 */
export function grille(ctx, plan, t, opacite = 0.6) {
  const a = Math.max(0, Math.min(1, opacite)) * GRILLE_PART;
  if (!a) return;
  ctx.save();
  tracerSol(ctx, plan, t);
  ctx.clip();
  const lignes = (d) => {
    ctx.beginPath();
    for (let x = 1; x < plan.largeur; x++) { ctx.moveTo(x * t + d, 0); ctx.lineTo(x * t + d, plan.longueur * t); }
    for (let y = 1; y < plan.longueur; y++) { ctx.moveTo(0, y * t + d); ctx.lineTo(plan.largeur * t, y * t + d); }
    ctx.stroke();
  };
  ctx.strokeStyle = `rgba(${GRILLE_COULEUR},${a * 0.8})`;
  ctx.lineWidth = 1.2;
  lignes(1.1);
  ctx.strokeStyle = `rgba(${GRILLE_CLAIR},${a * 0.75})`;
  ctx.lineWidth = 1 + a * 0.4;
  lignes(0);
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
