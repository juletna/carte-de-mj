/**
 * Modèle d'un donjon : plusieurs salles reliées par leurs portes.
 * Module PUR : aucun accès au DOM ni au stockage, il se teste sous Node.
 *
 * {
 *   format: 'carte-de-mj-donjon', version: 1,
 *   id, nom, salleActive,
 *   salles:   { <id>: { id, nom, texte, plan, notes } },
 *   liaisons: [{ id, a: {salle, mur, position}, b: {salle, mur, position} }]
 * }
 *
 * La validation d'un donjon venu de l'extérieur (`validerDonjon`) et l'import d'un fichier (`convertirImport`) sont dans
 * donjon-validation.js, qui lit ce module : rien ici ne l'importe.
 *
 * La description (`texte`) reste la seule référence d'une salle : `plan` en est
 * la lecture par analyser(). `notes` est le carnet du MJ, jamais réécrit.
 *
 * ATTENTION : les identifiants de portes du plan (p1, p2…) sont régénérés à chaque
 * relecture du texte. Une liaison désigne donc une porte par SALLE + MUR + POSITION,
 * jamais par son id. Si la porte disparaît après une retouche du texte, la liaison
 * devient « orpheline » : elle est signalée, jamais supprimée en silence.
 *
 * Préparation d'un éventuel jeu en ligne (rien n'est construit pour lui) :
 * identifiants stables et uniques, éléments secrets marqués `cache: true` dans les
 * plans, format versionné.
 */
import { LISTES } from './schema.js';
import { MURS, OPPOSE, longueurMur } from './murs.js';
import { analyser } from './parseur/index.js';
import { decrire } from './parseur/decrire.js';
import { retirerElement } from './pose.js';
import { ECHELLE_PAR_DEFAUT } from './affichage.js';

export const FORMAT = 'carte-de-mj-donjon';
export const FORMAT_ANCIEN = 'jdr-carte';
export const VERSION = 1;
export const TEXTE_SALLE_VIDE = 'Salle de 8 par 8 cases.';
export const COTE_NOUVELLE_SALLE = 6;

export const MAX_SALLES = 200;
export const LIMITES = { nom: 80, texte: 20000, notes: 20000 };

/** Objet sans prototype : une clé comme « __proto__ » venue d'un fichier n'a aucun effet. */
export const dictionnaire = () => Object.create(null);
export const coupe = (v, max) => String(v ?? '').slice(0, max);

/** Identifiant unique (stable ensuite) : préfixe + 6 caractères au hasard, absent de `existants`. */
export function idUnique(prefixe, existants = []) {
  const pris = new Set(existants);
  let id;
  do id = `${prefixe}-${Math.random().toString(36).slice(2, 8).padEnd(6, '0')}`; while (pris.has(id));
  return id;
}

// --- Plans -------------------------------------------------------------------

/** Lit un texte en plan, en donnant au plan l'identifiant de la salle. */
export function planDepuisTexte(texte, idSalle, echelle = ECHELLE_PAR_DEFAUT) {
  const { plan } = analyser(texte, { echelle });
  return { ...plan, id: idSalle };
}

/** Descripteur d'un élément, indépendant des identifiants du plan (qui changent à chaque relecture). */
export function descripteur(genre, e) {
  return genre === 'porte' ? { genre, mur: e.mur, position: e.position } : { genre, type: e.type, x: e.x, y: e.y };
}
const memeDescripteur = (a, b) => !!a && !!b && a.genre === b.genre && (a.genre === 'porte'
  ? a.mur === b.mur && a.position === b.position
  : a.type === b.type && a.x === b.x && a.y === b.y);
export { memeDescripteur };

/** Retrouve l'élément décrit dans le plan : { genre, liste, index, element } ou null. */
export function retrouverElement(plan, desc) {
  if (!plan || !desc || !LISTES[desc.genre]) return null;
  const liste = LISTES[desc.genre];
  const index = (plan[liste] || []).findIndex((e) => memeDescripteur(descripteur(desc.genre, e), desc));
  return index < 0 ? null : { genre: desc.genre, liste, index, element: plan[liste][index] };
}

/** Copie du plan où l'élément décrit est caché (ou redevient visible). */
export function basculerCache(plan, desc) {
  const trouve = retrouverElement(plan, desc);
  if (!trouve) return null;
  const { liste, index, element } = trouve;
  const { cache, ...sans } = element;
  const nouveau = cache === true ? sans : { ...sans, cache: true };
  return { ...plan, [liste]: plan[liste].map((e, i) => (i === index ? nouveau : e)) };
}

/**
 * L'élément qui a bougé entre deux plans issus l'un de l'autre (mêmes identifiants).
 * @returns {{genre:string, avant:object, apres:object}|null}
 */
export function elementDeplace(ancien, nouveau) {
  for (const genre of Object.keys(LISTES)) {
    const liste = LISTES[genre];
    for (const e of nouveau[liste] || []) {
      const avant = (ancien[liste] || []).find((o) => o.id === e.id);
      if (avant && !memeDescripteur(descripteur(genre, avant), descripteur(genre, e))) {
        return { genre, avant: descripteur(genre, avant), apres: descripteur(genre, e) };
      }
    }
  }
  return null;
}

// --- Supprimer un élément (bulle d'actions) ------------------------------------------------------

/**
 * Plan de la salle sans l'élément décrit. Une porte reliée perd d'abord sa liaison (jamais de liaison orpheline
 * créée par une suppression) : la liaison retirée est renvoyée pour pouvoir être rétablie par `retablirLiaisons`.
 * Le donjon n'est modifié que par cette suppression de liaison ; le plan reçu ne l'est jamais.
 * @returns {{plan:object, liaisonsRetirees:object[]}|null}  null si l'élément n'existe pas
 */
export function supprimerElement(d, idSalle, desc) {
  const s = d.salles[idSalle];
  const trouve = s && retrouverElement(s.plan, desc);
  if (!trouve) return null;
  const liaisonsRetirees = [];
  if (trouve.genre === 'porte') {
    const lien = liaisonDePorte(d, idSalle, trouve.element);
    if (lien) { liaisonsRetirees.push(lien.liaison); delier(d, lien.liaison.id); }
  }
  return { plan: retirerElement(s.plan, trouve), liaisonsRetirees };
}

/** Remet des liaisons retirées par supprimerElement (annulation), sauf celles que le donjon a déjà retrouvées. */
export function retablirLiaisons(d, liaisons) {
  for (const l of liaisons || []) {
    if (d.liaisons.some((x) => x.id === l.id) || !d.salles[l.a.salle] || !d.salles[l.b.salle]) continue;
    d.liaisons.push(l);
  }
}

// --- Création et gestion des salles --------------------------------------------

export function nomParDefaut(d, plan) {
  if (plan?.nom && plan.nom !== 'Salle') return plan.nom;
  return `Salle ${Object.keys(d.salles).length + 1}`;
}

/**
 * Nouveau donjon d'une salle.
 * @param {{nom?:string, texte?:string, plan?:object, echelle?:number}} options
 *        `plan` sans `texte` : la description est écrite par decrire().
 */
export function creerDonjon({ nom = 'Donjon', texte, plan, echelle } = {}) {
  const d = { format: FORMAT, version: VERSION, id: idUnique('donjon'), nom: coupe(nom, LIMITES.nom) || 'Donjon', salleActive: null, salles: dictionnaire(), liaisons: [] };
  ajouterSalle(d, { texte, plan, echelle, activer: true });
  return d;
}

/** Ajoute une salle (isolée, non reliée). Renvoie la salle. */
export function ajouterSalle(d, { nom, texte, plan, notes = '', echelle, activer = false } = {}) {
  const id = idUnique('s', Object.keys(d.salles));
  let t = texte;
  let p = plan ? { ...plan, id } : null;
  if (typeof t !== 'string') t = p ? decrire(p) : TEXTE_SALLE_VIDE;
  if (!p) p = planDepuisTexte(t, id, echelle);
  const salle = { id, nom: coupe(nom || nomParDefaut(d, p), LIMITES.nom), texte: coupe(t, LIMITES.texte), plan: p, notes: coupe(notes, LIMITES.notes) };
  d.salles[id] = salle;
  if (activer || !d.salleActive) d.salleActive = id;
  return salle;
}

export function renommerSalle(d, id, nom) {
  const s = d.salles[id];
  if (!s) throw new Error('salle inconnue');
  s.nom = coupe(nom, LIMITES.nom).trim() || s.nom;
  return s;
}

/** Remplace la description d'une salle et son plan (jamais ses notes). */
export function definirTexte(d, id, texte, plan) {
  const s = d.salles[id];
  if (!s) throw new Error('salle inconnue');
  s.texte = texte;
  s.plan = { ...plan, id };
  return s;
}

/**
 * Supprime une salle et ses liaisons. Si c'était la dernière, une salle vide est recréée
 * (un donjon n'est jamais sans salle).
 * @returns {{recree:boolean}}
 */
export function supprimerSalle(d, id, { echelle } = {}) {
  if (!d.salles[id]) throw new Error('salle inconnue');
  delete d.salles[id];
  d.liaisons = d.liaisons.filter((l) => l.a.salle !== id && l.b.salle !== id);
  let recree = false;
  if (!Object.keys(d.salles).length) {
    ajouterSalle(d, { nom: 'Salle 1', echelle, activer: true });
    recree = true;
  }
  if (!d.salles[d.salleActive]) d.salleActive = Object.keys(d.salles)[0];
  return { recree };
}

export const listerSalles = (d) => Object.values(d.salles);

/** Un MJ qui débute : aucun de ses donjons n'a de liaison ni plus d'une salle. Le Donjon lui souffle alors comment créer la salle suivante. */
export const estDebutant = (donjons) => Object.values(donjons).every((d) => d.liaisons.length === 0 && Object.keys(d.salles).length < 2);

// --- Liaisons ---------------------------------------------------------------------

const memeExtremite = (e, salle, mur, position) => e.salle === salle && e.mur === mur && e.position === position;
const aPorte = (plan, mur, position) => plan.portes.some((p) => p.mur === mur && p.position === position);

/**
 * Trouve la liaison d'une porte (désignée par salle + mur + position).
 * @returns {{liaison:object, cote:'a'|'b', ici:object, autre:object}|null}
 */
export function liaisonDePorte(d, salle, porte) {
  for (const l of d.liaisons) {
    for (const [cote, autreCote] of [['a', 'b'], ['b', 'a']]) {
      if (memeExtremite(l[cote], salle, porte.mur, porte.position)) {
        return { liaison: l, cote, ici: l[cote], autre: l[autreCote] };
      }
    }
  }
  return null;
}

/** Relie deux portes existantes de deux salles différentes. Lève une Error en français sinon. */
export function relier(d, a, b) {
  const sa = d.salles[a?.salle], sb = d.salles[b?.salle];
  if (!sa || !sb) throw new Error('salle inconnue');
  if (sa === sb) throw new Error('une porte ne peut pas relier une salle à elle-même');
  for (const [e, s] of [[a, sa], [b, sb]]) {
    if (!MURS.includes(e.mur) || !aPorte(s.plan, e.mur, e.position)) throw new Error(`aucune porte au mur ${e.mur} (position ${e.position + 1}) de « ${s.nom} »`);
    if (liaisonDePorte(d, s.id, e)) throw new Error(`cette porte de « ${s.nom} » est déjà reliée`);
  }
  const liaison = {
    id: idUnique('l', d.liaisons.map((l) => l.id)),
    a: { salle: a.salle, mur: a.mur, position: a.position },
    b: { salle: b.salle, mur: b.mur, position: b.position },
  };
  d.liaisons.push(liaison);
  return liaison;
}

export function delier(d, idLiaison) {
  const avant = d.liaisons.length;
  d.liaisons = d.liaisons.filter((l) => l.id !== idLiaison);
  return d.liaisons.length < avant;
}

/** Une porte a bougé : la liaison suit. Renvoie le nombre d'extrémités mises à jour. */
export function suivrePorte(d, salle, avant, apres) {
  let n = 0;
  for (const l of d.liaisons) {
    for (const cote of ['a', 'b']) {
      if (memeExtremite(l[cote], salle, avant.mur, avant.position)) {
        l[cote] = { salle, mur: apres.mur, position: apres.position };
        n++;
      }
    }
  }
  return n;
}

/** Applique suivrePorte aux portes déplacées entre deux plans issus l'un de l'autre (mêmes ids). */
export function suivrePortesDeplacees(d, salle, ancien, nouveau) {
  let n = 0;
  for (const p of nouveau.portes) {
    const avant = ancien.portes.find((q) => q.id === p.id);
    if (avant && (avant.mur !== p.mur || avant.position !== p.position)) n += suivrePorte(d, salle, avant, p);
  }
  return n;
}

/**
 * Extrémités de liaison dont la porte n'existe plus dans le plan de leur salle.
 * @returns {{liaison:object, cote:'a'|'b', salle:string, mur:string, position:number}[]}
 */
export function liaisonsOrphelines(d) {
  const res = [];
  for (const l of d.liaisons) {
    for (const cote of ['a', 'b']) {
      const e = l[cote];
      const s = d.salles[e.salle];
      if (!s || !aPorte(s.plan, e.mur, e.position)) res.push({ liaison: l, cote, salle: e.salle, mur: e.mur, position: e.position });
    }
  }
  return res;
}

/** Position des extrémités de liaison d'une salle, à rétablir si on annule une modification de son texte. */
export function ancresDeSalle(d, salle) {
  const res = [];
  for (const l of d.liaisons) {
    for (const cote of ['a', 'b']) if (l[cote].salle === salle) res.push({ liaison: l.id, cote, mur: l[cote].mur, position: l[cote].position });
  }
  return res;
}

/** Rétablit les extrémités mémorisées (les liaisons supprimées depuis restent supprimées). */
export function restaurerAncres(d, ancres) {
  for (const a of ancres || []) {
    const l = d.liaisons.find((x) => x.id === a.liaison);
    if (l) l[a.cote] = { salle: l[a.cote].salle, mur: a.mur, position: a.position };
  }
}

// --- Salles créées depuis une porte ---------------------------------------------------

/**
 * Crée une salle de 6 × 6 cases derrière une porte, avec une porte de retour sur le mur
 * opposé, et relie les deux. La description est écrite par decrire() : le texte reste la
 * référence. La salle active ne change pas.
 * @param {{depuis:{salle:string, mur:string, position:number}, echelle?:number}} options
 */
export function creerSalleDerriere(d, { depuis, echelle }) {
  const source = d.salles[depuis.salle];
  const porteSource = source?.plan.portes.find((p) => p.mur === depuis.mur && p.position === depuis.position);
  if (!porteSource) throw new Error('aucune porte à cet endroit');
  if (liaisonDePorte(d, depuis.salle, depuis)) throw new Error('cette porte est déjà reliée');

  const mur = OPPOSE[depuis.mur];
  const position = Math.min(depuis.position, COTE_NOUVELLE_SALLE - 1);
  const base = analyser(`Salle de ${COTE_NOUVELLE_SALLE} par ${COTE_NOUVELLE_SALLE} cases`, { echelle }).plan;
  const texte = decrire({ ...base, entree: mur, portes: [{ id: 'p1', mur, position, type: porteSource.type }] });
  const salle = ajouterSalle(d, { texte, echelle });
  const liaison = relier(d, depuis, { salle: salle.id, mur, position });
  return { salle, liaison };
}

/**
 * Relie une porte à une salle existante : ajoute une porte sur le mur opposé de cette salle,
 * à la même position si elle est libre, sinon à la première position libre du mur.
 * Réécrit la description de la salle d'arrivée avec decrire().
 * @returns {{salle:object, liaison:object, texteAvant:string}}
 */
export function relierASalle(d, depuis, versSalle, { echelle } = {}) {
  const source = d.salles[depuis.salle], cible = d.salles[versSalle];
  if (!source || !cible) throw new Error('salle inconnue');
  if (source === cible) throw new Error('choisis une autre salle');
  const porteSource = source.plan.portes.find((p) => p.mur === depuis.mur && p.position === depuis.position);
  if (!porteSource) throw new Error('aucune porte à cet endroit');
  if (liaisonDePorte(d, depuis.salle, depuis)) throw new Error('cette porte est déjà reliée');

  const mur = OPPOSE[depuis.mur];
  const long = longueurMur(mur, cible.plan.largeur, cible.plan.longueur);
  const prises = new Set(cible.plan.portes.filter((p) => p.mur === mur).map((p) => p.position));
  let position = Math.min(depuis.position, long - 1);
  if (prises.has(position)) {
    position = Array.from({ length: long }, (_, i) => i).find((i) => !prises.has(i));
    if (position === undefined) throw new Error(`le mur ${mur} de « ${cible.nom} » n'a plus de place pour une porte`);
  }
  const ids = new Set(cible.plan.portes.map((p) => p.id));
  let n = cible.plan.portes.length + 1;
  while (ids.has(`p${n}`)) n++;
  const planAvec = { ...cible.plan, portes: [...cible.plan.portes, { id: `p${n}`, mur, position, type: porteSource.type }] };
  const texteAvant = cible.texte;
  const texte = decrire(planAvec);
  definirTexte(d, cible.id, texte, planDepuisTexte(texte, cible.id, echelle));
  const liaison = relier(d, depuis, { salle: cible.id, mur, position });
  return { salle: cible, liaison, texteAvant };
}

/** Donjon d'une salle à partir de l'ancien état `jdr-carte:v1` { texte, reglages }. */
export function donjonDepuisAncien(ancien, { nom = 'Donjon' } = {}) {
  const texte = typeof ancien?.texte === 'string' ? ancien.texte : TEXTE_SALLE_VIDE;
  return creerDonjon({ nom, texte, echelle: Number(ancien?.reglages?.echelle) > 0 ? Number(ancien.reglages.echelle) : undefined });
}
