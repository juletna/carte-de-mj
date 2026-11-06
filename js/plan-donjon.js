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
 *
 * Ce fichier est la façade : `disposerPlan` y assemble le tout, et tout ce qui s'importait de lui s'importe encore de lui.
 * Le détail est dans js/plan-donjon/ :
 *  - pose-salles.js  où va chaque salle (portes face à face, glissement, salle insérée), les blocs et la rangée des isolées ;
 *  - couloirs.js     le point des portes, une ligne par liaison, le tracé simple d'un couloir, les ponts ;
 *  - routage.js      le tracé des couloirs autour des salles (A*) et le bilan qui note un plan.
 */

import { ECART_LIAISON, ECART_MIN, ECART_MIN_NOM, ECART_PASSAGE, espaceDuDonjon, generateur, poserSalles } from './plan-donjon/pose-salles.js';
import { PONT_DEMI_LONGUEUR, cheminCouloir, lignesDeLiaisons, pontsDe } from './plan-donjon/couloirs.js';
import { tracerCouloirs } from './plan-donjon/routage.js';
import { estEscalier, niveaux, nomNiveau } from './niveaux.js';

// Ce que le plan expose, avec ce qu'il avait avant le découpage.
export { ECART_LIAISON, ECART_MIN, ECART_MIN_NOM, ECART_PASSAGE, PONT_DEMI_LONGUEUR, cheminCouloir, pontsDe };

export const MARGE_PLAN = 2;      // cases autour de l'ensemble (noms au-dessus des salles du haut, murs, couloirs)
export const ETIQUETTE_ISOLEES = 'Salles non reliées';

const MARGE_ROUTAGE = 8;          // cases où un couloir peut sortir de l'ensemble des salles : le plan s'agrandit d'autant
const ESSAIS_MAX = 8;             // dispositions essayées au plus : au-delà, on ne gagne presque plus rien
const SALLES_ESSAIS = 240;        // au-delà de 30 salles, moins d'essais (salles × essais), pour ne pas faire attendre
const NOTE_CROISEMENT = 20;      // poids dans la note d'un plan : une case partagée par deux couloirs,
const NOTE_FROTTEMENT = 3;       // une case de couloir contre une salle,
const NOTE_VIRAGE = 1;           // un virage,
const NOTE_LONGUEUR = 0.2;       // une case de couloir

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

  // Un escalier n'est pas un couloir : il change de niveau. Chaque niveau a son plan, le plus haut en premier, l'un sous l'autre.
  const niv = niveaux(d);
  const parNiveau = [...new Set(ids.map((id) => niv[id]))].sort((a, b) => b - a);
  const liaisonsPortes = (d.liaisons || []).filter((l) => !estEscalier(l.a));
  if (parNiveau.length === 1) return disposerNiveau({ ...d, liaisons: liaisonsPortes }, ids);

  // `etiquettes` n'existe que sur plusieurs niveaux : le nom de chaque niveau, et l'étiquette de ses salles en rangée.
  const plan = { positions: {}, largeur: 0, longueur: 0, couloirs: [], ponts: [], isolees: [], etiquetteIsolees: null, etiquettes: [] };
  const reliees = new Set((d.liaisons || []).flatMap((l) => [l.a.salle, l.b.salle]));
  let y0 = 0;
  for (const n of parNiveau) {
    const dedans = ids.filter((id) => niv[id] === n);
    const salles = Object.fromEntries(dedans.map((id) => [id, d.salles[id]]));
    const liaisons = liaisonsPortes.filter((l) => l.a.salle in salles && l.b.salle in salles);
    const p = disposerNiveau({ ...d, salles, liaisons }, dedans);
    const dy = y0 + HAUTEUR_NIVEAU;
    const glisser = (o) => { o.y += dy; };
    Object.values(p.positions).forEach(glisser);
    for (const c of p.couloirs) { glisser(c.de); glisser(c.vers); (c.chemin || []).forEach(glisser); }
    p.ponts.forEach(glisser);
    Object.assign(plan.positions, p.positions);
    plan.couloirs.push(...p.couloirs);
    plan.ponts.push(...p.ponts);
    plan.isolees.push(...p.isolees);
    plan.etiquettes.push({ texte: nomNiveau(n), x: MARGE_PLAN, y: y0 + 1, niveau: n });
    if (p.etiquetteIsolees) {
      // Dans un niveau, une salle sans porte reliée peut tenir par son seul escalier : elle n'est pas « non reliée ».
      const texte = p.isolees.some((id) => !reliees.has(id)) ? ETIQUETTE_ISOLEES : ETIQUETTE_PAR_ESCALIER;
      plan.etiquettes.push({ texte, x: p.etiquetteIsolees.x, y: p.etiquetteIsolees.y + dy });
    }
    plan.largeur = Math.max(plan.largeur, p.largeur);
    y0 = dy + p.longueur;
  }
  plan.longueur = y0;
  plan.largeur = Math.max(plan.largeur, LARGEUR_NIVEAUX_MIN);
  return plan;
}

const HAUTEUR_NIVEAU = 3;         // cases au-dessus du plan d'un niveau, pour écrire son nom
const LARGEUR_NIVEAUX_MIN = 14;   // cases : de quoi écrire « REZ-DE-CHAUSSÉE » au-dessus d'un donjon étroit
export const ETIQUETTE_PAR_ESCALIER = 'Salles reliées par un escalier';

/** Le plan d'un seul niveau (les liaisons de `d` sont celles de ses portes) : plusieurs essais, le meilleur gardé. */
function disposerNiveau(d, ids) {
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
  // Les escaliers font les niveaux : leur case et leur sens comptent aussi.
  const salles = Object.values(d.salles).map((s) => [s.id, s.plan.largeur, s.plan.longueur, s.plan.forme, s.plan.bras, s.plan.position, s.plan.portes,
    s.plan.objets.filter((o) => o.type === 'escalier').map((o) => [o.x, o.y, o.sens])]);
  return JSON.stringify([salles, d.liaisons]);
}

/** Un plan selon un ordre de pose (`alea` : null pour l'ordre des liaisons), avec sa note : plus elle est basse, mieux c'est. */
function calculerPlan(d, ids, espace, alea) {
  const { rects, isolees, etiquetteIsolees: etiquette, droite, bas } = poserSalles(d, ids, espace, alea);
  let etiquetteIsolees = etiquette;

  // De la place tout autour pour tracer les couloirs ; le plan sera recadré sur ce qui est réellement dessiné.
  const positions = {};
  for (const id of ids) {
    const r = rects[id];
    positions[id] = { x: r.x + MARGE_ROUTAGE, y: r.y + MARGE_ROUTAGE, largeur: r.l, longueur: r.h };
  }
  if (etiquetteIsolees) etiquetteIsolees = { x: etiquetteIsolees.x + MARGE_ROUTAGE, y: etiquetteIsolees.y + MARGE_ROUTAGE };

  // Couloirs : une ligne par liaison dont les deux salles existent (porte disparue ou non).
  const couloirs = lignesDeLiaisons(d, positions);

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
