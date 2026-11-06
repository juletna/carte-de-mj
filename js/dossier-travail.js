/**
 * Dossier de travail : le MJ choisit une fois un dossier de son ordinateur (File System Access API, Chrome et Edge sur ordinateur) ;
 * l'appli y recopie en direct tout ce qu'elle garde dans le navigateur (localStorage + images importées d'IndexedDB) et en relit la
 * bibliothèque de cartes. Dans un dossier Google Drive ou iCloud, deux ordinateurs se synchronisent. Sans dossier (ou sans l'API),
 * tout marche comme avant : localStorage, IndexedDB, export et import du .zip.
 *
 * Les décisions (noms de fichiers, comparaison, qui l'emporte au démarrage) sont dans dossier-travail-logique.js, testé.
 * Ici, tout ce qui touche au navigateur : poignée du dossier (rangée dans SA base IndexedDB « carte-de-mj-dossier »),
 * miroir des écritures, synchronisation au démarrage, états pour le dialogue (mj/sauvegarde-ui.js).
 *
 * Miroir : `installerMiroir()` (appelée tôt par navigation.js, sur toutes les pages) enveloppe Storage.prototype.setItem / removeItem /
 * clear pour le seul localStorage et les seules clés retenues. Une écriture déjà identique est ignorée. Sans dossier actif, la clé est
 * marquée « sale » (marqueur local) ; avec un dossier, l'écriture est groupée (~600 ms) puis faite par createWritable().
 * Un échec est affiché (état, console.warn), réessayé, puis laissé « sale » : jamais avalé.
 * Les images : images.js prévient (apresEcritureImages) ; on réécrit images/ et son index.
 *
 * États : indisponible | aucun | synchronisation | connecte | a-reconnecter | conflit | erreur.
 * Non testé sous Node (showDirectoryPicker, IndexedDB, FileSystemHandle) : voir le plan de vérification dans le README.
 */
import { cleRetenue, restaurer, nomsImages, contenuSauvegarde, nomAvantRestauration, resumeSauvegarde, TYPES_IMAGES } from './sauvegarde.js';
import { creerZip } from './zip.js';
import { listerImages, remplacerToutesImages, apresEcritureImages } from './bibliotheque/images.js';
import {
  CLE_LOCALE, NOM_MARQUEUR, nomFichierCle, cleDuFichier, donneesDuStock, comparer, signatureImage, planImages,
  lireMarqueur, texteMarqueur, lireLocal, decider, texteEtat, nomCopie,
} from './dossier-travail-logique.js';

const DELAI = 600;
const BASE = 'carte-de-mj-dossier';
const MAGASIN = 'poignee';
const CLE_POIGNEE = 'dossier';
const ETATS_A_SIGNALER = ['a-reconnecter', 'conflit', 'erreur'];

/* ------------------------------------------------------------------ état partagé */

let etat = 'aucun', poignee = null, racine = null, nom = '', quand = null, derniere = '', conflit = null, erreurEtat = '';
let local = { appareil: '', dernierSync: null, sale: false };
let ecrits = new Map();           // clé → texte tel qu'il est dans le dossier
let imagesEcrites = new Map();    // id → { sig, fichier } tel qu'il est dans le dossier
const enAttente = new Set();      // clés à recopier
let minuteur = null, minuteurImages = null, imagesEnAttente = false;
let echecs = 0, saleHors = false, saleParErreur = false, muet = 0, file = Promise.resolve(), installe = false;
let set0, rem0, clear0;
const auditeurs = new Set();
let finDemarrage;
/** Résolue quand le démarrage a fini de se prononcer (dossier connecté, à reconnecter, absent…). */
export const dossierPret = new Promise((r) => { finDemarrage = r; });

export const dossierDisponible = () => typeof globalThis.showDirectoryPicker === 'function';
/** Le dossier utilisable en lecture (poignée), ou null s'il n'est pas connecté. */
export const dossierActif = () => racine ?? (etat === 'conflit' ? poignee : null);
export const etatDossier = () => ({ etat, nom, quand, erreur: etat === 'connecte' ? derniere : erreurEtat, conflit, texte: texteEtat({ etat, nom, quand, erreur: etat === 'connecte' ? derniere : erreurEtat }) });
export function surEtatDossier(fn) { auditeurs.add(fn); return () => auditeurs.delete(fn); }

function definir(nouvel, erreur = '') {
  etat = nouvel; erreurEtat = erreur;
  appliquerIndice();
  for (const f of auditeurs) { try { f(etatDossier()); } catch (e) { console.warn('dossier de travail :', e); } }
}

/** Signale sur le bouton « Sauvegarde » de la barre (attribut data-dossier + titre) qu'il y a quelque chose à faire. */
function appliquerIndice() {
  if (typeof document === 'undefined') return;
  const signaler = ETATS_A_SIGNALER.includes(etat);
  document.documentElement.dataset.dossier = etat;
  const titres = { 'a-reconnecter': 'Sauvegarde : le dossier de travail attend ton autorisation (clique pour le reconnecter)', conflit: 'Sauvegarde : le dossier de travail et ce navigateur diffèrent, un choix est attendu', erreur: 'Sauvegarde : le dossier de travail pose problème' };
  for (const b of document.querySelectorAll('.menu-sauvegarde')) {
    b.dataset.titreOrigine ??= b.getAttribute('title') ?? '';
    if (signaler) { b.dataset.dossier = etat; b.setAttribute('title', titres[etat]); } else { delete b.dataset.dossier; b.setAttribute('title', b.dataset.titreOrigine); }
  }
}

/* ------------------------------------------------------------------ marqueur local et poignée */

const nouvelAppareil = () => `app-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
function lireLocalStocke() {
  let texte = null;
  try { texte = localStorage.getItem(CLE_LOCALE); } catch { /* stockage bloqué */ }
  local = lireLocal(texte, nouvelAppareil);
}
function ecrireLocal() { try { (set0 ?? Storage.prototype.setItem).call(localStorage, CLE_LOCALE, JSON.stringify(local)); } catch { /* le marqueur est une aide : sans lui, on demandera au pire un choix */ } }
function marquerSale() { if (!local.sale) { local.sale = true; ecrireLocal(); } }

function baseDossier() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('IndexedDB indisponible')); return; }
    const req = indexedDB.open(BASE, 1);
    req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(MAGASIN)) req.result.createObjectStore(MAGASIN); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('base du dossier illisible'));
  });
}
async function surPoignee(mode, action) {
  const db = await baseDossier();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(MAGASIN, mode);
      const req = action(tx.objectStore(MAGASIN));
      tx.oncomplete = () => resolve(req?.result);
      tx.onerror = tx.onabort = () => reject(tx.error ?? new Error('base du dossier inaccessible'));
    });
  } finally { db.close(); }
}
const lirePoignee = () => surPoignee('readonly', (s) => s.get(CLE_POIGNEE));
const rangerPoignee = (p) => surPoignee('readwrite', (s) => s.put(p, CLE_POIGNEE));
const oublierPoignee = () => surPoignee('readwrite', (s) => s.delete(CLE_POIGNEE));

/* ------------------------------------------------------------------ accès au dossier */

const ignorerAbsent = (e) => { if (e?.name !== 'NotFoundError') throw e; };
const base = (chemin) => chemin.slice(chemin.lastIndexOf('/') + 1);
const messageDe = (e) => (e?.name === 'QuotaExceededError' ? 'espace disque plein' : (e?.message || String(e)));

async function sousDossier(parent, nomDossier, creer = false) {
  try { return await parent.getDirectoryHandle(nomDossier, { create: creer }); } catch (e) { if (!creer && e?.name === 'NotFoundError') return null; throw e; }
}
async function ecrireFichier(dossier, fichier, contenu) {
  const fh = await dossier.getFileHandle(fichier, { create: true });
  const w = await fh.createWritable();
  try { await w.write(contenu); await w.close(); } catch (e) { try { await w.abort(); } catch { /* déjà fermé */ } throw e; }
}
async function lireTexte(dossier, fichier) {
  try { return await (await (await dossier.getFileHandle(fichier)).getFile()).text(); } catch (e) { ignorerAbsent(e); return null; }
}

/** Ce que contient le dossier : { marqueur, modifie, donnees: Map, images: [{ meta, fichier, file }], sigImages: Map, vide, ignores }. */
async function lireDossier(p) {
  const res = { marqueur: null, modifie: '', donnees: new Map(), images: [], sigImages: new Map(), ignores: [], vide: true };
  const texteMarq = await lireTexte(p, NOM_MARQUEUR);
  if (texteMarq !== null) { res.marqueur = lireMarqueur(texteMarq); res.modifie = res.marqueur?.modifie ?? ''; }
  const dd = await sousDossier(p, 'donnees');
  if (dd) {
    for await (const [fichier, h] of dd.entries()) {
      if (h.kind !== 'file') continue;
      const cle = cleDuFichier(fichier);
      if (!cle) { if (fichier.endsWith('.json')) res.ignores.push(fichier); continue; }
      res.donnees.set(cle, await (await h.getFile()).text());
    }
  }
  const di = await sousDossier(p, 'images');
  const index = di ? await lireTexte(di, 'index.json') : null;
  if (index !== null) {
    let liste = [];
    try { liste = JSON.parse(index); } catch { res.ignores.push('images/index.json'); }
    for (const meta of Array.isArray(liste) ? liste : []) {
      if (!meta || typeof meta.id !== 'string' || !meta.id || typeof meta.fichier !== 'string' || !/^images\/[A-Za-z0-9_.-]+$/.test(meta.fichier) || !Object.hasOwn(TYPES_IMAGES, meta.type)) continue;
      let f;
      try { f = await (await di.getFileHandle(base(meta.fichier))).getFile(); } catch (e) { ignorerAbsent(e); continue; }
      res.images.push({ meta, fichier: meta.fichier, file: f });
      res.sigImages.set(meta.id, signatureImage(meta, f.size));
    }
  }
  res.vide = !res.marqueur && texteMarq === null && !res.donnees.size && index === null;
  return res;
}

/** Ce que contient le navigateur : { donnees: Map, images (avec blob), sigImages: Map }. */
async function lireNavigateur() {
  const donnees = donneesDuStock(localStorage);
  let images = [];
  try { images = (await listerImages()).sort((a, b) => (a.id < b.id ? -1 : 1)); } catch (e) { console.warn('dossier de travail : images illisibles', e); }
  return { donnees, images, sigImages: new Map(images.map((e) => [e.id, signatureImage(e, e.blob?.size ?? 0)])) };
}

async function ecrireMarqueur() {
  const modifie = new Date().toISOString();
  await ecrireFichier(racine ?? poignee, NOM_MARQUEUR, texteMarqueur({ modifie, appareil: local.appareil }));
  local.dernierSync = modifie;
  ecrireLocal();
}

/** Recopie les images dans images/ : écrit les nouvelles ou changées, supprime les disparues, réécrit l'index. `images` : triées par id. */
async function appliquerImages(p, images) {
  const noms = nomsImages(images);
  const apres = new Map(images.map((e, i) => [e.id, { sig: signatureImage(e, e.blob?.size ?? 0), fichier: noms[i] }]));
  const plan = planImages(imagesEcrites, apres);
  if (!plan.ecrire.length && !plan.supprimer.length) return;
  const dir = await sousDossier(p, 'images', true);
  for (const f of plan.supprimer) await dir.removeEntry(base(f)).catch(ignorerAbsent);
  const parId = new Map(images.map((e) => [e.id, e]));
  for (const id of plan.ecrire) await ecrireFichier(dir, base(apres.get(id).fichier), parId.get(id).blob);
  const index = images.map((e, i) => { const { blob, ...meta } = e; return { ...meta, fichier: noms[i] }; });
  await ecrireFichier(dir, 'index.json', JSON.stringify(index, null, 1));
  imagesEcrites = apres;
}

function etatImagesDuDossier(dossier) {
  return new Map(dossier.images.map((i) => [i.meta.id, { sig: dossier.sigImages.get(i.meta.id), fichier: i.fichier }]));
}

/** Écrit tout le navigateur dans le dossier (ce qui y est déjà à l'identique n'est pas réécrit). */
async function pousserTout(p, nav, dossier) {
  const dd = await sousDossier(p, 'donnees', true);
  for (const [cle, texte] of nav.donnees) if (dossier.donnees.get(cle) !== texte) await ecrireFichier(dd, nomFichierCle(cle), texte);
  for (const cle of dossier.donnees.keys()) if (!nav.donnees.has(cle)) await dd.removeEntry(nomFichierCle(cle)).catch(ignorerAbsent);
  ecrits = new Map(nav.donnees);
  imagesEcrites = etatImagesDuDossier(dossier);
  await appliquerImages(p, nav.images);
  racine = p;
  await ecrireMarqueur();
  local.sale = false; saleHors = false; ecrireLocal();
}

/** Copie le contenu du dossier (marqueur, donnees/, images/) dans copies/<date>/ avant de le remplacer. Rend le chemin de la copie. */
async function copierDossierAvant(p) {
  const nomC = nomCopie(new Date());
  const cible = await sousDossier(await sousDossier(p, 'copies', true), nomC, true);
  const copier = async (de, vers) => { for await (const [n, h] of de.entries()) if (h.kind === 'file') await ecrireFichier(vers, n, await h.getFile()); };
  const marq = await lireTexte(p, NOM_MARQUEUR);
  if (marq !== null) await ecrireFichier(cible, NOM_MARQUEUR, marq);
  for (const sd of ['donnees', 'images']) { const de = await sousDossier(p, sd); if (de) await copier(de, await sousDossier(cible, sd, true)); }
  return `copies/${nomC}`;
}

/** Télécharge l'état actuel du navigateur (zip), comme avant une restauration. */
async function telechargerAvant() {
  const maintenant = new Date();
  let images = [];
  try { images = await listerImages(); } catch { /* sans images : le reste part quand même */ }
  const contenu = await contenuSauvegarde({ stock: localStorage, images, maintenant });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([creerZip(contenu.fichiers)], { type: 'application/zip' }));
  a.download = nomAvantRestauration(maintenant);
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** Remplace le navigateur par le contenu du dossier. Garde le silence (muet) puis recharge la page. */
async function tirerTout(p, dossier, sauvegarderAvant) {
  if (sauvegarderAvant) await telechargerAvant();
  muet++; // jamais relâché sur le chemin normal : la page se recharge
  try {
    const avant = donneesDuStock(localStorage);
    const r = restaurer({ manifeste: { cles: Object.fromEntries(dossier.donnees) }, stock: localStorage });
    if (!r.ok) throw new Error(r.erreur);
    let imagesAvant = [];
    try { imagesAvant = await listerImages(); } catch { /* IndexedDB indisponible */ }
    if (dossier.images.length || imagesAvant.length) {
      try {
        const entrees = [];
        for (const { meta, file } of dossier.images) {
          const { fichier, ...reste } = meta;
          entrees.push({ ...reste, blob: new Blob([await file.arrayBuffer()], { type: meta.type }) });
        }
        await remplacerToutesImages(entrees);
      } catch (e) {
        restaurer({ manifeste: { cles: Object.fromEntries(avant) }, stock: localStorage });
        throw new Error(`images non chargées (${messageDe(e)}) ; données remises comme avant`);
      }
    }
  } catch (e) { muet--; throw e; }
  ecrits = new Map(dossier.donnees);
  imagesEcrites = etatImagesDuDossier(dossier);
  local.dernierSync = dossier.modifie || null; local.sale = false; saleHors = false; ecrireLocal();
  definir('synchronisation');
  setTimeout(() => location.reload(), 300);
}

/* ------------------------------------------------------------------ connexion et décision */

function resumeDe(donnees, nbImages) {
  return resumeSauvegarde({ cles: Object.fromEntries(donnees), images: new Array(nbImages) });
}

async function connecter(p) {
  poignee = p; nom = p.name; racine = null; conflit = null;
  definir('synchronisation');
  try {
    const dossier = await lireDossier(p);
    const nav = await lireNavigateur();
    const identique = comparer(nav.donnees, dossier.donnees).identique && comparer(nav.sigImages, dossier.sigImages).identique;
    const d = decider({ dossier: { vide: dossier.vide, modifie: dossier.modifie }, navigateur: { vide: !nav.donnees.size && !nav.images.length }, identique, local });
    if (d.action === 'pousser') await pousserTout(p, nav, dossier);
    else if (d.action === 'tirer') { await tirerTout(p, dossier, d.sauvegarderAvant); return; }
    else if (d.action === 'conflit') {
      conflit = { raison: d.raison, modifie: dossier.modifie, dossier: resumeDe(dossier.donnees, dossier.images.length), navigateur: resumeDe(nav.donnees, nav.images.length) };
      definir('conflit');
      return;
    } else {
      racine = p; ecrits = new Map(dossier.donnees); imagesEcrites = etatImagesDuDossier(dossier);
      if (!dossier.marqueur) await ecrireMarqueur(); else { local.dernierSync = dossier.modifie; ecrireLocal(); }
      local.sale = false; saleHors = false; ecrireLocal();
    }
    enAttente.clear(); echecs = 0; derniere = ''; quand = new Date();
    definir('connecte');
    rattraper();
  } catch (e) {
    racine = null;
    console.warn('dossier de travail :', e);
    if (e?.name === 'NotAllowedError' || e?.name === 'SecurityError') definir('a-reconnecter'); else definir('erreur', messageDe(e));
  }
}

/** Écritures faites pendant la synchronisation (non vues par le miroir) : on recopie ce qui diffère encore. */
function rattraper() {
  const actuel = donneesDuStock(localStorage), c = comparer(actuel, ecrits);
  for (const cle of [...c.differentes, ...c.seulA, ...c.seulB]) enAttente.add(cle);
  if (enAttente.size) planifier();
}

async function demarrer() {
  try {
    navigator.storage?.persist?.().catch(() => {});
    if (!dossierDisponible()) { definir('indisponible'); return; }
    const p = await lirePoignee();
    if (!p) { definir('aucun'); return; }
    poignee = p; nom = p.name;
    if (await p.queryPermission({ mode: 'readwrite' }) === 'granted') await connecter(p); else definir('a-reconnecter');
  } catch (e) {
    console.warn('dossier de travail :', e);
    definir('erreur', messageDe(e));
  } finally { finDemarrage(); }
}

/* ------------------------------------------------------------------ actions du dialogue */

/** Ouvre le sélecteur de dossier (geste de l'utilisateur) puis connecte. Rend false si l'utilisateur annule. */
export async function choisirDossier() {
  if (!dossierDisponible()) throw new Error('ce navigateur ne sait pas ouvrir un dossier (Chrome ou Edge sur ordinateur)');
  let p;
  try { p = await globalThis.showDirectoryPicker({ id: 'carte-de-mj', mode: 'readwrite' }); } catch (e) { if (e?.name === 'AbortError') return false; throw e; }
  await rangerPoignee(p);
  local.dernierSync = null; ecrireLocal();
  await enFile(() => connecter(p));
  return true;
}

/** Redemande l'autorisation d'écrire (à appeler depuis un clic). */
export async function reconnecter() {
  if (!poignee) throw new Error('aucun dossier à reconnecter');
  const permission = await poignee.requestPermission({ mode: 'readwrite' });
  if (permission !== 'granted') { definir('a-reconnecter'); return false; }
  await enFile(() => connecter(poignee));
  return true;
}

/** Oublie le dossier (les fichiers restent où ils sont). */
export async function dissocier() {
  clearTimeout(minuteur); clearTimeout(minuteurImages);
  enAttente.clear(); imagesEnAttente = false;
  await oublierPoignee();
  poignee = null; racine = null; nom = ''; conflit = null; quand = null; derniere = '';
  local.dernierSync = null; local.sale = false; saleHors = false; ecrireLocal();
  definir('aucun');
}

/** Tranche un conflit : 'dossier' (le navigateur est remplacé, son état est téléchargé avant) ou 'navigateur' (le dossier est remplacé, son contenu copié avant dans copies/<date>/). */
export async function resoudreConflit(choix) {
  if (etat !== 'conflit' || !poignee) return;
  await enFile(async () => {
    const dossier = await lireDossier(poignee);
    try {
      if (choix === 'dossier') { await tirerTout(poignee, dossier, true); return; }
      definir('synchronisation');
      await copierDossierAvant(poignee);
      await pousserTout(poignee, await lireNavigateur(), dossier);
      conflit = null; enAttente.clear(); echecs = 0; derniere = ''; quand = new Date();
      definir('connecte');
      rattraper();
    } catch (e) { console.warn('dossier de travail :', e); definir('erreur', messageDe(e)); }
  });
}

/* ------------------------------------------------------------------ miroir des écritures */

function enFile(fn) { file = file.catch(() => {}).then(fn); return file; }

function noter(cle) {
  if (muet) return;
  if (etat === 'connecte') { enAttente.add(cle); planifier(); } else { saleHors = true; marquerSale(); }
}
function planifier() { clearTimeout(minuteur); minuteur = setTimeout(() => enFile(vider), DELAI); }
function planifierImages() { imagesEnAttente = true; clearTimeout(minuteurImages); minuteurImages = setTimeout(() => enFile(synchroImages), DELAI); }

function succes() {
  echecs = 0; derniere = ''; quand = new Date();
  if (saleParErreur && !saleHors) { local.sale = false; ecrireLocal(); }
  saleParErreur = false;
  definir(etat);
}
function echec(e) {
  derniere = messageDe(e); echecs++;
  console.warn('dossier de travail : écriture impossible', e);
  saleParErreur = true; marquerSale();
  if (e?.name === 'NotAllowedError' || e?.name === 'SecurityError') { racine = null; definir('a-reconnecter'); return; }
  definir(etat);
  if (echecs < 3) setTimeout(() => { if (enAttente.size) planifier(); if (imagesEnAttente) planifierImages(); }, 3000 * echecs);
}

async function vider() {
  if (etat !== 'connecte' || !racine || !enAttente.size) return;
  try {
    const dd = await sousDossier(racine, 'donnees', true);
    for (const cle of [...enAttente]) {
      const valeur = localStorage.getItem(cle);
      if (valeur === null) { if (ecrits.has(cle)) { await dd.removeEntry(nomFichierCle(cle)).catch(ignorerAbsent); ecrits.delete(cle); } }
      else if (ecrits.get(cle) !== valeur) { await ecrireFichier(dd, nomFichierCle(cle), valeur); ecrits.set(cle, valeur); }
      enAttente.delete(cle);
    }
    await ecrireMarqueur();
    succes();
  } catch (e) { echec(e); }
}

async function synchroImages() {
  if (etat !== 'connecte' || !racine) return;
  imagesEnAttente = false;
  try {
    const images = (await listerImages()).sort((a, b) => (a.id < b.id ? -1 : 1));
    await appliquerImages(racine, images);
    await ecrireMarqueur();
    succes();
  } catch (e) { imagesEnAttente = true; echec(e); }
}

/** Page masquée ou fermée : on vide tout de suite ; si la page part avant la fin, le marqueur « sale » le dira au prochain démarrage. */
function viderMaintenant() {
  if (etat !== 'connecte' || (!enAttente.size && !imagesEnAttente)) return;
  saleParErreur = true; marquerSale();
  clearTimeout(minuteur); clearTimeout(minuteurImages);
  if (enAttente.size) enFile(vider);
  if (imagesEnAttente) enFile(synchroImages);
}

const estLocal = (stock) => { try { return stock === localStorage; } catch { return false; } };

/**
 * À appeler une fois, tôt et sans attendre (navigation.js) : installe le miroir et lance le démarrage. Sans effet sous Node.
 * Les écritures faites avant cet appel ne sont pas vues : la comparaison du démarrage les retrouve.
 */
export function installerMiroir() {
  if (installe || typeof Storage === 'undefined' || typeof document === 'undefined') return;
  try { void localStorage; } catch { return; }
  installe = true;
  set0 = Storage.prototype.setItem; rem0 = Storage.prototype.removeItem; clear0 = Storage.prototype.clear;
  lireLocalStocke();
  Storage.prototype.setItem = function setItem(cle, valeur) {
    const suivre = estLocal(this) && cleRetenue(String(cle));
    const avant = suivre ? this.getItem(cle) : null;
    set0.call(this, cle, valeur);
    if (suivre && avant !== String(valeur)) noter(String(cle));
  };
  Storage.prototype.removeItem = function removeItem(cle) {
    const suivre = estLocal(this) && cleRetenue(String(cle)) && this.getItem(cle) !== null;
    rem0.call(this, cle);
    if (suivre) noter(String(cle));
  };
  Storage.prototype.clear = function clear() {
    const cles = estLocal(this) ? Array.from({ length: this.length }, (_, i) => this.key(i)).filter(cleRetenue) : [];
    clear0.call(this);
    for (const c of cles) noter(c);
  };
  apresEcritureImages.add(() => {
    if (muet) return;
    if (etat === 'connecte') planifierImages(); else { saleHors = true; marquerSale(); }
  });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') viderMaintenant(); });
  addEventListener('pagehide', viderMaintenant);
  addEventListener('load', appliquerIndice);
  if (document.head) {
    const lien = document.createElement('link');
    lien.rel = 'stylesheet';
    lien.href = new URL('../css/dossier.css', import.meta.url).href;
    document.head.append(lien);
  }
  Promise.resolve().then(demarrer);
}
