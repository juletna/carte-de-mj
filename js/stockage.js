/**
 * Sauvegarde locale (localStorage) et export/import en fichier JSON.
 * Tout reste dans le navigateur : rien n'est envoyé nulle part.
 *
 * Clés :
 *   carte-de-mj:donjons-v1    { actif, donjons: { <id>: donjon } }   (voir donjon.js)
 *   carte-de-mj:reglages-v1   { echelle, taille, grille, reperes? }  (affichage, hors donjons)
 *   carte-de-mj:presentations-v1  { presentations: { <idDonjon>: présentation } }  (parties en cours : voir presentation.js)
 *   carte-de-mj:modeles-v1    { modeles: [donjon] }  (donjons gardés comme modèles : voir modeles.js)
 *   dd-fiche-personnages-v1   { actif, persos }  (outil Fiche : lue ici seulement, jamais écrite)
 *   carte-de-mj:regie-retrait-v1  { partie }  (dans le sessionStorage, propre à l'onglet : régie en retrait, voir commande-table.js)
 *   jdr-carte:v1              ANCIENNE clé (une salle) : lue une fois pour la migration, jamais supprimée
 *
 * Les fonctions de lecture/écriture acceptent un `stock` (par défaut localStorage) pour être testées sous Node.
 */
import { validerDonjon, donjonDepuisAncien, creerDonjon } from './donjon.js';
import { validerPresentation } from './presentation.js';
import { fichesDuNavigateur } from './personnages.js';
import { TAILLE_PAR_DEFAUT, ECHELLE_PAR_DEFAUT, MODES_TABLE, tailleReglable } from './affichage.js';
import { sansAccents } from './format.js';

export const CLE_DONJONS = 'carte-de-mj:donjons-v1';
export const CLE_REGLAGES = 'carte-de-mj:reglages-v1';
export const CLE_PRESENTATIONS = 'carte-de-mj:presentations-v1';
export const CLE_PARTIE_OUVERTE = 'carte-de-mj:partie-ouverte-v1';
export const CLE_MODELES = 'carte-de-mj:modeles-v1';
export const CLE_FICHES = 'dd-fiche-personnages-v1';
export const CLE_RETRAIT = 'carte-de-mj:regie-retrait-v1';
const CLE = 'jdr-carte:v1';
const TAILLE_MAX_FICHIER = 5 * 1024 * 1024;
const REGLAGES_DEFAUT = { echelle: ECHELLE_PAR_DEFAUT, taille: TAILLE_PAR_DEFAUT, grille: true };

const stockParDefaut = () => { try { return globalThis.localStorage || null; } catch { return null; } };
const stockOnglet = () => { try { return globalThis.sessionStorage || null; } catch { return null; } };
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
    taille: tailleReglable(Number(r.taille)) ? Number(r.taille) : REGLAGES_DEFAUT.taille,
    grille: typeof r.grille === 'boolean' ? r.grille : REGLAGES_DEFAUT.grille,
    // Facultatif (écran de table) : absent tant que personne ne l'a réglé, donc le Donjon n'en tient pas compte.
    ...(typeof r.reperes === 'boolean' ? { reperes: r.reperes } : {}),
    // Facultatifs aussi : `calibre` (posé par le Donjon quand la taille est réglée avec la carte bancaire) et
    // `modeTable` (« remplir » ou « reel », choisi dans la régie de la Présentation). Absents tant que personne n'y a touché.
    ...(r.calibre === true ? { calibre: true } : {}),
    ...(MODES_TABLE.includes(r.modeTable) ? { modeTable: r.modeTable } : {}),
    // `miniTable` : seulement si le MJ l'a éteinte (par défaut, la table a sa mini-carte).
    ...(r.miniTable === false ? { miniTable: false } : {}),
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

// Plusieurs régies peuvent être ouvertes : chacune n'écrit que sa partie, sur ce qui est enregistré à cet instant, jamais sa copie en mémoire des autres.
const presentationsBrutes = (stock) => {
  const toutes = lireJson(stock, CLE_PRESENTATIONS)?.presentations;
  return toutes && typeof toutes === 'object' ? toutes : {};
};
export const enregistrerPartie = (p, stock = stockParDefaut()) => sauverPresentations({ ...presentationsBrutes(stock), [p.donjon.id]: p }, stock);
export function supprimerPartie(idDonjon, stock = stockParDefaut()) {
  const { [idDonjon]: _supprimee, ...reste } = presentationsBrutes(stock);
  return sauverPresentations(reste, stock);
}
/** La partie telle qu'enregistrée, en texte (null si absente) : si elle diffère de ce qu'on y a lu ou écrit, un autre onglet l'a fait avancer. */
export function empreintePartie(idDonjon, stock = stockParDefaut()) {
  const toutes = presentationsBrutes(stock);
  return Object.prototype.hasOwnProperty.call(toutes, idDonjon) ? JSON.stringify(toutes[idDonjon]) : null;
}

/** Les fiches de l'outil Fiche dans ce navigateur : [{ source, fiche }]. Rien n'y est jamais écrit depuis le Donjon. */
export const chargerFichesLocales = (stock = stockParDefaut()) => fichesDuNavigateur(lireJson(stock, CLE_FICHES));

/** Modèles gardés par le MJ, validés un à un comme des donjons : un modèle abîmé est simplement écarté. */
export function chargerModeles(stock = stockParDefaut()) {
  const brut = lireJson(stock, CLE_MODELES);
  if (!Array.isArray(brut?.modeles)) return [];
  return brut.modeles.map((d) => validerDonjon(d).donjon).filter(Boolean);
}
export const sauverModeles = (modeles, stock = stockParDefaut()) => ecrireJson(stock, CLE_MODELES, { modeles });

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
 * Régie en retrait : retenu pour l'onglet seul, car un rechargement ne doit pas lui rendre la main, ni lui faire rouvrir la partie
 * d'une autre régie (la partie ouverte ci-dessus est commune aux onglets). `partie` : l'identifiant de sa partie, ou null sur la liste.
 */
export const memoriserRetrait = (idDonjon, stock = stockOnglet()) => ecrireJson(stock, CLE_RETRAIT, { partie: idDonjon ?? null });
export const oublierRetrait = (stock = stockOnglet()) => { try { stock?.removeItem?.(CLE_RETRAIT); } catch { /* sans mémoire */ } };
export const retraitMemorise = (stock = stockOnglet()) => {
  const m = lireJson(stock, CLE_RETRAIT);
  return m && typeof m === 'object' ? { partie: typeof m.partie === 'string' ? m.partie : null } : null;
};
/** La partie d'une régie en retrait parmi `presentations`, ou null. */
export const partieDuRetrait = (retrait, presentations) => (retrait?.partie && Object.prototype.hasOwnProperty.call(presentations, retrait.partie) ? presentations[retrait.partie] : null);

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

// --- Donjon entier (nouveau format) -----------------------------------------------

const nomDeFichier = (nom) => `${sansAccents(nom || 'donjon').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'donjon'}.json`;

/** Propose le téléchargement du donjon entier (salles, notes, liaisons, éléments cachés). */
export function exporterDonjon(donjon) {
  const blob = new Blob([texteDonjon(donjon)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nomDeFichier(donjon.nom);
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** Le donjon entier, sous forme de texte : ce que contient le fichier exporté, à copier-coller. */
export const texteDonjon = (donjon) => JSON.stringify(donjon, null, 2);

/**
 * Lit un texte JSON collé par l'utilisateur, sans rien en faire d'autre.
 * @throws {Error} message en français si le texte est trop long ou n'est pas du JSON
 */
export function lireTexteJson(texte) {
  if (texte.length > TAILLE_MAX_FICHIER) throw new Error('texte trop long (5 Mo au plus)');
  try {
    return JSON.parse(texte);
  } catch {
    throw new Error('ce texte n’est pas un donjon : il devrait commencer par { et finir par }');
  }
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
