/**
 * Poser et retirer un élément sur un plan : règles PURES (aucun DOM), testables sous Node.
 *
 * Ce module est la règle unique de « où peut-on poser quelque chose » :
 *  - deplacement.js s'en sert quand on lâche un pion, un objet ou une porte déplacé ;
 *  - la palette du Donjon s'en sert pour AJOUTER un élément (par un clic ou un glisser-déposer) ;
 *  - les commandes à la volée (parseur/commandes.js) et le placement du groupe qui passe une porte (passage.js) en reprennent
 *    les règles de pose et le test de chevauchement (`seChevauchent`).
 * Rien ici n'écrit la description : l'appelant passe le plan obtenu à decrire(), puis à analyser().
 *
 * Coordonnées : en cases, x de l'ouest vers l'est, y du nord vers le sud (voir schema.js).
 */
import { PORTES, definition, nomAffiche } from './parseur/lexique.js';
import { OBJETS, CREATURES } from './catalogue.js';
import { nomCase } from './coordonnees.js';
import { normaliserForme, surLeSol } from './formes.js';
import { REGARD, REGARD_VERS, estHorizontal, longueurMur, murEntree } from './murs.js';
import { CASES_MAX, LISTES } from './schema.js';
import { sansAccents } from './format.js';

/** Marge tolérée autour de la salle pour viser un mur avec une porte, en cases. */
const MARGE_PORTE = 1;

export const largeurDe = (e) => e.taille ?? e.l;
export const hauteurDe = (e) => e.taille ?? e.h;
/** Deux éléments (ou rectangles { x, y, l, h }) occupent-ils au moins une case en commun ? Le seul test de chevauchement du site. */
export const seChevauchent = (a, b) => a.x < b.x + largeurDe(b) && b.x < a.x + largeurDe(a)
  && a.y < b.y + hauteurDe(b) && b.y < a.y + hauteurDe(a);

/** Mur le plus proche d'un point exprimé en cases. */
export function murProche(cx, cy, plan) {
  const distances = { nord: cy, sud: plan.longueur - cy, ouest: cx, est: plan.largeur - cx };
  return Object.keys(distances).reduce((a, b) => (distances[b] < distances[a] ? b : a));
}

/** Position sur un mur la plus proche d'un point, sans sortir du mur. */
export function positionSurMur(mur, cx, cy, plan) {
  const horizontal = estHorizontal(mur);
  const long = longueurMur(mur, plan.largeur, plan.longueur);
  return Math.max(0, Math.min(long - 1, Math.floor(horizontal ? cx : cy)));
}

/**
 * Un objet ou un pion de dimensions `el` peut-il se poser avec son coin nord-ouest en (x, y) ?
 * `ignorer` : l'élément déplacé lui-même (il ne se gêne pas), ou null pour un ajout.
 * Règles : dans la pièce ; un pion peut monter sur un objet, pas sur un autre pion ; un objet ne se pose ni sur un objet
 * bloquant ni sur un pion ; une torche (non bloquante) se pose sur un mur, dos au mur le plus proche.
 * @returns {{ok:true, modifs:object}|{ok:false, raison:'hors'}|{ok:false, raison:'gene', gene:{genre:'objet'|'creature', element:object}}}
 *   `gene` : le premier élément qui gêne (les objets d'abord, puis les pions), pour que l'appelant puisse le citer.
 */
export function evaluerPose(plan, genre, el, x, y, ignorer = null) {
  if (!surLeSol(plan, x, y, largeurDe(el), hauteurDe(el))) return { ok: false, raison: 'hors' };
  const creatures = plan.creatures || [];
  const cible = { ...el, x, y }; // l'élément à la place visée
  if (genre === 'creature') {
    const pion = creatures.find((k) => k !== ignorer && seChevauchent(cible, k));
    return pion ? { ok: false, raison: 'gene', gene: { genre: 'creature', element: pion } } : { ok: true, modifs: { x, y } };
  }
  if (definition(el.type).bloquant === false) {
    return { ok: true, modifs: { x, y, rotation: REGARD[murProche(x + 0.5, y + 0.5, plan)] } };
  }
  const objet = plan.objets.find((o) => o !== ignorer && definition(o.type).bloquant !== false && seChevauchent(cible, o));
  if (objet) return { ok: false, raison: 'gene', gene: { genre: 'objet', element: objet } };
  const pion = creatures.find((k) => seChevauchent(cible, k));
  if (pion) return { ok: false, raison: 'gene', gene: { genre: 'creature', element: pion } };
  return { ok: true, modifs: { x, y } };
}

// --- Éléments proposés par la palette ---------------------------------------------------

/** Libellé français d'un type, avec une majuscule (« bibliotheque » → « Bibliothèque »). */
const libelle = (type) => { const n = nomAffiche(type); return n.charAt(0).toUpperCase() + n.slice(1); };
const LIBELLES_PORTES = { porte: 'Porte', herse: 'Herse', arche: 'Arche' };

/**
 * Tout ce que la palette propose, tiré du lexique : { groupe, genre, type, libelle }.
 * Groupes : 'portes', 'mobilier', 'creatures'. Ajouter un type au catalogue (catalogue.js) l'ajoute ici.
 */
export function elementsPalette() {
  const motsDePorte = (type) => Object.entries(PORTES).filter(([, t]) => t === type).map(([m]) => m);
  const portes = [...new Set(Object.values(PORTES))].map((type) => ({ groupe: 'portes', genre: 'porte', type, libelle: LIBELLES_PORTES[type] || libelle(type), mots: motsDePorte(type) }));
  const objets = OBJETS.map((d) => ({ groupe: 'mobilier', genre: 'objet', type: d.type, libelle: libelle(d.type), mots: d.mots }));
  const creatures = CREATURES.map((d) => ({ groupe: 'creatures', genre: 'creature', type: d.type, libelle: libelle(d.type), mots: d.mots, sousGroupe: d.camp }));
  return [...portes, ...objets, ...creatures];
}

export const GROUPES_PALETTE = [
  { id: 'portes', titre: 'Portes' },
  { id: 'mobilier', titre: 'Mobilier' },
  { id: 'creatures', titre: 'Créatures' },
];

/** Intertitres d'un groupe, dans l'ordre d'affichage : les créatures sont rangées par camp (`sousGroupe`). */
export const SOUS_GROUPES = {
  creatures: [
    { id: 'monstre', titre: 'Monstres' },
    { id: 'pnj', titre: 'Peuples' },
    { id: 'pj', titre: 'Personnage' },
  ],
};

/**
 * Éléments de la palette qui répondent à une recherche : chaque mot saisi doit se retrouver dans le libellé, le type
 * ou l'un des mots du lexique (sans accents ni casse : « orc » trouve l'orque). Recherche vide : tout.
 */
export function filtrerElements(elements, requete) {
  const mots = sansAccents(requete).split(/\s+/).filter(Boolean);
  if (!mots.length) return elements;
  return elements.filter((e) => {
    const botte = [e.libelle, e.type, ...(e.mots || [])].map(sansAccents).join(' | ');
    return mots.every((m) => botte.includes(m));
  });
}

// --- Ajouter ---------------------------------------------------------------------------

/** Identifiant libre de la forme « o7 », « c3 », « p2 » dans une liste d'éléments. */
function idLibre(liste, prefixe) {
  const pris = new Set(liste.map((e) => e.id));
  let n = liste.length + 1;
  while (pris.has(`${prefixe}${n}`)) n++;
  return `${prefixe}${n}`;
}

const MESSAGES = {
  hors: 'Pose impossible : ce point est hors de la salle. Vise une case de la grille.',
  gene: 'Pose impossible : la place est déjà prise. Choisis une case libre.',
  hors_mur: 'Pose impossible : vise le bord de la salle pour poser une porte sur un mur.',
  porte_prise: 'Pose impossible : il y a déjà une porte à cet endroit du mur.',
  inconnu: 'Pose impossible : élément inconnu.',
};

/**
 * Ajoute un élément au plan, au point visé (en cases, éventuellement fractionnaire : le coin de l'élément est
 * calé pour que le point tombe en son centre).
 * @param {object} plan
 * @param {{genre:'porte'|'objet'|'creature', type:string}} item  ce qu'on pose (voir elementsPalette)
 * @param {number} cx  point visé, colonne en cases (2,5 = milieu de la case C)
 * @param {number} cy  point visé, rangée en cases
 * @returns {{plan:object, element:object, genre:string, message:string}|{erreur:string}}
 *   `plan` est une copie : le plan reçu n'est pas modifié. `message` décrit la pose réussie.
 */
export function ajouterElement(plan, item, cx, cy) {
  if (item.genre === 'porte') {
    if (!Object.values(PORTES).includes(item.type)) return { erreur: MESSAGES.inconnu };
    if (cx < -MARGE_PORTE || cy < -MARGE_PORTE || cx > plan.largeur + MARGE_PORTE || cy > plan.longueur + MARGE_PORTE) return { erreur: MESSAGES.hors_mur };
    const mur = murProche(cx, cy, plan);
    const position = positionSurMur(mur, cx, cy, plan);
    if (plan.portes.some((p) => p.mur === mur && p.position === position)) return { erreur: MESSAGES.porte_prise };
    const element = { id: idLibre(plan.portes, 'p'), mur, position, type: item.type };
    return { plan: { ...plan, portes: [...plan.portes, element] }, element, genre: 'porte', message: `${LIBELLES_PORTES[item.type] || item.type} posée sur le mur ${mur}.` };
  }

  const def = definition(item.type);
  if (!def || def.genre !== item.genre) return { erreur: MESSAGES.inconnu };
  const l = def.l, h = def.h;
  const x = Math.round(cx - l / 2), y = Math.round(cy - h / 2);

  if (item.genre === 'creature') {
    const creatures = plan.creatures || [];
    const modele = { taille: l };
    const pose = evaluerPose(plan, 'creature', modele, x, y);
    if (!pose.ok) return { erreur: MESSAGES[pose.raison] };
    // Numéro : à la suite des pions du même type (jamais un numéro déjà pris, même si un pion a été retiré).
    const numero = Math.max(0, ...creatures.filter((k) => k.type === def.type).map((k) => k.numero || 0)) + 1;
    const element = { id: idLibre(creatures, 'c'), type: def.type, camp: def.camp, x, y, taille: l, numero };
    return { plan: { ...plan, creatures: [...creatures, element] }, element, genre: 'creature', message: `${libelle(def.type)} ${numero} posé en ${nomCase(x, y)}.` };
  }

  const modele = { type: def.type, l, h };
  const pose = evaluerPose(plan, 'objet', modele, x, y);
  if (!pose.ok) return { erreur: MESSAGES[pose.raison] };
  const rotation = pose.modifs.rotation ?? REGARD_VERS[murEntree(plan)];
  const element = { id: idLibre(plan.objets, 'o'), type: def.type, x, y, l, h, rotation };
  return { plan: { ...plan, objets: [...plan.objets, element] }, element, genre: 'objet', message: `${libelle(def.type)} posé en ${nomCase(x, y)}.` };
}

// --- Retirer ---------------------------------------------------------------------------

/**
 * Copie du plan sans l'élément trouvé par `retrouverElement` ({ genre, liste, index }). Les numéros des autres pions ne
 * changent pas ici : c'est la relecture de la description (decrire → analyser) qui les renumérote.
 */
export function retirerElement(plan, trouve) {
  if (!trouve || !LISTES[trouve.genre]) return null;
  const liste = LISTES[trouve.genre];
  return { ...plan, [liste]: plan[liste].filter((_, i) => i !== trouve.index) };
}

// --- Dimensions de la salle ---------------------------------------------------------

/**
 * Agrandit (delta > 0) ou réduit (delta < 0) la salle du côté demandé, de `delta` rangées de cases.
 * Le mur bouge, tout le reste garde sa place dans la salle : au nord et à l'ouest, les éléments sont donc décalés.
 * Une porte reste sur son mur. On refuse de réduire si un objet, un pion ou une porte se retrouverait hors de la salle.
 * @returns {{plan:object}|{erreur:string}}
 */
export function redimensionner(plan, cote, delta) {
  const horizontal = estHorizontal(cote); // ces côtés changent la longueur
  const dimension = horizontal ? plan.longueur : plan.largeur;
  const cible = dimension + delta;
  if (cible < 1) return { erreur: 'La salle ne peut pas être plus petite.' };
  if (cible > CASES_MAX) return { erreur: `La salle ne peut pas dépasser ${CASES_MAX} cases.` };
  const dx = cote === 'ouest' ? delta : 0, dy = cote === 'nord' ? delta : 0;
  const largeur = plan.largeur + (horizontal ? 0 : delta), longueur = plan.longueur + (horizontal ? delta : 0);
  const creatures = plan.creatures || [];
  const decale = (e) => ({ ...e, x: e.x + dx, y: e.y + dy });
  const dehors = (e) => e.x < 0 || e.y < 0 || e.x + largeurDe(e) > largeur || e.y + hauteurDe(e) > longueur;
  const gene = [...plan.objets, ...creatures].find((e) => dehors(decale(e)));
  if (gene) return { erreur: `Impossible de réduire : ${nomAffiche(gene.type)} en ${nomCase(gene.x, gene.y)}.` };
  // Le long de son mur, une porte se décale comme le reste ; le mur où elle se trouve ne change pas.
  const portes = plan.portes.map((p) => ({ ...p, position: p.position + (estHorizontal(p.mur) ? dx : dy) }));
  const porteDehors = portes.find((p) => p.position < 0 || p.position >= longueurMur(p.mur, largeur, longueur));
  if (porteDehors) return { erreur: `Impossible de réduire : une ${porteDehors.type} au mur ${porteDehors.mur} serait hors de la salle.` };
  return recaler({ ...plan, largeur, longueur, portes, objets: plan.objets.map(decale), creatures: creatures.map(decale) });
}

/**
 * Remet sur le sol ce qui se retrouve sur une case retirée : à la case libre la plus proche où il peut se poser.
 * @returns {{plan:object, deplaces:number}|{erreur:string}}
 */
function recaler(plan) {
  let courant = plan, deplaces = 0;
  for (const [genre, liste] of [['objet', 'objets'], ['creature', 'creatures']]) {
    for (const e of plan[liste] || []) {
      if (surLeSol(plan, e.x, e.y, largeurDe(e), hauteurDe(e))) continue;
      const place = caseLaPlusProche(courant, genre, e);
      if (!place) return { erreur: `Plus de place pour : ${nomAffiche(e.type)} en ${nomCase(e.x, e.y)}.` };
      courant = { ...courant, [liste]: courant[liste].map((o) => (o === e || o.id === e.id ? { ...o, ...place } : o)) };
      deplaces++;
    }
  }
  return { plan: courant, deplaces };
}

function caseLaPlusProche(plan, genre, e) {
  let meilleur = null, distance = Infinity;
  for (let y = 0; y < plan.longueur; y++) for (let x = 0; x < plan.largeur; x++) {
    const d = Math.hypot(x - e.x, y - e.y);
    if (d >= distance) continue;
    const pose = evaluerPose(plan, genre, e, x, y, e);
    if (pose.ok) { meilleur = pose.modifs; distance = d; }
  }
  return meilleur;
}

/**
 * Change la forme de la salle (champs : forme, bras, position). Ce qui tombe sur une case retirée se pousse à côté.
 * @returns {{plan:object, deplaces:number}|{erreur:string}}
 */
export function changerForme(plan, champs) {
  const { forme, bras, position, ...reste } = plan;
  return recaler({ ...reste, ...normaliserForme(champs) });
}
