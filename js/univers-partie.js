/**
 * Partie d'univers : où en est la table dans un univers (module PUR, sans DOM). Voir docs/conception-univers.md §4.
 *
 * { univers: idUnivers, lieuCourant: idLieu, chemin: [idLieu], decouverts: [idLieu], reveles: { idLieu: [idPoint] },
 *   dans?: { donjon, salle?, depuis? }, masquerNoms?: true }
 *
 * `chemin` : les lieux traversés pour arriver au lieu courant (le courant n'y est pas). `dans` : la table est entrée dans un
 * donjon (sa partie de donjon a son propre format, inchangé, dans carte-de-mj:presentations-v1) ; `depuis` : le point franchi.
 * La partie ne copie rien de l'univers : un lieu ou un point disparu est repéré par `reconcilier`, jamais corrigé en silence.
 */
import { estObjet } from './format.js';
import { destinationValide, copieDestination } from './univers.js';

const RE_ID = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_CHEMIN = 200;

export function creerPartieUnivers(univers) {
  const racine = univers.racine && univers.racine in univers.lieux ? univers.racine : Object.keys(univers.lieux)[0] ?? null;
  return { univers: univers.id, lieuCourant: racine, chemin: [], decouverts: racine ? [racine] : [], reveles: {} };
}

const ajouteUnique = (liste, id) => { if (!liste.includes(id)) liste.push(id); };

/** Le point est-il montré à la table ? Un point non caché l'est toujours ; un point caché seulement s'il a été révélé. */
export const pointRevele = (partie, idLieu, point) => !point.cache || !!partie.reveles[idLieu]?.includes(point.id);

/** Révèle un point caché (rien ne change pour un point qui ne l'est pas). */
export function reveler(partie, idLieu, idPoint) {
  const liste = partie.reveles[idLieu] ?? (partie.reveles[idLieu] = []);
  ajouteUnique(liste, idPoint);
  return partie;
}
/** Cache à nouveau un point révélé. */
export function recacher(partie, idLieu, idPoint) {
  if (partie.reveles[idLieu]) {
    partie.reveles[idLieu] = partie.reveles[idLieu].filter((id) => id !== idPoint);
    if (!partie.reveles[idLieu].length) delete partie.reveles[idLieu];
  }
  return partie;
}

/**
 * Franchit un point. Vers un lieu : le lieu courant passe dans le chemin. Vers un donjon : `dans` est posé, le lieu courant ne change pas.
 * Franchir un point caché le révèle (le MJ s'en sert pour y conduire la table).
 * @returns {{lieu:string}|{donjon:string, salle?:string}|null} la destination, ou null si le point n'en a pas, ou si elle n'existe plus
 */
export function franchir(partie, univers, idPoint, donjons = {}) {
  const lieu = univers.lieux[partie.lieuCourant];
  const point = lieu?.points.find((p) => p.id === idPoint);
  if (!point?.vers) return null;
  if (point.cache) reveler(partie, lieu.id, point.id);
  if (point.vers.lieu !== undefined) {
    if (!(point.vers.lieu in univers.lieux)) return null;
    if (partie.chemin.length < MAX_CHEMIN) partie.chemin.push(partie.lieuCourant);
    partie.lieuCourant = point.vers.lieu;
    ajouteUnique(partie.decouverts, point.vers.lieu);
    return { lieu: point.vers.lieu };
  }
  const d = donjons[point.vers.donjon];
  if (!d) return null;
  const salle = point.vers.salle && point.vers.salle in d.salles ? point.vers.salle : undefined;
  partie.dans = { donjon: d.id, ...(salle ? { salle } : {}), depuis: point.id };
  return { donjon: d.id, ...(salle ? { salle } : {}) };
}

/** Remonte d'un cran : sort du donjon si la table y est, sinon revient au lieu d'où l'on vient. Faux si on est déjà à la racine. */
export function remonter(partie) {
  if (partie.dans) { delete partie.dans; return true; }
  if (!partie.chemin.length) return false;
  partie.lieuCourant = partie.chemin.pop();
  return true;
}
/** Revient directement à un lieu du chemin (fil d'Ariane) : index dans [...chemin, lieuCourant]. Sort aussi du donjon. */
export function allerAuChemin(partie, index) {
  const fil = [...partie.chemin, partie.lieuCourant];
  if (!Number.isInteger(index) || index < 0 || index >= fil.length) return false;
  delete partie.dans;
  partie.chemin = fil.slice(0, index);
  partie.lieuCourant = fil[index];
  return true;
}
/** Saute à un lieu déjà découvert, hors du chemin (le MJ y conduit la table) : l'ancien lieu rejoint le chemin. */
export function allerAuLieu(partie, univers, idLieu) {
  if (!(idLieu in univers.lieux)) return false;
  delete partie.dans;
  if (idLieu === partie.lieuCourant) return true;
  const i = partie.chemin.indexOf(idLieu);
  if (i >= 0) return allerAuChemin(partie, i);
  if (partie.chemin.length < MAX_CHEMIN) partie.chemin.push(partie.lieuCourant);
  partie.lieuCourant = idLieu;
  ajouteUnique(partie.decouverts, idLieu);
  return true;
}

/** Le fil d'Ariane : [{ id, nom }] de la racine au lieu courant (un lieu disparu garde son identifiant comme nom). */
export const filDAriane = (partie, univers) => [...partie.chemin, partie.lieuCourant].map((id) => ({ id, nom: univers.lieux[id]?.nom ?? '(lieu disparu)' }));

/** Les points du lieu courant que la table voit, dans l'ordre du lieu : [{ id, x, y, nom? }]. Sans nom si le MJ a masqué les noms. */
export function pointsPourLaTable(partie, univers, idLieu = partie.lieuCourant) {
  const lieu = univers.lieux[idLieu];
  if (!lieu) return [];
  return lieu.points.filter((p) => pointRevele(partie, idLieu, p)).map((p) => ({ id: p.id, x: p.x, y: p.y, ...(partie.masquerNoms || !p.nom ? {} : { nom: p.nom }) }));
}

/**
 * Ce que voit la table : la référence de l'image (jamais l'image) et les points visibles.
 * @returns {{image:object, nom?:string, points:object[]}|null} null si le lieu n'existe plus
 */
export function vueDeLaTable(partie, univers, grille = null) {
  const lieu = univers.lieux[partie.lieuCourant];
  if (!lieu) return null;
  return { image: { source: lieu.image.source, id: lieu.image.id }, ...(partie.masquerNoms ? {} : { nom: lieu.nom }), ...(grille ? { grille: { case: grille.case, dx: grille.dx, dy: grille.dy } } : {}), points: pointsPourLaTable(partie, univers) };
}

/**
 * Accorde une partie relue avec l'univers tel qu'il est maintenant. Corrige ce qui ne peut plus tenir et le DIT :
 * lieu courant disparu (retour à la racine), lieux du chemin disparus (retirés), points révélés disparus (retirés), donjon disparu.
 * @returns {string[]} les corrections faites, en français (vide : rien n'a changé)
 */
export function reconcilier(partie, univers, donjons = {}) {
  const notes = [];
  const existe = (id) => id in univers.lieux;
  if (!existe(partie.lieuCourant)) {
    const racine = univers.racine && existe(univers.racine) ? univers.racine : Object.keys(univers.lieux)[0] ?? null;
    notes.push('Le lieu où se trouvait la table n’existe plus : retour au lieu de départ.');
    partie.lieuCourant = racine;
    partie.chemin = [];
    delete partie.dans;
  }
  const chemin = partie.chemin.filter(existe);
  if (chemin.length !== partie.chemin.length) { notes.push('Des lieux du chemin n’existent plus : ils sont retirés du fil d’Ariane.'); partie.chemin = chemin; }
  partie.decouverts = partie.decouverts.filter(existe);
  if (partie.lieuCourant) ajouteUnique(partie.decouverts, partie.lieuCourant);
  for (const id of Object.keys(partie.reveles)) {
    const lieu = univers.lieux[id];
    if (!lieu) { delete partie.reveles[id]; continue; }
    partie.reveles[id] = partie.reveles[id].filter((p) => lieu.points.some((q) => q.id === p));
    if (!partie.reveles[id].length) delete partie.reveles[id];
  }
  if (partie.dans && !donjons[partie.dans.donjon]) {
    notes.push('Le donjon où se trouvait la table n’existe plus : retour à la carte.');
    delete partie.dans;
  }
  return notes;
}

/**
 * Relit une partie d'univers venue du stockage. Refuse ce qui n'est pas une partie ; nettoie le reste en le disant.
 * @returns {{ok:boolean, erreurs:string[], avertissements:string[], partie:object|null}}
 */
export function validerPartieUnivers(brut) {
  const refus = (m) => ({ ok: false, erreurs: [m], avertissements: [], partie: null });
  if (!estObjet(brut)) return refus('la partie d’univers doit être un objet');
  if (typeof brut.univers !== 'string' || !RE_ID.test(brut.univers)) return refus('partie d’univers sans identifiant d’univers');
  if (typeof brut.lieuCourant !== 'string' || !RE_ID.test(brut.lieuCourant)) return refus('partie d’univers sans lieu courant');
  const avertissements = [];
  const ids = (v, quoi) => {
    if (v === undefined) return [];
    if (!Array.isArray(v)) { avertissements.push(`${quoi} illisible, vidé`); return []; }
    const bons = v.filter((x) => typeof x === 'string' && RE_ID.test(x));
    if (bons.length !== v.length) avertissements.push(`${quoi} : éléments invalides écartés`);
    return [...new Set(bons)].slice(0, MAX_CHEMIN);
  };
  const reveles = {};
  if (brut.reveles !== undefined && !estObjet(brut.reveles)) avertissements.push('points révélés illisibles, vidés');
  else for (const [lieu, liste] of Object.entries(brut.reveles ?? {})) {
    if (!RE_ID.test(lieu)) { avertissements.push('points révélés : lieu invalide écarté'); continue; }
    const l = ids(liste, 'points révélés');
    if (l.length) reveles[lieu] = l;
  }
  const partie = { univers: brut.univers, lieuCourant: brut.lieuCourant, chemin: ids(brut.chemin, 'chemin').slice(0, MAX_CHEMIN), decouverts: ids(brut.decouverts, 'lieux découverts'), reveles };
  ajouteUnique(partie.decouverts, partie.lieuCourant);
  if (brut.dans !== undefined) {
    const d = brut.dans;
    if (estObjet(d) && destinationValide({ donjon: d.donjon, ...(d.salle !== undefined ? { salle: d.salle } : {}) })) {
      partie.dans = { ...copieDestination({ donjon: d.donjon, ...(d.salle !== undefined ? { salle: d.salle } : {}) }), ...(typeof d.depuis === 'string' && RE_ID.test(d.depuis) ? { depuis: d.depuis } : {}) };
    } else avertissements.push('donjon ouvert illisible, la table revient à la carte');
  }
  if (brut.masquerNoms === true) partie.masquerNoms = true;
  return { ok: !avertissements.length, erreurs: [], avertissements, partie };
}
