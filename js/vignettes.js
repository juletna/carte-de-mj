/**
 * Vignettes de la palette : un petit canvas par porte, objet ou créature, dessiné avec les MÊMES fonctions que la carte
 * (thème vectoriel : sol, murs, porte, objets[type], pion). Seul écart : un pion y est dessiné sans pastille de numéro
 * (`sansNumero`, ignoré par la carte). Dessin unique, à la taille de l'écran (devicePixelRatio) : net sur Retina.
 */
import * as theme from './rendu/themes/vectoriel.js';
import { definition } from './parseur/lexique.js';

export const TAILLE_VIGNETTE = 56; // px CSS (le canvas est plus grand en pixels sur un écran dense)

/** Sol de pierre sous la vignette, assez large pour la couvrir : l'objet s'y voit comme sur la carte. */
function fond(ctx, t) {
  const n = 2 * Math.ceil(TAILLE_VIGNETTE / t / 2) + 1; // nombre impair de cases : une case au centre
  ctx.save();
  ctx.translate(TAILLE_VIGNETTE / 2 - (n * t) / 2, TAILLE_VIGNETTE / 2 - (n * t) / 2);
  theme.sol(ctx, { largeur: n, longueur: n, sol: 'pierre' }, t);
  ctx.restore();
}

/** Porte, herse ou arche, posée au milieu du mur nord d'une petite salle. */
function dessinerPorte(ctx, type) {
  const t = TAILLE_VIGNETTE / 1.8; // une ouverture d'environ la moitié de la vignette
  const plan = { largeur: 5, longueur: 2, sol: 'pierre' };
  theme.roche(ctx, TAILLE_VIGNETTE, TAILLE_VIGNETTE, t);
  ctx.save();
  ctx.translate(TAILLE_VIGNETTE / 2 - 2.5 * t, TAILLE_VIGNETTE * 0.44);
  theme.sol(ctx, plan, t);
  theme.murs(ctx, plan, t);
  theme.porte(ctx, { mur: 'nord', position: 2, type }, plan, t);
  ctx.restore();
}

/** Objet du mobilier, centré, vu de face comme sur la carte (rotation 180 : aucun pivotement). */
function dessinerObjet(ctx, type, variante) {
  const def = definition(type);
  const cote = Math.max(def.l, def.h);
  const t = (TAILLE_VIGNETTE * 0.78) / cote;
  fond(ctx, t);
  const dessin = theme.objets[type] || theme.objets.inconnu;
  ctx.save();
  ctx.translate(TAILLE_VIGNETTE / 2, TAILLE_VIGNETTE / 2);
  dessin(ctx, def.l * t, def.h * t, t, { type, l: def.l, h: def.h, x: 0, y: 0, rotation: 180, ...(variante ? { variante } : {}) });
  ctx.restore();
}

/** Pion d'une créature, réduit pour tenir dans la vignette quelle que soit sa taille (1 à 3 cases). */
function dessinerCreature(ctx, type) {
  const def = definition(type);
  const t = (TAILLE_VIGNETTE * 0.9) / def.l;
  fond(ctx, TAILLE_VIGNETTE / 2);
  const cote = def.l * t;
  const x = (TAILLE_VIGNETTE / 2 - cote / 2) / t;
  theme.pion(ctx, { type, camp: def.camp, taille: def.l, numero: 1, x, y: x, sansNumero: true }, t);
}

/**
 * Crée le canvas de la vignette d'un élément de la palette ({genre, type, variante?}) et le dessine ; `variante` : l'aspect d'un objet (torche bleue…).
 * @returns {HTMLCanvasElement}
 */
export function creerVignette(item) {
  const dpr = window.devicePixelRatio || 1;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = Math.round(TAILLE_VIGNETTE * dpr);
  canvas.style.width = canvas.style.height = `${TAILLE_VIGNETTE}px`;
  canvas.setAttribute('aria-hidden', 'true');
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.beginPath();
  ctx.roundRect(0, 0, TAILLE_VIGNETTE, TAILLE_VIGNETTE, 6);
  ctx.clip();
  try {
    if (item.genre === 'porte') dessinerPorte(ctx, item.type);
    else if (item.genre === 'objet') dessinerObjet(ctx, item.type, item.variante);
    else dessinerCreature(ctx, item.type);
  } catch (err) {
    console.error(`Vignette de ${item.type} :`, err); // une vignette ratée ne doit pas casser la palette
  }
  return canvas;
}

/** Copie d'une vignette (fantôme du glisser-déposer), à la même taille. */
export function copierVignette(source) {
  const copie = document.createElement('canvas');
  copie.width = source.width;
  copie.height = source.height;
  copie.style.width = source.style.width;
  copie.style.height = source.style.height;
  copie.getContext('2d').drawImage(source, 0, 0);
  return copie;
}
