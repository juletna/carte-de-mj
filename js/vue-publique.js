/**
 * Vue publique : ce que la table et l'impression « joueurs » ont le droit de montrer, et la règle qui le décide.
 * Module PUR : aucun accès au DOM ni au stockage, il se teste sous Node. N'importe PAS le parseur : l'impression
 * et la fenêtre de table en dépendent, elles n'ont pas à embarquer le code qui lit les phrases.
 *
 * Règle de visibilité à la table : `visibleATable` (secret levé et catégorie non masquée), utilisée par la vue table, l'encart
 * du plan et la régie. Elle lit les champs `reveles` et `masques` d'une partie (voir partie.js) sans jamais les modifier.
 *
 * SÉCURITÉ : `vueTable()` est la SEULE source de ce qui part vers la fenêtre ou l'écran de table.
 * Elle construit le plan à partir d'une liste blanche de champs : notes, noms, textes, éléments
 * cachés non révélés, éléments masqués, liaisons et autres salles n'y entrent jamais. L'état d'un pion (blessé, mort) est une
 * information de jeu : il y entre, au même titre que sa position.
 * `miniPlanTable()` est la seule autre source : le plan réduit aux salles découvertes, sans nom ni pion.
 * Côté fenêtre table, `recevoirVueTable`, `recevoirMiniPlan` et `recevoirCaseVisee` relisent ce qui arrive, champ par champ.
 */
import { MURS } from './murs.js';
import { validerPlan, ETATS, VERSION_PLAN } from './schema.js';
import { disposerPlan, cheminCouloir, pontsDe } from './plan-donjon.js';
import { normaliserForme, estSol } from './formes.js';

// --- Qui voit quoi ------------------------------------------------------------------------------------

/** Un élément est caché dès que son champ `cache` est vrai (lecture volontairement large). */
export const estCache = (e) => !!e?.cache;

/** Défensif comme la lecture de la vue table : une partie sans `reveles`, ou une liste qui n'en est pas une, ne révèle rien. */
export const estRevele = (p, idSalle, idElement) => Array.isArray(p.reveles?.[idSalle]) && p.reveles[idSalle].includes(idElement);

/** Le secret de cet élément est-il levé ? Il n'est pas caché, ou il l'est mais le MJ l'a révélé. */
export const estDevoile = (p, idSalle, element) => !estCache(element) || estRevele(p, idSalle, element.id);

// --- Masquage à la table ----------------------------------------------------------------------

export const estMasque = (p, idSalle, categorie) => (Array.isArray(p.masques?.[idSalle]) ? p.masques[idSalle] : []).includes(categorie);

/** La catégorie masquée qui retire cet élément de la table, ou null (une porte ou un pion de joueur n'en a jamais). */
export function categorieMasquee(p, idSalle, genre, element) {
  const categorie = genre === 'objet' ? 'objets' : genre === 'creature' && element.camp !== 'pj' ? 'monstres' : null;
  return categorie && estMasque(p, idSalle, categorie) ? categorie : null;
}

/**
 * Ce que la table montre : un élément (porte, objet ou pion) de la salle dont le secret est levé (`estDevoile`) et que le MJ
 * n'a pas masqué avec sa catégorie (`categorieMasquee`). `genre` : 'porte', 'objet' ou 'creature'.
 */
export const visibleATable = (p, idSalle, genre, element) => estDevoile(p, idSalle, element) && !categorieMasquee(p, idSalle, genre, element);

// --- Vue table : ce qui part vers l'écran des joueurs -------------------------------------------------

/**
 * Plan « public » d'une salle : ce qu'il est permis de montrer aux joueurs. Construit par LISTE BLANCHE de champs
 * (ni nom, ni description, ni notes, ni `cache`, ni champ inconnu) ; partagé par la vue table et par l'impression.
 *  - visible(e, genre) : une porte, un objet ou un pion ('porte', 'objet', 'creature') est-il montré ? (par défaut : tout ce qui n'est pas caché) ;
 *  - garder(k)   : filtre supplémentaire sur les pions (par défaut : tous) ;
 *  - avecEtat    : l'état blessé / mort d'un pion est une information de jeu (vrai pour la table, pas pour un plan imprimé).
 * @returns {object} un plan neuf, sans aucune référence vers le plan d'origine
 */
export function planPublic(plan, { visible = (e) => !estCache(e), garder = () => true, avecEtat = true } = {}) {
  const creature = (k) => ({
    id: k.id, type: k.type, camp: k.camp, x: k.x, y: k.y, taille: k.taille, numero: k.numero,
    ...(k.couleur ? { couleur: k.couleur } : {}),
    ...(avecEtat && ETATS.includes(k.etat) ? { etat: k.etat } : {}), // liste blanche : blessé ou mort, rien d'autre
  });
  return {
    version: VERSION_PLAN, id: 'table', nom: '', ...normaliserForme(plan),
    largeur: plan.largeur, longueur: plan.longueur, sol: plan.sol, entree: 'sud',
    portes: (plan.portes || []).filter((q) => visible(q, 'porte')).map((q) => ({ id: q.id, mur: q.mur, position: q.position, type: q.type })),
    objets: (plan.objets || []).filter((o) => visible(o, 'objet')).map((o) => ({ id: o.id, type: o.type, x: o.x, y: o.y, l: o.l, h: o.h, rotation: o.rotation })),
    creatures: (plan.creatures || []).filter((k) => visible(k, 'creature') && garder(k)).map(creature),
    connexions: [],
  };
}

/** Le filtre de planPublic pour ce que la table montre d'une salle : ni caché non révélé, ni catégorie masquée par le MJ. */
const filtresTable = (p, idSalle) => ({ visible: (e, genre) => visibleATable(p, idSalle, genre, e) });

/**
 * Plan de la salle courante tel que les joueurs peuvent le voir. Construit par LISTE BLANCHE (planPublic) :
 *  - rien d'autre que la salle courante (ni autres salles, ni liaisons, ni nom, ni description, ni notes) ;
 *  - aucun élément caché non révélé, portes comprises, ni aucun élément masqué par le MJ ;
 *  - aucun champ `cache` ni aucun champ inconnu (le seul ajout propre au jeu : l'état blessé / mort d'un pion).
 * @returns {object|null} un plan, ou null s'il n'y a pas de salle courante
 */
export function vueTable(p) {
  const salle = p?.donjon?.salles?.[p.salleCourante];
  const plan = salle?.plan;
  if (!plan) return null;
  return planPublic(plan, filtresTable(p, p.salleCourante));
}

/** Relit une case montrée par le MJ : une case de sol de ce plan, sinon rien. @returns {{x:number,y:number}|null} */
export function recevoirCaseVisee(brut, plan) {
  if (!plan || !Number.isInteger(brut?.x) || !Number.isInteger(brut?.y) || !estSol(plan, brut.x, brut.y)) return null;
  return { x: brut.x, y: brut.y };
}

/** La case montrée, si elle est dans la salle que voient les joueurs. @returns {{x:number,y:number}|null} */
export const caseATable = (p, caseVisee) => (p && caseVisee?.salle === p.salleCourante ? { x: caseVisee.x, y: caseVisee.y } : null);

/**
 * Ce que les joueurs connaissent du plan : les salles découvertes, les couloirs entre elles, et les portes pas encore ouvertes.
 * Une porte non ouverte est une porte visible d'une salle découverte, sans couloir connu derrière elle. Elle mène à une salle
 * non découverte, ou à rien : une porte non reliée est marquée pareil, le marquage ne dit donc pas ce qu'il y a derrière.
 * @returns {{connues:Set<string>, couloirs:object[], fermees:Array<{salle:string,mur:string,position:number}>}}
 */
function ceQuiEstConnu(p, disposition) {
  const d = p.donjon;
  const connues = new Set((p.decouvertes || []).filter((id) => id in d.salles && disposition.positions[id]));
  connues.add(p.salleCourante);
  const visible = (salle, porte) => visibleATable(p, salle, 'porte', porte);
  const porteVisible = ({ salle, mur, position }) => {
    const porte = d.salles[salle].plan.portes.find((q) => q.mur === mur && q.position === position);
    return !!porte && visible(salle, porte);
  };
  const liaisons = new Map((d.liaisons || []).map((l) => [l.id, l]));
  const montrable = (c) => {
    const l = liaisons.get(c.liaison);
    return !!l && !c.orpheline && connues.has(l.a.salle) && connues.has(l.b.salle) && porteVisible(l.a) && porteVisible(l.b);
  };
  const couloirs = disposition.couloirs.filter(montrable);
  const cle = ({ salle, mur, position }) => `${salle}|${mur}|${position}`;
  const ouvertes = new Set(couloirs.flatMap((c) => { const l = liaisons.get(c.liaison); return [cle(l.a), cle(l.b)]; }));
  const fermees = [...connues].flatMap((salle) => d.salles[salle].plan.portes
    .filter((q) => visible(salle, q) && !ouvertes.has(cle({ salle, mur: q.mur, position: q.position })))
    .map((q) => ({ salle, mur: q.mur, position: q.position })));
  return { connues, couloirs, fermees };
}

/** Portes pas encore ouvertes, pour la miniature de la régie. */
export const portesNonOuvertes = (p, disposition) => ceQuiEstConnu(p, disposition).fermees;

/**
 * L'encart de la table : le plan du donjon, dessiné comme partout (`dessinerPlanDonjon`), réduit à ce que les joueurs connaissent.
 * Seules les salles DÉCOUVERTES y sont, avec ce qu'on y voit à la table (planPublic : liste blanche, sans nom) mais sans pions :
 * ils ont pu bouger depuis. Un couloir n'y figure que si ses deux salles sont découvertes et ses deux portes visibles
 * (une porte secrète non révélée ne se devine pas). Ni identifiant, ni nom. Le cadre et les positions sont ceux du plan complet :
 * la carte se dévoile sans jamais bouger ni changer d'échelle. Les joueurs voient donc la taille totale du donjon, rien de plus.
 * @param {object} p  la présentation
 * @param {object} [disposition]  résultat de disposerPlan(p.donjon), si l'appelant l'a déjà
 * @returns {{largeur:number, longueur:number, actif:string, plans:Object<string,object>, positions:Object<string,{x,y,largeur,longueur}>,
 *            couloirs:Array<{chemin:Array<{x,y}>}>, ponts:Array<{x,y,horizontal:boolean}>,
 *            portesFermees:Array<{salle:string,mur:string,position:number}>}|null}
 */
export function miniPlanTable(p, disposition = p?.donjon?.salles ? disposerPlan(p.donjon) : null) {
  const d = p?.donjon;
  if (!d?.salles?.[p.salleCourante] || !disposition) return null;
  const { connues, couloirs: visibles, fermees } = ceQuiEstConnu(p, disposition);
  const couloirs = visibles.map((c) => ({ chemin: cheminCouloir(c).map((q) => ({ x: q.x, y: q.y })) }));
  const rects = [...connues].map((id) => ({ id, ...disposition.positions[id] }));
  const positions = {}, plans = {}, cles = new Map();
  let actif = null;
  rects.forEach((r, i) => {
    const cle = `s${i}`; // jamais l'identifiant de la salle
    cles.set(r.id, cle);
    positions[cle] = { x: r.x, y: r.y, largeur: r.largeur, longueur: r.longueur };
    plans[cle] = planPublic(d.salles[r.id].plan, { ...filtresTable(p, r.id), garder: () => false });
    if (r.id === p.salleCourante) actif = cle;
  });
  const portesFermees = fermees.map((q) => ({ salle: cles.get(q.salle), mur: q.mur, position: q.position }));
  return { largeur: disposition.largeur, longueur: disposition.longueur, actif, plans, positions, couloirs, ponts: pontsDe(couloirs), portesFermees };
}

/**
 * Côté fenêtre table : relit un encart reçu, champ par champ, et chaque salle comme une vue de table. Le moindre écart : pas d'encart.
 * @returns {object|null}  { donjon, disposition, actif, portesFermees }, prêts pour `dessinerPlanDonjon`
 */
export function recevoirMiniPlan(brut) {
  const n = (v) => Number.isFinite(v) && v >= 0;
  const objet = (v) => !!v && typeof v === 'object';
  if (!objet(brut) || !n(brut.largeur) || !n(brut.longueur) || !objet(brut.positions) || !objet(brut.plans) || !Array.isArray(brut.couloirs) || !Array.isArray(brut.ponts)) return null;
  if (typeof brut.actif !== 'string' || !(brut.actif in brut.positions)) return null;
  const point = (q) => objet(q) && n(q.x) && n(q.y);
  if (!brut.couloirs.every((c) => Array.isArray(c?.chemin) && c.chemin.every(point)) || !brut.ponts.every(point)) return null;
  const fermeesBrutes = Array.isArray(brut.portesFermees) ? brut.portesFermees : [];
  if (!fermeesBrutes.every((q) => objet(q) && Object.hasOwn(brut.positions, q.salle) && MURS.includes(q.mur) && Number.isInteger(q.position) && q.position >= 0)) return null;
  const positions = {}, salles = {};
  for (const [cle, r] of Object.entries(brut.positions)) {
    if (!/^s\d+$/.test(cle) || !objet(r) || !n(r.x) || !n(r.y) || !n(r.largeur) || !n(r.longueur)) return null;
    const plan = recevoirVueTable(brut.plans[cle]);
    if (!plan) return null;
    positions[cle] = { x: r.x, y: r.y, largeur: r.largeur, longueur: r.longueur };
    salles[cle] = { nom: '', plan: { ...plan, creatures: [] } };
  }
  return {
    actif: brut.actif,
    portesFermees: fermeesBrutes.map((q) => ({ salle: q.salle, mur: q.mur, position: q.position })),
    donjon: { salles },
    disposition: {
      largeur: brut.largeur, longueur: brut.longueur, positions, isolees: [], etiquetteIsolees: null,
      couloirs: brut.couloirs.map((c) => ({ chemin: c.chemin.map((q) => ({ x: q.x, y: q.y })) })),
      ponts: brut.ponts.map((q) => ({ x: q.x, y: q.y, horizontal: q.horizontal === true })),
    },
  };
}

/**
 * Côté fenêtre table : relit un plan reçu avec les mêmes règles que le reste de l'outil, et par
 * précaution écarte tout élément marqué caché (la régie n'en envoie jamais).
 * @returns {object|null}
 */
export function recevoirVueTable(brut) {
  const { plan } = validerPlan(brut);
  if (!plan) return null;
  const sans = (liste) => liste.filter((e) => !estCache(e));
  return { ...plan, nom: '', connexions: [], portes: sans(plan.portes), objets: sans(plan.objets), creatures: sans(plan.creatures) };
}
