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
 *   carte-de-mj:mis-de-cote-v1    { entrees: [{ cle, le, raison, valeur }] }  (copies de ce qui ne se relit pas : voir « Mise de côté »)
 *   jdr-carte:v1              ANCIENNE clé (une salle) : lue une fois pour la migration, jamais supprimée
 *
 * Rien de ce qui est enregistré ne se perd en silence : un donjon ou un modèle qui ne se relit pas (écrit par une version plus
 * récente de l'outil, abîmé…) est d'abord copié dans la clé de secours, et seulement ensuite le reste est réécrit. Si la copie
 * échoue (stockage plein), la clé d'origine n'est PAS réécrite.
 *
 * Les fonctions de lecture/écriture acceptent un `stock` (par défaut localStorage) pour être testées sous Node.
 */
import { validerDonjon, donjonDepuisAncien, creerDonjon, FORMAT, VERSION, FORMAT_ANCIEN } from './donjon.js';
import { validerPresentation } from './presentation.js';
import { fichesDuNavigateur } from './personnages.js';
import { TAILLE_PAR_DEFAUT, ECHELLE_PAR_DEFAUT, MODES_TABLE, tailleReglable } from './affichage.js';
import { sansAccents, estObjet } from './format.js';

export const CLE_DONJONS = 'carte-de-mj:donjons-v1';
export const CLE_REGLAGES = 'carte-de-mj:reglages-v1';
export const CLE_PRESENTATIONS = 'carte-de-mj:presentations-v1';
export const CLE_PARTIE_OUVERTE = 'carte-de-mj:partie-ouverte-v1';
export const CLE_MODELES = 'carte-de-mj:modeles-v1';
export const CLE_FICHES = 'dd-fiche-personnages-v1';
export const CLE_RETRAIT = 'carte-de-mj:regie-retrait-v1';
export const CLE_MIS_DE_COTE = 'carte-de-mj:mis-de-cote-v1';
const CLE_ANCIENNE = `${FORMAT_ANCIEN}:v1`;
const TAILLE_MAX_FICHIER = 5 * 1024 * 1024;
const REGLAGES_DEFAUT = { echelle: ECHELLE_PAR_DEFAUT, taille: TAILLE_PAR_DEFAUT, grille: true };

const stockParDefaut = () => { try { return globalThis.localStorage || null; } catch { return null; } };
const stockOnglet = () => { try { return globalThis.sessionStorage || null; } catch { return null; } };
/** Le texte enregistré sous `cle` et ce qu'il donne : `brut` vaut null si la clé est vide, undefined si le texte n'est pas du JSON. */
function lireBrut(stock, cle) {
  let texte = null;
  try { texte = stock?.getItem(cle) || null; } catch { /* stockage bloqué : comme s'il était vide */ }
  if (!texte) return { texte: null, brut: null };
  try { return { texte, brut: JSON.parse(texte) }; } catch { return { texte, brut: undefined }; }
}
const lireJson = (stock, cle) => lireBrut(stock, cle).brut ?? null;
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

// --- Migration et mise de côté ---------------------------------------------------------

/**
 * Les étapes de migration d'un donjon enregistré : ETAPES[n] rend la version n+1 à partir de la version n, sans toucher à son argument.
 * Vide : le format n'a connu que la version 1. Le jour où `VERSION` passe à 2, l'étape 1 s'écrit ici et les donjons enregistrés
 * en version 1 sont relus sans rien perdre.
 */
const ETAPES = {};

/** Amène un donjon enregistré à la version actuelle. Ce qu'aucune étape ne sait amener (version plus récente, inconnue) est rendu tel quel. */
export function migrer(brut, etapes = ETAPES, version = VERSION) {
  let d = brut;
  for (let n = 0; n < 100 && estObjet(d) && d.format === FORMAT && Number.isInteger(d.version) && d.version < version && etapes[d.version]; n++) d = etapes[d.version](d);
  return d;
}

/**
 * Mise de côté : ce qui ne se relit pas est copié, tel quel, dans CLE_MIS_DE_COTE avant que la clé d'origine soit réécrite.
 * Une copie déjà là (même clé d'origine, même contenu) n'est pas refaite : recharger dix fois la page n'ajoute rien.
 */
const MAX_RAISON = 200;
const empreinte = (cle, valeur) => `${cle}\n${JSON.stringify(valeur)}`;

/** @returns {boolean} true : chaque élément est en sécurité (déjà copié, ou copié à l'instant) ; false : la copie a échoué, rien n'est à réécrire. */
function mettreDeCote(stock, cle, ecartes) {
  if (!ecartes.length) return true;
  const { texte, brut } = lireBrut(stock, CLE_MIS_DE_COTE);
  if (texte && !(estObjet(brut) && Array.isArray(brut.entrees))) return false; // la clé de secours est elle-même abîmée : on n'y touche pas
  const entrees = brut?.entrees ?? [];
  const connues = new Set(entrees.map((e) => empreinte(e.cle, e.valeur)));
  const neuves = [];
  for (const e of ecartes) {
    if (connues.has(empreinte(cle, e.valeur))) continue;
    connues.add(empreinte(cle, e.valeur));
    neuves.push({ cle, le: new Date().toISOString(), raison: String(e.raison).slice(0, MAX_RAISON), valeur: e.valeur });
  }
  return !neuves.length || ecrireJson(stock, CLE_MIS_DE_COTE, { entrees: [...entrees, ...neuves] });
}

/** Les copies mises de côté dans ce navigateur : [{ cle, le, raison, valeur }]. */
export function misDeCote(stock = stockParDefaut()) {
  const entrees = lireJson(stock, CLE_MIS_DE_COTE)?.entrees;
  return Array.isArray(entrees) ? entrees : [];
}

// Une clé dont la copie a échoué ne doit plus être réécrite pendant cette session (sinon le premier enregistrement détruirait l'original).
const verrous = new WeakMap();
const verrouiller = (stock, cle) => { if (stock) verrous.set(stock, (verrous.get(stock) || new Set()).add(cle)); };
const verrouillee = (stock, cle) => !!stock && !!verrous.get(stock)?.has(cle);

/**
 * Relit une clé qui contient des donjons, un par entrée, sans rien écrire.
 * `entrees(brut)` : les donjons du JSON lu (liste ou dictionnaire), ou null si sa forme n'est pas celle attendue.
 * @returns {{ brut:*, valides: {donjon:object, brut:*}[], ecartes: {valeur:*, raison:string}[] }}  `ecartes` : tout ce qui ne se relit pas
 */
function relireDonjons(stock, cle, entrees) {
  const { texte, brut } = lireBrut(stock, cle);
  if (texte === null || brut === null) return { brut, valides: [], ecartes: [] };
  if (brut === undefined) return { brut, valides: [], ecartes: [{ valeur: texte, raison: 'texte illisible' }] };
  const liste = entrees(brut);
  if (!liste) return { brut, valides: [], ecartes: [{ valeur: brut, raison: 'forme inconnue' }] };
  const valides = [], ecartes = [];
  for (const d of liste) {
    const v = validerDonjon(migrer(d));
    if (v.donjon) valides.push({ donjon: v.donjon, brut: d });
    else ecartes.push({ valeur: d, raison: v.erreurs.join(' · ') });
  }
  return { brut, valides, ecartes };
}

/** Les donjons enregistrés : { etat: { actif, donjons } | null, ecartes }. Un identifiant en double garde le dernier ; l'autre est écarté. */
function lireDonjons(stock) {
  const entrees = (brut) => (estObjet(brut) && typeof brut.donjons === 'object' && brut.donjons !== null ? Object.values(brut.donjons) : null);
  const { brut, valides, ecartes } = relireDonjons(stock, CLE_DONJONS, entrees);
  const donjons = {}, bruts = {};
  for (const v of valides) {
    if (v.donjon.id in donjons) ecartes.push({ valeur: bruts[v.donjon.id], raison: 'identifiant déjà pris par un autre donjon' });
    donjons[v.donjon.id] = v.donjon;
    bruts[v.donjon.id] = v.brut;
  }
  const ids = Object.keys(donjons);
  return { etat: ids.length ? { actif: ids.includes(brut.actif) ? brut.actif : ids[0], donjons } : null, ecartes };
}

/** Donjons sauvegardés, validés un à un : { actif, donjons } ou null si la clé manque. Ne modifie rien. */
export const chargerDonjons = (stock = stockParDefaut()) => lireDonjons(stock).etat;
/** Enregistre les donjons. Faux (rien n'est écrit) si la copie de ce qui ne se relisait pas a échoué au démarrage : voir chargerTout. */
export const sauverDonjons = (etat, stock = stockParDefaut()) => !verrouillee(stock, CLE_DONJONS) && ecrireJson(stock, CLE_DONJONS, { actif: etat.actif, donjons: etat.donjons });

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

/** Modèles gardés par le MJ, validés un à un comme des donjons : un modèle abîmé est écarté (et mis de côté avant que la clé soit réécrite). */
const lireModeles = (stock) => relireDonjons(stock, CLE_MODELES, (brut) => (estObjet(brut) && Array.isArray(brut.modeles) ? brut.modeles : null));
export const chargerModeles = (stock = stockParDefaut()) => lireModeles(stock).valides.map((v) => v.donjon);
/** Enregistre les modèles. Faux (rien n'est écrit) si ce qui ne se relisait pas n'a pas pu être mis de côté d'abord. */
export const sauverModeles = (modeles, stock = stockParDefaut()) => mettreDeCote(stock, CLE_MODELES, lireModeles(stock).ecartes) && ecrireJson(stock, CLE_MODELES, { modeles });

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
 * Avant tout, ce qui est enregistré et ne se relit pas est mis de côté (voir plus haut) : le premier enregistrement qui suit
 * réécrit la clé des donjons, il ne doit rien y détruire. Si la copie échoue, cette clé n'est plus écrite de la session.
 * @returns {{actif:string, donjons:object, reglages:object, migre:boolean, miseDeCote:{nombre:number, ok:boolean}|null}}
 *          `miseDeCote` : null si tout se relisait ; sinon le nombre d'éléments concernés, et `ok` faux si la copie a échoué
 */
export function chargerTout({ texteInitial, stock = stockParDefaut() } = {}) {
  const lus = lireDonjons(stock);
  let etat = lus.etat;
  let miseDeCote = null;
  if (lus.ecartes.length) {
    const ok = mettreDeCote(stock, CLE_DONJONS, lus.ecartes);
    if (!ok) verrouiller(stock, CLE_DONJONS);
    miseDeCote = { nombre: lus.ecartes.length, ok };
  }
  let migre = false;
  const ancien = lireJson(stock, CLE_ANCIENNE);
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
  return { ...etat, reglages, migre, miseDeCote };
}

/** Ce qu'on dit au MJ après une mise de côté (voir chargerTout) : ce qui s'est passé, et que rien n'est perdu. */
export const phraseMiseDeCote = ({ ok }) => (ok
  ? 'Des données enregistrées dans ce navigateur n’ont pas pu être relues (écrites par une version plus récente de l’outil, ou abîmées). Rien n’est perdu : une copie est gardée à part.'
  : 'Des données enregistrées dans ce navigateur n’ont pas pu être relues, et leur copie de sécurité n’a pas pu être faite (stockage plein ou bloqué). Pour ne rien écraser, tes modifications ne seront pas enregistrées ici : exporte ton donjon.');

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
