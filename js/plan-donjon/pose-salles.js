/**
 * Plan du donjon, la pose des salles : où chaque salle se place par rapport à celle d'où l'on vient, dans quel ordre,
 * et comment les groupes de salles (composantes) et les salles isolées s'assemblent en un seul plan. Tout se compte en cases,
 * dans un repère qui commence à (0, 0) ; les règles sont décrites dans l'en-tête de plan-donjon.js. Module feuille (murs.js seul).
 */
import { OPPOSE, longueurMur } from '../murs.js';

export const ECART_LIAISON = 3;   // cases entre les murs de deux salles reliées
export const ECART_MIN = 2;       // cases libres minimum entre deux salles quelconques, côte à côte
export const ECART_MIN_NOM = 3;   // la même chose l'une au-dessus de l'autre : le nom de celle du dessous s'écrit entre les deux
export const ECART_PASSAGE = 5;   // cases de chaque côté d'une salle insérée : passage d'un couloir + deux cases libres de part et d'autre

const BOUCLES_PAR_SALLE_1 = 1 / 3; // à partir de ce nombre de boucles par salle, 1 case de plus entre les salles
const BOUCLES_PAR_SALLE_2 = 2 / 3; // à partir de celui-ci, 2 cases de plus
const GLISSEMENT_MAX = 5;         // cases dont une salle peut glisser pour libérer le couloir droit d'une porte voisine
const GLISSEMENTS = Array.from({ length: 2 * GLISSEMENT_MAX + 1 }, (_, i) => (i % 2 ? (i + 1) / 2 : -i / 2)); // 0, 1, -1, 2, -2…
const LIBRE_COULOIR = 2;          // cases libres entre le couloir droit et la salle qui glisse
const LIBRE_NOM = 3;              // cases libres si le couloir passe au-dessus de la salle : son nom s'écrit là
const ECART_BLOCS = 4;            // cases entre deux blocs de salles (et avant la rangée des non reliées)
const ECART_RANGEE = 2;           // cases entre deux salles de la rangée des non reliées
const LARGEUR_RANGEE_MIN = 24;    // la rangée des non reliées passe à la ligne au-delà de cette largeur (ou celle du plan)

const dimensions = (s) => ({ l: Math.max(1, s?.plan?.largeur | 0 || 1), h: Math.max(1, s?.plan?.longueur | 0 || 1) });
export const borner = (v, min, max) => Math.max(min, Math.min(max, v));

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
  const p = borner(ici.position | 0, 0, longueurMur(mur, dimA.l, dimA.h) - 1);
  const q = borner(autre.position | 0, 0, longueurMur(autre.mur, dimB.l, dimB.h) - 1);
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
  let ligne = autre.mur === OPPOSE[mur] ? A[cote] + borner(ici.position | 0, 0, longueurMur(mur, A.l, A.h) - 1) : null;
  const barreRang = (o, rang) => rang > o[cote] - 2 && rang <= o[cote] + o[tailleCote];
  const barreLigne = (o) => ligne === null || barreRang(o, ligne);
  const devantA = liste.filter((o) => o !== A && sortie(o) > sortie(A));
  // Les couloirs droits voisins qui passeraient là où B se pose : leur salle est déjà posée plus loin, et rien ne les barre.
  // (Une salle pas encore posée ne compte pas : sinon les deux salles glisseraient, et aucune porte ne ferait plus face.)
  const rangs = autres.flatMap(({ vers, ici: porte }) => {
    const cible = rects[vers];
    if (!cible || sortie(cible) <= entree(r)) return [];
    const rang = A[cote] + borner(porte.position | 0, 0, longueurMur(mur, A.l, A.h) - 1);
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
export function generateur(graine) {
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

/** Cases à ajouter entre les salles, selon le nombre de boucles par salle (composantes séparées comprises). */
export function espaceDuDonjon(d, ids) {
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
 * Pose toutes les salles : chaque composante à partir de sa première salle (ordre des liaisons, ou mélangé par `alea`), les blocs
 * l'un sous l'autre, puis la rangée des salles isolées. Rien n'est encore décalé pour les couloirs.
 * @returns {{rects:Object<string,{x:number,y:number,l:number,h:number}>, isolees:string[], etiquetteIsolees:{x:number,y:number}|null, droite:number, bas:number}}
 */
export function poserSalles(d, ids, espace, alea) {
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
  return { rects, isolees, etiquetteIsolees, droite, bas };
}
