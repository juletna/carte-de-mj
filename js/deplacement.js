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
 * Option `portesLarges` (Présentation et Donjon) : la zone de clic d'une porte s'élargit de BANDE_PORTE case
 * vers l'intérieur de la salle (le mur seul fait environ 8 px). Règle unique dans cette bande : un CLIC y est toujours
 * pour la porte, même si un pion s'y trouve ; un GLISSEMENT commencé sur un pion déplace ce pion (la porte ne bouge
 * jamais par ce biais). Sans l'option, rien ne change.
 *
 * Ce module ne modifie rien : il propose un nouveau plan à `deposer`.
 */
import { MARGE } from './rendu/moteur.js';
import { largeurDe, hauteurDe, murProche, positionSurMur, evaluerPose } from './pose.js';
import { retraitPorte } from './formes.js';
import { estHorizontal } from './murs.js';

const SEUIL_GLISSEMENT = 4; // px : en dessous, c'est un clic
export const BANDE_PORTE = 0.5; // cases : profondeur ajoutée à la zone de clic d'une porte (option `portesLarges`)
const EPAISSEUR_CLIC = 0.2;     // cases : profondeur de la zone de clic d'une porte sans l'option
const SOUS_LES_AUTRES = new Set(['fosse', 'debris']);

/** La porte attrapée sous le pointeur, dans l'épaisseur du mur (et jusqu'à `profondeur` cases vers l'intérieur). */
export function porteSous(cx, cy, plan, profondeur = EPAISSEUR_CLIC) {
  const W = plan.largeur, L = plan.longueur, d = profondeur;
  return plan.portes.find((p) => {
    const horizontal = estHorizontal(p.mur);
    const le = horizontal ? cx : cy;
    const r = retraitPorte(plan, p.mur, p.position); // au fond d'une entaille, le mur est plus loin que le bord
    const dansMur = { nord: cy >= r - 0.6 && cy < r + d, sud: cy > L - r - d && cy <= L - r + 0.6, ouest: cx >= r - 0.6 && cx < r + d, est: cx > W - r - d && cx <= W - r + 0.6 }[p.mur];
    return dansMur && le >= p.position && le < p.position + 1;
  }) || null;
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{
 *   plan: () => object,                 plan affiché
 *   taille: () => number,               côté d'une case en px CSS
 *   apercu: (plan: object) => void,     redessine sans rien enregistrer
 *   deposer: (plan: object) => void     déplacement validé : le nouveau plan
 *   cliquer?: (touche: {genre: string, element: object} | null, caseVide?: [number, number]) => void
 *                                       appui sans glissement ; sans ce rappel, tout appui est un déplacement.
 *                                       Rien sous le pointeur : `touche` est null et `caseVide` donne la case visée
 *   filtre?: (e: PointerEvent) => boolean  seuls ces pointeurs agissent (à la table : la souris du MJ, pas le doigt d'un joueur)
 *   commencer?: (genre: string) => void un vrai glissement démarre (le pointeur a dépassé le seuil)
 *   deplacables?: string[]              genres qui peuvent bouger (par défaut : tous)
 * }} options
 */
export function activerDeplacement(canvas, { plan, taille, apercu, deposer, cliquer, commencer, deplacables, portesLarges = false, filtre = () => true }) {
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
    if (e.button !== 0 || !filtre(e)) return;
    const [cx, cy] = enCases(e);
    let trouve = elementSous(cx, cy);
    // Bande de la porte : un clic y est pour la porte ; un pion attrapé là reste déplaçable (voir l'en-tête).
    let auClic = null;
    const large = portesLarges ? porteSous(cx, cy, plan(), BANDE_PORTE) : null;
    if (large && trouve?.element !== large) {
      if (trouve?.genre === 'creature' && peutBouger('creature')) auClic = { genre: 'porte', element: large };
      else trouve = { genre: 'porte', element: large };
    }
    if (!trouve) { cliquer?.(null, [Math.floor(cx), Math.floor(cy)]); return; }
    const { genre, element } = trouve;
    if (!peutBouger(genre) && !cliquer) return; // ni déplaçable ni cliquable : on ignore
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    const commun = { genre, element, auClic, depart: [e.clientX, e.clientY], glisse: !cliquer, fixe: !peutBouger(genre) };
    prise = genre === 'porte'
      ? { ...commun, mur: element.mur, position: element.position }
      : { ...commun, decalX: cx - element.x, decalY: cy - element.y, x: element.x, y: element.y };
    canvas.style.cursor = 'grabbing';
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!prise && !filtre(e)) return;
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
      commencer?.(prise.genre);
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

    // Règles de pose communes avec l'ajout depuis la palette : voir js/pose.js.
    const pose = evaluerPose(p, genre, el, x, y, el);
    return pose.ok ? planAvec(pose.modifs) : null;
  }

  function lacher(e) {
    if (!prise) return;
    if (!prise.glisse && e.type === 'pointerup') {
      // Un clic : rien ne bouge, on signale l'élément touché.
      const { genre, element, auClic } = prise;
      prise = null;
      canvas.style.cursor = '';
      cliquer(auClic || { genre, element });
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
