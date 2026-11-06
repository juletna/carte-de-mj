/**
 * Sauvegarde complète : tout ce que l'appli garde dans le navigateur (localStorage + images importées d'IndexedDB) dans un seul .zip,
 * et la restauration inverse. Logique pure : le stockage (`stock`) et la liste des images sont injectés, rien ne touche au DOM.
 *
 * Le zip `sauvegarde-carte-de-mj-AAAA-MM-JJ.zip` contient :
 *   sauvegarde.json   { format, version, cree, cles: { <clé localStorage>: <texte brut tel quel> }, images: [{ id, nom, type, largeur, hauteur,
 *                       ajoute, titre, niveau, milieux, tags, description, fichier: "images/<id>.<ext>" }], bibliotheque: [<id>…] }
 *   images/<id>.<ext> le contenu de chaque image importée
 * Les valeurs des clés sont copiées en texte brut, sans transformation : aucun identifiant ne change. Les images de la bibliothèque
 * (dossier bibliotheque/, sur le disque) ne sont pas dans le zip : on cite seulement leurs identifiants.
 */
import { creerZip } from './zip.js';
import { pluriel } from './format.js';

export const FORMAT_SAUVEGARDE = 'carte-de-mj-sauvegarde';
export const VERSION_SAUVEGARDE = 1;
/** Les clés du stockage qui font partie de la sauvegarde (début de leur nom). */
export const PREFIXES_CLES = ['carte-de-mj:', 'dd-fiche-', 'jdr-carte:'];
export const TAILLE_MAX_SAUVEGARDE = 500 * 1024 * 1024;
export const NOM_MANIFESTE = 'sauvegarde.json';
const TYPES_IMAGES = { 'image/webp': 'webp', 'image/png': 'png', 'image/jpeg': 'jpg', 'image/svg+xml': 'svg' };

/** Cette clé du stockage fait-elle partie de la sauvegarde ? */
export const cleRetenue = (cle) => typeof cle === 'string' && PREFIXES_CLES.some((p) => cle.startsWith(p));

/** Toutes les clés d'un stockage : localStorage (length/key) ou stockage simulé (`donnees`). */
export function listerCles(stock) {
  if (typeof stock.key === 'function' && typeof stock.length === 'number') {
    const cles = [];
    for (let i = 0; i < stock.length; i++) { const c = stock.key(i); if (c !== null) cles.push(c); }
    return cles;
  }
  return Object.keys(stock.donnees ?? {});
}

/** Date au format AAAA-MM-JJ (heure locale) pour les noms de fichiers. */
export function dateDuJour(maintenant = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${maintenant.getFullYear()}-${p(maintenant.getMonth() + 1)}-${p(maintenant.getDate())}`;
}
export const nomSauvegarde = (maintenant) => `sauvegarde-carte-de-mj-${dateDuJour(maintenant)}.zip`;
export const nomAvantRestauration = (maintenant) => `avant-restauration-carte-de-mj-${dateDuJour(maintenant)}.zip`;

/** Les identifiants des images de bibliothèque citées dans une valeur JSON (références { source: "bibliotheque", id }), sans doublon. */
export function referencesBibliotheque(valeur, trouvees = new Set(), profondeur = 0) {
  if (!valeur || typeof valeur !== 'object' || profondeur > 100) return trouvees;
  if (valeur.source === 'bibliotheque' && typeof valeur.id === 'string') trouvees.add(valeur.id);
  for (const v of Array.isArray(valeur) ? valeur : Object.values(valeur)) referencesBibliotheque(v, trouvees, profondeur + 1);
  return trouvees;
}

/** Les images de bibliothèque citées par les clés d'une sauvegarde (les valeurs qui ne sont pas du JSON sont ignorées). */
export function bibliothequeCitee(cles) {
  const ids = new Set();
  for (const texte of Object.values(cles)) {
    try { referencesBibliotheque(JSON.parse(texte), ids); } catch { /* valeur non JSON : rien à citer */ }
  }
  return [...ids].sort();
}

/** Les ids cités mais absents du catalogue (`catalogueIds` : tableau ou Set). */
export function bibliothequeManquante(ids, catalogueIds) {
  const presents = new Set(catalogueIds);
  return ids.filter((id) => !presents.has(id));
}

const octetsDe = async (blob) => (blob instanceof Uint8Array ? blob : new Uint8Array(await blob.arrayBuffer()));
const idSur = (id) => String(id).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 100) || 'image';

/**
 * Ce qu'il faut écrire dans le zip : { manifeste, fichiers: [{ nom, donnees }] } (le manifeste est aussi le premier fichier).
 * `images` : les entrées d'IndexedDB (avec leur `blob`).
 */
export async function contenuSauvegarde({ stock, images = [], maintenant = new Date() }) {
  const cles = {};
  for (const cle of listerCles(stock).sort()) {
    if (!cleRetenue(cle)) continue;
    const valeur = stock.getItem(cle);
    if (typeof valeur === 'string') cles[cle] = valeur;
  }
  const fichiersImages = [], metas = [], pris = new Set();
  for (const e of images) {
    const ext = TYPES_IMAGES[e.type] ?? 'bin';
    let nom = `images/${idSur(e.id)}.${ext}`;
    for (let n = 2; pris.has(nom); n++) nom = `images/${idSur(e.id)}-${n}.${ext}`;
    pris.add(nom);
    const { blob, ...meta } = e;
    metas.push({ ...meta, fichier: nom });
    fichiersImages.push({ nom, donnees: await octetsDe(blob), date: maintenant });
  }
  const manifeste = { format: FORMAT_SAUVEGARDE, version: VERSION_SAUVEGARDE, cree: maintenant.toISOString(), cles, images: metas, bibliotheque: bibliothequeCitee(cles) };
  const fichiers = [{ nom: NOM_MANIFESTE, donnees: new TextEncoder().encode(JSON.stringify(manifeste, null, 1)), date: maintenant }, ...fichiersImages];
  return { manifeste, fichiers };
}

/** Le zip complet (Uint8Array) d'un stockage et de ses images. */
export async function fabriquerSauvegarde(options) {
  return creerZip((await contenuSauvegarde(options)).fichiers);
}

/**
 * Valide le contenu d'un zip lu (Map nom → octets). Rend { manifeste, images: [{ meta, octets }], ignorees, manquantes, avertissements }.
 * @throws {Error} message en français : pas une sauvegarde, version trop récente, trop volumineuse
 */
export function lireSauvegarde(fichiers) {
  let total = 0;
  for (const d of fichiers.values()) total += d.length;
  if (total > TAILLE_MAX_SAUVEGARDE) throw new Error('sauvegarde trop volumineuse (500 Mo au plus)');
  const brut = fichiers.get(NOM_MANIFESTE);
  if (!brut) throw new Error('ce zip n’est pas une sauvegarde de Carte de MJ (pas de sauvegarde.json)');
  let m;
  try { m = JSON.parse(new TextDecoder().decode(brut)); } catch { throw new Error('sauvegarde.json est illisible (ce n’est pas du JSON valide)'); }
  if (!m || typeof m !== 'object' || Array.isArray(m) || m.format !== FORMAT_SAUVEGARDE) throw new Error('ce zip n’est pas une sauvegarde de Carte de MJ (format inconnu)');
  if (!Number.isInteger(m.version) || m.version < 1) throw new Error('sauvegarde illisible (version invalide)');
  if (m.version > VERSION_SAUVEGARDE) throw new Error('sauvegarde faite par une version plus récente de Carte de MJ : mets l’appli à jour avant de la restaurer');
  if (!m.cles || typeof m.cles !== 'object' || Array.isArray(m.cles)) throw new Error('sauvegarde illisible (pas de liste de données)');
  const avertissements = [], ignorees = [], cles = {};
  for (const [cle, valeur] of Object.entries(m.cles)) {
    if (!cleRetenue(cle)) { ignorees.push(cle); continue; }
    if (typeof valeur !== 'string') { avertissements.push(`« ${cle} » ignorée : sa valeur n’est pas un texte`); continue; }
    cles[cle] = valeur;
  }
  if (ignorees.length) avertissements.push(`${pluriel(ignorees.length, 'donnée étrangère ignorée', 'données étrangères ignorées')} : ${ignorees.slice(0, 5).join(', ')}`);
  const images = [], manquantes = [];
  for (const meta of Array.isArray(m.images) ? m.images : []) {
    if (!meta || typeof meta !== 'object' || typeof meta.id !== 'string' || !meta.id || typeof meta.fichier !== 'string') { avertissements.push('une image sans identifiant ou sans fichier est ignorée'); continue; }
    if (typeof meta.type !== 'string' || !Object.hasOwn(TYPES_IMAGES, meta.type)) { avertissements.push(`image « ${meta.id.slice(0, 40)} » ignorée : format non pris en charge`); continue; }
    const octets = fichiers.get(meta.fichier);
    if (!octets) { manquantes.push(meta.fichier); continue; }
    images.push({ meta, octets });
  }
  if (manquantes.length) avertissements.push(`${pluriel(manquantes.length, 'image absente du zip', 'images absentes du zip')} : ${manquantes.slice(0, 5).join(', ')}`);
  const biblio = Array.isArray(m.bibliotheque) ? m.bibliotheque.filter((id) => typeof id === 'string') : [];
  return { manifeste: { format: m.format, version: m.version, cree: typeof m.cree === 'string' ? m.cree : '', cles, images: images.map((i) => i.meta), bibliotheque: biblio }, images, ignorees, manquantes, avertissements };
}

/** Les entrées à ranger dans IndexedDB : métadonnées + Blob, id conservés. */
export function entreesImages(lecture) {
  return lecture.images.map(({ meta, octets }) => {
    const { fichier, ...reste } = meta;
    return { ...reste, blob: new Blob([octets], { type: meta.type }) };
  });
}

function compte(cles, cle, extraire) {
  try { const n = extraire(JSON.parse(cles[cle])); return Number.isFinite(n) ? n : 0; } catch { return 0; }
}
const taille = (v) => (Array.isArray(v) ? v.length : v && typeof v === 'object' ? Object.keys(v).length : 0);

/** Ce que contient une sauvegarde, en une phrase (« 3 donjons, 2 personnages, 1 univers… »). */
export function resumeSauvegarde(manifeste) {
  const cles = manifeste.cles ?? {};
  const n = (cle, champ) => compte(cles, cle, (v) => taille(v?.[champ]));
  const morceaux = [
    [n('carte-de-mj:donjons-v1', 'donjons'), 'donjon', 'donjons'],
    [n('dd-fiche-personnages-v1', 'persos'), 'personnage', 'personnages'],
    [n('carte-de-mj:univers-v1', 'univers'), 'univers', 'univers'],
    [n('carte-de-mj:modeles-v1', 'modeles'), 'modèle', 'modèles'],
    [n('carte-de-mj:presentations-v1', 'presentations'), 'partie en cours', 'parties en cours'],
    [Array.isArray(manifeste.images) ? manifeste.images.length : 0, 'image importée', 'images importées'],
  ].filter(([nb]) => nb > 0).map(([nb, un, plusieurs]) => pluriel(nb, un, plusieurs));
  const reste = Object.keys(cles).length;
  return morceaux.length ? morceaux.join(', ') : reste ? `${pluriel(reste, 'donnée', 'données')} (réglages)` : 'aucune donnée';
}

/**
 * Remplace les clés retenues du stock par celles de la sauvegarde : supprime les clés retenues absentes, écrit les autres.
 * Les clés étrangères ne sont jamais touchées. Si une écriture échoue (quota…), l'état d'avant est remis tel quel.
 * @returns {{ ok: true, ecrites: number, supprimees: number } | { ok: false, erreur: string }}
 */
export function restaurer({ manifeste, stock }) {
  const voulues = manifeste.cles ?? {};
  const avant = new Map();
  for (const cle of listerCles(stock)) if (cleRetenue(cle)) avant.set(cle, stock.getItem(cle));
  const aSupprimer = [...avant.keys()].filter((c) => !(c in voulues) || !cleRetenue(c));
  const aEcrire = Object.entries(voulues).filter(([c, v]) => cleRetenue(c) && typeof v === 'string' && avant.get(c) !== v);
  const touchees = [];
  try {
    for (const cle of aSupprimer) { touchees.push(cle); stock.removeItem(cle); }
    for (const [cle, valeur] of aEcrire) { touchees.push(cle); stock.setItem(cle, valeur); }
    return { ok: true, ecrites: aEcrire.length, supprimees: aSupprimer.length };
  } catch (e) {
    const echecs = [];
    for (const cle of touchees) {
      try { if (avant.has(cle)) stock.setItem(cle, avant.get(cle)); else stock.removeItem(cle); } catch { echecs.push(cle); }
    }
    const cause = /quota/i.test(`${e?.name} ${e?.message}`) ? 'espace de stockage plein' : (e?.message || 'écriture refusée');
    return { ok: false, erreur: `restauration impossible (${cause}) ; ${echecs.length ? `attention, ${pluriel(echecs.length, 'donnée n’a', 'données n’ont')} pas pu être remise en l’état` : 'rien n’a été modifié'}` };
  }
}
