/**
 * Plan du donjon : toutes les salles posées à leur VRAIE taille, en cases, reliées par des couloirs.
 *
 * Chaque salle garde ses dimensions. C'est la seule disposition de l'outil : plan complet, miniature, encart de la table.
 * Module PUR (aucun DOM, aucun stockage), testable sous Node :
 * il ne modifie jamais le donjon qu'on lui donne et renvoie toujours le même plan pour les mêmes données.
 *
 * Règles de placement :
 *  - parcours en largeur depuis la première salle, en suivant les liaisons dans l'ordre où elles sont écrites ;
 *  - la salle reliée se place derrière le mur de la porte, avec 2 cases entre les deux murs, décalée pour que les deux
 *    portes se fassent face (quand la porte d'arrivée est sur le mur opposé ; sinon la salle est centrée sur la porte) ;
 *  - si la salle barrerait le couloir droit d'une autre porte du même mur, elle glisse de 5 cases au plus pour le laisser
 *    passer : ses propres portes ne se font alors plus face, et son couloir fait un petit crochet ;
 *  - si la place est prise, la salle ne change JAMAIS de côté : une porte à l'est mène toujours à une salle à l'est.
 *    C'est la salle de départ, avec tout ce qui se trouve de son côté, qui recule pour laisser la place. Les couloirs
 *    des liaisons ainsi écartées s'allongent. La salle insérée a alors 5 cases de chaque côté : une case de passage
 *    pour le couloir qui la contourne, et deux cases libres de part et d'autre pour qu'il reste bien au large des murs.
 *    Mais si son couloir peut filer tout droit le long de la salle qui gêne, la nouvelle salle se pose après celle-ci :
 *    aucun couloir n'a alors à faire le tour, ni à croiser celui d'à côté ;
 *  - une porte qui mène à une salle déjà placée ne déplace rien : la liaison est simplement tracée ;
 *  - l'ordre de pose change tout : plusieurs ordres sont essayés (toujours les mêmes, le résultat ne varie donc pas pour
 *    les mêmes données), et le plan gardé est celui qui a le moins de croisements et de couloirs collés aux murs ;
 *  - plus le donjon a de boucles (des liaisons en plus de celles qui suffisent à tout relier), plus ses couloirs se
 *    disputent la place : les salles s'écartent alors de 1 ou 2 cases de plus (voir `espaceDuDonjon`) ;
 *  - les salles sans aucune liaison vont en rangée sous le reste, sous l'étiquette « Salles non reliées » ;
 *    un groupe de salles reliées entre elles, mais pas à la première, forme un bloc posé sous le premier.
 */

import { casesRetirees, retraitPorte } from './formes.js';

const OPPOSE = { nord: 'sud', sud: 'nord', est: 'ouest', ouest: 'est' };

export const ECART_LIAISON = 3;   // cases entre les murs de deux salles reliées
export const ECART_MIN = 2;       // cases libres minimum entre deux salles quelconques, côte à côte
export const ECART_MIN_NOM = 3;   // la même chose l'une au-dessus de l'autre : le nom de celle du dessous s'écrit entre les deux
export const ECART_PASSAGE = 5;   // cases de chaque côté d'une salle insérée : passage d'un couloir + deux cases libres de part et d'autre
export const MARGE_PLAN = 2;      // cases autour de l'ensemble (noms au-dessus des salles du haut, murs, couloirs)
export const ETIQUETTE_ISOLEES = 'Salles non reliées';

const MARGE_ROUTAGE = 8;          // cases où un couloir peut sortir de l'ensemble des salles : le plan s'agrandit d'autant
const BOUCLES_PAR_SALLE_1 = 1 / 3; // à partir de ce nombre de boucles par salle, 1 case de plus entre les salles
const BOUCLES_PAR_SALLE_2 = 2 / 3; // à partir de celui-ci, 2 cases de plus
const GLISSEMENT_MAX = 5;         // cases dont une salle peut glisser pour libérer le couloir droit d'une porte voisine
const GLISSEMENTS = Array.from({ length: 2 * GLISSEMENT_MAX + 1 }, (_, i) => (i % 2 ? (i + 1) / 2 : -i / 2)); // 0, 1, -1, 2, -2…
const LIBRE_COULOIR = 2;          // cases libres entre le couloir droit et la salle qui glisse
const LIBRE_NOM = 3;              // cases libres si le couloir passe au-dessus de la salle : son nom s'écrit là
const HAUTEUR_NOM = 1;            // rangées où s'écrit le nom d'une salle, au-dessus de celle qui touche son mur
const ESSAIS_MAX = 8;             // dispositions essayées au plus : au-delà, on ne gagne presque plus rien
const SALLES_ESSAIS = 240;        // au-delà de 30 salles, moins d'essais (salles × essais), pour ne pas faire attendre
const ECART_BLOCS = 4;            // cases entre deux blocs de salles (et avant la rangée des non reliées)
const ECART_RANGEE = 2;           // cases entre deux salles de la rangée des non reliées
const LARGEUR_RANGEE_MIN = 24;    // la rangée des non reliées passe à la ligne au-delà de cette largeur (ou celle du plan)

const dimensions = (s) => ({ l: Math.max(1, s?.plan?.largeur | 0 || 1), h: Math.max(1, s?.plan?.longueur | 0 || 1) });
const longueurMur = (dim, mur) => (mur === 'nord' || mur === 'sud' ? dim.l : dim.h);
const borner = (v, min, max) => Math.max(min, Math.min(max, v));

/** Deux rectangles (x, y, l, h) sont-ils à moins de `ecart` cases l'un de l'autre (ou se chevauchent-ils) ? */
function tropProches(a, b) {
  return a.x < b.x + b.l + ECART_MIN && b.x < a.x + a.l + ECART_MIN && a.y < b.y + b.h + ECART_MIN_NOM && b.y < a.y + a.h + ECART_MIN_NOM;
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
function positionIdeale(A, dimA, ici, autre, dimB, espace = 0) {
  const ecart = ECART_LIAISON + espace;
  const mur = ici.mur;
  const p = borner(ici.position | 0, 0, longueurMur(dimA, mur) - 1);
  const q = borner(autre.position | 0, 0, longueurMur(dimB, autre.mur) - 1);
  const face = autre.mur === OPPOSE[mur];
  if (mur === 'est' || mur === 'ouest') {
    const y = face ? A.y + p - q : Math.round(A.y + p + 0.5 - dimB.h / 2);
    return { x: mur === 'est' ? A.x + dimA.l + ecart : A.x - ecart - dimB.l, y };
  }
  const x = face ? A.x + p - q : Math.round(A.x + p + 0.5 - dimB.l / 2);
  return { x, y: mur === 'sud' ? A.y + dimA.h + ecart : A.y - ecart - dimB.h };
}

/**
 * Place la salle B derrière le mur `ici.mur` de la salle A, sans jamais la mettre d'un autre côté.
 * Si une salle gêne sans barrer la ligne droite qui part de la porte, B se pose simplement après elle. Si elle la barre,
 * B s'insère devant elle : A et tout ce qui est de son côté reculent, juste assez (reculer ne peut créer aucun
 * chevauchement, puisque ces salles s'éloignent seulement de celles qui ne bougent pas), et B est à ECART_PASSAGE de
 * ses deux voisines, car un couloir devra passer de chaque côté d'elle pour la contourner. Modifie `rects`.
 */
function placerDerriere(rects, A, ici, autre, dimB, espace = 0, autres = []) {
  const passage = ECART_PASSAGE + espace;
  const mur = ici.mur;
  const horizontal = mur === 'est' || mur === 'ouest';
  const [debut, taille] = horizontal ? ['x', 'l'] : ['y', 'h'];
  const [cote, tailleCote] = horizontal ? ['y', 'h'] : ['x', 'l'];
  const avance = mur === 'est' || mur === 'sud'; // B est du côté des coordonnées croissantes
  // Les deux bords d'une salle, comptés dans le sens du couloir (le même calcul sert alors pour les quatre murs).
  const entree = (o) => (avance ? o[debut] : -(o[debut] + o[taille]));
  const sortie = (o) => (avance ? o[debut] + o[taille] : -o[debut]);
  const liste = Object.values(rects);
  const ideal = positionIdeale(A, { l: A.l, h: A.h }, ici, autre, dimB, espace);
  const r = { x: ideal.x, y: ideal.y, l: dimB.l, h: dimB.h };
  // La ligne droite n'existe que si les portes se font face. Elle passe si une case libre la sépare du mur de la salle.
  let ligne = autre.mur === OPPOSE[mur] ? A[cote] + borner(ici.position | 0, 0, longueurMur(A, mur) - 1) : null;
  const barreRang = (o, rang) => rang > o[cote] - 2 && rang <= o[cote] + o[tailleCote];
  const barreLigne = (o) => ligne === null || barreRang(o, ligne);
  const devantA = liste.filter((o) => o !== A && sortie(o) > sortie(A));
  // Les couloirs droits voisins qui passeraient là où B se pose : leur salle est déjà posée plus loin, et rien ne les barre.
  // (Une salle pas encore posée ne compte pas : sinon les deux salles glisseraient, et aucune porte ne ferait plus face.)
  const rangs = autres.flatMap(({ vers, ici: porte }) => {
    const cible = rects[vers];
    if (!cible || sortie(cible) <= entree(r)) return [];
    const rang = A[cote] + borner(porte.position | 0, 0, longueurMur(A, mur) - 1);
    const barre = devantA.some((o) => o !== cible && barreRang(o, rang) && entree(o) < entree(cible));
    return barre ? [] : [rang];
  });
  const libreAvant = horizontal ? LIBRE_NOM : LIBRE_COULOIR; // `cote` croissant vers le bas : « avant » est au-dessus de la salle
  const libere = (g) => !rangs.some((rang) => rang >= r[cote] + g - libreAvant && rang < r[cote] + g + r[tailleCote] + LIBRE_COULOIR);
  const auLarge = (g) => !liste.some((o) => tropProches({ ...r, [cote]: r[cote] + g }, o));
  const decalage0 = rangs.length ? GLISSEMENTS.find((g) => libere(g) && auLarge(g)) ?? GLISSEMENTS.find(libere) : 0;
  if (decalage0) { r[cote] += decalage0; ligne = null; }
  const enPlus = passage - ECART_MIN; // ce qu'il faut de plus que l'écart minimum, seulement devant la salle
  let ecartee = false;
  for (let tour = 0; tour <= 2 * liste.length; tour++) {
    const zone = { ...r, [debut]: avance ? r[debut] : r[debut] - enPlus, [taille]: r[taille] + enPlus };
    const genes = liste.filter((o) => tropProches(zone, o));
    if (!genes.length) break;
    const fin = Math.max(...genes.map(sortie));
    if (!genes.some(barreLigne) && !devantA.some((o) => barreLigne(o) && entree(o) < fin)) {
      const place = fin + passage;
      r[debut] = avance ? place : -place - r[taille];
      ecartee = true;
      continue;
    }
    const aReculer = liste.filter((o) => sortie(o) <= entree(r) && !genes.includes(o));
    if (!ecartee) r[debut] += (avance ? 1 : -1) * (ECART_PASSAGE - ECART_LIAISON); // le passage, côté salle de départ
    ecartee = true;
    const recul = Math.max(...genes.map((o) => sortie(r) + passage - entree(o)));
    const decalage = avance ? -recul : recul;
    for (const o of aReculer) o[debut] += decalage;
    r[debut] += decalage;
  }
  return r;
}

/** Générateur pseudo-aléatoire : la même graine donne toujours la même suite. */
function generateur(graine) {
  let x = (graine * 2654435761) >>> 0;
  return () => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return x / 4294967296; };
}

/** Copie mélangée de la liste, ou la liste telle quelle sans générateur. */
function melanger(liste, alea) {
  if (!alea) return liste;
  const copie = [...liste];
  for (let i = copie.length - 1; i > 0; i--) {
    const j = Math.floor(alea() * (i + 1));
    [copie[i], copie[j]] = [copie[j], copie[i]];
  }
  return copie;
}

/** Dispose les salles de la composante de `racine`, relativement à (0, 0). Renvoie { ids, rects }. */
function disposerComposante(d, racine, dejaVus, espace, alea) {
  const rects = {};
  const dim = (id) => dimensions(d.salles[id]);
  rects[racine] = { x: 0, y: 0, l: dim(racine).l, h: dim(racine).h };
  const file = [racine];
  dejaVus.add(racine);
  for (let i = 0; i < file.length; i++) {
    const id = file[i];
    const A = rects[id];
    const liaisons = melanger(voisins(d, id), alea);
    for (const { vers, ici, autre } of liaisons) {
      if (vers in rects) continue; // déjà placée : la liaison sera seulement tracée
      const dimB = dim(vers);
      const autres = liaisons.filter((v) => v.vers !== vers && v.ici.mur === ici.mur && v.autre.mur === OPPOSE[ici.mur]);
      rects[vers] = placerDerriere(rects, A, ici, autre, dimB, espace, autres);
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
function pointPorte(r, ext, plan) {
  const position = borner(ext.position | 0, 0, longueurMur({ l: r.l, h: r.h }, ext.mur) - 1);
  const p = position + 0.5;
  const mur = ext.mur;
  const d = retraitPorte(plan, mur, position); // au fond d'une entaille, si le rectangle de la salle y est coupé
  return {
    salle: ext.salle, mur,
    x: mur === 'nord' || mur === 'sud' ? r.x + p : (mur === 'est' ? r.x + r.l - d : r.x + d),
    y: mur === 'est' || mur === 'ouest' ? r.y + p : (mur === 'sud' ? r.y + r.h - d : r.y + d),
  };
}

/** Cases à ajouter entre les salles, selon le nombre de boucles par salle (composantes séparées comprises). */
function espaceDuDonjon(d, ids) {
  const parent = new Map(ids.map((id) => [id, id]));
  const racine = (id) => { while (parent.get(id) !== id) id = parent.get(id); return id; };
  let boucles = 0;
  for (const l of d.liaisons || []) {
    if (!parent.has(l.a.salle) || !parent.has(l.b.salle) || l.a.salle === l.b.salle) continue;
    const a = racine(l.a.salle), b = racine(l.b.salle);
    if (a === b) boucles++;
    else parent.set(a, b);
  }
  const parSalle = boucles / ids.length;
  return parSalle >= BOUCLES_PAR_SALLE_2 ? 2 : parSalle >= BOUCLES_PAR_SALLE_1 ? 1 : 0;
}

/**
 * Calcule le plan du donjon.
 *
 * @param {object} d  donjon (jamais modifié)
 * @returns {{
 *   positions: Object<string,{x:number,y:number,largeur:number,longueur:number}>,  // en cases, dans un repère qui commence à 0
 *   largeur: number, longueur: number,        // taille totale du plan, marges comprises
 *   couloirs: Array<{liaison:string, de:{salle,mur,x,y}, vers:{salle,mur,x,y}, orpheline:boolean}>,
 *   ponts: Array<{x:number,y:number,horizontal:boolean}>,  // là où deux couloirs se croisent, voir `pontsDe`
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
  if (!ids.length) return { positions: {}, largeur: 2 * MARGE_PLAN, longueur: 2 * MARGE_PLAN, couloirs: [], ponts: [], isolees: [], etiquetteIsolees: null };

  const espace = espaceDuDonjon(d, ids);
  const essais = Math.max(1, Math.min(ESSAIS_MAX, Math.floor(SALLES_ESSAIS / ids.length)));
  let meilleur = calculerPlan(d, ids, espace, null);
  // Le premier essai suit l'ordre des liaisons. On s'arrête dès qu'un plan n'a plus rien à améliorer.
  for (let essai = 1; essai < essais && meilleur.defauts > 0; essai++) {
    const autre = calculerPlan(d, ids, espace, generateur(essai));
    if (autre.note < meilleur.note) meilleur = autre;
  }
  const { note, defauts, ...plan } = meilleur;
  return { ...plan, ponts: pontsDe(plan.couloirs) };
}

/** Ce dont dépend la disposition : si cette clé ne change pas, le plan déjà calculé reste bon (il est coûteux à refaire). */
export function cleDisposition(d) {
  const salles = Object.values(d.salles).map((s) => [s.id, s.plan.largeur, s.plan.longueur, s.plan.forme, s.plan.bras, s.plan.position, s.plan.portes]);
  return JSON.stringify([salles, d.liaisons]);
}

/** Un plan selon un ordre de pose (`alea` : null pour l'ordre des liaisons), avec sa note : plus elle est basse, mieux c'est. */
function calculerPlan(d, ids, espace, alea) {
  const vus = new Set();
  const composantes = [];
  for (const id of ids) {
    if (vus.has(id)) continue;
    composantes.push(disposerComposante(d, id, vus, espace, alea));
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

  // De la place tout autour pour tracer les couloirs ; le plan sera recadré sur ce qui est réellement dessiné.
  const positions = {};
  for (const id of ids) {
    const r = rects[id];
    positions[id] = { x: r.x + MARGE_ROUTAGE, y: r.y + MARGE_ROUTAGE, largeur: r.l, longueur: r.h };
  }
  if (etiquetteIsolees) etiquetteIsolees = { x: etiquetteIsolees.x + MARGE_ROUTAGE, y: etiquetteIsolees.y + MARGE_ROUTAGE };

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
      de: pointPorte({ x: ra.x, y: ra.y, l: ra.largeur, h: ra.longueur }, l.a, d.salles[l.a.salle].plan),
      vers: pointPorte({ x: rb.x, y: rb.y, l: rb.largeur, h: rb.longueur }, l.b, d.salles[l.b.salle].plan),
      orpheline: orphelines.has(l.id),
    });
  }

  const bilan = tracerCouloirs(couloirs, positions, d, droite + 2 * MARGE_ROUTAGE, bas + 2 * MARGE_ROUTAGE);

  // Recadrage : une marge de MARGE_PLAN autour des salles ET des couloirs.
  const xs = [], ys = [];
  for (const r of Object.values(positions)) { xs.push(r.x, r.x + r.largeur); ys.push(r.y, r.y + r.longueur); }
  for (const c of couloirs) for (const pt of cheminCouloir(c)) { xs.push(Math.floor(pt.x), Math.ceil(pt.x)); ys.push(Math.floor(pt.y), Math.ceil(pt.y)); }
  if (etiquetteIsolees) { xs.push(etiquetteIsolees.x); ys.push(etiquetteIsolees.y); }
  const x0 = Math.min(...xs), y0 = Math.min(...ys);
  const dx = MARGE_PLAN - x0, dy = MARGE_PLAN - y0;
  const glisser = (o) => { o.x += dx; o.y += dy; };
  Object.values(positions).forEach(glisser);
  if (etiquetteIsolees) glisser(etiquetteIsolees);
  for (const c of couloirs) { glisser(c.de); glisser(c.vers); (c.chemin || []).forEach(glisser); }
  const largeur = Math.max(...xs) - x0 + 2 * MARGE_PLAN, longueur = Math.max(...ys) - y0 + 2 * MARGE_PLAN;
  return {
    positions, largeur, longueur, couloirs, isolees, etiquetteIsolees,
    defauts: bilan.croisements + bilan.frottements,
    note: NOTE_CROISEMENT * bilan.croisements + NOTE_FROTTEMENT * bilan.frottements + NOTE_VIRAGE * bilan.virages + NOTE_LONGUEUR * bilan.longueur,
  };
}

// --- Tracé des couloirs : ils contournent les salles ------------------------------------------

const COUT_VIRAGE = 2;           // un couloir préfère les lignes droites
const COUT_LONGE_SALLE = 6;      // et garde ses distances avec les murs : le mur, dessiné à l'extérieur, le toucherait
const COUT_SOUS_NOM = 4;         // ni ne passe là où s'écrit le nom d'une salle
const COUT_LONGE_COULOIR = 4;    // ni avec les autres couloirs
const NOTE_CROISEMENT = 20;      // poids dans la note d'un plan : une case partagée par deux couloirs,
const NOTE_FROTTEMENT = 3;       // une case de couloir contre une salle,
const NOTE_VIRAGE = 1;           // un virage,
const NOTE_LONGUEUR = 0.2;       // une case de couloir
const COUT_SORTIE_PORTE = 6;     // évite de passer devant une autre porte
const COUT_CROISEMENT = 40;      // un croisement ne se justifie que si le détour est vraiment très long
const PASSES_MAX = 3;            // retracés quand des couloirs se croisent encore : chacun réessaie, les autres étant posés
const ETATS_MAX = 400000;        // au-delà (plan immense), on garde le tracé simple plutôt que de figer la page
const DIRECTIONS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const INDICE_DIRECTION = { nord: 0, est: 1, sud: 2, ouest: 3 };

/** Case juste devant une porte, côté extérieur de la salle (les points de porte tombent au milieu d'une case). */
const caseDevant = (p) => ({
  x: Math.floor(p.x) - (p.mur === 'ouest' ? 1 : 0),
  y: Math.floor(p.y) - (p.mur === 'nord' ? 1 : 0),
});

/**
 * Cherche le chemin le moins coûteux, de case en case, à angle droit (A*). Renvoie les cases, ou null.
 * Arriver de côté sur la dernière case compte comme un virage : le couloir entre dans la porte bien en face.
 */
function chercherChemin(depart, arrivee, dirDepart, dirArrivee, grille, largeur, longueur, coutCase) {
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
      const deCote = nx === arrivee.x && ny === arrivee.y && nd !== dirArrivee;
      const cout = couts.get(k) + 1 + (nd === dir ? 0 : COUT_VIRAGE) + (deCote ? COUT_VIRAGE : 0) + coutCase(nx, ny);
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
 * s'allonger. Les couloirs sont tracés dans l'ordre des liaisons, en évitant autant que possible ceux déjà posés ;
 * s'il reste des croisements, chacun est retracé en connaissant tous les autres, car le premier tracé ignorait les suivants.
 * Pas de chemin possible (porte murée par une salle voisine, plan immense) : le couloir garde son tracé simple.
 * Renvoie le bilan : { croisements, frottements, virages, longueur } (les cases devant les portes ne frottent pas).
 */
function tracerCouloirs(couloirs, positions, d, largeur, longueur) {
  const grille = new Uint8Array(largeur * longueur);     // 1 : une salle occupe cette case
  const proche = new Uint8Array(largeur * longueur);     // 1 : case qui touche une salle
  const sousNom = new Uint8Array(largeur * longueur);    // 1 : case où s'écrit le nom d'une salle, juste au-dessus d'elle
  const devantPorte = new Uint8Array(largeur * longueur);
  const pris = new Uint16Array(largeur * longueur);      // nombre de couloirs qui passent ici
  const indice = (x, y) => y * largeur + x;
  const dans = (x, y) => x >= 0 && y >= 0 && x < largeur && y < longueur;
  for (const [id, r] of Object.entries(positions)) {
    for (let y = r.y - 1 - HAUTEUR_NOM; y < r.y - 1; y++) {
      for (let x = r.x; x < r.x + r.largeur; x++) if (dans(x, y)) sousNom[indice(x, y)] = 1;
    }
    // Seul le sol bloque un couloir : il peut entrer dans l'entaille d'une salle en croix pour atteindre sa porte.
    const vides = casesRetirees(d.salles[id].plan);
    for (let y = 0; y < r.longueur; y++) {
      for (let x = 0; x < r.largeur; x++) {
        if (vides.has(`${x},${y}`)) continue;
        const X = r.x + x, Y = r.y + y;
        if (dans(X, Y)) grille[indice(X, Y)] = 1;
        for (let j = Y - 1; j <= Y + 1; j++) for (let i = X - 1; i <= X + 1; i++) if (dans(i, j)) proche[indice(i, j)] = 1;
      }
    }
  }
  const sorties = couloirs.flatMap((c) => [c.de, c.vers].map(caseDevant));
  for (const s of sorties) if (dans(s.x, s.y)) devantPorte[indice(s.x, s.y)] = 1;

  const trace = new Map(); // couloir → ses cases
  const marquer = (cases, n) => { for (const k of cases) pris[indice(k.x, k.y)] += n; };
  const tracer = (c) => {
    const depart = caseDevant(c.de), arrivee = caseDevant(c.vers);
    const libre = (s) => dans(s.x, s.y) && !grille[indice(s.x, s.y)];
    if (c.orpheline || !libre(depart) || !libre(arrivee)) return;
    const estExtremite = (x, y) => (x === depart.x && y === depart.y) || (x === arrivee.x && y === arrivee.y);
    const coutCase = (x, y) => {
      if (estExtremite(x, y)) return 0;
      const i = indice(x, y);
      const cole = DIRECTIONS.some(([dx, dy]) => dans(x + dx, y + dy) && pris[indice(x + dx, y + dy)]);
      return (proche[i] ? COUT_LONGE_SALLE : 0) + (sousNom[i] ? COUT_SOUS_NOM : 0) + (devantPorte[i] ? COUT_SORTIE_PORTE : 0)
        + (pris[i] ? COUT_CROISEMENT : 0) + (cole ? COUT_LONGE_COULOIR : 0);
    };
    const dirArrivee = INDICE_DIRECTION[OPPOSE[c.vers.mur]];
    const cases = chercherChemin(depart, arrivee, INDICE_DIRECTION[c.de.mur], dirArrivee, grille, largeur, longueur, coutCase);
    if (!cases) return;
    marquer(cases, 1);
    trace.set(c, cases);
    c.chemin = sansPointsAlignes([
      { x: c.de.x, y: c.de.y },
      ...cases.map((k) => ({ x: k.x + 0.5, y: k.y + 0.5 })),
      { x: c.vers.x, y: c.vers.y },
    ]);
  };
  couloirs.forEach(tracer);
  for (let passe = 1; passe < PASSES_MAX && pris.some((n) => n > 1); passe++) {
    for (const c of couloirs) {
      if (!trace.has(c)) continue;
      marquer(trace.get(c), -1);
      trace.delete(c);
      tracer(c);
    }
  }
  const bilan = { croisements: 0, frottements: 0, virages: 0, longueur: 0 };
  for (let i = 0; i < pris.length; i++) if (pris[i] > 1) bilan.croisements++;
  for (const [c, cases] of trace) {
    bilan.longueur += cases.length;
    bilan.virages += c.chemin.length - 2;
    for (const k of cases.slice(1, -1)) if (proche[indice(k.x, k.y)]) bilan.frottements++;
  }
  return bilan;
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
