/**
 * Déplacement à la souris, au doigt ou au stylet (Pointer Events) de tout
 * ce qui est sur la carte : pions, objets et portes.
 *
 * L'élément attrapé suit le pointeur, puis se cale sur la grille au lâcher.
 * Il revient à sa place s'il finit hors de la pièce ou sur un élément qui
 * le gêne. Une porte glisse le long des murs et peut changer de mur.
 *
 * Un appui sans glissement réel (le pointeur bouge de moins de SEUIL_GLISSEMENT px)
 * n'est pas un déplacement : c'est un clic, signalé à `cliquer` (élément touché, ou
 * null si on a appuyé dans le vide).
 *
 * Option `deplacables` (liste de genres : 'creature', 'objet', 'porte') : seuls ces genres se
 * déplacent ; les autres restent cliquables (signalés à `cliquer`) mais ne bougent jamais.
 * Sans cette option, tout se déplace (comportement de donjon.html).
 *
 * Ce module ne modifie rien : il propose un nouveau plan à `deposer`.
 */
import { MARGE } from './rendu/moteur.js';
import { definition } from './parseur/lexique.js';

const SEUIL_GLISSEMENT = 4; // px : en dessous, c'est un clic
const REGARD = { nord: 180, sud: 0, ouest: 90, est: 270 }; // dos au mur, vers l'intérieur
const SOUS_LES_AUTRES = new Set(['fosse', 'debris']);

const largeurDe = (e) => e.taille ?? e.l;
const hauteurDe = (e) => e.taille ?? e.h;
const seChevauchent = (a, x, y, b) => x < b.x + largeurDe(b) && b.x < x + largeurDe(a)
  && y < b.y + hauteurDe(b) && b.y < y + hauteurDe(a);

/** Mur le plus proche d'un point exprimé en cases. */
function murProche(cx, cy, plan) {
  const distances = { nord: cy, sud: plan.longueur - cy, ouest: cx, est: plan.largeur - cx };
  return Object.keys(distances).reduce((a, b) => (distances[b] < distances[a] ? b : a));
}

/** Position sur un mur la plus proche d'un point, sans sortir du mur. */
function positionSurMur(mur, cx, cy, plan) {
  const horizontal = mur === 'nord' || mur === 'sud';
  const long = horizontal ? plan.largeur : plan.longueur;
  return Math.max(0, Math.min(long - 1, Math.floor(horizontal ? cx : cy)));
}

/** La porte attrapée sous le pointeur, dans l'épaisseur du mur. */
function porteSous(cx, cy, plan) {
  const W = plan.largeur, L = plan.longueur;
  const dansMur = { nord: cy >= -0.6 && cy < 0.2, sud: cy > L - 0.2 && cy <= L + 0.6, ouest: cx >= -0.6 && cx < 0.2, est: cx > W - 0.2 && cx <= W + 0.6 };
  return plan.portes.find((p) => {
    const horizontal = p.mur === 'nord' || p.mur === 'sud';
    const le = horizontal ? cx : cy;
    return dansMur[p.mur] && le >= p.position && le < p.position + 1;
  }) || null;
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{
 *   plan: () => object,                 plan affiché
 *   taille: () => number,               côté d'une case en px CSS
 *   apercu: (plan: object) => void,     redessine sans rien enregistrer
 *   deposer: (plan: object) => void     déplacement validé : le nouveau plan
 *   cliquer?: (touche: {genre: string, element: object} | null) => void
 *                                       appui sans glissement ; sans ce rappel, tout appui est un déplacement
 *   deplacables?: string[]              genres qui peuvent bouger (par défaut : tous)
 * }} options
 */
export function activerDeplacement(canvas, { plan, taille, apercu, deposer, cliquer, deplacables }) {
  const peutBouger = (genre) => !deplacables || deplacables.includes(genre);
  let prise = null; // { genre, element, depart, glisse, decalX, decalY, x, y } ou, pour une porte, { mur, position }
  let image = 0;

  function enCases(e) {
    const r = canvas.getBoundingClientRect();
    const t = taille();
    return [(e.clientX - r.left) / t - MARGE, (e.clientY - r.top) / t - MARGE];
  }

  /** Élément sous le pointeur, dans l'ordre inverse du dessin : le plus visible d'abord. */
  function elementSous(cx, cy) {
    const p = plan();
    const dessus = (e) => cx >= e.x && cx < e.x + largeurDe(e) && cy >= e.y && cy < e.y + hauteurDe(e);
    const creature = [...p.creatures].reverse().find(dessus);
    if (creature) return { genre: 'creature', element: creature };
    const porte = porteSous(cx, cy, p);
    if (porte) return { genre: 'porte', element: porte };
    const objets = [...p.objets].reverse();
    const objet = objets.find((o) => dessus(o) && !SOUS_LES_AUTRES.has(o.type)) || objets.find(dessus);
    return objet ? { genre: 'objet', element: objet } : null;
  }

  /** Copie du plan où l'élément attrapé est remplacé par sa version déplacée. */
  function planAvec(modifs) {
    const p = plan();
    const liste = { creature: 'creatures', objet: 'objets', porte: 'portes' }[prise.genre];
    return { ...p, [liste]: p[liste].map((e) => (e === prise.element ? { ...e, ...modifs } : e)) };
  }

  function redessiner() {
    if (image) return;
    image = requestAnimationFrame(() => {
      image = 0;
      if (!prise) return;
      apercu(planAvec(prise.genre === 'porte' ? { mur: prise.mur, position: prise.position } : { x: prise.x, y: prise.y }));
    });
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const [cx, cy] = enCases(e);
    const trouve = elementSous(cx, cy);
    if (!trouve) { cliquer?.(null); return; }
    const { genre, element } = trouve;
    if (!peutBouger(genre) && !cliquer) return; // ni déplaçable ni cliquable : on ignore
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    const commun = { genre, element, depart: [e.clientX, e.clientY], glisse: !cliquer, fixe: !peutBouger(genre) };
    prise = genre === 'porte'
      ? { ...commun, mur: element.mur, position: element.position }
      : { ...commun, decalX: cx - element.x, decalY: cy - element.y, x: element.x, y: element.y };
    canvas.style.cursor = 'grabbing';
  });

  canvas.addEventListener('pointermove', (e) => {
    const [cx, cy] = enCases(e);
    if (!prise) {
      const sous = elementSous(cx, cy);
      canvas.style.cursor = sous ? (peutBouger(sous.genre) ? 'grab' : 'pointer') : '';
      return;
    }
    if (prise.fixe) return; // cet élément ne bouge pas : seul le clic compte
    if (!prise.glisse) {
      if (Math.hypot(e.clientX - prise.depart[0], e.clientY - prise.depart[1]) < SEUIL_GLISSEMENT) return;
      prise.glisse = true;
    }
    if (prise.genre === 'porte') {
      prise.mur = murProche(cx, cy, plan());
      prise.position = positionSurMur(prise.mur, cx, cy, plan());
    } else {
      prise.x = cx - prise.decalX;
      prise.y = cy - prise.decalY;
    }
    redessiner();
  });

  /** Le nouveau plan si l'élément peut se poser là, sinon null. */
  function planDepose() {
    const p = plan();
    const { genre, element: el } = prise;

    if (genre === 'porte') {
      const { mur, position } = prise;
      if (mur === el.mur && position === el.position) return null;
      if (p.portes.some((d) => d !== el && d.mur === mur && d.position === position)) return null;
      return planAvec({ mur, position });
    }

    const x = Math.round(prise.x), y = Math.round(prise.y);
    if (x === el.x && y === el.y) return null;
    if (x < 0 || y < 0 || x + largeurDe(el) > p.largeur || y + hauteurDe(el) > p.longueur) return null;

    if (genre === 'creature') {
      // Un pion peut monter sur un objet (un coffre, des débris), pas sur un autre pion.
      return p.creatures.some((k) => k !== el && seChevauchent(el, x, y, k)) ? null : planAvec({ x, y });
    }
    if (definition(el.type).bloquant === false) {
      // Une torche est au mur : elle tourne le dos au mur le plus proche.
      return planAvec({ x, y, rotation: REGARD[murProche(x + 0.5, y + 0.5, p)] });
    }
    const gene = (o) => o !== el && definition(o.type).bloquant !== false && seChevauchent(el, x, y, o);
    if (p.objets.some(gene) || p.creatures.some((k) => seChevauchent(el, x, y, k))) return null;
    return planAvec({ x, y });
  }

  function lacher(e) {
    if (!prise) return;
    if (!prise.glisse && e.type === 'pointerup') {
      // Un clic : rien ne bouge, on signale l'élément touché.
      const { genre, element } = prise;
      prise = null;
      canvas.style.cursor = '';
      cliquer({ genre, element });
      return;
    }
    const nouveau = prise.glisse ? planDepose() : null;
    prise = null;
    canvas.style.cursor = '';
    if (nouveau) deposer(nouveau);
    else apercu(plan()); // retour à la position de départ
  }
  canvas.addEventListener('pointerup', lacher);
  canvas.addEventListener('pointercancel', lacher);
}
