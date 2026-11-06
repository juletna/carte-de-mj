/**
 * Dossier de travail, partie pure : l'appli recopie ses données dans un dossier choisi par le MJ et les relit au démarrage.
 * Ici, seulement ce qui se teste sans navigateur : noms de fichiers des clés, comparaison navigateur / dossier, décision de
 * synchronisation au démarrage, plan d'écriture des images, textes d'état. Les accès au dossier sont dans js/dossier-travail.js.
 *
 * Disposition du dossier :
 *   dossier-carte-de-mj.json   { format, version, modifie (ISO), appareil }   le marqueur : date de la dernière écriture
 *   donnees/<clé>.json         texte brut de chaque clé retenue (voir cleRetenue) ; « : » devient « __ », tout autre caractère
 *                              hors a-z 0-9 . - devient _hh_ (hexadécimal) : le nom se relit en la même clé
 *   images/index.json          [{ id, nom, type, largeur, hauteur, ajoute, titre, niveau, milieux, tags, description, fichier }]
 *   images/<id>.<ext>          le contenu des images importées
 *   bibliotheque/…             lu seulement par l'appli (catalogue.json, cartes/, references/)
 *
 * Marqueur local du navigateur (clé hors sauvegarde `cdm-dossier-local-v1`) : { appareil, dernierSync, sale }.
 *   dernierSync  la date `modifie` du dossier à la dernière synchronisation réussie ;
 *   sale         une donnée a changé ici sans être recopiée (pas de dossier, ou écriture en échec).
 */
import { cleRetenue, listerCles } from './sauvegarde.js';

export const FORMAT_DOSSIER = 'carte-de-mj-dossier';
export const VERSION_DOSSIER = 1;
export const NOM_MARQUEUR = 'dossier-carte-de-mj.json';
export const CLE_LOCALE = 'cdm-dossier-local-v1';
export const CHAMPS_IMAGE = ['id', 'nom', 'type', 'largeur', 'hauteur', 'ajoute', 'titre', 'niveau', 'milieux', 'tags', 'description'];

/** Nom du fichier (dans donnees/) d'une clé : « carte-de-mj:donjons-v1 » → « carte-de-mj__donjons-v1.json ». */
export function nomFichierCle(cle) {
  let nom = '';
  for (const c of String(cle)) {
    if (/[a-z0-9.-]/.test(c)) nom += c;
    else if (c === ':') nom += '__';
    else nom += `_${c.codePointAt(0).toString(16).padStart(2, '0')}_`;
  }
  return `${nom}.json`;
}

/** La clé retenue qui correspond à un nom de fichier de donnees/, ou null (nom étranger, ou qui ne se relit pas à l'identique). */
export function cleDuFichier(nom) {
  if (typeof nom !== 'string' || !nom.endsWith('.json')) return null;
  const base = nom.slice(0, -5);
  if (!/^[a-z0-9._-]+$/.test(base)) return null;
  const cle = base.replace(/__|_([0-9a-f]{2,6})_/g, (m, hex) => (hex ? String.fromCodePoint(parseInt(hex, 16)) : ':'));
  return cleRetenue(cle) && nomFichierCle(cle) === nom ? cle : null;
}

/** Les clés retenues d'un stockage : Map clé → texte brut. */
export function donneesDuStock(stock) {
  const m = new Map();
  for (const cle of listerCles(stock).sort()) {
    if (!cleRetenue(cle)) continue;
    const v = stock.getItem(cle);
    if (typeof v === 'string') m.set(cle, v);
  }
  return m;
}

/** Compare deux Map clé → texte (ou id → signature) : { identique, differentes, seulA, seulB }. */
export function comparer(a, b) {
  const differentes = [], seulA = [], seulB = [];
  for (const [k, v] of a) { if (!b.has(k)) seulA.push(k); else if (b.get(k) !== v) differentes.push(k); }
  for (const k of b.keys()) if (!a.has(k)) seulB.push(k);
  return { identique: !differentes.length && !seulA.length && !seulB.length, differentes, seulA, seulB };
}

/** Signature d'une image (champs de métadonnées + taille du contenu) : deux images de même signature sont les mêmes. */
export function signatureImage(meta, taille) {
  return JSON.stringify([...CHAMPS_IMAGE.map((c) => meta?.[c] ?? null), taille]);
}

/** Ce qu'il faut écrire (ids) et supprimer (fichiers) pour passer de l'état `avant` à `apres` (Map id → { sig, fichier }). */
export function planImages(avant, apres) {
  const ecrire = [], supprimer = [];
  for (const [id, a] of apres) {
    const v = avant.get(id);
    if (!v || v.sig !== a.sig || v.fichier !== a.fichier) ecrire.push(id);
    if (v && v.fichier !== a.fichier) supprimer.push(v.fichier);
  }
  for (const [id, v] of avant) if (!apres.has(id)) supprimer.push(v.fichier);
  return { ecrire, supprimer: [...new Set(supprimer)] };
}

/** Lit le marqueur du dossier. Rend { modifie, appareil } ou null ; lève une Error (en français) s'il vient d'une version plus récente. */
export function lireMarqueur(texte) {
  let m;
  try { m = JSON.parse(texte); } catch { return null; }
  if (!m || typeof m !== 'object' || m.format !== FORMAT_DOSSIER) return null;
  if (!Number.isInteger(m.version) || m.version < 1) return null;
  if (m.version > VERSION_DOSSIER) throw new Error('ce dossier a été écrit par une version plus récente de Carte de MJ : mets l’appli à jour');
  return { modifie: typeof m.modifie === 'string' ? m.modifie : '', appareil: typeof m.appareil === 'string' ? m.appareil : '' };
}
export const texteMarqueur = ({ modifie, appareil }) => JSON.stringify({ format: FORMAT_DOSSIER, version: VERSION_DOSSIER, modifie, appareil }, null, 1);

/** Relit le marqueur local (texte du localStorage) ; `fabriquerId` donne l'identifiant d'un nouvel appareil. */
export function lireLocal(texte, fabriquerId) {
  let m = null;
  try { m = JSON.parse(texte); } catch { /* absent ou abîmé : on repart de zéro */ }
  const ok = m && typeof m === 'object' && !Array.isArray(m);
  return {
    appareil: ok && typeof m.appareil === 'string' && m.appareil ? m.appareil : fabriquerId(),
    dernierSync: ok && typeof m.dernierSync === 'string' && m.dernierSync ? m.dernierSync : null,
    sale: Boolean(ok && m.sale === true),
  };
}

/**
 * La décision au démarrage ou à la connexion.
 *   dossier    { vide, modifie }   vide : ni marqueur, ni données, ni images ; modifie : date du marqueur ('' si absent)
 *   navigateur { vide }            aucune clé retenue ni image
 *   identique  le contenu (données et images) est le même des deux côtés
 *   local      { dernierSync, sale }
 * @returns {{ action: 'rien' | 'pousser' | 'tirer' | 'conflit', sauvegarderAvant: boolean, raison: string }}
 *   sauvegarderAvant : un remplacement du navigateur est possible, on télécharge d'abord son état (zip).
 */
export function decider({ dossier, navigateur, identique, local }) {
  if (identique) return { action: 'rien', sauvegarderAvant: false, raison: 'identique' };
  if (dossier.vide) return { action: 'pousser', sauvegarderAvant: false, raison: 'dossier vide' };
  if (navigateur.vide) return { action: 'tirer', sauvegarderAvant: false, raison: 'navigateur vide' };
  if (local.dernierSync && dossier.modifie === local.dernierSync) return { action: 'pousser', sauvegarderAvant: false, raison: 'le dossier n’a pas bougé depuis la dernière synchronisation' };
  if (local.dernierSync && !local.sale) return { action: 'tirer', sauvegarderAvant: true, raison: 'le dossier est plus récent' };
  return { action: 'conflit', sauvegarderAvant: true, raison: local.dernierSync ? 'les deux ont changé' : 'ce navigateur n’a jamais été synchronisé avec ce dossier' };
}

const deux = (n) => String(n).padStart(2, '0');
export const heure = (d) => `${deux(d.getHours())}:${deux(d.getMinutes())}`;

/** La ligne d'état du dialogue. `etat` : indisponible | aucun | synchronisation | connecte | a-reconnecter | conflit | erreur. */
export function texteEtat({ etat, nom = '', quand = null, erreur = '' }) {
  const dossier = nom ? `« ${nom} »` : 'le dossier';
  switch (etat) {
    case 'indisponible': return 'Non disponible dans ce navigateur (Chrome ou Edge sur ordinateur)';
    case 'aucun': return 'Aucun dossier';
    case 'synchronisation': return `Synchronisation avec ${dossier}…`;
    case 'connecte': return `Enregistré dans ${dossier}${quand ? ` à ${heure(quand)}` : ''}${erreur ? ` ; dernière écriture en échec : ${erreur}` : ''}`;
    case 'a-reconnecter': return `À reconnecter : ${dossier} attend ton autorisation`;
    case 'conflit': return `Conflit avec ${dossier} : le dossier et ce navigateur ont changé chacun de leur côté`;
    case 'erreur': return `Dossier ${dossier} inutilisable : ${erreur || 'erreur inconnue'}`;
    default: return '';
  }
}
