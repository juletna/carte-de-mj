/**
 * Univers de cartes imbriquées : modèle PUR (sans DOM), voir docs/conception-univers.md §4.
 * Un univers est un ensemble de lieux (cartes image) ; chaque lieu porte des points qui mènent à un autre lieu
 * ou à un donjon existant (désigné par son identifiant : l'univers ne copie jamais un donjon).
 * Une destination absente (lieu ou donjon supprimé) est dite orpheline : elle est signalée, jamais retirée en silence.
 * Les fonctions modifient l'univers reçu (comme donjon.js) ; la validation d'un univers venu de l'extérieur est dans univers-validation.js.
 */
import { idUnique, coupe, dictionnaire } from './donjon.js';
import { normaliserGrille } from './univers-grille.js';

export const FORMAT = 'carte-de-mj-univers';
export const VERSION = 1;
export const MAX_LIEUX = 200;
export const MAX_POINTS = 100;
export const LIMITES = { nom: 80, notes: 20000 };
export const SOURCES_IMAGE = ['bibliotheque', 'navigateur'];
export const RE_ID_IMAGE = /^[A-Za-z0-9_.-]{1,64}$/;

/** Ramène une fraction dans [0, 1] (une valeur non numérique donne 0,5, le milieu de l'image). */
export const fraction = (v) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Math.min(1, Math.max(0, Number(v))) : 0.5);

export const imageValide = (r) => !!r && typeof r === 'object' && SOURCES_IMAGE.includes(r.source) && typeof r.id === 'string' && RE_ID_IMAGE.test(r.id);
export const memeImage = (a, b) => !!a && !!b && a.source === b.source && a.id === b.id;

/** Une destination `{ lieu }` ou `{ donjon, salle? }` bien formée (sans dire si sa cible existe). */
export function destinationValide(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  if (typeof v.lieu === 'string' && v.lieu) return !('donjon' in v);
  if (typeof v.donjon === 'string' && v.donjon) return v.salle === undefined || (typeof v.salle === 'string' && v.salle !== '');
  return false;
}
/** Copie propre d'une destination (rien d'autre que ses champs). */
export const copieDestination = (v) => (v.lieu !== undefined ? { lieu: v.lieu } : { donjon: v.donjon, ...(v.salle ? { salle: v.salle } : {}) });

export function creerUnivers({ nom = 'Univers' } = {}) {
  return { format: FORMAT, version: VERSION, id: idUnique('u'), nom: coupe(nom, LIMITES.nom).trim() || 'Univers', racine: null, lieux: dictionnaire() };
}

export const listerLieux = (u) => Object.values(u.lieux);

/** Ajoute un lieu (carte image). Le premier devient la racine. Lève une Error en français si la limite est atteinte. */
export function ajouterLieu(u, { nom, image, notes = '', grille } = {}) {
  if (Object.keys(u.lieux).length >= MAX_LIEUX) throw new Error(`un univers compte ${MAX_LIEUX} lieux au plus`);
  if (!imageValide(image)) throw new Error('image invalide');
  const id = idUnique('l', Object.keys(u.lieux));
  const lieu = { id, nom: coupe(nom, LIMITES.nom).trim() || `Lieu ${Object.keys(u.lieux).length + 1}`, type: 'carte', image: { source: image.source, id: image.id }, notes: coupe(notes, LIMITES.notes), points: [] };
  const g = normaliserGrille(grille);
  if (g) lieu.grille = g;
  u.lieux[id] = lieu;
  if (!u.racine || !(u.racine in u.lieux)) u.racine = id;
  return lieu;
}

const lieuOu = (u, id) => { const l = u.lieux[id]; if (!l) throw new Error('lieu inconnu'); return l; };
const pointOu = (lieu, id) => { const p = lieu.points.find((q) => q.id === id); if (!p) throw new Error('point inconnu'); return p; };

export function renommerUnivers(u, nom) { u.nom = coupe(nom, LIMITES.nom).trim() || u.nom; return u; }
export function renommerLieu(u, id, nom) { const l = lieuOu(u, id); l.nom = coupe(nom, LIMITES.nom).trim() || l.nom; return l; }
export function definirNotesLieu(u, id, notes) { const l = lieuOu(u, id); l.notes = coupe(notes, LIMITES.notes); return l; }
/** Change l'image d'un lieu ; ses points gardent leurs fractions. */
export function definirImageLieu(u, id, image) {
  if (!imageValide(image)) throw new Error('image invalide');
  const l = lieuOu(u, id); l.image = { source: image.source, id: image.id }; return l;
}
/**
 * Cale la grille d'un lieu (F4, js/univers-grille.js) : un objet `{ case, dx, dy }` (ramené dans les bornes), `null` pour « pas de grille »
 * même si le catalogue en propose une, `undefined` pour revenir à la grille du catalogue (la clé disparaît). Lève une Error si la grille est inexploitable.
 */
export function definirGrilleLieu(u, id, grille, dims) {
  const l = lieuOu(u, id);
  if (grille === undefined) { delete l.grille; return l; }
  if (grille === null) { l.grille = null; return l; }
  const g = normaliserGrille(grille, dims);
  if (!g) throw new Error('grille invalide');
  l.grille = g;
  return l;
}
export function definirRacine(u, id) { lieuOu(u, id); u.racine = id; return u; }

/**
 * Retire un lieu. Les points qui y menaient deviennent orphelins (ils restent, signalés). Si c'était la racine, un autre lieu la remplace.
 * @returns {object} le lieu retiré (pour pouvoir l'annuler avec `retablirLieu`)
 */
export function supprimerLieu(u, id) {
  const l = lieuOu(u, id);
  delete u.lieux[id];
  if (u.racine === id) u.racine = Object.keys(u.lieux)[0] ?? null;
  return l;
}
/** Remet un lieu retiré (annulation). Il redevient le lieu de départ s'il l'était (`racine`) ou s'il n'y en a plus. */
export function retablirLieu(u, lieu, { racine = false } = {}) {
  u.lieux[lieu.id] = lieu;
  if (racine || !u.racine || !(u.racine in u.lieux)) u.racine = lieu.id;
  return lieu;
}

/** Ajoute un point sur un lieu (x, y : fractions de l'image). `vers` facultatif : un point sans destination est permis. */
export function ajouterPoint(u, idLieu, { nom = '', x, y, vers, cache = false } = {}) {
  const l = lieuOu(u, idLieu);
  if (l.points.length >= MAX_POINTS) throw new Error(`un lieu compte ${MAX_POINTS} points au plus`);
  if (vers !== undefined && !destinationValide(vers)) throw new Error('destination invalide');
  const p = { id: idUnique('pt', l.points.map((q) => q.id)), nom: coupe(nom, LIMITES.nom).trim(), x: fraction(x), y: fraction(y) };
  if (vers) p.vers = copieDestination(vers);
  if (cache) p.cache = true;
  l.points.push(p);
  return p;
}
/** Modifie un point : `nom`, `x`, `y`, `vers` (null l'efface), `cache`. Les champs absents ne changent pas. */
export function modifierPoint(u, idLieu, idPoint, champs) {
  const p = pointOu(lieuOu(u, idLieu), idPoint);
  if ('nom' in champs) p.nom = coupe(champs.nom, LIMITES.nom).trim();
  if ('x' in champs) p.x = fraction(champs.x);
  if ('y' in champs) p.y = fraction(champs.y);
  if ('vers' in champs) {
    if (champs.vers === null) delete p.vers;
    else if (destinationValide(champs.vers)) p.vers = copieDestination(champs.vers);
    else throw new Error('destination invalide');
  }
  if ('cache' in champs) { if (champs.cache) p.cache = true; else delete p.cache; }
  return p;
}
export const deplacerPoint = (u, idLieu, idPoint, x, y) => modifierPoint(u, idLieu, idPoint, { x, y });
export function supprimerPoint(u, idLieu, idPoint) {
  const l = lieuOu(u, idLieu);
  const i = l.points.findIndex((q) => q.id === idPoint);
  if (i < 0) throw new Error('point inconnu');
  return l.points.splice(i, 1)[0];
}

/**
 * La destination d'un point existe-t-elle ? `donjons` : { idDonjon: donjon } (ceux du navigateur).
 * @returns {null|string} null si elle existe (ou s'il n'y en a pas), sinon la raison en français
 */
export function raisonOrpheline(u, vers, donjons = {}) {
  if (!vers) return null;
  if (vers.lieu !== undefined) return vers.lieu in u.lieux ? null : 'le lieu n’existe plus';
  const d = donjons[vers.donjon];
  if (!d) return 'le donjon n’existe plus';
  if (vers.salle && !(vers.salle in d.salles)) return 'la salle n’existe plus';
  return null;
}
/** Tous les points dont la destination a disparu : [{ lieu, point, raison }]. */
export function orphelins(u, donjons = {}) {
  const res = [];
  for (const lieu of Object.values(u.lieux)) {
    for (const point of lieu.points) {
      const raison = raisonOrpheline(u, point.vers, donjons);
      if (raison) res.push({ lieu: lieu.id, point: point.id, raison });
    }
  }
  return res;
}
/** Les points d'autres lieux qui mènent à ce lieu. */
export function pointsVers(u, idLieu) {
  const res = [];
  for (const lieu of Object.values(u.lieux)) for (const point of lieu.points) if (point.vers?.lieu === idLieu) res.push({ lieu: lieu.id, point: point.id });
  return res;
}
/** Les points qui mènent à ce donjon. */
export function pointsVersDonjon(u, idDonjon) {
  const res = [];
  for (const lieu of Object.values(u.lieux)) for (const point of lieu.points) if (point.vers?.donjon === idDonjon) res.push({ lieu: lieu.id, point: point.id });
  return res;
}
/** Les lieux qu'on ne peut atteindre depuis la racine : en préparation, ou perdus. */
export function lieuxInaccessibles(u) {
  const vus = new Set();
  const pile = u.racine && u.racine in u.lieux ? [u.racine] : [];
  while (pile.length) {
    const id = pile.pop();
    if (vus.has(id)) continue;
    vus.add(id);
    for (const p of u.lieux[id].points) if (p.vers?.lieu in u.lieux) pile.push(p.vers.lieu);
  }
  return Object.keys(u.lieux).filter((id) => !vus.has(id));
}

/** Le texte du fichier exporté : l'univers entier ; les images y sont citées par leur référence, jamais incluses. */
export const texteUnivers = (u) => JSON.stringify(u, null, 2);

/** Nom lisible d'une destination, pour la liste des points. */
export function nomDestination(u, vers, donjons = {}) {
  if (!vers) return 'sans destination';
  if (vers.lieu !== undefined) return u.lieux[vers.lieu]?.nom ?? '(lieu disparu)';
  const d = donjons[vers.donjon];
  if (!d) return '(donjon disparu)';
  return vers.salle && d.salles[vers.salle] ? `${d.nom} › ${d.salles[vers.salle].nom}` : d.nom;
}
