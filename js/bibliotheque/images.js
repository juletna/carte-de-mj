/**
 * Images importées par le MJ, rangées dans IndexedDB (base « carte-de-mj », magasin « images »).
 * Entrée : { id, nom, type (MIME), blob, largeur, hauteur, ajoute (ISO), titre, niveau, milieux, tags, description }.
 * `apresEcritureImages` : écouteurs prévenus après chaque écriture (dossier de travail, js/dossier-travail.js).
 * Touche indexedDB et le DOM (dimensions de l'image) : pas pour Node. Toute erreur est rendue, jamais avalée en silence.
 */
import { validerCarte } from './catalogue.js';
import { cadrageCentre } from './prompt.js';

const BASE = 'carte-de-mj';
const MAGASIN = 'images';
const TYPES = ['image/webp', 'image/png', 'image/jpeg', 'image/svg+xml'];
export const TAILLE_MAX = 25 * 1024 * 1024;

let ouverture;
function ouvrir() {
  ouverture ??= new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('le navigateur ne propose pas IndexedDB')); return; }
    const req = indexedDB.open(BASE, 1);
    req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(MAGASIN)) req.result.createObjectStore(MAGASIN, { keyPath: 'id' }); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('ouverture de la base impossible'));
    req.onblocked = () => reject(new Error('base bloquée par un autre onglet'));
  }).catch((e) => { ouverture = undefined; throw e; });
  return ouverture;
}

/** Fonctions appelées après chaque écriture réussie (le dossier de travail y recopie les images). Une erreur d'un écouteur n'empêche rien. */
export const apresEcritureImages = new Set();
const prevenir = () => { for (const f of apresEcritureImages) { try { f(); } catch (e) { console.warn('écouteur d’images :', e); } } };

function transaction(mode, action) {
  return ouvrir().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(MAGASIN, mode);
    const req = action(tx.objectStore(MAGASIN));
    tx.oncomplete = () => { if (mode === 'readwrite') prevenir(); resolve(req?.result); };
    tx.onerror = () => reject(tx.error ?? new Error('écriture impossible'));
    tx.onabort = () => reject(tx.error ?? new Error('opération annulée (espace plein ?)'));
  }));
}

/** Type MIME d'une image acceptée d'après le fichier (le nom aide quand le navigateur ne donne pas de type). */
export function typeImage(fichier) {
  if (TYPES.includes(fichier.type)) return fichier.type;
  const ext = fichier.name?.split('.').pop()?.toLowerCase();
  return { webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', svg: 'image/svg+xml' }[ext] ?? null;
}

/** Largeur et hauteur naturelles d'un blob image (1000 × 1000 pour un SVG sans taille). */
export function dimensions(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve({ largeur: img.naturalWidth || 1000, hauteur: img.naturalHeight || 1000 }); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('ce fichier n’est pas une image lisible')); };
    img.src = url;
  });
}

/**
 * Recadre au centre une image aux proportions `largeur` : `hauteur` (16:9 du style peint-v2), sans l'agrandir.
 * Rend { fichier, avant, apres } : `fichier` est un File (webp, ou png quand le navigateur n'encode pas le webp),
 * ou le fichier d'origine tel quel quand il a déjà ces proportions ou que c'est un SVG.
 */
export async function recadrerImage(fichier, largeur, hauteur) {
  const type = typeImage(fichier);
  const avant = await dimensions(fichier);
  const cadre = type === 'image/svg+xml' ? null : cadrageCentre(avant.largeur, avant.hauteur, largeur, hauteur);
  if (!cadre) return { fichier, avant, apres: avant };
  const image = await createImageBitmap(fichier, cadre.x, cadre.y, cadre.largeur, cadre.hauteur);
  const toile = document.createElement('canvas');
  toile.width = cadre.largeur; toile.height = cadre.hauteur;
  toile.getContext('2d').drawImage(image, 0, 0);
  image.close();
  const blob = await new Promise((resolve, reject) => toile.toBlob((b) => (b ? resolve(b) : reject(new Error('recadrage impossible'))), 'image/webp', 0.92));
  const ext = blob.type === 'image/webp' ? 'webp' : 'png';
  const nom = `${String(fichier.name || 'carte').replace(/\.[^.]+$/, '')}-16x9.${ext}`;
  return { fichier: new File([blob], nom, { type: blob.type }), avant, apres: { largeur: cadre.largeur, hauteur: cadre.hauteur } };
}

const nouvelId = () => `img-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/**
 * Importe un fichier image avec ses métadonnées { titre, niveau, milieux, tags, description, origine }. Rend l'entrée rangée.
 * `colonnes` (facultatif) : nombre de cases demandées sur la largeur (onglet « Générer une carte ») ; la grille en découle
 * d'après la largeur réelle de l'image, que le générateur a pu changer.
 * Lève une Error au message lisible si le fichier ne convient pas ou si le rangement échoue.
 */
export async function importerImage(fichier, meta = {}) {
  const type = typeImage(fichier);
  if (!type) throw new Error('format non pris en charge (webp, png, jpg ou svg)');
  if (fichier.size > TAILLE_MAX) throw new Error('image trop lourde (25 Mo au plus)');
  const verif = validerCarte({ titre: meta.titre || fichier.name.replace(/\.[^.]+$/, ''), niveau: meta.niveau, milieux: meta.milieux, tags: meta.tags, description: meta.description, origine: meta.origine }, { avecFichier: false });
  if (verif.erreur) throw new Error(verif.erreur);
  const blob = fichier.slice(0, fichier.size, type);
  const { largeur, hauteur } = await dimensions(blob);
  const entree = { id: nouvelId(), nom: String(fichier.name).slice(0, 200), type, blob, largeur, hauteur, ajoute: new Date().toISOString(), ...verif.carte };
  if (Number.isInteger(meta.colonnes) && meta.colonnes > 0) entree.grille = { case: Math.round((largeur / meta.colonnes) * 100) / 100, dx: 0, dy: 0 };
  await transaction('readwrite', (s) => s.add(entree));
  return entree;
}

/** Toutes les images importées, les plus récentes d'abord. */
export async function listerImages() {
  const toutes = await transaction('readonly', (s) => s.getAll());
  return (toutes ?? []).sort((a, b) => String(b.ajoute).localeCompare(String(a.ajoute)));
}

/** Une image importée, ou undefined. */
export const lireImage = (id) => transaction('readonly', (s) => s.get(id));

/** Supprime une image importée (la confirmation en deux clics est dans l'interface). */
export const supprimerImage = (id) => transaction('readwrite', (s) => s.delete(id));

/** Remplace TOUTES les images importées par ces entrées (id conservés), en une seule transaction : tout ou rien. */
export const remplacerToutesImages = (entrees) => transaction('readwrite', (s) => {
  s.clear();
  for (const e of entrees) s.put(e);
});
