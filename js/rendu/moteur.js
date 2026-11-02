/**
 * Moteur de rendu : dessine un plan de salle sur un <canvas>.
 *
 * Le moteur s'occupe de la géométrie (taille du canvas, grille, murs,
 * portes, ordre de dessin) ; l'apparence de chaque élément est déléguée
 * à un « thème » (voir themes/vectoriel.js), ce qui permettra d'ajouter
 * un thème pixel art ou des sprites sans toucher à ce fichier.
 */
import * as vectoriel from './themes/vectoriel.js';
import { lettreColonne } from '../parseur/coordonnees.js';
import { cheminCouloir, ETIQUETTE_ISOLEES } from '../plan-donjon.js';

export const MARGE = 1; // cases de roche autour de la pièce

// Ordre de dessin : ce qui est au sol d'abord, ce qui est accroché aux murs en dernier.
const COUCHE = { fosse: 0, debris: 1, torche: 9 };

// Épaisseur des murs en cases (celle du thème vectoriel) : sert à situer une porte pour les repères.
export const EPAISSEUR_MUR = 0.32;

/** Rectangle d'une porte dans le mur, en cases (origine : coin nord-ouest de la pièce). */
export function rectPorte(plan, p) {
  const e = EPAISSEUR_MUR;
  return {
    nord: { x: p.position, y: -e, l: 1, h: e },
    sud: { x: p.position, y: plan.longueur, l: 1, h: e },
    ouest: { x: -e, y: p.position, l: e, h: 1 },
    est: { x: plan.largeur, y: p.position, l: e, h: 1 },
  }[p.mur];
}

/** Rectangle occupé par un élément, en cases. */
function rectDe(genre, e, plan) {
  if (genre === 'porte') return rectPorte(plan, e);
  if (genre === 'creature') return { x: e.x, y: e.y, l: e.taille, h: e.taille };
  return { x: e.x, y: e.y, l: e.l, h: e.h };
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {object} plan     plan validé (voir schema.js)
 * @param {{taille?:number, grille?:boolean, theme?:object, marques?:object}} options
 *        taille = côté d'une case en pixels CSS
 *        grille = lignes de la grille (le thème peut fournir les siennes : `theme.grille`)
 *        reperes = lettres et numéros dans la marge (par défaut : suit `grille`)
 *        marques = repères d'interface dessinés par-dessus (le thème en décide l'apparence) :
 *          portesReliees: [{mur, position}]            portes reliées à une autre salle
 *          selection: {genre, element}                 élément sélectionné (porte, objet ou créature)
 *        Les éléments `cache: true` (secrets) restent visibles dans la vue MJ : dessinés en
 *        translucide avec un repère en pointillés.
 */
export function dessiner(canvas, plan, { taille = 48, grille = true, theme = vectoriel, marques = {}, reperes = grille } = {}) {
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

  theme.roche(ctx, largeurPx, hauteurPx, t);

  // À partir d'ici, l'origine est le coin nord-ouest de la pièce.
  ctx.translate(MARGE * t, MARGE * t);
  peindre(ctx, plan, t, { grille, reperes, theme, marques });
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

// Limites d'un canvas (navigateurs et iOS) : côté et surface en pixels PHYSIQUES. Au-delà, le dessin disparaîtrait.
const CANVAS_COTE_MAX = 8192;
const CANVAS_SURFACE_MAX = 16_000_000;

/**
 * Plan complet du donjon : toutes les salles à leur vraie taille, sur le fond de roche, reliées par des couloirs.
 * Chaque salle est peinte par `peindre` (comme dans la vue MJ : sol, objets, murs, portes, pions, secrets en translucide),
 * sans repères A1. Les couloirs passent dessous (ils débouchent sur les portes), les noms au-dessus des salles.
 * N'est utilisée que par la vue Plan du Donjon : `dessiner` n'est pas modifiée.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {object} d            donjon
 * @param {object} disposition  résultat de `disposerPlan(d)` (js/plan-donjon.js), en cases
 * @param {{taille?:number, actif?:string, survol?:string|null, grille?:boolean, theme?:object}} options
 *        taille = côté d'une case en pixels CSS (réduit si le canvas dépasserait les limites du navigateur)
 *        actif = salle affichée (cadre et nom en couleur d'accent) ; survol = salle sous le curseur (surlignée)
 * @returns {{taille:number, largeur:number, hauteur:number}} côté de case réellement utilisé et taille CSS du canvas
 */
export function dessinerPlanDonjon(canvas, d, disposition, { taille = 16, actif = null, survol = null, grille = false, theme = vectoriel } = {}) {
  const casesL = disposition.largeur, casesH = disposition.longueur;
  let dpr = window.devicePixelRatio || 1;
  let t = Math.max(1, taille);
  const trop = () => casesL * t * dpr > CANVAS_COTE_MAX || casesH * t * dpr > CANVAS_COTE_MAX || casesL * t * casesH * t * dpr * dpr > CANVAS_SURFACE_MAX;
  // D'abord moins de pixels physiques (netteté), puis, si ça ne suffit pas, une case plus petite.
  while (trop() && dpr > 1) dpr = Math.max(1, dpr - 0.5);
  if (trop()) {
    t = Math.min(CANVAS_COTE_MAX / (Math.max(casesL, casesH) * dpr), Math.sqrt(CANVAS_SURFACE_MAX / (casesL * casesH)) / dpr);
    t = Math.max(1, Math.floor(t * 100) / 100);
  }
  const largeurPx = Math.round(casesL * t), hauteurPx = Math.round(casesH * t);

  canvas.width = Math.round(largeurPx * dpr);
  canvas.height = Math.round(hauteurPx * dpr);
  canvas.style.width = `${largeurPx}px`;
  canvas.style.height = `${hauteurPx}px`;

  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, largeurPx, hauteurPx);
  theme.roche(ctx, largeurPx, hauteurPx, t);

  // Couloirs : contour sombre puis sol, à angle droit. Une liaison orpheline (porte disparue) est un trait en pointillés.
  ctx.save();
  ctx.lineJoin = 'miter';
  ctx.lineCap = 'butt';
  for (const c of disposition.couloirs) {
    const chemin = cheminCouloir(c);
    const trace = () => { ctx.beginPath(); chemin.forEach((p, i) => (i ? ctx.lineTo(p.x * t, p.y * t) : ctx.moveTo(p.x * t, p.y * t))); ctx.stroke(); };
    if (c.orpheline) {
      ctx.strokeStyle = '#e06c5a';
      ctx.lineWidth = Math.max(2, t * 0.14);
      ctx.setLineDash([t * 0.35, t * 0.3]);
      trace();
      ctx.setLineDash([]);
    } else {
      ctx.strokeStyle = '#2a2724';
      ctx.lineWidth = t * 1.22;
      trace();
      ctx.strokeStyle = '#8a8680'; // le sol de pierre des salles
      ctx.lineWidth = t * 0.92;
      trace();
    }
  }
  ctx.restore();

  // Salles, chacune dans son repère (origine : coin nord-ouest de la salle).
  for (const [id, s] of Object.entries(d.salles)) {
    const p = disposition.positions[id];
    if (!p) continue;
    ctx.save();
    ctx.translate(p.x * t, p.y * t);
    peindre(ctx, s.plan, t, { grille, reperes: false, theme, marques: {} });
    ctx.restore();
  }

  // Surlignage (survol) et cadre de la salle active, par-dessus les murs.
  const cadre = (id, couleur, epais, voile) => {
    const p = disposition.positions[id];
    if (!p) return;
    const e = EPAISSEUR_MUR * t, x = p.x * t - e, y = p.y * t - e, l = p.largeur * t + 2 * e, h = p.longueur * t + 2 * e;
    ctx.save();
    if (voile) { ctx.fillStyle = voile; ctx.fillRect(p.x * t, p.y * t, p.largeur * t, p.longueur * t); }
    ctx.strokeStyle = couleur;
    ctx.lineWidth = epais;
    ctx.strokeRect(x - epais / 2, y - epais / 2, l + epais, h + epais);
    ctx.restore();
  };
  if (survol && survol !== actif) cadre(survol, '#f4efe4', Math.max(2, t * 0.12), 'rgba(255, 255, 255, 0.14)');
  if (actif) cadre(actif, '#d9a929', Math.max(3, t * 0.18), survol === actif ? 'rgba(255, 255, 255, 0.1)' : null);

  // Noms : au-dessus de chaque salle, sur une pastille sombre pour rester lisibles sur la roche comme sur un couloir.
  const police = Math.max(12, Math.min(t * 0.7, 22));
  ctx.save();
  ctx.font = `600 ${police}px system-ui, sans-serif`;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  const ecrire = (texte, x, yBas, couleur, largeurMax) => {
    let ligne = texte;
    while (ligne.length > 1 && ctx.measureText(ligne).width > largeurMax) ligne = `${ligne.slice(0, -2).trimEnd()}…`;
    const w = ctx.measureText(ligne).width;
    ctx.fillStyle = 'rgba(20, 19, 17, 0.85)';
    ctx.fillRect(x - 3, yBas - police - 1, w + 6, police + 6);
    ctx.fillStyle = couleur;
    ctx.fillText(ligne, x, yBas);
  };
  for (const [id, s] of Object.entries(d.salles)) {
    const p = disposition.positions[id];
    if (!p) continue;
    ecrire(s.nom, p.x * t, p.y * t - EPAISSEUR_MUR * t - 4, id === actif ? '#f0c64a' : '#f4efe4', Math.max(p.largeur * t, 120));
  }
  if (disposition.etiquetteIsolees) {
    const e = disposition.etiquetteIsolees;
    ecrire(ETIQUETTE_ISOLEES, e.x * t, e.y * t + police, '#b8b3a8', 400);
  }
  ctx.restore();

  return { taille: t, largeur: largeurPx, hauteur: hauteurPx };
}

/** Sol, objets, grille, murs, portes, pions et repères d'interface ; l'origine du contexte est le coin nord-ouest de la salle. */
function peindre(ctx, plan, t, { grille, reperes, theme, marques }) {
  theme.sol(ctx, plan, t);

  const objets = [...plan.objets].sort((a, b) => (COUCHE[a.type] ?? 5) - (COUCHE[b.type] ?? 5));
  const auSol = objets.filter((o) => (COUCHE[o.type] ?? 5) < 5);
  const autres = objets.filter((o) => (COUCHE[o.type] ?? 5) >= 5);

  auSol.forEach((o) => dessinerObjet(ctx, o, t, theme));
  if (grille) (theme.grille || dessinerGrille)(ctx, plan, t);
  theme.murs(ctx, plan, t);
  if (reperes) dessinerReperes(ctx, plan, t);
  plan.portes.forEach((p) => secret(ctx, p.cache, rectPorte(plan, p), t, theme, () => theme.porte(ctx, p, plan, t)));
  autres.forEach((o) => dessinerObjet(ctx, o, t, theme));
  // Les pions passent par-dessus tout le décor.
  (plan.creatures || []).forEach((k) => secret(ctx, k.cache, rectDe('creature', k), t, theme, () => theme.pion(ctx, k, t)));

  // Repères d'interface, tout au-dessus.
  for (const p of marques.portesReliees || []) theme.marqueLiaison?.(ctx, rectPorte(plan, p), p.mur, t, p);
  if (marques.selection) theme.marqueSelection?.(ctx, rectDe(marques.selection.genre, marques.selection.element, plan), t);
}

/** Dessine un élément ; s'il est secret, en translucide avec le repère en pointillés du thème. */
function secret(ctx, cache, rect, t, theme, dessin) {
  if (!cache) { dessin(); return; }
  ctx.save();
  ctx.globalAlpha = theme.opaciteCache ?? 0.5; // un thème peut préférer un élément secret opaque (papier : repère en pointillés)
  dessin();
  ctx.restore();
  theme.repereCache?.(ctx, rect, t);
}

/** Repères de cases dans la marge : lettres en haut, numéros à gauche (« C4 »). */
function dessinerReperes(ctx, plan, t) {
  ctx.save();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.font = `600 ${Math.max(9, t * 0.28)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let x = 0; x < plan.largeur; x++) ctx.fillText(lettreColonne(x), (x + 0.5) * t, -t * 0.66);
  for (let y = 0; y < plan.longueur; y++) ctx.fillText(String(y + 1), -t * 0.66, (y + 0.5) * t);
  ctx.restore();
}

/** Lignes de la grille, par-dessus le sol et sous les objets. */
function dessinerGrille(ctx, plan, t) {
  ctx.save();
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
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
  secret(ctx, o.cache, { x: o.x, y: o.y, l: o.l, h: o.h }, t, theme, () => dessinerObjetOpaque(ctx, o, t, theme));
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
