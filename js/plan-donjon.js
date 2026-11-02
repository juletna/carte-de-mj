/**
 * Plan du donjon : toutes les salles posées à leur VRAIE taille, en cases, reliées par des couloirs.
 *
 * Contrairement à `disposerSalles` (minicarte.js : schéma sans échelle, une salle = une case, qui sert aussi à la
 * Présentation), ici chaque salle garde ses dimensions. Module PUR (aucun DOM, aucun stockage), testable sous Node :
 * il ne modifie jamais le donjon qu'on lui donne et renvoie toujours le même plan pour les mêmes données.
 *
 * Règles de placement :
 *  - parcours en largeur depuis la première salle, en suivant les liaisons dans l'ordre où elles sont écrites ;
 *  - la salle reliée se place derrière le mur de la porte, avec 2 cases entre les deux murs, décalée pour que les deux
 *    portes se fassent face (quand la porte d'arrivée est sur le mur opposé ; sinon la salle est centrée sur la porte) ;
 *  - si la place est prise : on l'éloigne dans la même direction, puis sur le côté, jusqu'à ne chevaucher personne
 *    (au moins 1 case entre deux salles) ;
 *  - une porte qui mène à une salle déjà placée ne déplace rien : la liaison est simplement tracée ;
 *  - les salles sans aucune liaison vont en rangée sous le reste, sous l'étiquette « Salles non reliées » ;
 *    un groupe de salles reliées entre elles, mais pas à la première, forme un bloc posé sous le premier.
 */

const VECTEUR = { nord: [0, -1], sud: [0, 1], est: [1, 0], ouest: [-1, 0] };
const OPPOSE = { nord: 'sud', sud: 'nord', est: 'ouest', ouest: 'est' };

export const ECART_LIAISON = 2;   // cases entre les murs de deux salles reliées
export const ECART_MIN = 1;       // cases libres minimum entre deux salles quelconques
export const MARGE_PLAN = 2;      // cases autour de l'ensemble (noms au-dessus des salles du haut, murs, couloirs)
export const ETIQUETTE_ISOLEES = 'Salles non reliées';

const ECART_BLOCS = 4;            // cases entre deux blocs de salles (et avant la rangée des non reliées)
const ECART_RANGEE = 2;           // cases entre deux salles de la rangée des non reliées
const LARGEUR_RANGEE_MIN = 24;    // la rangée des non reliées passe à la ligne au-delà de cette largeur (ou celle du plan)
const POUSSEE_MAX = 10;           // cases d'éloignement essayées dans la direction avant de passer sur le côté
const DECALAGE_MAX = 40;          // cases de décalage latéral essayées

const dimensions = (s) => ({ l: Math.max(1, s?.plan?.largeur | 0 || 1), h: Math.max(1, s?.plan?.longueur | 0 || 1) });
const longueurMur = (dim, mur) => (mur === 'nord' || mur === 'sud' ? dim.l : dim.h);
const borner = (v, min, max) => Math.max(min, Math.min(max, v));

/** Deux rectangles (x, y, l, h) sont-ils à moins de `ecart` cases l'un de l'autre (ou se chevauchent-ils) ? */
function tropProches(a, b, ecart = ECART_MIN) {
  return a.x < b.x + b.l + ecart && b.x < a.x + a.l + ecart && a.y < b.y + b.h + ecart && b.y < a.y + a.h + ecart;
}

/** Salles voisines d'une salle, dans l'ordre des liaisons : { vers, ici, autre } (extrémités de la liaison). */
function voisins(d, id) {
  const res = [];
  for (const l of d.liaisons || []) {
    if (l.a.salle === id && l.b.salle !== id) res.push({ vers: l.b.salle, ici: l.a, autre: l.b });
    else if (l.b.salle === id && l.a.salle !== id) res.push({ vers: l.a.salle, ici: l.b, autre: l.a });
  }
  return res.filter((v) => v.vers in d.salles);
}

/**
 * Position idéale (avant tout éloignement) de la salle d'arrivée, derrière le mur `ici.mur` de la salle `A`.
 * Les portes se font face si l'arrivée est sur le mur opposé ; sinon la salle est centrée sur la porte de départ.
 */
function positionIdeale(A, dimA, ici, autre, dimB) {
  const mur = ici.mur;
  const p = borner(ici.position | 0, 0, longueurMur(dimA, mur) - 1);
  const q = borner(autre.position | 0, 0, longueurMur(dimB, autre.mur) - 1);
  const face = autre.mur === OPPOSE[mur];
  if (mur === 'est' || mur === 'ouest') {
    const y = face ? A.y + p - q : Math.round(A.y + p + 0.5 - dimB.h / 2);
    return { x: mur === 'est' ? A.x + dimA.l + ECART_LIAISON : A.x - ECART_LIAISON - dimB.l, y };
  }
  const x = face ? A.x + p - q : Math.round(A.x + p + 0.5 - dimB.l / 2);
  return { x, y: mur === 'sud' ? A.y + dimA.h + ECART_LIAISON : A.y - ECART_LIAISON - dimB.h };
}

/** Éloigne la salle jusqu'à une place libre : dans la direction du mur, puis sur le côté. Déterministe. */
function placeLibre(ideal, dim, mur, rects) {
  const [vx, vy] = VECTEUR[mur];
  const [lx, ly] = [Math.abs(vy), Math.abs(vx)]; // axe latéral
  const essai = (poussee, lateral) => ({ x: ideal.x + vx * poussee + lx * lateral, y: ideal.y + vy * poussee + ly * lateral, l: dim.l, h: dim.h });
  const libre = (r) => !rects.some((o) => tropProches(r, o));
  for (let k = 0; k <= POUSSEE_MAX; k++) if (libre(essai(k, 0))) return essai(k, 0);
  for (let s = 1; s <= DECALAGE_MAX; s++) {
    for (const lateral of [s, -s]) for (let k = 0; k <= POUSSEE_MAX; k++) if (libre(essai(k, lateral))) return essai(k, lateral);
  }
  // Dernier recours (donjon très dense) : toujours plus loin dans la direction ; finit forcément, les salles sont en nombre fini.
  const borne = rects.reduce((n, o) => n + o.l + o.h + 2, 0) + 2 * (dim.l + dim.h) + 8;
  for (let k = POUSSEE_MAX + 1; k <= borne; k++) if (libre(essai(k, 0))) return essai(k, 0);
  return essai(borne, 0);
}

/** Dispose les salles de la composante de `racine`, relativement à (0, 0). Renvoie { ids, rects }. */
function disposerComposante(d, racine, dejaVus) {
  const rects = {};
  const dim = (id) => dimensions(d.salles[id]);
  rects[racine] = { x: 0, y: 0, l: dim(racine).l, h: dim(racine).h };
  const file = [racine];
  dejaVus.add(racine);
  for (let i = 0; i < file.length; i++) {
    const id = file[i];
    const A = rects[id];
    for (const { vers, ici, autre } of voisins(d, id)) {
      if (vers in rects) continue; // déjà placée : la liaison sera seulement tracée
      const dimB = dim(vers);
      const ideal = positionIdeale(A, { l: A.l, h: A.h }, ici, autre, dimB);
      rects[vers] = placeLibre(ideal, dimB, ici.mur, Object.values(rects));
      dejaVus.add(vers);
      file.push(vers);
    }
  }
  return { ids: file, rects };
}

const englobant = (rs) => ({
  x0: Math.min(...rs.map((r) => r.x)), y0: Math.min(...rs.map((r) => r.y)),
  x1: Math.max(...rs.map((r) => r.x + r.l)), y1: Math.max(...rs.map((r) => r.y + r.h)),
});

/**
 * Point d'une porte sur son mur, en cases : le centre de la porte, posé sur le bord de la salle.
 * La position est bornée au mur (une salle redimensionnée peut laisser une liaison orpheline hors du mur).
 */
function pointPorte(r, ext) {
  const p = borner(ext.position | 0, 0, longueurMur({ l: r.l, h: r.h }, ext.mur) - 1) + 0.5;
  const mur = ext.mur;
  return {
    salle: ext.salle, mur,
    x: mur === 'nord' || mur === 'sud' ? r.x + p : (mur === 'est' ? r.x + r.l : r.x),
    y: mur === 'est' || mur === 'ouest' ? r.y + p : (mur === 'sud' ? r.y + r.h : r.y),
  };
}

/**
 * Calcule le plan du donjon.
 *
 * @param {object} d  donjon (jamais modifié)
 * @returns {{
 *   positions: Object<string,{x:number,y:number,largeur:number,longueur:number}>,  // en cases, dans un repère qui commence à 0
 *   largeur: number, longueur: number,        // taille totale du plan, marges comprises
 *   couloirs: Array<{liaison:string, de:{salle,mur,x,y}, vers:{salle,mur,x,y}, orpheline:boolean}>,
 *   isolees: string[],                        // salles sans liaison, dans la rangée du bas
 *   etiquetteIsolees: {x:number,y:number}|null  // où écrire « Salles non reliées »
 * }}
 *
 * Liaison orpheline (une porte a disparu, voir `liaisonsOrphelines`) : le couloir existe quand même (drapeau
 * `orpheline`), tracé depuis l'endroit où se trouvait la porte (la position mémorisée par la liaison) ; le dessin
 * le montre en pointillés. Une liaison dont une salle n'existe plus est ignorée.
 */
export function disposerPlan(d) {
  const ids = Object.keys(d.salles || {});
  if (!ids.length) return { positions: {}, largeur: 2 * MARGE_PLAN, longueur: 2 * MARGE_PLAN, couloirs: [], isolees: [], etiquetteIsolees: null };

  const vus = new Set();
  const composantes = [];
  for (const id of ids) {
    if (vus.has(id)) continue;
    composantes.push(disposerComposante(d, id, vus));
  }
  // Les salles sans liaison (hors la première, qui ouvre le plan) vont dans la rangée du bas.
  const blocs = composantes.filter((c, i) => i === 0 || c.ids.length > 1);
  const isolees = composantes.filter((c, i) => i > 0 && c.ids.length === 1).map((c) => c.ids[0]);

  const rects = {};
  let bas = 0, droite = 0;
  blocs.forEach((c, i) => {
    const e = englobant(Object.values(c.rects));
    const dy = (i === 0 ? 0 : bas + ECART_BLOCS) - e.y0;
    for (const id of c.ids) rects[id] = { x: c.rects[id].x - e.x0, y: c.rects[id].y + dy, l: c.rects[id].l, h: c.rects[id].h };
    bas = e.y1 + dy;
    droite = Math.max(droite, e.x1 - e.x0);
  });

  let etiquetteIsolees = null;
  if (isolees.length) {
    const largeurMax = Math.max(droite, LARGEUR_RANGEE_MIN);
    etiquetteIsolees = { x: 0, y: bas + ECART_BLOCS - 2 };
    let x = 0, y = bas + ECART_BLOCS + 3, hauteurLigne = 0;
    for (const id of isolees) {
      const { l, h } = dimensions(d.salles[id]);
      if (x > 0 && x + l > largeurMax) { x = 0; y += hauteurLigne + ECART_RANGEE + 1; hauteurLigne = 0; }
      rects[id] = { x, y, l, h };
      x += l + ECART_RANGEE;
      hauteurLigne = Math.max(hauteurLigne, h);
      droite = Math.max(droite, x - ECART_RANGEE);
    }
    bas = y + hauteurLigne;
  }

  // Marge autour de l'ensemble.
  const positions = {};
  for (const id of ids) {
    const r = rects[id];
    positions[id] = { x: r.x + MARGE_PLAN, y: r.y + MARGE_PLAN, largeur: r.l, longueur: r.h };
  }
  if (etiquetteIsolees) etiquetteIsolees = { x: etiquetteIsolees.x + MARGE_PLAN, y: etiquetteIsolees.y + MARGE_PLAN };

  // Couloirs : une ligne par liaison dont les deux salles existent (porte disparue ou non).
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
      de: pointPorte({ x: ra.x, y: ra.y, l: ra.largeur, h: ra.longueur }, l.a),
      vers: pointPorte({ x: rb.x, y: rb.y, l: rb.largeur, h: rb.longueur }, l.b),
      orpheline: orphelines.has(l.id),
    });
  }

  return { positions, largeur: droite + 2 * MARGE_PLAN, longueur: bas + 2 * MARGE_PLAN, couloirs, isolees, etiquetteIsolees };
}

/**
 * Tracé d'un couloir : points en cases, à angle droit (jamais de diagonale).
 * Chaque extrémité part perpendiculairement à son mur. Deux murs parallèles : un « Z » (ou une ligne droite si les portes se
 * font face) ; un mur horizontal et un vertical : un « L ».
 * @returns {Array<{x:number,y:number}>}
 */
export function cheminCouloir(c) {
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
  // Ni point en double, ni point aligné inutile.
  const sans = pts.filter((p, i) => i === 0 || p.x !== pts[i - 1].x || p.y !== pts[i - 1].y);
  return sans.filter((p, i) => i === 0 || i === sans.length - 1
    || !((sans[i - 1].x === p.x && p.x === sans[i + 1].x) || (sans[i - 1].y === p.y && p.y === sans[i + 1].y)));
}

/**
 * Salle sous un point du plan (en cases, repère de `disposerPlan`), murs compris ; null si le point est dans le vide.
 * Les salles ne se chevauchent pas : au plus une répond.
 */
export function salleSous(disposition, x, y, tolerance = 0.35) {
  for (const [id, p] of Object.entries(disposition.positions)) {
    if (x >= p.x - tolerance && x <= p.x + p.largeur + tolerance && y >= p.y - tolerance && y <= p.y + p.longueur + tolerance) return id;
  }
  return null;
}
