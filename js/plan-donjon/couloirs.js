/**
 * Plan du donjon, les couloirs : le point de chaque porte sur le bord de sa salle, une ligne par liaison, le tracé simple d'un
 * couloir (sans contournement), et les ponts là où deux couloirs se croisent. Les points sont en cases, à angle droit.
 */
import { retraitPorte } from '../formes.js';
import { estHorizontal, longueurMur } from '../murs.js';
import { borner } from './pose-salles.js';

/**
 * Point d'une porte sur son mur, en cases : le centre de la porte, posé sur le bord de la salle.
 * La position est bornée au mur (une salle redimensionnée peut laisser une liaison orpheline hors du mur).
 */
function pointPorte(r, ext, plan) {
  const position = borner(ext.position | 0, 0, longueurMur(ext.mur, r.l, r.h) - 1);
  const p = position + 0.5;
  const mur = ext.mur;
  const d = retraitPorte(plan, mur, position); // au fond d'une entaille, si le rectangle de la salle y est coupé
  return {
    salle: ext.salle, mur,
    x: estHorizontal(mur) ? r.x + p : (mur === 'est' ? r.x + r.l - d : r.x + d),
    y: mur === 'est' || mur === 'ouest' ? r.y + p : (mur === 'sud' ? r.y + r.h - d : r.y + d),
  };
}

/**
 * Une ligne par liaison dont les deux salles existent (porte disparue ou non), de porte à porte, sans tracé encore.
 * `positions` : { x, y, largeur, longueur } de chaque salle, en cases.
 * @returns {Array<{liaison:string, de:object, vers:object, orpheline:boolean}>}
 */
export function lignesDeLiaisons(d, positions) {
  const orphelines = new Set();
  for (const l of d.liaisons || []) {
    for (const e of [l.a, l.b]) {
      const s = d.salles[e.salle];
      if (s && !(s.plan?.portes || []).some((p) => p.mur === e.mur && p.position === e.position)) orphelines.add(l.id);
    }
  }
  const couloirs = [];
  for (const l of d.liaisons || []) {
    if (!(l.a.salle in positions) || !(l.b.salle in positions) || l.a.salle === l.b.salle) continue;
    const ra = positions[l.a.salle], rb = positions[l.b.salle];
    couloirs.push({
      liaison: l.id,
      de: pointPorte({ x: ra.x, y: ra.y, l: ra.largeur, h: ra.longueur }, l.a, d.salles[l.a.salle].plan),
      vers: pointPorte({ x: rb.x, y: rb.y, l: rb.largeur, h: rb.longueur }, l.b, d.salles[l.b.salle].plan),
      orpheline: orphelines.has(l.id),
    });
  }
  return couloirs;
}

/** Retire les points alignés : il ne reste que les extrémités et les virages. */
export function sansPointsAlignes(pts) {
  const uniques = pts.filter((p, i) => i === 0 || p.x !== pts[i - 1].x || p.y !== pts[i - 1].y);
  return uniques.filter((p, i) => i === 0 || i === uniques.length - 1
    || !((uniques[i - 1].x === p.x && p.x === uniques[i + 1].x) || (uniques[i - 1].y === p.y && p.y === uniques[i + 1].y)));
}

export const PONT_DEMI_LONGUEUR = 0.85; // cases de part et d'autre du croisement

/**
 * Les ponts : un par endroit où deux couloirs se coupent franchement à angle droit (ni un virage posé sur l'autre, ni une
 * liaison orpheline). Le couloir tracé après passe au-dessus, sauf s'il tourne trop près pour porter le pont et pas l'autre.
 * @returns {Array<{x:number,y:number,horizontal:boolean}>}  `horizontal` : le sens du couloir qui passe dessus
 */
export function pontsDe(couloirs) {
  const segments = (c) => {
    const pts = cheminCouloir(c);
    return pts.slice(1).map((b, i) => {
      const a = pts[i];
      return { horizontal: a.y === b.y, x0: Math.min(a.x, b.x), x1: Math.max(a.x, b.x), y0: Math.min(a.y, b.y), y1: Math.max(a.y, b.y) };
    });
  };
  const liste = couloirs.filter((c) => !c.orpheline).map(segments);
  const assezLong = (s, x, y) => (s.horizontal
    ? x - s.x0 >= PONT_DEMI_LONGUEUR && s.x1 - x >= PONT_DEMI_LONGUEUR
    : y - s.y0 >= PONT_DEMI_LONGUEUR && s.y1 - y >= PONT_DEMI_LONGUEUR);
  const ponts = [];
  liste.forEach((apres, j) => {
    for (const avant of liste.slice(0, j).flat()) {
      for (const s of apres) {
        if (s.horizontal === avant.horizontal) continue;
        const h = s.horizontal ? s : avant, v = s.horizontal ? avant : s;
        if (!(v.x0 > h.x0 && v.x0 < h.x1 && h.y0 > v.y0 && h.y0 < v.y1)) continue;
        const x = v.x0, y = h.y0;
        const dessus = !assezLong(s, x, y) && assezLong(avant, x, y) ? avant : s;
        ponts.push({ x, y, horizontal: dessus.horizontal });
      }
    }
  });
  return ponts;
}

/**
 * Tracé d'un couloir : points en cases, à angle droit (jamais de diagonale).
 * Chaque extrémité part perpendiculairement à son mur. Deux murs parallèles : un « Z » (ou une ligne droite si les portes se
 * font face) ; un mur horizontal et un vertical : un « L ».
 * @returns {Array<{x:number,y:number}>}
 */
export function cheminCouloir(c) {
  if (c.chemin) return c.chemin; // tracé calculé par disposerPlan, qui contourne les salles
  const { de: a, vers: b } = c;
  const horizontal = (p) => p.mur === 'est' || p.mur === 'ouest';
  const pts = [{ x: a.x, y: a.y }];
  if (horizontal(a) && horizontal(b)) {
    const milieu = (a.x + b.x) / 2;
    pts.push({ x: milieu, y: a.y }, { x: milieu, y: b.y });
  } else if (!horizontal(a) && !horizontal(b)) {
    const milieu = (a.y + b.y) / 2;
    pts.push({ x: a.x, y: milieu }, { x: b.x, y: milieu });
  } else if (horizontal(a)) pts.push({ x: b.x, y: a.y });
  else pts.push({ x: a.x, y: b.y });
  pts.push({ x: b.x, y: b.y });
  return sansPointsAlignes(pts); // ni point en double, ni point aligné inutile
}
