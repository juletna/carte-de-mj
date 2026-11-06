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
 * Les images : images.js prévient (apresEcritureImages) ; on relit images/index.json (le skill generer-carte y ajoute des cartes),
 * on importe ce qui manque au navigateur, puis on réécrit images/ et son index sans jamais en retirer une entrée ajoutée hors de
 * l'appli : seules les images supprimées ici (marqueur local, `supprimees`) en sortent. Même relecture au démarrage et au retour
 * sur l'onglet. Un ancien bibliotheque/catalogue.json du dossier est importé une fois dans la liste (migrerBibliotheque).
 *
 * États : indisponible | aucun | synchronisation | connecte | a-reconnecter | conflit | erreur.
 * Non testé sous Node (showDirectoryPicker, IndexedDB, FileSystemHandle) : voir le plan de vérification dans le README.
 */
import { cleRetenue, restaurer, nomsImages, contenuSauvegarde, nomAvantRestauration, resumeSauvegarde, TYPES_IMAGES } from './sauvegarde.js';
import { creerZip } from './zip.js';
import { listerImages, remplacerToutesImages, ajouterImages, apresEcritureImages, dimensions } from './bibliotheque/images.js';
import { validerCatalogue } from './bibliotheque/catalogue.js';
import {
  CLE_LOCALE, NOM_MARQUEUR, nomFichierCle, cleDuFichier, donneesDuStock, comparer, signatureImage, planDossierImages,
  lireMarqueur, texteMarqueur, lireLocal, decider, texteEtat, nomCopie, noterSuppressions, ajoutsDuDossier, cartesAMigrer,
  entreeDeCarte, lireMigrees,
} from './dossier-travail-logique.js';

const DELAI = 600;
const BASE = 'carte-de-mj-dossier';
const MAGASIN = 'poignee';
const CLE_POIGNEE = 'dossier';
const ETATS_A_SIGNALER = ['a-reconnecter', 'conflit', 'erreur'];

/* ------------------------------------------------------------------ état partagé */

let etat = 'aucun', poignee = null, racine = null, nom = '', quand = null, derniere = '', conflit = null, erreurEtat = '';
let local = { appareil: '', dernierSync: null, sale: false, supprimees: [] };
let ecrits = new Map();           // clé → texte tel qu'il est dans le dossier
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

/**
 * Ce que contient images/ : { index: entrées brutes de index.json, present (index.json existe), images: [{ meta, fichier, file }]
 * (entrées lisibles), sigImages: Map, ignores }.
 */
async function lireImagesDossier(p) {
  const res = { index: [], present: false, images: [], sigImages: new Map(), ignores: [] };
  const di = await sousDossier(p, 'images');
  const texte = di ? await lireTexte(di, 'index.json') : null;
  if (texte === null) return res;
  res.present = true;
  try { res.index = JSON.parse(texte); } catch { res.ignores.push('images/index.json'); }
  if (!Array.isArray(res.index)) res.index = [];
  for (const meta of res.index) {
    if (!meta || typeof meta.id !== 'string' || !meta.id || typeof meta.fichier !== 'string' || !/^images\/[A-Za-z0-9_.-]+$/.test(meta.fichier) || !Object.hasOwn(TYPES_IMAGES, meta.type)) continue;
    let f;
    try { f = await (await di.getFileHandle(base(meta.fichier))).getFile(); } catch (e) { ignorerAbsent(e); continue; }
    res.images.push({ meta, fichier: meta.fichier, file: f });
    res.sigImages.set(meta.id, signatureImage(meta, f.size));
  }
  return res;
}

/** Ce que contient le dossier : { marqueur, modifie, donnees: Map, imagesDossier, images, sigImages, vide, ignores }. */
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
  res.imagesDossier = await lireImagesDossier(p);
  res.images = res.imagesDossier.images; res.sigImages = res.imagesDossier.sigImages;
  res.ignores.push(...res.imagesDossier.ignores);
  res.vide = !res.marqueur && texteMarq === null && !res.donnees.size && !res.imagesDossier.present;
  return res;
}

/**
 * Importe dans le navigateur, sans rien recopier, les images que le dossier a et que le navigateur n'a pas (skill generer-carte,
 * autre ordinateur…), sauf celles que le MJ a supprimées ici. Rend le nombre d'images importées. Sans IndexedDB : rien (et
 * planDossierImages garde alors ces entrées telles quelles).
 */
async function importerAjouts(imagesDossier) {
  let navigateur;
  try { navigateur = new Set((await listerImages()).map((e) => e.id)); } catch (e) { console.warn('dossier de travail : images illisibles', e); return 0; }
  const fichiers = new Map(imagesDossier.images.map((i) => [i.meta.id, i.file]));
  const entrees = [];
  for (const { entree, fichier } of ajoutsDuDossier({ index: imagesDossier.index, navigateur, supprimees: new Set(local.supprimees) })) {
    const f = fichiers.get(entree.id);
    if (!f) continue; // fichier pas encore là (synchronisation Drive en cours ?) : l'entrée reste dans l'index, on réessaiera
    try {
      const blob = new Blob([await f.arrayBuffer()], { type: entree.type });
      if (!entree.largeur || !entree.hauteur) Object.assign(entree, await dimensions(blob));
      entrees.push({ ...entree, blob });
    } catch (e) { console.warn(`dossier de travail : ${fichier} non importée`, e); }
  }
  if (entrees.length) await ajouterImages(entrees);
  return entrees.length;
}

/** Prévient les pages ouvertes (fenêtre de choix, page Bibliothèque) que des cartes sont arrivées du dossier. */
function annoncerAjouts(n) { if (n && typeof dispatchEvent === 'function') dispatchEvent(new CustomEvent('cdm-images-ajoutees', { detail: { nombre: n } })); }

async function sousChemin(dossier, chemin) {
  const segments = String(chemin).split('/');
  if (!segments.every((x) => /^[A-Za-z0-9._ -]+$/.test(x) && x !== '.' && x !== '..')) throw new Error(`chemin refusé : ${chemin}`);
  let d = dossier;
  for (const x of segments.slice(0, -1)) d = await d.getDirectoryHandle(x);
  return (await d.getFileHandle(segments.at(-1))).getFile();
}

/**
 * Ancien format : les cartes de bibliotheque/catalogue.json du dossier rejoignent la liste (même id, pour que les références
 * { source: 'bibliotheque', id } des mondes la retrouvent), une seule fois : les ids sont notés dans bibliotheque/catalogue-migre.json.
 * Le dossier bibliotheque/ n'est pas modifié autrement.
 */
async function migrerBibliotheque(p) {
  const bib = await sousDossier(p, 'bibliotheque');
  const texte = bib ? await lireTexte(bib, 'catalogue.json') : null;
  if (texte === null) return;
  let brut;
  try { brut = JSON.parse(texte); } catch { return; }
  const { cartes } = validerCatalogue(brut);
  const dejaMigrees = new Set(lireMigrees(await lireTexte(bib, 'catalogue-migre.json')));
  if (cartes.every((c) => dejaMigrees.has(c.id))) return;
  const navigateur = new Set((await listerImages()).map((e) => e.id));
  const ajoute = new Date().toISOString();
  const entrees = [];
  for (const c of cartesAMigrer(cartes, { dejaMigrees, navigateur })) {
    try {
      const e = entreeDeCarte(c, ajoute);
      const blob = new Blob([await (await sousChemin(bib, c.fichier)).arrayBuffer()], { type: e.type });
      if (!e.largeur || !e.hauteur) Object.assign(e, await dimensions(blob));
      entrees.push({ ...e, blob });
    } catch (err) { console.warn(`dossier de travail : carte « ${c.id} » de l’ancien catalogue non importée`, err); }
  }
  if (entrees.length) await ajouterImages(entrees, { prevenir: true }); // recopiées ensuite dans images/
  const migrees = [...new Set([...dejaMigrees, ...cartes.map((c) => c.id)])];
  await ecrireFichier(bib, 'catalogue-migre.json', JSON.stringify({ ids: migrees, note: 'cartes importées dans images/ par Carte de MJ' }, null, 1));
  annoncerAjouts(entrees.length);
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

/**
 * Recopie les images dans images/ d'après ce que le dossier contient vraiment (`imagesDossier`, relu juste avant, ajouts importés) :
 * écrit les nouvelles ou changées, retire celles que le MJ a supprimées ici, garde les entrées venues d'ailleurs, réécrit l'index.
 * `images` : celles du navigateur, triées par id.
 */
async function appliquerImages(p, images, imagesDossier) {
  const noms = nomsImages(images);
  const plan = planDossierImages({
    dossier: { index: imagesDossier.index, etat: new Map(imagesDossier.images.map((i) => [i.meta.id, { sig: imagesDossier.sigImages.get(i.meta.id), fichier: i.fichier }])) },
    images: images.map((e, i) => { const { blob, ...meta } = e; return { meta, sig: signatureImage(e, blob?.size ?? 0), fichier: noms[i] }; }),
    supprimees: new Set(local.supprimees),
  });
  if (plan.aEcrire) {
    const dir = await sousDossier(p, 'images', true);
    for (const f of plan.supprimer) await dir.removeEntry(base(f)).catch(ignorerAbsent);
    const parId = new Map(images.map((e, i) => [e.id, { e, fichier: noms[i] }]));
    for (const id of plan.ecrire) await ecrireFichier(dir, base(parId.get(id).fichier), parId.get(id).e.blob);
    await ecrireFichier(dir, 'index.json', JSON.stringify(plan.index, null, 1));
  }
  if (local.supprimees.length) { local.supprimees = []; ecrireLocal(); }
}

/** Écrit tout le navigateur dans le dossier (ce qui y est déjà à l'identique n'est pas réécrit). */
async function pousserTout(p, nav, dossier) {
  const dd = await sousDossier(p, 'donnees', true);
  for (const [cle, texte] of nav.donnees) if (dossier.donnees.get(cle) !== texte) await ecrireFichier(dd, nomFichierCle(cle), texte);
  for (const cle of dossier.donnees.keys()) if (!nav.donnees.has(cle)) await dd.removeEntry(nomFichierCle(cle)).catch(ignorerAbsent);
  ecrits = new Map(nav.donnees);
  await appliquerImages(p, nav.images, dossier.imagesDossier);
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
  local.dernierSync = dossier.modifie || null; local.sale = false; local.supprimees = []; saleHors = false; ecrireLocal();
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
    let nav = await lireNavigateur();
    const navigateurVide = !nav.donnees.size && !nav.images.length;
    // Les cartes ajoutées au dossier hors de l'appli rejoignent d'abord le navigateur : elles ne comptent ni comme un écart ni comme une perte.
    if (await importerAjouts(dossier.imagesDossier)) nav = await lireNavigateur();
    const identique = comparer(nav.donnees, dossier.donnees).identique && comparer(nav.sigImages, dossier.sigImages).identique;
    const d = decider({ dossier: { vide: dossier.vide, modifie: dossier.modifie }, navigateur: { vide: navigateurVide }, identique, local });
    if (d.action === 'pousser') await pousserTout(p, nav, dossier);
    else if (d.action === 'tirer') { await tirerTout(p, dossier, d.sauvegarderAvant); return; }
    else if (d.action === 'conflit') {
      conflit = { raison: d.raison, modifie: dossier.modifie, dossier: resumeDe(dossier.donnees, dossier.images.length), navigateur: resumeDe(nav.donnees, nav.images.length) };
      definir('conflit');
      return;
    } else {
      racine = p; ecrits = new Map(dossier.donnees);
      if (!dossier.marqueur) await ecrireMarqueur(); else { local.dernierSync = dossier.modifie; ecrireLocal(); }
      local.sale = false; local.supprimees = []; saleHors = false; ecrireLocal();
    }
    enAttente.clear(); echecs = 0; derniere = ''; quand = new Date();
    definir('connecte');
    rattraper();
    try { await migrerBibliotheque(p); } catch (e) { console.warn('dossier de travail : ancien catalogue non importé', e); }
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
      try { await migrerBibliotheque(poignee); } catch (e) { console.warn('dossier de travail : ancien catalogue non importé', e); }
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
    const imagesDossier = await lireImagesDossier(racine);
    annoncerAjouts(await importerAjouts(imagesDossier));
    const images = (await listerImages()).sort((a, b) => (a.id < b.id ? -1 : 1));
    await appliquerImages(racine, images, imagesDossier);
    await ecrireMarqueur();
    succes();
  } catch (e) { imagesEnAttente = true; echec(e); }
}

/** Retour sur l'onglet : les cartes ajoutées au dossier entre-temps (skill generer-carte) rejoignent la liste. */
async function relireAjouts() {
  if (etat !== 'connecte' || !racine) return;
  try { annoncerAjouts(await importerAjouts(await lireImagesDossier(racine))); } catch (e) { console.warn('dossier de travail : relecture des images impossible', e); }
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
  apresEcritureImages.add((detail) => {
    if (muet) return;
    if (detail?.supprimees?.length) { local.supprimees = noterSuppressions(local.supprimees, detail.supprimees); ecrireLocal(); }
    if (etat === 'connecte') planifierImages(); else { saleHors = true; marquerSale(); }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') viderMaintenant();
    else if (etat === 'connecte') enFile(relireAjouts);
  });
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
