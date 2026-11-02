/**
 * Sauvegarde locale (localStorage) et export/import en fichier JSON.
 * Tout reste dans le navigateur : rien n'est envoyé nulle part.
 *
 * Clés :
 *   carte-de-mj:donjons-v1    { actif, donjons: { <id>: donjon } }   (voir donjon.js)
 *   carte-de-mj:reglages-v1   { echelle, taille, grille, reperes? }  (affichage, hors donjons)
 *   carte-de-mj:presentations-v1  { presentations: { <idDonjon>: présentation } }  (parties en cours : voir presentation.js)
 *   jdr-carte:v1              ANCIENNE clé (une salle) : lue une fois pour la migration, jamais supprimée
 *
 * Les fonctions de lecture/écriture acceptent un `stock` (par défaut localStorage) pour être testées sous Node.
 */
import { validerDonjon, donjonDepuisAncien, creerDonjon } from './donjon.js';
import { validerPresentation } from './presentation.js';

export const CLE_DONJONS = 'carte-de-mj:donjons-v1';
export const CLE_REGLAGES = 'carte-de-mj:reglages-v1';
export const CLE_PRESENTATIONS = 'carte-de-mj:presentations-v1';
export const CLE_PARTIE_OUVERTE = 'carte-de-mj:partie-ouverte-v1';
const CLE = 'jdr-carte:v1';
const TAILLE_MAX_FICHIER = 5 * 1024 * 1024;
const REGLAGES_DEFAUT = { echelle: 1.5, taille: 48, grille: true };

const stockParDefaut = () => { try { return globalThis.localStorage || null; } catch { return null; } };
function lireJson(stock, cle) {
  try {
    const brut = stock?.getItem(cle);
    return brut ? JSON.parse(brut) : null;
  } catch {
    return null;
  }
}
function ecrireJson(stock, cle, valeur) {
  try {
    stock?.setItem(cle, JSON.stringify(valeur));
    return true;
  } catch {
    return false; // Stockage indisponible ou plein : l'outil marche quand même, sans mémoire.
  }
}

/** Réglages d'affichage (valeurs par défaut pour ce qui manque ou est invalide). */
export function chargerReglages(stock = stockParDefaut()) {
  const r = lireJson(stock, CLE_REGLAGES) || {};
  return {
    echelle: Number(r.echelle) > 0 ? Number(r.echelle) : REGLAGES_DEFAUT.echelle,
    taille: Number(r.taille) >= 16 && Number(r.taille) <= 160 ? Number(r.taille) : REGLAGES_DEFAUT.taille,
    grille: typeof r.grille === 'boolean' ? r.grille : REGLAGES_DEFAUT.grille,
    // Facultatif (écran de table) : absent tant que personne ne l'a réglé, donc le Donjon n'en tient pas compte.
    ...(typeof r.reperes === 'boolean' ? { reperes: r.reperes } : {}),
    // Facultatifs aussi : `calibre` (posé par le Donjon quand la taille est réglée avec la carte bancaire) et
    // `modeTable` (« remplir » ou « reel », choisi dans la régie de la Présentation). Absents tant que personne n'y a touché.
    ...(r.calibre === true ? { calibre: true } : {}),
    ...(r.modeTable === 'remplir' || r.modeTable === 'reel' ? { modeTable: r.modeTable } : {}),
  };
}
export const sauverReglages = (reglages, stock = stockParDefaut()) => ecrireJson(stock, CLE_REGLAGES, reglages);

/** Donjons sauvegardés, validés un à un : { actif, donjons } ou null si la clé manque. */
export function chargerDonjons(stock = stockParDefaut()) {
  const brut = lireJson(stock, CLE_DONJONS);
  if (!brut || typeof brut.donjons !== 'object' || brut.donjons === null) return null;
  const donjons = {};
  for (const d of Object.values(brut.donjons)) {
    const v = validerDonjon(d);
    if (v.donjon) donjons[v.donjon.id] = v.donjon;
  }
  const ids = Object.keys(donjons);
  if (!ids.length) return null;
  return { actif: ids.includes(brut.actif) ? brut.actif : ids[0], donjons };
}
export const sauverDonjons = (etat, stock = stockParDefaut()) => ecrireJson(stock, CLE_DONJONS, { actif: etat.actif, donjons: etat.donjons });

/**
 * Présentations en cours, validées une à une : { <idDonjon>: présentation } (vide si rien).
 * Une entrée invalide est écartée sans toucher aux autres.
 */
export function chargerPresentations(stock = stockParDefaut()) {
  const brut = lireJson(stock, CLE_PRESENTATIONS);
  const res = {};
  if (!brut || typeof brut.presentations !== 'object' || brut.presentations === null) return res;
  for (const p of Object.values(brut.presentations)) {
    const v = validerPresentation(p);
    if (v.presentation) res[v.presentation.donjon.id] = v.presentation;
  }
  return res;
}
export const sauverPresentations = (presentations, stock = stockParDefaut()) => ecrireJson(stock, CLE_PRESENTATIONS, { presentations });

/**
 * Partie ouverte dans la régie : on ne mémorise que l'identifiant du donjon (la partie elle-même est dans
 * `carte-de-mj:presentations-v1`). Sert à rouvrir la régie là où elle était après un rechargement.
 */
export const memoriserPartieOuverte = (idDonjon, stock = stockParDefaut()) => ecrireJson(stock, CLE_PARTIE_OUVERTE, { id: idDonjon });
export const oublierPartieOuverte = (stock = stockParDefaut()) => { try { stock?.removeItem?.(CLE_PARTIE_OUVERTE); } catch { /* sans mémoire */ } };

/** La partie à rouvrir parmi `presentations` ({ idDonjon: partie }), ou null (rien de mémorisé, ou partie disparue). */
export function partieAReprendre(presentations, stock = stockParDefaut()) {
  const id = lireJson(stock, CLE_PARTIE_OUVERTE)?.id;
  return typeof id === 'string' && Object.prototype.hasOwnProperty.call(presentations, id) ? presentations[id] : null;
}

/**
 * Point d'entrée au démarrage : donjons et réglages à utiliser.
 *  1. clés actuelles si elles existent ;
 *  2. sinon, migration de `jdr-carte:v1` en un donjon d'une salle (l'ancienne clé reste intacte) ;
 *  3. sinon, un donjon neuf avec `texteInitial`.
 * @returns {{actif:string, donjons:object, reglages:object, migre:boolean}}
 */
export function chargerTout({ texteInitial, stock = stockParDefaut() } = {}) {
  let etat = chargerDonjons(stock);
  let migre = false;
  const ancien = lireJson(stock, CLE);
  const reglagesAbsents = !lireJson(stock, CLE_REGLAGES);
  let reglages = chargerReglages(stock);
  if (!etat && ancien && typeof ancien === 'object') {
    const d = donjonDepuisAncien(ancien);
    etat = { actif: d.id, donjons: { [d.id]: d } };
    migre = true;
    if (reglagesAbsents && ancien.reglages) {
      reglages = chargerReglages({ getItem: () => JSON.stringify(ancien.reglages) }); // mêmes bornes que pour une lecture normale
    }
  }
  if (!etat) {
    const d = creerDonjon({ texte: texteInitial });
    etat = { actif: d.id, donjons: { [d.id]: d } };
  }
  return { ...etat, reglages, migre };
}

/** Lit l'état sauvegardé, ou null (navigation privée, données effacées…). ANCIEN format : voir chargerTout. */
export function charger() {
  try {
    const brut = localStorage.getItem(CLE);
    return brut ? JSON.parse(brut) : null;
  } catch {
    return null;
  }
}

export function sauver(etat) {
  try {
    localStorage.setItem(CLE, JSON.stringify(etat));
  } catch {
    // Stockage indisponible : l'outil marche quand même, sans mémoire.
  }
}

/** Propose le téléchargement du donjon en fichier .json. */
export function exporter(etat) {
  const donnees = { format: 'jdr-carte', version: 1, salles: [etat.plan], texte: etat.texte, reglages: etat.reglages };
  const blob = new Blob([JSON.stringify(donnees, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${(etat.plan.nom || 'salle').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** Lit un fichier choisi par l'utilisateur. Accepte un export ou un plan seul. ANCIEN format : voir donjon.js (convertirImport). */
export async function importer(fichier) {
  const donnees = JSON.parse(await fichier.text());
  if (donnees.format === 'jdr-carte') return { plan: donnees.salles?.[0], texte: donnees.texte || '', reglages: donnees.reglages };
  return { plan: donnees, texte: '' };
}

// --- Donjon entier (nouveau format) -----------------------------------------------

const nomDeFichier = (nom) => `${String(nom || 'donjon').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'donjon'}.json`;

/** Propose le téléchargement du donjon entier (salles, notes, liaisons, éléments cachés). */
export function exporterDonjon(donjon) {
  const blob = new Blob([JSON.stringify(donjon, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nomDeFichier(donjon.nom);
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/**
 * Lit un fichier JSON choisi par l'utilisateur, sans rien en faire d'autre.
 * @throws {Error} message en français si le fichier est trop gros ou n'est pas du JSON
 */
export async function lireFichierJson(fichier) {
  if (fichier.size > TAILLE_MAX_FICHIER) throw new Error('fichier trop gros (5 Mo au plus)');
  try {
    return JSON.parse(await fichier.text());
  } catch {
    throw new Error('fichier illisible : ce n’est pas un JSON valide');
  }
}
