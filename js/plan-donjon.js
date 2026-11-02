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
 *  - si la place est prise, la salle ne change JAMAIS de côté : une porte à l'est mène toujours à une salle à l'est.
 *    C'est la salle de départ, avec tout ce qui se trouve de son côté, qui recule pour laisser la place. Les couloirs
 *    des liaisons ainsi écartées s'allongent (au moins 1 case entre deux salles) ;
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

/**
 * Place la salle B derrière le mur `ici.mur` de la salle A, sans jamais la mettre d'un autre côté.
 * Si une salle gêne, A et tout ce qui est de son côté du mur reculent, juste assez : reculer ne peut créer aucun
 * chevauchement, puisque ces salles s'éloignent seulement de celles qui ne bougent pas. Modifie `rects`.
 */
function placerDerriere(rects, A, ici, autre, dimB) {
  const mur = ici.mur;
  const horizontal = mur === 'est' || mur === 'ouest';
  const [debut, taille] = horizontal ? ['x', 'l'] : ['y', 'h'];
  const avance = mur === 'est' || mur === 'sud'; // B est du côté des coordonnées croissantes
  const coupure = avance ? A[debut] + A[taille] : A[debut];
  const liste = Object.values(rects);
  const duCoteDeA = liste.filter((o) => (avance ? o[debut] + o[taille] <= coupure : o[debut] >= coupure));
  const ideal = positionIdeale(A, { l: A.l, h: A.h }, ici, autre, dimB);
  const r = { x: ideal.x, y: ideal.y, l: dimB.l, h: dimB.h };
  for (let tour = 0; tour <= liste.length; tour++) {
    const genes = liste.filter((o) => tropProches(r, o));
    if (!genes.length) break;
    const recul = Math.max(...genes.map((o) => (avance
      ? r[debut] + r[taille] + ECART_MIN - o[debut]
      : o[debut] + o[taille] + ECART_MIN - r[debut])));
    const decalage = avance ? -recul : recul;
    for (const o of duCoteDeA) o[debut] += decalage;
    r[debut] += decalage;
  }
  return r;
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
      rects[vers] = placerDerriere(rects, A, ici, autre, dimB);
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

  const largeur = droite + 2 * MARGE_PLAN, longueur = bas + 2 * MARGE_PLAN;
  tracerCouloirs(couloirs, positions, largeur, longueur);
  return { positions, largeur, longueur, couloirs, isolees, etiquetteIsolees };
}

// --- Tracé des couloirs : ils contournent les salles ------------------------------------------

const COUT_VIRAGE = 2;           // un couloir préfère les lignes droites
const COUT_LONGE_SALLE = 0.5;    // et garde ses distances avec les murs quand il le peut
const COUT_SORTIE_PORTE = 6;     // évite de passer devant une autre porte
const COUT_CROISEMENT = 4;       // évite de suivre ou de croiser un autre couloir
const ETATS_MAX = 400000;        // au-delà (plan immense), on garde le tracé simple plutôt que de figer la page
const DIRECTIONS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const INDICE_DIRECTION = { nord: 0, est: 1, sud: 2, ouest: 3 };

/** Case juste devant une porte, côté extérieur de la salle (les points de porte tombent au milieu d'une case). */
const caseDevant = (p) => ({
  x: Math.floor(p.x) - (p.mur === 'ouest' ? 1 : 0),
  y: Math.floor(p.y) - (p.mur === 'nord' ? 1 : 0),
});

/** Cherche le chemin le moins coûteux, de case en case, à angle droit (A*). Renvoie les cases, ou null. */
function chercherChemin(depart, arrivee, dirDepart, grille, largeur, longueur, coutCase) {
  const cle = (x, y, dir) => (y * largeur + x) * 4 + dir;
  const distance = (x, y) => Math.abs(x - arrivee.x) + Math.abs(y - arrivee.y);
  const couts = new Map([[cle(depart.x, depart.y, dirDepart), 0]]);
  const parents = new Map();
  // Tas binaire minimal : [priorité, x, y, direction].
  const tas = [[distance(depart.x, depart.y), depart.x, depart.y, dirDepart]];
  const pousser = (n) => {
    let i = tas.push(n) - 1;
    while (i > 0) {
      const h = (i - 1) >> 1;
      if (tas[h][0] <= tas[i][0]) break;
      [tas[h], tas[i]] = [tas[i], tas[h]];
      i = h;
    }
  };
  const retirer = () => {
    const haut = tas[0], fin = tas.pop();
    if (tas.length) {
      tas[0] = fin;
      for (let i = 0; ;) {
        const g = 2 * i + 1, d = g + 1;
        let m = i;
        if (g < tas.length && tas[g][0] < tas[m][0]) m = g;
        if (d < tas.length && tas[d][0] < tas[m][0]) m = d;
        if (m === i) break;
        [tas[m], tas[i]] = [tas[i], tas[m]];
        i = m;
      }
    }
    return haut;
  };
  for (let vus = 0; tas.length && vus < ETATS_MAX; vus++) {
    const [, x, y, dir] = retirer();
    const k = cle(x, y, dir);
    if (x === arrivee.x && y === arrivee.y) {
      const cases = [];
      for (let c = k; c !== undefined; c = parents.get(c)) {
        const v = Math.floor(c / 4);
        cases.unshift({ x: v % largeur, y: Math.floor(v / largeur) });
      }
      return cases;
    }
    DIRECTIONS.forEach(([dx, dy], nd) => {
      if (Math.abs(nd - dir) === 2) return; // pas de demi-tour
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= largeur || ny >= longueur || grille[ny * largeur + nx]) return;
      const cout = couts.get(k) + 1 + (nd === dir ? 0 : COUT_VIRAGE) + coutCase(nx, ny);
      const nk = cle(nx, ny, nd);
      if (cout >= (couts.get(nk) ?? Infinity)) return;
      couts.set(nk, cout);
      parents.set(nk, k);
      pousser([cout + distance(nx, ny), nx, ny, nd]);
    });
  }
  return null;
}

/** Retire les points alignés : il ne reste que les extrémités et les virages. */
function sansPointsAlignes(pts) {
  const uniques = pts.filter((p, i) => i === 0 || p.x !== pts[i - 1].x || p.y !== pts[i - 1].y);
  return uniques.filter((p, i) => i === 0 || i === uniques.length - 1
    || !((uniques[i - 1].x === p.x && p.x === uniques[i + 1].x) || (uniques[i - 1].y === p.y && p.y === uniques[i + 1].y)));
}

/**
 * Ajoute à chaque couloir son `chemin` : une suite de points à angle droit qui ne traverse aucune salle, quitte à
 * s'allonger. Les couloirs sont tracés dans l'ordre des liaisons, en évitant autant que possible ceux déjà posés.
 * Pas de chemin possible (porte murée par une salle voisine, plan immense) : le couloir garde son tracé simple.
 */
function tracerCouloirs(couloirs, positions, largeur, longueur) {
  const grille = new Uint8Array(largeur * longueur);     // 1 : une salle occupe cette case
  const proche = new Uint8Array(largeur * longueur);     // 1 : case qui touche une salle
  const devantPorte = new Uint8Array(largeur * longueur);
  const pris = new Uint8Array(largeur * longueur);       // 1 : un couloir passe déjà ici
  const indice = (x, y) => y * largeur + x;
  const dans = (x, y) => x >= 0 && y >= 0 && x < largeur && y < longueur;
  for (const r of Object.values(positions)) {
    for (let y = r.y - 1; y <= r.y + r.longueur; y++) {
      for (let x = r.x - 1; x <= r.x + r.largeur; x++) {
        if (!dans(x, y)) continue;
        const dedans = x >= r.x && x < r.x + r.largeur && y >= r.y && y < r.y + r.longueur;
        if (dedans) grille[indice(x, y)] = 1;
        else proche[indice(x, y)] = 1;
      }
    }
  }
  const sorties = couloirs.flatMap((c) => [c.de, c.vers].map(caseDevant));
  for (const s of sorties) if (dans(s.x, s.y)) devantPorte[indice(s.x, s.y)] = 1;

  for (const c of couloirs) {
    const depart = caseDevant(c.de), arrivee = caseDevant(c.vers);
    const libre = (s) => dans(s.x, s.y) && !grille[indice(s.x, s.y)];
    if (c.orpheline || !libre(depart) || !libre(arrivee)) continue;
    const estExtremite = (x, y) => (x === depart.x && y === depart.y) || (x === arrivee.x && y === arrivee.y);
    const coutCase = (x, y) => {
      if (estExtremite(x, y)) return 0;
      const i = indice(x, y);
      return (proche[i] ? COUT_LONGE_SALLE : 0) + (devantPorte[i] ? COUT_SORTIE_PORTE : 0) + (pris[i] ? COUT_CROISEMENT : 0);
    };
    const cases = chercherChemin(depart, arrivee, INDICE_DIRECTION[c.de.mur], grille, largeur, longueur, coutCase);
    if (!cases) continue;
    for (const k of cases) pris[indice(k.x, k.y)] = 1;
    c.chemin = sansPointsAlignes([
      { x: c.de.x, y: c.de.y },
      ...cases.map((k) => ({ x: k.x + 0.5, y: k.y + 0.5 })),
      { x: c.vers.x, y: c.vers.y },
    ]);
  }
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
