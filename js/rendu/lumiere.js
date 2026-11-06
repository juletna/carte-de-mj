/**
 * La lumière de la carte : calculs PURS (aucun DOM, aucun canvas), testables sous Node. Le dessin est dans themes/peint/lumiere.js.
 *
 * La pénombre est un voile posé sur le décor, percé autour de chaque source de lumière. Son opacité vient de trois choses :
 *   - le réglage « Pénombre » (0–100 %, 45 par défaut) ;
 *   - l'éclairage de la salle (`plan.eclairage`, lot « ambiance » : eclairee / penombre / obscurite), un multiplicateur ;
 *   - la vue : le MJ (Donjon, régie) voit presque tout (VUE_MJ), la table a la pénombre pleine.
 * La teinte du voile vient de l'ambiance de la salle (`plan.ambiance` : neutre / froide / chaude / nuit).
 */
import { PENOMBRE_PAR_DEFAUT } from '../affichage.js';

/** Part de la pénombre que garde la vue MJ (Donjon et régie) : le MJ doit voir toute la salle. */
export const VUE_MJ = 0.35;
/** Multiplicateur de la pénombre selon l'éclairage de la salle ; une valeur absente ou inconnue vaut `penombre` (×1). */
export const ECLAIRAGE_MULT = { eclairee: 0.4, penombre: 1, obscurite: 1.6 };
/** Le voile n'est jamais plus opaque : même dans le noir, on devine le décor. */
export const OPACITE_MAX = 0.95;
/** Surface (px physiques) au-delà de laquelle on n'anime pas : la couche fixe, la couche sombre et le voile coûteraient trois canevas de cette taille. */
export const SURFACE_ANIMEE_MAX = 12_000_000;
/** Cadence maximale de l'animation (images par seconde) : la flamme n'a pas besoin de plus et la table garde de la marge. */
export const IMAGES_PAR_SECONDE = 30;

/** Teinte multipliée sur le décor pour fabriquer la couche sombre, par ambiance [r, g, b]. L'ambiance neutre est un gris à peine bleuté. */
export const COULEURS_AMBIANCE = {
  neutre: [76, 74, 84],
  froide: [52, 69, 106],
  chaude: [106, 74, 62],
  nuit: [35, 44, 74],
};

/** Multiplicateur de pénombre d'un éclairage (`plan.eclairage`) ; inconnu ou absent : 1. */
export const multiplicateurEclairage = (eclairage) => (Object.hasOwn(ECLAIRAGE_MULT, eclairage) ? ECLAIRAGE_MULT[eclairage] : 1);

/** Ce que la vue garde de la pénombre : tout à la table, VUE_MJ pour le MJ (toute autre vue que « table » est une vue MJ). */
export const facteurVue = (vue) => (vue === 'table' ? 1 : VUE_MJ);

/**
 * L'opacité (0–0,95) du voile de pénombre.
 * @param {{penombre?:number, eclairage?:string, vue?:string}} p  penombre = le réglage, en % ; vue = 'table' ou 'mj'
 */
export function opaciteVoile({ penombre = PENOMBRE_PAR_DEFAUT, eclairage, vue = 'mj' } = {}) {
  const base = Number.isFinite(penombre) ? Math.max(0, Math.min(100, penombre)) / 100 : PENOMBRE_PAR_DEFAUT / 100;
  return Math.min(OPACITE_MAX, base * multiplicateurEclairage(eclairage) * facteurVue(vue));
}

/** La couleur [r, g, b] de l'ambiance (neutre si elle est absente ou inconnue). */
export const couleurAmbiance = (ambiance) => COULEURS_AMBIANCE[Object.hasOwn(COULEURS_AMBIANCE, ambiance) ? ambiance : 'neutre'];

/** Force des halos colorés : presque pleine dès que la salle est un peu sombre, discrète quand elle est entièrement éclairée. */
export const intensiteHalo = (opacite) => Math.min(1, 0.3 + opacite * 1.6);

/** Vacillement d'une flamme : un nombre autour de 0,5, de somme de sinus (t en secondes, `s` décale la phase d'une source à l'autre). */
export const vacille = (t, s) => 0.5 + 0.22 * Math.sin(t * 7.1 + s) + 0.15 * Math.sin(t * 12.7 + s * 2.3) + 0.13 * Math.sin(t * 23.3 + s * 4.1);

const COULEUR_PAR_DEFAUT = '255,190,110';
const RGB = /^\d{1,3},\d{1,3},\d{1,3}$/;
const HEX = /^#[0-9a-fA-F]{6}$/;
/** Les couleurs de la flamme animée quand la source n'en précise pas : l'orange d'origine. */
export const FLAMME_PAR_DEFAUT = { flamme: '#f2862a', coeur: '#ffe07a' };

/**
 * La liste des sources à éclairer, à partir de ce que les objets ont déclaré (`etat.lumieres`) : ignore les sources invalides (position,
 * rayon ou intensité absents), borne l'intensité (0–1), remplace une couleur illisible, ajoute `graine` (la phase du vacillement) et trie
 * (y puis x) pour que le rendu ne dépende pas de l'ordre de dessin. Deux sources identiques au pixel près n'en font qu'une.
 * @param {object[]} brutes  { x, y, r, c?, k?, s?, petite?, f?, m? } ; f = { flamme, coeur } (deux couleurs '#rrggbb' de la flamme animée ; orange par défaut), m = feu magique (pulse plus lentement) en pixels, dans le repère de la salle
 * @param {{largeur:number, hauteur:number, marge?:number}} [bornes]  la salle en pixels ; une source plus loin que `marge` de ses bords est écartée
 * @returns {{x:number, y:number, r:number, c:string, k:number, s:number, petite:boolean, f:{flamme:string, coeur:string}, m:boolean, graine:number}[]}
 */
export function listeSources(brutes, bornes) {
  const vues = new Set(), liste = [];
  for (const b of brutes || []) {
    if (!b || !Number.isFinite(b.x) || !Number.isFinite(b.y) || !(b.r > 0)) continue;
    if (bornes) {
      const marge = bornes.marge ?? 0;
      if (b.x < -marge || b.y < -marge || b.x > bornes.largeur + marge || b.y > bornes.hauteur + marge) continue;
    }
    const cle = `${Math.round(b.x)}|${Math.round(b.y)}|${Math.round(b.r)}`;
    if (vues.has(cle)) continue;
    vues.add(cle);
    liste.push({
      x: b.x, y: b.y, r: b.r, c: typeof b.c === 'string' && RGB.test(b.c) ? b.c : COULEUR_PAR_DEFAUT,
      k: Number.isFinite(b.k) ? Math.max(0, Math.min(1, b.k)) : 0.5, s: b.s > 0 ? b.s : 0, petite: b.petite === true,
      f: HEX.test(b.f?.flamme) && HEX.test(b.f?.coeur) ? { flamme: b.f.flamme, coeur: b.f.coeur } : FLAMME_PAR_DEFAUT, m: b.m === true,
      graine: b.x * 0.13 + b.y * 0.07,
    });
  }
  return liste.sort((a, b) => a.y - b.y || a.x - b.x);
}

/** La surface du canevas permet-elle l'animation ? */
export const animationPossible = (largeurPx, hauteurPx) => largeurPx > 0 && hauteurPx > 0 && largeurPx * hauteurPx <= SURFACE_ANIMEE_MAX;

/**
 * Les flammes bougent-elles ? Seulement à la table, si le réglage « Flammes animées » est coché et si l'utilisateur n'a pas demandé moins de mouvement.
 * @param {{vue?:string, flammes?:boolean, mouvementReduit?:boolean}} p
 */
export const animationActive = ({ vue, flammes = true, mouvementReduit = false } = {}) => vue === 'table' && flammes !== false && !mouvementReduit;
