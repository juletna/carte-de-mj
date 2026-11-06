/**
 * Moteur de rendu : dessine un plan de salle sur un <canvas> (`dessiner`) ou une fenêtre de cases pour le papier (`dessinerFenetre`).
 *
 * Le moteur s'occupe de la mise en page (taille du canvas, grille, murs,
 * portes, ordre de dessin ; les mesures partagées sont dans geometrie.js) ; l'apparence de chaque élément est déléguée
 * à un « thème » (voir themes/vectoriel.js), ce qui permettra d'ajouter
 * un thème pixel art ou des sprites sans toucher à ce fichier.
 * Le plan complet du donjon (`dessinerPlanDonjon`) est dans plan.js, qui s'appuie sur `peindre`, exporté d'ici.
 */
import * as vectoriel from './themes/vectoriel.js';
import { lettreColonne } from '../coordonnees.js';
import { tracerSol } from './trace.js';
import { MARGE, EPAISSEUR_MUR, rectPorte, rectDe } from './geometrie.js';
import { TAILLE_PAR_DEFAUT } from '../affichage.js';
import { coucheDe, COUCHE_PAR_DEFAUT } from '../catalogue.js';

// Ordre de dessin : ce qui est au sol d'abord, ce qui est accroché aux murs en dernier (la couche de chaque type est dans catalogue.js).

// Couleurs du moteur (valeurs littérales, nommées sans être modifiées).
const CASE_VISEE_REMPLISSAGE = 'rgba(255, 212, 59, 0.55)'; // la case montrée par le MJ : fond translucide
const CASE_VISEE_TRAIT = '#ffd43b'; // et son cadre épais
const CASE_VISEE_CONTOUR = 'rgba(20, 19, 17, 0.8)'; // et le fin liséré sombre qui la détache du sol
const REPERES_TEXTE = 'rgba(255, 255, 255, 0.6)'; // lettres et numéros dans la marge
const GRILLE_TRAIT = 'rgba(0, 0, 0, 0.45)'; // lignes de la grille

/**
 * @param {HTMLCanvasElement} canvas
 * @param {object} plan     plan validé (voir schema.js)
 * @param {{taille?:number, grille?:boolean|number, theme?:object, marques?:object, relief?:boolean}} options
 *        taille = côté d'une case en pixels CSS
 *        grille = lignes de la grille (le thème peut fournir les siennes : `theme.grille`). Un booléen, ou une OPACITÉ de 0 à 1
 *          (0 : pas de grille). `true` garde le trait habituel du thème ; un nombre le règle (réglage « Cases »)
 *        relief = fausse 3D des murs vus du centre de la salle, pour les thèmes qui la savent (`theme.preparer`) ; les autres l'ignorent
 *        reperes = lettres et numéros dans la marge (par défaut : suit `grille`)
 *        marques = repères d'interface dessinés par-dessus (le thème en décide l'apparence) :
 *          portesReliees: [{mur, position}]            portes reliées à une autre salle
 *          selection: {genre, element}                 élément sélectionné (porte, objet ou créature)
 *          caseVisee: {x, y}                           case montrée par le MJ à la table (« c'est là que tu veux te mettre ? »)
 *        Les éléments `cache: true` (secrets) restent visibles dans la vue MJ : dessinés en
 *        translucide avec un repère en pointillés.
 */
export function dessiner(canvas, plan, { taille = TAILLE_PAR_DEFAUT, grille = true, theme = vectoriel, marques = {}, reperes = !!grille, relief = true } = {}) {
  const t = taille;
  const largeurPx = (plan.largeur + 2 * MARGE) * t;
  const hauteurPx = (plan.longueur + 2 * MARGE) * t;

  // Canvas net sur les écrans haute densité : on dessine en pixels physiques.
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(largeurPx * dpr);
  canvas.height = Math.round(hauteurPx * dpr);
  canvas.style.width = `${largeurPx}px`;
  canvas.style.height = `${hauteurPx}px`;

  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, largeurPx, hauteurPx);

  theme.preparer?.(ctx, plan, t, { relief }); // le fond de roche du thème peint est semé selon la salle
  theme.roche(ctx, largeurPx, hauteurPx, t);

  // À partir d'ici, l'origine est le coin nord-ouest de la pièce.
  ctx.translate(MARGE * t, MARGE * t);
  peindre(ctx, plan, t, { grille, reperes, theme, marques, relief });
}

/**
 * Dessine une ou plusieurs cases d'une salle pour le papier : une « fenêtre » de cases entières, à l'échelle
 * donnée, sans marge de roche ni repères (les lettres et numéros sont posés par la page, en texte).
 * Les murs ne sont inclus que sur les côtés où la fenêtre touche le bord de la salle (`bords`).
 * Le canvas déborde de `debord` pixels de chaque côté : le trait de grille d'une limite de fenêtre n'est pas rogné.
 * N'est utilisée que par l'impression : `dessiner` (Donjon, Présentation) n'est pas modifiée.
 *
 * @param {HTMLCanvasElement|OffscreenCanvas} canvas
 * @param {object} plan
 * @param {{fenetre:{x0:number,y0:number,x1:number,y1:number}, bords:{nord:boolean,sud:boolean,est:boolean,ouest:boolean},
 *          taille:number, debord?:number, theme?:object, marques?:object, grille?:boolean}} options
 *        fenetre = cases [x0, x1[ × [y0, y1[ ; taille = pixels par case (pas de devicePixelRatio : le canvas est
 *        dimensionné pour l'impression, sa taille CSS en mm est fixée par l'appelant)
 * @returns {{largeur:number, hauteur:number, debord:number}} taille du canvas en pixels
 */
export function dessinerFenetre(canvas, plan, { fenetre, bords, taille, debord = 2, theme = vectoriel, marques = {}, grille = true }) {
  const t = taille;
  const e = EPAISSEUR_MUR;
  const gauche = fenetre.x0 - (bords.ouest ? e : 0), haut = fenetre.y0 - (bords.nord ? e : 0);
  const droite = fenetre.x1 + (bords.est ? e : 0), bas = fenetre.y1 + (bords.sud ? e : 0);
  const largeur = Math.round((droite - gauche) * t) + 2 * debord;
  const hauteur = Math.round((bas - haut) * t) + 2 * debord;
  canvas.width = largeur;
  canvas.height = hauteur;

  const ctx = canvas.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, largeur, hauteur);
  theme.roche(ctx, largeur, hauteur, t);
  ctx.translate(debord - gauche * t, debord - haut * t); // origine : coin nord-ouest de la salle
  peindre(ctx, plan, t, { grille, reperes: false, theme, marques });
  return { largeur, hauteur, debord };
}

/**
 * Sol, objets, grille, murs, portes, pions et repères d'interface ; l'origine du contexte est le coin nord-ouest de la salle.
 * `relief` n'a de sens que pour un thème qui a `preparer` (peint) : il y règle la fausse 3D.
 */
export function peindre(ctx, plan, t, { grille, reperes, theme, marques, relief = true }) {
  theme.preparer?.(ctx, plan, t, { relief });
  theme.sol(ctx, plan, t);

  // Un thème en fausse 3D (`preparer`) veut aussi le plus loin du centre d'abord, au sein d'une couche (voir ordonnerObjets).
  const objets = ordonnerObjets(plan.objets, plan, typeof theme.preparer === 'function');
  const auSol = objets.filter((o) => coucheDe(o.type) < COUCHE_PAR_DEFAUT);
  const autres = objets.filter((o) => coucheDe(o.type) >= COUCHE_PAR_DEFAUT);

  auSol.forEach((o) => dessinerObjet(ctx, o, t, theme));
  if (grille) (theme.grille || dessinerGrille)(ctx, plan, t, grille === true ? undefined : grille);
  theme.murs(ctx, plan, t);
  if (reperes) dessinerReperes(ctx, plan, t);
  plan.portes.forEach((p) => secret(ctx, p.cache, rectPorte(plan, p), t, theme, () => theme.porte(ctx, p, plan, t), 'porte'));
  autres.forEach((o) => dessinerObjet(ctx, o, t, theme));
  if (marques.caseVisee) dessinerCaseVisee(ctx, marques.caseVisee, t);
  // Les pions passent par-dessus tout le décor.
  (plan.creatures || []).forEach((k) => secret(ctx, k.cache, rectDe('creature', k), t, theme, () => theme.pion(ctx, k, t), 'creature'));

  // Repères d'interface, tout au-dessus.
  for (const p of marques.portesReliees || []) theme.marqueLiaison?.(ctx, rectPorte(plan, p), p.mur, t, p);
  if (marques.selection) theme.marqueSelection?.(ctx, rectDe(marques.selection.genre, marques.selection.element, plan), t, marques.selection.genre);
}

/**
 * L'ordre de dessin des objets : par couche (catalogue.js), puis, si `profondeur`, du plus loin au plus proche du centre de la salle. En fausse 3D,
 * le haut d'un objet penche vers l'extérieur et doit recouvrir ce qui est derrière lui, c'est-à-dire plus loin du centre. À distance égale,
 * l'ordre du plan est gardé (tri stable). Sans `profondeur` (vectoriel, papier), seul l'ordre des couches compte : leur rendu ne change pas.
 * @returns {object[]} une copie triée ; `plan.objets` n'est pas modifié
 */
export function ordonnerObjets(objets, plan, profondeur = false) {
  const cx = plan.largeur / 2, cy = plan.longueur / 2;
  const loin = (o) => Math.hypot(o.x + o.l / 2 - cx, o.y + o.h / 2 - cy);
  return [...objets].sort((a, b) => coucheDe(a.type) - coucheDe(b.type) || (profondeur ? loin(b) - loin(a) : 0));
}

/** La case que le MJ montre : très voyante, sous les pions, pour se lire de loin à la table. */
function dessinerCaseVisee(ctx, { x, y }, t) {
  const epais = Math.max(3, t * 0.09);
  ctx.save();
  ctx.fillStyle = CASE_VISEE_REMPLISSAGE;
  ctx.fillRect(x * t, y * t, t, t);
  ctx.strokeStyle = CASE_VISEE_TRAIT;
  ctx.lineWidth = epais;
  ctx.strokeRect(x * t + epais / 2, y * t + epais / 2, t - epais, t - epais);
  ctx.strokeStyle = CASE_VISEE_CONTOUR;
  ctx.lineWidth = 1;
  ctx.strokeRect(x * t, y * t, t, t);
  ctx.restore();
}

/** Dessine un élément (`genre` : 'porte', 'objet' ou 'creature') ; s'il est secret, en translucide avec le repère en pointillés du thème. */
function secret(ctx, cache, rect, t, theme, dessin, genre) {
  if (!cache) { dessin(); return; }
  ctx.save();
  ctx.globalAlpha = theme.opaciteCache ?? 0.5; // un thème peut préférer un élément secret opaque (papier : repère en pointillés)
  dessin();
  ctx.restore();
  theme.repereCache?.(ctx, rect, t, genre);
}

/** Repères de cases dans la marge : lettres en haut, numéros à gauche (« C4 »). */
function dessinerReperes(ctx, plan, t) {
  ctx.save();
  ctx.fillStyle = REPERES_TEXTE;
  ctx.font = `600 ${Math.max(9, t * 0.28)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let x = 0; x < plan.largeur; x++) ctx.fillText(lettreColonne(x), (x + 0.5) * t, -t * 0.66);
  for (let y = 0; y < plan.longueur; y++) ctx.fillText(String(y + 1), -t * 0.66, (y + 0.5) * t);
  ctx.restore();
}

/** Lignes de la grille, par-dessus le sol et sous les objets. */
function dessinerGrille(ctx, plan, t, opacite) {
  ctx.save();
  tracerSol(ctx, plan, t);
  ctx.clip();
  ctx.strokeStyle = opacite === undefined ? GRILLE_TRAIT : `rgba(0, 0, 0, ${opacite})`;
  ctx.lineWidth = Math.max(1, t / 40);
  ctx.beginPath();
  for (let x = 0; x <= plan.largeur; x++) { ctx.moveTo(x * t, 0); ctx.lineTo(x * t, plan.longueur * t); }
  for (let y = 0; y <= plan.longueur; y++) { ctx.moveTo(0, y * t); ctx.lineTo(plan.largeur * t, y * t); }
  ctx.stroke();
  ctx.restore();
}

/**
 * Place le contexte au centre de l'objet, orienté pour que son « avant »
 * pointe vers le bas du repère local, puis appelle le dessin du thème.
 * Ainsi chaque fonction de dessin n'a qu'une seule orientation à gérer.
 */
function dessinerObjet(ctx, o, t, theme) {
  secret(ctx, o.cache, { x: o.x, y: o.y, l: o.l, h: o.h }, t, theme, () => dessinerObjetOpaque(ctx, o, t, theme), 'objet');
}

function dessinerObjetOpaque(ctx, o, t, theme) {
  const dessin = theme.objets[o.type] || theme.objets.inconnu;
  const quart = o.rotation === 90 || o.rotation === 270;
  const w = (quart ? o.h : o.l) * t; // dimensions dans le repère local
  const h = (quart ? o.l : o.h) * t;
  ctx.save();
  ctx.translate((o.x + o.l / 2) * t, (o.y + o.h / 2) * t);
  ctx.rotate(((o.rotation - 180) * Math.PI) / 180);
  dessin(ctx, w, h, t, o);
  ctx.restore();
}
