/**
 * Relecture d'un univers venu de l'extérieur (fichier importé, stockage) : module PUR, comme donjon-validation.js.
 * Refuse ce qui n'est pas exploitable ; écarte avec un avertissement ce qui peut l'être (point mal formé, texte trop long…).
 * Une destination qui pointe vers un lieu absent est CONSERVÉE (orpheline, voir orphelins() dans univers.js) : on ne la retire pas en silence.
 */
import { estObjet } from './format.js';
import { coupe, dictionnaire, idUnique } from './donjon.js';
import { normaliserGrille } from './univers-grille.js';
import { FORMAT, VERSION, MAX_LIEUX, MAX_POINTS, LIMITES, imageValide, destinationValide, copieDestination, fraction } from './univers.js';

const RE_ID = /^[A-Za-z0-9_-]{1,64}$/;

function validerPoint(brut, etiquette, avertissements) {
  if (!estObjet(brut)) { avertissements.push(`${etiquette} : point écarté (ce n’est pas un objet)`); return null; }
  if (typeof brut.id !== 'string' || !RE_ID.test(brut.id)) { avertissements.push(`${etiquette} : point écarté (identifiant invalide)`); return null; }
  if (!Number.isFinite(brut.x) || !Number.isFinite(brut.y)) { avertissements.push(`${etiquette} : point « ${coupe(brut.nom || brut.id, 40)} » écarté (position invalide)`); return null; }
  const nom = typeof brut.nom === 'string' ? brut.nom : '';
  if (nom.length > LIMITES.nom) avertissements.push(`${etiquette} : nom de point coupé à ${LIMITES.nom} caractères`);
  const p = { id: brut.id, nom: coupe(nom, LIMITES.nom).trim(), x: fraction(brut.x), y: fraction(brut.y) };
  if (brut.x < 0 || brut.x > 1 || brut.y < 0 || brut.y > 1) avertissements.push(`${etiquette} : point « ${p.nom || p.id} » ramené dans l’image`);
  if (brut.vers !== undefined) {
    if (destinationValide(brut.vers)) p.vers = copieDestination(brut.vers);
    else avertissements.push(`${etiquette} : destination du point « ${p.nom || p.id} » invalide, écartée`);
  }
  if (brut.cache === true) p.cache = true;
  return p;
}

function validerLieu(brut, id, avertissements) {
  if (!estObjet(brut)) return { erreur: `lieu « ${id} » : ce n’est pas un objet` };
  const etiquette = `lieu « ${coupe(brut.nom || id, 40)} »`;
  const sansImage = brut.image === undefined || brut.image === null; // un lieu « à illustrer » est valide ; une image mal formée, non
  if (!sansImage && !imageValide(brut.image)) return { erreur: `${etiquette} : image invalide` };
  if (typeof brut.notes === 'string' && brut.notes.length > LIMITES.notes) avertissements.push(`${etiquette} : notes coupées à ${LIMITES.notes} caractères`);
  const lieu = {
    id, nom: coupe(brut.nom, LIMITES.nom).trim() || id, type: 'carte',
    notes: typeof brut.notes === 'string' ? coupe(brut.notes, LIMITES.notes) : '', points: [],
  };
  if (!sansImage) lieu.image = { source: brut.image.source, id: brut.image.id };
  if (sansImage) { /* une grille ne se cale que sur une image : celle-ci est ignorée */ } else if (brut.grille === null) lieu.grille = null; // « pas de grille », même si le catalogue en propose une
  else if (brut.grille !== undefined) {
    const g = normaliserGrille(brut.grille);
    if (g) lieu.grille = g;
    else avertissements.push(`${etiquette} : grille invalide, écartée`);
  }
  const points = Array.isArray(brut.points) ? brut.points : [];
  if (brut.points !== undefined && !Array.isArray(brut.points)) avertissements.push(`${etiquette} : points illisibles, écartés`);
  const ids = new Set();
  for (const bp of points) {
    if (lieu.points.length >= MAX_POINTS) { avertissements.push(`${etiquette} : points au-delà de ${MAX_POINTS} écartés`); break; }
    const p = validerPoint(bp, etiquette, avertissements);
    if (!p) continue;
    if (ids.has(p.id)) { avertissements.push(`${etiquette} : identifiant de point en double, un point a reçu un nouvel identifiant`); p.id = idUnique('pt', [...ids]); }
    ids.add(p.id);
    lieu.points.push(p);
  }
  return { lieu };
}

/**
 * Valide (et nettoie) un univers.
 * @returns {{ok:boolean, erreurs:string[], avertissements:string[], univers:object|null}}
 */
export function validerUnivers(brut) {
  const refus = (...erreurs) => ({ ok: false, erreurs, avertissements: [], univers: null });
  if (!estObjet(brut)) return refus('le fichier doit contenir un objet JSON');
  if (brut.format !== FORMAT) return refus('ce fichier n’est pas un univers de Carte de MJ');
  if (!Number.isInteger(brut.version) || brut.version < 1) return refus('numéro de version invalide');
  if (brut.version > VERSION) return refus(`fichier de version ${brut.version}, plus récente que celle que cet outil comprend (${VERSION}) : mets l’outil à jour`);
  if (typeof brut.id !== 'string' || !RE_ID.test(brut.id)) return refus('identifiant d’univers invalide');
  if (!estObjet(brut.lieux)) return refus('l’univers n’a pas de lieux');
  const avertissements = [];
  const entrees = Object.entries(brut.lieux);
  if (entrees.length > MAX_LIEUX) return refus(`trop de lieux (${MAX_LIEUX} au plus)`);
  if (typeof brut.nom === 'string' && brut.nom.length > LIMITES.nom) avertissements.push(`nom coupé à ${LIMITES.nom} caractères`);
  const lieux = dictionnaire();
  for (const [cle, bl] of entrees) {
    const id = estObjet(bl) && typeof bl.id === 'string' ? bl.id : cle;
    if (!RE_ID.test(id)) { avertissements.push(`lieu « ${coupe(cle, 20)} » écarté (identifiant invalide)`); continue; }
    if (id in lieux) { avertissements.push(`lieu « ${id} » écarté (identifiant en double)`); continue; }
    const { lieu, erreur } = validerLieu(bl, id, avertissements);
    if (erreur) { avertissements.push(`${erreur} : lieu écarté`); continue; }
    lieux[id] = lieu;
  }
  if (entrees.length && !Object.keys(lieux).length) return refus('aucun lieu exploitable dans ce fichier');
  const racine = typeof brut.racine === 'string' && brut.racine in lieux ? brut.racine : (Object.keys(lieux)[0] ?? null);
  if (brut.racine != null && racine !== brut.racine) avertissements.push('carte du monde introuvable : le premier lieu la remplace');
  const univers = { format: FORMAT, version: VERSION, id: brut.id, nom: coupe(brut.nom, LIMITES.nom).trim() || 'Univers', racine, lieux };
  // Le lieu de départ de la partie (facultatif) : écarté s'il ne désigne aucun lieu ; il vaut alors la carte du monde. Le départ sur la carte du monde n'est pas écrit.
  if (brut.depart != null) {
    if (typeof brut.depart === 'string' && brut.depart in lieux) { if (brut.depart !== racine) univers.depart = brut.depart; }
    else avertissements.push('lieu de départ de la partie introuvable : la partie commence sur la carte du monde');
  }
  return { ok: !avertissements.length, erreurs: [], avertissements, univers };
}

/** Lit le texte d'un fichier d'univers : { univers, avertissements } ou lève une Error en français. */
export function lireUnivers(texte) {
  let brut;
  try { brut = JSON.parse(texte); } catch { throw new Error('ce texte n’est pas un univers : il devrait commencer par { et finir par }'); }
  const v = validerUnivers(brut);
  if (!v.univers) throw new Error(v.erreurs.join(' · '));
  return { univers: v.univers, avertissements: v.avertissements };
}
