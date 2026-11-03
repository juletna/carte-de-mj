/**
 * Formes de salle : un rectangle auquel on retire des cases. Module PUR pour le calcul (testable sous Node).
 *
 * Le plan garde sa largeur et sa longueur (le rectangle qui englobe la forme) ; s'y ajoutent, hors rectangle :
 *   forme     croix, L, T, U ou octogone
 *   bras      épaisseur des bras en cases (pour l'octogone : taille des pans coupés). Absent : selon la taille de la salle
 *   position  croix : haut, milieu, bas (où passent les bras) ; T : mur de la barre ; U : mur ouvert ; L : coin de l'angle
 * Les cases retirées se recalculent toujours : on ne les stocke jamais, et agrandir une salle agrandit sa forme.
 *
 * Une porte garde son écriture (mur + position) : elle se pose sur le premier mur rencontré en venant de ce côté.
 * « Mur nord en A » tombe donc au fond de l'entaille si le coin est retiré.
 */

export const FORMES = ['rectangle', 'croix', 'L', 'T', 'U', 'octogone'];
export const LIBELLES_FORMES = { rectangle: 'Rectangle', croix: 'Croix', L: 'L', T: 'T', U: 'U', octogone: 'Octogone' };
const MURS = ['nord', 'sud', 'est', 'ouest'];
/** Choix de `position` par forme ; le premier est la valeur par défaut. */
export const POSITIONS_FORMES = {
  croix: ['milieu', 'haut', 'bas'],
  T: MURS,
  U: MURS,
  L: ['sud-ouest', 'sud-est', 'nord-ouest', 'nord-est'],
};

/** Champs de forme d'un plan, validés : rien d'autre que `{forme:'rectangle'}` pour un rectangle. */
export function normaliserForme(brut) {
  const forme = FORMES.includes(brut?.forme) ? brut.forme : 'rectangle';
  if (forme === 'rectangle') return { forme };
  const champs = { forme };
  if (Number.isInteger(brut.bras) && brut.bras >= 1) champs.bras = brut.bras;
  if (POSITIONS_FORMES[forme]?.includes(brut.position)) champs.position = brut.position;
  return champs;
}

const positionDe = (plan) => (POSITIONS_FORMES[plan.forme]?.includes(plan.position) ? plan.position : POSITIONS_FORMES[plan.forme]?.[0]);

/** Épaisseur la plus grande qui laisse encore une forme (0 : la salle est trop petite pour cette forme). */
export function brasMax(plan) {
  const W = plan.largeur, L = plan.longueur, position = positionDe(plan);
  const debout = position === 'nord' || position === 'sud';
  switch (plan.forme) {
    case 'croix': return Math.max(0, Math.min(W, L) - 2);
    case 'L': return Math.max(0, Math.min(W, L) - 1);
    case 'T': return Math.max(0, debout ? Math.min(L - 1, W - 2) : Math.min(W - 1, L - 2));
    case 'U': return Math.max(0, debout ? Math.min(L - 1, Math.floor((W - 1) / 2)) : Math.min(W - 1, Math.floor((L - 1) / 2)));
    case 'octogone': return Math.floor((Math.min(W, L) - 1) / 2);
    default: return 0;
  }
}

/** L'épaisseur réellement utilisée : celle du plan, bornée, sinon proportionnelle à la salle. */
export function brasDe(plan) {
  const max = brasMax(plan);
  if (!max) return 0;
  const defaut = Math.max(1, Math.round(Math.min(plan.largeur, plan.longueur) / (plan.forme === 'octogone' ? 4 : 3)));
  return Math.min(max, plan.bras || defaut);
}

/** La case (x, y) du rectangle fait-elle partie de la forme ? */
function dansLaForme(plan, a, position, x, y) {
  const W = plan.largeur, L = plan.longueur;
  const centreX = x >= Math.floor((W - a) / 2) && x < Math.floor((W - a) / 2) + a;
  const centreY = y >= Math.floor((L - a) / 2) && y < Math.floor((L - a) / 2) + a;
  const nord = y < a, sud = y >= L - a, ouest = x < a, est = x >= W - a;
  switch (plan.forme) {
    case 'croix': {
      const reste = L - a, haut = { haut: Math.floor(reste / 3), bas: reste - Math.floor(reste / 3) }[position] ?? Math.floor(reste / 2);
      return centreX || (y >= haut && y < haut + a);
    }
    case 'T': return { nord: nord || centreX, sud: sud || centreX, ouest: ouest || centreY, est: est || centreY }[position];
    case 'U': return { nord: ouest || est || sud, sud: ouest || est || nord, ouest: nord || sud || est, est: nord || sud || ouest }[position];
    case 'L': {
      const [ns, eo] = position.split('-');
      return (ns === 'nord' ? nord : sud) || (eo === 'ouest' ? ouest : est);
    }
    case 'octogone': return Math.min(x, W - 1 - x) + Math.min(y, L - 1 - y) >= a;
    default: return true;
  }
}

const memoire = new Map();
const AUCUNE = new Set();

/** Cases retirées du rectangle, sous la forme « x,y ». Ensemble vide pour un rectangle ou une salle trop petite. */
export function casesRetirees(plan) {
  if (!plan?.forme || plan.forme === 'rectangle') return AUCUNE;
  const a = brasDe(plan);
  if (!a) return AUCUNE;
  const position = positionDe(plan);
  const cle = `${plan.largeur},${plan.longueur},${plan.forme},${a},${position}`;
  if (memoire.has(cle)) return memoire.get(cle);
  const vides = new Set();
  for (let y = 0; y < plan.longueur; y++) for (let x = 0; x < plan.largeur; x++) if (!dansLaForme(plan, a, position, x, y)) vides.add(`${x},${y}`);
  if (memoire.size > 200) memoire.clear();
  memoire.set(cle, vides);
  return vides;
}

/** La case (x, y) est-elle du sol de la salle ? */
export const estSol = (plan, x, y) => x >= 0 && y >= 0 && x < plan.largeur && y < plan.longueur && !casesRetirees(plan).has(`${x},${y}`);

/** Un rectangle de cases est-il entièrement sur le sol ? */
export function surLeSol(plan, x, y, l = 1, h = 1) {
  for (let i = x; i < x + l; i++) for (let j = y; j < y + h; j++) if (!estSol(plan, i, j)) return false;
  return true;
}

/** Nombre de cases de sol de la salle. */
export const nombreCases = (plan) => plan.largeur * plan.longueur - casesRetirees(plan).size;

/** De combien de cases une porte s'enfonce depuis le bord du rectangle, pour atteindre le premier mur. */
export function retraitPorte(plan, mur, position) {
  const horizontal = mur === 'nord' || mur === 'sud';
  const profondeur = horizontal ? plan.longueur : plan.largeur;
  if (!casesRetirees(plan).size) return 0;
  for (let d = 0; d < profondeur; d++) {
    const x = horizontal ? position : (mur === 'ouest' ? d : plan.largeur - 1 - d);
    const y = horizontal ? (mur === 'nord' ? d : plan.longueur - 1 - d) : position;
    if (estSol(plan, x, y)) return d;
  }
  return 0;
}

/** Trace (sans le remplir) le sol de la salle dans le chemin courant du contexte, pour peindre ou découper. */
export function tracerSol(ctx, plan, t) {
  ctx.beginPath();
  for (let y = 0; y < plan.longueur; y++) for (let x = 0; x < plan.largeur; x++) if (estSol(plan, x, y)) ctx.rect(x * t, y * t, t, t);
}

/**
 * Les murs d'une salle découpée : un tronçon par côté de case qui donne sur le vide.
 * `avant` et `apres` : le tronçon se prolonge de l'épaisseur du mur à ce bout, parce que c'est un coin sortant.
 */
export function troncons(plan) {
  const res = [];
  for (let y = 0; y < plan.longueur; y++) for (let x = 0; x < plan.largeur; x++) {
    if (!estSol(plan, x, y)) continue;
    if (!estSol(plan, x, y - 1)) res.push({ x, y, mur: 'nord', avant: !estSol(plan, x - 1, y), apres: !estSol(plan, x + 1, y) });
    if (!estSol(plan, x, y + 1)) res.push({ x, y, mur: 'sud', avant: !estSol(plan, x - 1, y), apres: !estSol(plan, x + 1, y) });
    if (!estSol(plan, x - 1, y)) res.push({ x, y, mur: 'ouest', avant: !estSol(plan, x, y - 1), apres: !estSol(plan, x, y + 1) });
    if (!estSol(plan, x + 1, y)) res.push({ x, y, mur: 'est', avant: !estSol(plan, x, y - 1), apres: !estSol(plan, x, y + 1) });
  }
  return res;
}

/**
 * Dessine les murs d'une salle découpée, pour les deux thèmes.
 * @param {{fond:string, trait:string, epaisseurTrait:number, joints:boolean}} style
 */
export function dessinerMursDecoupes(ctx, plan, t, e, { fond, trait, epaisseurTrait, joints }) {
  const liste = troncons(plan).map((c) => {
    const horizontal = c.mur === 'nord' || c.mur === 'sud';
    const a = c.avant ? e : 0, b = c.apres ? e : 0;
    if (horizontal) {
      const y = c.mur === 'nord' ? c.y * t - e : (c.y + 1) * t;
      return { c, x: c.x * t - a, y, l: t + a + b, h: e, horizontal };
    }
    const x = c.mur === 'ouest' ? c.x * t - e : (c.x + 1) * t;
    return { c, x, y: c.y * t - a, l: e, h: t + a + b, horizontal };
  });
  ctx.save();
  ctx.fillStyle = fond;
  for (const r of liste) ctx.fillRect(r.x, r.y, r.l, r.h);
  ctx.strokeStyle = trait;
  ctx.lineWidth = epaisseurTrait;
  ctx.beginPath();
  for (const { c, x, y, l, h, horizontal } of liste) {
    if (horizontal) {
      ctx.moveTo(x, y); ctx.lineTo(x + l, y);
      ctx.moveTo(x, y + h); ctx.lineTo(x + l, y + h);
      if (joints) { ctx.moveTo(c.x * t, y); ctx.lineTo(c.x * t, y + h); }
      if (c.avant) { ctx.moveTo(x, y); ctx.lineTo(x, y + h); }
      if (c.apres) { ctx.moveTo(x + l, y); ctx.lineTo(x + l, y + h); }
    } else {
      ctx.moveTo(x, y); ctx.lineTo(x, y + h);
      ctx.moveTo(x + l, y); ctx.lineTo(x + l, y + h);
      if (joints) { ctx.moveTo(x, c.y * t); ctx.lineTo(x + l, c.y * t); }
      if (c.avant) { ctx.moveTo(x, y); ctx.lineTo(x + l, y); }
      if (c.apres) { ctx.moveTo(x, y + h); ctx.lineTo(x + l, y + h); }
    }
  }
  ctx.stroke();
  ctx.restore();
}
