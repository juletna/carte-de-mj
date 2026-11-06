/**
 * Le plan complet du donjon sur un <canvas> (`dessinerPlanDonjon`) : couloirs, ponts, cadres des salles, portes fermées, noms.
 * Chaque salle est peinte par `peindre` (moteur.js) : l'import va dans un seul sens, le moteur ne connaît pas ce module.
 * Les couleurs de ce dessin sont des constantes nommées ici ; elles ne passent pas par les thèmes.
 */
import * as vectoriel from './themes/vectoriel.js';
import { cheminCouloir, PONT_DEMI_LONGUEUR, ETIQUETTE_ISOLEES } from '../plan-donjon.js';
import { retraitPorte, contourSol } from '../formes.js';
import { tracerSol } from './trace.js';
import { estHorizontal } from '../murs.js';
import { EPAISSEUR_MUR } from './geometrie.js';
import { tailleCanvasBornee } from '../affichage.js';
import { peindre } from './moteur.js';

// Couleurs du plan (valeurs littérales, nommées sans être modifiées).
const PORTE_FERMEE_CONTOUR = '#ffffff'; // le cerne blanc d'une porte pas encore ouverte
const PORTE_FERMEE = '#e5242a'; // le trait rouge de la porte
const PONT_OMBRE = 'rgba(0, 0, 0, 0.45)'; // l'ombre portée du pont sur le couloir du dessous
const PONT_PLANCHES = '#8f6c44';
const PONT_JOINTS = '#5f4630'; // les joints entre planches
const PONT_GARDE_CORPS = '#2a2724';
const COULOIR_ORPHELIN = '#e06c5a'; // liaison dont la porte a disparu : trait en pointillés
const COULOIR_CONTOUR = '#2a2724'; // le contour sombre d'un couloir
const COULOIR_SOL = '#8a8680'; // le sol de pierre des salles
const CADRE_INCONNUE = '#55525a'; // salle pas encore découverte (régie) : cadre
const VOILE_INCONNUE = 'rgba(10, 10, 14, 0.62)'; // et voile qui l'assombrit
const CADRE_COURANTE = '#7cc47c'; // salle à la table
const CADRE_SURVOL = '#f4efe4'; // salle sous le curseur
const VOILE_SURVOL = 'rgba(255, 255, 255, 0.14)';
const CADRE_ACTIF = '#d9a929'; // salle affichée
const VOILE_ACTIF_TEINTE = 'rgba(240, 198, 74, 0.55)'; // la salle active teintée (miniature)
const VOILE_ACTIF_SURVOL = 'rgba(255, 255, 255, 0.1)'; // la salle active quand elle est aussi survolée
const NOM_FOND = 'rgba(20, 19, 17, 0.85)'; // la pastille sombre sous un nom
const NOM_COULEUR = '#f4efe4';
const NOM_ACTIF = '#f0c64a'; // le nom de la salle active
const NOM_ISOLEES = '#b8b3a8'; // l'étiquette des salles isolées
const NOM_NIVEAU = '#c9b98f'; // le nom d'un niveau (donjon à plusieurs niveaux) et le trait qui le sépare du précédent
const MARGE_LIGNE = 1; // cases laissées de chaque côté de ce trait

/** Une porte pas encore ouverte : un trait rouge cerné de blanc, posé sur le mur, assez épais pour se voir en tout petit. */
function dessinerPorteFermee(ctx, p, plan, { mur, position }, t) {
  const horizontal = estHorizontal(mur);
  const d = retraitPorte(plan, mur, position);
  const long = Math.max(10, t * 1.1), epais = Math.max(6, t * 0.4);
  const le = (position + 0.5) * t;
  const cx = p.x * t + (horizontal ? le : mur === 'ouest' ? d * t - EPAISSEUR_MUR * t / 2 : (p.largeur - d + EPAISSEUR_MUR / 2) * t);
  const cy = p.y * t + (!horizontal ? le : mur === 'nord' ? d * t - EPAISSEUR_MUR * t / 2 : (p.longueur - d + EPAISSEUR_MUR / 2) * t);
  const l = horizontal ? long : epais, h = horizontal ? epais : long;
  ctx.save();
  const contour = Math.max(1, t * 0.06); // à l'extérieur du rouge : le contour ne le ronge pas
  ctx.fillStyle = PORTE_FERMEE_CONTOUR;
  ctx.fillRect(cx - l / 2 - contour, cy - h / 2 - contour, l + 2 * contour, h + 2 * contour);
  ctx.fillStyle = PORTE_FERMEE;
  ctx.fillRect(cx - l / 2, cy - h / 2, l, h);
  ctx.restore();
}

/** Un pont de planches là où deux couloirs se croisent : le couloir du dessus continue, celui du dessous passe sous lui. */
function dessinerPont(ctx, { x, y, horizontal }, t) {
  const demi = PONT_DEMI_LONGUEUR * t, large = t * 0.46, garde = t * 0.15;
  ctx.save();
  ctx.translate(x * t, y * t);
  if (!horizontal) ctx.rotate(Math.PI / 2);
  ctx.fillStyle = PONT_OMBRE; // l'ombre portée sur le couloir du dessous
  ctx.fillRect(-demi, -large - garde * 1.6, demi * 2, (large + garde * 1.6) * 2);
  ctx.fillStyle = PONT_PLANCHES;
  ctx.fillRect(-demi, -large, demi * 2, large * 2);
  if (t >= 7) { // en dessous, les planches ne se voient plus
    ctx.strokeStyle = PONT_JOINTS;
    ctx.lineWidth = Math.max(1, t * 0.03);
    const n = 6;
    for (let i = 1; i < n; i++) {
      const px = -demi + (2 * demi * i) / n;
      ctx.beginPath(); ctx.moveTo(px, -large); ctx.lineTo(px, large); ctx.stroke();
    }
  }
  ctx.fillStyle = PONT_GARDE_CORPS; // les garde-corps
  ctx.fillRect(-demi, -large - garde, demi * 2, garde);
  ctx.fillRect(-demi, large, demi * 2, garde);
  ctx.restore();
}

/**
 * Plan complet du donjon : toutes les salles à leur vraie taille, sur le fond de roche, reliées par des couloirs.
 * Chaque salle est peinte par `peindre` (comme dans la vue MJ : sol, objets, murs, portes, pions, secrets en translucide),
 * sans repères A1. Les couloirs passent dessous (ils débouchent sur les portes), les noms au-dessus des salles.
 * C'est LA façon de dessiner un plan : vue Plan du Donjon, miniature de la sidebar et de la régie (miniplan.js), encart de la table.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {object} d            donjon
 * @param {object} disposition  résultat de `disposerPlan(d)` (js/plan-donjon.js), en cases
 * @param {{taille?:number, actif?:string, survol?:string|null, grille?:boolean, theme?:object, noms?:boolean, pions?:boolean,
 *          surbrillance?:boolean, courante?:string, inconnues?:string[], portesFermees?:object[]}} options
 *        taille = côté d'une case en pixels CSS (réduit si le canvas dépasserait les limites du navigateur)
 *        actif = salle affichée (cadre et nom en couleur d'accent) ; survol = salle sous le curseur (surlignée)
 *        noms, pions = false pour une miniature ; surbrillance = la salle active est aussi teintée, pour se voir en tout petit
 *        courante = salle à la table (cadre vert) ; inconnues = salles pas encore découvertes (assombries) : régie
 *        portesFermees = portes pas encore ouvertes [{salle, mur, position}] : un trait rouge cerné de blanc sur le mur
 * @returns {{taille:number, largeur:number, hauteur:number}} côté de case réellement utilisé et taille CSS du canvas
 */
export function dessinerPlanDonjon(canvas, d, disposition, { taille = 16, actif = null, survol = null, grille = false, theme = vectoriel, noms = true, pions = true, surbrillance = false, courante = null, inconnues = [], portesFermees = [] } = {}) {
  const casesL = disposition.largeur, casesH = disposition.longueur;
  const { t, dpr } = tailleCanvasBornee(casesL, casesH, taille, window.devicePixelRatio || 1);
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
      ctx.strokeStyle = COULOIR_ORPHELIN;
      ctx.lineWidth = Math.max(2, t * 0.14);
      ctx.setLineDash([t * 0.35, t * 0.3]);
      trace();
      ctx.setLineDash([]);
    } else {
      ctx.strokeStyle = COULOIR_CONTOUR;
      ctx.lineWidth = t * 1.22;
      trace();
      ctx.strokeStyle = COULOIR_SOL; // le sol de pierre des salles
      ctx.lineWidth = t * 0.92;
      trace();
    }
  }
  ctx.restore();
  for (const pont of disposition.ponts || []) dessinerPont(ctx, pont, t);

  // Salles, chacune dans son repère (origine : coin nord-ouest de la salle).
  for (const [id, s] of Object.entries(d.salles)) {
    const p = disposition.positions[id];
    if (!p) continue;
    ctx.save();
    ctx.translate(p.x * t, p.y * t);
    peindre(ctx, pions ? s.plan : { ...s.plan, creatures: [] }, t, { grille, reperes: false, theme, marques: {} });
    ctx.restore();
  }

  // Surlignage (survol) et cadre de la salle active, par-dessus les murs.
  const cadre = (id, couleur, epais, voile) => {
    const p = disposition.positions[id];
    if (!p) return;
    const plan = d.salles[id].plan;
    ctx.save();
    ctx.translate(p.x * t, p.y * t);
    if (voile) { ctx.fillStyle = voile; tracerSol(ctx, plan, t); ctx.fill(); }
    ctx.strokeStyle = couleur;
    ctx.lineWidth = epais;
    ctx.lineCap = 'square'; // le bout carré ferme les coins entre deux segments
    ctx.beginPath();
    for (const { x1, y1, x2, y2 } of contourSol(plan, t, EPAISSEUR_MUR * t + epais / 2)) { ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); }
    ctx.stroke();
    ctx.restore();
  };
  for (const id of inconnues) cadre(id, CADRE_INCONNUE, 1, VOILE_INCONNUE);
  if (courante && courante !== actif) cadre(courante, CADRE_COURANTE, Math.max(2, t * 0.18), null);
  if (survol && survol !== actif) cadre(survol, CADRE_SURVOL, Math.max(2, t * 0.12), VOILE_SURVOL);
  for (const q of portesFermees) {
    const p = disposition.positions[q.salle], s = d.salles[q.salle];
    if (p && s) dessinerPorteFermee(ctx, p, s.plan, q, t);
  }
  if (actif) cadre(actif, CADRE_ACTIF, Math.max(surbrillance ? 2 : 3, t * 0.18), surbrillance ? VOILE_ACTIF_TEINTE : survol === actif ? VOILE_ACTIF_SURVOL : null);

  // Donjon sur plusieurs niveaux : un trait sépare chaque niveau du précédent (même sans les noms, sur la miniature).
  const separations = (disposition.etiquettes || []).filter((e) => e.niveau !== undefined && e.y >= 2); // le premier niveau n'a rien au-dessus
  if (separations.length) {
    ctx.save();
    ctx.strokeStyle = NOM_NIVEAU;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = Math.max(1, t * 0.08);
    ctx.setLineDash([Math.max(3, t * 0.4), Math.max(3, t * 0.3)]);
    for (const e of separations) {
      ctx.beginPath(); ctx.moveTo(MARGE_LIGNE * t, (e.y - 0.5) * t); ctx.lineTo((disposition.largeur - MARGE_LIGNE) * t, (e.y - 0.5) * t); ctx.stroke();
    }
    ctx.restore();
  }

  if (!noms) return { taille: t, largeur: largeurPx, hauteur: hauteurPx };

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
    ctx.fillStyle = NOM_FOND;
    ctx.fillRect(x - 3, yBas - police - 1, w + 6, police + 6);
    ctx.fillStyle = couleur;
    ctx.fillText(ligne, x, yBas);
  };
  for (const [id, s] of Object.entries(d.salles)) {
    const p = disposition.positions[id];
    if (!p) continue;
    ecrire(s.nom, p.x * t, p.y * t - EPAISSEUR_MUR * t - 4, id === actif ? NOM_ACTIF : NOM_COULEUR, Math.max(p.largeur * t, 120));
  }
  if (disposition.etiquetteIsolees) {
    const e = disposition.etiquetteIsolees;
    ecrire(ETIQUETTE_ISOLEES, e.x * t, e.y * t + police, NOM_ISOLEES, 400);
  }
  // Donjon sur plusieurs niveaux : le nom de chaque niveau au-dessus de son plan, souligné sur toute la largeur.
  for (const e of disposition.etiquettes || []) {
    if (e.niveau !== undefined) ecrire(e.texte.toUpperCase(), e.x * t, e.y * t + police, NOM_NIVEAU, Math.max((disposition.largeur - 2 * e.x) * t, 120));
    else ecrire(e.texte, e.x * t, e.y * t + police, NOM_ISOLEES, 400);
  }
  ctx.restore();

  return { taille: t, largeur: largeurPx, hauteur: hauteurPx };
}
