/**
 * Images importées par le MJ, rangées dans IndexedDB (base « carte-de-mj », magasin « images »).
 * Entrée : { id, nom, type (MIME), blob, largeur, hauteur, ajoute (ISO), titre, niveau, milieux, tags, description, credit, licence,
 * grille?, origine? }. C'est la liste unique des cartes : importées ici, ou ajoutées au dossier de travail (skill generer-carte).
 * `apresEcritureImages` : écouteurs prévenus après chaque écriture (dossier de travail, js/dossier-travail.js), avec
 * { supprimees: [ids] } quand des images ont disparu.
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

/**
 * Fonctions appelées après chaque écriture réussie (le dossier de travail y recopie les images), avec { supprimees: [ids] }.
 * Une erreur d'un écouteur n'empêche rien.
 */
export const apresEcritureImages = new Set();
const prevenir = (detail) => { for (const f of apresEcritureImages) { try { f(detail); } catch (e) { console.warn('écouteur d’images :', e); } } };

/** `detail` : ce que reçoivent les écouteurs (rempli pendant la transaction) ; `silencieux` : personne n'est prévenu. */
function transaction(mode, action, { detail = { supprimees: [] }, silencieux = false } = {}) {
  return ouvrir().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(MAGASIN, mode);
    const req = action(tx.objectStore(MAGASIN));
    tx.oncomplete = () => { if (mode === 'readwrite' && !silencieux) prevenir(detail); resolve(req?.result); };
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
 * Importe un fichier image avec ses métadonnées { titre, niveau, milieux, tags, description, credit, licence, origine }. Rend l'entrée rangée.
 * `colonnes` (facultatif) : nombre de cases demandées sur la largeur (volet « Générer une illustration IA ») ; la grille en découle
 * d'après la largeur réelle de l'image, que le générateur a pu changer.
 * Lève une Error au message lisible si le fichier ne convient pas ou si le rangement échoue.
 */
export async function importerImage(fichier, meta = {}) {
  const type = typeImage(fichier);
  if (!type) throw new Error('format non pris en charge (webp, png, jpg ou svg)');
  if (fichier.size > TAILLE_MAX) throw new Error('image trop lourde (25 Mo au plus)');
  const verif = validerCarte({ titre: meta.titre || fichier.name.replace(/\.[^.]+$/, ''), niveau: meta.niveau, milieux: meta.milieux, tags: meta.tags, description: meta.description, credit: meta.credit, licence: meta.licence, origine: meta.origine }, { avecFichier: false });
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

/** Supprime une image (la confirmation en deux clics est dans l'interface) ; le dossier de travail la retirera aussi. */
export const supprimerImage = (id) => transaction('readwrite', (s) => s.delete(id), { detail: { supprimees: [id] } });

/** Remplace TOUTES les images par ces entrées (id conservés), en une seule transaction : tout ou rien. */
export function remplacerToutesImages(entrees) {
  const detail = { supprimees: [] };
  const gardees = new Set(entrees.map((e) => e.id));
  return transaction('readwrite', (s) => {
    const avant = s.getAllKeys();
    avant.onsuccess = () => {
      detail.supprimees = avant.result.filter((id) => !gardees.has(id));
      s.clear();
      for (const e of entrees) s.put(e);
    };
  }, { detail });
}

/**
 * Range des entrées complètes (avec blob) venues du dossier de travail, sans toucher aux autres. `prevenir` : false pour des images
 * déjà dans le dossier (rien à y recopier), true pour celles de l'ancien catalogue (à recopier dans images/).
 */
export const ajouterImages = (entrees, { prevenir: avertir = false } = {}) => transaction('readwrite', (s) => {
  for (const e of entrees) s.put(e);
}, { silencieux: !avertir });
